"""add missing ingredient fields

Revision ID: df7ded3636b2
Revises: 00010
Create Date: 2026-07-10 19:10:05.021452

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'df7ded3636b2'
down_revision: Union[str, Sequence[str], None] = '00010'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('ingredients', schema=None) as batch_op:
        batch_op.add_column(sa.Column('allergens', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('is_organic', sa.Boolean(), nullable=True))
        batch_op.add_column(sa.Column('purchase_unit', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('purchase_to_base_ratio', sa.Float(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('ingredients', schema=None) as batch_op:
        batch_op.drop_column('purchase_to_base_ratio')
        batch_op.drop_column('purchase_unit')
        batch_op.drop_column('is_organic')
        batch_op.drop_column('allergens')
