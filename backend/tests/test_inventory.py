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
