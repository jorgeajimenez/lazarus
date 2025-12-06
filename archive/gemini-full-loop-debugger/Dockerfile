# Dockerfile (Application Image - Web/Sensor/Healer)
FROM python:3.10-alpine

WORKDIR /code

# Install BASH for the shell script entrypoint (Fixes Alpine exec error)
RUN apk update && apk add bash

# Install dependencies (Flask, Redis, requests)
COPY requirements.txt requirements.txt
RUN pip install -r requirements.txt --no-cache-dir

COPY . .

EXPOSE 5000

RUN chmod +x run_app.sh

# FINAL CMD: Executes the supervisor script
CMD ["bash", "./run_app.sh"]
