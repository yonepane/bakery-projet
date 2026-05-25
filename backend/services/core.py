"""Core shared helpers used across BakeryOS routes."""

import sqlalchemy.orm

try:
    from .. import models
except ImportError:
    import models


def calculate_product_cost(product: models.Product) -> float:
    """Calculate the ingredient cost to produce one unit of a product."""
    total_cost = 0
    for item in product.recipe_items:
        if item.ingredient:
            factor = 1000.0 if item.ingredient.unit in ['kg', 'L', 'l'] else 1.0
            total_cost += (item.quantity / factor) * item.ingredient.price
    return total_cost


def get_user_settings(db: sqlalchemy.orm.Session, owner_id: int) -> dict:
    """Return the owner's system settings as a plain dict.

    Falls back to sensible defaults when no settings row exists yet
    (e.g. a brand-new account that has never saved settings).
    """
    settings_records = (
        db.query(models.SystemSetting)
        .filter(models.SystemSetting.owner_id == owner_id)
        .all()
    )
    if not settings_records:
        return {"currency": "MAD", "tax_rate": 0.2, "bakery_name": "BakeryOS"}
    return {s.key: s.value for s in settings_records}
