"""Authentication and authorization helpers for BakeryOS."""

import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Callable

import jwt
import sqlalchemy.orm
from fastapi import Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordBearer
from passlib.context import CryptContext

# Standalone scripts (or uvicorn pointing here) need to load .env
try:
    from dotenv import load_dotenv
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    load_dotenv(dotenv_path=env_path)
except ImportError:
    pass

try:
    from . import models
    from .database import get_db
except ImportError:
    import models
    from database import get_db

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Secret key — hard fail at startup if not set in production
# ---------------------------------------------------------------------------
SECRET_KEY = os.getenv("SECRET_KEY")
_ENV = os.getenv("VERCEL_ENV", os.getenv("ENVIRONMENT", "development")).lower()

if not SECRET_KEY:
    if _ENV in ("production", "preview"):
        raise RuntimeError(
            "SECRET_KEY environment variable is not set. "
            "Set it to a long random string before deploying."
        )
    # Development fallback — logs a loud warning so developers notice it
    SECRET_KEY = "bakeryos_dev_only_secret_do_not_use_in_production"
    logger.warning(
        "⚠️  SECRET_KEY is not set — using insecure development default. "
        "Set SECRET_KEY in your .env before going to production!"
    )

ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# Minimum password length for local accounts
MIN_PASSWORD_LENGTH = 8


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=24)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_download_token(username: str) -> str:
    """Create a short-lived (90 seconds) single-use download token.

    This avoids embedding the long-lived session JWT in report URLs where it
    would be visible in server logs, browser history, and Referrer headers.
    """
    expire = datetime.now(timezone.utc) + timedelta(seconds=90)
    payload = {"sub": username, "type": "download", "exp": expire, "jti": secrets.token_hex(8)}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(
    request: Request,
    db: sqlalchemy.orm.Session = Depends(get_db),
):
    # Accept ?token= query param for legacy report URLs only.
    # New code should pass tokens via the Authorization header exclusively.
    token = request.query_params.get("token")

    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        # Reject download-only tokens from hitting regular API endpoints, except for reports and receipts
        is_report = request.url.path.startswith("/api/reports")
        is_receipt = "/receipt" in request.url.path
        if payload.get("type") == "download" and not (is_report or is_receipt):
            raise HTTPException(status_code=401, detail="Download token cannot be used here")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def get_effective_owner_id(current_user: models.User = Depends(get_current_user)) -> int | None:
    if current_user.role == "owner":
        return current_user.id
    return current_user.parent_owner_id


def requires_roles(roles: list[str]) -> Callable:
    def role_checker(current_user: models.User = Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(
                status_code=403,
                detail=f"Role '{current_user.role}' is not authorized. Required: {roles}",
            )
        return current_user

    return role_checker
