"""backfill missing additive columns for bootstrap-adopted databases

Revision ID: 956c47e25da4
Revises: c61cf028c5b2
Create Date: 2026-07-15 20:18:46.386530

Context
-------
Prior to this migration, the running app never executed `alembic upgrade`;
it relied on `create_all()` (only creates missing *tables*, never adds
columns to existing ones) plus a hand-maintained patch list in
`bootstrap.py` (`ensure_runtime_schema()`). That patch list fell behind
twice:

  * `recipe_items.substitutes_for_ingredient_id` (added in migration
    c61cf028c5b2) was never backfilled.
  * `purchase_orders.{invoice_number, invoice_date, invoice_amount_ht,
    invoice_tva_amount, invoice_amount_ttc, payment_status, payment_date,
    payment_method, payment_reference}` (added in migration 0015) were
    never backfilled.

This migration is intentionally guarded/idempotent: on a database that
reached head purely through the normal migration chain (0015 and
c61cf028c5b2 already added these columns themselves), every check below
finds the column already present and does nothing. It only does real work
on a database that was previously bootstrap-adopted (see the adoption
logic in `bootstrap.py`), where these two migrations' column-add
operations were skipped because the app never ran them.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '956c47e25da4'
down_revision: Union[str, Sequence[str], None] = 'c61cf028c5b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _existing_columns(table_name: str) -> set:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return {col["name"] for col in inspector.get_columns(table_name)}


def _existing_index_names(table_name: str) -> set:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return {ix["name"] for ix in inspector.get_indexes(table_name)}


def upgrade() -> None:
    """Upgrade schema."""
    recipe_item_columns = _existing_columns("recipe_items")
    if "substitutes_for_ingredient_id" not in recipe_item_columns:
        # Mirrors c61cf028c5b2's recipe_items block exactly, so a
        # bootstrap-adopted database ends up identical to one that ran
        # the full migration chain from scratch.
        existing_indexes = _existing_index_names("recipe_items")
        with op.batch_alter_table("recipe_items", schema=None) as batch_op:
            batch_op.add_column(
                sa.Column("substitutes_for_ingredient_id", sa.Integer(), nullable=True)
            )
            if "ix_recipe_items_semi_finished_id" in existing_indexes:
                batch_op.drop_index("ix_recipe_items_semi_finished_id")
            batch_op.create_index(
                "ix_recipe_items_substitutes_for_ingredient_id",
                ["substitutes_for_ingredient_id"],
                unique=False,
            )
            batch_op.create_foreign_key(
                "fk_recipe_items_ingredients_substitutes",
                "ingredients",
                ["substitutes_for_ingredient_id"],
                ["id"],
            )

    po_columns = _existing_columns("purchase_orders")
    po_additions = [
        ("invoice_number", sa.String()),
        ("invoice_date", sa.DateTime()),
        ("invoice_amount_ht", sa.Float()),
        ("invoice_tva_amount", sa.Float()),
        ("invoice_amount_ttc", sa.Float()),
        ("payment_status", sa.String()),
        ("payment_date", sa.DateTime()),
        ("payment_method", sa.String()),
        ("payment_reference", sa.String()),
    ]
    missing_po_columns = [
        (name, coltype) for name, coltype in po_additions if name not in po_columns
    ]
    po_indexes = _existing_index_names("purchase_orders")
    if missing_po_columns or "ix_purchase_orders_id" not in po_indexes:
        with op.batch_alter_table("purchase_orders", schema=None) as batch_op:
            for name, coltype in missing_po_columns:
                batch_op.add_column(sa.Column(name, coltype, nullable=True))
            # Final state per c61cf028c5b2: an index on id, and no index
            # on payment_status (that index was created then dropped
            # again within the same migration history).
            if "ix_purchase_orders_id" not in po_indexes:
                batch_op.create_index("ix_purchase_orders_id", ["id"], unique=False)

    # invoice_number is declared index=True on the model (0015 created this
    # index alongside the column; unlike payment_status's index, it was
    # never later dropped) -- checked separately from the block above since
    # it can be missing even when every other PO column/index already
    # exists.
    po_indexes = _existing_index_names("purchase_orders")
    if "ix_purchase_orders_invoice_number" not in po_indexes:
        with op.batch_alter_table("purchase_orders", schema=None) as batch_op:
            batch_op.create_index(
                "ix_purchase_orders_invoice_number", ["invoice_number"], unique=False
            )


def downgrade() -> None:
    """Downgrade schema.

    Intentionally a no-op: this migration only ever adds columns that
    belong to migrations 0015 / c61cf028c5b2. Downgrading past those
    migrations already removes them; downgrading to just before this one
    (but past 0015/c61cf028c5b2) should not blindly drop columns that
    this migration may not have been the one to add.
    """
    pass
