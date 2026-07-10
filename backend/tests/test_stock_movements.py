"""Tests for read-only stock movement history."""

import models
from auth import create_access_token, get_password_hash


def test_owner_can_read_own_stock_movements(client, auth_headers):
    client.post("/api/materials", json={
        "name": "Flour",
        "unit": "kg",
        "price": 2.5,
        "min_threshold": 10,
    }, headers=auth_headers)
    client.post("/api/inventory/adjust", json={
        "item_type": "material",
        "id": "Flour",
        "amount": 8,
        "reason": "Initial count",
        "client_mutation_id": "movement-list",
    }, headers=auth_headers)

    resp = client.get("/api/stock-movements", headers=auth_headers)

    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    movement = data[0]
    assert movement["item_type"] == "ingredient"
    assert movement["item_id"] == "Flour"
    assert movement["movement_type"] == "adjustment"
    assert movement["quantity_delta"] == 8
    assert movement["before_qty"] == 0
    assert movement["after_qty"] == 8
    assert movement["client_mutation_id"] == "movement-list"


def test_stock_movements_are_owner_only(client, db, auth_headers):
    db.add(models.User(username="other_owner", password=get_password_hash("pass1234!"), role="owner"))
    db.commit()
    other_token = create_access_token(data={"sub": "other_owner"})
    other_headers = {"Authorization": f"Bearer {other_token}"}

    client.post("/api/materials", json={
        "name": "Butter",
        "unit": "kg",
        "price": 5.0,
        "min_threshold": 2,
    }, headers=auth_headers)
    client.post("/api/inventory/adjust", json={
        "item_type": "material",
        "id": "Butter",
        "amount": 4,
    }, headers=auth_headers)

    resp = client.get("/api/stock-movements", headers=other_headers)

    assert resp.status_code == 200
    assert resp.json() == []


def test_cashier_cannot_read_stock_movements(client, db, owner_token):
    owner = db.query(models.User).filter(models.User.username == "test_owner").one()
    cashier = models.User(
        username="cashier",
        password=get_password_hash("pass1234!"),
        role="cashier",
        parent_owner_id=owner.id,
    )
    db.add(cashier)
    db.commit()
    cashier_headers = {"Authorization": f"Bearer {create_access_token(data={'sub': 'cashier'})}"}

    resp = client.get("/api/stock-movements", headers=cashier_headers)

    assert resp.status_code == 403
