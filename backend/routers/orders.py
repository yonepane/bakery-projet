"""Order routes for BakeryOS."""

import uuid
from datetime import datetime

import sqlalchemy.orm
from fastapi import APIRouter, Depends, HTTPException

try:
    import models
    from auth import get_effective_owner_id, requires_roles
    from database import get_db
    from schemas import OrderCreate
except ImportError:
    import models
    from auth import get_effective_owner_id, requires_roles
    from database import get_db
    from schemas import OrderCreate

router = APIRouter()

# Allowed order status values — reject anything outside this set
VALID_ORDER_STATUSES = {"pending", "baking", "ready", "picked_up", "completed", "cancelled"}


@router.get("/api/orders")
async def get_orders(
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    return (
        db.query(models.Order)
        .filter(models.Order.owner_id == owner_id)
        .order_by(models.Order.pickup_date.asc())
        .all()
    )


@router.post("/api/orders", dependencies=[Depends(requires_roles(["owner"]))])
async def create_order(
    order_data: OrderCreate,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    total_price = 0
    items_snapshot = []

    for item in order_data.items:
        product = db.query(models.Product).filter(
            models.Product.id == item.id,
            models.Product.owner_id == owner_id,
        ).first()
        if product:
            total_price += product.price * item.qty
            items_snapshot.append(
                {
                    "id": product.id,
                    "name": product.name,
                    "qty": item.qty,
                    "price": product.price,
                }
            )

    new_order = models.Order(
        id=str(uuid.uuid4())[:8].upper(),
        owner_id=owner_id,
        customer_name=order_data.customer_name,
        customer_phone=order_data.customer_phone,
        customer_id=order_data.customer_id,
        items=items_snapshot,
        total_price=total_price,
        deposit_paid=order_data.deposit_paid,
        pickup_date=datetime.fromisoformat(order_data.pickup_date),
        status="pending",
        notes=order_data.notes,
    )
    db.add(new_order)
    db.commit()
    return new_order


@router.patch("/api/orders/{id}/status", dependencies=[Depends(requires_roles(["owner"]))])
async def update_order_status(
    id: str,
    status: str,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    if status not in VALID_ORDER_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status '{status}'. Must be one of: {sorted(VALID_ORDER_STATUSES)}",
        )
    order = db.query(models.Order).filter(
        models.Order.id == id,
        models.Order.owner_id == owner_id,
    ).first()
    if order:
        order.status = status
        db.commit()
        return order
    raise HTTPException(status_code=404, detail="Order not found")
