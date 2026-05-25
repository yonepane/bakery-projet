"""Analytics, alerts, and forecasting routes for BakeryOS.

Performance notes (cloud DB):
- All routes now fetch data in as few queries as possible.
- Products always use joinedload so recipe_items + ingredients arrive in one
  round-trip, not N round-trips.
- The forecast route fetches all relevant transactions at once and then groups
  them in Python, avoiding a query inside every nested loop.
"""

import os
import time
from datetime import datetime, timedelta
from collections import defaultdict

import sqlalchemy.orm
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import joinedload

try:
    from .. import models
    from ..auth import get_effective_owner_id, requires_roles
    from ..database import get_db
    from ..services.core import calculate_product_cost, get_user_settings
except ImportError:
    import models
    from auth import get_effective_owner_id, requires_roles
    from database import get_db
    from services.core import calculate_product_cost, get_user_settings

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR = os.path.join(BASE_DIR, "data")

# ---------------------------------------------------------------------------
# Simple in-process TTL cache for expensive aggregation endpoints.
# Each entry: owner_id -> (timestamp, result_dict)
# TTL = 300 seconds (5 minutes). Cache is per serverless instance lifetime.
# ---------------------------------------------------------------------------
_CACHE_TTL = 300  # seconds
_analytics_cache: dict[int, tuple[float, dict]] = {}
_profit_cache: dict[int, tuple[float, list]] = {}


# get_user_settings is imported from services.core — see import block above.


def _load_products_with_recipes(db: sqlalchemy.orm.Session, owner_id: int):
    """Fetch all products with their recipe items and ingredients in one query."""
    return (
        db.query(models.Product)
        .options(
            joinedload(models.Product.recipe_items).joinedload(models.RecipeItem.ingredient)
        )
        .filter(models.Product.owner_id == owner_id)
        .all()
    )


@router.get("/api/analytics", dependencies=[Depends(requires_roles(["owner"]))])
async def analytics(
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    # Serve from in-process cache if fresh enough (saves a full DB scan).
    cached = _analytics_cache.get(owner_id)
    if cached and (time.time() - cached[0]) < _CACHE_TTL:
        return JSONResponse(content=cached[1], headers={"Cache-Control": "private, max-age=300"})

    # --- single bulk fetch for all three tables ---
    transactions = (
        db.query(models.Transaction)
        .filter(models.Transaction.owner_id == owner_id)
        .all()
    )
    waste_records = (
        db.query(models.WasteRecord)
        .filter(models.WasteRecord.owner_id == owner_id)
        .all()
    )
    settings_data = get_user_settings(db, owner_id)

    reset_setting = (
        db.query(models.SystemSetting)
        .filter(
            models.SystemSetting.key == "last_reset_at",
            models.SystemSetting.owner_id == owner_id,
        )
        .first()
    )

    if reset_setting:
        last_reset = datetime.fromisoformat(reset_setting.value)
    else:
        now = datetime.now()
        last_reset = datetime(now.year, now.month, now.day)

    total_revenue = sum(t.total_revenue for t in transactions if t.type == "sale")
    total_cost = sum(t.total_cost for t in transactions) + sum(
        w.loss_cost for w in waste_records
    )

    session_txs = [t for t in transactions if t.timestamp >= last_reset]
    session_waste = [w for w in waste_records if w.date >= last_reset]

    today_revenue = sum(t.total_revenue for t in session_txs if t.type == "sale")
    today_cost = sum(t.total_cost for t in session_txs) + sum(
        w.loss_cost for w in session_waste
    )

    # Build daily chart data entirely in Python — no extra DB calls.
    # Use utcnow() consistently so the day boundaries match the UTC timestamps
    # stored by pos.py (which also uses utcnow). Mixing now() and utcnow() would
    # shift chart bars by the server's UTC offset.
    daily_data = []
    now = datetime.utcnow()
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

    product_stats: dict[str, int] = {}
    for tx in [t for t in transactions if t.type == "sale"]:
        if tx.items:
            for item in tx.items:
                name = item.get("name", "Unknown")
                qty = item.get("qty", 0)
                product_stats[name] = product_stats.get(name, 0) + qty

    top_products = [
        {"name": name, "value": qty}
        for name, qty in sorted(
            product_stats.items(), key=lambda item: item[1], reverse=True
        )[:5]
    ]

    # One query for all products + recipes (joinedload = no N+1).
    products = _load_products_with_recipes(db, owner_id)
    total_portfolio_cost = sum(calculate_product_cost(p) for p in products)
    margins = []
    for product in products:
        cost = calculate_product_cost(product)
        if product.price > 0:
            margins.append((product.price - cost) / product.price * 100)
    avg_margin = sum(margins) / len(margins) if margins else 0

    result = {
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
    _analytics_cache[owner_id] = (time.time(), result)
    return JSONResponse(content=result, headers={"Cache-Control": "private, max-age=300"})


@router.get("/api/alerts", dependencies=[Depends(requires_roles(["owner"]))])
async def get_alerts(
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    # Bulk-fetch ingredients and products (+recipes) in two queries.
    ingredients = (
        db.query(models.Ingredient)
        .filter(models.Ingredient.owner_id == owner_id)
        .all()
    )
    products = _load_products_with_recipes(db, owner_id)
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
    # NOTE: This endpoint is now rarely called — the frontend derives the same
    # data client-side from the /inventory response via calcProfitReport().
    # It is kept as a server-side fallback for external API consumers.
    cached = _profit_cache.get(owner_id)
    if cached and (time.time() - cached[0]) < _CACHE_TTL:
        return JSONResponse(content=cached[1], headers={"Cache-Control": "private, max-age=300"})

    # One query with joined recipes.
    products = _load_products_with_recipes(db, owner_id)
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
                "margin_percentage": (
                    f"{round((profit / product.price * 100), 2)}%"
                    if product.price > 0
                    else "0%"
                ),
            }
        )
    _profit_cache[owner_id] = (time.time(), report)
    return JSONResponse(content=report, headers={"Cache-Control": "private, max-age=300"})


@router.post("/api/simulate_price", dependencies=[Depends(requires_roles(["owner"]))])
async def simulate_price(
    materials_update: dict[str, float],
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    # One query with joined recipes.
    products = _load_products_with_recipes(db, owner_id)
    impact = []

    for product in products:
        old_cost = calculate_product_cost(product)
        new_cost = 0.0
        for item in product.recipe_items:
            if not item.ingredient:
                continue
            factor = 1000.0 if item.ingredient.unit in ["kg", "L", "l"] else 1.0
            price = materials_update.get(item.ingredient.name, item.ingredient.price)
            new_cost += (item.quantity / factor) * price

        impact.append(
            {
                "name": product.name,
                "old_cost": round(old_cost, 2),
                "new_cost": round(new_cost, 2),
                "old_profit": round(product.price - old_cost, 2),
                "new_profit": round(product.price - new_cost, 2),
                "margin_impact": round(
                    ((product.price - new_cost) / product.price * 100)
                    if product.price > 0
                    else 0,
                    2,
                ),
                "profit_delta": round(
                    (product.price - new_cost) - (product.price - old_cost), 2
                ),
            }
        )
    return impact


@router.get("/api/forecast", dependencies=[Depends(requires_roles(["owner"]))])
async def get_forecast(
    target_date: str,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    try:
        target_dt = datetime.strptime(target_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    # Pre-compute the four history dates we need.
    history_dates = [target_dt - timedelta(weeks=i) for i in range(1, 5)]
    # Build a date window that covers all history dates in one query.
    window_start = min(
        datetime(d.year, d.month, d.day) for d in history_dates
    )
    window_end = max(
        datetime(d.year, d.month, d.day) + timedelta(days=1) for d in history_dates
    )

    # ONE bulk query instead of N products × 4 weeks individual queries.
    all_txs = (
        db.query(models.Transaction)
        .filter(
            models.Transaction.owner_id == owner_id,
            models.Transaction.type == "sale",
            models.Transaction.timestamp >= window_start,
            models.Transaction.timestamp < window_end,
        )
        .all()
    )

    # Build a lookup: product_id -> {date_key -> qty_sold}
    # date_key = the start-of-day datetime for each history date.
    day_starts = {
        datetime(d.year, d.month, d.day): datetime(d.year, d.month, d.day)
        for d in history_dates
    }
    sales_by_product: dict[str, dict[datetime, int]] = defaultdict(lambda: defaultdict(int))

    for tx in all_txs:
        tx_day = datetime(tx.timestamp.year, tx.timestamp.month, tx.timestamp.day)
        if tx_day not in day_starts:
            continue  # outside our history window
        if tx.items:
            for item in tx.items:
                pid = item.get("id")
                if pid is not None:
                    sales_by_product[pid][tx_day] += item.get("qty", 0)

    products = _load_products_with_recipes(db, owner_id)
    suggestions = []
    for product in products:
        total = sum(
            sales_by_product[product.id].get(datetime(d.year, d.month, d.day), 0)
            for d in history_dates
        )
        avg_sales = total / len(history_dates)
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
