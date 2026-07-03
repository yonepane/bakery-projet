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
