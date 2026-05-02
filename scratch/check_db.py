from dotenv import load_dotenv
import os
from sqlalchemy import create_engine, text

load_dotenv()
url = os.getenv("DATABASE_URL")
if not url:
    print("URL not found")
    exit(1)

engine = create_engine(url)
with engine.connect() as conn:
    res = conn.execute(text("SELECT id, username FROM users"))
    print(res.fetchall())
