"""Tests for kitchen execution stages API."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.conftest import create_test_ingredient, make_product


def test_create_and_fetch_kitchen_batch(client: TestClient, db: Session, owner_token: str):
    owner_id = _get_owner_id(db, owner_token)
    product = make_product(db, owner_id)
    
    res = client.post(
        "/api/kitchen/batches",
        json={
            "product_id": product.id,
            "quantity": 2.5,
            "planned_for_date": "2026-07-15"
        },
        headers={"Authorization": f"Bearer {owner_token}"}
    )
    assert res.status_code == 200
    batch_id = res.json()["id"]

    res = client.get("/api/kitchen/batches", headers={"Authorization": f"Bearer {owner_token}"})
    assert res.status_code == 200
    batches = res.json()
    assert len(batches) == 1
    assert batches[0]["id"] == batch_id
    assert batches[0]["stage"] == "planned"
    assert batches[0]["quantity"] == 2.5

def test_advance_batch_stage_deducts_ingredients(client: TestClient, db: Session, owner_token: str):
    import models
    owner_id = _get_owner_id(db, owner_token)
    flour = create_test_ingredient(db, owner_id, name="Flour", price=1.0, unit="g")
    
    product = make_product(db, owner_id)
    # add recipe item
    ri = models.RecipeItem(product_id=product.id, ingredient_id=flour.id, quantity=100)
    db.add(ri)
    
    batch = models.ProductionBatch(id="B1", owner_id=owner_id, product_id=product.id, quantity=2, stage="planned")
    db.add(batch)
    db.commit()

    initial_flour_stock = flour.stock

    res = client.put(
        "/api/kitchen/batches/B1/stage",
        json={"stage": "prepping"},
        headers={"Authorization": f"Bearer {owner_token}"}
    )
    assert res.status_code == 200
    
    db.refresh(flour)
    db.refresh(batch)
    
    # 2 batches * 100g = 200g deducted
    assert flour.stock == initial_flour_stock - 200
    assert batch.started_at is not None
    
    # Fast forward to ready adds finished stock
    initial_prod_stock = product.stock
    res = client.put(
        "/api/kitchen/batches/B1/stage",
        json={"stage": "ready"},
        headers={"Authorization": f"Bearer {owner_token}"}
    )
    assert res.status_code == 200
    db.refresh(product)
    db.refresh(batch)
    
    assert product.stock == initial_prod_stock + 2
    assert batch.completed_at is not None


def _get_owner_id(db, token=None):
    import models
    return db.query(models.User).filter_by(username="test_owner").first().id
