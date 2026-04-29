from fastapi import FastAPI, Request
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import asyncio

app = FastAPI()
limiter = Limiter(key_func=get_remote_address)

@app.post("/login")
@limiter.limit("5/minute")
async def login(request: Request):
    return {"status": "ok"}

async def test():
    # Mock a request with no client
    scope = {
        "type": "http",
        "client": None,
        "headers": [],
        "method": "POST",
        "path": "/login",
    }
    req = Request(scope)
    try:
        await login(request=req)
        print("Success")
    except Exception as e:
        print("Error:", type(e), str(e))

asyncio.run(test())
