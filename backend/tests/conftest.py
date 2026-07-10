"""Shared pytest fixtures for BakeryOS backend tests.

Uses an in-memory SQLite database so tests are:
- Fast (no disk I/O)
- Isolated (fresh state per test via transaction rollback)
- Dependency-free (no external services needed)
"""

import asyncio

import httpx
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base, get_db
from main import app
from auth import create_access_token, get_password_hash
import models

try:
    from routers.auth import limiter as auth_limiter
except ImportError:
    auth_limiter = None

if hasattr(app.state, "limiter"):
    app.state.limiter.enabled = False
if auth_limiter is not None:
    auth_limiter.enabled = False

TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    TEST_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class SyncASGITestClient:
    """Small sync facade over httpx ASGITransport.

    Starlette's TestClient currently hangs in this Python 3.14 environment.
    The app itself works with ASGITransport, so this wrapper keeps the tests
    synchronous while avoiding the TestClient portal deadlock.
    """

    def __init__(self, app):
        self.app = app
        self.base_url = "http://testserver"
        self.loop = asyncio.new_event_loop()
        self.transport = httpx.ASGITransport(app=self.app)
        self.client = httpx.AsyncClient(transport=self.transport, base_url=self.base_url)

    def request(self, method: str, url: str, **kwargs):
        async def _request():
            return await self.client.request(method, url, **kwargs)

        return self.loop.run_until_complete(_request())

    def get(self, url: str, **kwargs):
        return self.request("GET", url, **kwargs)

    def post(self, url: str, **kwargs):
        return self.request("POST", url, **kwargs)

    def put(self, url: str, **kwargs):
        return self.request("PUT", url, **kwargs)

    def patch(self, url: str, **kwargs):
        return self.request("PATCH", url, **kwargs)

    def delete(self, url: str, **kwargs):
        return self.request("DELETE", url, **kwargs)

    def close(self):
        self.loop.run_until_complete(self.client.aclose())
        self.loop.run_until_complete(self.transport.aclose())
        self.loop.close()


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
    async def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    test_client = SyncASGITestClient(app)
    try:
        yield test_client
    finally:
        test_client.close()
    app.dependency_overrides.clear()


@pytest.fixture()
def owner_token(client, db):
    """Create an owner user and return their JWT access token."""
    user = models.User(
        username="test_owner",
        password=get_password_hash("securepass123"),
        role="owner",
    )
    db.add(user)
    db.commit()
    return create_access_token(data={"sub": user.username})


@pytest.fixture()
def auth_headers(owner_token):
    """Return Authorization headers ready to pass to client.get/post/etc."""
    return {"Authorization": f"Bearer {owner_token}"}


def make_product(db, owner_id: int, name: str = "Test Product"):
    import models, uuid
    p = models.Product(
        id=str(uuid.uuid4())[:8],
        owner_id=owner_id,
        name=name,
        price=5.0,
        stock=0,
        yield_qty=1,
    )
    db.add(p)
    db.flush()
    return p


def create_test_ingredient(db, owner_id: int, name: str, price: float, unit: str = "g"):
    import models
    ing = models.Ingredient(owner_id=owner_id, name=name, price=price, unit=unit, stock=9999)
    db.add(ing)
    db.flush()
    return ing
