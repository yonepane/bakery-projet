"""Core shared helpers used across BakeryOS routes."""

import json
import os
from functools import lru_cache

try:
    from .. import models
except ImportError:
    import models


def calculate_product_cost(product: models.Product) -> float:
    total_cost = 0
    for item in product.recipe_items:
        if item.ingredient:
            total_cost += item.quantity * item.ingredient.price
    return total_cost


@lru_cache(maxsize=1)
def get_settings(data_dir: str) -> dict:
    """Read bakery settings from disk. Cached for the lifetime of the process.

    Call ``get_settings.cache_clear()`` after a settings update so the next
    request picks up the new values.
    """
    settings_path = os.path.join(data_dir, "settings.json")
    if os.path.exists(settings_path):
        with open(settings_path, "r") as handle:
            return json.load(handle)
    return {"currency": "MAD", "tax_rate": 0.2}
