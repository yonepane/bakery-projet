"""Unit tests for calculate_product_cost in services/core.py."""
import pytest
from unittest.mock import MagicMock

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import models
from services.core import calculate_product_cost


def _make_ingredient(price: float, unit: str = "g") -> models.Ingredient:
    ing = MagicMock(spec=models.Ingredient)
    ing.price = price
    ing.unit = unit
    ing.stock = 999
    return ing


def _make_recipe_item(quantity: float, ingredient=None, semi_finished=None) -> models.RecipeItem:
    item = MagicMock(spec=models.RecipeItem)
    item.quantity = quantity
    item.ingredient = ingredient
    item.ingredient_id = ingredient.id if ingredient else None
    item.semi_finished = semi_finished
    item.semi_finished_id = 1 if semi_finished else None
    return item


def test_single_ingredient_no_unit_conversion():
    """100g of flour at 0.005/g = 0.50."""
    flour = _make_ingredient(price=0.005, unit="g")
    ri = _make_recipe_item(quantity=100, ingredient=flour)

    product = MagicMock(spec=models.Product)
    product.yield_qty = 1
    product.recipe_items = [ri]

    assert round(calculate_product_cost(product), 4) == 0.50


def test_two_ingredients():
    """200g flour @0.005 + 50g butter @0.02 = 1.00 + 1.00 = 2.00."""
    flour = _make_ingredient(price=0.005, unit="g")
    butter = _make_ingredient(price=0.02, unit="g")
    ri1 = _make_recipe_item(quantity=200, ingredient=flour)
    ri2 = _make_recipe_item(quantity=50, ingredient=butter)

    product = MagicMock(spec=models.Product)
    product.yield_qty = 1
    product.recipe_items = [ri1, ri2]

    assert round(calculate_product_cost(product), 4) == 2.00


def test_semi_finished_ingredient_is_costed():
    """Product uses 0.2kg of ganache. Ganache recipe: 100g chocolate @0.04 + 100g cream @0.01.
    Ganache cost per 1 unit = 100*0.04 + 100*0.01 = 5.00.
    Product uses 0.2 of ganache's unit => 0.2 * 5.00 = 1.00.
    """
    choc = _make_ingredient(price=0.04, unit="g")
    cream = _make_ingredient(price=0.01, unit="g")

    ganache_ri1 = _make_recipe_item(quantity=100, ingredient=choc)
    ganache_ri2 = _make_recipe_item(quantity=100, ingredient=cream)

    ganache = MagicMock(spec=models.SemiFinishedItem)
    ganache.recipe_items = [ganache_ri1, ganache_ri2]

    sf_ri = _make_recipe_item(quantity=0.2, semi_finished=ganache)

    product = MagicMock(spec=models.Product)
    product.yield_qty = 1
    product.recipe_items = [sf_ri]

    assert round(calculate_product_cost(product), 4) == 1.00


def test_empty_recipe_returns_zero():
    product = MagicMock(spec=models.Product)
    product.yield_qty = 1
    product.recipe_items = []
    assert calculate_product_cost(product) == 0.0


def test_yield_qty_divides_cost():
    """A recipe that costs 10.00 and yields 10 units = 1.00 per unit."""
    flour = _make_ingredient(price=0.01, unit="g")
    ri = _make_recipe_item(quantity=1000, ingredient=flour)

    product = MagicMock(spec=models.Product)
    product.yield_qty = 10
    product.recipe_items = [ri]

    assert round(calculate_product_cost(product), 4) == 1.00
