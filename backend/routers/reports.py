"""Phase 7 — Financial reporting endpoints (stock valuation, batch margin, supplier ledger, CSV export)."""
from datetime import datetime, timezone, timedelta
from typing import Dict, List

import sqlalchemy.orm
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import joinedload
from sqlalchemy import func
import csv
import io
import json

try:
    from .. import models
    from ..auth import get_effective_owner_id, requires_roles
    from ..database import get_db
except ImportError:
    import models
    from auth import get_effective_owner_id, requires_roles
    from database import get_db


router = APIRouter(tags=["reports"], prefix="/api/finance")

now_fn = lambda: datetime.now(timezone.utc)


def _compute_sf_cost(sf: models.SemiFinishedItem) -> float:
    """Approximate per-unit cost of a semi-finished item from its recipe ingredients."""
    total = 0.0
    for ri in sf.recipe_items if hasattr(sf, "recipe_items") else []:
        if ri.ingredient and ri.ingredient.price is not None:
            total += ri.quantity * ri.ingredient.price
    return total


# ── Stock Valuation ────────────────────────────────────────────────────────────

@router.get("/stock-valuation", dependencies=[Depends(requires_roles(["owner"]))])
async def stock_valuation(
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    now = now_fn()
    seven_days = now + timedelta(days=7)

    ingredients = (
        db.query(models.Ingredient)
        .filter(models.Ingredient.owner_id == owner_id)
        .all()
    )
    ingredient_value = sum(ing.stock * ing.price for ing in ingredients if ing.stock > 0)

    sf_items = (
        db.query(models.SemiFinishedItem)
        .options(
            joinedload(models.SemiFinishedItem.recipe_items)
            .joinedload(models.SemiFinishedRecipeItem.ingredient),
        )
        .filter(models.SemiFinishedItem.owner_id == owner_id)
        .all()
    )
    sf_value = sum(_compute_sf_cost(sf) * sf.stock for sf in sf_items if sf.stock > 0)

    from services.core import calculate_product_cost
    products = (
        db.query(models.Product)
        .options(
            joinedload(models.Product.recipe_items).joinedload(models.RecipeItem.ingredient),
            joinedload(models.Product.recipe_items).joinedload(models.RecipeItem.semi_finished),
        )
        .filter(models.Product.owner_id == owner_id)
        .all()
    )
    product_value = sum(
        calculate_product_cost(p) * p.stock for p in products if p.stock > 0
    )

    total_value = ingredient_value + sf_value + product_value

    lot_balances = (
        db.query(models.StockLotBalance)
        .options(joinedload(models.StockLotBalance.lot))
        .filter(
            models.StockLotBalance.owner_id == owner_id,
            models.StockLotBalance.quantity > 0,
        )
        .all()
    )

    expiring_soon_value = 0.0
    expired_value = 0.0
    by_status: Dict[str, dict] = {
        "active": {"value": 0.0, "qty": 0.0},
        "quarantined": {"value": 0.0, "qty": 0.0},
        "recalled": {"value": 0.0, "qty": 0.0},
        "expired": {"value": 0.0, "qty": 0.0},
    }

    for bal in lot_balances:
        lot = bal.lot
        if not lot:
            continue
        status = lot.status or "active"
        uc = lot.unit_cost_snapshot or 0.0
        val = bal.quantity * uc

        if status not in by_status:
            by_status[status] = {"value": 0.0, "qty": 0.0}
        by_status[status]["value"] += val
        by_status[status]["qty"] += bal.quantity

        if lot.expires_at:
            if lot.expires_at < now:
                expired_value += val
            elif lot.expires_at < seven_days:
                expiring_soon_value += val

    return JSONResponse(
        content={
            "ingredient_value": round(ingredient_value, 2),
            "sf_value": round(sf_value, 2),
            "product_value": round(product_value, 2),
            "total_value": round(total_value, 2),
            "expiring_soon_value": round(expiring_soon_value, 2),
            "expired_value": round(expired_value, 2),
            "by_status": {
                k: {"value": round(v["value"], 2), "quantity": v["qty"]}
                for k, v in sorted(by_status.items())
            },
            "calculated_at": now.isoformat(),
        },
        headers={"Cache-Control": "private, no-store"},
    )


# ── Production Batch Margin ────────────────────────────────────────────────────

@router.get("/production-margin", dependencies=[Depends(requires_roles(["owner"]))])
async def production_margin_report(
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
    limit: int = Query(default=200, ge=1, le=2000),
):
    batches = (
        db.query(models.ProductionBatch)
        .options(joinedload(models.ProductionBatch.product))
        .filter(
            models.ProductionBatch.owner_id == owner_id,
            models.ProductionBatch.stage.in_(
                ["ready", "bake", "cool", "fill", "decorate", "pack", "display"]
            ),
        )
        .order_by(models.ProductionBatch.completed_at.desc().nulls_last())
        .limit(limit)
        .all()
    )

    results = []
    total_margin = 0.0
    no_snapshot_count = 0

    for b in batches:
        cost_per_unit = None
        if b.cost_snapshot:
            if "cost_per_unit" in b.cost_snapshot:
                cost_per_unit = b.cost_snapshot["cost_per_unit"]
            elif "total_cost" in b.cost_snapshot:
                cost_per_unit = b.cost_snapshot["total_cost"]

        sp = b.product.price if b.product else 0

        if cost_per_unit is not None and sp > 0:
            margin_pu = sp - cost_per_unit
            total_batch_margin = margin_pu * b.quantity
            margin_pct = round((margin_pu / sp) * 100, 2)
        else:
            margin_pu = None
            total_batch_margin = None
            margin_pct = None
            if cost_per_unit is None:
                no_snapshot_count += 1

        total_margin += (total_batch_margin or 0)

        results.append({
            "batch_id": b.id,
            "product_name": b.product.name if b.product else "Unknown",
            "quantity": b.quantity,
            "stage": b.stage,
            "cost_per_unit": round(cost_per_unit, 6) if cost_per_unit is not None else None,
            "selling_price": sp,
            "margin_per_unit": round(margin_pu, 6) if margin_pu is not None else None,
            "total_batch_margin": round(total_batch_margin, 2) if total_batch_margin is not None else None,
            "margin_pct": margin_pct,
            "completed_at": b.completed_at.isoformat() if b.completed_at else None,
        })

    return JSONResponse(
        content={
            "batches": results,
            "batch_count": len(results),
            "total_margin": round(total_margin, 2),
            "batches_without_cost_snapshot": no_snapshot_count,
            "calculated_at": now_fn().isoformat(),
        },
        headers={"Cache-Control": "private, no-store"},
    )


# ── Supplier Ledger ────────────────────────────────────────────────────────────

@router.get("/supplier-ledger", dependencies=[Depends(requires_roles(["owner"]))])
async def supplier_ledger(
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    suppliers = (
        db.query(models.Supplier)
        .filter(models.Supplier.owner_id == owner_id)
        .all()
    )

    results = []
    for sup in suppliers:
        pos = (
            db.query(models.PurchaseOrder)
            .filter(
                models.PurchaseOrder.owner_id == owner_id,
                models.PurchaseOrder.supplier_id == sup.id,
                models.PurchaseOrder.archived == False,
            )
            .all()
        )
        total_po = 0.0
        open_po = 0.0
        open_count = 0
        received_count = 0
        for po in pos:
            items = po.items if isinstance(po.items, list) else []
            po_total = sum(
                (item.get("quantity", 0) or 0) * (item.get("price", 0) or 0)
                for item in items if isinstance(item, dict)
            )
            total_po += po_total
            if po.status in ("draft", "pending", "sent"):
                open_po += po_total
                open_count += 1
            elif po.status in ("received", "partial"):
                received_count += 1

        expenses = (
            db.query(models.Expense)
            .filter(
                models.Expense.owner_id == owner_id,
                models.Expense.supplier_id == sup.id,
            )
            .all()
        )
        total_exp = sum(e.amount_ht or e.amount or 0 for e in expenses)
        pending_exp = sum(
            (e.amount_ht or e.amount or 0)
            for e in expenses
            if e.status in ("pending", "partial")
        )

        results.append({
            "supplier_id": sup.id,
            "supplier_name": sup.name,
            "ice": sup.ice,
            "total_po_value": round(total_po, 2),
            "open_po_value": round(open_po, 2),
            "open_po_count": open_count,
            "received_po_count": received_count,
            "total_expense_value": round(total_exp, 2),
            "pending_expense_value": round(pending_exp, 2),
            "total_engagement": round(total_po + total_exp, 2),
        })

    return JSONResponse(
        content={
            "suppliers": results,
            "supplier_count": len(results),
            "total_open_purchase_commitment": round(sum(r["open_po_value"] for r in results), 2),
            "total_pending_payables": round(sum(r["pending_expense_value"] for r in results), 2),
            "calculated_at": now_fn().isoformat(),
        },
        headers={"Cache-Control": "private, no-store"},
    )


# ── CSV Export ─────────────────────────────────────────────────────────────────

def _to_csv_response(rows: list, header: list, report_name: str) -> StreamingResponse:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(header)
    writer.writerows(rows)
    output.seek(0)
    ts = now_fn().strftime("%Y%m%d_%H%M")
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{report_name}_{ts}.csv"',
        },
    )


@router.get("/export/{report_name}", dependencies=[Depends(requires_roles(["owner"]))])
async def export_report_csv(
    report_name: str,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    import json

    if report_name == "stock-valuation":
        resp = await stock_valuation(db=db, owner_id=owner_id)
        val = json.loads(resp.body)
        header = ["category", "value"]
        rows = [
            ["ingredient_value", val["ingredient_value"]],
            ["sf_value", val["sf_value"]],
            ["product_value", val["product_value"]],
            ["total_value", val["total_value"]],
            ["expiring_soon_value", val["expiring_soon_value"]],
            ["expired_value", val["expired_value"]],
            ["active_lot_value", val["by_status"].get("active", {}).get("value", 0)],
            ["quarantined_lot_value", val["by_status"].get("quarantined", {}).get("value", 0)],
            ["recalled_lot_value", val["by_status"].get("recalled", {}).get("value", 0)],
            ["expired_lot_value", val["by_status"].get("expired", {}).get("value", 0)],
        ]
        return _to_csv_response(rows, header, report_name)

    elif report_name == "production-margin":
        resp = await production_margin_report(db=db, owner_id=owner_id)
        raw = json.loads(resp.body)
        header = ["batch_id", "product_name", "quantity", "stage", "cost_per_unit",
                   "selling_price", "margin_per_unit", "total_margin", "margin_pct", "completed_at"]
        rows = [
            [r["batch_id"], r["product_name"], r["quantity"], r["stage"],
             r["cost_per_unit"], r["selling_price"], r["margin_per_unit"],
             r["total_batch_margin"], r["margin_pct"], r["completed_at"]]
            for r in raw["batches"]
        ]
        return _to_csv_response(rows, header, report_name)

    elif report_name == "supplier-ledger":
        resp = await supplier_ledger(db=db, owner_id=owner_id)
        raw = json.loads(resp.body)
        header = ["supplier_name", "ice", "total_po", "open_po", "open_count",
                   "received_count", "total_expense", "pending_expense", "total_engagement"]
        rows = [
            [r["supplier_name"], r["ice"] or "", r["total_po_value"], r["open_po_value"],
             r["open_po_count"], r["received_po_count"], r["total_expense_value"],
             r["pending_expense_value"], r["total_engagement"]]
            for r in raw["suppliers"]
        ]
        return _to_csv_response(rows, header, report_name)

    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown report '{report_name}'. Use: stock-valuation, production-margin, supplier-ledger",
        )