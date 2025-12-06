import requests
import time
import os

# The Healer lives inside Docker, so it talks to the Relay on your Mac via this host
RELAY_FIX_ENDPOINT = "http://host.docker.internal:8001/get-fix-command"
APP_FILE = "app.py"

def start_healer_loop():
    print("🚑 HEALER ONLINE: Polling Relay for fixes...")
    
    while True:
        try:
            # 1. POLL THE RELAY
            response = requests.get(RELAY_FIX_ENDPOINT, timeout=5)
            
            if response.status_code == 200:
                command = response.json()
                
                # 2. VALIDATE COMMAND
                # We only act if the status is explicitly "FIX_GENERATED"
                if command.get("status") == "FIX_GENERATED":
                    print(f"💉 FIX RECEIVED: {command.get('bug_id')}")
                    
                    patch_data = command.get("patch", {})
                    target_file = patch_data.get("file", APP_FILE)
                    
                    # 3. APPLY THE PATCH
                    apply_patch_to_disk(target_file, patch_data)
                    
                    # 4. RESET RELAY STATE (Optional local cleanup)
                    # In a real app we'd tell the Relay we finished, but here we just wait
                    time.sleep(10) 
                    
        except Exception as e:
            print(f"❌ Healer polling error: {e}")
            
        time.sleep(5)

def apply_patch_to_disk(filename, patch):
    try:
        if not os.path.exists(filename):
            print(f"❌ Error: Target file {filename} not found.")
            return

        with open(filename, 'r') as f:
            content = f.read()
            
        line_to_find = patch['line_to_change']
        new_line = patch['corrected_line']
        
        # CRITICAL: Verify the line exists before replacing
        if line_to_find in content:
            new_content = content.replace(line_to_find, new_line)
            
            with open(filename, 'w') as f:
                f.write(new_content)
                
            print(f"✅ SUCCESS: Patched {filename}.")
            
            # 5. RELOAD THE APP
            trigger_app_reload()
            
        else:
            print(f"⚠️ FAILURE: Could not find exact line '{line_to_find}' in {filename}.")
            print("   -> Healer cannot apply fuzzy patches safely.")
            
    except Exception as e:
        print(f"❌ Error applying patch: {e}")

def trigger_app_reload():
    try:
        # Hit the reload endpoint to reset the 'IS_CRASHED' flag in the running app
        requests.get("http://localhost:5005/reload", timeout=2)
        print("🔄 App Reload Signal Sent.")
    except:
        pass

if __name__ == "__main__":
    start_healer_loop()