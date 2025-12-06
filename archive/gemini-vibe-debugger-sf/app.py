# app.py
import time
import redis
from flask import Flask

# THE BUG: The hostname is intentionally set incorrectly here.
# It should be 'redis' (the service name in docker-compose)
# but is set to 'localhost' to force a connection error inside the container.
BUGGY_REDIS_HOST = 'localhost' 

app = Flask(__name__)
# The application attempts to connect to the misconfigured host
cache = redis.Redis(host=BUGGY_REDIS_HOST, port=6379, decode_responses=True)

def get_hit_count():
    retries = 5
    while retries > 0:
        try:
            # This line will throw a redis.exceptions.ConnectionError
            return cache.incr('hits')
        except redis.exceptions.ConnectionError as exc:
            retries -= 1
            time.sleep(0.5)
            if retries == 0:
                # This will eventually crash the container and fill the logs
                raise exc

@app.route('/')
def hello():
    try:
        count = get_hit_count()
        return f'Hello World! I have been seen {count} times.\n'
    except Exception as e:
        # A simple error message on the web, but the full stack trace is in the logs
        return f'Web service failed to connect to database: {e}', 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
