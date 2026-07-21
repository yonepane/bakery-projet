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
from datetime import datetime, timedelta, timezone
from collections import defaultdict

import sqlalchemy.orm
from fastapi import HTTPException
from sqlalchemy.orm import joinedload

try:
    import models
    from auth import get_effective_owner_id, requires_roles
    from database import get_db
    from services.core import calculate_product_cost, get_user_settings
    from services.finance_summary import compute_financial_summary_for_period
except ImportError:
    import models
    from auth import get_effective_owner_id, requires_roles
    from database import get_db
    from services.core import calculate_product_cost, get_user_settings
    from services.finance_summary import compute_financial_summary_for_period

import json


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


def get_analytics_dashboard(
    db: sqlalchemy.orm.Session,
    owner_id: int,
):
    # Serve from in-process cache if fresh enough (saves a full DB scan).
    cached = _analytics_cache.get(owner_id)
    if cached and (time.time() - cached[0]) < _CACHE_TTL:
        return cached[1]

    # Get transactions older than 30 days ago up to now?
    # Original logic just grabbed ALL transactions for the whole dashboard...
    # But let's keep all transactions since original logic fetched all.
    # Wait, original fetched ALL transactions without date limit.
    # We can pass an arbitrary old date like 2000-01-01 to now for the summary,
    # or just replicate active_transactions since `compute_financial_summary_for_period` applies a date filter.
    
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

    summary = compute_financial_summary_for_period(db, owner_id, datetime.min.replace(tzinfo=timezone.utc), datetime.max.replace(tzinfo=timezone.utc))

    active_transactions = [t for t in summary["transactions"] if t.type == "sale" and getattr(t, "status", "completed") != "refunded"]
    
    total_revenue = summary["total_revenue"]
    total_cost = summary["total_cogs"] + summary["total_waste"]

    session_txs = [t for t in active_transactions if t.timestamp >= last_reset]
    session_waste = [w for w in summary["waste_records"] if w.date >= last_reset]

    today_revenue = sum(t.total_revenue for t in session_txs)
    today_cost = sum(t.total_cost for t in session_txs) + sum(w.loss_cost for w in session_waste)

    # Build daily chart data entirely in Python — no extra DB calls.
    # Use utcnow() consistently so the day boundaries match the UTC timestamps
    # stored by pos.py (which also uses utcnow). Mixing now() and utcnow() would
    # shift chart bars by the server's UTC offset.
    daily_data = []
    now = datetime.now(timezone.utc)
    for i in range(6, -1, -1):
        day = now - timedelta(days=i)
        s_day = datetime(day.year, day.month, day.day)
        e_day = s_day + timedelta(days=1)
        day_txs = [t for t in active_transactions if s_day <= t.timestamp < e_day]
        daily_data.append(
            {
                "name": day.strftime("%a"),
                "revenue": sum(t.total_revenue for t in day_txs if t.type == "sale"),
                "cost": sum(t.total_cost for t in day_txs if t.type == "sale"),
            }
        )

    hourly_sales = [{"hour": f"{hour:02d}h", "value": 0} for hour in range(24)]
    for tx in [t for t in active_transactions if t.type == "sale"]:
        hourly_sales[tx.timestamp.hour]["value"] += tx.total_revenue

    product_stats: dict[str, int] = {}
    for tx in [t for t in active_transactions if t.type == "sale"]:
        parsed_items = tx.items if isinstance(tx.items, list) else json.loads(tx.items) if isinstance(tx.items, str) else []
        if parsed_items:
            for item in parsed_items:
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
    # This KPI is shown in the Intelligence panel as inventory cost. It should
    # represent the value of produced stock on hand, not one sample unit of every
    # recipe in the catalog. The latter looked like a cost even when nothing had
    # been sold, which made the event account confusing.
    total_inventory_cost = sum(calculate_product_cost(p) * (p.stock or 0) for p in products)
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
            "total_portfolio_cost": round(total_inventory_cost, 2),
            "average_margin": f"{round(avg_margin, 2)}%",
            "products_count": len(products),
        },
    }
    _analytics_cache[owner_id] = (time.time(), result)
    return result


def get_alerts(
    db: sqlalchemy.orm.Session,
    owner_id: int,
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


def get_profit_report(
    db: sqlalchemy.orm.Session,
    owner_id: int,
):
    # NOTE: This endpoint is now rarely called — the frontend derives the same
    # data client-side from the /inventory response via calcProfitReport().
    # It is kept as a server-side fallback for external API consumers.
    cached = _profit_cache.get(owner_id)
    if cached and (time.time() - cached[0]) < _CACHE_TTL:
        return cached[1]

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
    return report


def simulate_price_impact(
    materials_update: dict[str, float],
    db: sqlalchemy.orm.Session,
    owner_id: int,
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


def get_legacy_forecast(
    target_date: str,
    db: sqlalchemy.orm.Session,
    owner_id: int,
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


# Phase 8 — Enhanced Forecasting & Smart Planning
# ------------------------------------------------


def _get_weekday_name(dt: datetime) -> str:
    """Return weekday name (Mon, Tue, etc.)"""
    return dt.strftime("%a")


def _calculate_growth_trend(weekly_sales: list) -> float:
    """Calculate week-over-week growth rate. Returns multiplier (1.0 = flat)."""
    if len(weekly_sales) < 2:
        return 1.0
    # Use last 3 weeks vs first 3 weeks for trend
    recent = sum(weekly_sales[-3:]) / 3 if len(weekly_sales) >= 3 else weekly_sales[-1]
    older = sum(weekly_sales[:3]) / 3 if len(weekly_sales) >= 3 else weekly_sales[0]
    if older == 0:
        return 1.0
    trend = recent / older
    # Cap extreme trends
    return max(0.5, min(1.5, trend))


def get_enhanced_forecast(
    db: sqlalchemy.orm.Session,
    owner_id: int,
    target_date: str,
    horizon_days: int = 7,
):
    """
    Enhanced forecast with:
    - Weekday-specific historical averages
    - Growth trend multiplier
    - Confidence intervals
    - Horizon: next N days (default 7)
    """
    try:
        target_dt = datetime.strptime(target_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    # Get 8 weeks of history for trend calculation
    history_weeks = 8
    history_dates = [target_dt - timedelta(weeks=i) for i in range(1, history_weeks + 1)]

    window_start = min(
        datetime(d.year, d.month, d.day) for d in history_dates
    )
    window_end = max(
        datetime(d.year, d.month, d.day) + timedelta(days=1) for d in history_dates
    )

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

    # Build sales_by_product[product_id][weekday][date] -> qty
    sales_by_product: dict[str, dict[int, dict[datetime, int]]] = defaultdict(
        lambda: defaultdict(lambda: defaultdict(int))
    )
    day_starts = {
        datetime(d.year, d.month, d.day): datetime(d.year, d.month, d.day)
        for d in history_dates
    }

    for tx in all_txs:
        tx_day = datetime(tx.timestamp.year, tx.timestamp.month, tx.timestamp.day)
        if tx_day not in day_starts:
            continue
        weekday = tx_day.weekday()  # 0=Mon...6=Sun
        if tx.items:
            for item in tx.items:
                pid = item.get("id")
                if pid is not None:
                    sales_by_product[pid][weekday][tx_day] += item.get("qty", 0)

    products = _load_products_with_recipes(db, owner_id)

    # Get current stock + lot balances for production suggestions
    from services.operations import get_stock_lot_balances
    lot_balances = get_stock_lot_balances(db, owner_id)

    # Build lot balance lookup: ingredient_id -> list of {qty, expires_at, lot_id}
    lot_balances_by_ing: dict[int, list] = defaultdict(list)
    for bal in lot_balances:
        if bal.lot and bal.lot.item_type == "ingredient" and bal.quantity > 0:
            lot_balances_by_ing[bal.lot.item_id].append({
                "quantity": bal.quantity,
                "expires_at": bal.lot.expires_at,
                "lot_id": bal.lot.id,
            })

    # Sort each ingredient's lots by expiry (FEFO)
    for ing_id in lot_balances_by_ing:
        lot_balances_by_ing[ing_id].sort(key=lambda x: x["expires_at"] or "9999-12-31")

    forecasts = []
    for product in products:
        weekday_sales = sales_by_product.get(product.id, {})
        # Calculate per-weekday averages
        weekday_forecast = {}
        for wd in range(7):
            sales_on_wd = weekday_sales.get(wd, {})
            if sales_on_wd:
                total = sum(sales_on_wd.values())
                avg = total / len(sales_on_wd)
                # Apply growth trend
                trend = _calculate_growth_trend(list(sales_on_wd.values()))
                adjusted = avg * trend
            else:
                adjusted = 0
            weekday_forecast[_get_weekday_name(datetime(2024, 1, 1 + wd))] = round(adjusted, 1)

        # Horizon forecast: sum next N days
        horizon_qty = 0
        for i in range(horizon_days):
            future_date = target_dt + timedelta(days=i)
            wd = future_date.weekday()
            wd_name = _get_weekday_name(datetime(2024, 1, 1 + wd))
            horizon_qty += weekday_forecast.get(wd_name, 0)

        # Confidence: based on data points
        data_points = sum(len(v) for v in weekday_sales.values())
        confidence = "high" if data_points >= 12 else "medium" if data_points >= 4 else "low"

        forecasts.append({
            "product_id": product.id,
            "product_name": product.name,
            "weekday_forecast": weekday_forecast,
            "horizon_qty": round(horizon_qty),
            "confidence": confidence,
            "data_points": data_points,
        })

    return {
        "target_date": target_date,
        "horizon_days": horizon_days,
        "forecasts": forecasts,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def get_production_suggestions(
    target_date: str,
    db: sqlalchemy.orm.Session,
    owner_id: int,
):
    """
    Production suggestions for a target date:
    - forecast demand per product
    - current stock on hand
    - net production needed = max(0, demand - stock)
    - lot balances check: can we cover with current lots?
    - FEFO: which lots will be consumed?
    """
    try:
        target_dt = datetime.strptime(target_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    # Get forecast for target date
    forecast_resp = get_enhanced_forecast(target_date, horizon_days=1, db=db, owner_id=owner_id)
    forecast_map = {f["product_id"]: f["horizon_qty"] for f in forecast_resp["forecasts"]}

    # Current product stock
    products = _load_products_with_recipes(db, owner_id)
    stock_map = {p.id: p.stock or 0 for p in products}

    # Lot balances for ingredients (FEFO)
    from services.operations import get_stock_lot_balances
    lot_balances = get_stock_lot_balances(db, owner_id)
    lot_balances_by_ing: dict[int, list] = defaultdict(list)
    for bal in lot_balances:
        if bal.lot and bal.lot.item_type == "ingredient" and bal.quantity > 0:
            lot_balances_by_ing[bal.lot.item_id].append({
                "lot_id": bal.lot.id,
                "lot_code": bal.lot.lot_code,
                "quantity": bal.quantity,
                "expires_at": bal.lot.expires_at,
                "unit_cost": bal.lot.unit_cost_snapshot,
            })
    for ing_id in lot_balances_by_ing:
        lot_balances_by_ing[ing_id].sort(key=lambda x: x["expires_at"] or "9999-12-31")

    suggestions = []
    for product in products:
        demand = forecast_map.get(product.id, 0)
        on_hand = stock_map.get(product.id, 0)
        needed = max(0, demand - on_hand)

        if needed == 0:
            suggestions.append({
                "product_id": product.id,
                "product_name": product.name,
                "demand": demand,
                "on_hand": on_hand,
                "suggested_production_qty": 0,
                "reason": "Stock covers demand",
                "feasible": True,
                "ingredient_status": [],
            })
            continue

        # Check if ingredients are available via FEFO
        ingredient_status = []
        feasible = True
        for item in product.recipe_items:
            if not item.ingredient:
                continue
            ing = item.ingredient
            required_per_unit = item.quantity
            total_required = required_per_unit * needed
            lots = lot_balances_by_ing.get(ing.id, [])
            available = sum(l["quantity"] for l in lots)
            if available < total_required:
                feasible = False
                ingredient_status.append({
                    "ingredient_id": ing.id,
                    "ingredient_name": ing.name,
                    "required": round(total_required, 2),
                    "available": round(available, 2),
                    "shortfall": round(total_required - available, 2),
                    "lots": lots[:3],  # first 3 lots (FEFO)
                })
            else:
                ingredient_status.append({
                    "ingredient_id": ing.id,
                    "ingredient_name": ing.name,
                    "required": round(total_required, 2),
                    "available": round(available, 2),
                    "lots": lots[:3],
                })

        suggestions.append({
            "product_id": product.id,
            "product_name": product.name,
            "demand": demand,
            "on_hand": on_hand,
            "suggested_production_qty": needed,
            "reason": f"Demand {demand} - stock {on_hand} = need {needed}",
            "feasible": feasible,
            "ingredient_status": ingredient_status,
        })

    return {
        "target_date": target_date,
        "suggestions": suggestions,
        "total_products_needing_production": sum(1 for s in suggestions if s["suggested_production_qty"] > 0),
    }


def get_purchase_suggestions(
    db: sqlalchemy.orm.Session,
    owner_id: int,
    target_date: str,
    horizon_days: int = 7,
):
    """
    Purchase suggestions:
    - Production suggestions for horizon
    - Ingredient requirements aggregated
    - Minus current stock (by lot, FEFO)
    - Plus safety stock (min_threshold)
    - Flag expiring lots that should be used first
    """
    try:
        target_dt = datetime.strptime(target_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    # Get production suggestions for horizon
    prod_resp = get_production_suggestions(target_date, db=db, owner_id=owner_id)
    prod_suggestions = prod_resp["suggestions"]

    # Aggregate ingredient requirements across all needed production
    ingredient_requirements: dict[int, float] = defaultdict(float)
    for s in prod_suggestions:
        if s["suggested_production_qty"] == 0:
            continue
        product = next((p for p in _load_products_with_recipes(db, owner_id) if p.id == s["product_id"]), None)
        if not product:
            continue
        for item in product.recipe_items:
            if item.ingredient:
                ingredient_requirements[item.ingredient.id] += item.quantity * s["suggested_production_qty"]

    # Current lot balances
    from services.operations import get_stock_lot_balances
    lot_balances = get_stock_lot_balances(db, owner_id)
    ing_lot_balances: dict[int, list] = defaultdict(list)
    for bal in lot_balances:
        if bal.lot and bal.lot.item_type == "ingredient" and bal.quantity > 0:
            ing_lot_balances[bal.lot.item_id].append({
                "lot_id": bal.lot.id,
                "lot_code": bal.lot.lot_code,
                "quantity": bal.quantity,
                "expires_at": bal.lot.expires_at,
                "unit_cost": bal.lot.unit_cost_snapshot,
            })
    for ing_id in ing_lot_balances:
        ing_lot_balances[ing_id].sort(key=lambda x: x["expires_at"] or "9999-12-31")

    # Ingredients with min_threshold
    ingredients = db.query(models.Ingredient).filter(models.Ingredient.owner_id == owner_id).all()
    ing_map = {ing.id: ing for ing in ingredients}

    suggestions = []
    for ing_id, required in ingredient_requirements.items():
        ing = ing_map.get(ing_id)
        if not ing:
            continue
        lots = ing_lot_balances.get(ing_id, [])
        available = sum(l["quantity"] for l in lots)
        safety = ing.min_threshold or 0
        to_order = max(0, required + safety - available)

        # Find expiring lots (<= 7 days)
        expiring_soon = [
            l for l in lots
            if l["expires_at"] and datetime.fromisoformat(l["expires_at"].replace("Z", "+00:00")) < datetime.now(timezone.utc) + timedelta(days=7)
        ]

        if to_order > 0 or expiring_soon:
            suggestions.append({
                "ingredient_id": ing_id,
                "ingredient_name": ing.name,
                "unit": ing.unit,
                "required_for_production": round(required, 2),
                "current_stock": round(available, 2),
                "safety_stock": safety,
                "suggested_order_qty": round(to_order, 2),
                "unit_cost": ing.price,
                "estimated_cost": round(to_order * ing.price, 2),
                "expiring_lots": expiring_soon,
                "supplier_id": None,  # could enrich from PO history
            })

    return {
        "target_date": target_date,
        "horizon_days": horizon_days,
        "suggestions": suggestions,
        "total_estimated_cost": round(sum(s["estimated_cost"] for s in suggestions), 2),
    }


def get_expiring_stock_usage(
    db: sqlalchemy.orm.Session,
    owner_id: int,
    days_ahead: int = 7,
):
    """
    Suggest products to produce that consume expiring ingredient lots.
    For each expiring lot, find recipes that use it and suggest production.
    """
    from services.operations import get_stock_lot_balances

    lot_balances = get_stock_lot_balances(db, owner_id)
    now = datetime.now(timezone.utc)
    cutoff = now + timedelta(days=days_ahead)

    # Find expiring lots
    expiring_lots = []
    for bal in lot_balances:
        if bal.lot and bal.lot.item_type == "ingredient" and bal.quantity > 0:
            expires = bal.lot.expires_at
            if expires:
                exp_dt = datetime.fromisoformat(expires.replace("Z", "+00:00"))
                if exp_dt <= cutoff:
                    expiring_lots.append({
                        "lot_id": bal.lot.id,
                        "lot_code": bal.lot.lot_code,
                        "ingredient_id": bal.lot.item_id,
                        "ingredient_name": bal.lot.item_name_snapshot,
                        "quantity": bal.quantity,
                        "expires_at": expires,
                        "days_until_expiry": (exp_dt - now).days,
                    })

    # For each expiring lot, find products that use this ingredient
    products = _load_products_with_recipes(db, owner_id)
    suggestions = []
    for lot in expiring_lots:
        ing_id = lot["ingredient_id"]
        matching_products = []
        for p in products:
            for item in p.recipe_items:
                if item.ingredient_id == ing_id:
                    max_units = lot["quantity"] / item.quantity if item.quantity > 0 else 0
                    matching_products.append({
                        "product_id": p.id,
                        "product_name": p.name,
                        "max_producible_from_lot": int(max_units),
                        "ingredient_per_unit": item.quantity,
                    })
        if matching_products:
            suggestions.append({
                "expiring_lot": lot,
                "matching_products": matching_products,
                "recommendation": f"Produce {matching_products[0]['product_name']} to use {min(lot['quantity'], matching_products[0]['max_producible_from_lot'] * matching_products[0]['ingredient_per_unit']):.1f}{matching_products[0]['ingredient_per_unit']} of expiring {lot['ingredient_name']}",
            })

    return {
        "days_ahead": days_ahead,
        "expiring_lots_count": len(expiring_lots),
        "suggestions": suggestions,
    }


# End Phase 8 endpoints
