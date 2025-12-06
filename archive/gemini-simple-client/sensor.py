import requests
import os

# Talk to the Relay running on your Mac
RELAY_ENDPOINT = "http://host.docker.internal:8001/report-crash"
APP_FILE = "app.py"
LOG_FILE = "crash_log.txt"
COMPOSE_FILE = "docker-compose.yml"

def send_crash_report():
    print(f"📡 Sensor activating. Contacting Relay at {RELAY_ENDPOINT}...")
    try:
        # Read files safely
        app_code = open(APP_FILE).read() if os.path.exists(APP_FILE) else "Missing"
        crash_log = open(LOG_FILE).read() if os.path.exists(LOG_FILE) else "Missing"
        
        payload = {
            "app_name": "simple-client",
            "context_files": {"app.py": app_code},
            "crash_log": crash_log
        }
        
        resp = requests.post(RELAY_ENDPOINT, json=payload, timeout=5)
        if resp.status_code == 200:
            print("✅ Crash Report Sent!")
        else:
            print(f"❌ Relay rejected report: {resp.status_code}")
    except Exception as e:
        print(f"❌ Sensor Network Error (Is Relay running on 8001?): {e}")

if __name__ == "__main__":
    send_crash_report()
