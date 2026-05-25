"""Expenses, exports, and shift-closing routes for BakeryOS."""

import csv
from datetime import datetime, timedelta
from io import StringIO

import sqlalchemy.orm
from sqlalchemy.orm import joinedload
from fastapi import APIRouter, Depends
from fastapi.responses import Response

try:
    from .. import models
    from ..auth import get_effective_owner_id, requires_roles
    from ..database import get_db
    from ..schemas import ExpenseCreate
except ImportError:
    import models
    from auth import get_effective_owner_id, requires_roles
    from database import get_db
    from schemas import ExpenseCreate

router = APIRouter()


@router.get("/api/expenses", dependencies=[Depends(requires_roles(["owner"]))])
async def get_expenses(
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    return (
        db.query(models.Expense)
        .options(joinedload(models.Expense.payments), joinedload(models.Expense.supplier))
        .filter(models.Expense.owner_id == owner_id)
        .order_by(models.Expense.date.desc())
        .all()
    )


@router.post("/api/expenses", dependencies=[Depends(requires_roles(["owner"]))])
async def add_expense(
    exp: ExpenseCreate,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    exp_data = exp.dict(exclude={"payments"})
    if exp_data.get("amount") is not None and exp_data.get("amount_ttc") == 0.0:
        exp_data["amount_ttc"] = exp_data["amount"]

    new_exp = models.Expense(**exp_data, owner_id=owner_id)
    db.add(new_exp)
    db.flush()
    
    if exp.payments:
        for p in exp.payments:
            payment = models.ExpensePayment(
                expense_id=new_exp.id,
                amount=p.amount,
                payment_method=p.payment_method,
                paid_at=datetime.fromisoformat(p.paid_at) if p.paid_at else datetime.utcnow()
            )
            db.add(payment)
            
    db.commit()
    return {"success": True}


@router.put("/api/expenses/{expense_id}", dependencies=[Depends(requires_roles(["owner"]))])
async def update_expense(
    expense_id: int,
    exp: ExpenseCreate,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    existing = db.query(models.Expense).filter(
        models.Expense.id == expense_id,
        models.Expense.owner_id == owner_id,
    ).first()
    if not existing:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Expense not found")

    exp_data = exp.dict(exclude={"payments"})
    for key, val in exp_data.items():
        setattr(existing, key, val)

    # Re-sync payments if provided
    if exp.payments is not None:
        # Delete old payments and re-create
        db.query(models.ExpensePayment).filter(
            models.ExpensePayment.expense_id == expense_id
        ).delete()
        for p in exp.payments:
            payment = models.ExpensePayment(
                expense_id=expense_id,
                amount=p.amount,
                payment_method=p.payment_method,
                paid_at=datetime.fromisoformat(p.paid_at) if p.paid_at else datetime.utcnow(),
            )
            db.add(payment)

    db.commit()
    return {"success": True}


@router.delete("/api/expenses/{expense_id}", dependencies=[Depends(requires_roles(["owner"]))])
async def delete_expense(
    expense_id: int,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    existing = db.query(models.Expense).filter(
        models.Expense.id == expense_id,
        models.Expense.owner_id == owner_id,
    ).first()
    if not existing:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Expense not found")

    db.delete(existing)
    db.commit()
    return {"success": True}


@router.get("/api/accounting/export", dependencies=[Depends(requires_roles(["owner"]))])
async def export_accounting(
    start: str,
    end: str,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    start_date = datetime.fromisoformat(start)
    end_date = datetime.fromisoformat(end) + timedelta(days=1)

    expenses = db.query(models.Expense).filter(
        models.Expense.owner_id == owner_id,
        models.Expense.date >= start_date,
        models.Expense.date < end_date,
    ).all()
    purchase_orders = db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.owner_id == owner_id,
        models.PurchaseOrder.date >= start_date,
        models.PurchaseOrder.date < end_date,
    ).all()
    transactions = db.query(models.Transaction).filter(
        models.Transaction.owner_id == owner_id,
        models.Transaction.timestamp >= start_date,
        models.Transaction.timestamp < end_date,
        models.Transaction.type == "sale",
    ).all()

    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(["date", "entry_type", "reference", "label", "status", "amount"])
    for tx in transactions:
        writer.writerow([tx.timestamp.date().isoformat(), "sale", tx.id, "POS revenue", "posted", tx.total_revenue])
    for exp in expenses:
        writer.writerow([exp.date.date().isoformat(), "expense", exp.id, exp.description or exp.category, exp.category, -exp.amount])
    for po in purchase_orders:
        total = sum(float(item.get("qty", 0)) * float(item.get("price", 0)) for item in po.items)
        writer.writerow([po.date.date().isoformat(), "purchase_order", po.id, f"Supplier #{po.supplier_id}", po.status, -total])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="accounting-{start}-to-{end}.csv"'},
    )


@router.post("/api/maintenance/reset-session", dependencies=[Depends(requires_roles(["owner"]))])
async def reset_session(
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    reset_setting = db.query(models.SystemSetting).filter(
        models.SystemSetting.key == "last_reset_at",
        models.SystemSetting.owner_id == owner_id,
    ).first()

    now = datetime.now()
    if reset_setting:
        last_reset = datetime.fromisoformat(reset_setting.value)
    else:
        last_reset = datetime(now.year, now.month, now.day)

    transactions = db.query(models.Transaction).filter(
        models.Transaction.owner_id == owner_id,
        models.Transaction.timestamp >= last_reset,
    ).all()
    waste = db.query(models.WasteRecord).filter(
        models.WasteRecord.owner_id == owner_id,
        models.WasteRecord.date >= last_reset,
    ).all()

    revenue = sum(t.total_revenue for t in transactions if t.type == "sale")
    cost = sum(t.total_cost for t in transactions) + sum(w.loss_cost for w in waste)

    shift_record = models.ShiftRecord(
        owner_id=owner_id,
        start_time=last_reset,
        end_time=now,
        revenue=revenue,
        cost=cost,
    )
    db.add(shift_record)

    now_str = now.isoformat()
    if reset_setting:
        reset_setting.value = now_str
    else:
        reset_setting = models.SystemSetting(key="last_reset_at", owner_id=owner_id, value=now_str)
        db.add(reset_setting)

    db.commit()
    return {"success": True, "message": "Shift has been closed. Session profit reset to 0. Historical data preserved."}
