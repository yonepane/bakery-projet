"""Bootstrap initial schema.

Revision ID: 0000bootstrap
Revises:
Create Date: 2026-07-10

This migration creates the tables that existed BEFORE the customer-loyalty
work (migration 0002). It is the REAL base of the chain: the historical
"0001 initial schema" was autogenerate'd against a pre-existing legacy
SQLite DB and only migrated that DB - it never created any tables itself,
so a fresh `alembic upgrade head` had nothing to operate on and failed on
the very first index drop.

After this base, 0001 runs (its legacy-cleanup drops are guarded for the
fresh-DB case), 0002 adds customers + customer_id, 0003 is a sqlite no-op,
0004 fills in secondary owner_id/name indexes, and 0005-0008 add the
Phase 0/1/2 stock and semi-finished goods tables.

Omitted on purpose (added by later migrations, kept untouched):
- transactions.customer_id and its FK  -> 0002
- orders.customer_id and its FK          -> 0002
- recipe_items.semi_finished_id and FK   -> 0008
- every secondary index                 -> 0001/0002/0004
- customers, stock_*, semi_finished_*   -> 0002/0005/0006/0008

The downgrade drops every table this migration creates. It does NOT attempt
to recreate the legacy dual-table state that 0001's downgrade produced; that
state only ever existed on the original hand-migrated development DB and is
not a target any fresh or production DB should return to.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0000bootstrap"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create the pre-0002 schema from scratch."""

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False, autoincrement=True),
        sa.Column("username", sa.String(), nullable=True),
        sa.Column("password", sa.String(), nullable=True),
        sa.Column("role", sa.String(), nullable=True),
        sa.Column("parent_owner_id", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["parent_owner_id"], ["users.id"]),
    )

    op.create_table(
        "system_settings",
        sa.Column("key", sa.String(), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("value", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("key"),
    )

    op.create_table(
        "ingredients",
        sa.Column("id", sa.Integer(), nullable=False, autoincrement=True),
        sa.Column("name", sa.String(), nullable=True),
        sa.Column("owner_id", sa.Integer(), nullable=True),
        sa.Column("stock", sa.Float(), nullable=True),
        sa.Column("unit", sa.String(), nullable=True),
        sa.Column("price", sa.Float(), nullable=True),
        sa.Column("min_threshold", sa.Float(), nullable=True),
        sa.Column("supplier", sa.String(), nullable=True),
        sa.Column("last_purchase_price", sa.Float(), nullable=True),
        sa.Column("allergens", sa.JSON(), nullable=True),
        sa.Column("is_organic", sa.Boolean(), nullable=True),
        sa.Column("purchase_unit", sa.String(), nullable=True),
        sa.Column("purchase_to_base_ratio", sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "products",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=True),
        sa.Column("name", sa.String(), nullable=True),
        sa.Column("stock", sa.Integer(), nullable=True),
        sa.Column("price", sa.Float(), nullable=True),
        sa.Column("icon", sa.String(), nullable=True),
        sa.Column("prep_time", sa.Integer(), nullable=True),
        sa.Column("cook_time", sa.Integer(), nullable=True),
        sa.Column("yield_qty", sa.Integer(), nullable=True),
        sa.Column("instructions", sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "recipe_items",
        sa.Column("id", sa.Integer(), nullable=False, autoincrement=True),
        sa.Column("product_id", sa.String(), nullable=True),
        sa.Column("ingredient_id", sa.Integer(), nullable=True),
        sa.Column("quantity", sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"]),
        sa.ForeignKeyConstraint(["ingredient_id"], ["ingredients.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "transactions",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=True),
        sa.Column("timestamp", sa.DateTime(), nullable=True),
        sa.Column("type", sa.String(), nullable=True),
        sa.Column("total_revenue", sa.Float(), nullable=True),
        sa.Column("total_cost", sa.Float(), nullable=True),
        sa.Column("items", sa.JSON(), nullable=True),
        sa.Column("status", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "orders",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=True),
        sa.Column("customer_name", sa.String(), nullable=True),
        sa.Column("customer_phone", sa.String(), nullable=True),
        sa.Column("items", sa.JSON(), nullable=True),
        sa.Column("total_price", sa.Float(), nullable=True),
        sa.Column("deposit_paid", sa.Float(), nullable=True),
        sa.Column("pickup_date", sa.DateTime(), nullable=True),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("notes", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "suppliers",
        sa.Column("id", sa.Integer(), nullable=False, autoincrement=True),
        sa.Column("owner_id", sa.Integer(), nullable=True),
        sa.Column("name", sa.String(), nullable=True),
        sa.Column("contact_info", sa.String(), nullable=True),
        sa.Column("ice", sa.String(), nullable=True),
        sa.Column("email", sa.String(), nullable=True),
        sa.Column("phone", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "expenses",
        sa.Column("id", sa.Integer(), nullable=False, autoincrement=True),
        sa.Column("owner_id", sa.Integer(), nullable=True),
        sa.Column("date", sa.DateTime(), nullable=True),
        sa.Column("category", sa.String(), nullable=True),
        sa.Column("amount", sa.Float(), nullable=True),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("input_mode", sa.String(), nullable=True),
        sa.Column("amount_ht", sa.Float(), nullable=True),
        sa.Column("amount_ttc", sa.Float(), nullable=True),
        sa.Column("tva_rate", sa.Float(), nullable=True),
        sa.Column("tva_amount", sa.Float(), nullable=True),
        sa.Column("is_tva_deductible", sa.Boolean(), nullable=True),
        sa.Column("supplier_id", sa.Integer(), nullable=True),
        sa.Column("invoice_ref", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("amount_paid", sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["supplier_id"], ["suppliers.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "purchase_orders",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=True),
        sa.Column("date", sa.DateTime(), nullable=True),
        sa.Column("supplier_id", sa.Integer(), nullable=True),
        sa.Column("items", sa.JSON(), nullable=True),
        sa.Column("notes", sa.String(), nullable=True),
        sa.Column("expected_delivery_date", sa.DateTime(), nullable=True),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("archived", sa.Boolean(), nullable=True),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["supplier_id"], ["suppliers.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "planner",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=True),
        sa.Column("product_id", sa.String(), nullable=True),
        sa.Column("date", sa.String(), nullable=True),
        sa.Column("quantity", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "waste_records",
        sa.Column("id", sa.Integer(), nullable=False, autoincrement=True),
        sa.Column("owner_id", sa.Integer(), nullable=True),
        sa.Column("date", sa.DateTime(), nullable=True),
        sa.Column("product_id", sa.String(), nullable=True),
        sa.Column("quantity", sa.Integer(), nullable=True),
        sa.Column("loss_cost", sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "shift_logs",
        sa.Column("id", sa.Integer(), nullable=False, autoincrement=True),
        sa.Column("owner_id", sa.Integer(), nullable=True),
        sa.Column("timestamp", sa.DateTime(), nullable=True),
        sa.Column("author", sa.String(), nullable=True),
        sa.Column("content", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "shift_records",
        sa.Column("id", sa.Integer(), nullable=False, autoincrement=True),
        sa.Column("owner_id", sa.Integer(), nullable=True),
        sa.Column("start_time", sa.DateTime(), nullable=True),
        sa.Column("end_time", sa.DateTime(), nullable=True),
        sa.Column("revenue", sa.Float(), nullable=True),
        sa.Column("cost", sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "expense_payments",
        sa.Column("id", sa.Integer(), nullable=False, autoincrement=True),
        sa.Column("expense_id", sa.Integer(), nullable=True),
        sa.Column("amount", sa.Float(), nullable=True),
        sa.Column("paid_at", sa.DateTime(), nullable=True),
        sa.Column("payment_method", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["expense_id"], ["expenses.id"]),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    """Drop every table this migration created."""

    op.drop_table("expense_payments")
    op.drop_table("shift_records")
    op.drop_table("shift_logs")
    op.drop_table("waste_records")
    op.drop_table("planner")
    op.drop_table("purchase_orders")
    op.drop_table("expenses")
    op.drop_table("suppliers")
    op.drop_table("orders")
    op.drop_table("transactions")
    op.drop_table("recipe_items")
    op.drop_table("products")
    op.drop_table("ingredients")
    op.drop_table("system_settings")
    op.drop_table("users")
