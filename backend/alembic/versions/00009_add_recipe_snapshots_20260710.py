"""Add recipe_snapshots table.

Revision ID: 00009
Revises: 00008
Create Date: 2026-07-10
"""
from alembic import op
import sqlalchemy as sa

revision = '00009'
down_revision = '20260707semifin'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'recipe_snapshots',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('owner_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True, index=True),
        sa.Column('product_id', sa.String(), sa.ForeignKey('products.id'), nullable=True, index=True),
        sa.Column('changed_at', sa.DateTime(), nullable=True, index=True),
        sa.Column('changed_by_user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('snapshot', sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_recipe_snapshots_id', 'recipe_snapshots', ['id'])


def downgrade() -> None:
    op.drop_index('ix_recipe_snapshots_id', table_name='recipe_snapshots')
    op.drop_table('recipe_snapshots')
