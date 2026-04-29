"""POS, production, receipts, and monthly report routes for BakeryOS.

These routes were previously scattered inside main.py. They now live here
so that main.py can stay focused on app setup and middleware.
"""

import os
import uuid
from datetime import datetime
from typing import Optional

import sqlalchemy.orm
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, HTMLResponse, Response

try:
    from .. import models
    from ..auth import get_current_user, get_effective_owner_id, requires_roles
    from ..database import get_db
    from ..schemas import ProductionBatch, SaleRequest
    from ..services.core import calculate_product_cost, get_settings
    from ..services.pdf import build_monthly_report_pdf, build_receipt_pdf
except ImportError:
    import models
    from auth import get_current_user, get_effective_owner_id, requires_roles
    from database import get_db
    from schemas import ProductionBatch, SaleRequest
    from services.core import calculate_product_cost, get_settings
    from services.pdf import build_monthly_report_pdf, build_receipt_pdf

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR = os.path.join(BASE_DIR, "data")


def _load_settings() -> dict:
    return get_settings(DATA_DIR)


def _pdf_response(buffer, filename: str) -> Response:
    """Return a PDF file response."""
    return Response(
        content=buffer.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# Production
# ---------------------------------------------------------------------------

@router.post("/api/produce", dependencies=[Depends(requires_roles(["owner"]))])
async def produce(
    batch: ProductionBatch,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    """Produce a batch: consume ingredients, add product stock, log transaction."""
    product = db.query(models.Product).filter(
        models.Product.id == batch.product_id,
        models.Product.owner_id == owner_id,
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    production_cost = 0
    for item in product.recipe_items:
        ing = db.query(models.Ingredient).filter(
            models.Ingredient.id == item.ingredient_id,
            models.Ingredient.owner_id == owner_id,
        ).first()
        required = item.quantity * batch.quantity
        if not ing or ing.stock < required:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient {item.ingredient.name if item.ingredient else 'Ingredient'}",
            )
        ing.stock -= required
        production_cost += required * ing.price

    product.stock += batch.quantity

    # Record the production event in transaction history.
    tx_id = str(uuid.uuid4())[:12].upper()
    transaction = models.Transaction(
        id=tx_id,
        owner_id=owner_id,
        timestamp=datetime.utcnow(),
        type="production",
        total_revenue=0,
        total_cost=production_cost,
        items=[{"name": product.name, "qty": batch.quantity}],
    )
    db.add(transaction)
    db.commit()

    return {"success": True, "new_stock": product.stock}


# ---------------------------------------------------------------------------
# POS — complete a sale
# ---------------------------------------------------------------------------

@router.post("/api/complete")
async def complete_sale(
    req: SaleRequest,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    """Process a sale: deduct stock, create a transaction, return receipt text."""
    total_revenue = 0
    total_cost = 0
    items_snapshot = []
    settings = _load_settings()

    for item in req.cart:
        product = db.query(models.Product).filter(
            models.Product.id == item.id,
            models.Product.owner_id == owner_id,
        ).first()
        if not product:
            continue

        if product.stock < item.qty:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for {product.name}")

        product.stock -= item.qty
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

    tx_id = str(uuid.uuid4())[:12].upper()
    transaction = models.Transaction(
        id=tx_id,
        owner_id=owner_id,
        timestamp=datetime.utcnow(),
        type="sale",
        total_revenue=total_revenue,
        total_cost=total_cost,
        items=items_snapshot,
    )
    db.add(transaction)
    db.commit()

    # Build a WhatsApp-friendly text receipt the frontend can share directly.
    currency = settings.get("currency", "MAD")
    whatsapp_text = f"BAKERY OS: Receipt {tx_id}\n"
    for item in items_snapshot:
        whatsapp_text += f"- {item['name']} x{item['qty']}\n"
    whatsapp_text += f"\nTOTAL: {total_revenue} {currency}\nMerci de votre visite! 🥐"

    return {"success": True, "transaction_id": tx_id, "whatsapp_text": whatsapp_text}


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

    settings = _load_settings()
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
    html_content = f"""
    <html>
    <head>
        <title>Receipt - {tx.id}</title>
        <style>
            body {{ font-family: 'Courier New', Courier, monospace; width: 80mm; margin: 0 auto; padding: 4mm; border: 1px solid #eee; background: white; color: black; }}
            .center {{ text-align: center; }}
            .header {{ font-weight: bold; font-size: 20px; margin-bottom: 5px; }}
            .separator {{ border-bottom: 1px dashed #000; margin: 10px 0; }}
            .item {{ display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 14px; }}
            .total {{ font-weight: bold; display: flex; justify-content: space-between; margin-top: 10px; font-size: 16px; }}
            .footer {{ font-size: 12px; margin-top: 20px; color: #666; }}
            @media print {{
                @page {{ size: {normalized_paper} auto; margin: 0; }}
                body {{ border: none; padding: 0; width: {normalized_paper}; }}
                .no-print {{ display: none; }}
            }}
            .print-btn {{ background: #000; color: #fff; border: none; padding: 10px 20px; cursor: pointer; border-radius: 5px; margin-bottom: 20px; width: 100%; }}
        </style>
    </head>
    <body>
        <div class="no-print">
            <button class="print-btn" onclick="window.print()">PRINT RECEIPT</button>
        </div>
        <div class="center">
            <div class="header">BAKERY OS</div>
            <div>{bakery_name}</div>
            <div class="separator"></div>
            <div>ID: {tx.id}</div>
            <div>{tx.timestamp.strftime('%Y-%m-%d %H:%M:%S')}</div>
            <div class="separator"></div>
        </div>
        <div class="items">
    """

    if tx.items:
        for item in tx.items:
            html_content += f"""
            <div class="item">
                <span>{item.get('name', 'Product')} x{item.get('qty', 1)}</span>
                <span>{round(item.get('price', 0) * item.get('qty', 1), 2)} {currency}</span>
            </div>
            """

    html_content += f"""
        </div>
        <div class="separator"></div>
        <div class="total">
            <span>TOTAL</span>
            <span>{round(tx.total_revenue, 2)} {currency}</span>
        </div>
        <div class="separator"></div>
        <div class="center footer">
            THANK YOU FOR YOUR VISIT!<br>
            Merci de votre visite!<br>
            www.bakeryos.app
        </div>
    </body>
    </html>
    """

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

    transactions = db.query(models.Transaction).filter(
        models.Transaction.owner_id == owner_id,
        models.Transaction.timestamp >= start_date,
        models.Transaction.timestamp < end_date,
    ).all()

    waste_records = db.query(models.WasteRecord).filter(
        models.WasteRecord.owner_id == owner_id,
        models.WasteRecord.date >= start_date,
        models.WasteRecord.date < end_date,
    ).all()

    expenses = db.query(models.Expense).filter(
        models.Expense.owner_id == owner_id,
        models.Expense.date >= start_date,
        models.Expense.date < end_date,
    ).all()

    total_revenue = sum(t.total_revenue for t in transactions if t.type == "sale")
    total_cogs = sum(t.total_cost for t in transactions if t.type == "sale")
    total_waste = sum(w.loss_cost for w in waste_records)
    total_overhead = sum(e.amount for e in expenses)

    net_profit = total_revenue - total_cogs - total_waste - total_overhead
    margin = (net_profit / total_revenue * 100) if total_revenue > 0 else 0

    settings = _load_settings()
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

    # HTML fallback for browser-based printing.
    html_content = f"""
    <html>
    <head>
        <title>Monthly Report - {start_date.strftime('%B %Y')}</title>
        <style>
            body {{ font-family: 'Inter', sans-serif; padding: 40px; color: #1a1a1b; line-height: 1.6; max-width: 800px; margin: 0 auto; }}
            .header {{ display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f0f0f1; padding-bottom: 20px; margin-bottom: 40px; }}
            .logo {{ font-size: 24px; font-weight: 800; letter-spacing: -1px; }}
            .logo span {{ color: #d4af37; }}
            .report-title {{ font-size: 32px; font-weight: 800; margin: 0; }}
            .card {{ background: #f8f9fa; padding: 25px; border-radius: 15px; border: 1px solid #eee; }}
            .card-label {{ font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; color: #888; margin-bottom: 5px; }}
            .card-value {{ font-size: 24px; font-weight: 800; margin: 0; }}
            .positive {{ color: #10b981; }}
            .negative {{ color: #f43f5e; }}
            table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
            th {{ text-align: left; font-size: 10px; text-transform: uppercase; color: #888; padding: 10px; border-bottom: 1px solid #eee; }}
            td {{ padding: 15px 10px; border-bottom: 1px solid #f8f9fa; font-size: 14px; font-weight: 600; }}
            .no-print {{ margin-bottom: 20px; }}
            .btn {{ background: #000; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold; }}
            @media print {{ .no-print {{ display: none; }} body {{ padding: 0; }} }}
        </style>
    </head>
    <body>
        <div class="no-print">
            <a href="#" class="btn" onclick="window.print()">Download as PDF</a>
        </div>
        <div class="header">
            <div class="logo">Bakery<span>OS</span></div>
            <div style="text-align: right;">
                <p style="margin: 0; font-weight: bold;">Executive Financial Summary</p>
                <p style="margin: 0; color: #888; font-size: 12px;">Period: {start_date.strftime('%B %Y')}</p>
            </div>
        </div>

        <h1 class="report-title">Financial Performance</h1>
        <p style="color: #888; margin-bottom: 40px;">This report summarizes the operational efficiency and net profitability for the selected period.</p>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px;">
            <div class="card">
                <p class="card-label">Total Revenue</p>
                <p class="card-value">{total_revenue:,.2f} {currency}</p>
            </div>
            <div class="card">
                <p class="card-label">Net Profit</p>
                <p class="card-value {'positive' if net_profit > 0 else 'negative'}">{net_profit:,.2f} {currency}</p>
            </div>
            <div class="card">
                <p class="card-label">Cost of Goods</p>
                <p class="card-value">{total_cogs:,.2f} {currency}</p>
            </div>
            <div class="card">
                <p class="card-label">Waste Loss</p>
                <p class="card-value" style="color: #f43f5e;">{total_waste:,.2f} {currency}</p>
            </div>
            <div class="card">
                <p class="card-label">Fixed Overhead</p>
                <p class="card-value" style="color: #f43f5e;">{total_overhead:,.2f} {currency}</p>
            </div>
        </div>

        <div class="card" style="margin-bottom: 40px; background: #000; color: #fff; border: none;">
            <p class="card-label" style="color: #aaa;">Operating Margin</p>
            <p class="card-value" style="color: #d4af37;">{margin:.1f}%</p>
        </div>

        <h3>Revenue Breakdown</h3>
        <table>
            <thead>
                <tr><th>Category</th><th>Transactions</th><th>Amount</th></tr>
            </thead>
            <tbody>
                <tr><td>Direct Sales</td><td>{len([t for t in transactions if t.type == 'sale'])}</td><td>{total_revenue:,.2f} {currency}</td></tr>
                <tr><td>Fixed Expenses</td><td>{len(expenses)}</td><td style="color: #f43f5e;">-{total_overhead:,.2f} {currency}</td></tr>
                <tr><td>Waste Deductions</td><td>{len(waste_records)}</td><td style="color: #f43f5e;">-{total_waste:,.2f} {currency}</td></tr>
            </tbody>
        </table>

        <div style="margin-top: 100px; text-align: center; font-size: 10px; color: #ccc; text-transform: uppercase; letter-spacing: 2px;">
            Generated by BakeryOS Intel-Engine | {datetime.now().strftime('%Y-%m-%d %H:%M')}
        </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)
