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


def ensure_stock_location_lot_tables(conn, *, serial_primary_key: str, datetime_type: str, false_value: str, true_value: str) -> None:
    """Create additive physical-stock tables for older runtime databases."""
    conn.execute(text(f"""
        CREATE TABLE IF NOT EXISTS stock_locations (
            id {serial_primary_key},
            owner_id INTEGER REFERENCES users(id),
            name VARCHAR,
            type VARCHAR,
            branch_name VARCHAR,
            is_default BOOLEAN DEFAULT {false_value},
            is_active BOOLEAN DEFAULT {true_value},
            created_at {datetime_type},
            CONSTRAINT uq_stock_locations_owner_name UNIQUE (owner_id, name)
        )
    """))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_locations_owner_id ON stock_locations (owner_id)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_locations_name ON stock_locations (name)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_locations_type ON stock_locations (type)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_locations_is_active ON stock_locations (is_active)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_locations_created_at ON stock_locations (created_at)"))

    conn.execute(text(f"""
        CREATE TABLE IF NOT EXISTS stock_lots (
            id {serial_primary_key},
            owner_id INTEGER REFERENCES users(id),
            item_type VARCHAR,
            item_id VARCHAR,
            item_name_snapshot VARCHAR,
            lot_code VARCHAR,
            supplier_lot_code VARCHAR,
            internal_batch_code VARCHAR,
            source_type VARCHAR,
            source_id VARCHAR,
            received_at {datetime_type},
            produced_at {datetime_type},
            expires_at {datetime_type},
            unit_snapshot VARCHAR,
            unit_cost_snapshot FLOAT,
            status VARCHAR DEFAULT 'active',
            created_at {datetime_type},
            CONSTRAINT uq_stock_lots_owner_item_lot UNIQUE (owner_id, item_type, item_id, lot_code)
        )
    """))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_lots_owner_id ON stock_lots (owner_id)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_lots_item_type ON stock_lots (item_type)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_lots_item_id ON stock_lots (item_id)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_lots_lot_code ON stock_lots (lot_code)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_lots_supplier_lot_code ON stock_lots (supplier_lot_code)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_lots_internal_batch_code ON stock_lots (internal_batch_code)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_lots_source_type ON stock_lots (source_type)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_lots_source_id ON stock_lots (source_id)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_lots_received_at ON stock_lots (received_at)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_lots_produced_at ON stock_lots (produced_at)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_lots_expires_at ON stock_lots (expires_at)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_lots_status ON stock_lots (status)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_lots_created_at ON stock_lots (created_at)"))

    conn.execute(text(f"""
        CREATE TABLE IF NOT EXISTS stock_lot_balances (
            id {serial_primary_key},
            owner_id INTEGER REFERENCES users(id),
            lot_id INTEGER REFERENCES stock_lots(id),
            location_id INTEGER REFERENCES stock_locations(id),
            quantity FLOAT DEFAULT 0,
            reserved_quantity FLOAT DEFAULT 0,
            updated_at {datetime_type},
            CONSTRAINT uq_stock_lot_balances_owner_lot_location UNIQUE (owner_id, lot_id, location_id),
            CONSTRAINT ck_stock_lot_balances_quantity_non_negative CHECK (quantity >= 0),
            CONSTRAINT ck_stock_lot_balances_reserved_non_negative CHECK (reserved_quantity >= 0),
            CONSTRAINT ck_stock_lot_balances_reserved_lte_quantity CHECK (reserved_quantity <= quantity)
        )
    """))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_lot_balances_owner_id ON stock_lot_balances (owner_id)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_lot_balances_lot_id ON stock_lot_balances (lot_id)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_lot_balances_location_id ON stock_lot_balances (location_id)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_lot_balances_updated_at ON stock_lot_balances (updated_at)"))


def ensure_stock_movement_context_columns(conn, *, dialect_name: str, datetime_type: str) -> None:
    """Add lot/location context columns to older stock_movements tables."""
    if dialect_name == "sqlite":
        columns = {row[1] for row in conn.execute(text("PRAGMA table_info(stock_movements)"))}
        add_column = lambda name, definition: conn.execute(text(f"ALTER TABLE stock_movements ADD COLUMN {name} {definition}"))
    else:
        columns = {
            row[0]
            for row in conn.execute(
                text(
                    """
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_name = 'stock_movements'
                    """
                )
            )
        }
        add_column = lambda name, definition: conn.execute(text(f"ALTER TABLE stock_movements ADD COLUMN {name} {definition}"))

    additions = {
        "location_id": "INTEGER",
        "location_name_snapshot": "VARCHAR",
        "lot_id": "INTEGER",
        "lot_code_snapshot": "VARCHAR",
        "expires_at": datetime_type,
        "unit_cost_snapshot": "FLOAT",
        "correlation_id": "VARCHAR",
    }
    for column, definition in additions.items():
        if column not in columns:
            add_column(column, definition)

    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_movements_location_id ON stock_movements (location_id)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_movements_lot_id ON stock_movements (lot_id)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_movements_expires_at ON stock_movements (expires_at)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_movements_correlation_id ON stock_movements (correlation_id)"))


def ensure_semi_finished_schema(conn, *, dialect_name: str, serial_primary_key: str, datetime_type: str, true_value: str) -> None:
    """Create semi-finished tables and patch recipe item references."""
    if dialect_name == "sqlite":
        recipe_columns = {row[1] for row in conn.execute(text("PRAGMA table_info(recipe_items)"))}
    else:
        recipe_columns = {
            row[0]
            for row in conn.execute(
                text(
                    """
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_name = 'recipe_items'
                    """
                )
            )
        }
    if "semi_finished_id" not in recipe_columns:
        conn.execute(text("ALTER TABLE recipe_items ADD COLUMN semi_finished_id INTEGER"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_recipe_items_semi_finished_id ON recipe_items (semi_finished_id)"))

    conn.execute(text(f"""
        CREATE TABLE IF NOT EXISTS semi_finished_items (
            id {serial_primary_key},
            owner_id INTEGER REFERENCES users(id),
            name VARCHAR,
            unit VARCHAR,
            stock FLOAT DEFAULT 0.0,
            cost FLOAT DEFAULT 0.0,
            min_threshold FLOAT DEFAULT 0.0,
            shelf_life_hours INTEGER,
            allergens JSON,
            is_active BOOLEAN DEFAULT {true_value},
            created_at {datetime_type}
        )
    """))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_semi_finished_items_owner_id ON semi_finished_items (owner_id)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_semi_finished_items_name ON semi_finished_items (name)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_semi_finished_items_id ON semi_finished_items (id)"))

    conn.execute(text(f"""
        CREATE TABLE IF NOT EXISTS semi_finished_recipe_items (
            id {serial_primary_key},
            semi_finished_id INTEGER REFERENCES semi_finished_items(id),
            ingredient_id INTEGER REFERENCES ingredients(id),
            quantity FLOAT
        )
    """))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_semi_finished_recipe_items_id ON semi_finished_recipe_items (id)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_semi_finished_recipe_items_semi_finished_id ON semi_finished_recipe_items (semi_finished_id)"))


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

            tx_columns = {row[1] for row in conn.execute(text("PRAGMA table_info(transactions)"))}
            if "status" not in tx_columns:
                conn.execute(text("ALTER TABLE transactions ADD COLUMN status VARCHAR DEFAULT 'completed'"))

            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS stock_movements (
                    id INTEGER PRIMARY KEY,
                    owner_id INTEGER REFERENCES users(id),
                    item_type VARCHAR,
                    item_id VARCHAR,
                    item_name_snapshot VARCHAR,
                    quantity_delta FLOAT,
                    unit_snapshot VARCHAR,
                    movement_type VARCHAR,
                    source_type VARCHAR,
                    source_id VARCHAR,
                    reason VARCHAR,
                    before_qty FLOAT,
                    after_qty FLOAT,
                    created_at DATETIME,
                    created_by_user_id INTEGER REFERENCES users(id),
                    client_mutation_id VARCHAR,
                    location_id INTEGER,
                    location_name_snapshot VARCHAR,
                    lot_id INTEGER,
                    lot_code_snapshot VARCHAR,
                    expires_at DATETIME,
                    unit_cost_snapshot FLOAT,
                    correlation_id VARCHAR
                )
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_movements_owner_id ON stock_movements (owner_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_movements_item_type ON stock_movements (item_type)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_movements_item_id ON stock_movements (item_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_movements_movement_type ON stock_movements (movement_type)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_movements_source_type ON stock_movements (source_type)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_movements_source_id ON stock_movements (source_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_movements_created_at ON stock_movements (created_at)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_movements_created_by_user_id ON stock_movements (created_by_user_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_movements_client_mutation_id ON stock_movements (client_mutation_id)"))
            ensure_stock_location_lot_tables(
                conn,
                serial_primary_key="INTEGER PRIMARY KEY",
                datetime_type="DATETIME",
                false_value="0",
                true_value="1",
            )
            ensure_stock_movement_context_columns(conn, dialect_name="sqlite", datetime_type="DATETIME")
            ensure_semi_finished_schema(
                conn,
                dialect_name="sqlite",
                serial_primary_key="INTEGER PRIMARY KEY",
                datetime_type="DATETIME",
                true_value="1",
            )

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

            tx_columns = {row[0] for row in conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'transactions'"))}
            if "status" not in tx_columns:
                conn.execute(text("ALTER TABLE transactions ADD COLUMN status VARCHAR DEFAULT 'completed'"))

            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS stock_movements (
                        id SERIAL PRIMARY KEY,
                        owner_id INTEGER REFERENCES users(id),
                        item_type VARCHAR,
                        item_id VARCHAR,
                        item_name_snapshot VARCHAR,
                        quantity_delta FLOAT,
                        unit_snapshot VARCHAR,
                        movement_type VARCHAR,
                        source_type VARCHAR,
                        source_id VARCHAR,
                        reason VARCHAR,
                        before_qty FLOAT,
                        after_qty FLOAT,
                        created_at TIMESTAMP,
                        created_by_user_id INTEGER REFERENCES users(id),
                        client_mutation_id VARCHAR,
                        location_id INTEGER,
                        location_name_snapshot VARCHAR,
                        lot_id INTEGER,
                        lot_code_snapshot VARCHAR,
                        expires_at TIMESTAMP,
                        unit_cost_snapshot FLOAT,
                        correlation_id VARCHAR
                    )
                    """
                )
            )
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_movements_owner_id ON stock_movements (owner_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_movements_item_type ON stock_movements (item_type)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_movements_item_id ON stock_movements (item_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_movements_movement_type ON stock_movements (movement_type)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_movements_source_type ON stock_movements (source_type)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_movements_source_id ON stock_movements (source_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_movements_created_at ON stock_movements (created_at)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_movements_created_by_user_id ON stock_movements (created_by_user_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_movements_client_mutation_id ON stock_movements (client_mutation_id)"))
            ensure_stock_location_lot_tables(
                conn,
                serial_primary_key="SERIAL PRIMARY KEY",
                datetime_type="TIMESTAMP",
                false_value="FALSE",
                true_value="TRUE",
            )
            ensure_stock_movement_context_columns(conn, dialect_name="postgresql", datetime_type="TIMESTAMP")
            ensure_semi_finished_schema(
                conn,
                dialect_name="postgresql",
                serial_primary_key="SERIAL PRIMARY KEY",
                datetime_type="TIMESTAMP",
                true_value="TRUE",
            )

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
