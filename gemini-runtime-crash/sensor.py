import requests
import os

RELAY_ENDPOINT = "http://host.docker.internal:8001/report-crash"
APP_FILE = "app.py"
LOG_FILE = "crash_log.txt"

def send_crash_report():
    print(f"📡 Sensor activating...")
    try:
        app_code = open(APP_FILE).read() if os.path.exists(APP_FILE) else "Missing"
        crash_log = open(LOG_FILE).read() if os.path.exists(LOG_FILE) else "Missing"
        
        payload = {
            "app_name": "runtime-client",
            "context_files": {"app.py": app_code},
            "crash_log": crash_log
        }
        
        resp = requests.post(RELAY_ENDPOINT, json=payload, timeout=5)
        if resp.status_code == 200:
            print("✅ Crash Report Sent to Relay!")
        else:
            print(f"❌ Relay error: {resp.status_code}")
    except Exception as e:
        print(f"❌ Sensor Network Error: {e}")

if __name__ == "__main__":
    send_crash_report()
