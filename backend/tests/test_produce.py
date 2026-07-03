"""Tests for POST /api/produce (production batch route)."""

import jwt
import models
from auth import get_password_hash


def _get_owner_id(db, token: str) -> int:
    """Decode JWT (no signature verification) to get the owner's DB id."""
    payload = jwt.decode(token, options={"verify_signature": False})
    user = db.query(models.User).filter(models.User.username == payload["sub"]).first()
    return user.id


def _setup_product_with_ingredient(db, owner_id: int):
    """Create a product with one ingredient that has enough stock for a few batches."""
    ing = models.Ingredient(
        name="Flour",
        owner_id=owner_id,
        stock=10.0,   # 10 kg
        unit="kg",
        price=2.0,
        min_threshold=1.0,
    )
    db.add(ing)
    db.flush()

    product = models.Product(
        id="croissant",
        owner_id=owner_id,
        name="Croissant",
        price=3.5,
        stock=0,
        yield_qty=10,
    )
    db.add(product)
    db.flush()

    db.add(models.RecipeItem(
        product_id="croissant",
        ingredient_id=ing.id,
        quantity=500,  # 500g per batch (unit is kg so divide by 1000 in route)
    ))
    db.commit()
    return product, ing


def test_produce_increments_product_stock(client, auth_headers, db, owner_token):
    owner_id = _get_owner_id(db, owner_token)
    _setup_product_with_ingredient(db, owner_id)

    resp = client.post("/api/produce", json={"product_id": "croissant", "quantity": 5},
                       headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["new_stock"] == 5


def test_produce_deducts_ingredient_stock(client, auth_headers, db, owner_token):
    owner_id = _get_owner_id(db, owner_token)
    _, ing = _setup_product_with_ingredient(db, owner_id)
    initial_stock = ing.stock

    client.post("/api/produce", json={"product_id": "croissant", "quantity": 2},
                headers=auth_headers)

    db.refresh(ing)
    assert ing.stock < initial_stock


def test_produce_fails_on_insufficient_stock(client, auth_headers, db, owner_token):
    owner_id = _get_owner_id(db, owner_token)
    _setup_product_with_ingredient(db, owner_id)

    # 1000 batches x 500g = 500kg — far more than the 10kg available
    resp = client.post("/api/produce", json={"product_id": "croissant", "quantity": 1000},
                       headers=auth_headers)
    assert resp.status_code == 400
    assert "Insufficient" in resp.json()["detail"]
