"""POS, production, receipts, and monthly report routes for BakeryOS.

These routes were previously scattered inside main.py. They now live here
so that main.py can stay focused on app setup and middleware.
"""

import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from jinja2 import Environment, FileSystemLoader, select_autoescape

import sqlalchemy.orm
from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import FileResponse, HTMLResponse, Response
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import joinedload

try:
    import models
    from auth import get_current_user, get_effective_owner_id, requires_roles
    from database import get_db
    from schemas import ProductionBatch, SaleRequest
    from services.core import calculate_product_cost, get_user_settings, get_recipe_item_cost
    from services.customers import award_loyalty_points, deduct_loyalty_points
    from services.stock import apply_stock_delta, find_movements_by_client_mutation
    from services.production import consume_recipe_ingredients
    from services.pdf import build_monthly_report_pdf, build_receipt_pdf
    from services.excel import build_monthly_report_excel
    from services.finance_summary import compute_financial_summary_for_period
    from ..routers.intelligence import _analytics_cache
except ImportError:
    import models
    from auth import get_current_user, get_effective_owner_id, requires_roles
    from database import get_db
    from schemas import ProductionBatch, SaleRequest
    from services.core import calculate_product_cost, get_user_settings, get_recipe_item_cost
    from services.customers import award_loyalty_points, deduct_loyalty_points
    from services.stock import apply_stock_delta, find_movements_by_client_mutation
    from services.production import consume_recipe_ingredients
    from services.pdf import build_monthly_report_pdf, build_receipt_pdf
    from services.excel import build_monthly_report_excel
    from services.finance_summary import compute_financial_summary_for_period
    try:

        from routers.intelligence import _analytics_cache
    except ImportError:
        _analytics_cache = {}

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR = os.path.join(BASE_DIR, "data")

# Jinja2 environment — auto-escaping on for HTML templates (prevents XSS).
_TEMPLATES_DIR = Path(__file__).parent.parent / "templates"
_jinja_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATES_DIR)),
    autoescape=select_autoescape(["html"]),
)


def _pdf_response(buffer, filename: str) -> Response:
    """Return a PDF file response."""
    return Response(
        content=buffer.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


def _excel_response(buffer, filename: str) -> Response:
    """Return an Excel file response."""
    return Response(
        content=buffer.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


def _build_whatsapp_receipt(tx: models.Transaction, currency: str) -> str:
    whatsapp_text = f"BAKERY OS: Receipt {tx.id}\n"
    for item in tx.items or []:
        whatsapp_text += f"- {item.get('name', 'Product')} x{item.get('qty', 1)}\n"
    whatsapp_text += f"\nTOTAL: {tx.total_revenue} {currency}\nMerci de votre visite! 🥐"
    return whatsapp_text


# ---------------------------------------------------------------------------
# Production
# ---------------------------------------------------------------------------

@router.post("/api/produce", dependencies=[Depends(requires_roles(["owner"]))])
async def produce(
    batch: ProductionBatch,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
    current_user: models.User = Depends(get_current_user),
    x_client_mutation_id: str | None = Header(default=None, alias="X-Client-Mutation-Id"),
):
    """Produce a batch: consume ingredients, add product stock, log transaction."""
    client_mutation_id = batch.client_mutation_id or x_client_mutation_id
    prior = find_movements_by_client_mutation(
        db,
        owner_id=owner_id,
        client_mutation_id=client_mutation_id,
        movement_type="production_output",
    )
    if prior:
        return {"success": True, "new_stock": prior[-1].after_qty, "idempotent": True}

    product = (
        db.query(models.Product)
        .options(
            joinedload(models.Product.recipe_items)
        )
        .filter(
            models.Product.id == batch.product_id,
            models.Product.owner_id == owner_id,
        )
        .first()
    )
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    tx_id = str(uuid.uuid4())[:12].upper()
    
    production_cost = consume_recipe_ingredients(
        db=db,
        owner_id=owner_id,
        recipe_items=product.recipe_items,
        batch_quantity=batch.quantity,
        movement_type_ingredient="production_input",
        movement_type_sf="semi_finished_input",
        source_type="transaction",
        source_id=tx_id,
        reason=f"Consumed for production {tx_id}",
        user_id=current_user.id,
        client_mutation_id=client_mutation_id,
        is_kitchen_bake=False,
    )

    kitchen = db.query(models.StockLocation).filter(
        models.StockLocation.owner_id == owner_id,
        models.StockLocation.type == "kitchen",
        models.StockLocation.is_active == True,
    ).first()

    out_lot = None
    if kitchen:
        out_lot = models.StockLot(
            owner_id=owner_id,
            item_type="product",
            item_id=str(product.id),
            item_name_snapshot=product.name,
            lot_code=f"BATCH-{tx_id}",
            unit_snapshot="unit",
            status="active",
            source_type="transaction",
            source_id=tx_id,
            produced_at=datetime.now(timezone.utc),
        )
        db.add(out_lot)
        db.flush()

    output_movement = apply_stock_delta(
        db,
        owner_id=owner_id,
        item_type="product",
        item=product,
        quantity_delta=batch.quantity,
        movement_type="production_output",
        source_type="transaction",
        source_id=tx_id,
        reason=f"Produced batch {tx_id}",
        created_by_user_id=current_user.id,
        client_mutation_id=client_mutation_id,
        location_id=kitchen.id if kitchen else None,
        lot_id=out_lot.id if out_lot else None,
    )

    transaction = models.Transaction(
        id=tx_id,
        owner_id=owner_id,
        timestamp=datetime.now(timezone.utc),
        type="production",
        total_revenue=0,
        total_cost=production_cost,
        items=[{"name": product.name, "qty": batch.quantity}],
    )
    db.add(transaction)
    db.commit()

    return {"success": True, "new_stock": output_movement.after_qty}


# ---------------------------------------------------------------------------
# POS — complete a sale
# ---------------------------------------------------------------------------

@router.post("/api/complete")
async def complete_sale(
    req: SaleRequest,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
    current_user: models.User = Depends(get_current_user),
    x_client_mutation_id: str | None = Header(default=None, alias="X-Client-Mutation-Id"),
):
    """Process a sale: deduct stock, create a transaction, return receipt text."""
    total_revenue = 0
    total_cost = 0
    items_snapshot = []
    settings = get_user_settings(db, owner_id)
    client_mutation_id = req.client_mutation_id or x_client_mutation_id
    prior = find_movements_by_client_mutation(
        db,
        owner_id=owner_id,
        client_mutation_id=client_mutation_id,
        movement_type="sale",
    )
    if prior:
        tx = db.query(models.Transaction).filter(
            models.Transaction.id == prior[0].source_id,
            models.Transaction.owner_id == owner_id,
        ).first()
        if tx:
            return {
                "success": True,
                "transaction_id": tx.id,
                "whatsapp_text": _build_whatsapp_receipt(tx, settings.get("currency", "MAD")),
                "idempotent": True,
            }

    # Bulk-fetch all cart products in ONE query instead of one per item.
    cart_ids = [item.id for item in req.cart]
    products_map = {
        p.id: p
        for p in (
            db.query(models.Product)
            .options(
                joinedload(models.Product.recipe_items).joinedload(models.RecipeItem.ingredient)
            )
            .filter(
                models.Product.id.in_(cart_ids),
                models.Product.owner_id == owner_id,
            )
            .all()
        )
    }

    sale_lines = []
    for item in req.cart:
        product = products_map.get(item.id)
        if not product:
            continue

        if product.stock < item.qty:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for {product.name}")

        cost = calculate_product_cost(product)

        total_revenue += product.price * item.qty
        total_cost += cost * item.qty
        items_snapshot.append({
            "id": product.id,
            "name": product.name,
            "qty": item.qty,
            "price": product.price,
            "cost": cost,
        })
        sale_lines.append((product, item.qty))

    tx_id = str(uuid.uuid4())[:12].upper()
    for product, qty in sale_lines:
        apply_stock_delta(
            db,
            owner_id=owner_id,
            item_type="product",
            item=product,
            quantity_delta=-qty,
            movement_type="sale",
            source_type="transaction",
            source_id=tx_id,
            reason=f"Sold in transaction {tx_id}",
            created_by_user_id=current_user.id,
            client_mutation_id=client_mutation_id,
        )

    transaction = models.Transaction(
        id=tx_id,
        owner_id=owner_id,
        timestamp=datetime.now(timezone.utc),
        type="sale",
        total_revenue=total_revenue,
        total_cost=total_cost,
        items=items_snapshot,
        customer_id=req.customer_id if req.customer_id and req.customer_id.strip() else None,
    )
    db.add(transaction)
    
    # Award loyalty points (1 point per 1 unit of currency spent)
    if req.customer_id:
        award_loyalty_points(db, owner_id, req.customer_id, int(total_revenue))

    db.commit()

    # Invalidate analytics cache so dashboard reflects new sale immediately.
    _analytics_cache.pop(owner_id, None)

    # Build a WhatsApp-friendly text receipt the frontend can share directly.
    currency = settings.get("currency", "MAD")
    whatsapp_text = _build_whatsapp_receipt(transaction, currency)

    return {"success": True, "transaction_id": tx_id, "whatsapp_text": whatsapp_text}


# ---------------------------------------------------------------------------
# Refund / Cancel a sale
# ---------------------------------------------------------------------------

@router.post("/api/transactions/{id}/refund")
async def refund_transaction(
    id: str,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
    current_user: models.User = Depends(get_current_user),
    x_client_mutation_id: str | None = Header(default=None, alias="X-Client-Mutation-Id"),
):
    """Cancel a completed sale: restore product stock and mark it refunded."""
    tx = db.query(models.Transaction).filter(
        models.Transaction.id == id,
        models.Transaction.owner_id == owner_id,
    ).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if tx.type != "sale":
        raise HTTPException(status_code=400, detail="Only sales can be refunded")
    prior = find_movements_by_client_mutation(
        db,
        owner_id=owner_id,
        client_mutation_id=x_client_mutation_id,
        movement_type="refund",
    )
    if prior and getattr(tx, "status", "completed") == "refunded":
        return {"success": True, "refunded_id": id, "idempotent": True}
    if getattr(tx, "status", "completed") == "refunded":
        raise HTTPException(status_code=400, detail="Transaction already refunded")

    # Restore stock for each item in the original sale snapshot.
    if tx.items:
        product_ids = [item["id"] for item in tx.items if "id" in item]
        products_map = {
            p.id: p
            for p in db.query(models.Product).filter(
                models.Product.id.in_(product_ids),
                models.Product.owner_id == owner_id,
            ).all()
        }
        for item in tx.items:
            product = products_map.get(item.get("id"))
            if product:
                qty = item.get("qty", 0)
                apply_stock_delta(
                    db,
                    owner_id=owner_id,
                    item_type="product",
                    item=product,
                    quantity_delta=qty,
                    movement_type="refund",
                    source_type="transaction",
                    source_id=tx.id,
                    reason=f"Refunded transaction {tx.id}",
                    created_by_user_id=current_user.id,
                    client_mutation_id=x_client_mutation_id,
                )

    # Deduct loyalty points that were awarded at time of sale.
    if tx.customer_id:
        deduct_loyalty_points(db, owner_id, tx.customer_id, int(tx.total_revenue))

    # Mark refunded — keep the record for audit purposes.
    tx.status = "refunded"

    # Invalidate analytics cache so dashboard reflects the refund immediately.
    _analytics_cache.pop(owner_id, None)

    db.commit()
    return {"success": True, "refunded_id": id}


# ---------------------------------------------------------------------------
# Delete a transaction
# ---------------------------------------------------------------------------

@router.delete("/api/transactions/{id}")
async def delete_transaction(
    id: str,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    """Permanently delete a refunded transaction from history."""
    tx = db.query(models.Transaction).filter(
        models.Transaction.id == id,
        models.Transaction.owner_id == owner_id,
    ).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    if getattr(tx, "status", "completed") != "refunded":
        raise HTTPException(status_code=400, detail="Only refunded transactions can be deleted")

    try:
        db.delete(tx)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="This transaction is still linked to another record and could not be deleted.",
        )
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Could not delete this transaction. Please try again.",
        )

    return {"success": True}

# ---------------------------------------------------------------------------
# Receipt
# ---------------------------------------------------------------------------

@router.get("/api/transactions/{id}/receipt")
async def get_receipt(
    id: str,
    format: str = "pdf",
    paper: str = "80mm",
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    """Return a receipt for a transaction as PDF or printable HTML."""
    tx = db.query(models.Transaction).filter(
        models.Transaction.id == id,
        models.Transaction.owner_id == owner_id,
    ).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    settings = get_user_settings(db, owner_id)
    currency = settings.get("currency", "MAD")
    # Use the tenant's bakery name so every receipt is personalised.
    bakery_name = settings.get("bakery_name", "BakeryOS")
    normalized_paper = "58mm" if paper.lower() == "58mm" else "80mm"

    if format.lower() == "pdf":
        return _pdf_response(
            build_receipt_pdf(tx, currency, normalized_paper, bakery_name),
            f"receipt-{tx.id}.pdf",
        )

    # HTML fallback for browser-based printing.
    items_data = [
        {
            "name": item.get("name", "Product"),
            "qty": item.get("qty", 1),
            "price": item.get("price", 0.0),
        }
        for item in (tx.items or [])
    ]
    template = _jinja_env.get_template("receipt.html")
    html_content = template.render(
        tx_id=tx.id,
        bakery_name=bakery_name,
        timestamp=tx.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
        items=items_data,
        total=tx.total_revenue,
        currency=currency,
        paper=normalized_paper,
        receipt_footer=settings.get("receipt_footer", ""),
    )
    return HTMLResponse(content=html_content)


# ---------------------------------------------------------------------------
# Monthly financial report
# ---------------------------------------------------------------------------

@router.get("/api/reports/monthly")
async def get_monthly_report(
    month: int,
    year: int,
    format: str = "pdf",
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    """Return a month-end financial summary as PDF or printable HTML."""
    start_date = datetime(year, month, 1)
    end_date = datetime(year + 1, 1, 1) if month == 12 else datetime(year, month + 1, 1)
    summary = compute_financial_summary_for_period(db, owner_id, start_date, end_date)

    transactions = summary["transactions"]
    waste_records = summary["waste_records"]
    expenses = summary["expenses"]
    total_revenue = summary["total_revenue"]
    total_cogs = summary["total_cogs"]
    total_waste = summary["total_waste"]
    total_overhead = summary["total_overhead"]
    net_profit = summary["net_profit"]
    margin = summary["margin"]

    settings = get_user_settings(db, owner_id)
    currency = settings.get("currency", "MAD")

    if format.lower() == "pdf":
        return _pdf_response(
            build_monthly_report_pdf(
                start_date=start_date,
                transactions=transactions,
                expenses=expenses,
                waste_records=waste_records,
                total_revenue=total_revenue,
                total_cogs=total_cogs,
                total_waste=total_waste,
                total_overhead=total_overhead,
                net_profit=net_profit,
                margin=margin,
                currency=currency,
            ),
            f"monthly-report-{year:04d}-{month:02d}.pdf",
        )

    if format.lower() == "excel":
        return _excel_response(
            build_monthly_report_excel(
                start_date=start_date,
                transactions=transactions,
                expenses=expenses,
                waste_records=waste_records,
                total_revenue=total_revenue,
                total_cogs=total_cogs,
                total_waste=total_waste,
                total_overhead=total_overhead,
                net_profit=net_profit,
                margin=margin,
                currency=currency,
            ),
            f"monthly-report-{year:04d}-{month:02d}.xlsx",
        )

    # HTML fallback for browser-based printing.
    template = _jinja_env.get_template("monthly_report.html")
    html_content = template.render(
        period=start_date.strftime("%B %Y"),
        currency=currency,
        total_revenue=total_revenue,
        net_profit=net_profit,
        total_cogs=total_cogs,
        total_waste=total_waste,
        total_overhead=total_overhead,
        margin=margin,
        sale_count=len([t for t in transactions if t.type == "sale"]),
        expense_count=len(expenses),
        waste_count=len(waste_records),
        generated_at=datetime.now().strftime("%Y-%m-%d %H:%M"),
    )
    return HTMLResponse(content=html_content)
