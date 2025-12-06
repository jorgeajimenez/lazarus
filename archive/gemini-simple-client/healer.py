import requests
import time
import re
import os

RELAY_ENDPOINT = "http://host.docker.internal:8001/get-fix-command"
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
