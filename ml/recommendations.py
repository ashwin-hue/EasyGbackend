"""
recommendations.py
------------------
Generates medically aligned, patient-specific recommendations based on:
    - Risk level   (low / moderate / high)
    - Patient data (BP, cholesterol, smoking status, diabetes, etc.)

All advice follows general cardiology guidelines (AHA / ESC / WHO).
Nothing in this module constitutes a medical diagnosis.

Output (--json flag)
--------------------
    {
      "risk_level":     "Moderate",
      "risk_color":     "#f59e0b",
      "recommendations": [
        { "icon": "🩺", "category": "Medical", "text": "Schedule a checkup..." },
        ...
      ],
      "disclaimer": "..."
    }
"""

import json
import sys
from typing import Any


# ---------------------------------------------------------------------------
# Recommendation database
# ---------------------------------------------------------------------------

LOW_RISK_RECS = [
    {"icon": "🥗", "category": "Diet",        "text": "Maintain a balanced diet rich in fruits, vegetables, whole grains, and lean protein."},
    {"icon": "🏃", "category": "Exercise",    "text": "Aim for at least 150 minutes of moderate aerobic activity (brisk walking, cycling) per week."},
    {"icon": "😴", "category": "Sleep",       "text": "Prioritise 7–9 hours of quality sleep nightly to support cardiovascular health."},
    {"icon": "🧘", "category": "Stress",      "text": "Practice stress-management techniques such as mindfulness, yoga, or deep-breathing exercises."},
    {"icon": "🩺", "category": "Screening",   "text": "Continue annual checkups to monitor BP, cholesterol, and blood sugar levels."},
    {"icon": "🚭", "category": "Lifestyle",   "text": "Avoid tobacco and limit alcohol intake to recommended levels (≤1 unit/day for women, ≤2 for men)."},
]

MODERATE_RISK_RECS = [
    {"icon": "🩺", "category": "Medical",     "text": "Schedule a clinical follow-up within the next 4–6 weeks to assess cardiovascular risk in detail."},
    {"icon": "📊", "category": "Monitoring",  "text": "Monitor blood pressure and cholesterol levels regularly — at least every 3 months."},
    {"icon": "🥗", "category": "Diet",        "text": "Reduce salt intake to < 2.3 g/day. Cut saturated fats, trans-fats, and added sugars significantly."},
    {"icon": "🏋️", "category": "Exercise",   "text": "Engage in at least 30 minutes of moderate exercise daily. Avoid prolonged sedentary periods."},
    {"icon": "📈", "category": "ECG",         "text": "Obtain a periodic resting ECG every 6–12 months to track any changes in cardiac rhythm or morphology."},
    {"icon": "💊", "category": "Medication",  "text": "If prescribed cholesterol or BP medication, maintain strict adherence and do not self-discontinue."},
    {"icon": "🚭", "category": "Lifestyle",   "text": "Quit smoking immediately. Even passive exposure to smoke significantly elevates cardiac risk."},
    {"icon": "⚖️", "category": "Weight",      "text": "Achieve or maintain a healthy BMI (18.5–24.9). Even 5–10% weight loss improves cardiac outcomes."},
]

HIGH_RISK_RECS = [
    {"icon": "🚨", "category": "Urgent",      "text": "Consult a cardiologist as soon as possible — ideally within the next 1–2 weeks — for a comprehensive evaluation."},
    {"icon": "🏥", "category": "Medical",     "text": "Request a full cardiac workup: stress test, echocardiogram, and lipid profile if not recently done."},
    {"icon": "📋", "category": "Symptoms",    "text": "If you experience chest pain, shortness of breath, palpitations, or dizziness, seek emergency care immediately."},
    {"icon": "💊", "category": "Medication",  "text": "Strictly follow any prescribed medications (statins, antihypertensives, aspirin). Never skip doses."},
    {"icon": "🚭", "category": "Smoking",     "text": "Stop smoking immediately. This is the single most impactful lifestyle change for high-risk patients."},
    {"icon": "🍷", "category": "Alcohol",     "text": "Eliminate or drastically reduce alcohol consumption. Alcohol stresses the heart and raises BP."},
    {"icon": "🥗", "category": "Diet",        "text": "Follow a heart-healthy diet (Mediterranean or DASH pattern). Avoid processed, fried, and high-sodium foods."},
    {"icon": "🩺", "category": "Monitoring",  "text": "Monitor blood pressure at home daily. Keep a log to share with your physician at each visit."},
    {"icon": "🏃", "category": "Exercise",    "text": "Exercise only as recommended by your cardiologist — unsupervised strenuous activity can be dangerous at high risk."},
    {"icon": "🧘", "category": "Stress",      "text": "Minimise emotional stress. Consider speaking to a counsellor; chronic stress directly harms cardiac function."},
]

# Condition-specific add-ons
DIABETES_ADD = {
    "icon": "🩸", "category": "Diabetes",
    "text": "As a diabetic patient, keep HbA1c < 7% and fasting glucose < 100 mg/dL to protect cardiac vessels."
}
SMOKING_ADD = {
    "icon": "🚭", "category": "Smoking Alert",
    "text": "Your smoking history is a major modifiable risk factor — cessation programs and nicotine replacement therapy are highly effective."
}
HIGH_CHOL_ADD = {
    "icon": "🍎", "category": "Cholesterol",
    "text": f"Your cholesterol level is elevated. Increase fibre intake (oats, legumes, flaxseed) and reduce red meat consumption."
}
HIGH_BP_ADD = {
    "icon": "💨", "category": "Blood Pressure",
    "text": "Elevated resting blood pressure detected. Reduce sodium, increase potassium intake (bananas, leafy greens), and avoid caffeine."
}

DISCLAIMER = (
    "These recommendations are general health guidance and do not constitute "
    "medical advice. Always consult a qualified healthcare professional before "
    "making changes to medications, diet, or exercise routines."
)

RISK_META = {
    "low":      {"label": "Low",      "color": "#10b981", "emoji": "✅"},
    "moderate": {"label": "Moderate", "color": "#f59e0b", "emoji": "⚠️"},
    "high":     {"label": "High",     "color": "#ef4444", "emoji": "🔴"},
}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_risk_level(probability: float) -> str:
    """Map a 0–1 probability to low / moderate / high."""
    if probability < 0.40:
        return "low"
    if probability < 0.65:
        return "moderate"
    return "high"


def get_recommendations(
    probability: float,
    patient: dict[str, Any] | None = None,
) -> dict:
    """
    Generate personalised recommendations for a patient.

    Parameters
    ----------
    probability : float — prediction probability (0–1) from the model
    patient     : dict  — optional raw patient fields for personalisation:
                          diabetes, smoking_status, serum_cholesterol,
                          resting_blood_pressure

    Returns
    -------
    dict:
        risk_level        : "Low" / "Moderate" / "High"
        risk_color        : hex colour
        risk_emoji        : emoji
        probability_pct   : int (0-100)
        recommendations   : list of { icon, category, text }
        disclaimer        : str
    """
    patient = patient or {}
    level = get_risk_level(probability)
    meta  = RISK_META[level]

    base = {
        "low":      LOW_RISK_RECS,
        "moderate": MODERATE_RISK_RECS,
        "high":     HIGH_RISK_RECS,
    }[level]

    recs = list(base)  # copy so we don't mutate the global list

    # ── Personalised add-ons ────────────────────────────────────────────
    diabetes = str(patient.get("diabetes", "0"))
    smoking  = str(patient.get("smoking_status", "0"))
    chol     = float(patient.get("serum_cholesterol", 0) or 0)
    bp       = float(patient.get("resting_blood_pressure", 0) or 0)

    if diabetes in ("1", "yes", "true") and level != "low":
        recs.append(DIABETES_ADD)

    if smoking in ("1", "yes", "true"):
        # Only add if not already in the base list
        if not any(r["category"] == "Smoking Alert" for r in recs):
            recs.append(SMOKING_ADD)

    if chol > 240 and level != "high":   # high risk already covers diet
        recs.append(HIGH_CHOL_ADD)

    if bp > 140 and level != "high":
        recs.append(HIGH_BP_ADD)

    return {
        "risk_level":       meta["label"],
        "risk_color":       meta["color"],
        "risk_emoji":       meta["emoji"],
        "probability_pct":  round(probability * 100),
        "recommendations":  recs,
        "disclaimer":       DISCLAIMER,
    }


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    
    if "--json" in sys.argv:
        data = json.loads(sys.stdin.read())
        prob    = float(data.get("probability", 0.5))
        patient = data.get("patient", {})
        result  = get_recommendations(prob, patient)
        json.dump(result, sys.stdout, ensure_ascii=False)
    else:
        # Quick demo
        for prob in [0.2, 0.52, 0.78]:
            r = get_recommendations(prob, {"diabetes": "1", "smoking_status": "1", "serum_cholesterol": 260})
            print(f"\n--- {r['risk_level']} Risk ({r['probability_pct']}%) ---")
            for rec in r["recommendations"][:3]:
                print(f"  [{rec['category']}] {rec['text']}")

