"""Customer endpoints for BakeryOS CRM."""

import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
import sqlalchemy.orm

try:
    from .. import models
    from ..auth import get_effective_owner_id, requires_roles
    from ..database import get_db
    from ..schemas import CustomerCreate, CustomerUpdate
except ImportError:
    import models
    from auth import get_effective_owner_id, requires_roles
    from database import get_db
    from schemas import CustomerCreate, CustomerUpdate

router = APIRouter()

@router.get("/api/customers")
async def get_customers(
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    """Retrieve all customers for the current bakery."""
    customers = db.query(models.Customer).filter(models.Customer.owner_id == owner_id).all()
    data = [
        {"id": c.id, "name": c.name, "phone": c.phone, "email": c.email, "points": c.points}
        for c in customers
    ]
    return JSONResponse(content=data, headers={"Cache-Control": "private, max-age=60"})

@router.post("/api/customers", dependencies=[Depends(requires_roles(["owner", "cashier"]))])
async def create_customer(
    customer: CustomerCreate,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    """Create a new customer."""
    new_customer = models.Customer(
        id=str(uuid.uuid4())[:8].upper(),
        owner_id=owner_id,
        name=customer.name,
        phone=customer.phone,
        email=customer.email,
        points=0,
    )
    db.add(new_customer)
    db.commit()
    db.refresh(new_customer)
    return new_customer

@router.patch("/api/customers/{id}", dependencies=[Depends(requires_roles(["owner", "cashier"]))])
async def update_customer(
    id: str,
    customer_update: CustomerUpdate,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    """Update an existing customer."""
    customer = db.query(models.Customer).filter(
        models.Customer.id == id,
        models.Customer.owner_id == owner_id,
    ).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    update_data = customer_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(customer, key, value)

    db.commit()
    db.refresh(customer)
    return customer


@router.delete("/api/customers/{id}", dependencies=[Depends(requires_roles(["owner"]))])
async def delete_customer(
    id: str,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    """Delete a customer by ID (owner-only).

    Blocked if the customer is referenced by any transaction, to preserve
    historical financial records.
    """
    customer = db.query(models.Customer).filter(
        models.Customer.id == id,
        models.Customer.owner_id == owner_id,
    ).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    linked_transactions = (
        db.query(models.Transaction)
        .filter(
            models.Transaction.customer_id == id,
            models.Transaction.owner_id == owner_id,
        )
        .count()
    )
    if linked_transactions:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete customer with {linked_transactions} linked transaction(s). Remove transactions first.",
        )

    db.delete(customer)
    db.commit()
    return {"success": True}
