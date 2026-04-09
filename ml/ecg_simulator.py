"""
ecg_simulator.py
----------------
Simulates a realistic AD8232-style ECG waveform consisting of P wave, QRS
complex, and T wave with configurable sampling rate and duration.

Each call to simulate_ecg() introduces small random variations in amplitude
and timing so the graph looks different on every execution, while staying
within a clinically normal ECG range.

IoT-ready wrapper
-----------------
get_ecg(use_simulation=True)
    If use_simulation is True  → return simulate_ecg()
    If use_simulation is False → replace body with garment / BLE read
"""

import json
import math
import random
import sys


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _gaussian(x: float, center: float, width: float) -> float:
    """Gaussian bell curve used to model individual ECG waves."""
    return math.exp(-((x - center) ** 2) / (2 * width ** 2))


def _ecg_beat(t: float, hr_bpm: float, noise_amp: float = 0.01) -> float:
    """
    Compute the ECG voltage at time t (seconds) for one periodic beat.

    Wave anatomy (all times relative to the beat start, normalised to 0–1
    within one R-R interval):

        P  wave  : ~0.12 s wide, peaks at ~0.10 s
        QRS      : narrow (~0.06 s), peaks at ~0.25 s with Q and S notches
        T  wave  : ~0.16 s wide, peaks at ~0.45 s

    Amplitudes stay within AD8232 normal-range output (millivolt scale).
    """
    rr = 60.0 / hr_bpm          # R-R interval in seconds
    phase = (t % rr) / rr       # 0..1 within one beat

    # --- individual wave amplitudes (with a small per-call variation) ---
    p_amp  = 0.25 + noise_amp * random.uniform(-1, 1)
    r_amp  = 1.60 + noise_amp * random.uniform(-1, 1)
    t_amp  = 0.35 + noise_amp * random.uniform(-1, 1)
    q_amp  = 0.10 + noise_amp * random.uniform(-0.5, 0.5)  # negative
    s_amp  = 0.15 + noise_amp * random.uniform(-0.5, 0.5)  # negative

    # --- P wave ---
    p = p_amp * _gaussian(phase, 0.15, 0.025)

    # --- QRS complex ---
    q = -q_amp * _gaussian(phase, 0.285, 0.008)
    r =  r_amp * _gaussian(phase, 0.30,  0.015)
    s = -s_amp * _gaussian(phase, 0.315, 0.010)

    # --- T wave ---
    t_wave = t_amp * _gaussian(phase, 0.50, 0.045)

    # --- baseline wander (very slow sine) ---
    wander = 0.02 * math.sin(2 * math.pi * t / 10.0)

    # --- high-freq noise ---
    noise = random.gauss(0, noise_amp * 0.5)

    return p + q + r + s + t_wave + wander + noise


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def simulate_ecg(
    fs: int = 360,
    duration: float = 5.0,
    hr_bpm: float | None = None,
    noise_amp: float = 0.02,
) -> dict:
    """
    Simulate a realistic ECG waveform.

    Parameters
    ----------
    fs        : Sampling frequency in Hz (default 360 Hz, matches AD8232 typical)
    duration  : Duration in seconds (default 5 s → 1800 samples at 360 Hz)
    hr_bpm    : Heart rate in BPM.  If None, a random value in 60–90 is chosen.
    noise_amp : Controls how much random variation is added each run.

    Returns
    -------
    dict with keys:
        "waveform"   : list[float] — ECG sample values
        "heart_rate" : float       — simulated heart rate (BPM)
        "fs"         : int         — sampling frequency used
        "duration"   : float       — duration in seconds
        "samples"    : int         — total number of samples
    """
    if hr_bpm is None:
        hr_bpm = random.uniform(62, 88)      # normal sinus rhythm

    n_samples = int(fs * duration)
    dt = 1.0 / fs

    # Seed only the per-beat noise, not the global state, so consecutive
    # calls in the same process still differ.
    waveform = [
        round(_ecg_beat(i * dt, hr_bpm, noise_amp), 4)
        for i in range(n_samples)
    ]

    return {
        "waveform": waveform,
        "heart_rate": round(hr_bpm, 1),
        "fs": fs,
        "duration": duration,
        "samples": n_samples,
    }


# ---------------------------------------------------------------------------
# IoT-ready wrapper
# ---------------------------------------------------------------------------

def get_ecg(use_simulation: bool = True, **kwargs) -> dict:
    """
    IoT-ready ECG acquisition wrapper.

    Parameters
    ----------
    use_simulation : bool
        True  → use simulate_ecg() (default — for demo / testing)
        False → replace this block with BLE / UART garment read

    **kwargs are forwarded to simulate_ecg() when use_simulation=True.

    Returns
    -------
    Same dict as simulate_ecg().
    """
    if use_simulation:
        return simulate_ecg(**kwargs)

    # ── Future: real garment integration ────────────────────────────────
    # from garment_driver import GarmentReader
    # reader = GarmentReader(port="COM3", baud=115200)
    # return reader.read(duration=kwargs.get("duration", 5.0))
    # ────────────────────────────────────────────────────────────────────
    raise NotImplementedError(
        "Real garment driver not yet wired up. "
        "Pass use_simulation=True or implement the driver above."
    )


# ---------------------------------------------------------------------------
# CLI quick-test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    result = simulate_ecg(fs=360, duration=5.0)
    print(f"Heart rate : {result['heart_rate']} BPM")
    print(f"Samples    : {result['samples']}  (fs={result['fs']} Hz, {result['duration']} s)")
    print(f"Waveform   : {result['waveform'][:10]}  ... (first 10 values)")
    # Emit full JSON so the Node spawn can read stdout
    if "--json" in sys.argv:
        json.dump(result, sys.stdout)
