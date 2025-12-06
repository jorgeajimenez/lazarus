# Dockerfile
FROM python:3.10-alpine

WORKDIR /code

# Install dependencies (Flask and Redis library)
COPY requirements.txt requirements.txt
RUN pip install -r requirements.txt --no-cache-dir

COPY . .

EXPOSE 5000

# Run the app
CMD ["python", "app.py"]
