"""add_stock_movements

Revision ID: 20260706stock
Revises: 8e76015a72ca
Create Date: 2026-07-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "20260706stock"
down_revision: Union[str, Sequence[str], None] = "8e76015a72ca"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table_name: str) -> bool:
    return table_name in inspect(op.get_bind()).get_table_names()


def _index_exists(index_name: str, table_name: str) -> bool:
    try:
        return index_name in {ix["name"] for ix in inspect(op.get_bind()).get_indexes(table_name)}
    except Exception:
        return False


def upgrade() -> None:
    if not _table_exists("stock_movements"):
        op.create_table(
            "stock_movements",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("item_type", sa.String(), nullable=True),
            sa.Column("item_id", sa.String(), nullable=True),
            sa.Column("item_name_snapshot", sa.String(), nullable=True),
            sa.Column("quantity_delta", sa.Float(), nullable=True),
            sa.Column("unit_snapshot", sa.String(), nullable=True),
            sa.Column("movement_type", sa.String(), nullable=True),
            sa.Column("source_type", sa.String(), nullable=True),
            sa.Column("source_id", sa.String(), nullable=True),
            sa.Column("reason", sa.String(), nullable=True),
            sa.Column("before_qty", sa.Float(), nullable=True),
            sa.Column("after_qty", sa.Float(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("created_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("client_mutation_id", sa.String(), nullable=True),
        )
    indexes = [
        ("ix_stock_movements_id", "stock_movements", ["id"]),
        ("ix_stock_movements_owner_id", "stock_movements", ["owner_id"]),
        ("ix_stock_movements_item_type", "stock_movements", ["item_type"]),
        ("ix_stock_movements_item_id", "stock_movements", ["item_id"]),
        ("ix_stock_movements_movement_type", "stock_movements", ["movement_type"]),
        ("ix_stock_movements_source_type", "stock_movements", ["source_type"]),
        ("ix_stock_movements_source_id", "stock_movements", ["source_id"]),
        ("ix_stock_movements_created_at", "stock_movements", ["created_at"]),
        ("ix_stock_movements_created_by_user_id", "stock_movements", ["created_by_user_id"]),
        ("ix_stock_movements_client_mutation_id", "stock_movements", ["client_mutation_id"]),
    ]
    for name, table, cols in indexes:
        if not _index_exists(name, table):
            op.create_index(op.f(name), table, cols, unique=False)


def downgrade() -> None:
    if not _table_exists("stock_movements"):
        return
    indexes = [
        "ix_stock_movements_client_mutation_id",
        "ix_stock_movements_created_by_user_id",
        "ix_stock_movements_created_at",
        "ix_stock_movements_source_id",
        "ix_stock_movements_source_type",
        "ix_stock_movements_movement_type",
        "ix_stock_movements_item_id",
        "ix_stock_movements_item_type",
        "ix_stock_movements_owner_id",
        "ix_stock_movements_id",
    ]
    for ix_name in indexes:
        if _index_exists(ix_name, "stock_movements"):
            op.drop_index(op.f(ix_name), table_name="stock_movements")
    op.drop_table("stock_movements")