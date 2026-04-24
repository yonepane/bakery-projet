"""Set up the database connection for BakeryOS.

This file decides which database to use and creates the shared SQLAlchemy
objects that the rest of the backend imports.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

# If the app is deployed with a DATABASE_URL, use that database.
# If not, use a simple local SQLite file for development.
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./bakeryos.db")

# Some hosting services still give URLs that start with `postgres://`.
# SQLAlchemy expects `postgresql://`, so we fix that here one time.
if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Many hosted PostgreSQL databases require SSL.
# If the URL does not already mention SSL, add it automatically.
if SQLALCHEMY_DATABASE_URL.startswith("postgresql://") and "sslmode" not in SQLALCHEMY_DATABASE_URL:
    if "?" in SQLALCHEMY_DATABASE_URL:
        SQLALCHEMY_DATABASE_URL += "&sslmode=require"
    else:
        SQLALCHEMY_DATABASE_URL += "?sslmode=require"

# SQLite needs a special option here because the FastAPI app may handle
# requests from different threads during development.
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )
else:
    # In serverless or short-lived environments, it is safer not to keep a
    # pool of old database connections around.
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        poolclass=NullPool,
        pool_pre_ping=True,
        connect_args={"connect_timeout": 10},
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """Give one database session to one request, then close it afterward."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
