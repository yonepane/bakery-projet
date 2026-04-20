import json
import os
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from database import engine, SessionLocal, Base, get_db
import models

# Create tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="BakeryOS API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend", "dist")

# Pydantic models for request/response
class IngredientItem(BaseModel):
    name: str
    quantity: float

class ProductionBatch(BaseModel):
    product_id: str
    quantity: int

class SaleItem(BaseModel):
    id: str
    qty: int

class SaleRequest(BaseModel):
    cart: List[SaleItem]

class MaterialCreate(BaseModel):
    name: str
    price: float
    unit: str
    min_threshold: float

class ProductCreate(BaseModel):
    id: str
    name: str
    price: float
    icon: str
    ingredients: List[IngredientItem]

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None
    icon: Optional[str] = None
    ingredients: Optional[List[IngredientItem]] = None

class LoginRequest(BaseModel):
    username: str
    password: str

class OrderCreate(BaseModel):
    customer_name: str
    customer_phone: Optional[str] = None
    items: List[SaleItem]
    deposit_paid: float = 0
    pickup_date: str

class WasteCreate(BaseModel):
    product_id: str
    quantity: int

# Helper functions
def calculate_product_cost(product: models.Product):
    total_cost = 0
    for item in product.recipe_items:
        if item.ingredient:
            total_cost += item.quantity * item.ingredient.price
    return total_cost

def get_settings():
    # Keep settings in JSON for now as it's small and rarely changed, 
    # or migrate to a Settings table later.
    settings_path = os.path.join(DATA_DIR, 'settings.json')
    if os.path.exists(settings_path):
        with open(settings_path, 'r') as f:
            return json.load(f)
    return {"currency": "MAD", "tax_rate": 0.2}

@app.get("/api/seed")
async def seed_users(db: Session = Depends(get_db)):
    if not db.query(models.User).first():
        db.add(models.User(username="admin", password="password", role="owner"))
        db.add(models.User(username="cashier", password="password", role="cashier"))
        db.commit()
    return {"message": "Users seeded. Use admin/password or cashier/password."}

@app.post("/api/auth/login")
async def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == req.username).first()
    if not user or user.password != req.password:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return {"username": user.username, "role": user.role}

# Orders
@app.get("/api/orders")
async def get_orders(db: Session = Depends(get_db)):
    return db.query(models.Order).order_by(models.Order.pickup_date.asc()).all()

@app.post("/api/orders")
async def create_order(order_data: OrderCreate, db: Session = Depends(get_db)):
    total_price = 0
    items_snapshot = []
    
    for item in order_data.items:
        product = db.query(models.Product).filter(models.Product.id == item.id).first()
        if product:
            total_price += product.price * item.qty
            items_snapshot.append({
                "id": product.id,
                "name": product.name,
                "qty": item.qty,
                "price": product.price
            })
            
    new_order = models.Order(
        id=str(uuid.uuid4())[:8].upper(),
        customer_name=order_data.customer_name,
        customer_phone=order_data.customer_phone,
        items=items_snapshot,
        total_price=total_price,
        deposit_paid=order_data.deposit_paid,
        pickup_date=datetime.fromisoformat(order_data.pickup_date),
        status="pending"
    )
    db.add(new_order)
    db.commit()
    return new_order

@app.patch("/api/orders/{id}/status")
async def update_order_status(id: str, status: str, db: Session = Depends(get_db)):
    order = db.query(models.Order).filter(models.Order.id == id).first()
    if order:
        order.status = status
        db.commit()
        return order
    raise HTTPException(status_code=404, detail="Order not found")

# Waste
@app.post("/api/waste")
async def record_waste(waste: WasteCreate, db: Session = Depends(get_db)):
    product = db.query(models.Product).filter(models.Product.id == waste.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    if product.stock < waste.quantity:
        raise HTTPException(status_code=400, detail="Not enough stock to waste")
        
    product.stock -= waste.quantity
    loss_cost = calculate_product_cost(product) * waste.quantity
    
    record = models.WasteRecord(
        product_id=waste.product_id,
        quantity=waste.quantity,
        loss_cost=loss_cost
    )
    db.add(record)
    db.commit()
    return {"success": True}

@app.get("/api/inventory")
async def inventory(db: Session = Depends(get_db)):
    ingredients = db.query(models.Ingredient).all()
    products = db.query(models.Product).all()
    
    # Map to frontend format
    materials_dict = {
        ing.name: {
            "stock": ing.stock,
            "unit": ing.unit,
            "price": ing.price,
            "min_threshold": ing.min_threshold
        } for ing in ingredients
    }
    
    products_list = []
    for p in products:
        products_list.append({
            "id": p.id,
            "name": p.name,
            "stock": p.stock,
            "price": p.price,
            "icon": p.icon,
            "live_cost": calculate_product_cost(p),
            "ingredients": [{"name": i.ingredient_name, "quantity": i.quantity} for i in p.recipe_items]
        })
        
    return {
        "materials": materials_dict,
        "products": products_list
    }

@app.get("/api/history")
async def get_history(db: Session = Depends(get_db)):
    transactions = db.query(models.Transaction).order_by(models.Transaction.timestamp.desc()).all()
    return [
        {
            "id": tx.id,
            "timestamp": tx.timestamp.isoformat(),
            "type": tx.type,
            "revenue": tx.total_revenue,
            "cost": tx.total_cost,
            "profit": tx.total_revenue - tx.total_cost,
            "items": tx.items
        } for tx in transactions
    ]

@app.get("/api/planner")
async def get_planner():
    planner_path = os.path.join(DATA_DIR, 'planner.json')
    if os.path.exists(planner_path):
        with open(planner_path, 'r') as f:
            return json.load(f)
    return []

@app.post("/api/planner")
async def update_planner(plan: List[Dict]):
    with open(os.path.join(DATA_DIR, 'planner.json'), 'w') as f:
        json.dump(plan, f, indent=4)
    return {"success": True}

@app.get("/api/settings")
async def get_settings_api():
    return get_settings()

@app.post("/api/produce")
async def produce(batch: ProductionBatch, db: Session = Depends(get_db)):
    product = db.query(models.Product).filter(models.Product.id == batch.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    production_cost = 0
    # Check and deduct ingredients
    for item in product.recipe_items:
        ing = db.query(models.Ingredient).filter(models.Ingredient.name == item.ingredient_name).first()
        required = item.quantity * batch.quantity
        if not ing or ing.stock < required:
            raise HTTPException(status_code=400, detail=f"Insufficient {item.ingredient_name}")
        ing.stock -= required
        production_cost += required * ing.price

    product.stock += batch.quantity
    
    # Create transaction
    tx_id = str(uuid.uuid4())[:8].upper()
    transaction = models.Transaction(
        id=tx_id,
        timestamp=datetime.utcnow(),
        type="production",
        total_revenue=0,
        total_cost=production_cost,
        items=[{"name": product.name, "qty": batch.quantity}]
    )
    db.add(transaction)
    db.commit()
    
    return {"success": True, "new_stock": product.stock}

@app.post("/api/complete")
async def complete_sale(req: SaleRequest, db: Session = Depends(get_db)):
    total_revenue = 0
    total_cost = 0
    items_snapshot = []

    for item in req.cart:
        product = db.query(models.Product).filter(models.Product.id == item.id).first()
        if not product: continue
        
        if product.stock < item.qty:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for {product.name}")
            
        product.stock -= item.qty
        cost = calculate_product_cost(product)
        
        total_revenue += product.price * item.qty
        total_cost += cost * item.qty
        items_snapshot.append({
            "id": product.id,
            "name": product.name,
            "qty": item.qty,
            "price": product.price,
            "cost": cost
        })

    tx_id = str(uuid.uuid4())[:8].upper()
    transaction = models.Transaction(
        id=tx_id,
        timestamp=datetime.utcnow(),
        type="sale",
        total_revenue=total_revenue,
        total_cost=total_cost,
        items=items_snapshot
    )
    
    db.add(transaction)
    db.commit()
    
    # Generate simple WhatsApp text
    whatsapp_text = f"BAKERY OS: Receipt {tx_id}\n"
    for item in items_snapshot:
        whatsapp_text += f"- {item['name']} x{item['qty']}\n"
    whatsapp_text += f"\nTOTAL: {total_revenue} {get_settings().get('currency', 'MAD')}\nMerci de votre visite! 🥐"

    return {"success": True, "transaction_id": tx_id, "whatsapp_text": whatsapp_text}

@app.get("/api/transactions/{id}/receipt")
async def get_receipt(id: str, db: Session = Depends(get_db)):
    tx = db.query(models.Transaction).filter(models.Transaction.id == id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    settings = get_settings()
    currency = settings.get("currency", "MAD")
    
    html_content = f"""
    <html>
    <head>
        <title>Receipt - {tx.id}</title>
        <style>
            body {{ font-family: 'Courier New', Courier, monospace; width: 300px; margin: 0 auto; padding: 20px; border: 1px solid #eee; background: white; color: black; }}
            .center {{ text-align: center; }}
            .header {{ font-weight: bold; font-size: 20px; margin-bottom: 5px; }}
            .separator {{ border-bottom: 1px dashed #000; margin: 10px 0; }}
            .item {{ display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 14px; }}
            .total {{ font-weight: bold; display: flex; justify-content: space-between; margin-top: 10px; font-size: 16px; }}
            .footer {{ font-size: 12px; margin-top: 20px; color: #666; }}
            @media print {{
                body {{ border: none; padding: 0; width: 100%; }}
                .no-print {{ display: none; }}
            }}
            .print-btn {{ background: #000; color: #fff; border: none; padding: 10px 20px; cursor: pointer; border-radius: 5px; margin-bottom: 20px; width: 100%; }}
        </style>
    </head>
    <body>
        <div class="no-print">
            <button class="print-btn" onclick="window.print()">PRINT RECEIPT</button>
        </div>
        <div class="center">
            <div class="header">BAKERY OS</div>
            <div>Luxe Boulangerie Patisserie</div>
            <div class="separator"></div>
            <div>ID: {tx.id}</div>
            <div>{tx.timestamp.strftime('%Y-%m-%d %H:%M:%S')}</div>
            <div class="separator"></div>
        </div>
        
        <div class="items">
    """
    
    if tx.items:
        for item in tx.items:
            html_content += f"""
            <div class="item">
                <span>{item.get('name', 'Product')} x{item.get('qty', 1)}</span>
                <span>{round(item.get('price', 0) * item.get('qty', 1), 2)} {currency}</span>
            </div>
            """
            
    html_content += f"""
        </div>
        <div class="separator"></div>
        <div class="total">
            <span>TOTAL</span>
            <span>{round(tx.total_revenue, 2)} {currency}</span>
        </div>
        <div class="separator"></div>
        <div class="center footer">
            THANK YOU FOR YOUR VISIT!<br>
            Merci de votre visite!<br>
            www.bakeryos.app
        </div>
    </body>
    </html>
    """
    
    from fastapi.responses import HTMLResponse
    return HTMLResponse(content=html_content)

@app.get("/api/analytics")
async def analytics(db: Session = Depends(get_db)):
    transactions = db.query(models.Transaction).all()
    waste_total = sum(w.loss_cost for w in db.query(models.WasteRecord).all())
    settings = get_settings()
    
    total_revenue = sum(t.total_revenue for t in transactions if t.type == 'sale')
    total_cost = sum(t.total_cost for t in transactions) + waste_total
    
    # Generate daily data for chart (last 7 days)
    daily_data = []
    now = datetime.now()
    for i in range(6, -1, -1):
        day = now - timedelta(days=i)
        day_str = day.strftime('%a')
        
        # Filter transactions for this day
        start_of_day = datetime(day.year, day.month, day.day)
        end_of_day = start_of_day + timedelta(days=1)
        
        day_txs = db.query(models.Transaction).filter(
            models.Transaction.timestamp >= start_of_day,
            models.Transaction.timestamp < end_of_day
        ).all()
        
        daily_data.append({
            "name": day_str,
            "revenue": sum(t.total_revenue for t in day_txs if t.type == 'sale'),
            "cost": sum(t.total_cost for t in day_txs)
        })

    return {
        "revenue": round(total_revenue, 2),
        "cost": round(total_cost, 2),
        "currency": settings.get("currency", "MAD"),
        "chartData": daily_data
    }

@app.get("/api/alerts")
async def get_alerts(db: Session = Depends(get_db)):
    ingredients = db.query(models.Ingredient).all()
    products = db.query(models.Product).all()
    
    alerts = []
    
    # Stock alerts
    for ing in ingredients:
        if ing.stock < ing.min_threshold:
            alerts.append({
                "type": "stock",
                "severity": "high" if ing.stock < ing.min_threshold / 2 else "medium",
                "message": f"Low stock: {ing.name} ({ing.stock}{ing.unit})",
                "id": f"stock-{ing.name}"
            })
            
    # Margin alerts
    for p in products:
        cost = calculate_product_cost(p)
        margin = ((p.price - cost) / p.price * 100) if p.price > 0 else 0
        if margin < 30:
            alerts.append({
                "type": "margin",
                "severity": "medium",
                "message": f"Low margin on {p.name}: {round(margin, 1)}%",
                "id": f"margin-{p.id}"
            })
            
    return alerts

@app.post("/api/simulate_price")
async def simulate_price(materials_update: Dict[str, float], db: Session = Depends(get_db)):
    # Calculate impact on product costs without saving
    impact = []
    products = db.query(models.Product).all()
    
    # Create a temporary mapping for simulation
    all_ingredients = {ing.name: ing for ing in db.query(models.Ingredient).all()}
    
    for p in products:
        old_cost = calculate_product_cost(p)
        
        # Calculate new cost with simulated prices
        new_cost = 0
        for item in p.recipe_items:
            price = materials_update.get(item.ingredient_name, all_ingredients[item.ingredient_name].price)
            new_cost += item.quantity * price
            
        impact.append({
            "name": p.name,
            "old_cost": old_cost,
            "new_cost": new_cost,
            "margin_impact": ((p.price - new_cost) / p.price * 100) if p.price > 0 else 0
        })
    return impact

@app.post("/api/update_material_prices")
async def update_material_prices(materials_update: Dict[str, float], db: Session = Depends(get_db)):
    for name, new_price in materials_update.items():
        ing = db.query(models.Ingredient).filter(models.Ingredient.name == name).first()
        if ing:
            ing.price = new_price
    db.commit()
    return {"success": True}

@app.post("/api/materials")
async def add_material(mat: MaterialCreate, db: Session = Depends(get_db)):
    existing = db.query(models.Ingredient).filter(models.Ingredient.name == mat.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Material already exists")
    
    new_ing = models.Ingredient(
        name=mat.name,
        price=mat.price,
        unit=mat.unit,
        min_threshold=mat.min_threshold,
        stock=0
    )
    db.add(new_ing)
    db.commit()
    return {"success": True}

@app.delete("/api/materials/{name}")
async def delete_material(name: str, db: Session = Depends(get_db)):
    ing = db.query(models.Ingredient).filter(models.Ingredient.name == name).first()
    if ing:
        db.delete(ing)
        db.commit()
        return {"success": True}
    raise HTTPException(status_code=404, detail="Material not found")

@app.post("/api/products")
async def add_product(prod: ProductCreate, db: Session = Depends(get_db)):
    existing = db.query(models.Product).filter(models.Product.id == prod.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Product ID already exists")
    
    new_prod = models.Product(
        id=prod.id,
        name=prod.name,
        price=prod.price,
        icon=prod.icon,
        stock=0
    )
    db.add(new_prod)
    db.flush()
    
    for ing_data in prod.ingredients:
        recipe_item = models.RecipeItem(
            product_id=new_prod.id,
            ingredient_name=ing_data.name,
            quantity=ing_data.quantity
        )
        db.add(recipe_item)
        
    db.commit()
    return {"success": True}

@app.put("/api/products/{id}")
async def update_product(id: str, update: ProductUpdate, db: Session = Depends(get_db)):
    product = db.query(models.Product).filter(models.Product.id == id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    if update.name is not None: product.name = update.name
    if update.price is not None: product.price = update.price
    if update.icon is not None: product.icon = update.icon
    
    if update.ingredients is not None:
        # Remove old recipe items
        db.query(models.RecipeItem).filter(models.RecipeItem.product_id == id).delete()
        # Add new ones
        for ing_data in update.ingredients:
            db.add(models.RecipeItem(
                product_id=id,
                ingredient_name=ing_data.name,
                quantity=ing_data.quantity
            ))
            
    db.commit()
    return {"success": True}

@app.delete("/api/products/{id}")
async def delete_product(id: str, db: Session = Depends(get_db)):
    product = db.query(models.Product).filter(models.Product.id == id).first()
    if product:
        db.delete(product)
        db.commit()
        return {"success": True}
    raise HTTPException(status_code=404, detail="Product not found")

import httpx

@app.get("/api/external-recipes/search")
async def search_external_recipes(query: str):
    async with httpx.AsyncClient() as client:
        # Use TheMealDB free tier for recipes
        url = f"https://www.themealdb.com/api/json/v1/1/search.php?s={query}"
        response = await client.get(url)
        data = response.json()
        
        results = []
        if data.get("meals"):
            for meal in data["meals"]:
                # Only include desserts/pastries if possible, or just all if specific query
                results.append({
                    "id": meal["idMeal"],
                    "name": meal["strMeal"],
                    "category": meal["strCategory"],
                    "thumb": meal["strMealThumb"]
                })
        return results

@app.get("/api/external-recipes/{recipe_id}/details")
async def get_external_recipe_details(recipe_id: str):
    async with httpx.AsyncClient() as client:
        url = f"https://www.themealdb.com/api/json/v1/1/lookup.php?i={recipe_id}"
        response = await client.get(url)
        data = response.json()
        
        if not data.get("meals"):
            raise HTTPException(status_code=404, detail="Recipe not found")
            
        meal = data["meals"][0]
        ingredients = []
        
        # TheMealDB uses strIngredient1, strIngredient2... strIngredient20
        for i in range(1, 21):
            name = meal.get(f"strIngredient{i}")
            measure = meal.get(f"strMeasure{i}")
            
            if name and name.strip():
                # Extract numeric quantity if possible, otherwise default to 0
                qty = 0
                if measure:
                    # Simple extraction: find the first number in the measure string
                    import re
                    match = re.search(r"(\d+)", measure)
                    if match:
                        qty = float(match.group(1))
                
                ingredients.append({
                    "name": name.strip().title(),
                    "quantity": qty
                })
        
        return {
            "name": meal["strMeal"],
            "ingredients": ingredients,
            "thumb": meal["strMealThumb"]
        }

# Mount static files
if os.path.exists(FRONTEND_DIR):
    # Assets are usually in dist/assets
    assets_path = os.path.join(FRONTEND_DIR, "assets")
    if os.path.exists(assets_path):
        app.mount("/assets", StaticFiles(directory=assets_path), name="assets")

@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    if full_path.startswith("api"):
        raise HTTPException(status_code=404)
        
    # Serve from dist folder for production build
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path, headers={"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"})
    
    return {"message": "Frontend not built. Please run 'npm run build' in frontend directory."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
