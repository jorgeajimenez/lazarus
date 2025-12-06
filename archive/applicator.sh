#!/bin/bash

PROJECT_DIR="gemini-vibe-debugger-sf"

if [ ! -d "$PROJECT_DIR" ]; then
    echo "❌ Error: Directory $PROJECT_DIR not found. Run the initial setup script first!"
    exit 1
fi

echo "Moving into project directory: $PROJECT_DIR"
cd "$PROJECT_DIR"

# --- 1. Supervisor Script: run_app.sh ---
echo "Creating run_app.sh (Supervisor)..."
cat <<EOF > run_app.sh
#!/bin/bash

# --- File paths ---
APP_FILE="app.py"
LOG_FILE="crash_log.txt"
HEALER_SCRIPT="healer.py"

# Make python scripts executable
chmod +x sensor.py healer.py

# --- Main loop: Attempts to run the app, then enters triage if it fails ---
while true; do
    echo "--- \$(date) --- Attempting to launch main application: \$APP_FILE"

    # 1. Attempt to run the app, capturing all output (stdout and stderr)
    # The 'sleep 5' is a safety buffer for the app to crash cleanly.
    python \$APP_FILE &> \$LOG_FILE &
    APP_PID=\$!
    sleep 5 # Give the app time to connect/crash

    # Check if the app is still running after 5 seconds
    if kill -0 \$APP_PID 2>/dev/null; then
        echo "✅ Application appears running. Watching..."
        wait \$APP_PID # Wait for it to exit normally
        exit 0
    else
        echo "❌ Application crashed! Initiating Triage process..."
        
        # 2. Crash capture is already done via redirect above.
        
        # 3. Activate Sensor: Post the crash data to the Lazarus Relay
        echo "📞 Calling sensor.py to report crash to Lazarus Relay..."
        python sensor.py

        # 4. Enter Healing Loop: Wait for the fix
        echo "Waiting for fix command from Agentic Brain..."
        
        # We run the Healer as a background process to continuously poll
        python \$HEALER_SCRIPT &
        HEALER_PID=\$!
        
        # Wait until the Healer signals a fix (e.g., by creating a specific file)
        while [ ! -f /tmp/fix_applied.flag ]; do
            sleep 5
            echo "Waiting for fix..."
        done

        # Stop the Healer process
        kill \$HEALER_PID
        rm /tmp/fix_applied.flag
        echo "Patch applied! Attempting restart."
        # Loop restarts and tries 'python app.py' again.
    fi
done
EOF

# --- 2. Sensor Script: sensor.py ---
echo "Creating sensor.py..."
cat <<EOF > sensor.py
# sensor.py
import requests
import json
import os

# --- Configuration ---
# NOTE: 'lazarus-relay' assumes your docker-compose file includes a service named 'lazarus-relay'
RELAY_REPORT_URL = "http://lazarus-relay:8000/report-crash"
APP_FILE = "app.py"
LOG_FILE = "crash_log.txt"
COMPOSE_FILE = "docker-compose.yml"

def create_report_payload():
    """Reads all context files into a single, structured payload."""
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
        print(f"Error reading context files: {e}")
        return None

def send_crash_report():
    payload = create_report_payload()
    if not payload:
        return

    print("Attempting to send crash report to Relay...")
    try:
        # Increase timeout as network setup can be slow
        response = requests.post(RELAY_REPORT_URL, json=payload, timeout=20)
        
        if response.status_code == 200:
            print("✅ Crash report successfully sent to Relay.")
        else:
            print(f"❌ Failed to send report. Status: {response.status_code}")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Network error while connecting to Relay: {e}")

if __name__ == "__main__":
    send_crash_report()
EOF

# --- 3. Healer Script: healer.py ---
echo "Creating healer.py..."
cat <<EOF > healer.py
# healer.py
import requests
import time
import os
import re
import json

# --- Configuration ---
RELAY_FIX_URL = "http://lazarus-relay:8000/get-fix-command" 
APP_FILE = "app.py"
FIX_APPLIED_FLAG = "/tmp/fix_applied.flag"
POLLING_INTERVAL = 5 # seconds

def apply_patch(patch_data):
    """Applies the single-line code patch to the app.py file."""
    try:
        # 1. Read the file content
        with open(APP_FILE, 'r') as f:
            content = f.read()

        line_to_change = patch_data['line_to_change']
        corrected_line = patch_data['corrected_line']

        # 2. Find and replace the buggy line (using regex for safety)
        # Match the line starting with the buggy variable assignment
        
        # NOTE: We use re.escape() for robustness
        escaped_buggy_line = re.escape(line_to_change)
        
        # Use re.sub to find the exact line and replace it
        new_content = re.sub(f"^{escaped_buggy_line}.*$", corrected_line, content, flags=re.MULTILINE)

        if new_content == content:
            print("WARNING: Patch failed! Could not find line to change in app.py.")
            return False

        # 3. Write the fixed content back to the file
        with open(APP_FILE, 'w') as f:
            f.write(new_content)
        
        print(f"✅ Patch applied successfully to {APP_FILE}.")
        return True

    except Exception as e:
        print(f"❌ Error during patch application: {e}")
        return False

def check_for_fix():
    try:
        # 1. Poll the Relay for the latest fix command
        response = requests.get(RELAY_FIX_URL, timeout=5)
        
        if response.status_code == 200:
            fix_command = response.json()
            
            # Check for the correct status flag from the Agentic Brain
            if fix_command.get('status') == 'FIX_GENERATED':
                print("Received Fix Command from Agentic Brain.")

                # 2. Apply the patch
                if apply_patch(fix_command['patch']):
                    # 3. Signal the Supervisor to restart
                    with open(FIX_APPLIED_FLAG, 'w') as f:
                        f.write("FIXED")
                    return True
        
    except requests.exceptions.RequestException:
        # Relay might not be up or accessible yet
        pass
    except json.JSONDecodeError:
        print("Received invalid JSON from Relay.")
        
    return False

if __name__ == "__main__":
    print("Healer running and polling for fix command...")
    while True:
        if check_for_fix():
            # If fix applied, exit the healer process
            break
        time.sleep(POLLING_INTERVAL)
EOF

# --- 4. Final Updates and Instructions ---
echo "--- ✅ SCRIPTS CREATED AND UPDATED! ---"

# Set necessary permissions
chmod +x run_app.sh

echo "### ⚠️ CRITICAL MODIFICATION REQUIRED:"
echo "1. DOCKERFILE: You must manually change the CMD instruction in the Dockerfile to:"
echo '   CMD ["bash", "./run_app.sh"]'
echo "2. REQUIREMENTS: Ensure your requirements.txt includes 'requests' and 'fastapi' for the Relay/Sensor."
echo "3. RELAY SETUP: You still need to build and run the 'Lazarus Relay (FastAPI)' service!"