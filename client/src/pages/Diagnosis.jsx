import { useEffect, useMemo, useRef, useState } from "react"
import "./Diagnosis.css"
import ExplainPanel from "../components/ExplainPanel.jsx"
import VitalsGraph from "../components/VitalsGraph.jsx"
import Speedometer from "../components/Speedometer.jsx"
import HealthRadar from "../components/HealthRadar.jsx"

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000"
const CAPTURE_SECONDS = 15 // duration for ECG capture
const DEVICE_NAME = "EASYG-001"

function prettyPercent(prob) {
  return `${Math.round(prob * 100)}%`
}

function getRiskMeta(prob) {
  if (prob >= 0.65) return { level: "High", color: "#ef4444", emoji: "🔴" }
  if (prob >= 0.40) return { level: "Moderate", color: "#f59e0b", emoji: "⚠️" }
  return { level: "Low", color: "#10b981", emoji: "✅" }
}

function Diagnosis({ user }) {
  const [ecg, setEcg] = useState(() => Array.from({ length: 600 }, () => null))
  const [isCapturing, setIsCapturing] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(CAPTURE_SECONDS)
  const [heartRate, setHeartRate] = useState(null)
  const [status, setStatus] = useState("Idle — press Analyse to stream ECG data.")
  const [prediction, setPrediction] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const pollRef = useRef(null)
  const timerRef = useRef(null)
  const [deviceReady, setDeviceReady] = useState(false)

  // State for new features
  const [modelInput, setModelInput] = useState(null)

  // We'll store pre-fetched ECG points here, and stream them slowly
  const [ecgFeed, setEcgFeed] = useState([])
  const feedIndexRef = useRef(0)
  const drawCursorRef = useRef(0)

  // ECG streaming
  useEffect(() => {
    if (!isCapturing || ecgFeed.length === 0) return

    const streamInterval = setInterval(() => {
      // pop next batch of 10 points
      const nextBatch = ecgFeed.slice(feedIndexRef.current, feedIndexRef.current + 10)
      if (nextBatch.length === 0) return

      setEcg(prev => {
        const newArr = [...prev]
        for (let i = 0; i < nextBatch.length; i++) {
          newArr[drawCursorRef.current] = nextBatch[i]
          
          // erase a small gap ahead of the cursor
          for(let gap = 1; gap <= 15; gap++) {
             newArr[(drawCursorRef.current + gap) % 600] = null;
          }

          drawCursorRef.current = (drawCursorRef.current + 1) % 600
        }
        return newArr
      })
      feedIndexRef.current += 10
    }, 100) // update every 100ms

    return () => clearInterval(streamInterval)
  }, [isCapturing, ecgFeed])

  // Countdown timer
  useEffect(() => {
    if (!isCapturing) return
    timerRef.current = setInterval(() => {
      setSecondsLeft(current => {
        if (current <= 1) {
          clearInterval(timerRef.current)
          finishCapture()
          return 0
        }
        return current - 1
      })
    }, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isCapturing])

  const finishCapture = () => {
    setIsCapturing(false)
    if (timerRef.current) clearInterval(timerRef.current)
    submitPrediction()
  }

  const submitPrediction = async () => {
    setLoading(true)
    setError(null)
    setStatus("Sending ECG to server...")
    try {
      const patientPayload = {
        ...user,
        max_heart_rate: heartRate || 120,
        rest_ecg: "normal",
        st_depression: 0,
        slope: "flat",
      }
      const payload = {
        patient: patientPayload,
        waveform: ecg,
        heartRate: heartRate || 0,
      }
      const response = await fetch(`${API_BASE_URL}/api/diagnosis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const message = await response.json()
        throw new Error(message.error || message.message || "Unable to score")
      }
      const data = await response.json()
      setPrediction(data.diagnosis)
      setModelInput(patientPayload)
      setStatus("Prediction ready.")
    } catch (err) {
      setError(err.message)
      setStatus("Could not get a prediction.")
    } finally {
      setLoading(false)
      setSecondsLeft(CAPTURE_SECONDS)
    }
  }

  const startCapture = async () => {
    setPrediction(null)
    setModelInput(null)
    setError(null)
    setEcg(Array.from({ length: 600 }, () => null))
    setHeartRate(null)
    setEcgFeed([])
    feedIndexRef.current = 0
    drawCursorRef.current = 0
    setStatus("Analysing — streaming ECG data...")
    setIsCapturing(true)
    setSecondsLeft(CAPTURE_SECONDS)

    try {
      // pre-fetch ECG data
      const res = await fetch(`${API_BASE_URL}/api/ecg/stream`)
      if (!res.ok) throw new Error("ECG stream failed")
      const data = await res.json()
      setEcgFeed(data.ecg_data.waveform)
      setHeartRate(data.ecg_data.heart_rate)
    } catch (err) {
      setError(err.message)
      setIsCapturing(false)
    }
  }

  const ecgPolylines = useMemo(() => {
    const width = 800
    const height = 240
    const step = width / Math.max(ecg.length - 1, 1)
    const mid = height / 2

    const lines = []
    let currentLine = []

    ecg.forEach((v, i) => {
      if (v === null) {
        if (currentLine.length > 0) {
          lines.push(currentLine.join(" "))
          currentLine = []
        }
      } else {
        const x = (i * step).toFixed(1)
        const y = (mid - v * 80).toFixed(1)
        currentLine.push(`${x},${y}`)
      }
    })
    
    if (currentLine.length > 0) {
      lines.push(currentLine.join(" "))
    }
    
    return lines
  }, [ecg])

  const riskMeta = prediction ? getRiskMeta(prediction.probability) : null

  // Simulated device connect indicator (5s delay)
  useEffect(() => {
    const t = setTimeout(() => setDeviceReady(true), 5000)
    return () => clearTimeout(t)
  }, [])

  return (
    <section className="diag-shell">
      <div className="diag-grid">
        {/* ── EXISTING PANEL (UNCHANGED LOGIC) ────────────────────── */}
        <div className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Patient Clinical Profile</p>
              <h2>{user.username || "Member"}</h2>
              <p className="muted">
                Age {user.age}, {user.sex} • Vitals & History Loaded
              </p>
              <p className="muted" style={{ marginTop: '0.5rem' }}>
                Tap Analyse to start an ECG streaming session. The final risk score synthesizes all 13 of your clinical metrics.
              </p>
            </div>
            <div className="badge">{isCapturing ? "Recording" : "Idle"}</div>
          </div>

          <div className="device-banner" role="status" aria-live="polite">
            {deviceReady ? (
              <>
                <div className="tick-icon" aria-hidden="true">✔</div>
                <div>
                  <p className="label">Device</p>
                  <p className="value">EASYG connected · {DEVICE_NAME}</p>
                </div>
                <div className="ghost-chip success">Live</div>
              </>
            ) : (
              <>
                <div className="dot-pulse" aria-hidden="true" />
                <div>
                  <p className="label">Device</p>
                  <p className="value">Connecting to EASYG · {DEVICE_NAME}</p>
                </div>
                <div className="ghost-chip">Establishing link…</div>
              </>
            )}
          </div>

          <div className="panel-header" style={{ paddingTop: 0 }}>
            <div>
              <p className="label">Status</p>
              <p className="value">{status}</p>
            </div>
            <div className="timer">
              <span>{Math.floor(secondsLeft / 60)}:</span>
              <span>{String(secondsLeft % 60).padStart(2, "0")}</span>
            </div>
          </div>

          <div className="ecg-card">
            <div style={{ position: 'absolute', top: '12px', left: '16px', zIndex: 2, color: '#00BFFF', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
              ● Live ECG Signal
            </div>
            <svg viewBox="0 0 800 240" role="img" aria-label="ECG waveform">
              {/* Subtle grid lines */}
              {[0, 48, 96, 144, 192, 240].map(y => (
                <line key={`h-${y}`} x1="0" y1={y} x2="800" y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
              ))}
              {[0, 100, 200, 300, 400, 500, 600, 700, 800].map(x => (
                <line key={`v-${x}`} x1={x} y1="0" x2={x} y2="240" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
              ))}

              {/* Smooth continuous waveform */}
              {ecgPolylines.map((pts, idx) => (
                <polyline
                  key={idx}
                  points={pts}
                  fill="none"
                  stroke="#00BFFF"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ))}
            </svg>
            <div className="ecg-meta">
              <div>
                <p className="label">ECG Type</p>
                <p className="value">Lead II</p>
              </div>
              <div>
                <p className="label">Heart rate</p>
                <p className="value">{heartRate ? `${Math.round(heartRate)} bpm` : "—"}</p>
              </div>
              <div>
                <p className="label">Samples</p>
                <p className="value">{ecg.length}</p>
              </div>
              <div>
                <p className="label">Mode</p>
                <p className="value">{isCapturing ? "Recording" : "Standby"}</p>
              </div>
            </div>
          </div>

          <div className="action-row">
            <button className="primary" onClick={startCapture} disabled={isCapturing || loading}>
              {isCapturing ? "Analysing..." : "Analyse"}
            </button>
          </div>

          {/* ── ENHANCED RISK SCORE PANEL ─────────────────────────── */}
          {prediction ? (
            <div className="result" style={{ borderLeft: `4px solid ${riskMeta.color}`, display: 'flex', flexWrap: 'wrap', gap: '2rem' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <p className="label">Risk Level</p>
                <p className="value" style={{ color: riskMeta.color, fontSize: '1.5rem', marginBottom: '1rem' }}>
                  {riskMeta.emoji} {riskMeta.level}
                </p>
                
                <p className="label">Assessment</p>
                <p className="value">
                  {prediction.riskLabel === 1 ? "At risk" : "Low risk"}
                </p>
                <p className="muted" style={{ marginTop: '0.5rem' }}>{prediction.interpretation}</p>
              </div>
              <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <p className="label" style={{ alignSelf: 'flex-start' }}>Risk Probability Meter</p>
                <Speedometer probability={prediction.probability} />
              </div>
            </div>
          ) : null}
          {error ? <p className="error-note">{error}</p> : null}
        </div>
      </div>

      {/* ── NEW EXTENSION PANELS (below existing grid) ──────────── */}
      <div className="extension-panels">

        {/* 2. Vitals vs Normal Range Graphs */}
        <VitalsGraph patient={user} />
        
        {/* Radar Chart */}
        <HealthRadar patient={user} />

        {/* 3. Explainability + Recommendations (auto-loads after prediction) */}
        <ExplainPanel patient={modelInput} prediction={prediction} />
      </div>
    </section>
  )
}

export default Diagnosis
