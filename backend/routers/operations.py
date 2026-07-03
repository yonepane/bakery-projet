"""Inventory and day-to-day operations routes for BakeryOS."""

import uuid
from datetime import datetime
from typing import Dict, List

import sqlalchemy.orm
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from sqlalchemy import literal_column
from sqlalchemy.orm import joinedload

try:
    from .. import models
    from ..auth import get_effective_owner_id, requires_roles
    from ..database import get_db
    from ..schemas import WasteCreate
    from ..services.core import calculate_product_cost
except ImportError:
    import models
    from auth import get_effective_owner_id, requires_roles
    from database import get_db
    from schemas import WasteCreate
    from services.core import calculate_product_cost

router = APIRouter()


@router.post("/api/waste", dependencies=[Depends(requires_roles(["owner", "cashier"]))])
async def record_waste(
    waste: WasteCreate,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    product = db.query(models.Product).filter(
        models.Product.id == waste.product_id,
        models.Product.owner_id == owner_id,
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if product.stock < waste.quantity:
        raise HTTPException(status_code=400, detail="Not enough stock to waste")

    product.stock -= waste.quantity
    loss_cost = calculate_product_cost(product) * waste.quantity

    record = models.WasteRecord(
        owner_id=owner_id,
        product_id=waste.product_id,
        quantity=waste.quantity,
        loss_cost=loss_cost,
    )
    db.add(record)
    db.commit()
    return {"success": True}


@router.get("/api/waste", dependencies=[Depends(requires_roles(["owner"]))])
async def get_waste(
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    # joinedload fetches product names in the same query, no N+1.
    records = (
        db.query(models.WasteRecord)
        .options(joinedload(models.WasteRecord.product))
        .filter(models.WasteRecord.owner_id == owner_id)
        .order_by(models.WasteRecord.date.desc())
        .all()
    )
    return [
        {
            "id": record.id,
            "date": record.date.isoformat(),
            "product_id": record.product_id,
            "product_name": record.product.name if record.product else "Unknown",
            "quantity": record.quantity,
            "loss_cost": record.loss_cost,
        }
        for record in records
    ]


@router.get("/api/inventory")
async def inventory(
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    """Return the full inventory (materials + products with live costs).

    Note: No role guard is applied intentionally. Cashier accounts need
    read access to this endpoint so the POS panel can display the product
    list and current stock levels. The owner_id filter ensures each tenant
    only sees their own data.
    """
    ingredients = (
        db.query(models.Ingredient)
        .filter(models.Ingredient.owner_id == owner_id)
        .all()
    )
    # joinedload prevents a separate ingredient query for every recipe_item.
    products = (
        db.query(models.Product)
        .options(
            joinedload(models.Product.recipe_items).joinedload(models.RecipeItem.ingredient)
        )
        .filter(models.Product.owner_id == owner_id)
        .all()
    )

    materials_dict = {
        ing.name: {
            "id": ing.id,
            "stock": ing.stock,
            "unit": ing.unit,
            "price": ing.price,
            "min_threshold": ing.min_threshold,
        }
        for ing in ingredients
    }

    products_list = []
    for product in products:
        products_list.append(
            {
                "id": product.id,
                "name": product.name,
                "stock": product.stock,
                "price": product.price,
                "icon": product.icon,
                "prep_time": product.prep_time,
                "cook_time": product.cook_time,
                "yield_qty": product.yield_qty,
                "instructions": product.instructions or [],
                "live_cost": calculate_product_cost(product),
                "ingredients": [
                    {
                        "name": item.ingredient.name if item.ingredient else "Unknown",
                        "quantity": item.quantity,
                    }
                    for item in product.recipe_items
                ],
            }
        )

    return JSONResponse(
        content={"materials": materials_dict, "products": products_list},
        headers={"Cache-Control": "private, no-store"},
    )


@router.get("/api/planner/prep-sheet")
async def get_prep_sheet(
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    pending = db.query(models.Planner).filter(
        models.Planner.owner_id == owner_id,
        models.Planner.status == "pending",
    ).all()

    if not pending:
        return "<h1>No pending batches in planner.</h1>"

    requirements = {}
    production_summary = []

    # Bulk-fetch all needed products with recipes in one query instead of
    # querying inside the loop.
    pending_product_ids = {item.product_id for item in pending}
    products_map = {
        p.id: p
        for p in (
            db.query(models.Product)
            .options(
                joinedload(models.Product.recipe_items).joinedload(models.RecipeItem.ingredient)
            )
            .filter(
                models.Product.id.in_(pending_product_ids),
                models.Product.owner_id == owner_id,
            )
            .all()
        )
    }

    for item in pending:
        product = products_map.get(item.product_id)
        if not product:
            continue

        production_summary.append(
            {
                "name": product.name,
                "qty": item.quantity,
                "icon": product.icon,
            }
        )

        for recipe_item in product.recipe_items:
            name = recipe_item.ingredient.name if recipe_item.ingredient else "Unknown"
            qty = recipe_item.quantity * item.quantity
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
    return HTMLResponse(content=html_content)


import json

@router.get("/api/history")
async def get_history(
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    if db.bind and db.bind.dialect.name == "sqlite":
        transactions = (
            db.query(models.Transaction, literal_column("rowid").label("sort_index"))
            .filter(models.Transaction.owner_id == owner_id)
            .order_by(literal_column("rowid").desc())
            .all()
        )
    else:
        transactions = [
            (tx, None)
            for tx in (
                db.query(models.Transaction)
                .filter(models.Transaction.owner_id == owner_id)
                .order_by(models.Transaction.timestamp.desc(), models.Transaction.id.desc())
                .all()
            )
        ]
    data = []
    for tx, sort_index in transactions:
        items = tx.items if isinstance(tx.items, list) else json.loads(tx.items) if isinstance(tx.items, str) else []
        ui_type = "produce" if tx.type == "production" else tx.type
        product_name = items[0].get("name") if items else None
        data.append(
            {
            "id": tx.id,
            "sort_index": sort_index,
            "timestamp": tx.timestamp.isoformat(),
            "type": ui_type,
            "status": getattr(tx, "status", "completed") or "completed",
            "revenue": tx.total_revenue,
            "cost": tx.total_cost,
            "profit": tx.total_revenue - tx.total_cost,
            "product": product_name,
            "items": items,
        }
        )
    return JSONResponse(content=data, headers={"Cache-Control": "private, no-store"})


@router.get("/api/planner")
async def get_planner(
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    rows = db.query(models.Planner).filter(models.Planner.owner_id == owner_id).all()
    return JSONResponse(
        content=[
            {
                "id": r.id, "product_id": r.product_id,
                "date": str(r.date), "quantity": r.quantity, "status": r.status,
            } for r in rows
        ],
        headers={"Cache-Control": "private, max-age=60"},
    )


@router.post("/api/planner")
async def update_planner(
    plan: List[Dict],
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    db.query(models.Planner).filter(models.Planner.owner_id == owner_id).delete()
    for item in plan:
        new_item = models.Planner(
            id=item.get("id", str(uuid.uuid4())[:8].upper()),
            owner_id=owner_id,
            product_id=item["product_id"],
            date=item["date"],
            quantity=item["quantity"],
            status=item.get("status", "pending"),
        )
        db.add(new_item)
    db.commit()
    return {"success": True}


@router.get("/api/settings")
async def get_settings_api(
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    settings = db.query(models.SystemSetting).filter(models.SystemSetting.owner_id == owner_id).all()
    data = {setting.key: setting.value for setting in settings}
    return JSONResponse(content=data, headers={"Cache-Control": "private, max-age=120"})


@router.put("/api/settings", dependencies=[Depends(requires_roles(["owner"]))])
async def update_settings(
    payload: Dict,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    for key, value in payload.items():
        setting = db.query(models.SystemSetting).filter(
            models.SystemSetting.key == key,
            models.SystemSetting.owner_id == owner_id,
        ).first()
        if setting:
            setting.value = str(value)
        else:
            db.add(models.SystemSetting(key=key, owner_id=owner_id, value=str(value)))
    db.commit()
    return {"success": True}
