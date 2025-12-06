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
        # cache.incr('hits')
        arr = [1,2, 3 ]

        x = arr[0]
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
