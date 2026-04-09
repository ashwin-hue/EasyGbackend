import React from "react"
import "./Components.css"

export default function RecommendPanel({ recommendationsData }) {
  if (!recommendationsData) return null
  
  const { risk_level, risk_color, risk_emoji, recommendations, disclaimer } = recommendationsData

  return (
    <div className="minimal-panel rec-panel" style={{ '--risk-color': risk_color }}>
      <div className="m-header">
        <h3><span style={{ color: risk_color }}>{risk_emoji} {risk_level} Risk</span> Action Plan</h3>
        <p className="muted">Personalised medical guidelines based on AHA/ESC standards</p>
      </div>

      <div className="rec-grid">
        {recommendations.map((rec, i) => (
          <div key={i} className="rec-card">
            <div className="rec-icon">{rec.icon}</div>
            <div className="rec-content">
              <strong>{rec.category}</strong>
              <p>{rec.text}</p>
            </div>
          </div>
        ))}
      </div>
      
      <p className="disclaimer">{disclaimer}</p>
    </div>
  )
}
