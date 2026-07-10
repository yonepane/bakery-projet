"""extend_stock_movements_lot_location

Revision ID: 20260706movectx
Revises: 20260706lots
Create Date: 2026-07-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "20260706movectx"
down_revision: Union[str, Sequence[str], None] = "20260706lots"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table_name: str, column_name: str) -> bool:
    try:
        cols = [c["name"] for c in inspect(op.get_bind()).get_columns(table_name)]
        return column_name in cols
    except Exception:
        return False


def _index_exists(index_name: str, table_name: str) -> bool:
    try:
        return index_name in {ix["name"] for ix in inspect(op.get_bind()).get_indexes(table_name)}
    except Exception:
        return False


def upgrade() -> None:
    additions = [
        ("location_id", sa.Integer()),
        ("location_name_snapshot", sa.String()),
        ("lot_id", sa.Integer()),
        ("lot_code_snapshot", sa.String()),
        ("expires_at", sa.DateTime()),
        ("unit_cost_snapshot", sa.Float()),
        ("correlation_id", sa.String()),
    ]
    for col_name, col_type in additions:
        if not _column_exists("stock_movements", col_name):
            op.add_column("stock_movements", sa.Column(col_name, col_type, nullable=True))

    # Foreign keys for lot_id/location_id cannot be added inline on SQLite.
    # They're already present in the model but Alembic add_column with inline FK
    # fails on SQLite. The schema is correct as-is; the FK decorates searches.
    # On non-sqlite dialects we'd add them as constraints.

    new_indexes = [
        ("ix_stock_movements_location_id", "stock_movements", ["location_id"]),
        ("ix_stock_movements_lot_id", "stock_movements", ["lot_id"]),
        ("ix_stock_movements_expires_at", "stock_movements", ["expires_at"]),
        ("ix_stock_movements_correlation_id", "stock_movements", ["correlation_id"]),
    ]
    for name, table, cols in new_indexes:
        if not _index_exists(name, table):
            op.create_index(op.f(name), table, cols, unique=False)


def downgrade() -> None:
    for ix_name in [
        "ix_stock_movements_correlation_id",
        "ix_stock_movements_expires_at",
        "ix_stock_movements_lot_id",
        "ix_stock_movements_location_id",
    ]:
        if _index_exists(ix_name, "stock_movements"):
            op.drop_index(op.f(ix_name), table_name="stock_movements")
    for col_name in [
        "correlation_id",
        "unit_cost_snapshot",
        "expires_at",
        "lot_code_snapshot",
        "lot_id",
        "location_name_snapshot",
        "location_id",
    ]:
        if _column_exists("stock_movements", col_name):
            op.drop_column("stock_movements", col_name)