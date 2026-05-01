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
            factor = 1000.0 if item.ingredient.unit in ['kg', 'L', 'l'] else 1.0
            total_cost += (item.quantity / factor) * item.ingredient.price
    return total_cost

