"""Authentication routes for BakeryOS."""

import os

import sqlalchemy.orm
from fastapi import APIRouter, Depends, HTTPException, Request
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from slowapi import Limiter
from slowapi.util import get_remote_address

try:
    from .. import models
    from ..auth import create_access_token, get_password_hash, verify_password
    from ..database import get_db
    from ..schemas import GoogleLoginRequest, LoginRequest, Token
except ImportError:
    import models
    from auth import create_access_token, get_password_hash, verify_password
    from database import get_db
    from schemas import GoogleLoginRequest, LoginRequest, Token

router = APIRouter()

# Re-use the same limiter key function — the limiter itself is registered on
# the app in main.py; here we just need the decorator factory.
limiter = Limiter(key_func=get_remote_address)

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")


@router.post("/api/auth/google")
@limiter.limit("10/minute")
async def google_login(request: Request, req: GoogleLoginRequest, db: sqlalchemy.orm.Session = Depends(get_db)):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google OAuth is not configured on this server")
    try:
        idinfo = id_token.verify_oauth2_token(req.credential, google_requests.Request(), GOOGLE_CLIENT_ID)
        email = idinfo["email"]

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
    except Exception as exc:
        print(f"Google Auth Error: {exc}")
        raise HTTPException(status_code=400, detail="Google authentication failed")


@router.post("/api/auth/signup")
@limiter.limit("5/minute")
async def signup(request: Request, req: LoginRequest, db: sqlalchemy.orm.Session = Depends(get_db)):
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
@limiter.limit("5/minute")
async def login(request: Request, req: LoginRequest, db: sqlalchemy.orm.Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == req.username).first()
    if not user or not verify_password(req.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    access_token = create_access_token(data={"sub": user.username})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "username": user.username,
        "role": user.role,
    }
