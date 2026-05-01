"""Add customer loyalty program

Revision ID: 3e9803fe76a2
Revises: b8c6f0974e0a
Create Date: 2026-05-01 21:37:13.757083

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3e9803fe76a2'
down_revision: Union[str, Sequence[str], None] = 'b8c6f0974e0a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('customers',
    sa.Column('id', sa.String(), nullable=False),
    sa.Column('owner_id', sa.Integer(), nullable=True),
    sa.Column('name', sa.String(), nullable=True),
    sa.Column('phone', sa.String(), nullable=True),
    sa.Column('email', sa.String(), nullable=True),
    sa.Column('points', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_customers_id'), 'customers', ['id'], unique=False)
    op.create_index(op.f('ix_customers_name'), 'customers', ['name'], unique=False)
    
    with op.batch_alter_table('orders') as batch_op:
        batch_op.add_column(sa.Column('customer_id', sa.String(), nullable=True))
        batch_op.create_foreign_key('fk_orders_customers', 'customers', ['customer_id'], ['id'])
        
    with op.batch_alter_table('transactions') as batch_op:
        batch_op.add_column(sa.Column('customer_id', sa.String(), nullable=True))
        batch_op.create_foreign_key('fk_transactions_customers', 'customers', ['customer_id'], ['id'])

def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('transactions') as batch_op:
        batch_op.drop_constraint('fk_transactions_customers', type_='foreignkey')
        batch_op.drop_column('customer_id')

    with op.batch_alter_table('orders') as batch_op:
        batch_op.drop_constraint('fk_orders_customers', type_='foreignkey')
        batch_op.drop_column('customer_id')
        
    op.drop_index(op.f('ix_customers_name'), table_name='customers')
    op.drop_index(op.f('ix_customers_id'), table_name='customers')
    op.drop_table('customers')

