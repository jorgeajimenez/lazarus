# relay.py
from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Optional

app = FastAPI()

# --- 1. BRUTE FORCE CORS & PNA MIDDLEWARE ---
# This manually intercepts every request to add the headers browsers demand
@app.middleware("http")
async def add_cors_headers(request: Request, call_next):
    response = await call_next(request)
    # Allow ANY origin
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Allow-Methods"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "*"
    # CRITICAL: This allows public websites (AI Studio) to hit localhost
    response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response

# Handle OPTIONS preflight requests explicitly for Private Network Access
@app.options("/{rest_of_path:path}")
async def preflight_handler(rest_of_path: str):
    response = Response()
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "*"
    response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response

# --- DATA MODELS ---
class CrashReport(BaseModel):
    app_name: str
    crash_log: str
    context_files: Dict[str, str]

# In-memory storage
current_report: Optional[CrashReport] = None
fix_command: Dict = {"status": "AWAITING_DIAGNOSIS"}

# --- ENDPOINTS ---

@app.post("/report-crash")
async def report_crash(report: CrashReport):
    global current_report, fix_command
    print(f"\n--- 🚨 RECEIVED CRASH REPORT FOR: {report.app_name} 🚨 ---")
    current_report = report
    fix_command = {"status": "READY_FOR_DIAGNOSIS"}
    return JSONResponse(content={"message": "Crash report stored successfully."}, status_code=200)

@app.get("/get-report")
def get_report():
    print("--- 🧪 SERVING DUMMY REPORT FOR TESTING ---")
    
    if not current_report:
        # If no sensor has reported yet, return 404 or a "Waiting" status
        return {"status": "WAITING_FOR_CRASH", "message": "No crash reported yet."}
    
    # Return the real data sent by the sensor
    return current_report.dict()

@app.post("/apply-fix")
async def apply_fix(command: dict):
    global fix_command
    print("\n--- 🧠 RECEIVED FIX FROM AI STUDIO 🧠 ---")
    print(f"Fix Content: {command}")
    fix_command = command
    return {"message": "Fix queued for Healer."}

@app.get("/get-fix-command")
def get_fix_command():
    return fix_command

if __name__ == "__main__":
    import uvicorn
    # IMPORTANT: Run on 0.0.0.0 to verify network binding
    uvicorn.run(app, host="0.0.0.0", port=8001)