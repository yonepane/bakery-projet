"""repair system_settings composite primary key for bootstrap-adopted databases

Revision ID: b7eb10446c94
Revises: 956c47e25da4
Create Date: 2026-07-15 20:21:17.234589

Context
-------
`models.SystemSetting` has always defined `(key, owner_id)` as a composite
primary key -- each owner needs their own independent value for a given
settings key (see routers/currency.py, routers/finance.py,
services/operations.py, all of which query/write scoped by both columns
together). However, migration 00000 (the very first migration in this
project's history) created the table with only `key` as the primary key,
and no later migration ever corrected this.

On any database that only ever went through the normal migration chain,
this bug has been silently present the whole time: a second owner writing
a settings key already used by a different owner hits a primary-key
collision (`IntegrityError`) at the database level.

`bootstrap.py`'s old `ensure_runtime_schema()` self-healing had a SQLite-only
manual fix for this (drop table, recreate, reinsert rows) that ran on every
app startup. This migration replaces it with a single, guarded, one-time,
dialect-aware fix, and additionally covers PostgreSQL, which the old
self-healing code never did.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7eb10446c94'
down_revision: Union[str, Sequence[str], None] = '956c47e25da4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_DESIRED_PK_COLUMNS = ["key", "owner_id"]


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    pk_constraint = inspector.get_pk_constraint("system_settings")
    current_pk_columns = set(pk_constraint.get("constrained_columns") or [])

    if current_pk_columns == set(_DESIRED_PK_COLUMNS):
        # Already correct -- either a fresh install where 00000 is fixed
        # going forward, or a bootstrap-adopted database where the old
        # ensure_runtime_schema() self-heal already ran successfully
        # before this migration existed. Nothing to do.
        return

    if bind.dialect.name == "sqlite":
        # SQLite cannot ALTER a primary key directly. Batch mode's
        # "recreate table" strategy handles this safely: it builds a new
        # table with the desired schema, copies every existing row across
        # unchanged, drops the old table, and renames the new one into
        # place -- no manual DROP/reinsert dance, no risk of forgetting a
        # column along the way.
        with op.batch_alter_table("system_settings", schema=None) as batch_op:
            batch_op.create_primary_key("pk_system_settings", _DESIRED_PK_COLUMNS)
    else:
        # PostgreSQL (and similar) support altering the constraint directly
        # -- no table recreation needed, existing rows are untouched.
        existing_pk_name = pk_constraint.get("name")
        if existing_pk_name:
            op.drop_constraint(existing_pk_name, "system_settings", type_="primary")
        op.create_primary_key("pk_system_settings", "system_settings", _DESIRED_PK_COLUMNS)


def downgrade() -> None:
    """Downgrade schema.

    Deliberately unsupported. Reverting to a single-column primary key on
    `key` is only possible if every key is unique across all owners --
    which defeats the entire purpose of this fix and would silently
    require deleting or merging rows to even attempt. Rather than guess,
    this raises so a human makes an explicit, informed decision.
    """
    raise NotImplementedError(
        "Downgrading the system_settings composite primary key is not "
        "supported automatically: it would require deleting or merging "
        "rows to re-enforce single-column uniqueness on `key`. If you "
        "need to revert, do so manually after deciding how to handle any "
        "rows that now share a `key` across different `owner_id` values."
    )
