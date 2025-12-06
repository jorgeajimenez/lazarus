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
