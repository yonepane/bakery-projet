"""Stock mutation helpers for BakeryOS.

The legacy `stock` columns still power the app. This service centralizes new
mutations so each route can gradually gain an audit ledger without a risky
rewrite.
"""

from datetime import datetime, timezone
from typing import Literal

import sqlalchemy.orm
from fastapi import HTTPException

try:
    from .. import models
except ImportError:
    import models


ItemType = Literal["ingredient", "product", "semi_finished"]


def find_movements_by_client_mutation(
    db: sqlalchemy.orm.Session,
    *,
    owner_id: int,
    client_mutation_id: str | None,
    movement_type: str | None = None,
) -> list[models.StockMovement]:
    """Return prior movement rows for an idempotent client mutation."""
    if not client_mutation_id:
        return []
    query = db.query(models.StockMovement).filter(
        models.StockMovement.owner_id == owner_id,
        models.StockMovement.client_mutation_id == client_mutation_id,
    )
    if movement_type:
        query = query.filter(models.StockMovement.movement_type == movement_type)
    return query.order_by(models.StockMovement.id.asc()).all()


def apply_stock_delta(
    db: sqlalchemy.orm.Session,
    *,
    owner_id: int,
    item_type: ItemType,
    item,
    quantity_delta: float,
    movement_type: str,
    source_type: str | None = None,
    source_id: str | None = None,
    reason: str | None = None,
    created_by_user_id: int | None = None,
    client_mutation_id: str | None = None,
    location_id: int | None = None,
    lot_id: int | None = None,
    expires_at: datetime | None = None,
    unit_cost: float | None = None,
    correlation_id: str | None = None,
    allow_negative: bool = False,
    picking_strategy: Literal["fefo"] | None = None,
) -> models.StockMovement | list[models.StockMovement]:
    """Update an item's stock and write the matching movement row."""
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")
    if item.owner_id != owner_id:
        raise HTTPException(status_code=404, detail="Item not found")

    if picking_strategy == "fefo" and quantity_delta < 0:
        expected_item_id = str(item.id if item_type in ("product", "semi_finished") else item.name)
        
        has_lots = db.query(models.StockLot).filter(
            models.StockLot.owner_id == owner_id,
            models.StockLot.item_type == item_type,
            models.StockLot.item_id == expected_item_id,
        ).first() is not None

        if has_lots:
            # 1. Lots with expiration dates before lots without
            # 2. Earliest expires_at
            # 3. Earliest received_at or produced_at
            # 4. Lowest lot_id
            eligible_balances = (
                db.query(models.StockLotBalance)
                .join(models.StockLot, models.StockLotBalance.lot_id == models.StockLot.id)
                .filter(
                    models.StockLotBalance.owner_id == owner_id,
                    models.StockLot.item_type == item_type,
                    models.StockLot.item_id == expected_item_id,
                    models.StockLot.status == "active",
                    (models.StockLotBalance.quantity - models.StockLotBalance.reserved_quantity) > 0,
                )
                .order_by(
                    models.StockLot.expires_at.is_(None),  # false sorts before true
                    models.StockLot.expires_at.asc(),
                    models.StockLot.received_at.asc(),
                    models.StockLot.produced_at.asc(),
                    models.StockLot.id.asc(),
                )
                .all()
            )
            
            remaining_to_deduct = abs(quantity_delta)
            movements = []
            
            for bal in eligible_balances:
                available = float(bal.quantity or 0) - float(bal.reserved_quantity or 0)
                if available <= 0:
                    continue
                    
                deduct_amount = min(remaining_to_deduct, available)
                
                movement = apply_stock_delta(
                    db,
                    owner_id=owner_id,
                    item_type=item_type,
                    item=item,
                    quantity_delta=-deduct_amount,
                    movement_type=movement_type,
                    source_type=source_type,
                    source_id=source_id,
                    reason=reason,
                    created_by_user_id=created_by_user_id,
                    client_mutation_id=client_mutation_id,
                    location_id=bal.location_id,
                    lot_id=bal.lot_id,
                    correlation_id=correlation_id,
                    allow_negative=allow_negative,
                )
                movements.append(movement)
                remaining_to_deduct -= deduct_amount
                if remaining_to_deduct <= 0:
                    break
                    
            if remaining_to_deduct > 0 and not allow_negative:
                raise HTTPException(status_code=400, detail=f"Not enough stock in eligible lots for {item.name}")
                
            return movements

    before_qty = float(item.stock or 0)
    after_qty = before_qty + float(quantity_delta)
    if after_qty < 0 and not allow_negative:
        raise HTTPException(status_code=400, detail="Stock cannot go below zero")

    location = None
    lot = None
    if (location_id is None) != (lot_id is None):
        raise HTTPException(status_code=400, detail="location_id and lot_id must be provided together")
    if location_id is not None and lot_id is not None:
        location = db.query(models.StockLocation).filter(
            models.StockLocation.id == location_id,
            models.StockLocation.owner_id == owner_id,
            models.StockLocation.is_active == True,  # noqa: E712
        ).first()
        if location is None:
            raise HTTPException(status_code=404, detail="Stock location not found")

        expected_item_id = str(item.id if item_type in ("product", "semi_finished") else item.name)
        lot = db.query(models.StockLot).filter(
            models.StockLot.id == lot_id,
            models.StockLot.owner_id == owner_id,
            models.StockLot.item_type == item_type,
            models.StockLot.item_id == expected_item_id,
        ).first()
        if lot is None:
            raise HTTPException(status_code=404, detail="Stock lot not found")

        balance = db.query(models.StockLotBalance).filter(
            models.StockLotBalance.owner_id == owner_id,
            models.StockLotBalance.lot_id == lot.id,
            models.StockLotBalance.location_id == location.id,
        ).first()
        if balance is None:
            if quantity_delta < 0:
                raise HTTPException(status_code=400, detail="Not enough stock in lot/location")
            balance = models.StockLotBalance(
                owner_id=owner_id,
                lot_id=lot.id,
                location_id=location.id,
                quantity=0,
                reserved_quantity=0,
            )
            db.add(balance)

        next_balance_qty = float(balance.quantity or 0) + float(quantity_delta)
        if next_balance_qty < 0 and not allow_negative:
            raise HTTPException(status_code=400, detail="Not enough stock in lot/location")
        balance.quantity = next_balance_qty
        balance.updated_at = datetime.now(timezone.utc)

    item.stock = after_qty
    movement = models.StockMovement(
        owner_id=owner_id,
        item_type=item_type,
        item_id=str(item.id if item_type in ("product", "semi_finished") else item.name),
        item_name_snapshot=item.name,
        quantity_delta=float(quantity_delta),
        unit_snapshot=getattr(item, "unit", "unit"),
        movement_type=movement_type,
        source_type=source_type,
        source_id=source_id,
        reason=reason,
        before_qty=before_qty,
        after_qty=after_qty,
        created_at=datetime.now(timezone.utc),
        created_by_user_id=created_by_user_id,
        client_mutation_id=client_mutation_id,
        location_id=location.id if location else None,
        location_name_snapshot=location.name if location else None,
        lot_id=lot.id if lot else None,
        lot_code_snapshot=lot.lot_code if lot else None,
        expires_at=expires_at if expires_at is not None else (lot.expires_at if lot else None),
        unit_cost_snapshot=unit_cost if unit_cost is not None else (lot.unit_cost_snapshot if lot else None),
        correlation_id=correlation_id,
    )
    db.add(movement)
    return movement
