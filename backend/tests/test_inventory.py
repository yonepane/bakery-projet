"""Tests for inventory read and material management."""

import models


def test_inventory_empty_for_new_owner(client, auth_headers):
    resp = client.get("/api/inventory", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "products" in data
    assert "materials" in data
    assert data["products"] == []
    assert data["materials"] == {}


def test_add_material_appears_in_inventory(client, auth_headers):
    client.post("/api/materials", json={
        "name": "Flour",
        "unit": "kg",
        "price": 2.5,
        "min_threshold": 10,
    }, headers=auth_headers)

    resp = client.get("/api/inventory", headers=auth_headers)
    assert resp.status_code == 200
    assert "Flour" in resp.json()["materials"]


def test_delete_material_removes_from_inventory(client, auth_headers):
    client.post("/api/materials", json={
        "name": "Sugar",
        "unit": "kg",
        "price": 1.5,
        "min_threshold": 5,
    }, headers=auth_headers)

    client.delete("/api/materials/Sugar", headers=auth_headers)

    resp = client.get("/api/inventory", headers=auth_headers)
    assert "Sugar" not in resp.json()["materials"]


def test_tenant_isolation_owners_cannot_see_each_other(client, db):
    """Two owners each get their own isolated inventory — key tenancy test."""
    from auth import get_password_hash

    db.add(models.User(username="owner_a", password=get_password_hash("pass1234!"), role="owner"))
    db.add(models.User(username="owner_b", password=get_password_hash("pass1234!"), role="owner"))
    db.commit()

    def get_headers(username):
        resp = client.post("/api/auth/login", json={"username": username, "password": "pass1234!"})
        return {"Authorization": f"Bearer {resp.json()['access_token']}"}

    headers_a = get_headers("owner_a")
    headers_b = get_headers("owner_b")

    # Owner A adds a material
    client.post("/api/materials", json={
        "name": "Butter", "unit": "kg", "price": 5.0, "min_threshold": 2
    }, headers=headers_a)

    # Owner B must NOT see Owner A's material
    resp_b = client.get("/api/inventory", headers=headers_b)
    assert "Butter" not in resp_b.json()["materials"]


def test_add_material_with_allergens_and_units(client, auth_headers):
    """Allergen, organic flag, purchase unit, and ratio must round-trip through the API."""
    resp = client.post("/api/materials", json={
        "name": "Organic Milk",
        "unit": "L",
        "price": 1.2,
        "min_threshold": 5,
        "allergens": ["dairy"],
        "is_organic": True,
        "purchase_unit": "crate_12L",
        "purchase_to_base_ratio": 12.0
    }, headers=auth_headers)
    assert resp.status_code == 200

    # Verify the ingredient is retrievable with correct fields
    inv = client.get("/api/inventory", headers=auth_headers)
    assert inv.status_code == 200
    materials = inv.json()["materials"]
    assert "Organic Milk" in materials
    milk = materials["Organic Milk"]
    assert milk["allergens"] == ["dairy"]
    assert milk["is_organic"] is True
    assert milk["purchase_unit"] == "crate_12L"
    assert milk["purchase_to_base_ratio"] == 12.0


def test_update_material_preserves_allergens(client, auth_headers):
    """PUT must not silently wipe allergen fields."""
    client.post("/api/materials", json={
        "name": "Butter",
        "unit": "kg",
        "price": 5.0,
        "min_threshold": 2,
        "allergens": ["dairy"],
        "is_organic": True,
        "purchase_unit": "box_10kg",
        "purchase_to_base_ratio": 10.0
    }, headers=auth_headers)

    client.put("/api/materials/Butter", json={
        "name": "Butter",
        "unit": "kg",
        "price": 6.0,
        "min_threshold": 2,
        "allergens": ["dairy"],
        "is_organic": True,
        "purchase_unit": "box_10kg",
        "purchase_to_base_ratio": 10.0
    }, headers=auth_headers)

    inv = client.get("/api/inventory", headers=auth_headers)
    butter = inv.json()["materials"]["Butter"]
    assert butter["allergens"] == ["dairy"]
    assert butter["is_organic"] is True
    assert butter["purchase_unit"] == "box_10kg"
    assert butter["purchase_to_base_ratio"] == 10.0


def test_material_defaults_when_fields_omitted(client, auth_headers):
    """New fields must have correct defaults when not provided."""
    client.post("/api/materials", json={
        "name": "Salt",
        "unit": "kg",
        "price": 0.5,
        "min_threshold": 1,
    }, headers=auth_headers)

    inv = client.get("/api/inventory", headers=auth_headers)
    salt = inv.json()["materials"]["Salt"]
    assert salt["allergens"] is None
    assert salt["is_organic"] is False
    assert salt["purchase_unit"] is None
    assert salt["purchase_to_base_ratio"] == 1.0


def test_manual_material_adjustment_writes_stock_movement(client, auth_headers, db):
    client.post("/api/materials", json={
        "name": "Flour",
        "unit": "kg",
        "price": 2.5,
        "min_threshold": 10,
    }, headers=auth_headers)

    resp = client.post("/api/inventory/adjust", json={
        "item_type": "material",
        "id": "Flour",
        "amount": 8,
        "reason": "Initial count",
    }, headers=auth_headers)

    assert resp.status_code == 200
    assert resp.json()["new_stock"] == 8

    movement = db.query(models.StockMovement).filter(
        models.StockMovement.item_type == "ingredient",
        models.StockMovement.item_id == "Flour",
    ).one()
    assert movement.movement_type == "adjustment"
    assert movement.source_type == "manual_adjustment"
    assert movement.reason == "Initial count"
    assert movement.quantity_delta == 8
    assert movement.before_qty == 0
    assert movement.after_qty == 8
    assert movement.unit_snapshot == "kg"


def test_manual_product_adjustment_writes_stock_movement(client, auth_headers, db):
    client.post("/api/products", json={
        "id": "croissant",
        "name": "Croissant",
        "price": 2.5,
        "icon": "x",
        "ingredients": [],
    }, headers=auth_headers)

    resp = client.post("/api/inventory/adjust", json={
        "item_type": "product",
        "id": "croissant",
        "amount": 12,
        "reason": "Display count",
    }, headers=auth_headers)

    assert resp.status_code == 200
    assert resp.json()["new_stock"] == 12

    movement = db.query(models.StockMovement).filter(
        models.StockMovement.item_type == "product",
        models.StockMovement.item_id == "croissant",
    ).one()
    assert movement.item_name_snapshot == "Croissant"
    assert movement.quantity_delta == 12
    assert movement.before_qty == 0
    assert movement.after_qty == 12
    assert movement.created_by_user_id is not None


def test_manual_adjustment_rejects_negative_stock_without_movement(client, auth_headers, db):
    client.post("/api/materials", json={
        "name": "Butter",
        "unit": "kg",
        "price": 5.0,
        "min_threshold": 2,
    }, headers=auth_headers)

    resp = client.post("/api/inventory/adjust", json={
        "item_type": "material",
        "id": "Butter",
        "amount": -1,
        "reason": "Bad count",
    }, headers=auth_headers)

    assert resp.status_code == 400
    assert "below zero" in resp.json()["detail"]
    assert db.query(models.StockMovement).count() == 0

    inv = client.get("/api/inventory", headers=auth_headers)
    assert inv.json()["materials"]["Butter"]["stock"] == 0


def test_manual_adjustment_is_idempotent_by_client_mutation_id(client, auth_headers, db):
    client.post("/api/materials", json={
        "name": "Flour",
        "unit": "kg",
        "price": 2.5,
        "min_threshold": 10,
    }, headers=auth_headers)
    payload = {
        "item_type": "material",
        "id": "Flour",
        "amount": 8,
        "reason": "Initial count",
        "client_mutation_id": "adjust-once",
    }

    first = client.post("/api/inventory/adjust", json=payload, headers=auth_headers)
    second = client.post("/api/inventory/adjust", json=payload, headers=auth_headers)

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["idempotent"] is True
    inv = client.get("/api/inventory", headers=auth_headers)
    assert inv.json()["materials"]["Flour"]["stock"] == 8
    assert db.query(models.StockMovement).filter(
        models.StockMovement.client_mutation_id == "adjust-once",
    ).count() == 1
