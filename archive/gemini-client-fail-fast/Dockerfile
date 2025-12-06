FROM python:3.10-alpine
WORKDIR /app
RUN apk add --no-cache bash
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
RUN chmod +x run_app.sh
EXPOSE 5005
CMD ["bash", "./run_app.sh"]
