"""Tests for POS sale stock movement behavior."""

import jwt
import models


def _get_owner_id(db, token: str) -> int:
    payload = jwt.decode(token, options={"verify_signature": False})
    user = db.query(models.User).filter(models.User.username == payload["sub"]).first()
    return user.id


def _create_product(db, owner_id: int, *, stock: int = 10):
    product = models.Product(
        id="baguette",
        owner_id=owner_id,
        name="Baguette",
        price=3.0,
        stock=stock,
        yield_qty=1,
    )
    db.add(product)
    db.commit()
    return product


def test_complete_sale_writes_stock_movement(client, auth_headers, db, owner_token):
    owner_id = _get_owner_id(db, owner_token)
    product = _create_product(db, owner_id, stock=10)

    resp = client.post("/api/complete", json={
        "cart": [{"id": "baguette", "qty": 4}],
    }, headers=auth_headers)

    assert resp.status_code == 200
    tx_id = resp.json()["transaction_id"]
    db.refresh(product)
    assert product.stock == 6

    tx = db.query(models.Transaction).filter(
        models.Transaction.id == tx_id,
        models.Transaction.type == "sale",
        models.Transaction.owner_id == owner_id,
    ).one()
    movement = db.query(models.StockMovement).filter(
        models.StockMovement.movement_type == "sale",
        models.StockMovement.source_type == "transaction",
        models.StockMovement.source_id == tx.id,
        models.StockMovement.item_type == "product",
        models.StockMovement.item_id == "baguette",
    ).one()

    assert tx.total_revenue == 12.0
    assert movement.quantity_delta == -4
    assert movement.before_qty == 10
    assert movement.after_qty == 6
    assert movement.item_name_snapshot == "Baguette"
    assert movement.created_by_user_id is not None


def test_complete_sale_insufficient_stock_writes_no_transaction_or_movement(
    client,
    auth_headers,
    db,
    owner_token,
):
    owner_id = _get_owner_id(db, owner_token)
    product = _create_product(db, owner_id, stock=2)

    resp = client.post("/api/complete", json={
        "cart": [{"id": "baguette", "qty": 3}],
    }, headers=auth_headers)

    assert resp.status_code == 400
    assert "Insufficient stock" in resp.json()["detail"]
    db.refresh(product)
    assert product.stock == 2
    assert db.query(models.Transaction).count() == 0
    assert db.query(models.StockMovement).count() == 0


def test_complete_sale_is_idempotent_by_client_mutation_id(client, auth_headers, db, owner_token):
    owner_id = _get_owner_id(db, owner_token)
    product = _create_product(db, owner_id, stock=10)
    payload = {
        "cart": [{"id": "baguette", "qty": 4}],
        "client_mutation_id": "sale-once",
    }

    first = client.post("/api/complete", json=payload, headers=auth_headers)
    second = client.post("/api/complete", json=payload, headers=auth_headers)

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["idempotent"] is True
    assert second.json()["transaction_id"] == first.json()["transaction_id"]
    db.refresh(product)
    assert product.stock == 6
    assert db.query(models.Transaction).filter(models.Transaction.type == "sale").count() == 1
    assert db.query(models.StockMovement).filter(
        models.StockMovement.client_mutation_id == "sale-once",
        models.StockMovement.movement_type == "sale",
    ).count() == 1


def test_refund_sale_writes_refund_stock_movement(client, auth_headers, db, owner_token):
    owner_id = _get_owner_id(db, owner_token)
    product = _create_product(db, owner_id, stock=10)

    sale_resp = client.post("/api/complete", json={
        "cart": [{"id": "baguette", "qty": 4}],
    }, headers=auth_headers)
    assert sale_resp.status_code == 200
    tx_id = sale_resp.json()["transaction_id"]

    refund_resp = client.post(f"/api/transactions/{tx_id}/refund", headers=auth_headers)

    assert refund_resp.status_code == 200
    db.refresh(product)
    assert product.stock == 10

    tx = db.query(models.Transaction).filter(models.Transaction.id == tx_id).one()
    assert tx.status == "refunded"

    movements = db.query(models.StockMovement).filter(
        models.StockMovement.source_id == tx_id,
        models.StockMovement.item_id == "baguette",
    ).order_by(models.StockMovement.id.asc()).all()
    assert [m.movement_type for m in movements] == ["sale", "refund"]
    assert movements[0].quantity_delta == -4
    assert movements[0].before_qty == 10
    assert movements[0].after_qty == 6
    assert movements[1].quantity_delta == 4
    assert movements[1].before_qty == 6
    assert movements[1].after_qty == 10
    assert movements[1].created_by_user_id is not None


def test_refund_already_refunded_sale_writes_no_second_refund_movement(
    client,
    auth_headers,
    db,
    owner_token,
):
    owner_id = _get_owner_id(db, owner_token)
    product = _create_product(db, owner_id, stock=10)

    sale_resp = client.post("/api/complete", json={
        "cart": [{"id": "baguette", "qty": 4}],
    }, headers=auth_headers)
    tx_id = sale_resp.json()["transaction_id"]

    first_refund = client.post(f"/api/transactions/{tx_id}/refund", headers=auth_headers)
    second_refund = client.post(f"/api/transactions/{tx_id}/refund", headers=auth_headers)

    assert first_refund.status_code == 200
    assert second_refund.status_code == 400
    assert "already refunded" in second_refund.json()["detail"]
    db.refresh(product)
    assert product.stock == 10

    refund_movements = db.query(models.StockMovement).filter(
        models.StockMovement.source_id == tx_id,
        models.StockMovement.movement_type == "refund",
    ).all()
    assert len(refund_movements) == 1


def test_refund_is_idempotent_by_client_mutation_header(client, auth_headers, db, owner_token):
    owner_id = _get_owner_id(db, owner_token)
    product = _create_product(db, owner_id, stock=10)
    sale_resp = client.post("/api/complete", json={
        "cart": [{"id": "baguette", "qty": 4}],
    }, headers=auth_headers)
    tx_id = sale_resp.json()["transaction_id"]
    headers = {**auth_headers, "X-Client-Mutation-Id": "refund-once"}

    first = client.post(f"/api/transactions/{tx_id}/refund", headers=headers)
    second = client.post(f"/api/transactions/{tx_id}/refund", headers=headers)

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["idempotent"] is True
    db.refresh(product)
    assert product.stock == 10
    assert db.query(models.StockMovement).filter(
        models.StockMovement.client_mutation_id == "refund-once",
        models.StockMovement.movement_type == "refund",
    ).count() == 1
