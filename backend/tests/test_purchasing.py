"""Tests for purchase order receiving with unit conversion."""

import models


def _supplier_id(client, auth_headers, name: str) -> int:
    client.post("/api/suppliers", json={"name": name}, headers=auth_headers)
    suppliers = client.get("/api/suppliers", headers=auth_headers).json()
    return next(s["id"] for s in suppliers if s["name"] == name)


def _first_po_id(client, auth_headers) -> str:
    pos = client.get("/api/purchase-orders", headers=auth_headers).json()
    return pos[0]["id"]


def test_receive_po_converts_purchase_units_to_base_units(client, auth_headers, db):
    """When an ingredient has a purchase_unit and ratio, receiving N purchase units
    must add N * ratio to the ingredient stock in base units.
    """
    # Create ingredient: base unit = L, purchase unit = crate_12L, ratio = 12
    client.post("/api/materials", json={
        "name": "Milk",
        "unit": "L",
        "price": 1.0,
        "min_threshold": 5,
        "purchase_unit": "crate_12L",
        "purchase_to_base_ratio": 12.0,
    }, headers=auth_headers)

    # Create a supplier then fetch its id
    supplier_id = _supplier_id(client, auth_headers, "Dairy Co")

    # Create a PO for that supplier (2 crates ordered)
    po_resp = client.post("/api/purchase-orders", json={
        "supplier_id": supplier_id,
        "items": [{"name": "Milk", "qty": 2, "unit": "crate_12L", "price": 12.0}],
        "notes": "",
    }, headers=auth_headers)
    assert po_resp.status_code == 200, f"PO creation failed: {po_resp.text}"

    # Fetch the new PO id
    po_id = _first_po_id(client, auth_headers)

    # Receive the PO — 2 crates → should add 2 * 12 = 24 L to stock
    recv_resp = client.post(f"/api/purchase-orders/{po_id}/receive", json={
        "items": [{"name": "Milk", "qty": 2}]
    }, headers=auth_headers)
    assert recv_resp.status_code == 200, f"Receive failed: {recv_resp.text}"

    # Check stock
    inv = client.get("/api/inventory", headers=auth_headers).json()
    milk = inv["materials"]["Milk"]
    assert milk["stock"] == 24.0, f"Expected 24.0 L, got {milk['stock']}"

    movement = db.query(models.StockMovement).filter(
        models.StockMovement.item_type == "ingredient",
        models.StockMovement.item_id == "Milk",
        models.StockMovement.source_id == po_id,
    ).one()
    assert movement.movement_type == "purchase_receive"
    assert movement.source_type == "purchase_order"
    assert movement.quantity_delta == 24.0
    assert movement.before_qty == 0
    assert movement.after_qty == 24.0
    assert movement.unit_snapshot == "L"


def test_receive_po_without_purchase_unit_uses_qty_directly(client, auth_headers):
    """When an ingredient has no purchase_unit set, qty is added 1:1 to stock."""
    client.post("/api/materials", json={
        "name": "Salt",
        "unit": "kg",
        "price": 0.5,
        "min_threshold": 1,
        # no purchase_unit, ratio defaults to 1.0
    }, headers=auth_headers)

    supplier_id = _supplier_id(client, auth_headers, "General Supplier")

    po_resp = client.post("/api/purchase-orders", json={
        "supplier_id": supplier_id,
        "items": [{"name": "Salt", "qty": 5, "price": 0.5}],
        "notes": "",
    }, headers=auth_headers)
    assert po_resp.status_code == 200, f"PO creation failed: {po_resp.text}"

    po_id = _first_po_id(client, auth_headers)

    recv_resp = client.post(f"/api/purchase-orders/{po_id}/receive", json={
        "items": [{"name": "Salt", "qty": 5}]
    }, headers=auth_headers)
    assert recv_resp.status_code == 200, f"Receive failed: {recv_resp.text}"

    inv = client.get("/api/inventory", headers=auth_headers).json()
    salt = inv["materials"]["Salt"]
    assert salt["stock"] == 5.0, f"Expected 5.0 kg, got {salt['stock']}"


def test_receive_po_without_lot_context_does_not_create_lot_balance(client, auth_headers, db):
    client.post("/api/materials", json={
        "name": "Plain Flour",
        "unit": "kg",
        "price": 1.0,
        "min_threshold": 5,
    }, headers=auth_headers)
    supplier_id = _supplier_id(client, auth_headers, "Flour Supplier")
    client.post("/api/purchase-orders", json={
        "supplier_id": supplier_id,
        "items": [{"name": "Plain Flour", "qty": 10, "price": 1.0}],
        "notes": "",
    }, headers=auth_headers)
    po_id = _first_po_id(client, auth_headers)

    resp = client.post(f"/api/purchase-orders/{po_id}/receive", json={
        "items": [{"name": "Plain Flour", "qty": 10}]
    }, headers=auth_headers)

    assert resp.status_code == 200
    assert db.query(models.StockLot).count() == 0
    assert db.query(models.StockLotBalance).count() == 0


def test_receive_po_with_lot_context_creates_lot_balance_and_movement_context(client, auth_headers, db):
    client.post("/api/materials", json={
        "name": "Raspberry Puree",
        "unit": "kg",
        "price": 8.0,
        "min_threshold": 2,
        "purchase_unit": "pail_5kg",
        "purchase_to_base_ratio": 5.0,
    }, headers=auth_headers)
    supplier_id = _supplier_id(client, auth_headers, "Fruit Supplier")
    client.post("/api/purchase-orders", json={
        "supplier_id": supplier_id,
        "items": [{"name": "Raspberry Puree", "qty": 2, "price": 40.0}],
        "notes": "",
    }, headers=auth_headers)
    po_id = _first_po_id(client, auth_headers)

    resp = client.post(f"/api/purchase-orders/{po_id}/receive", json={
        "items": [{
            "name": "Raspberry Puree",
            "qty": 2,
            "lot_code": "RP-2026-01",
            "supplier_lot_code": "SUP-RP-9",
            "expires_at": "2026-08-15T00:00:00",
        }],
        "client_mutation_id": "receive-lot-context",
    }, headers=auth_headers)

    assert resp.status_code == 200, resp.text
    inv = client.get("/api/inventory", headers=auth_headers).json()
    assert inv["materials"]["Raspberry Puree"]["stock"] == 10.0

    lot = db.query(models.StockLot).filter(models.StockLot.lot_code == "RP-2026-01").one()
    assert lot.item_type == "ingredient"
    assert lot.item_id == "Raspberry Puree"
    assert lot.supplier_lot_code == "SUP-RP-9"
    assert lot.source_type == "purchase_order"
    assert lot.source_id == po_id
    assert lot.unit_snapshot == "kg"
    assert lot.unit_cost_snapshot == 8.0

    balance = db.query(models.StockLotBalance).filter(models.StockLotBalance.lot_id == lot.id).one()
    assert balance.quantity == 10.0
    assert balance.location.type == "warehouse"

    movement = db.query(models.StockMovement).filter(
        models.StockMovement.client_mutation_id == "receive-lot-context",
    ).one()
    assert movement.quantity_delta == 10.0
    assert movement.location_id == balance.location_id
    assert movement.location_name_snapshot == balance.location.name
    assert movement.lot_id == lot.id
    assert movement.lot_code_snapshot == "RP-2026-01"
    assert movement.unit_cost_snapshot == 8.0
    assert movement.correlation_id == "receive-lot-context"


def test_receive_po_lot_context_is_idempotent(client, auth_headers, db):
    client.post("/api/materials", json={
        "name": "Vanilla Paste",
        "unit": "kg",
        "price": 30.0,
        "min_threshold": 1,
    }, headers=auth_headers)
    supplier_id = _supplier_id(client, auth_headers, "Vanilla Supplier")
    client.post("/api/purchase-orders", json={
        "supplier_id": supplier_id,
        "items": [{"name": "Vanilla Paste", "qty": 3, "price": 30.0}],
        "notes": "",
    }, headers=auth_headers)
    po_id = _first_po_id(client, auth_headers)
    payload = {
        "items": [{
            "name": "Vanilla Paste",
            "qty": 3,
            "lot_code": "VAN-001",
            "expires_at": "2026-09-01T00:00:00",
        }],
        "client_mutation_id": "receive-lot-once",
    }

    first = client.post(f"/api/purchase-orders/{po_id}/receive", json=payload, headers=auth_headers)
    second = client.post(f"/api/purchase-orders/{po_id}/receive", json=payload, headers=auth_headers)

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["idempotent"] is True
    assert db.query(models.StockLot).filter(models.StockLot.lot_code == "VAN-001").count() == 1
    assert db.query(models.StockLotBalance).count() == 1
    assert db.query(models.StockMovement).filter(
        models.StockMovement.client_mutation_id == "receive-lot-once",
    ).count() == 1


def test_mark_po_received_writes_stock_movement_with_purchase_unit_ratio(client, auth_headers, db):
    client.post("/api/materials", json={
        "name": "Cream",
        "unit": "L",
        "price": 2.0,
        "min_threshold": 3,
        "purchase_unit": "crate_6L",
        "purchase_to_base_ratio": 6.0,
    }, headers=auth_headers)

    supplier_id = _supplier_id(client, auth_headers, "Cream Supplier")
    po_resp = client.post("/api/purchase-orders", json={
        "supplier_id": supplier_id,
        "items": [{"name": "Cream", "qty": 3, "price": 18.0}],
        "notes": "",
    }, headers=auth_headers)
    assert po_resp.status_code == 200
    po_id = _first_po_id(client, auth_headers)

    status_resp = client.patch(
        f"/api/purchase-orders/{po_id}/status",
        params={"status": "received"},
        headers=auth_headers,
    )
    assert status_resp.status_code == 200

    inv = client.get("/api/inventory", headers=auth_headers).json()
    assert inv["materials"]["Cream"]["stock"] == 18.0

    movement = db.query(models.StockMovement).filter(
        models.StockMovement.item_type == "ingredient",
        models.StockMovement.item_id == "Cream",
        models.StockMovement.source_id == po_id,
    ).one()
    assert movement.movement_type == "purchase_receive"
    assert movement.quantity_delta == 18.0
    assert movement.before_qty == 0
    assert movement.after_qty == 18.0


def test_receive_po_is_idempotent_by_client_mutation_id(client, auth_headers, db):
    client.post("/api/materials", json={
        "name": "Salt",
        "unit": "kg",
        "price": 0.5,
        "min_threshold": 1,
    }, headers=auth_headers)
    supplier_id = _supplier_id(client, auth_headers, "Idempotent Supplier")
    client.post("/api/purchase-orders", json={
        "supplier_id": supplier_id,
        "items": [{"name": "Salt", "qty": 5, "price": 0.5}],
        "notes": "",
    }, headers=auth_headers)
    po_id = _first_po_id(client, auth_headers)
    payload = {
        "items": [{"name": "Salt", "qty": 5}],
        "client_mutation_id": "receive-once",
    }

    first = client.post(f"/api/purchase-orders/{po_id}/receive", json=payload, headers=auth_headers)
    second = client.post(f"/api/purchase-orders/{po_id}/receive", json=payload, headers=auth_headers)

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["idempotent"] is True
    inv = client.get("/api/inventory", headers=auth_headers).json()
    assert inv["materials"]["Salt"]["stock"] == 5.0
    assert db.query(models.StockMovement).filter(
        models.StockMovement.client_mutation_id == "receive-once",
    ).count() == 1
