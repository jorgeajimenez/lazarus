#!/bin/bash

# --- CONFIGURATION ---
PROJECT_DIR="gemini-runtime-crash"
RELAY_URL="http://host.docker.internal:8001"

echo "--- 🚀 SETTING UP RUNTIME CRASH DEMO 🚀 ---"
mkdir -p "$PROJECT_DIR"
cd "$PROJECT_DIR"

# 1. REQUIREMENTS
cat <<EOF > requirements.txt
flask
redis
requests
EOF

# 2. APP.PY (HEALTHY START, CRASH ON DEMAND)
cat <<EOF > app.py
import time
import redis
import sys
import threading
from flask import Flask, request

# BUG: 'localhost' fails inside Docker.
BUGGY_REDIS_HOST = 'localhost' 

app = Flask(__name__)
cache = redis.Redis(host=BUGGY_REDIS_HOST, port=6379, decode_responses=True)

# Global flag to simulate "Maintenance Mode" after a crash
IS_CRASHED = False

def trigger_sensor():
    """Runs the sensor script independently."""
    import subprocess
    print("--- 🚨 RUNNING SENSOR ---")
    subprocess.Popen(["python", "sensor.py"])

def start_healer():
    """Starts the healer in the background."""
    import subprocess
    print("--- 🚑 STARTING HEALER ---")
    subprocess.Popen(["python", "healer.py"])

@app.route('/')
def home():
    if IS_CRASHED:
        return "<h1>⚠️ SYSTEM CRASHED ⚠️</h1><p>Diagnosing and Healing in progress...</p>", 503
    return "<h1>✅ System Online</h1><p>Go to <a href='/crash'>/crash</a> to test the agent.</p>"

@app.route('/crash')
def manual_crash():
    global IS_CRASHED
    if IS_CRASHED:
        return "System already down.", 503
        
    try:
        # THE BUG: This will fail immediately
        cache.incr('hits')
        return "Success!" # We won't get here
    except Exception as e:
        print(f"--- 💥 RUNTIME ERROR TRIGGERED: {e} ---")
        
        # 1. Write the crash log so Sensor can see it
        with open("crash_log.txt", "w") as f:
            f.write(str(e))
            
        # 2. Mark system as crashed
        IS_CRASHED = True
        
        # 3. Trigger the Agentic Workflow
        trigger_sensor()
        start_healer()
        
        return f"<h1>💥 CRASH TRIGGERED</h1><p>Error: {e}</p><p>Sensor activated. Check your Relay.</p>", 500

@app.route('/reload')
def reload_app():
    """Called by Healer to reset the state after patching."""
    global IS_CRASHED
    # In a real app, we'd reload the module, but here we just reset the flag
    # because the Healer effectively hot-patched the file on disk.
    IS_CRASHED = False
    return "<h1>🔄 RELOADED</h1><p>System back online.</p>"

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5005)
EOF

# 3. SENSOR
cat <<EOF > sensor.py
import requests
import os

RELAY_ENDPOINT = "${RELAY_URL}/report-crash"
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
EOF

# 4. HEALER
cat <<EOF > healer.py
import requests
import time
import re
import os

RELAY_ENDPOINT = "${RELAY_URL}/get-fix-command"
APP_FILE = "app.py"

def apply_fix():
    print("🚑 Healer polling for fixes...")
    while True:
        try:
            resp = requests.get(RELAY_ENDPOINT, timeout=5)
            if resp.status_code == 200:
                data = resp.json()
                if data.get('status') == 'FIX_GENERATED':
                    print("💉 Healer received fix! Applying...")
                    patch = data['patch']
                    
                    with open(APP_FILE, 'r') as f: content = f.read()
                    
                    # Regex replace
                    safe_line = re.escape(patch['line_to_change'])
                    new_content = re.sub(f"^{safe_line}.*$", patch['corrected_line'], content, flags=re.MULTILINE)
                    
                    if new_content != content:
                        with open(APP_FILE, 'w') as f: f.write(new_content)
                        print("✅ Code Patched.")
                        
                        # Trigger a reload (simulated)
                        # We don't need to restart the container, just tell the app it's healthy
                        # In this POC, the file is changed, so next request works if we reset flag.
                        requests.get("http://localhost:5005/reload")
                        return
        except Exception as e:
            print(f"Healer error: {e}")
        
        time.sleep(5)

if __name__ == "__main__":
    apply_fix()
EOF

# 5. DOCKERFILE
cat <<EOF > Dockerfile
FROM python:3.10-alpine
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 5005
CMD ["python", "app.py"]
EOF

# 6. DOCKER COMPOSE
cat <<EOF > docker-compose.yml
services:
  web:
    build: .
    volumes:
      - .:/app
    ports:
      - "5005:5005"
    environment:
      - RELAY_HOST=host.docker.internal
    
  redis:
    image: redis:alpine
EOF

echo ""
echo "--- ✅ DEMO READY ---"
echo "1. Ensure Relay is running locally: 'uvicorn relay:app --port 8001'"
echo "2. Run: cd $PROJECT_DIR && docker compose up --build"
echo "3. Go to http://localhost:5005 in your browser."
echo "4. Click '/crash' to break the app and trigger the Agent."