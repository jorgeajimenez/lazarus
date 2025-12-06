#!/bin/bash
APP_FILE="app.py"
LOG_FILE="crash_log.txt"
HEALER_SCRIPT="healer.py"
chmod +x sensor.py healer.py

while true; do
    echo "--- $(date) --- Attempting to launch main application: $APP_FILE"
    python $APP_FILE &> $LOG_FILE &
    APP_PID=$!
    sleep 5 

    if kill -0 $APP_PID 2>/dev/null; then
        echo "✅ Application appears running. Watching..."
        wait $APP_PID
        exit 0
    else
        echo "❌ Application crashed! Initiating Triage process..."
        python sensor.py
        echo "Waiting for fix command from Agentic Brain..."
        python $HEALER_SCRIPT &
        HEALER_PID=$!
        while [ ! -f /tmp/fix_applied.flag ]; do
            sleep 5
            echo "Waiting for fix..."
        done
        kill $HEALER_PID
        rm /tmp/fix_applied.flag
        echo "Patch applied! Attempting restart."
    fi
done
