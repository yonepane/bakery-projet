import json
import os
from database import engine, SessionLocal, Base
from models import Ingredient, Product, RecipeItem, Transaction
import datetime

# Create tables
Base.metadata.create_all(bind=engine)

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")

def migrate():
    db = SessionLocal()
    
    # 1. Migrate Ingredients
    materials_path = os.path.join(DATA_DIR, 'raw_materials.json')
    if os.path.exists(materials_path):
        with open(materials_path, 'r') as f:
            materials = json.load(f)
            for name, data in materials.items():
                if not db.query(Ingredient).filter(Ingredient.name == name).first():
                    ing = Ingredient(
                        name=name,
                        stock=data['stock'],
                        unit=data['unit'],
                        price=data['price'],
                        min_threshold=data['min_threshold']
                    )
                    db.add(ing)
    
    # 2. Migrate Products & Recipes
    recipes_path = os.path.join(DATA_DIR, 'recipes.json')
    if os.path.exists(recipes_path):
        with open(recipes_path, 'r') as f:
            recipes = json.load(f)
            for r in recipes:
                if not db.query(Product).filter(Product.id == r['id']).first():
                    prod = Product(
                        id=r['id'],
                        name=r['name'],
                        stock=r['stock'],
                        price=r['price'],
                        icon=r.get('icon')
                    )
                    db.add(prod)
                    db.flush() # To ensure prod is in session for relationships
                    
                    for ing_data in r.get('ingredients', []):
                        recipe_item = RecipeItem(
                            product_id=prod.id,
                            ingredient_name=ing_data['name'],
                            quantity=ing_data['quantity']
                        )
                        db.add(recipe_item)

    # 3. Migrate Transactions
    tx_path = os.path.join(DATA_DIR, 'transactions.json')
    if os.path.exists(tx_path):
        with open(tx_path, 'r') as f:
            transactions = json.load(f)
            for tx in transactions:
                if not db.query(Transaction).filter(Transaction.id == tx['id']).first():
                    # Parse timestamp
                    try:
                        ts = datetime.datetime.fromisoformat(tx['timestamp'])
                    except:
                        ts = datetime.datetime.now(datetime.timezone.utc)
                        
                    transaction = Transaction(
                        id=tx['id'],
                        timestamp=ts,
                        type=tx.get('type', 'sale'),
                        total_revenue=tx.get('revenue', 0),
                        total_cost=tx.get('cost', 0),
                        items=tx.get('items', []) # Store snapshot in JSON field
                    )
                    db.add(transaction)

    db.commit()
    db.close()
    print("Migration completed successfully.")

if __name__ == "__main__":
    migrate()
