import sqlite3
import os
from sqlalchemy import create_engine
import pandas as pd
from dotenv import load_dotenv

# Load env from root
load_dotenv()

# CONFIGURATION
SUPABASE_URL = os.getenv("DATABASE_URL")
# Use absolute path to the backend database
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOCAL_DB = os.path.join(BASE_DIR, "bakeryos.db")

if not SUPABASE_URL:
    print("ERREUR : Vous devez définir la variable DATABASE_URL")
    exit(1)

if not os.path.exists(LOCAL_DB):
    print(f"ERREUR : Base de données locale introuvable à {LOCAL_DB}")
    exit(1)

print(f"🚀 Démarrage de la migration de {LOCAL_DB} vers le Cloud...")

# Connexions
local_conn = sqlite3.connect(LOCAL_DB)
cloud_engine = create_engine(SUPABASE_URL)

# Tables à migrer dans l'ordre des dépendances
tables = [
    "users",
    "ingredients",
    "products",
    "recipe_items",
    "transactions",
    "orders",
    "waste_records",
    "expenses",
    "suppliers",
    "purchase_orders",
    "system_settings",
    "planner"
]

try:
    for table in tables:
        print(f"📦 Migration de la table : {table}...")
        # Lire les données locales
        df = pd.read_sql_query(f"SELECT * FROM {table}", local_conn)
        
        if not df.empty:
            # FIX: PostgreSQL strict boolean types
            if table == "purchase_orders" and "archived" in df.columns:
                df["archived"] = df["archived"].astype(bool)

            # Envoyer vers le Cloud
            df.to_sql(table, cloud_engine, if_exists='append', index=False)
            print(f"✅ {len(df)} lignes transférées.")
        else:
            print(f"ℹ️ Table {table} vide, passage à la suivante.")

    print("\n✨ FÉLICITATIONS ! Votre boulangerie est maintenant dans le Cloud.")

except Exception as e:
    print(f"\n❌ ERREUR pendant la migration : {e}")
finally:
    local_conn.close()
