"""Phase 6 Slice 2 — waste reason + temperature/hygiene logs

Revision ID: 00013
Revises: 00012
Create Date: 2026-07-11
"""
from alembic import op
import sqlalchemy as sa


revision = '00013'
down_revision = '00012'
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
    # 1. Add reason column to waste_records
    if _table_exists("waste_records") and not _column_exists("waste_records", "reason"):
        op.add_column(
            "waste_records",
            sa.Column("reason", sa.String(), nullable=True),
        )
        op.create_index(
            "ix_waste_records_reason",
            "waste_records",
            ["reason"],
        )

    # 2. Create temperature_logs table
    if not _table_exists("temperature_logs"):
        op.create_table(
            "temperature_logs",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True, index=True),
            sa.Column("recorded_at", sa.DateTime(), nullable=True, index=True),
            sa.Column("location_label", sa.String(), nullable=False, index=True),
            sa.Column("temperature_c", sa.Float(), nullable=False),
            sa.Column("notes", sa.String(), nullable=True),
            sa.Column("recorded_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        )
        op.create_index("ix_temperature_logs_id", "temperature_logs", ["id"])

    # 3. Create hygiene_logs table
    if not _table_exists("hygiene_logs"):
        op.create_table(
            "hygiene_logs",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True, index=True),
            sa.Column("recorded_at", sa.DateTime(), nullable=True, index=True),
            sa.Column("task_type", sa.String(), nullable=False, index=True),
            sa.Column("area", sa.String(), nullable=True, index=True),
            sa.Column("notes", sa.String(), nullable=True),
            sa.Column("recorded_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        )
        op.create_index("ix_hygiene_logs_id", "hygiene_logs", ["id"])


def downgrade() -> None:
    if _table_exists("hygiene_logs"):
        op.drop_index("ix_hygiene_logs_id", table_name="hygiene_logs")
        op.drop_table("hygiene_logs")

    if _table_exists("temperature_logs"):
        op.drop_index("ix_temperature_logs_id", table_name="temperature_logs")
        op.drop_table("temperature_logs")

    if _table_exists("waste_records") and _column_exists("waste_records", "reason"):
        op.drop_index("ix_waste_records_reason", table_name="waste_records")
        op.drop_column("waste_records", "reason")