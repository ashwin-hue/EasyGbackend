import React from "react"
import "./Components.css"

export default function VitalsGraph({ patient }) {
  if (!patient) return null

  // Normal ranges
  const metrics = [
    { 
      label: "Resting BP", 
      value: patient.resting_blood_pressure, 
      unit: "mmHg", 
      min: 90, max: 120, // normal range
      scaleMax: 200     // gauge max
    },
    { 
      label: "Cholesterol", 
      value: patient.serum_cholesterol, 
      unit: "mg/dL", 
      min: 125, max: 200, 
      scaleMax: 400 
    },
    { 
      label: "Max Heart Rate", 
      value: patient.max_heart_rate || patient.thalch || 150, 
      unit: "bpm", 
      min: 100, max: 170, 
      scaleMax: 220 
    }
  ]

  const getStatusColor = (val, min, max) => {
    if (val < min) return "#3b82f6" // low
    if (val > max) return "#ef4444" // high
    return "#10b981" // normal
  }

  return (
    <div className="minimal-panel vitals-panel">
      <div className="m-header">
        <h3>Vitals vs Normal Range</h3>
        <p className="muted">Your measurements compared to healthy baselines</p>
      </div>

      <div className="vitals-charts">
        {metrics.map((m, i) => {
          const pct = Math.min((m.value / m.scaleMax) * 100, 100)
          const normalStart = (m.min / m.scaleMax) * 100
          const normalWidth = ((m.max - m.min) / m.scaleMax) * 100
          const color = getStatusColor(m.value, m.min, m.max)

          return (
            <div key={i} className="vital-row">
              <div className="v-info">
                <strong>{m.label}</strong>
                <span>{m.value} {m.unit}</span>
              </div>
              <div className="v-bar-track">
                {/* Normal range indicator background */}
                <div 
                  className="v-normal-range" 
                  style={{ left: `${normalStart}%`, width: `${normalWidth}%` }}
                />
                {/* Value bar */}
                <div 
                  className="v-bar-fill" 
                  style={{ width: `${pct}%`, backgroundColor: color }}
                />
                <div className="v-marker" style={{ left: `${pct}%`, borderColor: color }}/>
              </div>
            </div>
          )
        })}
      </div>
      
      <div className="v-legend">
        <span className="l-item"><span className="l-box" style={{backgroundColor: "rgba(16, 185, 129, 0.15)", border: "1px dashed #10b981"}}/> Normal Range</span>
        <span className="l-item"><span className="l-dot" style={{backgroundColor: "#ef4444"}}/> Out of Range</span>
        <span className="l-item"><span className="l-dot" style={{backgroundColor: "#10b981"}}/> Good</span>
      </div>
    </div>
  )
}
