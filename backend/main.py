import json
import os
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

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
os.makedirs(DATA_DIR, exist_ok=True)

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

class BakeryEngine:
    def __init__(self):
        self.initialize_data()

    def initialize_data(self):
        files = {
            'raw_materials.json': {
                "Flour": {"stock": 50000, "price": 0.01, "unit": "g", "min_threshold": 5000},
                "Butter": {"stock": 10000, "price": 0.08, "unit": "g", "min_threshold": 1000},
                "Sugar": {"stock": 20000, "price": 0.015, "unit": "g", "min_threshold": 2000},
                "Chocolate": {"stock": 5000, "price": 0.12, "unit": "g", "min_threshold": 500}
            },
            'recipes.json': [
                {
                    "id": "p1",
                    "name": "Croissant",
                    "ingredients": [
                        {"name": "Flour", "quantity": 110},
                        {"name": "Butter", "quantity": 55},
                        {"name": "Sugar", "quantity": 15}
                    ],
                    "stock": 42,
                    "price": 18.0,
                    "icon": "🥐"
                },
                {
                    "id": "p2",
                    "name": "Pain au Chocolat",
                    "ingredients": [
                        {"name": "Flour", "quantity": 115},
                        {"name": "Butter", "quantity": 55},
                        {"name": "Chocolate", "quantity": 20}
                    ],
                    "stock": 28,
                    "price": 22.0,
                    "icon": "🥯"
                },
                {
                    "id": "p3",
                    "name": "Macaron",
                    "ingredients": [
                        {"name": "Sugar", "quantity": 25},
                        {"name": "Flour", "quantity": 20}
                    ],
                    "stock": 120,
                    "price": 12.0,
                    "icon": "🍡"
                }
            ],
            'transactions.json': [],
            'settings.json': {
                "currency": "MAD",
                "tax_rate": 0.20
            }
        }
        for filename, default_content in files.items():
            path = os.path.join(DATA_DIR, filename)
            if not os.path.exists(path):
                with open(path, 'w') as f:
                    json.dump(default_content, f, indent=4)

    def _load(self, filename):
        path = os.path.join(DATA_DIR, filename)
        try:
            with open(path, 'r') as f:
                return json.load(f)
        except:
            return {} if 'materials' in filename or 'settings' in filename else []

    def _save(self, filename, data):
        with open(os.path.join(DATA_DIR, filename), 'w') as f:
            json.dump(data, f, indent=4)

    def calculate_cost(self, ingredients, materials):
        total_cost = 0
        for ing in ingredients:
            name = ing['name']
            if name in materials:
                total_cost += ing['quantity'] * materials[name]['price']
        return total_cost

    def get_full_data(self):
        materials = self._load('raw_materials.json')
        products = self._load('recipes.json')
        transactions = self._load('transactions.json')
        settings = self._load('settings.json')
        
        # Inject live cost calculation
        for p in products:
            p['live_cost'] = self.calculate_cost(p.get('ingredients', []), materials)
            
        return {
            "materials": materials,
            "products": products,
            "transactions": transactions,
            "settings": settings
        }

    def process_sale(self, cart: List[SaleItem]):
        materials = self._load('raw_materials.json')
        recipes = self._load('recipes.json')
        transactions = self._load('transactions.json')
        
        total_revenue = 0
        total_cost = 0
        items_snapshot = []

        for item in cart:
            product = next((p for p in recipes if p['id'] == item.id), None)
            if not product: continue
            
            if product['stock'] < item.qty:
                raise HTTPException(status_code=400, detail=f"Insufficient stock for {product['name']}")
                
            product['stock'] -= item.qty
            cost = self.calculate_cost(product.get('ingredients', []), materials)
            
            total_revenue += product['price'] * item.qty
            total_cost += cost * item.qty
            items_snapshot.append({
                "id": product['id'],
                "name": product['name'],
                "qty": item.qty,
                "price": product['price'],
                "cost": cost
            })

        tx_id = str(uuid.uuid4())[:8].upper()
        transaction = {
            "id": tx_id,
            "timestamp": datetime.now().isoformat(),
            "type": "sale",
            "items": items_snapshot,
            "revenue": total_revenue,
            "cost": total_cost,
            "profit": total_revenue - total_cost,
            "margin": ((total_revenue - total_cost) / total_revenue * 100) if total_revenue > 0 else 0
        }

        transactions.append(transaction)
        self._save('recipes', recipes)
        self._save('transactions', transactions)
        return transaction

    def produce(self, product_id: str, batch_qty: int):
        materials = self._load('raw_materials.json')
        recipes = self._load('recipes.json')
        transactions = self._load('transactions.json')
        
        product = next((p for p in recipes if p['id'] == product_id), None)
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        production_cost = 0
        for ing in product['ingredients']:
            name = ing['name']
            required = ing['quantity'] * batch_qty
            if materials[name]['stock'] < required:
                raise HTTPException(status_code=400, detail=f"Insufficient {name}")
            materials[name]['stock'] -= required
            production_cost += required * materials[name]['price']

        product['stock'] += batch_qty
        
        transactions.append({
            "id": str(uuid.uuid4())[:8].upper(),
            "timestamp": datetime.now().isoformat(),
            "type": "production",
            "product": product['name'],
            "quantity": batch_qty,
            "cost": production_cost,
            "revenue": 0 # Production has no immediate revenue
        })
        
        self._save('raw_materials.json', materials)
        self._save('recipes.json', recipes)
        self._save('transactions.json', transactions)
        return {"success": True, "new_stock": product['stock']}

engine = BakeryEngine()

@app.get("/api/inventory")
async def inventory():
    # Keep compatibility with existing frontend
    data = engine.get_full_data()
    return {
        "materials": data["materials"],
        "products": data["products"]
    }

@app.get("/api/data")
async def get_all_data():
    return engine.get_full_data()

@app.post("/api/produce")
async def produce(batch: ProductionBatch):
    return engine.produce(batch.product_id, batch.quantity)

@app.post("/api/complete")
async def complete_sale(req: SaleRequest):
    try:
        tx = engine.process_sale(req.cart)
        return {"success": True, "transaction": tx}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/analytics")
async def analytics():
    data = engine.get_full_data()
    transactions = data["transactions"]
    
    total_revenue = sum(t.get('revenue', 0) for t in transactions if t['type'] == 'sale')
    total_cost = sum(t.get('cost', 0) for t in transactions)
    
    # Generate daily data for chart (last 7 days)
    daily_data = []
    now = datetime.now()
    for i in range(6, -1, -1):
        day = now - timedelta(days=i)
        day_str = day.strftime('%a')
        day_txs = [t for t in transactions if t['timestamp'].startswith(day.strftime('%Y-%m-%d'))]
        
        daily_data.append({
            "name": day_str,
            "revenue": sum(t.get('revenue', 0) for t in day_txs if t['type'] == 'sale'),
            "cost": sum(t.get('cost', 0) for t in day_txs)
        })

    return {
        "revenue": round(total_revenue, 2),
        "cost": round(total_cost, 2),
        "currency": data["settings"].get("currency", "MAD"),
        "chartData": daily_data
    }

@app.get("/api/alerts")
async def get_alerts():
    data = engine.get_full_data()
    materials = data["materials"]
    products = data["products"]
    
    alerts = []
    
    # Stock alerts
    for name, m in materials.items():
        if m["stock"] < m.get("min_threshold", 1000):
            alerts.append({
                "type": "stock",
                "severity": "high" if m["stock"] < m.get("min_threshold", 1000) / 2 else "medium",
                "message": f"Low stock: {name} ({m['stock']}{m['unit']})",
                "id": f"stock-{name}"
            })
            
    # Margin alerts
    for p in products:
        margin = ((p['price'] - p['live_cost']) / p['price'] * 100) if p['price'] > 0 else 0
        if margin < 30:
            alerts.append({
                "type": "margin",
                "severity": "medium",
                "message": f"Low margin on {p['name']}: {round(margin, 1)}%",
                "id": f"margin-{p['id']}"
            })
            
    return alerts

@app.post("/api/simulate_price")
async def simulate_price(materials_update: Dict[str, float]):
    materials = engine._load('raw_materials.json')
    for name, new_price in materials_update.items():
        if name in materials:
            materials[name]['price'] = new_price
    
    # Calculate impact on product costs without saving
    impact = []
    recipes = engine._load('recipes.json')
    for p in recipes:
        old_cost = engine.calculate_cost(p['ingredients'], engine._load('raw_materials.json'))
        new_cost = engine.calculate_cost(p['ingredients'], materials)
        impact.append({
            "name": p['name'],
            "old_cost": old_cost,
            "new_cost": new_cost,
            "margin_impact": ((p['price'] - new_cost) / p['price'] * 100) if p['price'] > 0 else 0
        })
    return impact

@app.post("/api/update_material_prices")
async def update_material_prices(materials_update: Dict[str, float]):
    materials = engine._load('raw_materials.json')
    for name, new_price in materials_update.items():
        if name in materials:
            materials[name]['price'] = new_price
    engine._save('raw_materials.json', materials)
    return {"success": True}

# Mount static files
if os.path.exists(FRONTEND_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIR, "assets")), name="assets")

@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    if full_path.startswith("api"):
        raise HTTPException(status_code=404)
        
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Frontend not built. Please run 'npm run build' in frontend directory."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
