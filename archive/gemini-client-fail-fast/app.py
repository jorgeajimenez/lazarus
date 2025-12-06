import time
import redis
import sys
from flask import Flask

# BUG: 'localhost' fails inside Docker. Needs to be 'redis'.
BUGGY_REDIS_HOST = 'localhost' 

app = Flask(__name__)
cache = redis.Redis(host=BUGGY_REDIS_HOST, port=6379, decode_responses=True)

def get_hit_count():
    retries = 5
    while retries > 0:
        try:
            return cache.incr('hits')
        except redis.exceptions.ConnectionError as exc:
            retries -= 1
            time.sleep(0.5)
            if retries == 0:
                raise exc

@app.route('/')
def hello():
    try:
        count = get_hit_count()
        return f'Hello World! I have been seen {count} times.\n'
    except Exception as e:
        return f'Web service failed to connect to database: {e}', 500

if __name__ == "__main__":
    print("--- APP STARTUP: CHECKING REDIS CONNECTION ---")
    # CRITICAL FIX: Force a connection check immediately!
    try:
        cache.ping()
        print("--- REDIS CONNECTED ---")
    except Exception as e:
        print(f"--- FATAL ERROR: CANNOT CONNECT TO REDIS: {e} ---")
        # Exit with error code to kill the process immediately
        sys.exit(1)

    # If we get here, the server starts (but we won't get here)
    app.run(host="0.0.0.0", port=5005)
