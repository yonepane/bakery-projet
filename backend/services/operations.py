"""Business logic for inventory and day-to-day bakery operations.

This module contains pure service functions — no HTTP concerns.
Routers in routers/operations.py are the only callers.
"""

import uuid
from datetime import datetime
from html import escape
from typing import Any, Dict, List

import sqlalchemy.orm
from fastapi import HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy import literal_column
from sqlalchemy.orm import joinedload

import models
from schemas import WasteCreate, StockTransferRequest
from services.core import calculate_product_cost
from services.locations import ensure_default_stock_locations, get_default_warehouse
from services.stock import apply_stock_delta, find_movements_by_client_mutation, resolve_item, handle_idempotency

# ── Simple type aliases exposed to the router ─────────────────────────────────
PlanList = List[Dict[str, Any]]
SettingsPayload = Dict[str, Any]



def record_waste(
    waste: WasteCreate,
    db: sqlalchemy.orm.Session,
    owner_id: int,
    current_user: models.User,
    x_client_mutation_id: str | None = None,
):
    client_mutation_id = waste.client_mutation_id or x_client_mutation_id
    idem = handle_idempotency(db, owner_id=owner_id, client_mutation_id=client_mutation_id, movement_type="waste")
    if idem:
        return idem

    product = resolve_item(db, owner_id=owner_id, item_type="product", item_id=waste.product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if product.stock < waste.quantity:
        raise HTTPException(status_code=400, detail="Not enough stock to waste")

    loss_cost = calculate_product_cost(product) * waste.quantity

    record = models.WasteRecord(
        owner_id=owner_id,
        product_id=waste.product_id,
        quantity=waste.quantity,
        loss_cost=loss_cost,
        reason=(waste.reason or "other"),
    )
    db.add(record)
    db.flush()
    apply_stock_delta(
        db,
        owner_id=owner_id,
        item_type="product",
        item=product,
        quantity_delta=-waste.quantity,
        movement_type="waste",
        source_type="waste_record",
        source_id=str(record.id),
        reason="Waste recorded",
        created_by_user_id=current_user.id,
        client_mutation_id=waste.client_mutation_id,
    )
    db.commit()
    return {"success": True}


def get_waste(
    db: sqlalchemy.orm.Session,
    owner_id: int,
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
            "reason": record.reason or "other",
        }
        for record in records
    ]


def get_stock_movements(
    db: sqlalchemy.orm.Session,
    owner_id: int,
    limit: int = 100,
):
    movements = (
        db.query(models.StockMovement)
        .filter(models.StockMovement.owner_id == owner_id)
        .order_by(models.StockMovement.created_at.desc(), models.StockMovement.id.desc())
        .limit(limit)
        .all()
    )
    return [
            {
                "id": movement.id,
                "created_at": movement.created_at.isoformat() if movement.created_at else None,
                "item_type": movement.item_type,
                "item_id": movement.item_id,
                "item_name": movement.item_name_snapshot,
                "quantity_delta": movement.quantity_delta,
                "unit": movement.unit_snapshot,
                "movement_type": movement.movement_type,
                "source_type": movement.source_type,
                "source_id": movement.source_id,
                "reason": movement.reason,
                "before_qty": movement.before_qty,
                "after_qty": movement.after_qty,
                "created_by_user_id": movement.created_by_user_id,
                "client_mutation_id": movement.client_mutation_id,
                "location_id": movement.location_id,
                "location_name": movement.location_name_snapshot,
                "lot_id": movement.lot_id,
                "lot_code": movement.lot_code_snapshot,
                "expires_at": movement.expires_at.isoformat() if movement.expires_at else None,
                "unit_cost": movement.unit_cost_snapshot,
                "correlation_id": movement.correlation_id,
            }
            for movement in movements
        ]


def get_stock_locations(
    db: sqlalchemy.orm.Session,
    owner_id: int,
    include_inactive: bool = False,
):
    ensure_default_stock_locations(db, owner_id=owner_id)
    db.commit()

    query = db.query(models.StockLocation).filter(models.StockLocation.owner_id == owner_id)
    if not include_inactive:
        query = query.filter(models.StockLocation.is_active == True)  # noqa: E712
    locations = query.order_by(models.StockLocation.is_default.desc(), models.StockLocation.id.asc()).all()

    return [
            {
                "id": location.id,
                "name": location.name,
                "type": location.type,
                "branch_name": location.branch_name,
                "is_default": location.is_default,
                "is_active": location.is_active,
                "created_at": location.created_at.isoformat() if location.created_at else None,
            }
            for location in locations
        ]


def transfer_stock(
    transfer: StockTransferRequest,
    db: sqlalchemy.orm.Session,
    owner_id: int,
    current_user: models.User,
    x_client_mutation_id: str | None = None,
):
    """Transfer stock between locations."""
    client_mutation_id = transfer.client_mutation_id or x_client_mutation_id
    idem = handle_idempotency(
        db, owner_id=owner_id, client_mutation_id=client_mutation_id, movement_type="transfer_out"
    )
    if idem:
        return idem

    if transfer.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be positive")
    if transfer.from_location_id == transfer.to_location_id:
        raise HTTPException(status_code=400, detail="Locations must be different")

    # Resolve item
    item = resolve_item(db, owner_id=owner_id, item_type=transfer.item_type, item_id=transfer.item_id)

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    import uuid
    tx_id = str(uuid.uuid4())[:12].upper()

    expected_item_id = str(item.id if transfer.item_type in ("product", "semi_finished") else item.name)
    has_lots = db.query(models.StockLot).filter(
        models.StockLot.owner_id == owner_id,
        models.StockLot.item_type == transfer.item_type,
        models.StockLot.item_id == expected_item_id,
    ).first() is not None
    if has_lots and transfer.lot_id is None:
        raise HTTPException(status_code=400, detail="lot_id is required for lot-tracked transfers")

    # Deduct from source
    apply_stock_delta(
        db,
        owner_id=owner_id,
        item_type=transfer.item_type,
        item=item,
        quantity_delta=-transfer.quantity,
        movement_type="transfer_out",
        source_type="transfer",
        source_id=tx_id,
        reason=f"Transfer to location {transfer.to_location_id}",
        created_by_user_id=current_user.id,
        client_mutation_id=client_mutation_id,
        location_id=transfer.from_location_id,
        lot_id=transfer.lot_id,
        correlation_id=tx_id,
    )

    # Add to destination
    apply_stock_delta(
        db,
        owner_id=owner_id,
        item_type=transfer.item_type,
        item=item,
        quantity_delta=transfer.quantity,
        movement_type="transfer_in",
        source_type="transfer",
        source_id=tx_id,
        reason=f"Transfer from location {transfer.from_location_id}",
        created_by_user_id=current_user.id,
        client_mutation_id=client_mutation_id,
        location_id=transfer.to_location_id,
        lot_id=transfer.lot_id,
        correlation_id=tx_id,
    )

    db.commit()
    return {"success": True}


class StockLocationCreate(BaseModel):
    name: str
    type: str
    branch_name: str | None = None

def create_stock_location(
    body: StockLocationCreate,
    db: sqlalchemy.orm.Session,
    owner_id: int,
):
    """Create a new stock location."""
    # Check if a location with the same name already exists for this owner
    existing = db.query(models.StockLocation).filter(
        models.StockLocation.owner_id == owner_id,
        models.StockLocation.name == body.name
    ).first()

    if existing:
        if not existing.is_active:
            existing.is_active = True
            existing.type = body.type
            existing.branch_name = body.branch_name
            db.commit()
            return {"success": True, "id": existing.id}
        raise HTTPException(status_code=400, detail="Location name already exists")

    location = models.StockLocation(
        owner_id=owner_id,
        name=body.name,
        type=body.type,
        branch_name=body.branch_name,
        is_default=False,
        is_active=True,
    )
    db.add(location)
    db.commit()
    db.refresh(location)
    return {
        "success": True,
        "id": location.id,
        "name": location.name,
        "type": location.type,
    }


def get_stock_lot_balances(
    db: sqlalchemy.orm.Session,
    owner_id: int,
    item_type: str | None = None,
    item_id: str | None = None,
    location_id: int | None = None,
    include_zero: bool = False,
):
    query = (
        db.query(models.StockLotBalance)
        .options(
            joinedload(models.StockLotBalance.lot),
            joinedload(models.StockLotBalance.location),
        )
        .filter(models.StockLotBalance.owner_id == owner_id)
    )
    if not include_zero:
        query = query.filter(models.StockLotBalance.quantity > 0)
    if location_id is not None:
        query = query.filter(models.StockLotBalance.location_id == location_id)
    joined_lot = False
    if item_type:
        query = query.join(models.StockLot, models.StockLotBalance.lot_id == models.StockLot.id).filter(
            models.StockLot.item_type == item_type,
            models.StockLot.owner_id == owner_id,
        )
        joined_lot = True
    if item_id:
        if not joined_lot:
            query = query.join(models.StockLot, models.StockLotBalance.lot_id == models.StockLot.id)
        query = query.filter(
            models.StockLot.item_id == item_id,
            models.StockLot.owner_id == owner_id,
        )

    balances = query.all()
    def sort_date(value
):
        return value.isoformat() if value else "9999-12-31T23:59:59"

    balances.sort(key=lambda balance: (
        balance.lot.expires_at is None if balance.lot else True,
        sort_date(balance.lot.expires_at if balance.lot else None),
        sort_date((balance.lot.received_at or balance.lot.produced_at) if balance.lot else None),
        balance.id,
    ))

    return [
            {
                "id": balance.id,
                "quantity": balance.quantity,
                "reserved_quantity": balance.reserved_quantity,
                "available_quantity": (balance.quantity or 0) - (balance.reserved_quantity or 0),
                "updated_at": balance.updated_at.isoformat() if balance.updated_at else None,
                "location": {
                    "id": balance.location.id,
                    "name": balance.location.name,
                    "type": balance.location.type,
                    "branch_name": balance.location.branch_name,
                } if balance.location else None,
                "lot": {
                    "id": balance.lot.id,
                    "item_type": balance.lot.item_type,
                    "item_id": balance.lot.item_id,
                    "item_name": balance.lot.item_name_snapshot,
                    "lot_code": balance.lot.lot_code,
                    "supplier_lot_code": balance.lot.supplier_lot_code,
                    "internal_batch_code": balance.lot.internal_batch_code,
                    "source_type": balance.lot.source_type,
                    "source_id": balance.lot.source_id,
                    "received_at": balance.lot.received_at.isoformat() if balance.lot.received_at else None,
                    "produced_at": balance.lot.produced_at.isoformat() if balance.lot.produced_at else None,
                    "expires_at": balance.lot.expires_at.isoformat() if balance.lot.expires_at else None,
                    "unit": balance.lot.unit_snapshot,
                    "unit_cost": balance.lot.unit_cost_snapshot,
                    "status": balance.lot.status,
                    "created_at": balance.lot.created_at.isoformat() if balance.lot.created_at else None,
                } if balance.lot else None,
            }
            for balance in balances
        ]


# ── Phase 6 — Recall + Traceability ─────────────────────────────────────────


class LotStatusUpdate(BaseModel):
    status: str  # active | quarantined | recalled | expired
    reason: str | None = None


def _serialize_lot_with_balances(lot: models.StockLot, balances
):
    return {
        "id": lot.id,
        "item_type": lot.item_type,
        "item_id": lot.item_id,
        "item_name": lot.item_name_snapshot,
        "lot_code": lot.lot_code,
        "supplier_lot_code": lot.supplier_lot_code,
        "internal_batch_code": lot.internal_batch_code,
        "received_at": lot.received_at.isoformat() if lot.received_at else None,
        "produced_at": lot.produced_at.isoformat() if lot.produced_at else None,
        "expires_at": lot.expires_at.isoformat() if lot.expires_at else None,
        "status": lot.status,
        "balances": [
            {
                "location_id": b.location_id,
                "location_name": b.location.name if b.location else None,
                "quantity": b.quantity,
                "reserved_quantity": b.reserved_quantity,
            }
            for b in balances
        ],
    }


def set_lot_status(
    lot_id: int,
    payload: LotStatusUpdate,
    db: sqlalchemy.orm.Session,
    owner_id: int,
):
    """Mark a lot as active/quarantined/recalled/expired.

    FEFO picking already excludes any lot whose status is not 'active'
    (services/stock.py:90), so recalling a lot instantly removes it from
    automatic consumption without touching the balance rows.
    """
    valid_statuses = {"active", "quarantined", "recalled", "expired"}
    if payload.status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status; allowed: {sorted(valid_statuses)}",
        )

    lot = (
        db.query(models.StockLot)
        .filter(models.StockLot.id == lot_id, models.StockLot.owner_id == owner_id)
        .first()
    )
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")

    previous_status = lot.status
    lot.status = payload.status
    db.commit()
    return {
        "id": lot.id,
        "previous_status": previous_status,
        "status": lot.status,
        "reason": payload.reason,
        "success": True,
    }


def recall_report(
    db: sqlalchemy.orm.Session,
    owner_id: int,
    supplier_lot_code: str | None = None,
    lot_id: int | None = None,
    since: str | None = None,
):
    """Phase 6 — Aggregate every lot matching the recall filter, plus all
    downstream stock movements recorded against those lots so the owner can
    see where the suspect stock has been used."""
    if supplier_lot_code is None and lot_id is None:
        raise HTTPException(
            status_code=400,
            detail="Supply either supplier_lot_code or lot_id",
        )

    query = db.query(models.StockLot).filter(models.StockLot.owner_id == owner_id)
    if lot_id is not None:
        query = query.filter(models.StockLot.id == lot_id)
    if supplier_lot_code is not None:
        query = query.filter(models.StockLot.supplier_lot_code == supplier_lot_code)
    if since is not None:
        from datetime import datetime as _dt
        try:
            cutoff = _dt.fromisoformat(since)
        except ValueError:
            raise HTTPException(status_code=400, detail="`since` must be ISO 8601 (YYYY-MM-DD)")
        query = query.filter(models.StockLot.received_at >= cutoff)

    lots = query.all()
    lot_ids = [lot.id for lot in lots]

    # Movements recorded against the suspect lots — these tell the story of
    # where the lot's stock has flowed (receiving, production input, transfer out).
    movements = []
    if lot_ids:
        mv_rows = (
            db.query(models.StockMovement)
            .filter(
                models.StockMovement.owner_id == owner_id,
                models.StockMovement.lot_id.in_(lot_ids),
            )
            .order_by(models.StockMovement.created_at)
            .all()
        )
        movements = [
            {
                "id": m.id,
                "movement_type": m.movement_type,
                "item_type": m.item_type,
                "item_id": m.item_id,
                "item_name": m.item_name_snapshot,
                "quantity_delta": m.quantity_delta,
                "source_type": m.source_type,
                "source_id": m.source_id,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in mv_rows
        ]

    balance_rows = (
        db.query(models.StockLotBalance)
        .options(joinedload(models.StockLotBalance.location))
        .filter(
            models.StockLotBalance.owner_id == owner_id,
            models.StockLotBalance.lot_id.in_(lot_ids),
        )
        .all()
    )
    balances_by_lot: Dict[int, list] = {}
    for b in balance_rows:
        balances_by_lot.setdefault(b.lot_id, []).append(b)

    return {
            "lots": [
                _serialize_lot_with_balances(
                    lot,
                    balances_by_lot.get(lot.id, []),
                )
                for lot in lots
            ],
            "movements": movements,
            "summary": {
                "lot_count": len(lots),
                "movement_count": len(movements),
                "total_on_hand": sum(
                    b.quantity for b in balance_rows
                ),
            },
        }


def trace_lot(
    lot_id: int,
    db: sqlalchemy.orm.Session,
    owner_id: int,
):
    """Phase 6 — Forward trace from one lot through every StockMovement
    recorded against it: receiving → production inputs → production outputs
    (via source_id linked to a production batch) → POS sales.

    The response is a chronological timeline of everything that has happened to
    a lot's stock. The owner can use it as a printable traceability report
    when answering a supplier recall notice.
    """
    lot = (
        db.query(models.StockLot)
        .filter(models.StockLot.id == lot_id, models.StockLot.owner_id == owner_id)
        .first()
    )
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")

    movements = (
        db.query(models.StockMovement)
        .filter(
            models.StockMovement.owner_id == owner_id,
            models.StockMovement.lot_id == lot_id,
        )
        .order_by(models.StockMovement.created_at)
        .all()
    )

    # Collect downstream batch + finished-lot info: every StockMovement with
    # source_type='production_batch' tells us which batch consumed this lot
    # (production_input) or produced a new lot (production_output).
    batch_ids = {
        m.source_id for m in movements
        if m.source_type == "production_batch" and m.source_id
    }
    batches_by_id: Dict[str, models.ProductionBatch] = {}
    if batch_ids:
        for b in db.query(models.ProductionBatch).filter(
            models.ProductionBatch.id.in_(batch_ids),
            models.ProductionBatch.owner_id == owner_id,
        ).all():
            batches_by_id[b.id] = b

    # For output movements, find the downstream finished-product lot that the
    # batch produced. We look up by source_type='production_batch' + source_id
    # on the movement that produced the output lot.
    timeline = []
    for m in movements:
        entry = {
            "id": m.id,
            "movement_type": m.movement_type,
            "item_type": m.item_type,
            "item_id": m.item_id,
            "item_name": m.item_name_snapshot,
            "quantity_delta": m.quantity_delta,
            "source_type": m.source_type,
            "source_id": m.source_id,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        if m.source_type == "production_batch" and m.source_id:
            batch = batches_by_id.get(m.source_id)
            entry["batch"] = (
                {
                    "id": batch.id,
                    "product_id": batch.product_id,
                    "quantity": batch.quantity,
                    "stage": batch.stage,
                    "completed_at": batch.completed_at.isoformat() if batch.completed_at else None,
                }
                if batch else None
            )
        timeline.append(entry)

    return {
            "lot": {
                "id": lot.id,
                "item_type": lot.item_type,
                "item_id": lot.item_id,
                "item_name": lot.item_name_snapshot,
                "lot_code": lot.lot_code,
                "supplier_lot_code": lot.supplier_lot_code,
                "received_at": lot.received_at.isoformat() if lot.received_at else None,
                "produced_at": lot.produced_at.isoformat() if lot.produced_at else None,
                "expires_at": lot.expires_at.isoformat() if lot.expires_at else None,
                "status": lot.status,
            },
            "timeline": timeline,
            "movement_count": len(timeline),
        }


# ── End Phase 6 recall/trace ─────────────────────────────────────────────


def inventory(
    db: sqlalchemy.orm.Session,
    owner_id: int,
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
            "allergens": ing.allergens,
            "is_organic": ing.is_organic,
            "purchase_unit": ing.purchase_unit,
            "purchase_to_base_ratio": ing.purchase_to_base_ratio,
        }
        for ing in ingredients
    }

    products_list = []
    for product in products:
        product_allergens: set = set()
        for item in product.recipe_items:
            if item.ingredient and item.ingredient.allergens:
                product_allergens.update(item.ingredient.allergens)
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
                "allergens": sorted(product_allergens),
                "ingredients": [
                    {
                        "name": item.ingredient.name if item.ingredient else "Unknown",
                        "quantity": item.quantity,
                    }
                    for item in product.recipe_items
                ],
            }
        )

    return {"materials": materials_dict, "products": products_list}


def get_prep_sheet(
    db: sqlalchemy.orm.Session,
    owner_id: int,
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
                    {''.join([f"<tr><td class='item-name'>{escape(str(p['icon']))} {escape(str(p['name']))}</td><td class='qty'>{p['qty']} units</td></tr>" for p in production_summary])}
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
                    {''.join([f"<tr><td class='item-name'>{escape(str(name))}</td><td class='qty'>{round(data['qty'], 2)}</td><td>{escape(str(data['unit']))}</td></tr>" for name, data in requirements.items()])}
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

def get_history(
    db: sqlalchemy.orm.Session,
    owner_id: int,
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
    return data


def get_planner(
    db: sqlalchemy.orm.Session,
    owner_id: int,
):
    rows = db.query(models.Planner).filter(models.Planner.owner_id == owner_id).all()
    return [
        {
            "id": r.id, "product_id": r.product_id,
            "date": str(r.date), "quantity": r.quantity, "status": r.status,
        } for r in rows
    ]


def update_planner(
    plan: PlanList,
    db: sqlalchemy.orm.Session,
    owner_id: int,
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


def get_settings_api(
    db: sqlalchemy.orm.Session,
    owner_id: int,
) -> SettingsPayload:
    settings = db.query(models.SystemSetting).filter(models.SystemSetting.owner_id == owner_id).all()
    return {setting.key: setting.value for setting in settings}


def update_settings(
    payload: SettingsPayload,
    db: sqlalchemy.orm.Session,
    owner_id: int,
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


# ── Phase 6 Slice 2 — Temperature logs, hygiene logs, waste-by-reason ────────


class TemperatureLogCreate(BaseModel):
    location_label: str
    temperature_c: float
    notes: str | None = None


class HygieneLogCreate(BaseModel):
    task_type: str
    area: str | None = None
    notes: str | None = None


def get_temperature_logs(
    db: sqlalchemy.orm.Session,
    owner_id: int,
    limit: int = 100,
):
    """Owner-facing cold-chain / oven temperature history."""
    logs = (
        db.query(models.TemperatureLog)
        .filter(models.TemperatureLog.owner_id == owner_id)
        .order_by(models.TemperatureLog.recorded_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": log.id,
            "recorded_at": log.recorded_at.isoformat() if log.recorded_at else None,
            "location_label": log.location_label,
            "temperature_c": log.temperature_c,
            "notes": log.notes,
        }
        for log in logs
    ]


def create_temperature_log(
    payload: TemperatureLogCreate,
    db: sqlalchemy.orm.Session,
    owner_id: int,
    current_user: models.User,
):
    log = models.TemperatureLog(
        owner_id=owner_id,
        location_label=payload.location_label.strip(),
        temperature_c=payload.temperature_c,
        notes=payload.notes,
        recorded_by_user_id=current_user.id,
    )
    db.add(log)
    db.commit()
    return {"id": log.id, "success": True}


def get_hygiene_logs(
    db: sqlalchemy.orm.Session,
    owner_id: int,
    limit: int = 100,
):
    """Owner-facing cleaning / hygiene checklist history."""
    logs = (
        db.query(models.HygieneLog)
        .filter(models.HygieneLog.owner_id == owner_id)
        .order_by(models.HygieneLog.recorded_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": log.id,
            "recorded_at": log.recorded_at.isoformat() if log.recorded_at else None,
            "task_type": log.task_type,
            "area": log.area,
            "notes": log.notes,
        }
        for log in logs
    ]


def create_hygiene_log(
    payload: HygieneLogCreate,
    db: sqlalchemy.orm.Session,
    owner_id: int,
    current_user: models.User,
):
    log = models.HygieneLog(
        owner_id=owner_id,
        task_type=payload.task_type.strip(),
        area=payload.area,
        notes=payload.notes,
        recorded_by_user_id=current_user.id,
    )
    db.add(log)
    db.commit()
    return {"id": log.id, "success": True}


def waste_breakdown_by_reason(
    db: sqlalchemy.orm.Session,
    owner_id: int,
):
    """Aggregate waste by reason category — supports quality / recall reporting.

    Returns one row per reason category with total quantity and total loss cost.
    """
    from sqlalchemy import func

    rows = (
        db.query(
            models.WasteRecord.reason,
            func.sum(models.WasteRecord.quantity).label("total_qty"),
            func.sum(models.WasteRecord.loss_cost).label("total_loss"),
            func.count(models.WasteRecord.id).label("record_count"),
        )
        .filter(models.WasteRecord.owner_id == owner_id)
        .group_by(models.WasteRecord.reason)
        .all()
    )
    return [
        {
            "reason": row.reason or "other",
            "total_quantity": float(row.total_qty or 0),
            "total_loss": float(row.total_loss or 0),
            "record_count": int(row.record_count or 0),
        }
        for row in rows
    ]


# ── End Phase 6 Slice 2 ──────────────────────────────────────────────────────
