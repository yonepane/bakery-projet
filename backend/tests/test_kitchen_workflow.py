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

    # Worm through the pastry stages up to "proof" — no stock change yet
    for stage in ("prep", "mix", "rest", "laminate", "proof"):
        res = client.put(
            "/api/kitchen/batches/B1/stage",
            json={"stage": stage},
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        assert res.status_code == 200, f"stage {stage} failed: {res.text}"
    db.refresh(flour)
    assert flour.stock == initial_flour_stock  # ingredients not deducted until bake

    # Entering "bake" deducts ingredients
    res = client.put(
        "/api/kitchen/batches/B1/stage",
        json={"stage": "bake"},
        headers={"Authorization": f"Bearer {owner_token}"}
    )
    assert res.status_code == 200
    
    db.refresh(flour)
    db.refresh(batch)
    
    # 2 batches * 100g = 200g deducted
    assert flour.stock == initial_flour_stock - 200
    assert batch.started_at is not None
    
    # Fast forward through bake -> display -> ready adds finished stock
    for stage in ("cool", "fill", "decorate", "pack", "display"):
        res = client.put(
            "/api/kitchen/batches/B1/stage",
            json={"stage": stage},
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        assert res.status_code == 200, f"stage {stage} failed: {res.text}"

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


def test_advance_batch_assigns_user_timer_and_notes(client: TestClient, db: Session, owner_token: str):
    """Pastry-stage expansion: assign user, set timer, add batch notes."""
    import models
    owner_id = _get_owner_id(db, owner_token)
    owner_user = db.query(models.User).filter_by(username="test_owner").first()
    product = make_product(db, owner_id)
    batch = models.ProductionBatch(id="B2", owner_id=owner_id, product_id=product.id, quantity=1, stage="planned")
    db.add(batch)
    db.commit()

    res = client.put(
        "/api/kitchen/batches/B2/stage",
        json={
            "stage": "prep",
            "timer_minutes": 35,
            "batch_notes": "Watch the dough temperature",
            "assigned_to_id": owner_user.id,
        },
        headers={"Authorization": f"Bearer {owner_token}"}
    )
    assert res.status_code == 200
    db.refresh(batch)
    assert batch.timer_minutes == 35
    assert batch.batch_notes == "Watch the dough temperature"
    assert batch.assigned_to_id == owner_user.id


def _get_owner_id(db, token=None):
    import models
    return db.query(models.User).filter_by(username="test_owner").first().id
