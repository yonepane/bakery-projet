"""Phase 3 follow-up — Recipe multi-output + ingredient substitutions

Revision ID: 0014
Revises: 0013
Create Date: 2026-07-11
"""
from alembic import op
import sqlalchemy as sa


revision = '0014'
down_revision = '00013'
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
    # 1. recipe_version_outputs table
    if not _table_exists("recipe_version_outputs"):
        op.create_table(
            "recipe_version_outputs",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True, index=True),
            sa.Column("recipe_version_id", sa.Integer(), sa.ForeignKey("recipe_versions.id"), nullable=True, index=True),
            sa.Column("product_id", sa.String(), sa.ForeignKey("products.id"), nullable=True, index=True),
            sa.Column("output_type", sa.String(), nullable=True, default="main_product"),
            sa.Column("output_quantity", sa.Float(), nullable=True),
            sa.Column("output_unit", sa.String(), nullable=True),
            sa.Column("cost_allocation_pct", sa.Float(), nullable=True, default=100.0),
        )
        op.create_index("ix_recipe_version_outputs_id", "recipe_version_outputs", ["id"])

    # 2. recipe_version_ingredient_substitutions table
    if not _table_exists("recipe_version_ingredient_substitutions"):
        op.create_table(
            "recipe_version_ingredient_substitutions",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True, index=True),
            sa.Column("recipe_version_id", sa.Integer(), sa.ForeignKey("recipe_versions.id"), nullable=True, index=True),
            sa.Column("recipe_line_index", sa.Integer(), nullable=True),
            sa.Column("original_ingredient_id", sa.Integer(), sa.ForeignKey("ingredients.id"), nullable=True),
            sa.Column("substitute_ingredient_id", sa.Integer(), sa.ForeignKey("ingredients.id"), nullable=True),
            sa.Column("conversion_factor", sa.Float(), nullable=True, default=1.0),
            sa.Column("is_active", sa.Boolean(), nullable=True, default=True),
            sa.Column("cost_delta_per_unit", sa.Float(), nullable=True, default=0.0),
            sa.Column("notes", sa.String(), nullable=True),
        )
        op.create_index("ix_recipe_version_ingredient_subs_id", "recipe_version_ingredient_substitutions", ["id"])


def downgrade() -> None:
    if _table_exists("recipe_version_ingredient_substitutions"):
        op.drop_index("ix_recipe_version_ingredient_subs_id", table_name="recipe_version_ingredient_substitutions")
        op.drop_table("recipe_version_ingredient_substitutions")

    if _table_exists("recipe_version_outputs"):
        op.drop_index("ix_recipe_version_outputs_id", table_name="recipe_version_outputs")
        op.drop_table("recipe_version_outputs")