"""Main FastAPI application for BakeryOS.

This file owns app creation, middleware, router registration, and startup
lifecycle. Business logic lives in the routers/ and services/ packages.
"""

import logging
import os
import secrets
import sys
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager

# Load .env file early so SECRET_KEY and other env vars are available
# before any module (auth.py) reads them via os.getenv().
# Load .env file from the project root (one level up from this file)
try:
    from dotenv import load_dotenv
    # Explicitly find the .env in the root to avoid CWD issues
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    load_dotenv(dotenv_path=env_path)
except ImportError:
    pass  # python-dotenv not installed; rely on shell environment

import sqlalchemy.orm
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

logger = logging.getLogger(__name__)

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.append(CURRENT_DIR)

try:
    from . import models
    from .database import get_db
    from .auth import (
        get_current_user,
        get_effective_owner_id,
        get_password_hash,
        requires_roles,
    )
    from .bootstrap import init_db
    from .routers.auth import router as auth_router
    from .routers.catalog import router as catalog_router
    from .routers.finance import router as finance_router
    from .routers.integrations import router as integrations_router
    from .routers.intelligence import router as intelligence_router
    from .routers.operations import router as operations_router
    from .routers.orders import router as orders_router
    from .routers.pos import router as pos_router
    from .routers.purchasing import router as purchasing_router
    from .routers.shift_logs import router as shift_logs_router
    from .routers.staff import router as staff_router
    from .routers.currency import router as currency_router
    from .routers.customers import router as customers_router
    from .routers.semi_finished import router as semi_finished_router
    from .routers.kitchen import router as kitchen_router

except ImportError:
    import models
    from database import get_db
    from auth import (
        get_current_user,
        get_effective_owner_id,
        get_password_hash,
        requires_roles,
    )
    from bootstrap import init_db
    from routers.auth import router as auth_router
    from routers.catalog import router as catalog_router
    from routers.finance import router as finance_router
    from routers.integrations import router as integrations_router
    from routers.intelligence import router as intelligence_router
    from routers.operations import router as operations_router
    from routers.orders import router as orders_router
    from routers.pos import router as pos_router
    from routers.purchasing import router as purchasing_router
    from routers.shift_logs import router as shift_logs_router
    from routers.staff import router as staff_router
    from routers.currency import router as currency_router
    from routers.customers import router as customers_router
    from routers.semi_finished import router as semi_finished_router
    from routers.kitchen import router as kitchen_router


# ---------------------------------------------------------------------------
# App lifecycle
# ---------------------------------------------------------------------------

# Guard so init_db() only runs once per process lifetime even if the
# module is imported multiple times (e.g. during Vercel warm restarts).
_db_initialized = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run database initialisation exactly once on startup."""
    global _db_initialized
    if not _db_initialized:
        init_db()
        _db_initialized = True
    yield


app = FastAPI(title="BakeryOS API", lifespan=lifespan)
# Vercel handler alias.
handler = app

# Rate limiter — shared across routers via slowapi.
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[os.getenv("API_DEFAULT_RATE_LIMIT", "300/minute")],
    headers_enabled=True,
    key_style="url",
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


class ApiSecurityMiddleware(BaseHTTPMiddleware):
    """Apply baseline API abuse controls before route handlers run."""

    def __init__(self, app):
        super().__init__(app)
        self.window_seconds = int(os.getenv("API_RATE_LIMIT_WINDOW_SECONDS", "60"))
        self.read_limit = int(os.getenv("API_READ_RATE_LIMIT_PER_WINDOW", "300"))
        self.write_limit = int(os.getenv("API_WRITE_RATE_LIMIT_PER_WINDOW", "90"))
        self.auth_limit = int(os.getenv("API_AUTH_RATE_LIMIT_PER_WINDOW", "30"))
        self.max_body_bytes = int(os.getenv("MAX_REQUEST_BODY_BYTES", str(1024 * 1024)))
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def _client_key(self, request: Request) -> str:
        if os.getenv("TRUST_PROXY_HEADERS", "true").lower() == "true":
            forwarded_for = request.headers.get("x-forwarded-for")
            if forwarded_for:
                return forwarded_for.split(",", 1)[0].strip()
        return get_remote_address(request)

    def _limit_for(self, request: Request) -> int:
        if request.url.path.startswith("/api/auth"):
            return self.auth_limit
        if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
            return self.write_limit
        return self.read_limit

    def _prune(self, bucket: deque[float], now: float) -> None:
        cutoff = now - self.window_seconds
        while bucket and bucket[0] <= cutoff:
            bucket.popleft()

    async def dispatch(self, request: Request, call_next):
        if not request.url.path.startswith("/api/") or request.method == "OPTIONS":
            return await call_next(request)

        content_length = request.headers.get("content-length")
        try:
            body_size = int(content_length) if content_length else 0
        except ValueError:
            return JSONResponse(
                status_code=400,
                content={"detail": "Invalid Content-Length header"},
                headers={"Cache-Control": "no-store"},
            )
        if body_size > self.max_body_bytes:
            return JSONResponse(
                status_code=413,
                content={"detail": "Request body too large"},
                headers={"Cache-Control": "no-store"},
            )

        now = time.monotonic()
        limit = self._limit_for(request)
        key = f"{self._client_key(request)}:{request.method}:{request.url.path}"
        bucket = self._hits[key]
        self._prune(bucket, now)
        if len(bucket) >= limit:
            retry_after = max(1, int(self.window_seconds - (now - bucket[0])))
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests"},
                headers={"Retry-After": str(retry_after), "Cache-Control": "no-store"},
            )
        bucket.append(now)

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(max(0, limit - len(bucket)))
        response.headers["Cache-Control"] = "no-store"
        return response

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------

_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]
# Allow a production frontend domain to be injected via environment variable.
_extra_origin = os.getenv("CORS_ORIGIN")
if _extra_origin:
    _CORS_ORIGINS.append(_extra_origin)

_allowed_hosts = [
    host.strip()
    for host in os.getenv("ALLOWED_HOSTS", "").split(",")
    if host.strip()
]
if _allowed_hosts:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=_allowed_hosts)

app.add_middleware(ApiSecurityMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

# ---------------------------------------------------------------------------
# Security Headers Middleware (OWASP baseline)
# ---------------------------------------------------------------------------

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Inject standard OWASP security headers on every response."""
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        # Content-Security-Policy: allow same-origin and trusted CDNs only
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://accounts.google.com; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: https:; "
            "connect-src 'self';"
        )
        # Only set HSTS in production (when not running on localhost)
        if request.url.hostname and request.url.hostname not in ("localhost", "127.0.0.1"):
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

app.add_middleware(SecurityHeadersMiddleware)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

app.include_router(auth_router)
app.include_router(catalog_router)
app.include_router(finance_router)
app.include_router(integrations_router)
app.include_router(intelligence_router)
app.include_router(operations_router)
app.include_router(staff_router)
app.include_router(orders_router)
app.include_router(pos_router)
app.include_router(purchasing_router)
app.include_router(shift_logs_router)
app.include_router(customers_router)
app.include_router(currency_router)
app.include_router(semi_finished_router)
app.include_router(kitchen_router)

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "environment": os.getenv("VERCEL_ENV", "local")}

# ---------------------------------------------------------------------------
# Utility routes
# ---------------------------------------------------------------------------

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend", "dist")


@app.get("/api/init", dependencies=[Depends(requires_roles(["owner"]))])
async def force_init():
    """Re-run database initialisation (owner-only, useful after migrations)."""
    try:
        init_db()
        return {"status": "Database initialization successful", "version": "3.4"}
    except Exception as exc:
        return {"status": "Error", "message": str(exc)}


@app.get("/api/seed", dependencies=[Depends(requires_roles(["owner"]))])
async def seed_users(
    db: sqlalchemy.orm.Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Development helper: create a cashier sub-account with a random one-time password."""
    try:
        username = f"cashier-{current_user.id}"
        cashier = db.query(models.User).filter(
            models.User.username == username,
            models.User.parent_owner_id == current_user.id,
        ).first()
        if cashier:
            return {"message": f"Cashier '{username}' already exists. No changes made."}
        # Generate a cryptographically random password and return it once.
        # The owner must copy it immediately — it is not stored in plaintext.
        one_time_password = secrets.token_urlsafe(12)
        db.add(models.User(
            username=username,
            password=get_password_hash(one_time_password),
            role="cashier",
            parent_owner_id=current_user.id,
        ))
        db.commit()
        return {
            "message": "Cashier account created. Save this password — it will not be shown again.",
            "username": username,
            "password": one_time_password,
        }
    except Exception as exc:
        logger.error("Seed error: %s", exc)
        return {"status": "Error", "message": str(exc)}


# ---------------------------------------------------------------------------
# Frontend static file serving (production fallback)
# ---------------------------------------------------------------------------

@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    if full_path.startswith("api"):
        raise HTTPException(status_code=404)

    # 1. Serve real built assets when they exist.
    file_path = os.path.join(FRONTEND_DIR, full_path)
    if os.path.isfile(file_path):
        return FileResponse(file_path)

    # 2. Fall back to the React SPA so client-side routing works.
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(
            index_path,
            headers={"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"},
        )

    return {"message": "Frontend not built. Run 'npm run build' in frontend/."}


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
