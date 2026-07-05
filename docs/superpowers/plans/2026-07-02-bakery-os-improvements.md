# bakery-os Improvement Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three targeted improvements drawn from the burhan-platform comparison: break up the `Dashboard.tsx` monolith, add the first pytest coverage, and enforce descriptive migration naming.

**Architecture:** Each task is self-contained and independently shippable. Task 1 extracts mutation handlers out of `Dashboard.tsx` into co-located hooks inside `frontend/src/components/dashboard/hooks/`. Task 2 adds a pytest foundation covering the 3 highest-risk backend routes. Task 3 is a naming convention fix for Alembic migrations.

**Tech Stack:** React 19, TypeScript, FastAPI, SQLAlchemy 2.0, pytest, Alembic

---

## Task 1: Extract mutation handlers out of Dashboard.tsx

**Why:** `Dashboard.tsx` is 3,147 lines. It owns both UI layout and all 30+ async mutation handlers. The `panels/` split with `React.lazy` is already done — the next step is moving the handler logic into co-located hooks so each panel owns its own mutations.

**Scope:** 6 handler groups → 6 new hook files. `Dashboard.tsx` becomes layout-only.

**Files:**
- Create: `frontend/src/components/dashboard/hooks/useInventoryMutations.ts`
- Create: `frontend/src/components/dashboard/hooks/useProductMutations.ts`
- Create: `frontend/src/components/dashboard/hooks/useExpenseMutations.ts`
- Create: `frontend/src/components/dashboard/hooks/usePurchasingMutations.ts`
- Create: `frontend/src/components/dashboard/hooks/useStaffMutations.ts`
- Create: `frontend/src/components/dashboard/hooks/usePlannerMutations.ts`
- Create: `frontend/src/components/dashboard/hooks/index.ts`
- Modify: `frontend/src/components/Dashboard.tsx`
- Modify: `frontend/src/components/dashboard/types.ts`

---

- [ ] **Step 1.1: Add shared MutationDeps type to types.ts**

Open `frontend/src/components/dashboard/types.ts` and append at the bottom:

```typescript
/** Minimal shared dependencies passed into every mutation hook. */
export interface MutationDeps {
  fetchData: () => void;
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  showConfirm: (config: ConfirmConfig) => void;
}
```

- [ ] **Step 1.2: Create useInventoryMutations.ts**

Create `frontend/src/components/dashboard/hooks/useInventoryMutations.ts`:

```typescript
/**
 * useInventoryMutations — async handlers for raw material operations.
 * Extracted from Dashboard.tsx to keep Dashboard focused on layout.
 */
import { useCallback } from 'react';
import { api } from '../../../lib/api';
import type { MutationDeps } from '../types';

export function useInventoryMutations({ fetchData, addToast }: MutationDeps) {
  const handleAdjustStock = useCallback(
    async (item_type: 'product' | 'material', id: string, amount: number) => {
      try {
        await api.post('/inventory/adjust', { item_type, id, amount });
        fetchData();
      } catch {
        addToast('Failed to adjust stock', 'error');
      }
    },
    [fetchData, addToast]
  );

  const handleAddMaterial = useCallback(
    async (name: string, unit: string, price: number, min_threshold: number) => {
      try {
        await api.post('/materials', { name, unit, price, min_threshold });
        fetchData();
        addToast('Material added', 'success');
      } catch {
        addToast('Failed to add material', 'error');
      }
    },
    [fetchData, addToast]
  );

  const handleDeleteMaterial = useCallback(
    async (name: string) => {
      try {
        await api.delete(`/materials/${encodeURIComponent(name)}`);
        fetchData();
        addToast('Material deleted', 'success');
      } catch {
        addToast('Failed to delete material', 'error');
      }
    },
    [fetchData, addToast]
  );

  return { handleAdjustStock, handleAddMaterial, handleDeleteMaterial };
}
```

- [ ] **Step 1.3: Create useProductMutations.ts**

Create `frontend/src/components/dashboard/hooks/useProductMutations.ts`:

```typescript
/**
 * useProductMutations — async handlers for catalog/product operations.
 */
import { useCallback } from 'react';
import { api } from '../../../lib/api';
import type { MutationDeps } from '../types';

export function useProductMutations({ fetchData, addToast }: MutationDeps) {
  const handleAddProduct = useCallback(
    async (productData: Record<string, unknown>) => {
      try {
        await api.post('/products', productData);
        fetchData();
        addToast('Product added', 'success');
      } catch {
        addToast('Failed to add product', 'error');
      }
    },
    [fetchData, addToast]
  );

  const handleDeleteProduct = useCallback(
    async (id: string) => {
      try {
        await api.delete(`/products/${id}`);
        fetchData();
        addToast('Product deleted', 'success');
      } catch {
        addToast('Failed to delete product', 'error');
      }
    },
    [fetchData, addToast]
  );

  const handleUpdateProductPrice = useCallback(
    async (productId: string, newPrice: number) => {
      try {
        await api.put(`/products/${productId}`, { price: newPrice });
        fetchData();
      } catch {
        addToast('Failed to update price', 'error');
      }
    },
    [fetchData, addToast]
  );

  const handleUpdateProductField = useCallback(
    async (productId: string, field: string, value: unknown) => {
      try {
        await api.put(`/products/${productId}`, { [field]: value });
        fetchData();
      } catch {
        addToast('Failed to update product', 'error');
      }
    },
    [fetchData, addToast]
  );

  const handleUpdateProductIngredients = useCallback(
    async (productId: string, ingredients: unknown[]) => {
      try {
        await api.put(`/products/${productId}`, { ingredients });
        fetchData();
      } catch {
        addToast('Failed to update ingredients', 'error');
      }
    },
    [fetchData, addToast]
  );

  const handleCleanupProducts = useCallback(async () => {
    try {
      await api.post('/maintenance/cleanup-products', {});
      fetchData();
      addToast('Cleanup complete', 'success');
    } catch {
      addToast('Cleanup failed', 'error');
    }
  }, [fetchData, addToast]);

  return {
    handleAddProduct,
    handleDeleteProduct,
    handleUpdateProductPrice,
    handleUpdateProductField,
    handleUpdateProductIngredients,
    handleCleanupProducts,
  };
}
```

- [ ] **Step 1.4: Create useExpenseMutations.ts**

Create `frontend/src/components/dashboard/hooks/useExpenseMutations.ts`:

```typescript
/**
 * useExpenseMutations — async handlers for expense and shift-close operations.
 */
import { useCallback } from 'react';
import { api } from '../../../lib/api';
import type { MutationDeps } from '../types';

export function useExpenseMutations({ fetchData, addToast }: MutationDeps) {
  const handleAddExpense = useCallback(
    async (expenseData: Record<string, unknown>) => {
      try {
        await api.post('/expenses', expenseData);
        fetchData();
        addToast('Expense added', 'success');
      } catch {
        addToast('Failed to add expense', 'error');
      }
    },
    [fetchData, addToast]
  );

  const handleUpdateExpense = useCallback(
    async (id: number, expenseData: Record<string, unknown>) => {
      try {
        await api.put(`/expenses/${id}`, expenseData);
        fetchData();
        addToast('Expense updated', 'success');
      } catch {
        addToast('Failed to update expense', 'error');
      }
    },
    [fetchData, addToast]
  );

  const handleDeleteExpense = useCallback(
    async (id: number) => {
      try {
        await api.delete(`/expenses/${id}`);
        fetchData();
        addToast('Expense deleted', 'success');
      } catch {
        addToast('Failed to delete expense', 'error');
      }
    },
    [fetchData, addToast]
  );

  return { handleAddExpense, handleUpdateExpense, handleDeleteExpense };
}
```

- [ ] **Step 1.5: Create usePurchasingMutations.ts**

Create `frontend/src/components/dashboard/hooks/usePurchasingMutations.ts`:

```typescript
/**
 * usePurchasingMutations — async handlers for suppliers and purchase orders.
 */
import { useCallback } from 'react';
import { api } from '../../../lib/api';
import type { MutationDeps } from '../types';

export function usePurchasingMutations({ fetchData, addToast }: MutationDeps) {
  const handleAddSupplier = useCallback(
    async (supplierData: Record<string, unknown>) => {
      try {
        await api.post('/suppliers', supplierData);
        fetchData();
        addToast('Supplier added', 'success');
      } catch {
        addToast('Failed to add supplier', 'error');
      }
    },
    [fetchData, addToast]
  );

  const handleDeleteSupplier = useCallback(
    async (id: number) => {
      try {
        await api.delete(`/suppliers/${id}`);
        fetchData();
        addToast('Supplier deleted', 'success');
      } catch {
        addToast('Failed to delete supplier', 'error');
      }
    },
    [fetchData, addToast]
  );

  const handleCreatePO = useCallback(
    async (data: { supplier_id: number; items: unknown[] }) => {
      try {
        await api.post('/purchase-orders', data);
        fetchData();
        addToast('Purchase order created', 'success');
      } catch {
        addToast('Failed to create PO', 'error');
      }
    },
    [fetchData, addToast]
  );

  const handleReceivePO = useCallback(
    async (id: string, payload?: { items: unknown[] }) => {
      try {
        await api.post(`/purchase-orders/${id}/receive`, payload ?? {});
        fetchData();
        addToast('PO received', 'success');
      } catch {
        addToast('Failed to receive PO', 'error');
      }
    },
    [fetchData, addToast]
  );

  const handleDeletePO = useCallback(
    async (id: string) => {
      try {
        await api.delete(`/purchase-orders/${id}`);
        fetchData();
        addToast('PO deleted', 'success');
      } catch {
        addToast('Failed to delete PO', 'error');
      }
    },
    [fetchData, addToast]
  );

  return { handleAddSupplier, handleDeleteSupplier, handleCreatePO, handleReceivePO, handleDeletePO };
}
```

- [ ] **Step 1.6: Create useStaffMutations.ts**

Create `frontend/src/components/dashboard/hooks/useStaffMutations.ts`:

```typescript
/**
 * useStaffMutations — async handlers for staff and shift log operations.
 */
import { useCallback } from 'react';
import { api } from '../../../lib/api';
import type { MutationDeps } from '../types';

export function useStaffMutations({ fetchData, addToast }: MutationDeps) {
  const handleAddStaff = useCallback(
    async (staffData: Record<string, unknown>) => {
      try {
        await api.post('/staff', staffData);
        fetchData();
        addToast('Staff member added', 'success');
      } catch {
        addToast('Failed to add staff', 'error');
      }
    },
    [fetchData, addToast]
  );

  const handleDeleteStaff = useCallback(
    async (username: string) => {
      try {
        await api.delete(`/staff/${encodeURIComponent(username)}`);
        fetchData();
        addToast('Staff member removed', 'success');
      } catch {
        addToast('Failed to delete staff', 'error');
      }
    },
    [fetchData, addToast]
  );

  const handleDeleteShiftLog = useCallback(
    async (id: number) => {
      try {
        await api.delete(`/shift-logs/${id}`);
        fetchData();
      } catch {
        addToast('Failed to delete log', 'error');
      }
    },
    [fetchData, addToast]
  );

  const handleSaveGeneralNote = useCallback(
    async (content: string) => {
      try {
        await api.post('/shift-logs', { content });
        fetchData();
        addToast('Note saved', 'success');
      } catch {
        addToast('Failed to save note', 'error');
      }
    },
    [fetchData, addToast]
  );

  return { handleAddStaff, handleDeleteStaff, handleDeleteShiftLog, handleSaveGeneralNote };
}
```

- [ ] **Step 1.7: Create usePlannerMutations.ts**

Create `frontend/src/components/dashboard/hooks/usePlannerMutations.ts`:

```typescript
/**
 * usePlannerMutations — async handlers for production planning and kitchen operations.
 */
import { useCallback } from 'react';
import { api } from '../../../lib/api';
import type { MutationDeps } from '../types';

export function usePlannerMutations({ fetchData, addToast }: MutationDeps) {
  const handleProduce = useCallback(
    async (productId: string, qty: number) => {
      try {
        await api.post('/produce', { product_id: productId, quantity: qty });
        fetchData();
        addToast(`Produced ${qty} units`, 'success');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Production failed';
        addToast(msg, 'error');
      }
    },
    [fetchData, addToast]
  );

  const handlePlanBatch = useCallback(
    async (productId: string, qty: number, date: string) => {
      try {
        await api.post('/planner', { product_id: productId, quantity: qty, date });
        fetchData();
        addToast('Batch planned', 'success');
      } catch {
        addToast('Failed to plan batch', 'error');
      }
    },
    [fetchData, addToast]
  );

  const handleCompletePlan = useCallback(
    async (planId: string) => {
      try {
        await api.patch(`/planner/${planId}/complete`, {});
        fetchData();
      } catch {
        addToast('Failed to complete plan', 'error');
      }
    },
    [fetchData, addToast]
  );

  return { handleProduce, handlePlanBatch, handleCompletePlan };
}
```

- [ ] **Step 1.8: Create hooks/index.ts barrel**

Create `frontend/src/components/dashboard/hooks/index.ts`:

```typescript
export { useInventoryMutations } from './useInventoryMutations';
export { useProductMutations } from './useProductMutations';
export { useExpenseMutations } from './useExpenseMutations';
export { usePurchasingMutations } from './usePurchasingMutations';
export { useStaffMutations } from './useStaffMutations';
export { usePlannerMutations } from './usePlannerMutations';
```

- [ ] **Step 1.9: Wire hooks into Dashboard.tsx**

In `Dashboard.tsx`, add these imports after existing dashboard imports:

```typescript
import {
  useInventoryMutations,
  useProductMutations,
  useExpenseMutations,
  usePurchasingMutations,
  useStaffMutations,
  usePlannerMutations,
} from './dashboard/hooks';
```

Inside the component body, replace the inline `const handle...` blocks (~lines 383–1411) with:

```typescript
const mutationDeps = { fetchData, addToast, showConfirm };

const { handleAdjustStock, handleAddMaterial, handleDeleteMaterial } =
  useInventoryMutations(mutationDeps);

const {
  handleAddProduct, handleDeleteProduct, handleUpdateProductPrice,
  handleUpdateProductField, handleUpdateProductIngredients, handleCleanupProducts,
} = useProductMutations(mutationDeps);

const { handleAddExpense, handleUpdateExpense, handleDeleteExpense } =
  useExpenseMutations(mutationDeps);

const {
  handleAddSupplier, handleDeleteSupplier, handleCreatePO,
  handleReceivePO, handleDeletePO,
} = usePurchasingMutations(mutationDeps);

const { handleAddStaff, handleDeleteStaff, handleDeleteShiftLog, handleSaveGeneralNote } =
  useStaffMutations(mutationDeps);

const { handleProduce, handlePlanBatch, handleCompletePlan } =
  usePlannerMutations(mutationDeps);
```

- [ ] **Step 1.10: Verify the app builds**

```bash
cd /home/dane/bakery-os/frontend
npm run build
```

Expected: Build succeeds with no TypeScript errors. Fix any handler signature mismatches by aligning the hook's function signature with what each panel passes.

- [ ] **Step 1.11: Commit**

```bash
cd /home/dane/bakery-os
git add frontend/src/components/dashboard/hooks/ frontend/src/components/dashboard/types.ts frontend/src/components/Dashboard.tsx
git commit -m "refactor: extract mutation handlers from Dashboard.tsx into co-located hooks

Dashboard.tsx was 3147 lines. Mutation logic now lives in:
- hooks/useInventoryMutations.ts  (stock + materials)
- hooks/useProductMutations.ts    (catalog)
- hooks/useExpenseMutations.ts    (finance)
- hooks/usePurchasingMutations.ts (suppliers + POs)
- hooks/useStaffMutations.ts      (staff + shift logs)
- hooks/usePlannerMutations.ts    (kitchen + planner)

Dashboard.tsx is now layout + state wiring only."
```

---

## Task 2: Add a pytest foundation

**Why:** bakery-os has zero tests. Starting now prevents regressions as the codebase grows. The 3 routes tested here are the highest-risk: auth (entry point), inventory (every user hits it), and produce (financial transaction with stock deduction).

**Files:**
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_auth.py`
- Create: `backend/tests/test_inventory.py`
- Create: `backend/tests/test_produce.py`
- Modify: `backend/requirements.txt`

---

- [ ] **Step 2.1: Add test dependencies**

Append to `backend/requirements.txt`:

```
# Test dependencies (dev-only)
pytest==8.3.5
pytest-anyio==0.0.0
anyio[trio]==4.6.0
```

> `httpx` is already in the file — skip it. Install:

```bash
cd /home/dane/bakery-os
pip install "pytest==8.3.5" "pytest-anyio" "anyio[trio]"
```

- [ ] **Step 2.2: Create tests/__init__.py**

Create `backend/tests/__init__.py` (empty):

```python
```

- [ ] **Step 2.3: Create tests/conftest.py**

Create `backend/tests/conftest.py`:

```python
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
```

- [ ] **Step 2.4: Create test_auth.py**

Create `backend/tests/test_auth.py`:

```python
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
```

- [ ] **Step 2.5: Create test_inventory.py**

Create `backend/tests/test_inventory.py`:

```python
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
```

- [ ] **Step 2.6: Create test_produce.py**

Create `backend/tests/test_produce.py`:

```python
"""Tests for POST /api/produce (production batch route)."""

import jwt
import models
from auth import get_password_hash


def _get_owner_id(db, token: str) -> int:
    """Decode JWT (no signature verification) to get the owner's DB id."""
    payload = jwt.decode(token, options={"verify_signature": False})
    user = db.query(models.User).filter(models.User.username == payload["sub"]).first()
    return user.id


def _setup_product_with_ingredient(db, owner_id: int):
    """Create a product with one ingredient that has enough stock for a few batches."""
    ing = models.Ingredient(
        name="Flour",
        owner_id=owner_id,
        stock=10.0,   # 10 kg
        unit="kg",
        price=2.0,
        min_threshold=1.0,
    )
    db.add(ing)
    db.flush()

    product = models.Product(
        id="croissant",
        owner_id=owner_id,
        name="Croissant",
        price=3.5,
        stock=0,
        yield_qty=10,
    )
    db.add(product)
    db.flush()

    db.add(models.RecipeItem(
        product_id="croissant",
        ingredient_id=ing.id,
        quantity=500,  # 500g per batch (unit is kg so divide by 1000 in route)
    ))
    db.commit()
    return product, ing


def test_produce_increments_product_stock(client, auth_headers, db, owner_token):
    owner_id = _get_owner_id(db, owner_token)
    _setup_product_with_ingredient(db, owner_id)

    resp = client.post("/api/produce", json={"product_id": "croissant", "quantity": 5},
                       headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["new_stock"] == 5


def test_produce_deducts_ingredient_stock(client, auth_headers, db, owner_token):
    owner_id = _get_owner_id(db, owner_token)
    _, ing = _setup_product_with_ingredient(db, owner_id)
    initial_stock = ing.stock

    client.post("/api/produce", json={"product_id": "croissant", "quantity": 2},
                headers=auth_headers)

    db.refresh(ing)
    assert ing.stock < initial_stock


def test_produce_fails_on_insufficient_stock(client, auth_headers, db, owner_token):
    owner_id = _get_owner_id(db, owner_token)
    _setup_product_with_ingredient(db, owner_id)

    # 1000 batches x 500g = 500kg — far more than the 10kg available
    resp = client.post("/api/produce", json={"product_id": "croissant", "quantity": 1000},
                       headers=auth_headers)
    assert resp.status_code == 400
    assert "Insufficient" in resp.json()["detail"]
```

- [ ] **Step 2.7: Run all tests**

```bash
cd /home/dane/bakery-os/backend
python -m pytest tests/ -v
```

Expected (all green):
```
tests/test_auth.py::test_signup_creates_user PASSED
tests/test_auth.py::test_signup_rejects_short_password PASSED
tests/test_auth.py::test_signup_rejects_duplicate_username PASSED
tests/test_auth.py::test_login_returns_token_and_role PASSED
tests/test_auth.py::test_login_wrong_password_returns_401 PASSED
tests/test_auth.py::test_protected_route_without_token_returns_401 PASSED
tests/test_inventory.py::test_inventory_empty_for_new_owner PASSED
tests/test_inventory.py::test_add_material_appears_in_inventory PASSED
tests/test_inventory.py::test_delete_material_removes_from_inventory PASSED
tests/test_inventory.py::test_tenant_isolation_owners_cannot_see_each_other PASSED
tests/test_produce.py::test_produce_increments_product_stock PASSED
tests/test_produce.py::test_produce_deducts_ingredient_stock PASSED
tests/test_produce.py::test_produce_fails_on_insufficient_stock PASSED
```

- [ ] **Step 2.8: Commit**

```bash
cd /home/dane/bakery-os
git add backend/tests/ backend/requirements.txt
git commit -m "test: add pytest foundation with auth, inventory, and produce coverage

13 tests covering the 3 highest-risk backend routes:
- Auth: signup validation, login, JWT contents, 401 on missing token
- Inventory: empty state, add/delete material, tenant isolation
- Produce: stock increment, ingredient deduction, insufficient stock guard

Uses in-memory SQLite — no external services required.
Run: cd backend && python -m pytest tests/ -v"
```

---

## Task 3: Descriptive Alembic migration filenames

**Why:** Current names like `3e9803fe76a2_add_customer_loyalty_program.py` put the unreadable hash first. `git log` and `alembic history` are both hard to scan. Renaming to a sequential prefix makes the migration chain immediately readable.

**Files:**
- Rename: `backend/alembic/versions/b8c6f0974e0a_initial_migration.py`
- Rename: `backend/alembic/versions/3e9803fe76a2_add_customer_loyalty_program.py`
- Rename: `backend/alembic/versions/dd8b55b98308_add_customer_id.py`

---

- [ ] **Step 3.1: Rename existing migration files**

```bash
cd /home/dane/bakery-os/backend/alembic/versions

mv b8c6f0974e0a_initial_migration.py            00001_initial_schema_b8c6f0974e0a.py
mv 3e9803fe76a2_add_customer_loyalty_program.py  00002_add_customer_loyalty_3e9803fe76a2.py
mv dd8b55b98308_add_customer_id.py              00003_add_customer_id_to_orders_dd8b55b98308.py
```

The revision IDs inside each file are unchanged — Alembic resolves migrations by the `revision` variable in the file, not the filename.

- [ ] **Step 3.2: Verify Alembic still resolves the chain**

```bash
cd /home/dane/bakery-os/backend
alembic history --verbose
```

Expected: all 3 revisions listed in chronological order with no errors.

- [ ] **Step 3.3: Commit**

```bash
cd /home/dane/bakery-os
git add backend/alembic/versions/
git commit -m "chore: rename Alembic migrations to sequential descriptive names

Pattern: NNNNN_description_<hash>.py
Revision IDs (inside files) are unchanged — Alembic still works.

Convention going forward:
  alembic revision -m '00004_<what_and_why>'"
```

---

## Self-Review

**Spec coverage:**
- Dashboard.tsx monolith → Task 1 ✅
- Zero tests → Task 2 ✅
- Migration naming → Task 3 ✅
- PostgreSQL RLS → intentionally deferred: bakery-os uses SQLite locally; RLS only applies on PostgreSQL in production and requires a full DB migration + session wiring. Worth a separate plan when Postgres is the primary target.

**Placeholder scan:** All handler bodies use real API paths that match the existing routers. The `conftest.py` fixtures are complete and concrete. All test assertions check specific strings and status codes — no vague "assert it works" patterns.

**Type consistency:** `MutationDeps` is defined once in Task 1.1 and imported identically in all 6 hooks in Steps 1.2–1.7. The `mutationDeps` object wired in Dashboard.tsx contains exactly `{ fetchData, addToast, showConfirm }` — matching the interface.

---

**Plan saved to `docs/superpowers/plans/2026-07-02-bakery-os-improvements.md`.**

Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, you review between tasks, fast iteration
2. **Inline Execution** — Execute tasks in this session with review checkpoints

Which approach?
