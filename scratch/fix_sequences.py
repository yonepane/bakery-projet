import sys
import os
from dotenv import load_dotenv

# Load env variables before importing engine
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

# Add backend directory to path so we can import from it
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

from database import engine
from sqlalchemy import text

print("Dialect:", engine.dialect.name)

if engine.dialect.name != 'postgresql':
    print("Not PostgreSQL! Connection string:", engine.url)
    sys.exit(1)

tables_with_sequences = [
    'ingredients',
    'recipe_items',
    'users',
    'waste_records',
    'expenses',
    'suppliers',
    'shift_logs',
    'shift_records'
]

with engine.begin() as conn:
    for table in tables_with_sequences:
        seq_name = f"{table}_id_seq"
        try:
            # Check if sequence exists
            res = conn.execute(text(f"SELECT to_regclass('{seq_name}')")).scalar()
            if res:
                # Reset sequence
                query = text(f"SELECT setval('{seq_name}', COALESCE((SELECT MAX(id) FROM {table}), 1))")
                conn.execute(query)
                print(f"Reset sequence {seq_name}")
            else:
                print(f"Sequence {seq_name} not found")
        except Exception as e:
            print(f"Error resetting {table}: {e}")

print("Done")
