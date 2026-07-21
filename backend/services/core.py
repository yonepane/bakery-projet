"""Core shared helpers used across BakeryOS routes."""

import sqlalchemy.orm

try:
    from .. import models
except ImportError:
    import models


def get_recipe_item_cost(quantity: float, ingredient=None, semi_finished=None, use_cached_sf_cost: bool = False) -> float:
    """Calculate the cost of a recipe item (ingredient or semi-finished).
    Preserves the legacy inline unit conversion (divide by 1000 for kg/L).
    """
    if ingredient:
        factor = 1000.0 if getattr(ingredient, 'unit', '') in ("kg", "L", "l") else 1.0
        required = quantity / factor
        return required * (getattr(ingredient, 'price', 0.0) or 0.0)
    elif semi_finished:
        factor = 1000.0 if getattr(semi_finished, 'unit', '') in ("kg", "L", "l") else 1.0
        required = quantity / factor
        if use_cached_sf_cost:
            return required * (getattr(semi_finished, 'cost', 0.0) or 0.0)
        return required * _cost_semi_finished(semi_finished)
    return 0.0

def _cost_semi_finished(sf_item: "models.SemiFinishedItem") -> float:
    """Recursively compute the ingredient cost for one unit of a semi-finished item."""
    total = 0.0
    for ri in sf_item.recipe_items:
        total += get_recipe_item_cost(ri.quantity, ingredient=ri.ingredient)
    return total

def calculate_product_cost(product: "models.Product", use_cached_sf_cost: bool = False) -> float:
    """Calculate the theoretical ingredient cost to produce one unit of a product."""
    batch_cost = 0.0
    for item in product.recipe_items:
        batch_cost += get_recipe_item_cost(
            item.quantity, 
            ingredient=getattr(item, 'ingredient', None),
            semi_finished=getattr(item, 'semi_finished', None),
            use_cached_sf_cost=use_cached_sf_cost
        )
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
