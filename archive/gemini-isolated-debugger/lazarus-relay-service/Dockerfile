# Dockerfile (Relay Image - Completely Independent)
FROM python:3.10-alpine

WORKDIR /app

# Copy only the necessary dependencies and install them
COPY ../requirements.txt .
RUN pip install fastapi uvicorn --no-cache-dir

COPY relay.py .

EXPOSE 8000

CMD ["uvicorn", "relay:app", "--host", "0.0.0.0", "--port", "8000"]
