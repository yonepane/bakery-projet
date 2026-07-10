"""Tests for waste recording and stock movement audit rows."""

import jwt
import models


def _get_owner_id(db, token: str) -> int:
    payload = jwt.decode(token, options={"verify_signature": False})
    user = db.query(models.User).filter(models.User.username == payload["sub"]).first()
    return user.id


def _create_product(db, owner_id: int, *, stock: int = 10):
    product = models.Product(
        id="lemon-tart",
        owner_id=owner_id,
        name="Lemon Tart",
        price=4.5,
        stock=stock,
        yield_qty=1,
    )
    db.add(product)
    db.commit()
    return product


def test_record_waste_writes_stock_movement(client, auth_headers, db, owner_token):
    owner_id = _get_owner_id(db, owner_token)
    product = _create_product(db, owner_id, stock=10)

    resp = client.post("/api/waste", json={
        "product_id": "lemon-tart",
        "quantity": 3,
    }, headers=auth_headers)

    assert resp.status_code == 200
    db.refresh(product)
    assert product.stock == 7

    waste = db.query(models.WasteRecord).filter(
        models.WasteRecord.product_id == "lemon-tart",
        models.WasteRecord.owner_id == owner_id,
    ).one()
    movement = db.query(models.StockMovement).filter(
        models.StockMovement.movement_type == "waste",
        models.StockMovement.source_type == "waste_record",
        models.StockMovement.source_id == str(waste.id),
    ).one()

    assert movement.owner_id == owner_id
    assert movement.item_type == "product"
    assert movement.item_id == "lemon-tart"
    assert movement.item_name_snapshot == "Lemon Tart"
    assert movement.quantity_delta == -3
    assert movement.before_qty == 10
    assert movement.after_qty == 7
    assert movement.created_by_user_id is not None


def test_record_waste_insufficient_stock_does_not_write_records(client, auth_headers, db, owner_token):
    owner_id = _get_owner_id(db, owner_token)
    product = _create_product(db, owner_id, stock=2)

    resp = client.post("/api/waste", json={
        "product_id": "lemon-tart",
        "quantity": 3,
    }, headers=auth_headers)

    assert resp.status_code == 400
    assert "Not enough stock" in resp.json()["detail"]
    db.refresh(product)
    assert product.stock == 2
    assert db.query(models.WasteRecord).count() == 0
    assert db.query(models.StockMovement).count() == 0


def test_record_waste_is_idempotent_by_client_mutation_id(client, auth_headers, db, owner_token):
    owner_id = _get_owner_id(db, owner_token)
    product = _create_product(db, owner_id, stock=10)
    payload = {
        "product_id": "lemon-tart",
        "quantity": 3,
        "client_mutation_id": "waste-once",
    }

    first = client.post("/api/waste", json=payload, headers=auth_headers)
    second = client.post("/api/waste", json=payload, headers=auth_headers)

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["idempotent"] is True
    db.refresh(product)
    assert product.stock == 7
    assert db.query(models.WasteRecord).count() == 1
    assert db.query(models.StockMovement).filter(
        models.StockMovement.client_mutation_id == "waste-once",
    ).count() == 1
