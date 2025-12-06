# Lazarus Relay

To run the Lazarus relay service:

1.  **Install dependencies**:
    ```bash
    pip install -r requirements.txt
    ```
2.  **Run with Uvicorn**:
    ```bash
    uvicorn relay:app --host 0.0.0.0 --port 8001
    ```
3.  **Expose with ngrok**:
    ```bash
    ngrok http 8001
    ```
    This will provide a public URL that tunnels to your local Lazarus service.