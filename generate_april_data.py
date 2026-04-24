import sqlite3
import uuid
import random
from datetime import datetime, timedelta

# Seed script that creates a bit of realistic April 2026 activity so analytics,
# accounting, and charts have something non-empty to work with in demos.
db_path = 'bakery-os/bakeryos.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Attach the generated rows to the first owner account in the database.
cursor.execute("SELECT id FROM users WHERE role = 'owner' LIMIT 1")
owner_id = cursor.fetchone()[0]

# Generate a spread of sale transactions across the month.
start_date = datetime(2026, 4, 1)
for i in range(30): # 30 transactions
    tx_date = start_date + timedelta(days=random.randint(0, 21), hours=random.randint(8, 18))
    tx_id = str(uuid.uuid4())[:8].upper()
    revenue = random.uniform(50, 500)
    cost = revenue * random.uniform(0.3, 0.6)
    
    cursor.execute("""
        INSERT INTO transactions (id, owner_id, timestamp, type, total_revenue, total_cost, items)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (tx_id, owner_id, tx_date.isoformat(), 'sale', revenue, cost, '[]'))

# Add a few fixed expenses so profit reporting has deductions to display.
for i in range(5):
    ex_date = start_date + timedelta(days=random.randint(0, 21))
    cursor.execute("""
        INSERT INTO expenses (owner_id, category, amount, date, description)
        VALUES (?, ?, ?, ?, ?)
    """, (owner_id, 'Rent', random.uniform(1000, 2000), ex_date.isoformat(), 'Monthly Rent'))

conn.commit()
conn.close()
print("Generated April 2026 data.")
