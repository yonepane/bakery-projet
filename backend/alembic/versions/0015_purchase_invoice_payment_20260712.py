"""Phase 3 follow-up — Purchase invoice and payment tracking

Revision ID: 0015
Revises: 0014
Create Date: 2026-07-12
"""
from alembic import op
import sqlalchemy as sa


revision = '0015'
down_revision = '0014'
branch_labels = None
depends_on = None


def _table_exists(table_name: str) -> bool:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    return table_name in inspector.get_table_names()


def _column_exists(table_name: str, column_name: str) -> bool:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c["name"] for c in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade() -> None:
    # 1. Add invoice/payment columns to purchase_orders if missing
    if _table_exists("purchase_orders"):
        if not _column_exists("purchase_orders", "invoice_number"):
            op.add_column("purchase_orders", sa.Column("invoice_number", sa.String(), nullable=True, index=True))
        if not _column_exists("purchase_orders", "invoice_date"):
            op.add_column("purchase_orders", sa.Column("invoice_date", sa.DateTime(), nullable=True))
        if not _column_exists("purchase_orders", "invoice_amount_ht"):
            op.add_column("purchase_orders", sa.Column("invoice_amount_ht", sa.Float(), default=0.0))
        if not _column_exists("purchase_orders", "invoice_tva_amount"):
            op.add_column("purchase_orders", sa.Column("invoice_tva_amount", sa.Float(), default=0.0))
        if not _column_exists("purchase_orders", "invoice_amount_ttc"):
            op.add_column("purchase_orders", sa.Column("invoice_amount_ttc", sa.Float(), default=0.0))
        if not _column_exists("purchase_orders", "payment_status"):
            op.add_column("purchase_orders", sa.Column("payment_status", sa.String(), default="unpaid", index=True))
        if not _column_exists("purchase_orders", "payment_date"):
            op.add_column("purchase_orders", sa.Column("payment_date", sa.DateTime(), nullable=True))
        if not _column_exists("purchase_orders", "payment_method"):
            op.add_column("purchase_orders", sa.Column("payment_method", sa.String(), nullable=True))
        if not _column_exists("purchase_orders", "payment_reference"):
            op.add_column("purchase_orders", sa.Column("payment_reference", sa.String(), nullable=True))

    # 2. Create purchase_invoices table
    if not _table_exists("purchase_invoices"):
        op.create_table(
            "purchase_invoices",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True, index=True),
            sa.Column("supplier_id", sa.Integer(), sa.ForeignKey("suppliers.id"), nullable=True, index=True),
            sa.Column("po_id", sa.String(), sa.ForeignKey("purchase_orders.id"), nullable=True, index=True),
            sa.Column("invoice_number", sa.String(), nullable=False, index=True),
            sa.Column("invoice_date", sa.DateTime(), nullable=False, index=True),
            sa.Column("due_date", sa.DateTime(), nullable=True, index=True),
            sa.Column("amount_ht", sa.Float(), default=0.0),
            sa.Column("tva_amount", sa.Float(), default=0.0),
            sa.Column("amount_ttc", sa.Float(), default=0.0),
            sa.Column("payment_status", sa.String(), default="unpaid", index=True),
            sa.Column("paid_amount", sa.Float(), default=0.0),
            sa.Column("payment_date", sa.DateTime(), nullable=True),
            sa.Column("payment_method", sa.String(), nullable=True),
            sa.Column("payment_reference", sa.String(), nullable=True),
            sa.Column("notes", sa.String(), nullable=True),
            sa.Column("created_at", sa.DateTime(), default=lambda: sa.func.now(), index=True),
            sa.Column("updated_at", sa.DateTime(), default=lambda: sa.func.now(), onupdate=lambda: sa.func.now()),
            sa.Column("created_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_purchase_invoices_owner_number", "purchase_invoices", ["owner_id", "invoice_number"], unique=True)

    # 3. Create purchase_invoice_payments table
    if not _table_exists("purchase_invoice_payments"):
        op.create_table(
            "purchase_invoice_payments",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True, index=True),
            sa.Column("invoice_id", sa.Integer(), sa.ForeignKey("purchase_invoices.id"), nullable=True, index=True),
            sa.Column("amount", sa.Float(), default=0.0),
            sa.Column("payment_date", sa.DateTime(), default=lambda: sa.func.now(), index=True),
            sa.Column("payment_method", sa.String(), nullable=False),
            sa.Column("reference", sa.String(), nullable=True),
            sa.Column("notes", sa.String(), nullable=True),
            sa.Column("created_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
        # Note: primary key automatically creates index on id


def downgrade() -> None:
    if _table_exists("purchase_invoice_payments"):
        op.drop_index("ix_purchase_invoice_payments_id", table_name="purchase_invoice_payments")
        op.drop_table("purchase_invoice_payments")

    if _table_exists("purchase_invoices"):
        op.drop_index("ix_purchase_invoices_owner_number", table_name="purchase_invoices")
        op.drop_index("ix_purchase_invoices_id", table_name="purchase_invoices")
        op.drop_table("purchase_invoices")

    # Remove invoice/payment columns from purchase_orders
    if _table_exists("purchase_orders"):
        for col in ["payment_reference", "payment_method", "payment_date", "payment_status", 
                    "invoice_amount_ttc", "invoice_tva_amount", "invoice_amount_ht", 
                    "invoice_date", "invoice_number"]:
            if _column_exists("purchase_orders", col):
                op.drop_column("purchase_orders", col)