"""Analytics, alerts, and forecasting routes for BakeryOS."""

import os
from datetime import datetime, timedelta

import sqlalchemy.orm
from fastapi import APIRouter, Depends, HTTPException

try:
    from .. import models
    from ..auth import get_effective_owner_id, requires_roles
    from ..database import get_db
    from ..services.core import calculate_product_cost
except ImportError:
    import models
    from auth import get_effective_owner_id, requires_roles
    from database import get_db
    from services.core import calculate_product_cost

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR = os.path.join(BASE_DIR, "data")


def get_user_settings(db: sqlalchemy.orm.Session, owner_id: int) -> dict:
    settings_records = db.query(models.SystemSetting).filter(models.SystemSetting.owner_id == owner_id).all()
    if not settings_records:
        return {"currency": "MAD", "tax_rate": 0.2, "bakery_name": "BakeryOS"}
    return {s.key: s.value for s in settings_records}


@router.get("/api/analytics", dependencies=[Depends(requires_roles(["owner"]))])
async def analytics(
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    transactions = db.query(models.Transaction).filter(models.Transaction.owner_id == owner_id).all()
    waste_records = db.query(models.WasteRecord).filter(models.WasteRecord.owner_id == owner_id).all()
    settings_data = get_user_settings(db, owner_id)

    reset_setting = db.query(models.SystemSetting).filter(
        models.SystemSetting.key == "last_reset_at",
        models.SystemSetting.owner_id == owner_id,
    ).first()

    if reset_setting:
        last_reset = datetime.fromisoformat(reset_setting.value)
    else:
        now = datetime.now()
        last_reset = datetime(now.year, now.month, now.day)

    total_revenue = sum(t.total_revenue for t in transactions if t.type == "sale")
    total_cost = sum(t.total_cost for t in transactions) + sum(w.loss_cost for w in waste_records)

    session_txs = [t for t in transactions if t.timestamp >= last_reset]
    session_waste = [w for w in waste_records if w.date >= last_reset]

    today_revenue = sum(t.total_revenue for t in session_txs if t.type == "sale")
    today_cost = sum(t.total_cost for t in session_txs) + sum(w.loss_cost for w in session_waste)

    daily_data = []
    now = datetime.now()
    for i in range(6, -1, -1):
        day = now - timedelta(days=i)
        s_day = datetime(day.year, day.month, day.day)
        e_day = s_day + timedelta(days=1)
        day_txs = [t for t in transactions if s_day <= t.timestamp < e_day]
        daily_data.append(
            {
                "name": day.strftime("%a"),
                "revenue": sum(t.total_revenue for t in day_txs if t.type == "sale"),
                "cost": sum(t.total_cost for t in day_txs),
            }
        )

    hourly_sales = [{"hour": f"{hour:02d}h", "value": 0} for hour in range(24)]
    for tx in [t for t in transactions if t.type == "sale"]:
        hourly_sales[tx.timestamp.hour]["value"] += tx.total_revenue

    product_stats = {}
    for tx in [t for t in transactions if t.type == "sale"]:
        if tx.items:
            for item in tx.items:
                name = item.get("name", "Unknown")
                qty = item.get("qty", 0)
                product_stats[name] = product_stats.get(name, 0) + qty

    top_products = [
        {"name": name, "value": qty}
        for name, qty in sorted(product_stats.items(), key=lambda item: item[1], reverse=True)[:5]
    ]

    products = db.query(models.Product).filter(models.Product.owner_id == owner_id).all()
    total_portfolio_cost = sum(calculate_product_cost(product) for product in products)
    margins = []
    for product in products:
        cost = calculate_product_cost(product)
        if product.price > 0:
            margins.append((product.price - cost) / product.price * 100)
    avg_margin = sum(margins) / len(margins) if margins else 0

    return {
        "revenue": round(total_revenue, 2),
        "cost": round(total_cost, 2),
        "today_revenue": round(today_revenue, 2),
        "today_cost": round(today_cost, 2),
        "currency": settings_data.get("currency", "MAD"),
        "chartData": daily_data,
        "hourlySales": hourly_sales,
        "topProducts": top_products,
        "intelligence": {
            "total_portfolio_cost": round(total_portfolio_cost, 2),
            "average_margin": f"{round(avg_margin, 2)}%",
            "products_count": len(product_stats),
        },
    }


@router.get("/api/alerts")
async def get_alerts(
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    ingredients = db.query(models.Ingredient).filter(models.Ingredient.owner_id == owner_id).all()
    products = db.query(models.Product).filter(models.Product.owner_id == owner_id).all()
    alerts = []

    for ing in ingredients:
        if ing.stock < ing.min_threshold:
            alerts.append(
                {
                    "type": "stock",
                    "severity": "high" if ing.stock < ing.min_threshold / 2 else "medium",
                    "message": f"Low stock: {ing.name} ({ing.stock}{ing.unit})",
                    "id": f"stock-{ing.name}",
                }
            )

    for product in products:
        cost = calculate_product_cost(product)
        margin = ((product.price - cost) / product.price * 100) if product.price > 0 else 0
        if margin < 65:
            alerts.append(
                {
                    "type": "margin",
                    "severity": "high",
                    "message": f"WARNING: Low margin on {product.name} ({round(margin, 1)}%)",
                    "id": f"margin-{product.id}",
                }
            )

    return alerts


@router.get("/api/intelligence/profit-report", dependencies=[Depends(requires_roles(["owner"]))])
async def profit_report(
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    products = db.query(models.Product).filter(models.Product.owner_id == owner_id).all()
    report = []
    for product in products:
        cost = calculate_product_cost(product)
        profit = product.price - cost
        roi = (profit / cost * 100) if cost > 0 else 0
        report.append(
            {
                "product_id": product.id,
                "product_name": product.name,
                "cost_price": round(cost, 2),
                "selling_price": round(product.price, 2),
                "net_profit": round(profit, 2),
                "roi_percentage": f"{round(roi, 2)}%",
                "margin_percentage": f"{round((profit / product.price * 100), 2) if product.price > 0 else 0}%",
            }
        )
    return report


@router.post("/api/simulate_price", dependencies=[Depends(requires_roles(["owner"]))])
async def simulate_price(
    materials_update: dict[str, float],
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    impact = []
    products = db.query(models.Product).filter(models.Product.owner_id == owner_id).all()

    for product in products:
        old_cost = calculate_product_cost(product)
        new_cost = 0
        for item in product.recipe_items:
            factor = 1000.0 if item.ingredient and item.ingredient.unit in ['kg', 'L', 'l'] else 1.0
            price = materials_update.get(
                item.ingredient.name if item.ingredient else "",
                item.ingredient.price if item.ingredient else 0,
            )
            new_cost += (item.quantity / factor) * price

        impact.append(
            {
                "name": product.name,
                "old_cost": round(old_cost, 2),
                "new_cost": round(new_cost, 2),
                "old_profit": round(product.price - old_cost, 2),
                "new_profit": round(product.price - new_cost, 2),
                "margin_impact": round(((product.price - new_cost) / product.price * 100) if product.price > 0 else 0, 2),
                "profit_delta": round((product.price - new_cost) - (product.price - old_cost), 2),
            }
        )
    return impact


@router.get("/api/forecast")
async def get_forecast(
    target_date: str,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    try:
        target_dt = datetime.strptime(target_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    suggestions = []
    products = db.query(models.Product).filter(models.Product.owner_id == owner_id).all()

    history_dates = [target_dt - timedelta(weeks=i) for i in range(1, 5)]

    for product in products:
        sales_data = []
        for h_date in history_dates:
            start = datetime(h_date.year, h_date.month, h_date.day)
            end = start + timedelta(days=1)
            txs = db.query(models.Transaction).filter(
                models.Transaction.owner_id == owner_id,
                models.Transaction.type == "sale",
                models.Transaction.timestamp >= start,
                models.Transaction.timestamp < end,
            ).all()
            day_qty = 0
            for tx in txs:
                if tx.items:
                    for item in tx.items:
                        if item.get("id") == product.id:
                            day_qty += item.get("qty", 0)
            sales_data.append(day_qty)

        avg_sales = sum(sales_data) / len(sales_data) if sales_data else 0
        suggested = int(avg_sales * 1.1) + 1 if avg_sales > 0 else 5
        suggestions.append(
            {
                "product_id": product.id,
                "product_name": product.name,
                "suggested_qty": suggested,
                "historical_avg": round(avg_sales, 1),
            }
        )

    return suggestions
