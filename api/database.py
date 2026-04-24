"""Set up the database connection for the Vercel API package."""

import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

# Use the same default database rule as the main backend:
# prefer DATABASE_URL, otherwise fall back to the local SQLite file.
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./bakeryos.db")

# Fix old-style Postgres URLs so SQLAlchemy can read them.
if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Add SSL automatically for hosted Postgres when the URL does not already
# mention it.
if SQLALCHEMY_DATABASE_URL.startswith("postgresql://") and "sslmode" not in SQLALCHEMY_DATABASE_URL:
    SQLALCHEMY_DATABASE_URL += ("&" if "?" in SQLALCHEMY_DATABASE_URL else "?") + "sslmode=require"

# SQLite and hosted PostgreSQL need different connection settings.
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )
else:
    # In serverless environments, reusing old pooled connections can cause
    # problems, so this setup avoids that.
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        poolclass=NullPool,
        connect_args={
            "connect_timeout": 10,
            "application_name": "BakeryOS_SaaS",
            "options": "-c search_path=public"
        }
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """Give one database session to one request, then close it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
