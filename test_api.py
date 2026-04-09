import urllib.request, json, sys

def test(name, method, url, body=None):
    print(f"\n--- {name} ---")
    try:
        data = json.dumps(body).encode() if body else None
        req = urllib.request.Request(url, data=data, headers={"Content-Type":"application/json"} if body else {})
        r = urllib.request.urlopen(req, timeout=15)
        out = json.loads(r.read().decode())
        # Print summary
        if isinstance(out, dict):
            for k,v in out.items():
                if isinstance(v, list) and len(v) > 3:
                    print(f"  {k}: [{len(v)} items]")
                elif isinstance(v, dict):
                    print(f"  {k}: {json.dumps(v)[:120]}...")
                else:
                    print(f"  {k}: {v}")
        print("  STATUS: OK")
    except Exception as e:
        print(f"  STATUS: FAILED - {e}")

test("Health", "GET", "http://localhost:5000/api/health")
test("ECG Stream", "GET", "http://localhost:5000/api/ecg/stream")
test("Explain", "POST", "http://localhost:5000/api/explain", {
    "patient": {"age":55,"sex":"Male","cp":"asymptomatic","trestbps":145,"chol":270,
                "fbs":True,"restecg":"normal","thalch":110,"exang":True,
                "oldpeak":2.3,"slope":"flat","ca":1.0,"thal":"reversable defect"},
    "probability": 0.72
})
print("\nAll API tests complete.")
