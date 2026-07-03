"""Tests for authentication routes (/api/auth/*)."""


def test_signup_creates_user(client):
    resp = client.post("/api/auth/signup", json={
        "username": "new_baker",
        "password": "securepass123",
    })
    assert resp.status_code == 200
    assert "registered successfully" in resp.json()["message"]


def test_signup_rejects_short_password(client):
    resp = client.post("/api/auth/signup", json={
        "username": "baker2",
        "password": "short",
    })
    assert resp.status_code == 400
    assert "8 characters" in resp.json()["detail"]


def test_signup_rejects_duplicate_username(client):
    client.post("/api/auth/signup", json={"username": "baker3", "password": "securepass123"})
    resp = client.post("/api/auth/signup", json={"username": "baker3", "password": "securepass123"})
    assert resp.status_code == 400
    assert "already taken" in resp.json()["detail"]


def test_login_returns_token_and_role(client, db):
    from auth import get_password_hash
    import models
    db.add(models.User(username="login_user", password=get_password_hash("pass1234!"), role="owner"))
    db.commit()

    resp = client.post("/api/auth/login", json={"username": "login_user", "password": "pass1234!"})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["role"] == "owner"


def test_login_wrong_password_returns_401(client, db):
    from auth import get_password_hash
    import models
    db.add(models.User(username="bad_login", password=get_password_hash("correct"), role="owner"))
    db.commit()

    resp = client.post("/api/auth/login", json={"username": "bad_login", "password": "wrong"})
    assert resp.status_code == 401


def test_protected_route_without_token_returns_401(client):
    resp = client.get("/api/inventory")
    assert resp.status_code == 401
