# healer.py
import requests
import time
import os
import re
import json

RELAY_SERVICE_NAME = "lazarus-relay"
RELAY_FIX_URL = f"http://{RELAY_SERVICE_NAME}:8000/get-fix-command" 
APP_FILE = "app.py"
FIX_APPLIED_FLAG = "/tmp/fix_applied.flag"
POLLING_INTERVAL = 5 

# ... [rest of healer.py logic] ...
def apply_patch(patch_data):
    try:
        with open(APP_FILE, 'r') as f:
            content = f.read()

        line_to_change = patch_data['line_to_change']
        corrected_line = patch_data['corrected_line']
        escaped_buggy_line = re.escape(line_to_change)
        
        new_content = re.sub(f"^{escaped_buggy_line}.*$", corrected_line, content, flags=re.MULTILINE)

        if new_content == content:
            print("WARNING: Patch failed! Could not find line to change in app.py.")
            return False

        with open(APP_FILE, 'w') as f:
            f.write(new_content)
        
        print(f"✅ Patch applied successfully to {APP_FILE}.")
        return True

    except Exception as e:
        print(f"❌ Error during patch application: {e}")
        return False

def check_for_fix():
    try:
        response = requests.get(RELAY_FIX_URL, timeout=5)
        
        if response.status_code == 200:
            fix_command = response.json()
            
            if fix_command.get('status') == 'FIX_GENERATED':
                print("Received Fix Command from Agentic Brain.")

                if apply_patch(fix_command['patch']):
                    with open(FIX_APPLIED_FLAG, 'w') as f:
                        f.write("FIXED")
                    return True
        
    except requests.exceptions.RequestException:
        pass 
    except json.JSONDecodeError:
        print("Received invalid JSON from Relay.")
        
    return False

if __name__ == "__main__":
    print("Healer running and polling for fix command...")
    while True:
        if check_for_fix():
            break
        time.sleep(POLLING_INTERVAL)
