"""add_stock_locations_lots

Revision ID: 20260706lots
Revises: 20260706stock
Create Date: 2026-07-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "20260706lots"
down_revision: Union[str, Sequence[str], None] = "20260706stock"
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
    if not _table_exists("stock_locations"):
        op.create_table(
            "stock_locations",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("name", sa.String(), nullable=True),
            sa.Column("type", sa.String(), nullable=True),
            sa.Column("branch_name", sa.String(), nullable=True),
            sa.Column("is_default", sa.Boolean(), nullable=True, default=False),
            sa.Column("is_active", sa.Boolean(), nullable=True, default=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.UniqueConstraint("owner_id", "name", name="uq_stock_locations_owner_name"),
        )
    loc_indexes = [
        ("ix_stock_locations_id", ["id"]),
        ("ix_stock_locations_owner_id", ["owner_id"]),
        ("ix_stock_locations_name", ["name"]),
        ("ix_stock_locations_type", ["type"]),
        ("ix_stock_locations_is_active", ["is_active"]),
        ("ix_stock_locations_created_at", ["created_at"]),
    ]
    for name, cols in loc_indexes:
        if not _index_exists(name, "stock_locations"):
            op.create_index(op.f(name), "stock_locations", cols, unique=False)

    if not _table_exists("stock_lots"):
        op.create_table(
            "stock_lots",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("item_type", sa.String(), nullable=True),
            sa.Column("item_id", sa.String(), nullable=True),
            sa.Column("item_name_snapshot", sa.String(), nullable=True),
            sa.Column("lot_code", sa.String(), nullable=True),
            sa.Column("supplier_lot_code", sa.String(), nullable=True),
            sa.Column("internal_batch_code", sa.String(), nullable=True),
            sa.Column("source_type", sa.String(), nullable=True),
            sa.Column("source_id", sa.String(), nullable=True),
            sa.Column("received_at", sa.DateTime(), nullable=True),
            sa.Column("produced_at", sa.DateTime(), nullable=True),
            sa.Column("expires_at", sa.DateTime(), nullable=True),
            sa.Column("unit_snapshot", sa.String(), nullable=True),
            sa.Column("unit_cost_snapshot", sa.Float(), nullable=True),
            sa.Column("status", sa.String(), nullable=True, default="active"),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.UniqueConstraint("owner_id", "item_type", "item_id", "lot_code", name="uq_stock_lots_owner_item_lot"),
        )
    lot_indexes = [
        ("ix_stock_lots_id", ["id"]),
        ("ix_stock_lots_owner_id", ["owner_id"]),
        ("ix_stock_lots_item_type", ["item_type"]),
        ("ix_stock_lots_item_id", ["item_id"]),
        ("ix_stock_lots_lot_code", ["lot_code"]),
        ("ix_stock_lots_supplier_lot_code", ["supplier_lot_code"]),
        ("ix_stock_lots_internal_batch_code", ["internal_batch_code"]),
        ("ix_stock_lots_source_type", ["source_type"]),
        ("ix_stock_lots_source_id", ["source_id"]),
        ("ix_stock_lots_received_at", ["received_at"]),
        ("ix_stock_lots_produced_at", ["produced_at"]),
        ("ix_stock_lots_expires_at", ["expires_at"]),
        ("ix_stock_lots_status", ["status"]),
        ("ix_stock_lots_created_at", ["created_at"]),
    ]
    for name, cols in lot_indexes:
        if not _index_exists(name, "stock_lots"):
            op.create_index(op.f(name), "stock_lots", cols, unique=False)

    if not _table_exists("stock_lot_balances"):
        op.create_table(
            "stock_lot_balances",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("lot_id", sa.Integer(), sa.ForeignKey("stock_lots.id"), nullable=True),
            sa.Column("location_id", sa.Integer(), sa.ForeignKey("stock_locations.id"), nullable=True),
            sa.Column("quantity", sa.Float(), nullable=True, default=0),
            sa.Column("reserved_quantity", sa.Float(), nullable=True, default=0),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.UniqueConstraint("owner_id", "lot_id", "location_id", name="uq_stock_lot_balances_owner_lot_location"),
            sa.CheckConstraint("quantity >= 0", name="ck_stock_lot_balances_quantity_non_negative"),
            sa.CheckConstraint("reserved_quantity >= 0", name="ck_stock_lot_balances_reserved_non_negative"),
            sa.CheckConstraint("reserved_quantity <= quantity", name="ck_stock_lot_balances_reserved_lte_quantity"),
        )
    bal_indexes = [
        ("ix_stock_lot_balances_id", ["id"]),
        ("ix_stock_lot_balances_owner_id", ["owner_id"]),
        ("ix_stock_lot_balances_lot_id", ["lot_id"]),
        ("ix_stock_lot_balances_location_id", ["location_id"]),
        ("ix_stock_lot_balances_updated_at", ["updated_at"]),
    ]
    for name, cols in bal_indexes:
        if not _index_exists(name, "stock_lot_balances"):
            op.create_index(op.f(name), "stock_lot_balances", cols, unique=False)


def downgrade() -> None:
    if _table_exists("stock_lot_balances"):
        for ix_name in [
            "ix_stock_lot_balances_updated_at",
            "ix_stock_lot_balances_location_id",
            "ix_stock_lot_balances_lot_id",
            "ix_stock_lot_balances_owner_id",
            "ix_stock_lot_balances_id",
        ]:
            if _index_exists(ix_name, "stock_lot_balances"):
                op.drop_index(op.f(ix_name), table_name="stock_lot_balances")
        op.drop_table("stock_lot_balances")

    if _table_exists("stock_lots"):
        for ix_name in [
            "ix_stock_lots_created_at",
            "ix_stock_lots_status",
            "ix_stock_lots_expires_at",
            "ix_stock_lots_produced_at",
            "ix_stock_lots_received_at",
            "ix_stock_lots_source_id",
            "ix_stock_lots_source_type",
            "ix_stock_lots_internal_batch_code",
            "ix_stock_lots_supplier_lot_code",
            "ix_stock_lots_lot_code",
            "ix_stock_lots_item_id",
            "ix_stock_lots_item_type",
            "ix_stock_lots_owner_id",
            "ix_stock_lots_id",
        ]:
            if _index_exists(ix_name, "stock_lots"):
                op.drop_index(op.f(ix_name), table_name="stock_lots")
        op.drop_table("stock_lots")

    if _table_exists("stock_locations"):
        for ix_name in [
            "ix_stock_locations_created_at",
            "ix_stock_locations_is_active",
            "ix_stock_locations_type",
            "ix_stock_locations_name",
            "ix_stock_locations_owner_id",
            "ix_stock_locations_id",
        ]:
            if _index_exists(ix_name, "stock_locations"):
                op.drop_index(op.f(ix_name), table_name="stock_locations")
        op.drop_table("stock_locations")