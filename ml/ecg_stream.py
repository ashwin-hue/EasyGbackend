import json
import sys
import importlib

sim = importlib.import_module("ecg_simulator")
classifier = importlib.import_module("ecg_classifier")

def main():
    ecg_data = sim.simulate_ecg(fs=360, duration=5.0)
    classification = classifier.classify_ecg(ecg_data["waveform"], fs=360, hr_bpm=ecg_data["heart_rate"])
    
    result = {
        "ecg_data": ecg_data,
        "classification": classification
    }
    json.dump(result, sys.stdout)

if __name__ == "__main__":
    main()
