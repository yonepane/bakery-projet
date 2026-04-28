"""Expenses, exports, and shift-closing routes for BakeryOS."""

import csv
from datetime import datetime, timedelta
from io import StringIO

import sqlalchemy.orm
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
    new_exp = models.Expense(**exp.dict(), owner_id=owner_id)
    db.add(new_exp)
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
