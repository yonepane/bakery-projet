"""Main FastAPI application for BakeryOS.

This file owns app creation, middleware, router registration, and startup
lifecycle. Business logic lives in the routers/ and services/ packages.
"""

import logging
import os
import secrets
import sys
from contextlib import asynccontextmanager

import sqlalchemy.orm
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.middleware.base import BaseHTTPMiddleware

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
    from .routers.customers import router as customers_router


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
    from routers.customers import router as customers_router




# ---------------------------------------------------------------------------
# App lifecycle
# ---------------------------------------------------------------------------

# Vercel can receive a request before the normal startup hook fires.
# Call init_db() at module load time as well so tables always exist.
init_db()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run database initialisation once on startup."""
    init_db()
    yield


app = FastAPI(title="BakeryOS API", lifespan=lifespan)
# Vercel handler alias.
handler = app

# Rate limiter — shared across routers via slowapi
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

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
