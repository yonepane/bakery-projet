"""Shared pytest fixtures for BakeryOS backend tests.

Uses an in-memory SQLite database so tests are:
- Fast (no disk I/O)
- Isolated (fresh state per test via transaction rollback)
- Dependency-free (no external services needed)
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base, get_db
from main import app
from auth import get_password_hash
import models

TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    TEST_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def create_tables():
    """Create all tables once before the test session starts."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db():
    """Yield a fresh DB session per test, rolled back after to keep tests isolated."""
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    yield session
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture()
def client(db):
    """FastAPI TestClient with the real DB swapped for the in-memory test DB."""
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def owner_token(client, db):
    """Create an owner user and return their JWT access token."""
    db.add(models.User(
        username="test_owner",
        password=get_password_hash("securepass123"),
        role="owner",
    ))
    db.commit()

    resp = client.post("/api/auth/login", json={
        "username": "test_owner",
        "password": "securepass123",
    })
    assert resp.status_code == 200
    return resp.json()["access_token"]


@pytest.fixture()
def auth_headers(owner_token):
    """Return Authorization headers ready to pass to client.get/post/etc."""
    return {"Authorization": f"Bearer {owner_token}"}
