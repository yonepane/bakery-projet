"""Core shared helpers used across BakeryOS routes."""

import sqlalchemy.orm

try:
    from .. import models
except ImportError:
    import models


def _cost_semi_finished(sf_item: "models.SemiFinishedItem") -> float:
    """Recursively compute the ingredient cost for one unit of a semi-finished item."""
    total = 0.0
    for ri in sf_item.recipe_items:
        if ri.ingredient:
            total += ri.quantity * ri.ingredient.price
    return total


def calculate_product_cost(product: "models.Product") -> float:
    """Calculate the ingredient cost to produce one unit of a product.

    Correctly handles:
    - Ingredient recipe lines (price is per base unit, quantity is in base unit)
    - Semi-finished recipe lines (costed via their own ingredient recipes)
    - yield_qty: total batch cost divided by units produced
    """
    batch_cost = 0.0
    for item in product.recipe_items:
        if getattr(item, 'ingredient_id', None) and getattr(item, 'ingredient', None):
            batch_cost += item.quantity * item.ingredient.price
        elif getattr(item, 'semi_finished_id', None) and getattr(item, 'semi_finished', None):
            sf_cost_per_unit = _cost_semi_finished(item.semi_finished)
            batch_cost += item.quantity * sf_cost_per_unit
    yield_qty = (getattr(product, 'yield_qty', None) or 1)
    return batch_cost / yield_qty


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
