from fastapi import FastAPI, Request, APIRouter
from fastapi.testclient import TestClient
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

app = FastAPI()
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

router = APIRouter()
limiter_router = Limiter(key_func=get_remote_address)

@router.post("/login")
@limiter_router.limit("5/minute")
async def login(request: Request):
    return {"status": "ok"}

app.include_router(router)

client = TestClient(app)
try:
    res = client.post("/login")
    print("Response:", res.status_code, res.json())
except Exception as e:
    import traceback
    traceback.print_exc()
