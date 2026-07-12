import json
import os
from database import SessionLocal
from models import Ingredient, Product, RecipeItem, User

def seed(username: str):
    db = SessionLocal()
    user = db.query(User).filter(User.username == username).first()
    if not user:
        print(f"User {username} not found.")
        db.close()
        return
    
    owner_id = user.id
    print(f"Seeding for user {username} with ID {owner_id}")
    
    DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
    
    # 1. Ingredients
    materials_path = os.path.join(DATA_DIR, 'raw_materials.json')
    ingredient_mapping = {}
    if os.path.exists(materials_path):
        with open(materials_path, 'r') as f:
            materials = json.load(f)
            for name, data in materials.items():
                # Since ingredient names might also be unique, we should prefix ingredient names or search by name + owner_id
                # Let's check: ingredient has owner_id in composite or unique?
                # Models.py says:
                # class Ingredient(Base):
                #     id = Column(Integer, primary_key=True, index=True)
                #     name = Column(String, index=True)
                #     owner_id = Column(Integer, ForeignKey("users.id"))
                # So ingredients table has an autoincrement integer PK 'id'. The name is not the PK! So name + owner_id is fine.
                ing = db.query(Ingredient).filter(Ingredient.name == name, Ingredient.owner_id == owner_id).first()
                if not ing:
                    ing = Ingredient(
                        name=name,
                        owner_id=owner_id,
                        stock=data['stock'],
                        unit=data['unit'],
                        price=data['price'],
                        min_threshold=data['min_threshold']
                    )
                    db.add(ing)
                    db.flush()
                ingredient_mapping[name] = ing.id
    
    # 2. Products & Recipes
    recipes_path = os.path.join(DATA_DIR, 'recipes.json')
    if os.path.exists(recipes_path):
        with open(recipes_path, 'r') as f:
            recipes = json.load(f)
            for r in recipes:
                # Use a unique product ID per owner, e.g. "p1_8"
                unique_prod_id = f"{r['id']}_{owner_id}"
                prod = db.query(Product).filter(Product.id == unique_prod_id, Product.owner_id == owner_id).first()
                if not prod:
                    prod = Product(
                        id=unique_prod_id,
                        owner_id=owner_id,
                        name=r['name'],
                        stock=r['stock'],
                        price=r['price'],
                        icon=r.get('icon')
                    )
                    db.add(prod)
                    db.flush()
                    
                    for ing_data in r.get('ingredients', []):
                        ing_id = ingredient_mapping.get(ing_data['name'])
                        if ing_id:
                            recipe_item = RecipeItem(
                                product_id=prod.id,
                                ingredient_id=ing_id,
                                quantity=ing_data['quantity']
                            )
                            db.add(recipe_item)

    db.commit()
    db.close()
    print("Seeding completed successfully.")

if __name__ == "__main__":
    seed("chef_executif")
