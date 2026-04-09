"""
ecg_classifier.py
-----------------
Classifies an ECG waveform into one of four clinical categories using
rule-based signal analysis.  No ML training required — the rules are derived
from established ECG interpretation guidelines used in the UCI dataset and
AD8232 application notes.

Categories
----------
    0  Normal
    1  ST-T abnormality
    2  Left Ventricular Hypertrophy (LV Hypertrophy)
    3  Arrhythmia / Abnormal

The decision process:
    1. Extract key morphological features (R amplitude, HR, ST level, RR jitter)
    2. Apply threshold rules in priority order
    3. Return label + numeric code + confidence + human-readable rationale
"""

import json
import math
import sys
from typing import NamedTuple


# ---------------------------------------------------------------------------
# Feature extraction
# ---------------------------------------------------------------------------

class EcgFeatures(NamedTuple):
    heart_rate:  float   # BPM derived from R-peak spacing
    r_amplitude: float   # mean R-peak height (relative units)
    st_level:    float   # mean ST segment level (should be ~0)
    rr_jitter:   float   # coefficient of variation of R-R intervals (0–1)
    p_present:   bool    # whether a clear P wave precedes each QRS


def _find_r_peaks(waveform: list[float], fs: int = 360, threshold_frac: float = 0.6) -> list[int]:
    """
    Simple threshold-based R-peak detector.

    Returns list of sample indices where an R peak was found.
    """
    if not waveform:
        return []

    peak_val = max(waveform)
    threshold = peak_val * threshold_frac

    peaks = []
    in_peak = False
    local_max_idx = 0
    local_max_val = -float("inf")

    for i, v in enumerate(waveform):
        if v >= threshold:
            in_peak = True
            if v > local_max_val:
                local_max_val = v
                local_max_idx = i
        else:
            if in_peak:
                # Enforce minimum refractory period (~150 ms at 360 Hz = 54 samples)
                if not peaks or (local_max_idx - peaks[-1]) > int(0.15 * fs):
                    peaks.append(local_max_idx)
                in_peak = False
                local_max_val = -float("inf")

    return peaks


def extract_features(waveform: list[float], fs: int = 360, hr_bpm: float | None = None) -> EcgFeatures:
    """
    Extract clinical morphological features from a raw waveform.

    Parameters
    ----------
    waveform : raw ECG sample list (any amplitude scale)
    fs       : sampling frequency (Hz)
    hr_bpm   : if already known (from simulator metadata), use it directly

    Returns
    -------
    EcgFeatures namedtuple
    """
    if not waveform:
        return EcgFeatures(heart_rate=0, r_amplitude=0, st_level=0, rr_jitter=1, p_present=False)

    peaks = _find_r_peaks(waveform, fs)

    # Heart rate from R-R intervals
    if hr_bpm is not None:
        heart_rate = hr_bpm
    elif len(peaks) >= 2:
        rr_samples = [peaks[i + 1] - peaks[i] for i in range(len(peaks) - 1)]
        rr_mean_s = (sum(rr_samples) / len(rr_samples)) / fs
        heart_rate = 60.0 / rr_mean_s
    else:
        heart_rate = 75.0   # fall back to normal

    # R amplitude (mean of detected peak values)
    r_amplitude = (
        sum(waveform[i] for i in peaks) / len(peaks) if peaks else max(waveform)
    )

    # ST level: sample 80 ms after each R peak (J+80 ms)
    st_offset = int(0.08 * fs)
    st_vals = []
    for pk in peaks:
        idx = pk + st_offset
        if idx < len(waveform):
            st_vals.append(waveform[idx])
    st_level = sum(st_vals) / len(st_vals) if st_vals else 0.0

    # RR jitter (coefficient of variation)
    if len(peaks) >= 3:
        rr_samples = [peaks[i + 1] - peaks[i] for i in range(len(peaks) - 1)]
        mean_rr = sum(rr_samples) / len(rr_samples)
        std_rr = math.sqrt(sum((x - mean_rr) ** 2 for x in rr_samples) / len(rr_samples))
        rr_jitter = std_rr / mean_rr if mean_rr else 0
    else:
        rr_jitter = 0.0

    # P wave: look for a small positive bump ~160 ms before each R peak
    p_offset = int(0.16 * fs)
    p_width  = int(0.04 * fs)
    p_found_count = 0
    for pk in peaks:
        start = pk - p_offset - p_width
        end   = pk - p_offset + p_width
        if 0 <= start and end < len(waveform):
            segment = waveform[start:end]
            if segment and max(segment) > 0.05:   # P wave threshold (relative)
                p_found_count += 1

    p_present = (p_found_count / len(peaks) > 0.5) if peaks else False

    return EcgFeatures(
        heart_rate  = round(heart_rate, 1),
        r_amplitude = round(r_amplitude, 4),
        st_level    = round(st_level, 4),
        rr_jitter   = round(rr_jitter, 4),
        p_present   = p_present,
    )


# ---------------------------------------------------------------------------
# Classification rules
# ---------------------------------------------------------------------------

LABELS = {
    0: "Normal",
    1: "ST-T abnormality",
    2: "LV Hypertrophy",
    3: "Arrhythmia",
}

# Restecg mapping to match UCI dataset / model_params.json
RESTECG_MAP = {
    0: "normal",
    1: "st-t abnormality",
    2: "lv hypertrophy",
    3: "st-t abnormality",    # arrhythmia → closest UCI class
}


def classify_ecg(
    waveform: list[float],
    fs: int = 360,
    hr_bpm: float | None = None,
) -> dict:
    """
    Classify an ECG waveform into one of four categories.

    Parameters
    ----------
    waveform : raw ECG sample list
    fs       : sampling frequency
    hr_bpm   : optional known heart rate

    Returns
    -------
    dict with keys:
        "label"      : str  — human-readable class name
        "code"       : int  — 0..3
        "restecg"    : str  — UCI restecg string for model input
        "confidence" : str  — "High" / "Moderate" / "Low"
        "rationale"  : str  — one-sentence clinical rationale
        "features"   : dict — extracted features used for classification
    """
    feat = extract_features(waveform, fs, hr_bpm)

    # ---- Rule priority: arrhythmia > LVH > ST abnormality > normal ----

    code = 0
    rationale = "Rhythm is regular with normal P-QRS-T morphology and rate."
    confidence = "High"

    # Rule 1 — Arrhythmia: high RR jitter OR extreme HR OR no P waves
    if feat.rr_jitter > 0.15 or feat.heart_rate > 100 or feat.heart_rate < 50:
        code = 3
        if feat.heart_rate > 100:
            rationale = f"Tachycardia detected (HR {feat.heart_rate:.0f} BPM) with irregular rhythm."
        elif feat.heart_rate < 50:
            rationale = f"Bradycardia detected (HR {feat.heart_rate:.0f} BPM) with irregular rhythm."
        else:
            rationale = f"Irregular RR intervals (jitter {feat.rr_jitter:.2f}) suggest arrhythmia."
        confidence = "High" if feat.rr_jitter > 0.20 else "Moderate"

    # Rule 2 — LV Hypertrophy: high R amplitude
    elif feat.r_amplitude > 1.4:
        code = 2
        rationale = (
            f"Elevated R-wave amplitude ({feat.r_amplitude:.2f} mV) consistent with "
            "left ventricular hypertrophy pattern."
        )
        confidence = "High" if feat.r_amplitude > 1.7 else "Moderate"

    # Rule 3 — ST-T abnormality: ST elevation or depression
    elif abs(feat.st_level) > 0.10:
        code = 1
        direction = "elevation" if feat.st_level > 0 else "depression"
        rationale = (
            f"ST-segment {direction} ({feat.st_level:+.3f} mV) detected, "
            "indicating possible ischaemia or repolarisation abnormality."
        )
        confidence = "High" if abs(feat.st_level) > 0.20 else "Moderate"

    # Rule 4 — Borderline normal: absent P waves (but HR in range)
    elif not feat.p_present:
        code = 1
        rationale = "P waves are absent or indistinct — possible junctional rhythm."
        confidence = "Low"

    return {
        "label":      LABELS[code],
        "code":       code,
        "restecg":    RESTECG_MAP[code],
        "confidence": confidence,
        "rationale":  rationale,
        "features": {
            "heart_rate":  feat.heart_rate,
            "r_amplitude": feat.r_amplitude,
            "st_level":    feat.st_level,
            "rr_jitter":   feat.rr_jitter,
            "p_present":   feat.p_present,
        },
    }


# ---------------------------------------------------------------------------
# CLI quick-test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    # Import simulator inline for standalone test
    import importlib, pathlib, sys
    sys.path.insert(0, str(pathlib.Path(__file__).parent))
    sim = importlib.import_module("ecg_simulator")

    ecg_data = sim.simulate_ecg(fs=360, duration=5.0)
    result = classify_ecg(ecg_data["waveform"], fs=360, hr_bpm=ecg_data["heart_rate"])

    print(f"Classification : {result['label']}  (code={result['code']})")
    print(f"Confidence     : {result['confidence']}")
    print(f"Rationale      : {result['rationale']}")
    print(f"Features       : {result['features']}")

    if "--json" in sys.argv:
        json.dump(result, sys.stdout)
