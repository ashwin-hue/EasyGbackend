import React, { useState, useEffect } from "react"
import "./Components.css"
import RecommendPanel from "./RecommendPanel.jsx"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000"

export default function ExplainPanel({ patient, prediction }) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!patient || !prediction) return
    
    const fetchExplanation = async () => {
      setLoading(true)
      try {
        const res = await fetch(`${API_BASE_URL}/api/explain`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ patient, probability: prediction.probability })
        })
        if (!res.ok) throw new Error("Explanation failed")
        const json = await res.json()
        setData(json)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchExplanation()
  }, [patient, prediction])

  if (!prediction) return null
  if (loading) return <div className="minimal-panel muted">Loading AI explanation...</div>
  if (error) return <div className="minimal-panel error-note">{error}</div>
  if (!data || !data.explanation) return null

  const exp = data.explanation
  
  const getImpactWord = (val) => {
    const abs = Math.abs(val)
    if (abs >= 20) return "High Impact"
    if (abs >= 10) return "Medium Impact"
    return "Low Impact"
  }

  // ─── Primary Risk Factor ───────────────────────────────────
  const primaryRisk = exp.risk_factors.length > 0 ? exp.risk_factors[0] : null;

  // ─── Use server-provided narrative summary ─────────────────
  const narrativeSummary = exp.summary || "No significant contributing factors were identified.";

  // ─── Chart data (impact is already a percentage from the backend) ──
  const allItems = [...exp.risk_factors, ...exp.protective];

  const chartLabels = allItems.map(item => {
    const pct = item.impact.toFixed(1);
    const sign = Number(pct) >= 0 ? '+' : '';
    return `${sign}${pct}% (${item.label})`;
  });

  const chartDataScores = allItems.map(item => Number(item.impact.toFixed(1)));

  const chartColors = chartDataScores.map(v =>
    v >= 0 ? 'rgba(239, 68, 68, 0.85)' : 'rgba(16, 185, 129, 0.85)'
  );

  const chartData = {
    labels: chartLabels,
    datasets: [{
      label: 'Contribution',
      data: chartDataScores,
      backgroundColor: chartColors,
      borderColor: chartColors.map(c => c.replace('0.85', '1')),
      borderWidth: 1,
      borderRadius: 4,
      borderSkipped: false,
    }]
  };

  const chartOptions = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: { left: 8, right: 16 }
    },
    scales: {
      x: {
        grid: { color: 'rgba(0, 0, 0, 0.06)' },
        ticks: {
          color: '#374151',
          font: { size: 12, weight: '500' },
          callback: (v) => `${v > 0 ? '+' : ''}${v}%`
        },
        title: {
          display: true,
          text: 'Impact on Risk Score (%)',
          color: '#374151',
          font: { size: 12, weight: '600' }
        }
      },
      y: {
        grid: { display: false },
        ticks: {
          color: '#1f2430',
          font: { size: 12, weight: '600' },
          padding: 6,
        }
      }
    },
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: {
          generateLabels: () => [
            {
              text: 'Risk Increasing Factors',
              fillStyle: 'rgba(239, 68, 68, 0.85)',
              strokeStyle: 'rgba(239, 68, 68, 1)',
              lineWidth: 1,
            },
            {
              text: 'Protective Factors',
              fillStyle: 'rgba(16, 185, 129, 0.85)',
              strokeStyle: 'rgba(16, 185, 129, 1)',
              lineWidth: 1,
            }
          ],
          color: '#1f2430',
          font: { size: 12, weight: '500' },
          padding: 16,
          usePointStyle: false,
        }
      },
      tooltip: {
        backgroundColor: 'rgba(31, 36, 48, 0.92)',
        titleFont: { size: 13 },
        bodyFont: { size: 12 },
        padding: 12,
        callbacks: {
          label: (ctx) => ` Impact: ${ctx.raw > 0 ? '+' : ''}${ctx.raw}%`
        }
      }
    }
  };

  // Chart height based on number of items
  const chartHeight = Math.max(220, allItems.length * 38 + 60);

  return (
    <>
    <div className="minimal-panel explain-panel" style={{ padding: '1.5rem' }}>
      
      {/* Primary Risk Factor Highlight */}
      {primaryRisk && (
        <div className="primary-risk-banner">
          <span className="primary-risk-icon">⚠️</span>
          <span className="primary-risk-text">
            Primary Risk Factor: <strong>{primaryRisk.label}</strong>
            <span className="primary-risk-pct">+{primaryRisk.impact.toFixed(1)}%</span>
          </span>
        </div>
      )}

      <div className="m-header" style={{ marginTop: primaryRisk ? '1rem' : 0 }}>
        <h3 style={{ color: '#1f2430' }}>Why this prediction?</h3>
        <p className="muted" style={{ color: '#4b5563', lineHeight: 1.5 }}>{exp.top_sentence}</p>

        {/* Contribution Bar Chart */}
        <div style={{ height: `${chartHeight}px`, marginTop: '1.5rem', marginBottom: '1rem' }}>
          <Bar data={chartData} options={chartOptions} />
        </div>
      </div>
      
      {/* Risk + Protective factors detail */}
      <div className="explain-split">
        <div className="explain-col risk-col">
          <h4 className="col-h"><span className="dot red"></span> Identified Risk Factors</h4>
          <ul className="impact-list">
            {exp.risk_factors.map(r => (
              <li key={r.feature} className="impact-item">
                <span className="impact-mag">{getImpactWord(r.impact)}</span>
                <span className="impact-text" style={{ color: '#1f2430' }}>{r.sentence}</span>
              </li>
            ))}
            {exp.risk_factors.length === 0 && <li className="muted">None found.</li>}
          </ul>
        </div>
        
        <div className="explain-col prot-col">
          <h4 className="col-h"><span className="dot green"></span> Protective Factors</h4>
          <ul className="impact-list">
            {exp.protective.map(p => (
              <li key={p.feature} className="impact-item">
                <span className="impact-mag green">{getImpactWord(p.impact)}</span>
                <span className="impact-text" style={{ color: '#1f2430' }}>{p.sentence}</span>
              </li>
            ))}
            {exp.protective.length === 0 && <li className="muted">None found.</li>}
          </ul>
        </div>
      </div>

      {/* Data-driven narrative summary */}
      <p className="explain-summary" style={{ color: '#374151', fontStyle: 'normal', fontWeight: 500 }}>
        {narrativeSummary}
      </p>
      <p className="explain-summary muted" style={{ marginTop: '0.25rem' }}>{exp.summary}</p>
    </div>

      <RecommendPanel recommendationsData={data.recommendations} />
    </>
  )
}
