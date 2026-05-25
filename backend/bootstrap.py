"""Database bootstrap helpers for BakeryOS."""

import logging
import os

from sqlalchemy import text

try:
    from . import models
    from .database import engine
except ImportError:
    import models
    from database import engine

logger = logging.getLogger(__name__)

VERCEL_ENV = os.getenv("VERCEL_ENV", "").lower()
ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()
IS_LOCAL_DEV = VERCEL_ENV in ("", "development") and ENVIRONMENT == "development"


def init_db() -> None:
    """Create tables and run lightweight schema self-healing on startup."""
    try:
        models.Base.metadata.create_all(bind=engine)
        ensure_runtime_schema()
        logger.info("SaaS Database: Tables confirmed.")
    except Exception as exc:
        logger.critical("DATABASE ERROR during init_db: %s", exc, exc_info=True)
        # In production, a DB failure at startup is fatal — surface it clearly.
        # On serverless platforms we log and continue so the handler can still
        # return a 503 rather than crashing the entire process.
        if ENVIRONMENT == "production":
            raise


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

            supp_columns = {row[1] for row in conn.execute(text("PRAGMA table_info(suppliers)"))}
            if "ice" not in supp_columns:
                conn.execute(text("ALTER TABLE suppliers ADD COLUMN ice VARCHAR"))
            if "email" not in supp_columns:
                conn.execute(text("ALTER TABLE suppliers ADD COLUMN email VARCHAR"))
            if "phone" not in supp_columns:
                conn.execute(text("ALTER TABLE suppliers ADD COLUMN phone VARCHAR"))

            exp_columns = {row[1] for row in conn.execute(text("PRAGMA table_info(expenses)"))}
            if "input_mode" not in exp_columns:
                conn.execute(text("ALTER TABLE expenses ADD COLUMN input_mode VARCHAR DEFAULT 'TTC'"))
                conn.execute(text("ALTER TABLE expenses ADD COLUMN amount_ht FLOAT DEFAULT 0.0"))
                conn.execute(text("ALTER TABLE expenses ADD COLUMN amount_ttc FLOAT DEFAULT 0.0"))
                conn.execute(text("ALTER TABLE expenses ADD COLUMN tva_rate FLOAT DEFAULT 0.0"))
                conn.execute(text("ALTER TABLE expenses ADD COLUMN tva_amount FLOAT DEFAULT 0.0"))
                conn.execute(text("ALTER TABLE expenses ADD COLUMN is_tva_deductible BOOLEAN DEFAULT 0"))
                conn.execute(text("ALTER TABLE expenses ADD COLUMN supplier_id INTEGER REFERENCES suppliers(id)"))
                conn.execute(text("ALTER TABLE expenses ADD COLUMN invoice_ref VARCHAR"))
                conn.execute(text("ALTER TABLE expenses ADD COLUMN status VARCHAR DEFAULT 'paid'"))
                conn.execute(text("ALTER TABLE expenses ADD COLUMN amount_paid FLOAT DEFAULT 0.0"))


            # Self-healing migration for system_settings composite primary key (key, owner_id)
            settings_pk_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(system_settings)")) if row[5] > 0]
            if len(settings_pk_cols) < 2:
                logger.warning("Migrating system_settings to composite primary key (key, owner_id)")
                try:
                    rows = conn.execute(text("SELECT key, owner_id, value FROM system_settings")).fetchall()
                except Exception:
                    rows = []

                conn.execute(text("DROP TABLE system_settings"))
                conn.execute(text("""
                    CREATE TABLE system_settings (
                        key VARCHAR NOT NULL,
                        owner_id INTEGER NOT NULL,
                        value VARCHAR,
                        PRIMARY KEY (key, owner_id)
                    )
                """))

                for key_val, owner_val, value_val in rows:
                    safe_owner = owner_val if owner_val else 1
                    conn.execute(
                        text("INSERT INTO system_settings (key, owner_id, value) VALUES (:key, :owner_id, :value)"),
                        {"key": key_val, "owner_id": safe_owner, "value": value_val}
                    )
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

            supp_columns = {row[0] for row in conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'suppliers'"))}
            if "ice" not in supp_columns:
                conn.execute(text("ALTER TABLE suppliers ADD COLUMN ice VARCHAR"))
            if "email" not in supp_columns:
                conn.execute(text("ALTER TABLE suppliers ADD COLUMN email VARCHAR"))
            if "phone" not in supp_columns:
                conn.execute(text("ALTER TABLE suppliers ADD COLUMN phone VARCHAR"))

            exp_columns = {row[0] for row in conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'expenses'"))}
            if "input_mode" not in exp_columns:
                conn.execute(text("ALTER TABLE expenses ADD COLUMN input_mode VARCHAR DEFAULT 'TTC'"))
                conn.execute(text("ALTER TABLE expenses ADD COLUMN amount_ht FLOAT DEFAULT 0.0"))
                conn.execute(text("ALTER TABLE expenses ADD COLUMN amount_ttc FLOAT DEFAULT 0.0"))
                conn.execute(text("ALTER TABLE expenses ADD COLUMN tva_rate FLOAT DEFAULT 0.0"))
                conn.execute(text("ALTER TABLE expenses ADD COLUMN tva_amount FLOAT DEFAULT 0.0"))
                conn.execute(text("ALTER TABLE expenses ADD COLUMN is_tva_deductible BOOLEAN DEFAULT FALSE"))
                conn.execute(text("ALTER TABLE expenses ADD COLUMN supplier_id INTEGER REFERENCES suppliers(id)"))
                conn.execute(text("ALTER TABLE expenses ADD COLUMN invoice_ref VARCHAR"))
                conn.execute(text("ALTER TABLE expenses ADD COLUMN status VARCHAR DEFAULT 'paid'"))
                conn.execute(text("ALTER TABLE expenses ADD COLUMN amount_paid FLOAT DEFAULT 0.0"))

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
