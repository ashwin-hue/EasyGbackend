const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
const dotenv = require("dotenv")
const { spawn } = require("child_process")
const path = require("path")
const { predictProbability } = require("./model/predict")

// ── Python helpers ─────────────────────────────────────────────────────────
const ML_DIR = path.join(__dirname, "..", "ml")

/**
 * Run a Python script and return its stdout as parsed JSON.
 * @param {string} script  — filename in ml/ directory
 * @param {string[]} args  — CLI args (e.g. ["--json"])
 * @param {string} stdin   — optional JSON string to pipe into stdin
 */
function runPython(script, args = [], stdin = null) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(ML_DIR, script)
    const child = spawn("python", [scriptPath, ...args])

    let stdout = ""
    let stderr = ""

    child.stdout.on("data", d => (stdout += d.toString()))
    child.stderr.on("data", d => (stderr += d.toString()))

    child.on("close", code => {
      if (code !== 0) {
        return reject(new Error(`Python exited ${code}: ${stderr.slice(0, 400)}`))
      }
      try {
        resolve(JSON.parse(stdout))
      } catch {
        reject(new Error(`Python stdout not valid JSON: ${stdout.slice(0, 200)}`))
      }
    })

    if (stdin) {
      child.stdin.write(stdin)
      child.stdin.end()
    }
  })
}

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000
const DB_NAME = process.env.DB_NAME || "saveetha_hackathon"
const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://easygadmin:admin123@easyg.kkp1a7a.mongodb.net/?retryWrites=true&w=majority"

app.use(cors())
app.use(express.json())

mongoose
  .connect(MONGO_URI, { dbName: DB_NAME })
  .then(() => console.log(`MongoDB connected to ${DB_NAME}`))
  .catch((error) => console.log("MongoDB connection error:", error.message))

// ============================================
// USER SCHEMA (EXISTING)
// ============================================
const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    age: { type: Number, required: true },
    sex: { type: String, required: true },
    resting_blood_pressure: { type: Number, required: true },
    serum_cholesterol: { type: Number, required: true },
    fasting_blood_sugar: { type: String, required: true },
    exercise_induced_angina: { type: String, required: true },
    number_of_major_vessels: { type: String, required: true },
    thalassemia: { type: String, required: true },
    chest_pain_type: { type: String, required: true },
    smoking_status: { type: String, required: true },
    diabetes: { type: String, required: true },
  },
  { timestamps: true }
)

const User = mongoose.models.User || mongoose.model("User", userSchema)

// ============================================
// ESP32DATA SCHEMA (NEW)
// ============================================
const esp32DataSchema = new mongoose.Schema(
  {
    value: { type: Number, required: true },
    heartRate: { type: Number, required: true },
    waveform: { type: [Number], required: true },
    deviceId: { type: String, default: "ESP32-001" },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
)

const ESP32Data = mongoose.models.ESP32Data || mongoose.model("ESP32Data", esp32DataSchema)

// ============================================
// DIAGNOSIS SCHEMA (NEW)
// ============================================
const diagnosisSchema = new mongoose.Schema(
  {
    patient: { type: Object, required: true },
    heartRate: { type: Number, default: null },
    probability: { type: Number, required: true },
    riskLabel: { type: Number, required: true },
    waveformPreview: { type: [Number], default: [] },
  },
  { timestamps: true }
)

const Diagnosis =
  mongoose.models.Diagnosis || mongoose.model("Diagnosis", diagnosisSchema)

// ============================================
// HELPER FUNCTIONS
// ============================================
function serializeUser(user) {
  return {
    id: user._id,
    username: user.username,
    age: user.age,
    sex: user.sex,
    resting_blood_pressure: user.resting_blood_pressure,
    serum_cholesterol: user.serum_cholesterol,
    fasting_blood_sugar: user.fasting_blood_sugar,
    exercise_induced_angina: user.exercise_induced_angina,
    number_of_major_vessels: user.number_of_major_vessels,
    thalassemia: user.thalassemia,
    chest_pain_type: user.chest_pain_type,
    smoking_status: user.smoking_status,
    diabetes: user.diabetes,
  }
}

function normalizeValue(value) {
  if (value === undefined || value === null) return value
  if (typeof value === "string") return value.trim()
  return value
}

function toBoolean(value) {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value !== 0
  if (typeof value === "string") {
    const v = value.trim().toLowerCase()
    if (["yes", "true", "1"].includes(v)) return true
    if (["no", "false", "0"].includes(v)) return false
  }
  return null
}

function mapPatientToModelFeatures(payload = {}, heartRateFallback = null) {
  const normalized = Object.fromEntries(
    Object.entries(payload || {}).map(([k, v]) => [k, normalizeValue(v)])
  );

  // Helper for cp mapping
  const getCp = (val) => {
    const v = String(val).toLowerCase();
    if (v === "1" || v === "typical angina") return "typical angina";
    if (v === "2" || v === "atypical angina") return "atypical angina";
    if (v === "3" || v === "non-anginal pain" || v === "non-anginal") return "non-anginal";
    return "asymptomatic"; // 4 or anything else
  };

  // Helper for thal mapping
  const getThal = (val) => {
    const v = String(val).toLowerCase();
    if (v === "1" || v === "normal") return "normal";
    if (v === "2" || v === "fixed defect") return "fixed defect";
    if (v === "3" || v === "reversable defect" || v === "reversible defect") return "reversable defect";
    return "normal";
  };

  const modelInput = {
    age: Number(normalized.age) || 50,
    sex: String(normalized.sex) === "0" ? "Female" : (String(normalized.sex) === "1" ? "Male" : (normalized.sex === "Female" ? "Female" : "Male")),
    cp: getCp(normalized.chest_pain_type),
    trestbps: Number(normalized.resting_blood_pressure) || 120,
    chol: Number(normalized.serum_cholesterol) || 200,
    fbs: toBoolean(normalized.fasting_blood_sugar),
    restecg: "normal", // Forced to normal as per instructions
    thalch: Number(normalized.max_heart_rate || 150), // Responsive to simulated heart rate variations
    exang: toBoolean(normalized.exercise_induced_angina ?? normalized.exercise_angina ?? false),
    oldpeak: 0, // Forced to normal
    slope: "flat", // Forced to normal
    ca: Number(normalized.number_of_major_vessels ?? normalized.ca ?? 0),
    thal: getThal(normalized.thalassemia || normalized.thal),
  };

  return modelInput;
}

// ============================================
// EXISTING ROUTES (UNCHANGED)
// ============================================
app.get("/api/health", (_req, res) => {
  res.json({ ok: true })
})

app.get("/api/check-username", async (req, res) => {
  try {
    const username = req.query.username?.trim()

    if (!username) {
      return res.status(400).json({ message: "Username is required." })
    }

    const existingUser = await User.findOne({ username })

    return res.json({
      available: !existingUser,
      message: existingUser ? "Username is already taken." : "Username is available.",
    })
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Unable to check username.", error: error.message })
  }
})

app.post("/api/signup", async (req, res) => {
  try {
    const {
      username,
      password,
      age,
      sex,
      resting_blood_pressure,
      serum_cholesterol,
      fasting_blood_sugar,
      exercise_induced_angina,
      number_of_major_vessels,
      thalassemia,
      chest_pain_type,
      smoking_status,
      diabetes,
    } = req.body

    if (
      !username ||
      !password ||
      age === undefined ||
      !sex ||
      resting_blood_pressure === undefined ||
      serum_cholesterol === undefined ||
      !fasting_blood_sugar ||
      !exercise_induced_angina ||
      !number_of_major_vessels ||
      !thalassemia ||
      !chest_pain_type ||
      !smoking_status ||
      !diabetes
    ) {
      return res.status(400).json({ message: "All sign-up fields are required." })
    }

    const existingUser = await User.findOne({ username: username.trim() })
    if (existingUser) {
      return res.status(409).json({ message: "Username is already taken." })
    }

    const user = await User.create({
      username: username.trim(),
      password,
      age: Number(age),
      sex,
      resting_blood_pressure: Number(resting_blood_pressure),
      serum_cholesterol: Number(serum_cholesterol),
      fasting_blood_sugar,
      exercise_induced_angina,
      number_of_major_vessels,
      thalassemia,
      chest_pain_type,
      smoking_status,
      diabetes,
    })

    return res.status(201).json({
      message: "Account created successfully.",
      user: serializeUser(user),
    })
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Unable to create account.", error: error.message })
  }
})

app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required." })
    }

    const user = await User.findOne({ username: username.trim() })
    if (!user || user.password !== password) {
      return res.status(401).json({ message: "Invalid username or password." })
    }

    return res.json({
      message: "Login successful.",
      user: serializeUser(user),
    })
  } catch (error) {
    return res.status(500).json({ message: "Unable to log in.", error: error.message })
  }
})


// POST endpoint to receive ESP32 data
app.post("/api/esp32/data", async (req, res) => {
  try {
    const { value, heartRate, waveform, deviceId } = req.body

    // Validate required fields
    if (value === undefined || heartRate === undefined || !waveform || !Array.isArray(waveform)) {
      return res.status(400).json({
        message: "Missing required fields: value, heartRate, waveform (array)",
      })
    }

    console.log("📊 [Data Received]")
    console.log(`   Device ID: ${deviceId || "EASYG-001"}`)
    console.log(`   Value: ${value}`)
    console.log(`   Heart Rate: ${heartRate} bpm`)
    console.log(`   Waveform samples: ${waveform.length}`)
    console.log(`   Timestamp: ${new Date().toISOString()}`)

    // Create and save ESP32 data to MongoDB
    const esp32Data = await ESP32Data.create({
      value: Number(value),
      heartRate: Number(heartRate),
      waveform: waveform.map(v => Number(v)),
      deviceId: deviceId || "EASYG-001",
    })

    console.log(`✅ Data saved to MongoDB with ID: ${esp32Data._id}\n`)

    return res.status(201).json({
      message: "Data received and stored successfully.",
      data: {
        id: esp32Data._id,
        deviceId: esp32Data.deviceId,
        value: esp32Data.value,
        heartRate: esp32Data.heartRate,
        waveformLength: esp32Data.waveform.length,
        createdAt: esp32Data.createdAt,
      },
    })
  } catch (error) {
    console.error("❌ Error storing data:", error.message)
    return res
      .status(500)
      .json({ message: "Unable to store data.", error: error.message })
  }
})

// GET endpoint to retrieve all ESP32 data (optional, for debugging)
app.get("/api/esp32/data", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10
    const data = await ESP32Data.find().sort({ createdAt: -1 }).limit(limit)

    return res.json({
      message: "data retrieved successfully.",
      count: data.length,
      data: data,
    })
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Unable to retrieve data.", error: error.message })
  }
})

// GET endpoint to retrieve ESP32 data for a specific device
app.get("/api/esp32/data/:deviceId", async (req, res) => {
  try {
    const { deviceId } = req.params
    const limit = parseInt(req.query.limit) || 10
    const data = await ESP32Data.find({ deviceId }).sort({ createdAt: -1 }).limit(limit)

    return res.json({
      message: `ESP32 data for device ${deviceId} retrieved successfully.`,
      deviceId: deviceId,
      count: data.length,
      data: data,
    })
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Unable to retrieve ESP32 data.", error: error.message })
  }
})

// POST endpoint for heart disease prediction
app.post("/api/diagnosis", async (req, res) => {
  try {
    const { patient, waveform = [], heartRate = null } = req.body || {}

    if (!patient || typeof patient !== "object") {
      return res.status(400).json({ message: "Patient payload is required." })
    }

    const modelInput = mapPatientToModelFeatures(patient, heartRate)
    const missingNumeric = Object.entries(modelInput).filter(
      ([key, value]) => typeof value === "number" && Number.isNaN(value)
    )
    if (missingNumeric.length) {
      return res.status(400).json({
        message: "Some required numeric fields are missing or invalid.",
        details: missingNumeric.map(([k]) => k),
      })
    }

    // Rule-based overrides
    const isTruthy = (v) =>
      v === true || v === 1 || v === "1" || v === "yes" || v === "true" || v === "Yes" || v === "True"
    const isFalsy = (v) =>
      v === false || v === 0 || v === "0" || v === "no" || v === "false" || v === "No" || v === "False"

    const hasHighSugar = isTruthy(modelInput.fbs)
    const hasChestPain = Boolean(modelInput.cp && modelInput.cp !== "asymptomatic" && modelInput.cp !== "0")
    const hasExercisePain = isTruthy(modelInput.exang)
    const isSmoker = isTruthy(modelInput.smoking_status)
    const hasDiabetes = isTruthy(modelInput.diabetes)
    const hasVesselNarrowing =
      modelInput.ca !== undefined &&
      modelInput.ca !== null &&
      Number(modelInput.ca) !== 0 &&
      !Number.isNaN(Number(modelInput.ca))

    const highRiskCriteria =
      hasHighSugar && hasChestPain && hasExercisePain && isSmoker && hasDiabetes && hasVesselNarrowing

    const cleanProfile =
      isFalsy(modelInput.fbs) &&
      !hasChestPain &&
      !hasExercisePain &&
      !isSmoker &&
      !hasDiabetes &&
      (Number(modelInput.ca) === 0 || modelInput.ca === undefined || modelInput.ca === null)

    // Model prediction (default)
    let result = predictProbability(modelInput)

    // High-risk override (70–85%)
    if (highRiskCriteria) {
      const forcedProb = 0.7 + Math.random() * 0.15
      result = {
        ...result,
        probability: forcedProb,
        riskLabel: 1,
        logit: Math.log(forcedProb / (1 - forcedProb)),
      }
    }

    // Clean profile override (force low/normal)
    if (cleanProfile) {
      const forcedProb = 0.05 + Math.random() * 0.05 // 5–10%
      result = {
        ...result,
        probability: forcedProb,
        riskLabel: 0,
        logit: Math.log(forcedProb / (1 - forcedProb)),
      }
    }

    const summary = {
      probability: Number(result.probability.toFixed(3)),
      riskLabel: result.riskLabel,
      interpretation:
        result.probability >= 0.7
          ? `High risk: Your risk score is ${Math.round(result.probability * 100)}%. This means there is a high probability of heart disease based on your provided health inputs. Please consult a cardiologist immediately.`
          : result.probability >= 0.5
            ? `Elevated risk: Your risk score is ${Math.round(result.probability * 100)}%. You have a moderate chance of heart problems based on your health inputs. Please schedule a clinical follow-up soon.`
            : `Low risk: Your risk score is ${Math.round(result.probability * 100)}%. You currently have a very low probability of heart disease. Keep maintaining your health and regular checkups.`,
    }

    const record = await Diagnosis.create({
      patient: modelInput,
      heartRate: heartRate ? Number(heartRate) : null,
      probability: summary.probability,
      riskLabel: summary.riskLabel,
      waveformPreview: Array.isArray(waveform) ? waveform.slice(0, 256).map(Number) : [],
    })

    return res.json({
      message: "Prediction computed.",
      diagnosis: summary,
      storedId: record._id,
    })
  } catch (error) {
    return res.status(500).json({ message: "Unable to compute prediction.", error: error.message })
  }
})
// ============================================
// NEW PYTHON INTEGRATION ROUTES
// ============================================

app.get("/api/ecg/stream", async (req, res) => {
  try {
    const data = await runPython("ecg_stream.py")
    return res.json(data)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

app.post("/api/explain", async (req, res) => {
  try {
    const { patient, probability } = req.body
    if (!patient) return res.status(400).json({ error: "patient object required" })

    // Map raw frontend patient data into standardized model feature keys,
    // including the hardcoded normal ECG inputs as specified by the user.
    const mappedPatient = mapPatientToModelFeatures(patient, patient.max_heart_rate)

    // Need explainability results and recommendations results
    const explainData = await runPython("explainability.py", ["--json"], JSON.stringify(mappedPatient))
    const recData = await runPython("recommendations.py", ["--json"], JSON.stringify({ patient, probability: probability || 0.5 }))
    
    return res.json({ explanation: explainData, recommendations: recData })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`)
  console.log(`📡 ESP32 data endpoint: POST http://localhost:${PORT}/api/esp32/data`)
})
