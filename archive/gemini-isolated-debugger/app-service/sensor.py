# sensor.py
import requests
import json
import os
RELAY_SERVICE_NAME = "lazarus-relay"
RELAY_REPORT_URL = f"http://{RELAY_SERVICE_NAME}:8000/report-crash"
APP_FILE = "app.py"
LOG_FILE = "crash_log.txt"
COMPOSE_FILE = "../docker-compose.yml" # Relative path to root
# ... [rest of sensor.py logic] ...
def create_report_payload():
    # Adjusted to use os.path.join for robustness
    try:
        with open(APP_FILE, 'r') as f:
            app_code = f.read()
        with open(COMPOSE_FILE, 'r') as f:
            compose_context = f.read()
        with open(LOG_FILE, 'r') as f:
            crash_log = f.read()
            
        return {
            "app_name": "redis-hit-counter",
            "metadata": {"timestamp": os.path.getmtime(LOG_FILE), "version": "1.0"},
            "context_files": {
                "app.py": app_code,
                "docker-compose.yml": compose_context
            },
            "crash_log": crash_log
        }
    except Exception as e:
        # NOTE: This can happen if you run sensor.py before the crash occurs
        print(f"Error reading context files (expected if crash hasn't finalized): {e}")
        return None

def send_crash_report():
    payload = create_report_payload()
    if not payload: return
    print("Attempting to send crash report to Relay...")
    try:
        response = requests.post(RELAY_REPORT_URL, json=payload, timeout=20)
        if response.status_code == 200:
            print("✅ Crash report successfully sent to Relay.")
        else:
            print(f"❌ Failed to send report. Status: {response.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"❌ Network error connecting to Relay: {e}")

if __name__ == "__main__":
    send_crash_report()
