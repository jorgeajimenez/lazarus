from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import datetime
import json
import os

app = FastAPI()

# Enable CORS so the React app (localhost:3000) can hit this endpoint
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

LOG_FILE = "app_errors.log"

@app.post("/log-error")
async def log_error(request: Request):
    try:
        data = await request.json()
        timestamp = datetime.datetime.now().isoformat()
        
        entry = {
            "timestamp": timestamp,
            "report": data
        }
        
        # Append to log file
        with open(LOG_FILE, "a") as f:
            f.write(json.dumps(entry, indent=2) + "\n,\n")
            
        print(f"[{timestamp}] 🐛 Bug Report Recieved")
        return {"status": "success", "message": "Log saved"}
    except Exception as e:
        print(f"Error logging bug: {e}")
        return {"status": "error", "detail": str(e)}

if __name__ == "__main__":
    print(f"🐛 Bug Logger running on http://localhost:8000")
    print(f"Logs will be saved to {os.path.abspath(LOG_FILE)}")
    uvicorn.run(app, host="0.0.0.0", port=8000)
