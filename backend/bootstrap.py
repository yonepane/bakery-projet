"""Database bootstrap helpers for BakeryOS.

Alembic is the single source of truth for schema evolution. On startup,
`init_db()` brings the database to the latest migration head. Every
schema change from now on must ship as an Alembic migration
(`alembic revision --autogenerate -m "..."`, reviewed, then committed) --
there is no longer a parallel hand-written patch mechanism to fall back
on, and `tests/test_migrations.py` fails the build if a model change
isn't backed by one.

Databases that were created before this switch (via the old
`create_all()` + `ensure_runtime_schema()` approach) are handled by the
one-time adoption path below: see `_PRE_ALEMBIC_ADOPTION_REVISION`.
"""

import logging
import os

import sqlalchemy
from alembic import command
from alembic.config import Config

try:
    from .database import engine
except ImportError:
    from database import engine

logger = logging.getLogger(__name__)

VERCEL_ENV = os.getenv("VERCEL_ENV", "").lower()
ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()
IS_LOCAL_DEV = VERCEL_ENV in ("", "development") and ENVIRONMENT == "development"

# The migration head immediately before this project switched from
# create_all() + hand-written runtime patches (bootstrap.py's old
# ensure_runtime_schema() and friends) to Alembic as the sole source of
# truth. Every database that predates this switch was, in practice,
# brought to exactly this state by that old mechanism -- with the sole
# exception of the specific gaps that mechanism never caught, which are
# exactly what the two migrations after this revision backfill/repair.
#
# A database with application tables (e.g. `users`) but no
# `alembic_version` table predates the switch and needs to be "adopted":
# stamped at this revision so Alembic knows migrations up to this point
# already effectively happened, before running the normal upgrade.
_PRE_ALEMBIC_ADOPTION_REVISION = "c61cf028c5b2"

_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
_ALEMBIC_INI_PATH = os.path.join(_BACKEND_DIR, "alembic.ini")


def _alembic_config() -> Config:
    return Config(_ALEMBIC_INI_PATH)


def _is_unadopted_legacy_database() -> bool:
    """True if this database has app tables but no Alembic tracking yet.

    `users` is used as the marker table: every real deployment has it,
    and it has existed since the very first migration, so its presence
    without a corresponding `alembic_version` table reliably means "this
    database was bootstrapped the old way and has never run `alembic
    upgrade`" rather than "this is a genuinely brand-new, empty database".
    """
    inspector = sqlalchemy.inspect(engine)
    table_names = set(inspector.get_table_names())
    return "users" in table_names and "alembic_version" not in table_names


def init_db() -> None:
    """Bring the database schema to the Alembic head.

    Adopts pre-Alembic (bootstrap-created) databases automatically on
    first run by stamping them at the revision that matches where the
    old create_all() + patch mechanism had consistently left them, then
    upgrades normally from there.
    """
    try:
        cfg = _alembic_config()
        if _is_unadopted_legacy_database():
            logger.warning(
                "Database has application tables but no Alembic history — "
                "adopting it by stamping revision %s before upgrading.",
                _PRE_ALEMBIC_ADOPTION_REVISION,
            )
            command.stamp(cfg, _PRE_ALEMBIC_ADOPTION_REVISION)
        command.upgrade(cfg, "head")
        logger.info("Database schema is at head.")
    except Exception as exc:
        logger.critical("DATABASE ERROR during init_db: %s", exc, exc_info=True)
        # In production, a DB failure at startup is fatal — surface it clearly.
        # On serverless platforms we log and continue so the handler can still
        # return a 503 rather than crashing the entire process.
        if ENVIRONMENT == "production":
            raise
