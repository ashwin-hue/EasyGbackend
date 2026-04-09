const fs = require("fs")
const path = require("path")

const MODEL_PATH = path.join(__dirname, "heart_model.json")
const model = JSON.parse(fs.readFileSync(MODEL_PATH, "utf-8"))

const catOrder = Object.keys(model.categorical_features)

function normalizeBoolean(value) {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value !== 0
  if (typeof value === "string") {
    const lowered = value.toLowerCase()
    if (["true", "yes", "1"].includes(lowered)) return true
    if (["false", "no", "0"].includes(lowered)) return false
  }
  return value
}

function buildFeatureVector(input) {
  const vector = []

  // Categorical (one-hot)
  catOrder.forEach(feature => {
    const categories = model.categorical_features[feature]
    const raw = normalizeBoolean(input[feature])
    categories.forEach(cat => {
      vector.push(raw === cat ? 1 : 0)
    })
  })

  // Numeric (standardized with training stats)
  model.numeric_features.forEach((feature, idx) => {
    const mean = model.numeric_mean[idx]
    const scale = model.numeric_scale[idx] || 1
    const value = Number(input[feature])
    const standardized = scale ? (value - mean) / scale : value - mean
    vector.push(standardized)
  })

  return vector
}

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x))
}

function predictProbability(input) {
  const vector = buildFeatureVector(input)
  const logit =
    model.intercept + vector.reduce((sum, v, i) => sum + v * model.coefficients[i], 0)
  const prob = sigmoid(logit)
  return {
    probability: prob,
    riskLabel: prob >= 0.5 ? 1 : 0,
    logit,
    features: vector.length,
  }
}

module.exports = {
  predictProbability,
  model,
}
