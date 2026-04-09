import React from "react";

export default function Speedometer({ probability }) {
  // probability is from 0.0 to 1.0 (0% to 100%)
  const percentage = Math.max(0, Math.min(100, probability * 100));

  // Determine color matching our getRiskMeta scheme:
  // Low: < 40%, Moderate: 40-65%, High: >= 65%
  let activeColor = "#10b981"; // Low (green)
  if (percentage >= 65) {
    activeColor = "#ef4444"; // High (red)
  } else if (percentage >= 40) {
    activeColor = "#f59e0b"; // Moderate (yellow/orange)
  }

  // SVG dimensions for the half-circle
  const width = 200;
  const height = 110;
  const cx = width / 2;
  const cy = height - 10;
  const radius = 80;
  
  // Calculate the circumference of the half circle
  const circumference = Math.PI * radius;
  
  // Dash offset depends on percentage: 100% means 0 offset (full half circle filled)
  // 0% means offset = circumference
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '1rem' }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Background track */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="rgba(0,0,0,0.06)"
          strokeWidth="16"
          strokeLinecap="round"
        />
        {/* Colorful fill */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke={activeColor}
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: "stroke-dashoffset 1.5s ease-out, stroke 0.5s" }}
        />
        {/* Text percentage */}
        <text
          x={cx}
          y={cy - 10}
          textAnchor="middle"
          fontSize="24"
          fontWeight="bold"
          fill="var(--landing-ink, #1f2430)"
        >
          {percentage.toFixed(0)}%
        </text>
      </svg>
    </div>
  );
}
