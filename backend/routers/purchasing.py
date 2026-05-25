"""Purchasing, suppliers, and purchase-order routes for BakeryOS."""

import uuid
from datetime import datetime

import sqlalchemy.orm
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import joinedload

try:
    from .. import models
    from ..auth import get_effective_owner_id, requires_roles
    from ..database import get_db
    from ..schemas import POCreate, POReceive, SupplierCreate
except ImportError:
    import models
    from auth import get_effective_owner_id, requires_roles
    from database import get_db
    from schemas import POCreate, POReceive, SupplierCreate

router = APIRouter()


@router.get("/api/purchasing/suggest", dependencies=[Depends(requires_roles(["owner"]))])
async def suggest_purchase(
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    ingredients = db.query(models.Ingredient).filter(models.Ingredient.owner_id == owner_id).all()
    suggestions = []
    for ing in ingredients:
        if ing.stock < ing.min_threshold:
            suggested_buy = ing.min_threshold * 2 - ing.stock
            factor = 1000.0 if ing.unit in ["kg", "L", "l"] else 1.0
            suggestions.append(
                {
                    "name": ing.name,
                    "current_stock": ing.stock,
                    "min_threshold": ing.min_threshold,
                    "suggested_buy": suggested_buy,
                    "unit": ing.unit,
                    "estimated_cost": (suggested_buy / factor) * ing.price,
                }
            )
    return JSONResponse(content=suggestions, headers={"Cache-Control": "private, max-age=120"})


@router.get("/api/suppliers", dependencies=[Depends(requires_roles(["owner"]))])
async def get_suppliers(
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    suppliers = db.query(models.Supplier).filter(models.Supplier.owner_id == owner_id).all()
    data = [
        {
            "id": s.id,
            "name": s.name,
            "contact_info": s.contact_info,
            "ice": s.ice,
            "email": s.email,
            "phone": s.phone,
        }
        for s in suppliers
    ]
    return JSONResponse(content=data, headers={"Cache-Control": "private, max-age=120"})


@router.post("/api/suppliers", dependencies=[Depends(requires_roles(["owner"]))])
async def add_supplier(
    supp: SupplierCreate,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    new_supp = models.Supplier(**supp.dict(), owner_id=owner_id)
    db.add(new_supp)
    db.commit()
    return {"success": True}


@router.put("/api/suppliers/{supplier_id}", dependencies=[Depends(requires_roles(["owner"]))])
async def update_supplier(
    supplier_id: int,
    supp: SupplierCreate,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    supplier = db.query(models.Supplier).filter(
        models.Supplier.id == supplier_id,
        models.Supplier.owner_id == owner_id,
    ).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    supplier.name = supp.name
    supplier.contact_info = supp.contact_info
    supplier.ice = supp.ice
    supplier.email = supp.email
    supplier.phone = supp.phone
    db.commit()
    return {"success": True}


@router.delete("/api/suppliers/{supplier_id}", dependencies=[Depends(requires_roles(["owner"]))])
async def delete_supplier(
    supplier_id: int,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    supplier = db.query(models.Supplier).filter(
        models.Supplier.id == supplier_id,
        models.Supplier.owner_id == owner_id,
    ).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    linked_orders = db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.supplier_id == supplier_id,
        models.PurchaseOrder.owner_id == owner_id,
    ).count()
    if linked_orders:
        raise HTTPException(status_code=400, detail="Supplier has purchase order history")
    db.delete(supplier)
    db.commit()
    return {"success": True}


@router.get("/api/purchase-orders", dependencies=[Depends(requires_roles(["owner"]))])
async def get_purchase_orders(
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    pos = db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.owner_id == owner_id,
        models.PurchaseOrder.archived != True,  # noqa: E712 — SQLAlchemy needs != not `is not`
    ).all()
    data = [
        {
            "id": p.id, "supplier_id": p.supplier_id, "status": p.status,
            "items": p.items or [], "notes": p.notes,
            "date": p.date.isoformat() if p.date else None,
            "expected_delivery_date": p.expected_delivery_date.isoformat() if p.expected_delivery_date else None,
        }
        for p in pos
    ]
    return JSONResponse(content=data, headers={"Cache-Control": "private, max-age=60"})


@router.delete("/api/purchase-orders/{id}", dependencies=[Depends(requires_roles(["owner"]))])
async def delete_po(
    id: str,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    po = db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.id == id,
        models.PurchaseOrder.owner_id == owner_id,
    ).first()
    if not po:
        raise HTTPException(status_code=404, detail="Order not found")
    po.archived = True
    db.commit()
    return {"success": True}


@router.post("/api/purchase-orders", dependencies=[Depends(requires_roles(["owner"]))])
async def create_po(
    po: POCreate,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    supplier = db.query(models.Supplier).filter(
        models.Supplier.id == po.supplier_id,
        models.Supplier.owner_id == owner_id,
    ).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    normalized_items = []
    for item in po.items:
        ordered_qty = float(item.get("qty", 0))
        normalized_items.append(
            {
                "name": item.get("name"),
                "qty": ordered_qty,
                "price": float(item.get("price", 0)),
                "received_qty": float(item.get("received_qty", 0)),
            }
        )

    new_po = models.PurchaseOrder(
        id=str(uuid.uuid4())[:8].upper(),
        owner_id=owner_id,
        supplier_id=po.supplier_id,
        items=normalized_items,
        notes=po.notes,
        expected_delivery_date=datetime.fromisoformat(po.expected_delivery_date) if po.expected_delivery_date else None,
        status="draft",
    )
    db.add(new_po)
    db.commit()
    return {"success": True}


@router.patch("/api/purchase-orders/{id}", dependencies=[Depends(requires_roles(["owner"]))])
async def update_po(
    id: str,
    po: POCreate,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    existing = db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.id == id,
        models.PurchaseOrder.owner_id == owner_id,
    ).first()
    if not existing:
        raise HTTPException(status_code=404, detail="Order not found")

    supplier = db.query(models.Supplier).filter(
        models.Supplier.id == po.supplier_id,
        models.Supplier.owner_id == owner_id,
    ).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    existing.supplier_id = po.supplier_id
    existing.notes = po.notes
    existing.expected_delivery_date = (
        datetime.fromisoformat(po.expected_delivery_date) if po.expected_delivery_date else None
    )
    existing.items = [
        {
            "name": item.get("name"),
            "qty": float(item.get("qty", 0)),
            "price": float(item.get("price", 0)),
            "received_qty": float(item.get("received_qty", 0)),
        }
        for item in po.items
    ]
    db.commit()
    return {"success": True}


@router.post("/api/purchase-orders/{id}/receive", dependencies=[Depends(requires_roles(["owner"]))])
async def receive_po(
    id: str,
    payload: POReceive,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    po = db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.id == id,
        models.PurchaseOrder.owner_id == owner_id,
    ).first()
    if not po:
        raise HTTPException(status_code=404, detail="Order not found")

    items_by_name = {item["name"]: item for item in po.items}

    # Bulk-fetch all relevant ingredients in one query.
    item_names = [r.name for r in payload.items]
    ings_map = {
        ing.name: ing
        for ing in db.query(models.Ingredient).filter(
            models.Ingredient.name.in_(item_names),
            models.Ingredient.owner_id == owner_id,
        ).all()
    }

    for received in payload.items:
        item = items_by_name.get(received.name)
        if not item:
            continue
        ordered_qty = float(item.get("qty", 0))
        current_received = float(item.get("received_qty", 0))
        next_received = min(ordered_qty, current_received + max(0, received.qty))
        delta_received = next_received - current_received
        item["received_qty"] = next_received
        if received.price is not None:
            item["price"] = float(received.price)
        if delta_received > 0:
            ing = ings_map.get(received.name)
            if ing:
                ing.stock += delta_received
                ing.price = float(item.get("price", ing.price))
                ing.last_purchase_price = float(item.get("price", ing.price))

    po.items = list(items_by_name.values())
    received_complete = all(float(item.get("received_qty", 0)) >= float(item.get("qty", 0)) for item in po.items)
    received_any = any(float(item.get("received_qty", 0)) > 0 for item in po.items)
    po.status = "received" if received_complete else ("partial" if received_any else po.status)
    db.commit()
    return {"success": True, "status": po.status}


@router.patch("/api/purchase-orders/{id}/status", dependencies=[Depends(requires_roles(["owner"]))])
async def update_po_status(
    id: str,
    status: str,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    VALID_PO_STATUSES = {"draft", "pending", "partial", "received", "cancelled"}
    if status not in VALID_PO_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {VALID_PO_STATUSES}")

    po = db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.id == id,
        models.PurchaseOrder.owner_id == owner_id,
    ).first()
    if not po:
        raise HTTPException(status_code=404, detail="Order not found")

    if status == "received" and po.status != "received":
        # Bulk-fetch all ingredients mentioned in PO items in one query.
        po_item_names = [item["name"] for item in po.items]
        ings_map = {
            ing.name: ing
            for ing in db.query(models.Ingredient).filter(
                models.Ingredient.name.in_(po_item_names),
                models.Ingredient.owner_id == owner_id,
            ).all()
        }
        for item in po.items:
            ing = ings_map.get(item["name"])
            if ing:
                delta = max(0, float(item["qty"]) - float(item.get("received_qty", 0)))
                ing.stock += delta
                ing.price = float(item["price"])
                ing.last_purchase_price = float(item["price"])
                item["received_qty"] = float(item["qty"])

    po.status = status
    db.commit()
    return {"success": True}
