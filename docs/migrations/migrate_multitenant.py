import sqlite3
import os

def migrate():
    db_path = "bakeryos.db"
    backup_path = "bakeryos_pre_saas.db"
    
    if not os.path.exists(db_path):
        print("No database found to migrate.")
        return

    print("Backing up database...")
    os.system(f"cp {db_path} {backup_path}")

    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    # 1. Migrate Users table
    print("Migrating users...")
    c.execute("ALTER TABLE users RENAME TO users_old")
    c.execute("""
    CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT,
        parent_owner_id INTEGER,
        FOREIGN KEY(parent_owner_id) REFERENCES users(id)
    )""")
    c.execute("INSERT INTO users (username, password, role) SELECT username, password, role FROM users_old")
    
    # Get the ID of the first owner (usually admin)
    c.execute("SELECT id FROM users WHERE role='owner' LIMIT 1")
    default_owner_id = c.fetchone()[0]
    print(f"Default Owner ID: {default_owner_id}")

    # 2. Add owner_id to all tables
    tables = [
        "ingredients", "products", "transactions", "orders", 
        "waste_records", "expenses", "suppliers", "purchase_orders"
    ]
    
    for table in tables:
        print(f"Migrating {table}...")
        try:
            c.execute(f"ALTER TABLE {table} ADD COLUMN owner_id INTEGER REFERENCES users(id)")
            c.execute(f"UPDATE {table} SET owner_id = ?", (default_owner_id,))
        except Exception as e:
            print(f"Error migrating {table}: {e}")

    # 3. Handle Recipe Items (needs ingredient_id instead of ingredient_name)
    print("Migrating recipe_items...")
    try:
        c.execute("ALTER TABLE recipe_items RENAME TO recipe_items_old")
        c.execute("""
        CREATE TABLE recipe_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id TEXT,
            ingredient_id INTEGER,
            quantity REAL,
            FOREIGN KEY(product_id) REFERENCES products(id),
            FOREIGN KEY(ingredient_id) REFERENCES ingredients(id)
        )""")
        
        # We need to map ingredient_name to ingredient_id
        # But wait, ingredients table didn't have an ID before.
        # Let's recreate ingredients table with an ID.
        c.execute("ALTER TABLE ingredients RENAME TO ingredients_old")
        c.execute("""
        CREATE TABLE ingredients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            owner_id INTEGER,
            stock REAL,
            unit TEXT,
            price REAL,
            min_threshold REAL,
            supplier TEXT,
            last_purchase_price REAL,
            FOREIGN KEY(owner_id) REFERENCES users(id)
        )""")
        c.execute("""
        INSERT INTO ingredients (name, owner_id, stock, unit, price, min_threshold, supplier, last_purchase_price)
        SELECT name, owner_id, stock, unit, price, min_threshold, supplier, last_purchase_price FROM ingredients_old
        """)
        
        # Now migrate recipe_items
        c.execute("""
        INSERT INTO recipe_items (product_id, ingredient_id, quantity)
        SELECT r.product_id, i.id, r.quantity
        FROM recipe_items_old r
        JOIN ingredients i ON i.name = r.ingredient_name
        """)
    except Exception as e:
        print(f"Error migrating recipes: {e}")

    # 4. Handle System Settings (per owner)
    print("Migrating system_settings...")
    try:
        c.execute("ALTER TABLE system_settings RENAME TO system_settings_old")
        c.execute("""
        CREATE TABLE system_settings (
            key TEXT PRIMARY KEY,
            owner_id INTEGER,
            value TEXT,
            FOREIGN KEY(owner_id) REFERENCES users(id)
        )""")
        c.execute("INSERT INTO system_settings (key, owner_id, value) SELECT key, ?, value FROM system_settings_old", (default_owner_id,))
    except Exception as e:
        print(f"Error migrating settings: {e}")

    conn.commit()
    conn.close()
    print("Migration complete!")

if __name__ == "__main__":
    migrate()
