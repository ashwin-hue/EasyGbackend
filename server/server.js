const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
const dotenv = require("dotenv")

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


app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`)
  console.log(`📡 ESP32 data endpoint: POST http://localhost:${PORT}/api/esp32/data`)
})