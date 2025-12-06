#!/bin/bash

# --- File paths ---
APP_FILE="app.py"
LOG_FILE="crash_log.txt"
HEALER_SCRIPT="healer.py"

# Make python scripts executable
chmod +x sensor.py healer.py

# --- Main loop: Attempts to run the app, then enters triage if it fails ---
while true; do
    echo "--- $(date) --- Attempting to launch main application: $APP_FILE"

    # 1. Attempt to run the app, capturing all output (stdout and stderr)
    # The 'sleep 5' is a safety buffer for the app to crash cleanly.
    python $APP_FILE &> $LOG_FILE &
    APP_PID=$!
    sleep 5 # Give the app time to connect/crash

    # Check if the app is still running after 5 seconds
    if kill -0 $APP_PID 2>/dev/null; then
        echo "✅ Application appears running. Watching..."
        wait $APP_PID # Wait for it to exit normally
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
        python $HEALER_SCRIPT &
        HEALER_PID=$!
        
        # Wait until the Healer signals a fix (e.g., by creating a specific file)
        while [ ! -f /tmp/fix_applied.flag ]; do
            sleep 5
            echo "Waiting for fix..."
        done

        # Stop the Healer process
        kill $HEALER_PID
        rm /tmp/fix_applied.flag
        echo "Patch applied! Attempting restart."
        # Loop restarts and tries 'python app.py' again.
    fi
done
