"""Phase 4 pastry-stage expansion

Adds assigned_to_id, timer_minutes, batch_notes columns to production_batches
to support employee assignment, stage timers, and inline batch notes.
Also generates a new index for assigned_to_id.

Revision ID: 00011
Revises: 00010
Create Date: 2026-07-11
"""
from alembic import op
import sqlalchemy as sa


revision = '00011'
down_revision = 'df7ded3636b2'
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
    if not _table_exists("production_batches"):
        return

    if not _column_exists("production_batches", "assigned_to_id"):
        with op.batch_alter_table("production_batches", recreate="always") as batch_op:
            batch_op.add_column(sa.Column("assigned_to_id", sa.Integer(), nullable=True))
            batch_op.create_foreign_key(
                "fk_pb_assigned_to_user", "users", ["assigned_to_id"], ["id"]
            )
        op.create_index(
            "ix_production_batches_assigned_to_id",
            "production_batches",
            ["assigned_to_id"],
        )

    if not _column_exists("production_batches", "timer_minutes"):
        op.add_column(
            "production_batches",
            sa.Column("timer_minutes", sa.Integer(), nullable=True),
        )

    if not _column_exists("production_batches", "batch_notes"):
        op.add_column(
            "production_batches",
            sa.Column("batch_notes", sa.String(), nullable=True),
        )


def downgrade() -> None:
    if not _table_exists("production_batches"):
        return

    if _column_exists("production_batches", "batch_notes"):
        op.drop_column("production_batches", "batch_notes")

    if _column_exists("production_batches", "timer_minutes"):
        op.drop_column("production_batches", "timer_minutes")

    if _column_exists("production_batches", "assigned_to_id"):
        op.drop_index(
            "ix_production_batches_assigned_to_id",
            table_name="production_batches",
        )
        with op.batch_alter_table("production_batches", recreate="always") as batch_op:
            batch_op.drop_constraint("fk_pb_assigned_to_user", type_="foreignkey")
            batch_op.drop_column("assigned_to_id")