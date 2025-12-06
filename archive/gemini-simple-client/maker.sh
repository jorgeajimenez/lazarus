#!/bin/bash

# --- CONFIGURATION ---
PROJECT_DIR="gemini-client-port-5005"
# Uses Docker's special DNS to reach your Mac (Relay) on port 8001
RELAY_URL="http://host.docker.internal:8001"

echo "--- 🚀 SETTING UP CLIENT (PORT 5005) 🚀 ---"
mkdir -p "$PROJECT_DIR"
cd "$PROJECT_DIR"

# 1. REQUIREMENTS
echo "Creating requirements.txt..."
cat <<EOF > requirements.txt
flask
redis
requests
EOF

# 2. BUGGY APP (CONFIGURED FOR PORT 5005)
echo "Creating app.py..."
cat <<EOF > app.py
import time
import redis
from flask import Flask

# BUG: 'localhost' fails inside Docker. Needs to be 'redis'.
BUGGY_REDIS_HOST = 'localhost' 

app = Flask(__name__)
cache = redis.Redis(host=BUGGY_REDIS_HOST, port=6379, decode_responses=True)

def get_hit_count():
    retries = 5
    while retries > 0:
        try:
            return cache.incr('hits')
        except redis.exceptions.ConnectionError as exc:
            retries -= 1
            time.sleep(0.5)
            if retries == 0:
                raise exc

@app.route('/')
def hello():
    try:
        count = get_hit_count()
        return f'Hello World! I have been seen {count} times.\n'
    except Exception as e:
        return f'Web service failed to connect to database: {e}', 500

if __name__ == "__main__":
    # RUNNING ON PORT 5005 TO AVOID AIRPLAY
    app.run(host="0.0.0.0", port=5005)
EOF

# 3. SENSOR
echo "Creating sensor.py..."
cat <<EOF > sensor.py
import requests
import os

# Talk to the Relay running on your Mac
RELAY_ENDPOINT = "${RELAY_URL}/report-crash"
APP_FILE = "app.py"
LOG_FILE = "crash_log.txt"

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
        print(f"❌ Sensor Network Error (Is Relay running locally on 8001?): {e}")

if __name__ == "__main__":
    send_crash_report()
EOF

# 4. HEALER
echo "Creating healer.py..."
cat <<EOF > healer.py
import requests
import time
import re
import os

RELAY_ENDPOINT = "${RELAY_URL}/get-fix-command"
APP_FILE = "app.py"
FIX_FLAG = "/tmp/fix_applied.flag"

def check_and_apply():
    try:
        resp = requests.get(RELAY_ENDPOINT, timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            if data.get('status') == 'FIX_GENERATED':
                print("💉 Healer received fix! Applying...")
                
                # Apply the patch
                patch = data['patch']
                with open(APP_FILE, 'r') as f: content = f.read()
                
                # Regex replace
                safe_line = re.escape(patch['line_to_change'])
                new_content = re.sub(f"^{safe_line}.*$", patch['corrected_line'], content, flags=re.MULTILINE)
                
                if new_content != content:
                    with open(APP_FILE, 'w') as f: f.write(new_content)
                    print("✅ Code Patched.")
                    # Create flag to tell supervisor to restart
                    open(FIX_FLAG, 'w').close()
                    return True
    except Exception:
        pass
    return False

if __name__ == "__main__":
    print("🚑 Healer polling for fixes...")
    while True:
        if check_and_apply(): break
        time.sleep(5)
EOF

# 5. SUPERVISOR
echo "Creating run_app.sh..."
cat <<EOF > run_app.sh
#!/bin/bash
APP="app.py"
LOG="crash_log.txt"

# Ensure we can run the scripts
chmod +x sensor.py healer.py

while true; do
    echo "--- LAUNCHING APP (PORT 5005) ---"
    python \$APP &> \$LOG &
    PID=\$!
    sleep 5
    
    # Check if process is still alive
    if kill -0 \$PID 2>/dev/null; then
        echo "✅ App is running!"
        wait \$PID
        exit 0
    else
        echo "💥 App Crashed! Starting Sensor..."
        python sensor.py
        
        echo "⏳ Starting Healer..."
        python healer.py &
        HEALER_PID=\$!
        
        # Wait for healer to fix
        while [ ! -f /tmp/fix_applied.flag ]; do sleep 2; done
        
        kill \$HEALER_PID
        rm /tmp/fix_applied.flag
        echo "🔄 Restarting App..."
    fi
done
EOF

# 6. DOCKERFILE
echo "Creating Dockerfile..."
cat <<EOF > Dockerfile
FROM python:3.10-alpine
WORKDIR /app
RUN apk add --no-cache bash
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
RUN chmod +x run_app.sh
# Expose 5005 internal
EXPOSE 5005
CMD ["bash", "./run_app.sh"]
EOF

# 7. DOCKER COMPOSE
echo "Creating docker-compose.yml..."
cat <<EOF > docker-compose.yml
services:
  web:
    build: .
    volumes:
      - .:/app
    ports:
      # Map Host 5005 to Container 5005
      - "5005:5005"
    environment:
      - RELAY_HOST=host.docker.internal
    
  redis:
    image: redis:alpine
EOF

echo ""
echo "--- ✅ DONE. ---"
echo "1. Ensure your Relay is running locally on port 8001: 'uvicorn relay:app --port 8001'"
echo "2. Run: cd $PROJECT_DIR && docker compose up --build"