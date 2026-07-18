"""Initial migration

Revision ID: b8c6f0974e0a
Revises: 
Create Date: 2026-04-28 00:08:32.940984

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = 'b8c6f0974e0a'
down_revision: Union[str, Sequence[str], None] = '0000bootstrap'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table_name: str) -> bool:
    return table_name in inspect(op.get_bind()).get_table_names()


def _existing_indexes(table_name: str) -> set[str]:
    """Return the set of index names that currently exist for a table."""
    bind = op.get_bind()
    try:
        return {ix["name"] for ix in inspect(bind).get_indexes(table_name)}
    except Exception:
        return set()


def _index_exists(index_name: str, table_name: str) -> bool:
    return index_name in _existing_indexes(table_name)


def drop_index_if_exists(index_name: str, table_name: str) -> None:
    if _index_exists(index_name, table_name):
        op.drop_index(op.f(index_name), table_name=table_name)


def drop_table_if_exists(table_name: str) -> None:
    bind = op.get_bind()
    if table_name in inspect(bind).get_table_names():
        # Drop indexes that reference this table first to avoid dangling
        # index references on some dialects.
        for ix_name in list(_existing_indexes(table_name)):
            op.drop_index(op.f(ix_name), table_name=table_name)
        op.drop_table(table_name)


def create_index_if_not_exists(index_name: str, table_name: str, columns: list, unique: bool = False) -> None:
    if index_name not in _existing_indexes(table_name):
        op.create_index(op.f(index_name), table_name, columns, unique=unique)


def _drop_fk_on_column(table_name: str, column_name: str) -> None:
    """Find and drop the FK constraint on table_name whose constrained
    column is column_name, by its real (reflected) name.

    Passing None as a constraint name to op.drop_constraint() only works
    on SQLite, where render_as_batch=True recreates the whole table from
    reflected state rather than emitting a literal DROP CONSTRAINT. On
    PostgreSQL there is no such fallback -- the name must be real. This
    is a safe no-op if no matching FK currently exists (e.g. an earlier
    step in this same migration already removed it).
    """
    bind = op.get_bind()
    for fk in inspect(bind).get_foreign_keys(table_name):
        if column_name in fk.get("constrained_columns", []):
            name = fk.get("name")
            if name:
                op.drop_constraint(name, table_name, type_="foreignkey")
            return


def upgrade() -> None:
    """Upgrade schema."""
    # The original autogenerate produced index/table drops against legacy
    # `*_old` artifacts left over from an earlier hand-migration. On a fresh
    # DB (bootstrapped by 00000) those objects do not exist, so the drops are
    # guarded here. On legacy DBs that DO still carry the `*_old` tables the
    # cleanup still runs as before.
    # 1. Legacy cleanup (all dialects — already guarded with if-exists helpers)
    drop_index_if_exists('ix_ingredients_name', 'ingredients_old')
    drop_table_if_exists('ingredients_old')
    drop_index_if_exists('ix_recipe_items_id', 'recipe_items_old')
    drop_table_if_exists('recipe_items_old')
    drop_index_if_exists('ix_users_username', 'users_old')
    drop_table_if_exists('users_old')
    drop_table_if_exists('system_settings_old')

    is_sqlite = op.get_bind().dialect.name == 'sqlite'

    # 2. Column-type changes (TEXT → String, REAL → Float, INTEGER → nullable=False autoincrement).
    # These are NOT supported on SQLite (ALTER COLUMN TYPE is PostgreSQL-only) and are a no-op
    # on a bootstrap-created DB anyway because the 00000 bootstrap already uses the modern types.
    # Source 0003/0004 already skip these on SQLite; apply the same pattern here.
    if not is_sqlite:
        # expenses
        op.alter_column('expenses', 'id',
                   existing_type=sa.INTEGER(),
                   nullable=False,
                   autoincrement=True)
        op.alter_column('expenses', 'category',
                   existing_type=sa.TEXT(),
                   type_=sa.String(),
                   existing_nullable=True)
        op.alter_column('expenses', 'amount',
                   existing_type=sa.REAL(),
                   type_=sa.Float(),
                   existing_nullable=True)
        op.alter_column('expenses', 'description',
                   existing_type=sa.TEXT(),
                   type_=sa.String(),
                   existing_nullable=True)
        # ingredients
        op.alter_column('ingredients', 'id',
                   existing_type=sa.INTEGER(),
                   nullable=False,
                   autoincrement=True)
        op.alter_column('ingredients', 'name',
                   existing_type=sa.TEXT(),
                   type_=sa.String(),
                   existing_nullable=True)
        op.alter_column('ingredients', 'stock',
                   existing_type=sa.REAL(),
                   type_=sa.Float(),
                   existing_nullable=True)
        op.alter_column('ingredients', 'unit',
                   existing_type=sa.TEXT(),
                   type_=sa.String(),
                   existing_nullable=True)
        op.alter_column('ingredients', 'price',
                   existing_type=sa.REAL(),
                   type_=sa.Float(),
                   existing_nullable=True)
        op.alter_column('ingredients', 'min_threshold',
                   existing_type=sa.REAL(),
                   type_=sa.Float(),
                   existing_nullable=True)
        op.alter_column('ingredients', 'supplier',
                   existing_type=sa.TEXT(),
                   type_=sa.String(),
                   existing_nullable=True)
        op.alter_column('ingredients', 'last_purchase_price',
                   existing_type=sa.REAL(),
                   type_=sa.Float(),
                   existing_nullable=True)
        # recipe_items
        op.alter_column('recipe_items', 'id',
                   existing_type=sa.INTEGER(),
                   nullable=False,
                   autoincrement=True)
        op.alter_column('recipe_items', 'product_id',
                   existing_type=sa.TEXT(),
                   type_=sa.String(),
                   existing_nullable=True)
        op.alter_column('recipe_items', 'quantity',
                   existing_type=sa.REAL(),
                   type_=sa.Float(),
                   existing_nullable=True)
        _drop_fk_on_column('recipe_items', 'ingredient_id')
        # system_settings
        op.alter_column('system_settings', 'key',
                   existing_type=sa.TEXT(),
                   type_=sa.String(),
                   nullable=False)
        op.alter_column('system_settings', 'owner_id',
                   existing_type=sa.INTEGER(),
                   nullable=False)
        op.alter_column('system_settings', 'value',
                   existing_type=sa.TEXT(),
                   type_=sa.String(),
                   existing_nullable=True)
        # users
        op.alter_column('users', 'id',
                   existing_type=sa.INTEGER(),
                   nullable=False,
                   autoincrement=True)
        op.alter_column('users', 'username',
                   existing_type=sa.TEXT(),
                   type_=sa.String(),
                   existing_nullable=True)
        op.alter_column('users', 'password',
                   existing_type=sa.TEXT(),
                   type_=sa.String(),
                   existing_nullable=True)
        op.alter_column('users', 'role',
                   existing_type=sa.TEXT(),
                   type_=sa.String(),
                   existing_nullable=True)

    # 3. Index creation and FK repair (supported on all dialects)
    create_index_if_not_exists('ix_expenses_id', 'expenses', ['id'])
    create_index_if_not_exists('ix_ingredients_id', 'ingredients', ['id'])
    create_index_if_not_exists('ix_ingredients_name', 'ingredients', ['name'])
    create_index_if_not_exists('ix_recipe_items_id', 'recipe_items', ['id'])

    if not is_sqlite:
        op.create_foreign_key(None, 'recipe_items', 'ingredients', ['ingredient_id'], ['id'])

    drop_index_if_exists('ix_suppliers_name', 'suppliers')
    create_index_if_not_exists('ix_suppliers_name', 'suppliers', ['name'])

    create_index_if_not_exists('ix_users_id', 'users', ['id'])
    create_index_if_not_exists('ix_users_username', 'users', ['username'], unique=True)
    # ### end Alembic commands ###


def downgrade() -> None:
    """Downgrade schema."""
    is_sqlite = op.get_bind().dialect.name == 'sqlite'
    # ### commands auto generated by Alembic - please adjust! ###
    drop_index_if_exists('ix_users_username', 'users')
    drop_index_if_exists('ix_users_id', 'users')
    if not is_sqlite:
        op.alter_column('users', 'role',
                   existing_type=sa.String(),
                   type_=sa.TEXT(),
                   existing_nullable=True)
        op.alter_column('users', 'password',
                   existing_type=sa.String(),
                   type_=sa.TEXT(),
                   existing_nullable=True)
        op.alter_column('users', 'username',
                   existing_type=sa.String(),
                   type_=sa.TEXT(),
                   existing_nullable=True)
        op.alter_column('users', 'id',
                   existing_type=sa.INTEGER(),
                   nullable=True,
                   autoincrement=True)
        op.alter_column('system_settings', 'value',
                   existing_type=sa.String(),
                   type_=sa.TEXT(),
                   existing_nullable=True)
        op.alter_column('system_settings', 'owner_id',
                   existing_type=sa.INTEGER(),
                   nullable=True)
        op.alter_column('system_settings', 'key',
                   existing_type=sa.String(),
                   type_=sa.TEXT(),
                   nullable=True)
    drop_index_if_exists('ix_suppliers_name', 'suppliers')
    if 'ix_suppliers_name' not in _existing_indexes('suppliers'):
        op.create_index(op.f('ix_suppliers_name'), 'suppliers', ['name'], unique=1)
    if not is_sqlite:
        _drop_fk_on_column('recipe_items', 'ingredient_id')
        op.create_foreign_key(None, 'recipe_items', 'ingredients_old', ['ingredient_id'], ['id'])
    drop_index_if_exists('ix_recipe_items_id', 'recipe_items')
    if not is_sqlite:
        op.alter_column('recipe_items', 'quantity',
                   existing_type=sa.Float(),
                   type_=sa.REAL(),
                   existing_nullable=True)
        op.alter_column('recipe_items', 'product_id',
                   existing_type=sa.String(),
                   type_=sa.TEXT(),
                   existing_nullable=True)
        op.alter_column('recipe_items', 'id',
                   existing_type=sa.INTEGER(),
                   nullable=True,
                   autoincrement=True)
    drop_index_if_exists('ix_ingredients_name', 'ingredients')
    drop_index_if_exists('ix_ingredients_id', 'ingredients')
    if not is_sqlite:
        op.alter_column('ingredients', 'last_purchase_price',
                   existing_type=sa.Float(),
                   type_=sa.REAL(),
                   existing_nullable=True)
        op.alter_column('ingredients', 'supplier',
                   existing_type=sa.String(),
                   type_=sa.TEXT(),
                   existing_nullable=True)
        op.alter_column('ingredients', 'min_threshold',
                   existing_type=sa.Float(),
                   type_=sa.REAL(),
                   existing_nullable=True)
        op.alter_column('ingredients', 'price',
                   existing_type=sa.Float(),
                   type_=sa.REAL(),
                   existing_nullable=True)
        op.alter_column('ingredients', 'unit',
                   existing_type=sa.String(),
                   type_=sa.TEXT(),
                   existing_nullable=True)
        op.alter_column('ingredients', 'stock',
                   existing_type=sa.Float(),
                   type_=sa.REAL(),
                   existing_nullable=True)
        op.alter_column('ingredients', 'name',
                   existing_type=sa.String(),
                   type_=sa.TEXT(),
                   existing_nullable=True)
        op.alter_column('ingredients', 'id',
                   existing_type=sa.INTEGER(),
                   nullable=True,
                   autoincrement=True)
    drop_index_if_exists('ix_expenses_id', 'expenses')
    if not is_sqlite:
        op.alter_column('expenses', 'description',
                   existing_type=sa.String(),
                   type_=sa.TEXT(),
                   existing_nullable=True)
        op.alter_column('expenses', 'amount',
                   existing_type=sa.Float(),
                   type_=sa.REAL(),
                   existing_nullable=True)
        op.alter_column('expenses', 'category',
                   existing_type=sa.String(),
                   type_=sa.TEXT(),
                   existing_nullable=True)
        op.alter_column('expenses', 'id',
                   existing_type=sa.INTEGER(),
                   nullable=True,
                   autoincrement=True)
    if not _table_exists('system_settings_old'):
        op.create_table('system_settings_old',
        sa.Column('key', sa.TEXT(), nullable=True),
        sa.Column('value', sa.TEXT(), nullable=True),
        sa.PrimaryKeyConstraint('key')
        )
    if not _table_exists('users_old'):
        op.create_table('users_old',
        sa.Column('username', sa.VARCHAR(), nullable=False),
        sa.Column('password', sa.VARCHAR(), nullable=True),
        sa.Column('role', sa.VARCHAR(), nullable=True),
        sa.PrimaryKeyConstraint('username')
        )
    if not _index_exists('ix_users_username', 'users_old'):
        op.create_index(op.f('ix_users_username'), 'users_old', ['username'], unique=False)
    if not _table_exists('recipe_items_old'):
        op.create_table('recipe_items_old',
        sa.Column('id', sa.INTEGER(), nullable=False),
        sa.Column('product_id', sa.VARCHAR(), nullable=True),
        sa.Column('ingredient_name', sa.VARCHAR(), nullable=True),
        sa.Column('quantity', sa.FLOAT(), nullable=True),
        sa.ForeignKeyConstraint(['ingredient_name'], ['ingredients_old.name'], ),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ),
        sa.PrimaryKeyConstraint('id')
        )
    if not _index_exists('ix_recipe_items_id', 'recipe_items_old'):
        op.create_index(op.f('ix_recipe_items_id'), 'recipe_items_old', ['id'], unique=False)
    if not _table_exists('ingredients_old'):
        op.create_table('ingredients_old',
        sa.Column('name', sa.VARCHAR(), nullable=False),
        sa.Column('stock', sa.FLOAT(), nullable=True),
        sa.Column('unit', sa.VARCHAR(), nullable=True),
        sa.Column('price', sa.FLOAT(), nullable=True),
        sa.Column('min_threshold', sa.FLOAT(), nullable=True),
        sa.Column('supplier', sa.VARCHAR(), nullable=True),
        sa.Column('last_purchase_price', sa.FLOAT(), nullable=True),
        sa.Column('owner_id', sa.INTEGER(), nullable=True),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('name')
        )
    if not _index_exists('ix_ingredients_name', 'ingredients_old'):
        op.create_index(op.f('ix_ingredients_name'), 'ingredients_old', ['name'], unique=False)
    # ### end Alembic commands ###
