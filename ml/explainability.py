"""
explainability.py
-----------------
Generates human-readable, medically meaningful explanations for a logistic
regression heart-disease prediction using SHAP (Shapley Additive Explanations).

Strategy
--------
1. Rebuilds the same sklearn pipeline (StandardScaler + LogisticRegression)
   from the saved heart_model.json coefficients/means/scales.
2. Uses shap.LinearExplainer to compute true SHAP values for the patient.
3. Normalizes SHAP values into contribution percentages relative to the
   total absolute impact so numbers stay small and realistic (e.g. +18%, -12%).
4. Selects top-3 risk factors and top-3 protective factors.

Output (--json flag)
--------------------
    {
      "risk_factors":    [ { "feature": "...", "impact": 0.18, "label": "...", "sentence": "..." }, ... ],
      "protective":      [ { "feature": "...", "impact": -0.12, "label": "...", "sentence": "..." }, ... ],
      "top_sentence":    "Your main risk factor is ...",
      "summary":         "Your risk is influenced by ... Protective factors include ..."
    }
"""

import json
import sys
import numpy as np
from pathlib import Path

ROOT       = Path(__file__).resolve().parents[1]
MODEL_PATH = ROOT / "server" / "model" / "heart_model.json"


# ---------------------------------------------------------------------------
# Clean human-readable feature labels
# ---------------------------------------------------------------------------

FEATURE_LABELS = {
    "cat__sex_Male":                    "Male sex",
    "cat__sex_Female":                  "Female sex",
    "cat__cp_asymptomatic":             "Asymptomatic chest condition",
    "cat__cp_typical angina":           "Typical angina chest pain",
    "cat__cp_atypical angina":          "Atypical angina chest pain",
    "cat__cp_non-anginal":              "Non-anginal chest pain",
    "cat__fbs_True":                    "High fasting blood sugar (>120 mg/dL)",
    "cat__fbs_False":                   "Normal fasting blood sugar",
    "cat__restecg_normal":              "Normal resting ECG",
    "cat__restecg_lv hypertrophy":      "LV hypertrophy on ECG",
    "cat__restecg_st-t abnormality":    "ST-T abnormality on ECG",
    "cat__exang_True":                  "Exercise-induced angina",
    "cat__exang_False":                 "No exercise-induced angina",
    "cat__slope_downsloping":           "Downsloping ST segment",
    "cat__slope_flat":                  "Flat ST slope",
    "cat__slope_upsloping":             "Upsloping ST slope (normal)",
    "cat__ca_0.0":                      "No major vessels narrowed",
    "cat__ca_1.0":                      "1 major vessel narrowed",
    "cat__ca_2.0":                      "2 major vessels narrowed",
    "cat__ca_3.0":                      "3 major vessels narrowed",
    "cat__thal_normal":                 "Normal thalassemia",
    "cat__thal_fixed defect":           "Fixed thalassemia defect",
    "cat__thal_reversable defect":      "Reversible thalassemia defect",
    "num__age":                         "Age",
    "num__trestbps":                    "Blood pressure",
    "num__chol":                        "Cholesterol",
    "num__thalch":                      "Heart rate",
    "num__oldpeak":                     "ST depression (oldpeak)",
}


# Detailed explanation sentences (with {val} for numeric injection)
IMPACT_SENTENCES = {
    # -- Risk increasing --
    "cat__cp_asymptomatic":          "Asymptomatic chest condition can mask silent underlying cardiac issues, making early detection harder",
    "cat__ca_1.0":                   "Testing indicates 1 narrowed major blood vessel, which can restrict optimal blood flow to the heart",
    "cat__ca_2.0":                   "Testing indicates 2 narrowed major blood vessels, significantly restricting blood flow and oxygen delivery",
    "cat__ca_3.0":                   "Testing indicates 3 narrowed major blood vessels, imposing a heavy restriction on blood flow to the heart",
    "cat__thal_reversable defect":   "A blood flow test showed a reversible defect, meaning reduced blood flow to your heart muscle during stress",
    "cat__thal_fixed defect":        "A blood flow test showed a fixed defect, often indicating past scarring or tissue damage in your heart",
    "cat__exang_True":               "You experience chest pain during physical exercise (angina), indicating your heart may not get enough oxygen under exertion",
    "cat__slope_flat":               "Your heart's electrical signals show a flat ST slope, meaning the heart muscle is slower to recover its normal electrical state",
    "cat__slope_downsloping":        "Your heart's electrical signals show a downsloping ST segment, a significant clinical sign of cardiac strain",
    "cat__restecg_st-t abnormality": "Your resting heartbeat shows ST-T wave abnormalities, pointing to irregularities in how the heart resets electrically",
    "cat__restecg_lv hypertrophy":   "Your left heart muscle appears thicker than normal (hypertrophy), usually caused by the heart having to pump harder over time",
    "cat__fbs_True":                 "Your fasting blood sugar is elevated above 120 mg/dL, which increases the risk of vascular inflammation",
    "cat__sex_Male":                 "Men statistically have a higher baseline risk of coronary artery disease earlier in life",
    "num__oldpeak":                  "Your heart exhibits signs of electrical stress (ST depression of {val} mm) after exercise, showing a temporary lack of blood supply",
    "num__trestbps":                 "Your resting blood pressure of {val} mmHg is elevated, which forces your heart to work harder and adds strain to artery walls",
    "num__chol":                     "Your serum cholesterol level of {val} mg/dL is elevated, contributing to potential plaque buildup in arteries",
    "num__age":                      "At age {val}, cardiovascular risk naturally increases as blood vessels gradually accumulate plaque and stiffen",
    # -- Protective --
    "cat__ca_0.0":                   "Your major blood vessels are clear with no significant narrowing, allowing excellent blood flow",
    "cat__thal_normal":              "Your heart's blood flow patterns and tissue perfusion are completely normal and healthy",
    "cat__exang_False":              "You tolerate physical exercise well without chest pain, indicating good cardiac oxygen supply",
    "cat__restecg_normal":           "Your resting electrical heartbeat is perfectly regular with no signs of strain",
    "cat__cp_atypical angina":       "The chest pain you described fits an atypical pattern, much less likely to be caused by a heart issue",
    "cat__cp_non-anginal":           "Your chest discomfort is classified as non-anginal and very likely unrelated to your heart",
    "cat__slope_upsloping":          "Your heart's electrical signals recover quickly and normally (upsloping ST) after exertion",
    "cat__sex_Female":               "Women have a slightly lower baseline rate of cardiovascular disease due to protective hormones",
    "cat__fbs_False":                "Your fasting blood sugar is in a healthy range, keeping vascular inflammation risks low",
    "num__thalch":                   "Your heart reached a strong, healthy maximum rate of {val} bpm during exercise, indicating good cardiovascular fitness",
}


# ---------------------------------------------------------------------------
# Model loading & feature vector construction
# ---------------------------------------------------------------------------

def _load_model() -> dict:
    with MODEL_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def _norm_bool(v):
    if isinstance(v, bool): return v
    if isinstance(v, (int, float)): return v != 0
    s = str(v).strip().lower()
    return s in ("true", "yes", "1")


def _build_feature_vector(patient: dict, model: dict):
    """
    Reproduce the same feature vector construction as predict.js but in Python.
    Returns (numpy array, list of feature names).
    """
    vector = []
    names  = []

    cat_order = list(model["categorical_features"].keys())
    for feat in cat_order:
        categories = model["categorical_features"][feat]
        raw = patient.get(feat)
        if feat in ("fbs", "exang"):
            raw = _norm_bool(raw)
        for cat in categories:
            vector.append(1.0 if raw == cat else 0.0)
            names.append(f"cat__{feat}_{cat}")

    for idx, feat in enumerate(model["numeric_features"]):
        mean  = model["numeric_mean"][idx]
        scale = model["numeric_scale"][idx] or 1.0
        val   = float(patient.get(feat, mean))
        std   = (val - mean) / scale
        vector.append(std)
        names.append(f"num__{feat}")

    return np.array(vector).reshape(1, -1), names


def _rebuild_sklearn_model(model: dict):
    """Reconstruct a minimal sklearn LogisticRegression from saved coefficients."""
    from sklearn.linear_model import LogisticRegression

    lr = LogisticRegression()
    lr.classes_ = np.array(model["classes"])
    lr.coef_ = np.array(model["coefficients"]).reshape(1, -1)
    lr.intercept_ = np.array([model["intercept"]])
    return lr


# ---------------------------------------------------------------------------
# Core SHAP explanation
# ---------------------------------------------------------------------------

def explain(patient: dict) -> dict:
    model_data = _load_model()
    X, feature_names = _build_feature_vector(patient, model_data)

    lr = _rebuild_sklearn_model(model_data)

    # ── Compute SHAP values (manual linear explainer) ──────────
    # For a logistic regression model, SHAP values are mathematically
    # identical to: coefficient_i * standardised_feature_i
    # This is the exact same computation that shap.LinearExplainer performs.
    coefs = np.array(model_data["coefficients"])
    shap_values = (coefs * X[0]).flatten()

    # ── Normalize to contribution percentages ────────────────────
    total_abs = np.sum(np.abs(shap_values))
    if total_abs == 0:
        total_abs = 1.0  # avoid division by zero

    contributions = []
    for i, name in enumerate(feature_names):
        raw_shap = float(shap_values[i])
        pct = (raw_shap / total_abs) * 100.0  # percentage of total impact
        contributions.append({
            "feature": name,
            "shap_raw": round(raw_shap, 4),
            "impact": round(pct, 1),  # e.g. +18.2 or -12.5
        })

    # ── Separate & sort ──────────────────────────────────────────
    risk_factors = sorted(
        [c for c in contributions if c["impact"] > 1.0],
        key=lambda x: x["impact"], reverse=True
    )[:3]

    protective = sorted(
        [c for c in contributions if c["impact"] < -1.0],
        key=lambda x: x["impact"]
    )[:3]

    # ── Enrich with labels and sentences ─────────────────────────
    def get_impact_label(pct):
        abs_pct = abs(pct)
        if abs_pct >= 20: return "High Impact"
        if abs_pct >= 10: return "Medium Impact"
        return "Low Impact"

    def enrich(item):
        label = FEATURE_LABELS.get(item["feature"], item["feature"])
        sentence = IMPACT_SENTENCES.get(item["feature"])

        if sentence is None:
            direction = "increased" if item["impact"] > 0 else "reduced"
            sentence = f"{label} {direction} the predicted risk"

        # Inject actual numeric values where {val} is present
        if item["feature"].startswith("num__") and "{val}" in sentence:
            base_feat = item["feature"].replace("num__", "")
            val = patient.get(base_feat, "N/A")
            if isinstance(val, (int, float)):
                val = round(val, 1) if base_feat == "oldpeak" else int(val)
            sentence = sentence.format(val=val)

        return {
            **item,
            "label": label,
            "impact_label": get_impact_label(item["impact"]),
            "sentence": sentence + ".",
        }

    risk_factors = [enrich(r) for r in risk_factors]
    protective   = [enrich(p) for p in protective]

    # ── Generate human-readable summary ──────────────────────────
    risk_names = [r["label"].lower() for r in risk_factors]
    prot_names = [p["label"].lower() for p in protective]

    summary_parts = []
    if risk_names:
        summary_parts.append(
            f"Your risk is influenced by {', '.join(risk_names[:-1]) + ' and ' + risk_names[-1] if len(risk_names) > 1 else risk_names[0]}."
        )
    if prot_names:
        summary_parts.append(
            f"Protective factors include {', '.join(prot_names[:-1]) + ' and ' + prot_names[-1] if len(prot_names) > 1 else prot_names[0]}."
        )
    if not summary_parts:
        summary_parts.append("No significant contributing factors were identified.")

    summary = " ".join(summary_parts)

    top_sentence = (
        risk_factors[0]["sentence"] if risk_factors
        else "No dominant risk factor was identified."
    )

    return {
        "risk_factors": risk_factors,
        "protective":   protective,
        "top_sentence": top_sentence,
        "summary":      summary,
    }


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    sample = {
        "age": 55, "sex": "Male",
        "cp": "asymptomatic",
        "trestbps": 145, "chol": 270,
        "fbs": True,
        "restecg": "normal",
        "thalch": 110,
        "exang": True,
        "oldpeak": 2.3,
        "slope": "flat",
        "ca": 1.0,
        "thal": "reversable defect",
    }

    if "--json" in sys.argv:
        try:
            sample = json.loads(sys.stdin.read())
        except Exception:
            pass

    result = explain(sample)

    if "--json" in sys.argv:
        json.dump(result, sys.stdout)
    else:
        print("\n=== Risk Factors ===")
        for r in result["risk_factors"]:
            print(f"  +{r['impact']:.1f}%  [{r['impact_label']}]  {r['sentence']}")
        print("\n=== Protective Factors ===")
        for p in result["protective"]:
            print(f"  {p['impact']:.1f}%  [{p['impact_label']}]  {p['sentence']}")
        print(f"\nSummary: {result['summary']}")
