"""Database bootstrap helpers for BakeryOS."""

import os

from sqlalchemy import text

try:
    from . import models
    from .database import engine
except ImportError:
    import models
    from database import engine

VERCEL_ENV = os.getenv("VERCEL_ENV", "").lower()
ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()
IS_LOCAL_DEV = VERCEL_ENV in ("", "development") and ENVIRONMENT == "development"


def init_db() -> None:
    """Create tables and run lightweight schema self-healing on startup."""
    try:
        models.Base.metadata.create_all(bind=engine)
        ensure_runtime_schema()
        print("SaaS Database: Tables confirmed.")
    except Exception as exc:
        print(f"DATABASE ERROR during init_db: {exc}")
        # On serverless platforms, we don't want a startup error to kill the entire handler.
        # Specific routes will fail later if the DB is truly unreachable.
        pass


def ensure_runtime_schema() -> None:
    """Patch older databases that may still be missing newer PO fields."""
    with engine.begin() as conn:
        if engine.dialect.name == "sqlite":
            po_columns = {row[1] for row in conn.execute(text("PRAGMA table_info(purchase_orders)"))}
            if "notes" not in po_columns:
                conn.execute(text("ALTER TABLE purchase_orders ADD COLUMN notes VARCHAR"))
            if "expected_delivery_date" not in po_columns:
                conn.execute(text("ALTER TABLE purchase_orders ADD COLUMN expected_delivery_date DATETIME"))
            if "archived" not in po_columns:
                conn.execute(text("ALTER TABLE purchase_orders ADD COLUMN archived BOOLEAN DEFAULT 0"))
            return

        if engine.dialect.name == "postgresql":
            po_columns = {
                row[0]
                for row in conn.execute(
                    text(
                        """
                        SELECT column_name
                        FROM information_schema.columns
                        WHERE table_name = 'purchase_orders'
                        """
                    )
                )
            }
            if "notes" not in po_columns:
                conn.execute(text("ALTER TABLE purchase_orders ADD COLUMN notes VARCHAR"))
            if "expected_delivery_date" not in po_columns:
                conn.execute(text("ALTER TABLE purchase_orders ADD COLUMN expected_delivery_date TIMESTAMP"))
            if "archived" not in po_columns:
                conn.execute(text("ALTER TABLE purchase_orders ADD COLUMN archived BOOLEAN DEFAULT FALSE"))

            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS shift_records (
                        id SERIAL PRIMARY KEY,
                        owner_id INTEGER REFERENCES users(id),
                        start_time TIMESTAMP,
                        end_time TIMESTAMP,
                        revenue FLOAT,
                        cost FLOAT
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS shift_logs (
                        id SERIAL PRIMARY KEY,
                        owner_id INTEGER REFERENCES users(id),
                        timestamp TIMESTAMP,
                        author VARCHAR,
                        content VARCHAR
                    )
                    """
                )
            )
