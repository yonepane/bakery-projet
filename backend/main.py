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

from passlib.context import CryptContext
import jwt
from fastapi.security import OAuth2PasswordBearer

# Security
SECRET_KEY = "bakery-secret-key-change-me"
ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=24)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except:
        raise HTTPException(status_code=401, detail="Invalid token")
        
    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user

def requires_roles(roles: List[str]):
    def role_checker(current_user: models.User = Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(
                status_code=403, 
                detail=f"Role {current_user.role} is not authorized for this action. Required: {roles}"
            )
        return current_user
    return role_checker

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

class SupplierCreate(BaseModel):
    name: str
    contact_info: Optional[str] = None

class POCreate(BaseModel):
    supplier_id: int
    items: List[Dict]

class ProductCreate(BaseModel):
    id: str
    name: str
    price: float
    icon: str
    ingredients: List[IngredientItem]
    prep_time: Optional[int] = 0
    cook_time: Optional[int] = 0
    yield_qty: Optional[int] = 1
    instructions: Optional[List[str]] = []

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None
    icon: Optional[str] = None
    ingredients: Optional[List[IngredientItem]] = None
    prep_time: Optional[int] = None
    cook_time: Optional[int] = None
    yield_qty: Optional[int] = None
    instructions: Optional[List[str]] = None

class LoginRequest(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    username: str
    role: str

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
        db.add(models.User(username="admin", password=get_password_hash("password"), role="owner"))
        db.add(models.User(username="cashier", password=get_password_hash("password"), role="cashier"))
        db.commit()
    return {"message": "Users seeded. Use admin/password or cashier/password."}

@app.post("/api/auth/login", response_model=Token)
async def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == req.username).first()
    if not user or not verify_password(req.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    access_token = create_access_token(data={"sub": user.username})
    return {
        "access_token": access_token, 
        "token_type": "bearer", 
        "username": user.username, 
        "role": user.role
    }

# Orders
@app.get("/api/orders")
async def get_orders(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Order).order_by(models.Order.pickup_date.asc()).all()

@app.post("/api/orders")
async def create_order(order_data: OrderCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
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
async def update_order_status(id: str, status: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    order = db.query(models.Order).filter(models.Order.id == id).first()
    if order:
        order.status = status
        db.commit()
        return order
    raise HTTPException(status_code=404, detail="Order not found")

# Waste
@app.post("/api/waste")
async def record_waste(waste: WasteCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
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
async def inventory(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
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
            "prep_time": p.prep_time,
            "cook_time": p.cook_time,
            "yield_qty": p.yield_qty,
            "instructions": p.instructions or [],
            "live_cost": calculate_product_cost(p),
            "ingredients": [{"name": i.ingredient_name, "quantity": i.quantity} for i in p.recipe_items]
        })
        
    return {
        "materials": materials_dict,
        "products": products_list
    }

@app.get("/api/planner/prep-sheet")
async def get_prep_sheet(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    planner_path = os.path.join(DATA_DIR, 'planner.json')
    plan = []
    if os.path.exists(planner_path):
        with open(planner_path, 'r') as f:
            plan = json.load(f)
    
    pending = [p for p in plan if p.get('status') == 'pending']
    if not pending:
        return "<h1>No pending batches in planner.</h1>"

    # Consolidate requirements
    requirements = {}
    production_summary = []
    
    for item in pending:
        product = db.query(models.Product).filter(models.Product.id == item['product_id']).first()
        if not product: continue
        
        production_summary.append({
            "name": product.name,
            "qty": item['quantity'],
            "icon": product.icon
        })
        
        for recipe_item in product.recipe_items:
            name = recipe_item.ingredient_name
            qty = recipe_item.quantity * item['quantity']
            unit = recipe_item.ingredient.unit if recipe_item.ingredient else "g"
            
            if name not in requirements:
                requirements[name] = {"qty": 0, "unit": unit}
            requirements[name]["qty"] += qty

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>BakeryOS - Master Prep Sheet</title>
        <style>
            body {{ font-family: 'Inter', sans-serif; padding: 40px; color: #1a1a1b; line-height: 1.6; }}
            .header {{ text-align: center; border-bottom: 2px solid #D4AF37; padding-bottom: 20px; margin-bottom: 30px; }}
            h1 {{ font-family: 'Playfair Display', serif; text-transform: uppercase; letter-spacing: 2px; margin: 0; }}
            .date {{ color: #888; font-size: 0.9em; margin-top: 5px; }}
            .section {{ margin-bottom: 40px; }}
            h2 {{ font-size: 1.2em; text-transform: uppercase; border-left: 4px solid #D4AF37; padding-left: 15px; margin-bottom: 20px; }}
            table {{ w-full; border-collapse: collapse; margin-top: 10px; width: 100%; }}
            th, td {{ text-align: left; padding: 12px; border-bottom: 1px solid #eee; }}
            th {{ font-size: 0.8em; text-transform: uppercase; color: #888; }}
            .qty {{ font-weight: bold; font-family: monospace; font-size: 1.1em; }}
            .item-name {{ font-weight: 600; }}
            @media print {{
                .no-print {{ display: none; }}
                body {{ padding: 0; }}
            }}
            .print-btn {{ 
                background: #1a1a1b; color: white; border: none; padding: 10px 20px; border-radius: 8px; 
                cursor: pointer; font-weight: bold; margin-bottom: 20px;
            }}
        </style>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Playfair+Display:wght@700&display=swap" rel="stylesheet">
    </head>
    <body>
        <div class="no-print">
            <button class="print-btn" onclick="window.print()">Print Prep Sheet</button>
        </div>
        
        <div class="header">
            <h1>Master Prep List</h1>
            <div class="date">{datetime.now().strftime('%A, %d %B %Y | %H:%M')}</div>
        </div>

        <div class="section">
            <h2>Production Targets</h2>
            <table>
                <thead>
                    <tr><th>Entity</th><th>Target Quantity</th></tr>
                </thead>
                <tbody>
                    {''.join([f"<tr><td class='item-name'>{p['icon']} {p['name']}</td><td class='qty'>{p['qty']} units</td></tr>" for p in production_summary])}
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>Material Requirements (Consolidated)</h2>
            <table>
                <thead>
                    <tr><th>Ingredient</th><th>Total Needed</th><th>Measurement</th></tr>
                </thead>
                <tbody>
                    {''.join([f"<tr><td class='item-name'>{name}</td><td class='qty'>{round(data['qty'], 2)}</td><td>{data['unit']}</td></tr>" for name, data in requirements.items()])}
                </tbody>
            </table>
        </div>

        <div style="margin-top: 50px; text-align: center; color: #ccc; font-size: 0.8em; border-top: 1px solid #eee; padding-top: 20px;">
            BAKERYOS INTEL-ENGINE | OPERATIONAL PROTOCOL
        </div>
    </body>
    </html>
    """
    from fastapi.responses import HTMLResponse
    return HTMLResponse(content=html_content)

@app.get("/api/history")
async def get_history(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
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
async def get_planner(current_user: models.User = Depends(get_current_user)):
    planner_path = os.path.join(DATA_DIR, 'planner.json')
    if os.path.exists(planner_path):
        with open(planner_path, 'r') as f:
            return json.load(f)
    return []

@app.post("/api/planner")
async def update_planner(plan: List[Dict], current_user: models.User = Depends(get_current_user)):
    with open(os.path.join(DATA_DIR, 'planner.json'), 'w') as f:
        json.dump(plan, f, indent=4)
    return {"success": True}

@app.get("/api/settings")
async def get_settings_api():
    return get_settings()

@app.post("/api/produce")
async def produce(batch: ProductionBatch, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
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
async def complete_sale(req: SaleRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
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

@app.get("/api/analytics", dependencies=[Depends(requires_roles(["owner"]))])
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

@app.post("/api/simulate_price", dependencies=[Depends(requires_roles(["owner"]))])
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

@app.post("/api/update_material_prices", dependencies=[Depends(requires_roles(["owner"]))])
async def update_material_prices(materials_update: Dict[str, float], db: Session = Depends(get_db)):
    for name, new_price in materials_update.items():
        ing = db.query(models.Ingredient).filter(models.Ingredient.name == name).first()
        if ing:
            ing.price = new_price
    db.commit()
    return {"success": True}

@app.post("/api/materials", dependencies=[Depends(requires_roles(["owner"]))])
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

@app.delete("/api/materials/{name}", dependencies=[Depends(requires_roles(["owner"]))])
async def delete_material(name: str, db: Session = Depends(get_db)):
    ing = db.query(models.Ingredient).filter(models.Ingredient.name == name).first()
    if ing:
        db.delete(ing)
        db.commit()
        return {"success": True}
    raise HTTPException(status_code=404, detail="Material not found")

@app.post("/api/products", dependencies=[Depends(requires_roles(["owner"]))])
async def add_product(prod: ProductCreate, db: Session = Depends(get_db)):
    if not prod.id.strip():
        raise HTTPException(status_code=400, detail="Product ID cannot be empty")
    
    existing = db.query(models.Product).filter(models.Product.id == prod.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Product ID already exists")
    
    new_prod = models.Product(
        id=prod.id,
        name=prod.name,
        price=prod.price,
        icon=prod.icon,
        prep_time=prod.prep_time,
        cook_time=prod.cook_time,
        yield_qty=prod.yield_qty,
        instructions=prod.instructions,
        stock=0
    )
    db.add(new_prod)
    db.flush()
    
    created_ingredients = []
    for ing_data in prod.ingredients:
        # Check if ingredient exists, if not create it
        ing = db.query(models.Ingredient).filter(models.Ingredient.name == ing_data.name).first()
        if not ing:
            ing = models.Ingredient(
                name=ing_data.name,
                stock=0,
                unit="g",
                price=0,
                min_threshold=1000
            )
            db.add(ing)
            db.flush()
            created_ingredients.append(ing_data.name)

        recipe_item = models.RecipeItem(
            product_id=new_prod.id,
            ingredient_name=ing_data.name,
            quantity=ing_data.quantity
        )
        db.add(recipe_item)
        
    db.commit()
    return {
        "success": True, 
        "message": f"Product created. {len(created_ingredients)} new ingredients added to inventory with placeholder prices." if created_ingredients else "Product created successfully."
    }

@app.put("/api/products/{id}", dependencies=[Depends(requires_roles(["owner"]))])
async def update_product(id: str, update: ProductUpdate, db: Session = Depends(get_db)):
    product = db.query(models.Product).filter(models.Product.id == id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    if update.name is not None: product.name = update.name
    if update.price is not None: product.price = update.price
    if update.icon is not None: product.icon = update.icon
    if update.prep_time is not None: product.prep_time = update.prep_time
    if update.cook_time is not None: product.cook_time = update.cook_time
    if update.yield_qty is not None: product.yield_qty = update.yield_qty
    if update.instructions is not None: product.instructions = update.instructions
    
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

@app.delete("/api/products/{id}", dependencies=[Depends(requires_roles(["owner"]))])
async def delete_product(id: str, db: Session = Depends(get_db)):
    product = db.query(models.Product).filter(models.Product.id == id).first()
    if product:
        db.delete(product)
        db.commit()
        return {"success": True}
    raise HTTPException(status_code=404, detail="Product not found")

@app.post("/api/maintenance/delete-empty-products", dependencies=[Depends(requires_roles(["owner"]))])
async def delete_empty_product(db: Session = Depends(get_db)):
    # Use direct SQL as a last resort if ORM is being tricky
    from sqlalchemy import text
    result = db.execute(text("DELETE FROM products WHERE id = '' OR id IS NULL"))
    db.commit()
    return {"success": True, "deleted": "Done"}

@app.post("/api/maintenance/cleanup-products", dependencies=[Depends(requires_roles(["owner"]))])
async def cleanup_invalid_products(db: Session = Depends(get_db)):
    # Delete anything with empty id or empty name
    invalid = db.query(models.Product).filter((models.Product.id == '') | (models.Product.name == '')).all()
    count = len(invalid)
    for p in invalid:
        db.delete(p)
    db.commit()
    return {"success": True, "count": count}

import httpx

# Fallback high-quality recipes for when external API is unreachable or has no results
BAKERY_STARTER_KIT = [
    {
        "id": "starter-1",
        "name": "Classic Butter Croissant",
        "category": "Pastry",
        "thumb": "https://www.themealdb.com/images/media/meals/vussuy1511882648.jpg",
        "ingredients": [
            {"name": "Flour", "quantity": 500},
            {"name": "Butter", "quantity": 250},
            {"name": "Milk", "quantity": 200},
            {"name": "Sugar", "quantity": 50},
            {"name": "Yeast", "quantity": 10}
        ]
    },
    {
        "id": "starter-2",
        "name": "Pain au Chocolat",
        "category": "Pastry",
        "thumb": "https://www.themealdb.com/images/media/meals/ustsqw1468250014.jpg",
        "ingredients": [
            {"name": "Flour", "quantity": 500},
            {"name": "Butter", "quantity": 250},
            {"name": "Chocolate", "quantity": 100},
            {"name": "Milk", "quantity": 150}
        ]
    },
    {
        "id": "starter-3",
        "name": "Almond Macarons",
        "category": "Dessert",
        "thumb": "https://www.themealdb.com/images/media/meals/xvsurr1511719182.jpg",
        "ingredients": [
            {"name": "Almond Flour", "quantity": 200},
            {"name": "Sugar", "quantity": 200},
            {"name": "Eggs", "quantity": 3},
            {"name": "Vanilla", "quantity": 5}
        ]
    }
]

@app.get("/api/external-recipes/search")
async def search_external_recipes(query: str, current_user: models.User = Depends(get_current_user)):
    results = []
    
    # 1. Check if query matches our starter kit (local fallback)
    for recipe in BAKERY_STARTER_KIT:
        if query.lower() in recipe["name"].lower():
            results.append({
                "id": recipe["id"],
                "name": recipe["name"],
                "category": recipe["category"],
                "thumb": recipe["thumb"]
            })

    # 2. Try External API
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            url = f"https://www.themealdb.com/api/json/v1/1/search.php?s={query}"
            response = await client.get(url)
            if response.status_code == 200:
                data = response.json()
                if data.get("meals"):
                    for meal in data["meals"]:
                        # Avoid duplicates from starter kit
                        if not any(r["name"] == meal["strMeal"] for r in results):
                            results.append({
                                "id": meal["idMeal"],
                                "name": meal["strMeal"],
                                "category": meal["strCategory"],
                                "thumb": meal["strMealThumb"]
                            })
    except Exception as e:
        print(f"External API Error: {e}")
        # If API fails and we have no results yet, show full starter kit
        if not results:
            for recipe in BAKERY_STARTER_KIT:
                results.append({
                    "id": recipe["id"],
                    "name": recipe["name"],
                    "category": recipe["category"],
                    "thumb": recipe["thumb"]
                })
    
    return results

@app.get("/api/external-recipes/{recipe_id}/details")
async def get_external_recipe_details(recipe_id: str, current_user: models.User = Depends(get_current_user)):
    # 1. Check Starter Kit
    for recipe in BAKERY_STARTER_KIT:
        if recipe["id"] == recipe_id:
            return recipe

    # 2. External API
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            url = f"https://www.themealdb.com/api/json/v1/1/lookup.php?i={recipe_id}"
            response = await client.get(url)
            data = response.json()
            
            if not data.get("meals"):
                raise HTTPException(status_code=404, detail="Recipe not found")
                
            meal = data["meals"][0]
            ingredients = []
            
            for i in range(1, 21):
                name = meal.get(f"strIngredient{i}")
                measure = meal.get(f"strMeasure{i}")
                
                if name and name.strip():
                    qty = 0
                    if measure:
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
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Service unavailable: {str(e)}")

# Mount static files
if os.path.exists(FRONTEND_DIR):
    # Assets are usually in dist/assets
    assets_path = os.path.join(FRONTEND_DIR, "assets")
    if os.path.exists(assets_path):
        app.mount("/assets", StaticFiles(directory=assets_path), name="assets")

@app.get("/api/purchasing/suggest", dependencies=[Depends(requires_roles(["owner"]))])
async def suggest_purchase(db: Session = Depends(get_db)):
    ingredients = db.query(models.Ingredient).all()
    suggestions = []
    for ing in ingredients:
        if ing.stock < ing.min_threshold:
            suggestions.append({
                "name": ing.name,
                "current_stock": ing.stock,
                "min_threshold": ing.min_threshold,
                "suggested_buy": ing.min_threshold * 2 - ing.stock,
                "unit": ing.unit,
                "estimated_cost": (ing.min_threshold * 2 - ing.stock) * ing.price
            })
    return suggestions

@app.get("/api/suppliers", dependencies=[Depends(requires_roles(["owner"]))])
async def get_suppliers(db: Session = Depends(get_db)):
    return db.query(models.Supplier).all()

@app.post("/api/suppliers", dependencies=[Depends(requires_roles(["owner"]))])
async def add_supplier(supp: SupplierCreate, db: Session = Depends(get_db)):
    new_supp = models.Supplier(**supp.dict())
    db.add(new_supp)
    db.commit()
    return {"success": True}

@app.get("/api/purchase-orders", dependencies=[Depends(requires_roles(["owner"]))])
async def get_pos(db: Session = Depends(get_db)):
    return db.query(models.PurchaseOrder).all()

@app.post("/api/purchase-orders", dependencies=[Depends(requires_roles(["owner"]))])
async def create_po(po: POCreate, db: Session = Depends(get_db)):
    new_po = models.PurchaseOrder(
        supplier_id=po.supplier_id,
        items=po.items,
        status="draft"
    )
    db.add(new_po)
    db.commit()
    return {"success": True}

@app.get("/api/reports/monthly", dependencies=[Depends(requires_roles(["owner"]))])
async def get_monthly_report(month: int, year: int, db: Session = Depends(get_db)):
    start_date = datetime(year, month, 1)
    if month == 12:
        end_date = datetime(year + 1, 1, 1)
    else:
        end_date = datetime(year, month + 1, 1)
        
    transactions = db.query(models.Transaction).filter(
        models.Transaction.timestamp >= start_date,
        models.Transaction.timestamp < end_date
    ).all()
    
    waste_records = db.query(models.WasteRecord).filter(
        models.WasteRecord.date >= start_date,
        models.WasteRecord.date < end_date
    ).all()
    
    total_revenue = sum(t.total_revenue for t in transactions if t.type == 'sale')
    total_cogs = sum(t.total_cost for t in transactions if t.type == 'sale')
    total_waste = sum(w.loss_cost for w in waste_records)
    
    net_profit = total_revenue - total_cogs - total_waste
    margin = (net_profit / total_revenue * 100) if total_revenue > 0 else 0
    
    settings = get_settings()
    currency = settings.get("currency", "MAD")
    
    # Generate printable HTML
    html_content = f"""
    <html>
    <head>
        <title>Monthly Report - {start_date.strftime('%B %Y')}</title>
        <style>
            body {{ font-family: 'Inter', sans-serif; padding: 40px; color: #1a1a1b; line-height: 1.6; max-width: 800px; margin: 0 auto; }}
            .header {{ display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f0f0f1; padding-bottom: 20px; margin-bottom: 40px; }}
            .logo {{ font-size: 24px; font-weight: 800; letter-spacing: -1px; }}
            .logo span {{ color: #d4af37; }}
            .report-title {{ font-size: 32px; font-weight: 800; margin: 0; }}
            .summary-grid {{ display: grid; grid-cols: 2; gap: 20px; margin-bottom: 40px; }}
            .card {{ background: #f8f9fa; padding: 25px; rounded: 15px; border: 1px solid #eee; }}
            .card-label {{ font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; color: #888; margin-bottom: 5px; }}
            .card-value {{ font-size: 24px; font-weight: 800; margin: 0; }}
            .positive {{ color: #10b981; }}
            .negative {{ color: #f43f5e; }}
            table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
            th {{ text-align: left; font-size: 10px; text-transform: uppercase; color: #888; padding: 10px; border-bottom: 1px solid #eee; }}
            td {{ padding: 15px 10px; border-bottom: 1px solid #f8f9fa; font-size: 14px; font-weight: 600; }}
            .no-print {{ margin-bottom: 20px; }}
            .btn {{ background: #000; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold; }}
            @media print {{ .no-print {{ display: none; }} body {{ padding: 0; }} }}
        </style>
    </head>
    <body>
        <div class="no-print">
            <a href="#" class="btn" onclick="window.print()">Download as PDF</a>
        </div>
        <div class="header">
            <div class="logo">Bakery<span>OS</span></div>
            <div style="text-align: right;">
                <p style="margin: 0; font-weight: bold;">Executive Financial Summary</p>
                <p style="margin: 0; color: #888; font-size: 12px;">Period: {start_date.strftime('%B %Y')}</p>
            </div>
        </div>

        <h1 class="report-title">Financial Performance</h1>
        <p style="color: #888; margin-bottom: 40px;">This report summarizes the operational efficiency and net profitability for the selected period.</p>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px;">
            <div class="card">
                <p class="card-label">Total Revenue</p>
                <p class="card-value">{total_revenue:,.2f} {currency}</p>
            </div>
            <div class="card">
                <p class="card-label">Net Profit</p>
                <p class="card-value { 'positive' if net_profit > 0 else 'negative' }">{net_profit:,.2f} {currency}</p>
            </div>
            <div class="card">
                <p class="card-label">Cost of Goods</p>
                <p class="card-value">{total_cogs:,.2f} {currency}</p>
            </div>
            <div class="card">
                <p class="card-label">Waste Loss</p>
                <p class="card-value" style="color: #f43f5e;">{total_waste:,.2f} {currency}</p>
            </div>
        </div>

        <div class="card" style="margin-bottom: 40px; background: #000; color: #fff; border: none;">
            <p class="card-label" style="color: #aaa;">Operating Margin</p>
            <p class="card-value" style="color: #d4af37;">{margin:.1f}%</p>
        </div>

        <h3>Revenue Breakdown</h3>
        <table>
            <thead>
                <tr><th>Category</th><th>Transactions</th><th>Amount</th></tr>
            </thead>
            <tbody>
                <tr><td>Direct Sales</td><td>{len([t for t in transactions if t.type == 'sale'])}</td><td>{total_revenue:,.2f} {currency}</td></tr>
                <tr><td>Waste Deductions</td><td>{len(waste_records)}</td><td style="color: #f43f5e;">-{total_waste:,.2f} {currency}</td></tr>
            </tbody>
        </table>

        <div style="margin-top: 100px; text-align: center; font-size: 10px; color: #ccc; text-transform: uppercase; letter-spacing: 2px;">
            Generated by BakeryOS Intel-Engine | {datetime.now().strftime('%Y-%m-%d %H:%M')}
        </div>
    </body>
    </html>
    """
    from fastapi.responses import HTMLResponse
    return HTMLResponse(content=html_content)

@app.get("/api/forecast")
async def get_forecast(target_date: str, db: Session = Depends(get_db)):
    # target_date format: YYYY-MM-DD
    try:
        target_dt = datetime.strptime(target_date, '%Y-%m-%d')
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
        
    suggestions = []
    products = db.query(models.Product).all()
    
    # Look back at the last 4 weeks of the same weekday
    history_dates = []
    for i in range(1, 5):
        history_dates.append(target_dt - timedelta(weeks=i))
        
    for product in products:
        sales_data = []
        for h_date in history_dates:
            start = datetime(h_date.year, h_date.month, h_date.day)
            end = start + timedelta(days=1)
            
            # Find transactions for this product on this day
            txs = db.query(models.Transaction).filter(
                models.Transaction.type == 'sale',
                models.Transaction.timestamp >= start,
                models.Transaction.timestamp < end
            ).all()
            
            day_qty = 0
            for tx in txs:
                if tx.items:
                    for item in tx.items:
                        if item.get('id') == product.id:
                            day_qty += item.get('qty', 0)
            sales_data.append(day_qty)
            
        # Average + 10% safety buffer
        avg_sales = sum(sales_data) / len(sales_data) if sales_data else 0
        suggested = int(avg_sales * 1.1) + 1 if avg_sales > 0 else 5 # minimum 5
        
        suggestions.append({
            "product_id": product.id,
            "product_name": product.name,
            "suggested_qty": suggested,
            "historical_avg": round(avg_sales, 1)
        })
        
    return suggestions

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
