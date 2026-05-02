from dotenv import load_dotenv
import os
from sqlalchemy import create_engine, text, MetaData

load_dotenv()
url = os.getenv("DATABASE_URL")
if not url:
    print("URL not found")
    exit(1)

engine = create_engine(url)
metadata = MetaData()
metadata.reflect(bind=engine)

print("🗑️ Clearing Supabase database...")
with engine.begin() as conn:
    # Disable foreign key checks for truncation (PostgreSQL)
    for table in reversed(metadata.sorted_tables):
        print(f"Dropping table: {table.name}")
        conn.execute(text(f"DROP TABLE IF EXISTS \"{table.name}\" CASCADE"))
    
    # Also drop alembic_version if it exists
    conn.execute(text("DROP TABLE IF EXISTS alembic_version CASCADE"))

print("✅ Supabase is now empty.")
