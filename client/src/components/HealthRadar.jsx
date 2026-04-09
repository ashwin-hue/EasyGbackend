import React from 'react';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
} from 'chart.js';
import { Radar } from 'react-chartjs-2';
import './Components.css';

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

// Min-max normalization helper: (value - min) / (max - min) → [0, 1]
function normalize(value, min, max) {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

export default function HealthRadar({ patient }) {
  if (!patient) return null;

  // ──── Raw values ────────────────────────────────────────────
  const bpRaw    = Number(patient.resting_blood_pressure || 120);
  const cholRaw  = Number(patient.serum_cholesterol || 200);
  const hrRaw    = Number(patient.max_heart_rate || 150);
  const ecgRaw   = (patient.rest_ecg && patient.rest_ecg.toLowerCase() !== 'normal') ? 1 : 0;
  const sugarRaw = (patient.fasting_blood_sugar === '1' || patient.fasting_blood_sugar === true) ? 180 : 90;

  // ──── Ideal baseline values ─────────────────────────────────
  const bpIdealRaw    = 120;
  const cholIdealRaw  = 200;
  const hrIdealRaw    = 150;
  const ecgIdealRaw   = 0;
  const sugarIdealRaw = 90;

  // ──── Physiological min/max ranges for normalization ────────
  const ranges = {
    bp:    { min: 80,  max: 200 },
    chol:  { min: 100, max: 400 },
    hr:    { min: 60,  max: 210 },
    ecg:   { min: 0,   max: 1   },
    sugar: { min: 60,  max: 300 },
  };

  // Normalize user values
  const bpUser    = normalize(bpRaw,    ranges.bp.min,    ranges.bp.max);
  const cholUser  = normalize(cholRaw,  ranges.chol.min,  ranges.chol.max);
  const hrUser    = normalize(hrRaw,    ranges.hr.min,    ranges.hr.max);
  const ecgUser   = normalize(ecgRaw,   ranges.ecg.min,   ranges.ecg.max);
  const sugarUser = normalize(sugarRaw, ranges.sugar.min, ranges.sugar.max);

  // Normalize ideal values
  const bpIdeal    = normalize(bpIdealRaw,    ranges.bp.min,    ranges.bp.max);
  const cholIdeal  = normalize(cholIdealRaw,  ranges.chol.min,  ranges.chol.max);
  const hrIdeal    = normalize(hrIdealRaw,    ranges.hr.min,    ranges.hr.max);
  const ecgIdeal   = normalize(ecgIdealRaw,   ranges.ecg.min,   ranges.ecg.max);
  const sugarIdeal = normalize(sugarIdealRaw, ranges.sugar.min, ranges.sugar.max);

  // Raw values for tooltips
  const userRawVals  = [bpRaw, cholRaw, hrRaw, ecgRaw === 0 ? 'Normal' : 'Abnormal', sugarRaw];
  const idealRawVals = [bpIdealRaw, cholIdealRaw, hrIdealRaw, 'Normal', sugarIdealRaw];
  const units        = ['mmHg', 'mg/dL', 'bpm', '', 'mg/dL'];

  const data = {
    labels: [
      'Blood Pressure (mmHg)',
      'Cholesterol (mg/dL)',
      'Heart Rate (bpm)',
      'ECG Status',
      'Blood Sugar (mg/dL)'
    ],
    datasets: [
      {
        label: 'Your Health',
        data: [bpUser, cholUser, hrUser, ecgUser, sugarUser],
        backgroundColor: 'rgba(239, 68, 68, 0.25)',
        borderColor: 'rgba(239, 68, 68, 1)',
        borderWidth: 2.5,
        pointBackgroundColor: 'rgba(239, 68, 68, 1)',
        pointBorderColor: '#fff',
        pointBorderWidth: 1,
        pointRadius: 5,
        pointHoverRadius: 7,
      },
      {
        label: 'Ideal Reference',
        data: [bpIdeal, cholIdeal, hrIdeal, ecgIdeal, sugarIdeal],
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        borderColor: 'rgba(16, 185, 129, 1)',
        borderWidth: 2.5,
        borderDash: [6, 4],
        pointBackgroundColor: 'rgba(16, 185, 129, 1)',
        pointBorderColor: '#fff',
        pointBorderWidth: 1,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        beginAtZero: true,
        min: 0,
        max: 1,
        angleLines: {
          color: 'rgba(0, 0, 0, 0.15)',
          lineWidth: 1,
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
          lineWidth: 1,
          circular: false,
        },
        pointLabels: {
          color: '#1f2430',
          font: { size: 13, weight: '600' },
          padding: 18,
        },
        ticks: {
          display: true,
          stepSize: 0.25,
          color: '#6b7280',
          backdropColor: 'transparent',
          font: { size: 10 },
          callback: function(value) {
            return (value * 100).toFixed(0) + '%';
          }
        }
      }
    },
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#1f2430',
          font: { size: 13, weight: '500' },
          padding: 20,
          usePointStyle: true,
          pointStyleWidth: 12,
        }
      },
      tooltip: {
        backgroundColor: 'rgba(31, 36, 48, 0.92)',
        titleFont: { size: 13 },
        bodyFont: { size: 12 },
        padding: 12,
        callbacks: {
          label: function(context) {
            const dsIdx  = context.datasetIndex;
            const ptIdx  = context.dataIndex;
            const rawVal = dsIdx === 0 ? userRawVals[ptIdx] : idealRawVals[ptIdx];
            const unit   = units[ptIdx];
            const label  = context.dataset.label;
            return `${label}: ${rawVal} ${unit}`;
          }
        }
      }
    }
  };

  return (
    <div className="minimal-panel radar-panel" style={{ marginTop: '1.5rem' }}>
      <div className="m-header" style={{ marginBottom: '0.75rem' }}>
        <h3 style={{ color: '#1f2430' }}>Health Radar Comparison</h3>
        <p className="muted">Your normalized vitals mapped against ideal clinical baselines. Hover for actual values.</p>
      </div>
      <div style={{ height: '420px', position: 'relative' }}>
        <Radar data={data} options={options} />
      </div>
    </div>
  );
}
