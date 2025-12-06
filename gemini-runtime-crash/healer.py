import requests
import time
import re
import os

RELAY_ENDPOINT = "http://host.docker.internal:8001/get-fix-command"
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
