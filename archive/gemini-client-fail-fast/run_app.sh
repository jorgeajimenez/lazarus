#!/bin/bash
APP="app.py"
LOG="crash_log.txt"

# Ensure we can run the scripts
chmod +x sensor.py healer.py

while true; do
    echo "--- LAUNCHING APP (PORT 5005) ---"
    python $APP &> $LOG &
    PID=$!
    sleep 5
    
    # Check if process is still alive
    if kill -0 $PID 2>/dev/null; then
        echo "✅ App is running!"
        wait $PID
        exit 0
    else
        echo "💥 App Crashed! Starting Sensor..."
        python sensor.py
        
        echo "⏳ Starting Healer..."
        python healer.py &
        HEALER_PID=$!
        
        # Wait for healer to fix
        while [ ! -f /tmp/fix_applied.flag ]; do sleep 2; done
        
        kill $HEALER_PID
        rm /tmp/fix_applied.flag
        echo "🔄 Restarting App..."
    fi
done
