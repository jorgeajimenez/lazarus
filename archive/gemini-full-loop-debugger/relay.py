# relay.py (Lazarus Relay - FastAPI)
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
import uvicorn
import json

app = FastAPI()

# In-memory storage for the system state
CRASH_REPORT = {"status": "NO_CRASH"}
FIX_COMMAND = {"status": "AWAITING_DIAGNOSIS"}

@app.post("/report-crash")
async def report_crash(report: dict):
    """Endpoint hit by the Sensor when the app crashes."""
    global CRASH_REPORT, FIX_COMMAND
    print("\n--- 🚨 RECEIVED CRASH REPORT 🚨 ---")
    CRASH_REPORT.update(report)
    CRASH_REPORT["status"] = "CRASH_REPORTED"
    FIX_COMMAND.update({"status": "READY_FOR_DIAGNOSIS"})
    print(f"Active Crash Report received for: {report.get('app_name', 'Unknown')}")
    return JSONResponse(content={"message": "Report received and saved. Brain is notified."}, status_code=200)

@app.get("/get-report")
def get_report():
    """Endpoint hit by the AI Studio Dashboard/Agentic Brain to pull the context."""
    if CRASH_REPORT.get("status") == "NO_CRASH":
        raise HTTPException(status_code=404, detail="No active crash report available.")
    return CRASH_REPORT

@app.post("/apply-fix")
async def apply_fix(command: dict):
    """Endpoint hit by the AI Studio Dashboard/Agentic Brain to send the fix."""
    global FIX_COMMAND
    print("\n--- 🧠 RECEIVED FIX COMMAND FROM BRAIN 🧠 ---")
    if command.get('status') != 'FIX_GENERATED':
        raise HTTPException(status_code=400, detail="Invalid fix command status.")
        
    FIX_COMMAND.update(command)
    print(f"Fix command saved. Status: {FIX_COMMAND['status']}")
    CRASH_REPORT.update({"status": "FIX_SENT"})
    return JSONResponse(content={"message": "Fix command saved for Healer execution."}, status_code=200)

@app.get("/get-fix-command")
def get_fix_command():
    """Endpoint hit by the Healer to check for a new fix."""
    return FIX_COMMAND

# To run: uvicorn relay:app --reload --host 0.0.0.0 --port 8000
