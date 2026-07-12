"""Phase 5 — CustomOrder model for custom cakes & special orders

Revision ID: 0017
Revises: 0016
Create Date: 2026-07-12
"""
from alembic import op
import sqlalchemy as sa


revision = '0017'
down_revision = '0015'
branch_labels = None
depends_on = None


def _table_exists(table_name: str) -> bool:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    return table_name in inspector.get_table_names()


def _index_exists(table_name: str, index_name: str) -> bool:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    indexes = inspector.get_indexes(table_name)
    return any(idx["name"] == index_name for idx in indexes)


def _column_exists(table_name: str, column_name: str) -> bool:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c["name"] for c in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade() -> None:
    # Create custom_orders table if it doesn't exist
    if not _table_exists("custom_orders"):
        op.create_table(
            "custom_orders",
            sa.Column("id", sa.String(), primary_key=True, index=True),
            sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
            # Customer
            sa.Column("customer_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True, index=True),
            sa.Column("customer_name", sa.String(), nullable=False),
            sa.Column("customer_phone", sa.String(), nullable=True),
            sa.Column("customer_email", sa.String(), nullable=True),
            # Occasion & Timing
            sa.Column("occasion", sa.String(), nullable=True),
            sa.Column("occasion_date", sa.DateTime(), nullable=False, index=True),
            sa.Column("pickup_date", sa.DateTime(), nullable=True),
            sa.Column("delivery_required", sa.Boolean(), default=False),
            sa.Column("delivery_address", sa.String(), nullable=True),
            # Cake Design
            sa.Column("portions", sa.Integer(), nullable=False),
            sa.Column("size", sa.String(), nullable=True),
            sa.Column("shape", sa.String(), nullable=True),
            # Flavors & Fillings (JSON)
            sa.Column("sponge_flavor", sa.String(), nullable=True),
            sa.Column("filling", sa.String(), nullable=True),
            sa.Column("frosting", sa.String(), nullable=True),
            sa.Column("decorations", sa.JSON(), nullable=True),
            # Dietary
            sa.Column("dietary_notes", sa.String(), nullable=True),
            sa.Column("allergens", sa.JSON(), nullable=True),
            # Pricing & Payment
            sa.Column("base_price", sa.Float(), default=0.0),
            sa.Column("decoration_cost", sa.Float(), default=0.0),
            sa.Column("delivery_fee", sa.Float(), default=0.0),
            sa.Column("total_price", sa.Float(), default=0.0),
            sa.Column("deposit_amount", sa.Float(), default=0.0),
            sa.Column("deposit_paid", sa.Boolean(), default=False),
            sa.Column("balance_due", sa.Float(), default=0.0),
            sa.Column("payment_status", sa.String(), default="pending", index=True),
            sa.Column("payment_method", sa.String(), nullable=True),
            # Status & Workflow
            sa.Column("status", sa.String(), default="inquiry", index=True),
            sa.Column("priority", sa.Integer(), default=0),
            # Design & Communication
            sa.Column("reference_images", sa.JSON(), nullable=True),
            sa.Column("design_notes", sa.String(), nullable=True),
            sa.Column("customer_notes", sa.String(), nullable=True),
            sa.Column("internal_notes", sa.String(), nullable=True),
            # Images
            sa.Column("design_image_url", sa.String(), nullable=True),
            sa.Column("final_image_url", sa.String(), nullable=True),
            # Timestamps
            sa.Column("created_at", sa.DateTime(), default=lambda: datetime.datetime.now(timezone.utc), index=True),
            sa.Column("updated_at", sa.DateTime(), default=lambda: datetime.datetime.now(timezone.utc), onupdate=lambda: datetime.datetime.now(timezone.utc)),
            sa.Column("confirmed_at", sa.DateTime(), nullable=True),
            sa.Column("ready_at", sa.DateTime(), nullable=True),
            sa.Column("delivered_at", sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
    
    # If table exists, add missing columns
    else:
        # Add missing columns
        if not _column_exists("custom_orders", "customer_id"):
            op.add_column("custom_orders", sa.Column("customer_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True, index=True))
        if not _column_exists("custom_orders", "customer_name"):
            op.add_column("custom_orders", sa.Column("customer_name", sa.String(), nullable=False))
        if not _column_exists("custom_orders", "customer_phone"):
            op.add_column("custom_orders", sa.Column("customer_phone", sa.String(), nullable=True))
        if not _column_exists("custom_orders", "customer_email"):
            op.add_column("custom_orders", sa.Column("customer_email", sa.String(), nullable=True))
        if not _column_exists("custom_orders", "occasion"):
            op.add_column("custom_orders", sa.Column("occasion", sa.String(), nullable=True))
        if not _column_exists("custom_orders", "occasion_date"):
            op.add_column("custom_orders", sa.Column("occasion_date", sa.DateTime(), nullable=False, index=True))
        if not _column_exists("custom_orders", "pickup_date"):
            op.add_column("custom_orders", sa.Column("pickup_date", sa.DateTime(), nullable=True))
        if not _column_exists("custom_orders", "delivery_required"):
            op.add_column("custom_orders", sa.Column("delivery_required", sa.Boolean(), default=False))
        if not _column_exists("custom_orders", "delivery_address"):
            op.add_column("custom_orders", sa.Column("delivery_address", sa.String(), nullable=True))
        if not _column_exists("custom_orders", "portions"):
            op.add_column("custom_orders", sa.Column("portions", sa.Integer(), nullable=False))
        if not _column_exists("custom_orders", "size"):
            op.add_column("custom_orders", sa.Column("size", sa.String(), nullable=True))
        if not _column_exists("custom_orders", "shape"):
            op.add_column("custom_orders", sa.Column("shape", sa.String(), nullable=True))
        if not _column_exists("custom_orders", "sponge_flavor"):
            op.add_column("custom_orders", sa.Column("sponge_flavor", sa.String(), nullable=True))
        if not _column_exists("custom_orders", "filling"):
            op.add_column("custom_orders", sa.Column("filling", sa.String(), nullable=True))
        if not _column_exists("custom_orders", "frosting"):
            op.add_column("custom_orders", sa.Column("frosting", sa.String(), nullable=True))
        if not _column_exists("custom_orders", "decorations"):
            op.add_column("custom_orders", sa.Column("decorations", sa.JSON(), nullable=True))
        if not _column_exists("custom_orders", "dietary_notes"):
            op.add_column("custom_orders", sa.Column("dietary_notes", sa.String(), nullable=True))
        if not _column_exists("custom_orders", "allergens"):
            op.add_column("custom_orders", sa.Column("allergens", sa.JSON(), nullable=True))
        if not _column_exists("custom_orders", "base_price"):
            op.add_column("custom_orders", sa.Column("base_price", sa.Float(), default=0.0))
        if not _column_exists("custom_orders", "decoration_cost"):
            op.add_column("custom_orders", sa.Column("decoration_cost", sa.Float(), default=0.0))
        if not _column_exists("custom_orders", "delivery_fee"):
            op.add_column("custom_orders", sa.Column("delivery_fee", sa.Float(), default=0.0))
        if not _column_exists("custom_orders", "total_price"):
            op.add_column("custom_orders", sa.Column("total_price", sa.Float(), default=0.0))
        if not _column_exists("custom_orders", "deposit_amount"):
            op.add_column("custom_orders", sa.Column("deposit_amount", sa.Float(), default=0.0))
        if not _column_exists("custom_orders", "deposit_paid"):
            op.add_column("custom_orders", sa.Column("deposit_paid", sa.Boolean(), default=False))
        if not _column_exists("custom_orders", "balance_due"):
            op.add_column("custom_orders", sa.Column("balance_due", sa.Float(), default=0.0))
        if not _column_exists("custom_orders", "payment_status"):
            op.add_column("custom_orders", sa.Column("payment_status", sa.String(), default="pending", index=True))
        if not _column_exists("custom_orders", "payment_method"):
            op.add_column("custom_orders", sa.Column("payment_method", sa.String(), nullable=True))
        if not _column_exists("custom_orders", "status"):
            op.add_column("custom_orders", sa.Column("status", sa.String(), default="inquiry", index=True))
        if not _column_exists("custom_orders", "priority"):
            op.add_column("custom_orders", sa.Column("priority", sa.Integer(), default=0))
        if not _column_exists("custom_orders", "reference_images"):
            op.add_column("custom_orders", sa.Column("reference_images", sa.JSON(), nullable=True))
        if not _column_exists("custom_orders", "design_notes"):
            op.add_column("custom_orders", sa.Column("design_notes", sa.String(), nullable=True))
        if not _column_exists("custom_orders", "customer_notes"):
            op.add_column("custom_orders", sa.Column("customer_notes", sa.String(), nullable=True))
        if not _column_exists("custom_orders", "internal_notes"):
            op.add_column("custom_orders", sa.Column("internal_notes", sa.String(), nullable=True))
        if not _column_exists("custom_orders", "design_image_url"):
            op.add_column("custom_orders", sa.Column("design_image_url", sa.String(), nullable=True))
        if not _column_exists("custom_orders", "final_image_url"):
            op.add_column("custom_orders", sa.Column("final_image_url", sa.String(), nullable=True))
        if not _column_exists("custom_orders", "created_at"):
            op.add_column("custom_orders", sa.Column("created_at", sa.DateTime(), default=lambda: datetime.datetime.now(timezone.utc), index=True))
        if not _column_exists("custom_orders", "updated_at"):
            op.add_column("custom_orders", sa.Column("updated_at", sa.DateTime(), default=lambda: datetime.datetime.now(timezone.utc), onupdate=lambda: datetime.datetime.now(timezone.utc)))
        if not _column_exists("custom_orders", "confirmed_at"):
            op.add_column("custom_orders", sa.Column("confirmed_at", sa.DateTime(), nullable=True))
        if not _column_exists("custom_orders", "ready_at"):
            op.add_column("custom_orders", sa.Column("ready_at", sa.DateTime(), nullable=True))
        if not _column_exists("custom_orders", "delivered_at"):
            op.add_column("custom_orders", sa.Column("delivered_at", sa.DateTime(), nullable=True))
        if not _column_exists("custom_orders", "customer_id"):
            op.add_column("custom_orders", sa.Column("customer_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True, index=True))
        if not _column_exists("custom_orders", "owner_id"):
            op.add_column("custom_orders", sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True))


def downgrade() -> None:
    if _table_exists("custom_orders"):
        op.drop_table("custom_orders")