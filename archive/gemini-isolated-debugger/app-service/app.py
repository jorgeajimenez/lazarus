# app.py
import time
import redis
from flask import Flask
# THE BUG: Hostname is incorrect
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
    app.run(host="0.0.0.0", port=5000)
