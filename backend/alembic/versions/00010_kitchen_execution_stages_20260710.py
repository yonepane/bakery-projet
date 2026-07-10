"""kitchen execution stages

Revision ID: 00010
Revises: 00009
Create Date: 2026-07-10
"""
from alembic import op
import sqlalchemy as sa

revision = '00010'
down_revision = '00009'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        'production_batches',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('owner_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True, index=True),
        sa.Column('product_id', sa.String(), sa.ForeignKey('products.id'), nullable=True, index=True),
        sa.Column('quantity', sa.Float(), nullable=True),
        sa.Column('stage', sa.String(), nullable=True, index=True),
        sa.Column('planned_for_date', sa.String(), nullable=True, index=True),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('notes', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_production_batches_id', 'production_batches', ['id'])

def downgrade() -> None:
    op.drop_index('ix_production_batches_id', table_name='production_batches')
    op.drop_table('production_batches')
