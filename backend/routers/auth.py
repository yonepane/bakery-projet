"""Authentication routes for BakeryOS."""

import logging
import os
import time
from collections import defaultdict
from threading import Lock

import sqlalchemy.orm
from fastapi import APIRouter, Depends, HTTPException, Request
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from slowapi import Limiter
from slowapi.util import get_remote_address

try:
    from .. import models
    from ..auth import (
        MIN_PASSWORD_LENGTH,
        create_access_token,
        create_download_token,
        get_current_user,
        get_password_hash,
        verify_password,
    )
    from ..database import get_db
    from ..schemas import GoogleLoginRequest, LoginRequest, Token
except ImportError:
    import models
    from auth import (
        MIN_PASSWORD_LENGTH,
        create_access_token,
        create_download_token,
        get_current_user,
        get_password_hash,
        verify_password,
    )
    from database import get_db
    from schemas import GoogleLoginRequest, LoginRequest, Token

logger = logging.getLogger(__name__)
router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")

# ---------------------------------------------------------------------------
# Brute-force lockout (per username)
# ---------------------------------------------------------------------------
# After MAX_ATTEMPTS consecutive failures the account is locked for
# LOCKOUT_SECONDS. A successful login resets the counter immediately.

MAX_ATTEMPTS   = 7
LOCKOUT_SECONDS = 15 * 60  # 15 minutes

# { username_lower: {"count": int, "locked_until": float | None} }
_login_attempts: dict = defaultdict(lambda: {"count": 0, "locked_until": None})
_lock = Lock()


def _check_lockout(username: str) -> None:
    """Raise 429 if the account is currently locked out."""
    key = username.lower()
    with _lock:
        record = _login_attempts[key]
        locked_until = record["locked_until"]
        if locked_until and time.time() < locked_until:
            remaining = int(locked_until - time.time())
            raise HTTPException(
                status_code=429,
                detail=(
                    f"Account temporarily locked after {MAX_ATTEMPTS} failed attempts. "
                    f"Try again in {remaining // 60}m {remaining % 60}s."
                ),
                headers={"Retry-After": str(remaining)},
            )
        # Lock has expired — reset so the user gets a fresh window
        if locked_until and time.time() >= locked_until:
            _login_attempts[key] = {"count": 0, "locked_until": None}


def _record_failure(username: str) -> None:
    """Increment failure counter; lock the account if MAX_ATTEMPTS reached."""
    key = username.lower()
    with _lock:
        record = _login_attempts[key]
        record["count"] += 1
        if record["count"] >= MAX_ATTEMPTS:
            record["locked_until"] = time.time() + LOCKOUT_SECONDS
            logger.warning(
                "🔒 Account '%s' locked after %d failed login attempts.",
                username, record["count"],
            )


def _reset_counter(username: str) -> None:
    """Clear the failure counter on a successful login."""
    key = username.lower()
    with _lock:
        _login_attempts[key] = {"count": 0, "locked_until": None}


# Optional: comma-separated list of allowed Google email domains.
# Leave empty to allow any verified Google account (open registration).
# Example env: ALLOWED_GOOGLE_DOMAINS=mycompany.com,mybakery.fr
_raw_domains = os.getenv("ALLOWED_GOOGLE_DOMAINS", "")
ALLOWED_GOOGLE_DOMAINS: set[str] = (
    {d.strip().lower() for d in _raw_domains.split(",") if d.strip()}
    if _raw_domains
    else set()
)


@router.post("/api/auth/google")
@limiter.limit("10/minute")
async def google_login(
    request: Request,
    req: GoogleLoginRequest,
    db: sqlalchemy.orm.Session = Depends(get_db),
):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google OAuth is not configured on this server")
    try:
        idinfo = id_token.verify_oauth2_token(req.credential, google_requests.Request(), GOOGLE_CLIENT_ID)
        email: str = idinfo["email"]

        # Enforce domain allowlist when configured
        if ALLOWED_GOOGLE_DOMAINS:
            domain = email.split("@")[-1].lower()
            if domain not in ALLOWED_GOOGLE_DOMAINS:
                logger.warning("Google login rejected for domain: %s", domain)
                raise HTTPException(
                    status_code=403,
                    detail="Your Google account domain is not permitted to register.",
                )

        user = db.query(models.User).filter(models.User.username == email).first()
        if not user:
            user = models.User(
                username=email,
                password=get_password_hash("google_oauth_protected"),
                role="owner",
                parent_owner_id=None,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        elif user.role != "owner":
            user.role = "owner"
            db.commit()

        access_token = create_access_token(data={"sub": user.username})
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "username": user.username,
            "role": user.role,
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Google Auth Error: %s", exc)
        raise HTTPException(status_code=400, detail="Google authentication failed")


@router.post("/api/auth/signup")
@limiter.limit("5/minute")
async def signup(
    request: Request,
    req: LoginRequest,
    db: sqlalchemy.orm.Session = Depends(get_db),
):
    # Enforce minimum password length
    if len(req.password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Password must be at least {MIN_PASSWORD_LENGTH} characters long.",
        )

    existing = db.query(models.User).filter(models.User.username == req.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")

    new_user = models.User(
        username=req.username,
        password=get_password_hash(req.password),
        role="owner",
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {"message": "Bakery registered successfully. You can now log in."}


@router.post("/api/auth/login", response_model=Token)
@limiter.limit("20/minute")  # IP-level guard — second layer after per-user lockout
async def login(
    request: Request,
    req: LoginRequest,
    db: sqlalchemy.orm.Session = Depends(get_db),
):
    # 1. Check if this username is currently locked out BEFORE hitting the DB.
    _check_lockout(req.username)

    user = db.query(models.User).filter(models.User.username == req.username).first()
    if not user or not verify_password(req.password, user.password):
        # Record the failure regardless of whether the user exists
        # (avoids leaking which usernames are registered).
        _record_failure(req.username)
        attempts_left = MAX_ATTEMPTS - _login_attempts[req.username.lower()]["count"]
        if attempts_left > 0:
            raise HTTPException(
                status_code=401,
                detail=f"Invalid username or password. {attempts_left} attempt(s) remaining before lockout.",
            )
        # Counter just hit MAX_ATTEMPTS — lockout was applied inside _record_failure.
        raise HTTPException(
            status_code=429,
            detail=f"Account locked after {MAX_ATTEMPTS} failed attempts. Try again in {LOCKOUT_SECONDS // 60} minutes.",
        )

    # 2. Successful login — reset the failure counter.
    _reset_counter(req.username)

    access_token = create_access_token(data={"sub": user.username})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "username": user.username,
        "role": user.role,
    }


@router.get("/api/auth/download-token")
async def get_download_token(
    current_user: models.User = Depends(get_current_user),
):
    """Return a short-lived (90s) download token for opening report URLs.

    The frontend calls this first, then appends the returned token as
    ?token=<download_token> to report/PDF/Excel URLs. This keeps the
    long-lived session JWT out of server logs and browser history.
    """
    return {"download_token": create_download_token(current_user.username)}
