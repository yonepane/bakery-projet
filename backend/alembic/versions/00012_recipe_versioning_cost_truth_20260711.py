"""Phase 3 recipe versioning — RecipeVersion table + ProductionBatch cost snapshot link

Revision ID: 00012
Revises: 00011
Create Date: 2026-07-11
"""
from alembic import op
import sqlalchemy as sa


revision = '00012'
down_revision = '00011'
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
    # 1. Create recipe_versions table.
    if not _table_exists("recipe_versions"):
        op.create_table(
            "recipe_versions",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True, index=True),
            sa.Column("product_id", sa.String(), sa.ForeignKey("products.id"), nullable=True, index=True),
            sa.Column("version_number", sa.Integer(), nullable=False, index=True),
            sa.Column("status", sa.String(), nullable=True, index=True),
            sa.Column("recipe_lines", sa.JSON(), nullable=False),
            sa.Column("yield_qty", sa.Float(), nullable=True),
            sa.Column("yield_unit", sa.String(), nullable=True),
            sa.Column("production_loss_pct", sa.Float(), nullable=True),
            sa.Column("cost_snapshot", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True, index=True),
            sa.Column("activated_at", sa.DateTime(), nullable=True),
            sa.Column("archived_at", sa.DateTime(), nullable=True),
            sa.Column("created_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.UniqueConstraint(
                "owner_id", "product_id", "version_number",
                name="uq_recipe_version_owner_product_number",
            ),
        )
        op.create_index("ix_recipe_versions_id", "recipe_versions", ["id"])

    # 2. Add recipe_version_id + cost_snapshot to production_batches.
    if _table_exists("production_batches"):
        if not _column_exists("production_batches", "recipe_version_id"):
            op.add_column(
                "production_batches",
                sa.Column("recipe_version_id", sa.Integer(), nullable=True),
            )
            with op.batch_alter_table("production_batches", recreate="always") as batch_op:
                batch_op.create_foreign_key(
                    "fk_pb_recipe_version",
                    "recipe_versions",
                    ["recipe_version_id"],
                    ["id"],
                )
            op.create_index(
                "ix_production_batches_recipe_version_id",
                "production_batches",
                ["recipe_version_id"],
            )

        if not _column_exists("production_batches", "cost_snapshot"):
            op.add_column(
                "production_batches",
                sa.Column("cost_snapshot", sa.JSON(), nullable=True),
            )


def downgrade() -> None:
    if _table_exists("production_batches"):
        if _column_exists("production_batches", "cost_snapshot"):
            op.drop_column("production_batches", "cost_snapshot")

        if _column_exists("production_batches", "recipe_version_id"):
            op.drop_index(
                "ix_production_batches_recipe_version_id",
                table_name="production_batches",
            )
            with op.batch_alter_table("production_batches", recreate="always") as batch_op:
                batch_op.drop_constraint("fk_pb_recipe_version", type_="foreignkey")
                batch_op.drop_column("recipe_version_id")

    if _table_exists("recipe_versions"):
        op.drop_index("ix_recipe_versions_id", table_name="recipe_versions")
        op.drop_table("recipe_versions")