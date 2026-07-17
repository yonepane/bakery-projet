"""Tests that the Alembic migration history is the single source of truth
for the database schema.

These tests are independent of the main `client`/`db_session` fixtures in
conftest.py (which build their schema via a fast, direct `create_all()`
against a shared in-memory database for speed). Verifying the actual
migration path requires driving `alembic` as a genuinely separate
process for each check: `database.py` computes its connection string
once at import time from `DATABASE_URL`, and by the time these tests
run, something in the pytest session has almost certainly already
imported it -- so mutating `os.environ` in-process and re-invoking
Alembic's Python API would silently keep targeting whatever database
was resolved on that first import, not the throwaway one these tests
intend to use. A subprocess with its own environment sidesteps that
entirely, and is also a more faithful simulation of how `alembic
upgrade head` actually gets invoked in practice (a fresh process, once,
at startup).
"""

import os
import subprocess
import sys
import tempfile

import sqlalchemy
from alembic.autogenerate import compare_metadata
from alembic.runtime.migration import MigrationContext

import models

_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _run_alembic_upgrade_head(db_path: str) -> None:
    """Run `alembic upgrade head` as an isolated subprocess against the
    given sqlite file, with its own DATABASE_URL."""
    env = dict(os.environ)
    env["DATABASE_URL"] = f"sqlite:///{db_path}"
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=_BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 0, (
        f"alembic upgrade head failed (exit {result.returncode}).\n"
        f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )


def test_migrating_from_scratch_reaches_head_cleanly():
    """`alembic upgrade head` must succeed against a brand-new database,
    with no manual intervention (no create_all(), no hand-written
    patches) -- this is the "fresh install" path."""
    with tempfile.TemporaryDirectory() as tmp:
        db_path = os.path.join(tmp, "fresh.db")
        _run_alembic_upgrade_head(db_path)

        engine = sqlalchemy.create_engine(f"sqlite:///{db_path}")
        with engine.connect() as conn:
            inspector = sqlalchemy.inspect(conn)
            assert "users" in inspector.get_table_names()
            version = conn.execute(
                sqlalchemy.text("SELECT version_num FROM alembic_version")
            ).scalar()
        engine.dispose()
        assert version is not None


def test_schema_at_head_matches_current_models():
    """The schema produced by running every migration must match
    `models.py` exactly, with no drift.

    This is the guard against the exact failure mode that motivated
    switching to Alembic as the sole source of truth: a model changed
    (a column, an index, a table) without a migration to back it up.
    If this test fails, it means someone edited models.py and needs to
    run `alembic revision --autogenerate -m "..."` from backend/, review
    the generated migration, and commit it alongside the model change.
    """
    with tempfile.TemporaryDirectory() as tmp:
        db_path = os.path.join(tmp, "head.db")
        _run_alembic_upgrade_head(db_path)

        engine = sqlalchemy.create_engine(f"sqlite:///{db_path}")
        with engine.connect() as conn:
            migration_context = MigrationContext.configure(conn)
            diffs = compare_metadata(migration_context, models.Base.metadata)
        engine.dispose()

        assert diffs == [], (
            "Migration history does not match models.py. Run "
            "`alembic revision --autogenerate -m \"...\"` from backend/, "
            "review the generated migration, and commit it.\n"
            f"Detected diffs:\n{diffs}"
        )


def test_upgrade_is_idempotent():
    """Running `alembic upgrade head` twice in a row must be a safe
    no-op the second time (every operation in every migration must be
    guarded/idempotent where the migration could plausibly run against a
    database that already has some of its target state)."""
    with tempfile.TemporaryDirectory() as tmp:
        db_path = os.path.join(tmp, "idempotent.db")
        _run_alembic_upgrade_head(db_path)
        _run_alembic_upgrade_head(db_path)  # must not raise

        engine = sqlalchemy.create_engine(f"sqlite:///{db_path}")
        with engine.connect() as conn:
            version = conn.execute(
                sqlalchemy.text("SELECT version_num FROM alembic_version")
            ).scalar()
        engine.dispose()
        assert version is not None
