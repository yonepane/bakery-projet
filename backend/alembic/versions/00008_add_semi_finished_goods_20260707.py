"""add_semi_finished_goods

Revision ID: 20260707semifin
Revises: 20260706movectx
Create Date: 2026-07-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "20260707semifin"
down_revision: Union[str, Sequence[str], None] = "20260706movectx"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table_name: str) -> bool:
    return table_name in inspect(op.get_bind()).get_table_names()


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
    if not _table_exists("semi_finished_items"):
        op.create_table(
            "semi_finished_items",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("name", sa.String(), nullable=True),
            sa.Column("unit", sa.String(), nullable=True),
            sa.Column("stock", sa.Float(), nullable=True, default=0.0),
            sa.Column("cost", sa.Float(), nullable=True, default=0.0),
            sa.Column("min_threshold", sa.Float(), nullable=True, default=0.0),
            sa.Column("shelf_life_hours", sa.Integer(), nullable=True),
            sa.Column("allergens", sa.JSON(), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=True, default=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
        )
    if not _index_exists("ix_semi_finished_items_id", "semi_finished_items"):
        op.create_index(op.f("ix_semi_finished_items_id"), "semi_finished_items", ["id"], unique=False)
    if not _index_exists("ix_semi_finished_items_owner_id", "semi_finished_items"):
        op.create_index(op.f("ix_semi_finished_items_owner_id"), "semi_finished_items", ["owner_id"], unique=False)
    if not _index_exists("ix_semi_finished_items_name", "semi_finished_items"):
        op.create_index(op.f("ix_semi_finished_items_name"), "semi_finished_items", ["name"], unique=False)

    if not _column_exists("recipe_items", "semi_finished_id"):
        with op.batch_alter_table("recipe_items") as batch_op:
            batch_op.add_column(sa.Column("semi_finished_id", sa.Integer(), nullable=True))
            batch_op.create_foreign_key(
                "fk_recipe_items_semi_finished_id",
                "semi_finished_items",
                ["semi_finished_id"],
                ["id"],
            )
    if not _index_exists("ix_recipe_items_semi_finished_id", "recipe_items"):
        op.create_index(op.f("ix_recipe_items_semi_finished_id"), "recipe_items", ["semi_finished_id"], unique=False)

    if not _table_exists("semi_finished_recipe_items"):
        op.create_table(
            "semi_finished_recipe_items",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("semi_finished_id", sa.Integer(), sa.ForeignKey("semi_finished_items.id"), nullable=True),
            sa.Column("ingredient_id", sa.Integer(), sa.ForeignKey("ingredients.id"), nullable=True),
            sa.Column("quantity", sa.Float(), nullable=True),
        )
    if not _index_exists("ix_semi_finished_recipe_items_id", "semi_finished_recipe_items"):
        op.create_index(op.f("ix_semi_finished_recipe_items_id"), "semi_finished_recipe_items", ["id"], unique=False)
    if not _index_exists("ix_semi_finished_recipe_items_semi_finished_id", "semi_finished_recipe_items"):
        op.create_index(op.f("ix_semi_finished_recipe_items_semi_finished_id"), "semi_finished_recipe_items", ["semi_finished_id"], unique=False)


def downgrade() -> None:
    # 1. Remove *recipe_items* FK+column FIRST: the column references
    #    semi_finished_items, and batch_alter_table needs the referred table
    #    to exist during reflection. Dropping semi_finished_items before
    #    this step causes a NoSuchTableError.
    op.drop_index(op.f("ix_recipe_items_semi_finished_id"), table_name="recipe_items")
    if _column_exists("recipe_items", "semi_finished_id"):
        with op.batch_alter_table("recipe_items") as batch_op:
            batch_op.drop_column("semi_finished_id")

    # 2. Drop semi_finished_recipe_items (FK to semi_finished_items still valid).
    op.drop_index(op.f("ix_semi_finished_recipe_items_semi_finished_id"), table_name="semi_finished_recipe_items")
    op.drop_index(op.f("ix_semi_finished_recipe_items_id"), table_name="semi_finished_recipe_items")
    op.drop_table("semi_finished_recipe_items")

    # 3. Drop semi_finished_items (all referants gone now).
    op.drop_index(op.f("ix_semi_finished_items_name"), table_name="semi_finished_items")
    op.drop_index(op.f("ix_semi_finished_items_owner_id"), table_name="semi_finished_items")
    op.drop_index(op.f("ix_semi_finished_items_id"), table_name="semi_finished_items")
    op.drop_table("semi_finished_items")
