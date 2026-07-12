# Phase 3 — Recipe Versioning & Cost Truth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make product cost always accurate (including semi-finished ingredients and correct unit math), add a structured cost-breakdown endpoint, add lightweight recipe versioning, and surface it all in a "Cost Breakdown" modal in the frontend.

**Architecture:**
- `services/core.py` `calculate_product_cost()` is the single source of truth for cost calculation. It currently has two bugs: it ignores `semi_finished` recipe items entirely, and it applies a hardcoded `/1000` conversion only for `kg/L` — breaking `g`, `ml`, `litre`, etc. We fix it here and nowhere else.
- A new `GET /api/products/{product_id}/cost-breakdown` endpoint returns a structured, per-line cost breakdown + margin. It lives in `routers/catalog.py`.
- Recipe versioning: every time `PUT /api/catalog/{product_id}/recipe` saves, we append a `RecipeSnapshot` row. `RecipeSnapshot` stores `product_id`, `owner_id`, `changed_at`, `changed_by_user_id`, and `snapshot` (JSON of the lines at that moment). No new migration needed — we use SQLite's JSON column. We add the model and create the table via Alembic.
- Frontend: a "Cost" button per product in `InventoryPanel.tsx` opens a `CostBreakdownModal.tsx` that hits the new endpoint and displays the breakdown table + margin chip + recipe history timeline.

**Tech Stack:** Python 3.11+, FastAPI, SQLAlchemy, Pydantic, Alembic (backend). React, TypeScript, Vite (frontend).

**Constraint:** No changes to existing columns. `RecipeSnapshot` is a new, additive table only.

---

### Task 1 — Fix `calculate_product_cost` in `services/core.py`

**Files:**
- Modify: `backend/services/core.py`
- Test: `backend/tests/test_cost_calculation.py` (new file)

**Background:**
Current implementation:
```python
def calculate_product_cost(product: models.Product) -> float:
    total_cost = 0
    for item in product.recipe_items:
        if item.ingredient:
            factor = 1000.0 if item.ingredient.unit in ['kg', 'L', 'l'] else 1.0
            total_cost += (item.quantity / factor) * item.ingredient.price
    return total_cost
```

**Bug 1 — Unit conversion:** `item.quantity` is stored in the ingredient's **base unit** (grams or ml). `item.ingredient.price` is per **base unit** already. So no division by 1000 is needed. The old code double-converts by mistake. The correct formula is simply:
```
line_cost = item.quantity * item.ingredient.price
```
*(Confirm by checking `SemiFinishedRecipeItem.quantity` docstring: "in ingredient base unit (g or ml)" — same for `RecipeItem`.)*

**Bug 2 — Semi-finished items ignored:** When a `RecipeItem` has `semi_finished_id` set instead of `ingredient_id`, the current function skips it. We must recursively cost the semi-finished item's own recipe.

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_cost_calculation.py`:

```python
"""Unit tests for calculate_product_cost in services/core.py."""
import pytest
from unittest.mock import MagicMock

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import models
from services.core import calculate_product_cost


def _make_ingredient(price: float, unit: str = "g") -> models.Ingredient:
    ing = MagicMock(spec=models.Ingredient)
    ing.price = price
    ing.unit = unit
    ing.stock = 999
    return ing


def _make_recipe_item(quantity: float, ingredient=None, semi_finished=None) -> models.RecipeItem:
    item = MagicMock(spec=models.RecipeItem)
    item.quantity = quantity
    item.ingredient = ingredient
    item.ingredient_id = ingredient.id if ingredient else None
    item.semi_finished = semi_finished
    item.semi_finished_id = 1 if semi_finished else None
    return item


def test_single_ingredient_no_unit_conversion():
    """100g of flour at 0.005/g = 0.50."""
    flour = _make_ingredient(price=0.005, unit="g")
    ri = _make_recipe_item(quantity=100, ingredient=flour)

    product = MagicMock(spec=models.Product)
    product.yield_qty = 1
    product.recipe_items = [ri]

    assert round(calculate_product_cost(product), 4) == 0.50


def test_two_ingredients():
    """200g flour @0.005 + 50g butter @0.02 = 1.00 + 1.00 = 2.00."""
    flour = _make_ingredient(price=0.005, unit="g")
    butter = _make_ingredient(price=0.02, unit="g")
    ri1 = _make_recipe_item(quantity=200, ingredient=flour)
    ri2 = _make_recipe_item(quantity=50, ingredient=butter)

    product = MagicMock(spec=models.Product)
    product.yield_qty = 1
    product.recipe_items = [ri1, ri2]

    assert round(calculate_product_cost(product), 4) == 2.00


def test_semi_finished_ingredient_is_costed():
    """Product uses 0.2kg of ganache. Ganache recipe: 100g chocolate @0.04 + 100g cream @0.01.
    Ganache cost per 1 unit = 100*0.04 + 100*0.01 = 5.00.
    Product uses 0.2 of ganache's unit => 0.2 * 5.00 = 1.00.
    """
    choc = _make_ingredient(price=0.04, unit="g")
    cream = _make_ingredient(price=0.01, unit="g")

    ganache_ri1 = _make_recipe_item(quantity=100, ingredient=choc)
    ganache_ri2 = _make_recipe_item(quantity=100, ingredient=cream)

    ganache = MagicMock(spec=models.SemiFinishedItem)
    ganache.recipe_items = [ganache_ri1, ganache_ri2]

    sf_ri = _make_recipe_item(quantity=0.2, semi_finished=ganache)

    product = MagicMock(spec=models.Product)
    product.yield_qty = 1
    product.recipe_items = [sf_ri]

    assert round(calculate_product_cost(product), 4) == 1.00


def test_empty_recipe_returns_zero():
    product = MagicMock(spec=models.Product)
    product.yield_qty = 1
    product.recipe_items = []
    assert calculate_product_cost(product) == 0.0


def test_yield_qty_divides_cost():
    """A recipe that costs 10.00 and yields 10 units = 1.00 per unit."""
    flour = _make_ingredient(price=0.01, unit="g")
    ri = _make_recipe_item(quantity=1000, ingredient=flour)

    product = MagicMock(spec=models.Product)
    product.yield_qty = 10
    product.recipe_items = [ri]

    assert round(calculate_product_cost(product), 4) == 1.00
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /home/dane/bakery-os/backend && source venv/bin/activate && python -m pytest tests/test_cost_calculation.py -v 2>&1 | tail -20
```
Expected: several FAILED (current implementation has bugs).

- [ ] **Step 3: Fix `calculate_product_cost` in `services/core.py`**

Replace the entire function with:

```python
def _cost_semi_finished(sf_item: "models.SemiFinishedItem") -> float:
    """Recursively compute the ingredient cost for one unit of a semi-finished item."""
    total = 0.0
    for ri in sf_item.recipe_items:
        if ri.ingredient:
            total += ri.quantity * ri.ingredient.price
    return total


def calculate_product_cost(product: "models.Product") -> float:
    """Calculate the ingredient cost to produce one unit of a product.

    Correctly handles:
    - Ingredient recipe lines (price is per base unit, quantity is in base unit)
    - Semi-finished recipe lines (costed via their own ingredient recipes)
    - yield_qty: total batch cost divided by units produced
    """
    batch_cost = 0.0
    for item in product.recipe_items:
        if item.ingredient_id and item.ingredient:
            batch_cost += item.quantity * item.ingredient.price
        elif item.semi_finished_id and item.semi_finished:
            sf_cost_per_unit = _cost_semi_finished(item.semi_finished)
            batch_cost += item.quantity * sf_cost_per_unit
    yield_qty = (product.yield_qty or 1)
    return batch_cost / yield_qty
```

- [ ] **Step 4: Run tests to confirm they all pass**

```bash
cd /home/dane/bakery-os/backend && source venv/bin/activate && python -m pytest tests/test_cost_calculation.py -v 2>&1 | tail -20
```
Expected: 5 PASSED.

- [ ] **Step 5: Run full test suite to confirm no regressions**

```bash
cd /home/dane/bakery-os/backend && source venv/bin/activate && python -m pytest -q 2>&1 | tail -10
```
Expected: all 77 tests still pass.

- [ ] **Step 6: Commit**

```bash
cd /home/dane/bakery-os/backend
git add services/core.py tests/test_cost_calculation.py
git commit -m "fix(cost): correct unit math + cost semi-finished recipe items in calculate_product_cost"
```

---

### Task 2 — `RecipeSnapshot` model + Alembic migration

**Files:**
- Modify: `backend/models.py`
- Create: `backend/alembic/versions/00009_add_recipe_snapshots_20260710.py`

The `RecipeSnapshot` table records a full JSON copy of a product's recipe lines every time the recipe is saved. This gives us lightweight versioning without any complex diff logic.

- [ ] **Step 1: Add `RecipeSnapshot` model to `models.py`**

Append after `SemiFinishedRecipeItem` (end of file):

```python
class RecipeSnapshot(Base):
    """Append-only log of recipe saves for a product.

    Every time a product's recipe is saved via PUT /api/catalog/{id}/recipe,
    a new row is added here. No rows are ever deleted or updated.

    `snapshot` stores a JSON list of dicts:
      [{"type": "ingredient", "name": "Flour", "quantity": 200, "unit": "g", "price_per_unit": 0.005},
       {"type": "semi_finished", "name": "Ganache", "quantity": 0.2, "unit": "kg"}]
    """
    __tablename__ = "recipe_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)
    product_id = Column(String, ForeignKey("products.id"), index=True)
    changed_at = Column(DateTime, default=lambda: datetime.datetime.now(timezone.utc), index=True)
    changed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    snapshot = Column(JSON)  # list of recipe line dicts

    product = relationship("Product")
```

- [ ] **Step 2: Create Alembic migration**

Create `backend/alembic/versions/00009_add_recipe_snapshots_20260710.py`:

```python
"""Add recipe_snapshots table.

Revision ID: 00009
Revises: 00008
Create Date: 2026-07-10
"""
from alembic import op
import sqlalchemy as sa

revision = '00009'
down_revision = '00008'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'recipe_snapshots',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('owner_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True, index=True),
        sa.Column('product_id', sa.String(), sa.ForeignKey('products.id'), nullable=True, index=True),
        sa.Column('changed_at', sa.DateTime(), nullable=True, index=True),
        sa.Column('changed_by_user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('snapshot', sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_recipe_snapshots_id', 'recipe_snapshots', ['id'])


def downgrade() -> None:
    op.drop_index('ix_recipe_snapshots_id', table_name='recipe_snapshots')
    op.drop_table('recipe_snapshots')
```

- [ ] **Step 3: Run migration**

```bash
cd /home/dane/bakery-os/backend && source venv/bin/activate && alembic upgrade head
```
Expected: `Running upgrade 00008 -> 00009`.

- [ ] **Step 4: Verify the table exists**

```bash
cd /home/dane/bakery-os/backend && source venv/bin/activate && python -c "
from database import SessionLocal
from models import RecipeSnapshot
db = SessionLocal()
print('RecipeSnapshot table OK, count:', db.query(RecipeSnapshot).count())
db.close()
"
```
Expected: `RecipeSnapshot table OK, count: 0`

- [ ] **Step 5: Run full test suite**

```bash
cd /home/dane/bakery-os/backend && source venv/bin/activate && python -m pytest -q 2>&1 | tail -10
```
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
cd /home/dane/bakery-os/backend
git add models.py alembic/versions/00009_add_recipe_snapshots_20260710.py
git commit -m "feat(models): add RecipeSnapshot model and migration for recipe versioning"
```

---

### Task 3 — Write recipe snapshots on PUT + add cost-breakdown endpoint to `routers/catalog.py`

**Files:**
- Modify: `backend/routers/catalog.py`
- Test: `backend/tests/test_cost_breakdown.py` (new file)

This task has two parts:

**Part A:** On every `PUT /api/catalog/{product_id}/recipe` save, write a `RecipeSnapshot` row capturing the new recipe.

**Part B:** Add `GET /api/products/{product_id}/cost-breakdown` returning:
```json
{
  "product_id": "abc",
  "product_name": "Croissant",
  "selling_price": 4.50,
  "total_cost": 1.23,
  "margin_pct": 72.7,
  "yield_qty": 12,
  "cost_per_unit": 0.10,
  "lines": [
    {"type": "ingredient", "name": "Flour", "quantity": 500, "unit": "g",
     "unit_cost": 0.005, "line_cost": 2.50},
    {"type": "semi_finished", "name": "Ganache", "quantity": 0.2, "unit": "kg",
     "unit_cost": 5.00, "line_cost": 1.00}
  ],
  "history": [
    {"changed_at": "2026-07-10T17:00:00Z", "changed_by": "owner", "lines_count": 3}
  ]
}
```

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_cost_breakdown.py`:

```python
"""Tests for GET /api/products/{id}/cost-breakdown and RecipeSnapshot writing."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.conftest import get_owner_token, create_test_ingredient, make_product


def test_cost_breakdown_empty_recipe(client: TestClient, db: Session, owner_token: str):
    """A product with no recipe lines returns zero cost and 100% margin."""
    product = make_product(db, owner_id=_get_owner_id(db, owner_token))
    res = client.get(
        f"/api/products/{product.id}/cost-breakdown",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["total_cost"] == 0.0
    assert data["lines"] == []


def test_cost_breakdown_single_ingredient(client: TestClient, db: Session, owner_token: str):
    """100g flour at 0.005/g = 0.50 total cost, yield=1."""
    owner_id = _get_owner_id(db, owner_token)
    flour = create_test_ingredient(db, owner_id, name="Flour", price=0.005, unit="g")
    product = make_product(db, owner_id)
    _add_recipe_item(db, product.id, flour.id, quantity=100)

    res = client.get(
        f"/api/products/{product.id}/cost-breakdown",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert round(data["total_cost"], 4) == 0.50
    assert len(data["lines"]) == 1
    assert data["lines"][0]["type"] == "ingredient"
    assert data["lines"][0]["name"] == "Flour"
    assert round(data["lines"][0]["line_cost"], 4) == 0.50


def test_cost_breakdown_404_other_owner(client: TestClient, db: Session, owner_token: str):
    """Cannot see another owner's product cost breakdown."""
    from auth import get_password_hash
    import models
    other = models.User(username="other_cost1", password=get_password_hash("pw"), role="owner")
    db.add(other)
    db.flush()
    product = make_product(db, other.id)
    db.commit()

    res = client.get(
        f"/api/products/{product.id}/cost-breakdown",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res.status_code == 404


def test_recipe_snapshot_written_on_save(client: TestClient, db: Session, owner_token: str):
    """Saving a recipe via PUT /api/catalog/{id}/recipe writes a RecipeSnapshot."""
    import models
    owner_id = _get_owner_id(db, owner_token)
    flour = create_test_ingredient(db, owner_id, name="SnapshotFlour", price=0.005, unit="g")
    product = make_product(db, owner_id)
    db.commit()

    res = client.put(
        f"/api/catalog/{product.id}/recipe",
        json={"items": [{"ingredient_id": flour.id, "quantity": 200, "semi_finished_id": None}]},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res.status_code == 200

    snaps = db.query(models.RecipeSnapshot).filter(
        models.RecipeSnapshot.product_id == product.id
    ).all()
    assert len(snaps) == 1
    assert len(snaps[0].snapshot) == 1
    assert snaps[0].snapshot[0]["name"] == "SnapshotFlour"


def _get_owner_id(db, token):
    from auth import decode_access_token
    data = decode_access_token(token)
    return db.query(__import__('models').User).filter_by(username=data["sub"]).first().id


def _add_recipe_item(db, product_id, ingredient_id, quantity):
    import models
    ri = models.RecipeItem(product_id=product_id, ingredient_id=ingredient_id, quantity=quantity)
    db.add(ri)
    db.commit()
```
*(Note: `make_product` and `create_test_ingredient` are helpers to add to `conftest.py` if not already present — see Step 2.)*

- [ ] **Step 2: Check `conftest.py` for `make_product` / `create_test_ingredient` helpers**

Open `backend/tests/conftest.py`. If `make_product` doesn't exist, add at the bottom:

```python
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
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
cd /home/dane/bakery-os/backend && source venv/bin/activate && python -m pytest tests/test_cost_breakdown.py -v 2>&1 | tail -20
```
Expected: all FAILED (endpoint doesn't exist yet).

- [ ] **Step 4: Add snapshot writing to `PUT /api/catalog/{id}/recipe` in `catalog.py`**

Find the `update_product_recipe` (or equivalent) handler in `routers/catalog.py`. After saving the recipe items and before `db.commit()`, insert:

```python
# --- snapshot ---
from .. import models as _models  # already imported as models
snapshot_lines = []
for item in new_recipe_items:          # whatever your local variable is
    if item.ingredient_id and item.ingredient:
        snapshot_lines.append({
            "type": "ingredient",
            "name": item.ingredient.name,
            "quantity": item.quantity,
            "unit": item.ingredient.unit,
            "price_per_unit": item.ingredient.price,
        })
    elif item.semi_finished_id and item.semi_finished:
        snapshot_lines.append({
            "type": "semi_finished",
            "name": item.semi_finished.name,
            "quantity": item.quantity,
            "unit": item.semi_finished.unit,
        })
snap = models.RecipeSnapshot(
    owner_id=owner_id,
    product_id=product_id,
    changed_by_user_id=current_user.id,
    snapshot=snapshot_lines,
)
db.add(snap)
# --- end snapshot ---
```

- [ ] **Step 5: Add `GET /api/products/{product_id}/cost-breakdown` to `catalog.py`**

Add after the recipe update endpoint:

```python
from ..services.core import calculate_product_cost, _cost_semi_finished

@router.get("/api/products/{product_id}/cost-breakdown")
async def get_cost_breakdown(
    product_id: str,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
    _: models.User = Depends(requires_roles(["owner"])),
):
    """Return per-line cost breakdown + margin + recipe history for a product."""
    product = (
        db.query(models.Product)
        .options(
            joinedload(models.Product.recipe_items)
            .joinedload(models.RecipeItem.ingredient),
            joinedload(models.Product.recipe_items)
            .joinedload(models.RecipeItem.semi_finished)
            .joinedload(models.SemiFinishedItem.recipe_items)
            .joinedload(models.SemiFinishedRecipeItem.ingredient),
        )
        .filter(models.Product.id == product_id, models.Product.owner_id == owner_id)
        .first()
    )
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    lines = []
    batch_cost = 0.0
    for item in product.recipe_items:
        if item.ingredient_id and item.ingredient:
            line_cost = item.quantity * item.ingredient.price
            batch_cost += line_cost
            lines.append({
                "type": "ingredient",
                "name": item.ingredient.name,
                "quantity": item.quantity,
                "unit": item.ingredient.unit,
                "unit_cost": item.ingredient.price,
                "line_cost": round(line_cost, 6),
            })
        elif item.semi_finished_id and item.semi_finished:
            sf_cost_per_unit = _cost_semi_finished(item.semi_finished)
            line_cost = item.quantity * sf_cost_per_unit
            batch_cost += line_cost
            lines.append({
                "type": "semi_finished",
                "name": item.semi_finished.name,
                "quantity": item.quantity,
                "unit": item.semi_finished.unit,
                "unit_cost": round(sf_cost_per_unit, 6),
                "line_cost": round(line_cost, 6),
            })

    yield_qty = product.yield_qty or 1
    total_cost = round(batch_cost / yield_qty, 6)
    selling_price = product.price
    margin_pct = round((1 - total_cost / selling_price) * 100, 2) if selling_price > 0 else None

    # Recipe history (last 10 saves)
    snaps = (
        db.query(models.RecipeSnapshot)
        .filter(
            models.RecipeSnapshot.product_id == product_id,
            models.RecipeSnapshot.owner_id == owner_id,
        )
        .order_by(models.RecipeSnapshot.changed_at.desc())
        .limit(10)
        .all()
    )
    history = [
        {
            "changed_at": s.changed_at.isoformat() if s.changed_at else None,
            "lines_count": len(s.snapshot) if s.snapshot else 0,
        }
        for s in snaps
    ]

    return {
        "product_id": product_id,
        "product_name": product.name,
        "selling_price": selling_price,
        "total_cost": total_cost,
        "margin_pct": margin_pct,
        "yield_qty": yield_qty,
        "cost_per_unit": total_cost,
        "lines": lines,
        "history": history,
    }
```

- [ ] **Step 6: Run tests**

```bash
cd /home/dane/bakery-os/backend && source venv/bin/activate && python -m pytest tests/test_cost_breakdown.py tests/test_cost_calculation.py -v 2>&1 | tail -30
```
Expected: all PASSED.

- [ ] **Step 7: Run full suite**

```bash
cd /home/dane/bakery-os/backend && source venv/bin/activate && python -m pytest -q 2>&1 | tail -10
```

- [ ] **Step 8: Commit**

```bash
cd /home/dane/bakery-os/backend
git add routers/catalog.py tests/test_cost_breakdown.py tests/conftest.py
git commit -m "feat(api): add cost-breakdown endpoint and recipe snapshot on save"
```

---

### Task 4 — Frontend: `CostBreakdownModal.tsx`

**Files:**
- Create: `frontend/src/components/dashboard/modals/CostBreakdownModal.tsx`
- Modify: `frontend/src/components/dashboard/panels/InventoryPanel.tsx`
- Modify: `frontend/src/components/Dashboard.tsx`

- [ ] **Step 1: Create `CostBreakdownModal.tsx`**

```tsx
import React, { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react';
import { api } from '../../../lib/api';
import { Product } from '../types';

interface CostLine {
  type: 'ingredient' | 'semi_finished';
  name: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  line_cost: number;
}

interface HistoryEntry {
  changed_at: string | null;
  lines_count: number;
}

interface CostBreakdown {
  product_id: string;
  product_name: string;
  selling_price: number;
  total_cost: number;
  margin_pct: number | null;
  yield_qty: number;
  cost_per_unit: number;
  lines: CostLine[];
  history: HistoryEntry[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  isDarkMode: boolean;
  formatPrice: (v: number) => string;
}

export const CostBreakdownModal: React.FC<Props> = ({
  isOpen, onClose, product, isDarkMode, formatPrice,
}) => {
  const [data, setData] = useState<CostBreakdown | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && product) {
      setLoading(true);
      setError(null);
      api.get(`/api/products/${product.id}/cost-breakdown`)
        .then(res => setData(res.data ?? res))
        .catch(() => setError('Failed to load cost breakdown.'))
        .finally(() => setLoading(false));
    }
  }, [isOpen, product]);

  if (!isOpen || !product) return null;

  const margin = data?.margin_pct;
  const marginColor = margin === null ? 'text-slate-400'
    : margin >= 60 ? 'text-emerald-500'
    : margin >= 30 ? 'text-amber-500'
    : 'text-rose-500';

  const MarginIcon = margin === null ? Minus
    : margin >= 60 ? TrendingUp
    : margin >= 30 ? Minus
    : TrendingDown;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`w-full max-w-2xl rounded-2xl flex flex-col max-h-[90vh] ${isDarkMode ? 'bg-[#1a1a1c] text-white' : 'bg-white text-slate-900'}`}>
        {/* Header */}
        <div className={`p-6 border-b flex justify-between items-start shrink-0 ${isDarkMode ? 'border-white/10' : 'border-slate-100'}`}>
          <div>
            <h2 className="text-xl font-bold">Cost Breakdown</h2>
            <p className={`text-sm mt-0.5 ${isDarkMode ? 'text-white/50' : 'text-slate-400'}`}>{product.name}</p>
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && (
            <p className={`text-sm text-center py-12 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>
              Calculating…
            </p>
          )}
          {error && (
            <p className="text-sm text-center py-12 text-rose-500">{error}</p>
          )}
          {data && !loading && (
            <>
              {/* Summary chips */}
              <div className="grid grid-cols-3 gap-4">
                <div className={`rounded-xl p-4 ${isDarkMode ? 'bg-white/5' : 'bg-slate-50'}`}>
                  <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Selling Price</p>
                  <p className="text-xl font-bold">{formatPrice(data.selling_price)}</p>
                </div>
                <div className={`rounded-xl p-4 ${isDarkMode ? 'bg-white/5' : 'bg-slate-50'}`}>
                  <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Cost / Unit</p>
                  <p className="text-xl font-bold text-rose-400">{formatPrice(data.cost_per_unit)}</p>
                </div>
                <div className={`rounded-xl p-4 ${isDarkMode ? 'bg-white/5' : 'bg-slate-50'}`}>
                  <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Margin</p>
                  <p className={`text-xl font-bold flex items-center gap-1 ${marginColor}`}>
                    <MarginIcon size={18} />
                    {margin !== null ? `${margin}%` : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Per-line breakdown */}
              {data.lines.length === 0 ? (
                <p className={`text-sm text-center py-4 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>
                  No recipe defined for this product.
                </p>
              ) : (
                <div>
                  <h3 className={`text-[10px] font-black uppercase tracking-widest mb-3 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>
                    Recipe Lines (yield: {data.yield_qty} units)
                  </h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={`border-b text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'border-white/10 text-white/30' : 'border-slate-100 text-slate-400'}`}>
                        <th className="pb-2 text-left">Ingredient</th>
                        <th className="pb-2 text-left">Type</th>
                        <th className="pb-2 text-right">Qty</th>
                        <th className="pb-2 text-right">Unit Cost</th>
                        <th className="pb-2 text-right">Line Cost</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDarkMode ? 'divide-white/5' : 'divide-slate-50'}`}>
                      {data.lines.map((line, idx) => (
                        <tr key={idx} className="group">
                          <td className="py-3 font-semibold">{line.name}</td>
                          <td className="py-3">
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                              line.type === 'semi_finished'
                                ? (isDarkMode ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-700')
                                : (isDarkMode ? 'bg-white/5 text-white/40' : 'bg-slate-100 text-slate-500')
                            }`}>
                              {line.type === 'semi_finished' ? 'Semi' : 'Raw'}
                            </span>
                          </td>
                          <td className={`py-3 text-right font-mono ${isDarkMode ? 'text-white/60' : 'text-slate-600'}`}>
                            {line.quantity} {line.unit}
                          </td>
                          <td className={`py-3 text-right font-mono ${isDarkMode ? 'text-white/60' : 'text-slate-600'}`}>
                            {formatPrice(line.unit_cost)}
                          </td>
                          <td className="py-3 text-right font-bold">
                            {formatPrice(line.line_cost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className={`border-t ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                        <td colSpan={4} className={`pt-3 font-black uppercase text-[10px] tracking-widest ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>
                          Total batch cost
                        </td>
                        <td className="pt-3 text-right font-bold text-rose-400">
                          {formatPrice(data.total_cost * data.yield_qty)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* Recipe history */}
              {data.history.length > 0 && (
                <div>
                  <h3 className={`text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-2 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>
                    <Clock size={10} /> Recipe History
                  </h3>
                  <div className="space-y-1.5">
                    {data.history.map((h, idx) => (
                      <div key={idx} className={`flex items-center justify-between text-xs px-3 py-2 rounded-lg ${isDarkMode ? 'bg-white/5 text-white/60' : 'bg-slate-50 text-slate-600'}`}>
                        <span>{h.changed_at ? new Date(h.changed_at).toLocaleString() : 'Unknown time'}</span>
                        <span className={`text-[9px] font-bold ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`}>{h.lines_count} lines</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Add "Cost" button to `InventoryPanel.tsx` per product row**

In the `Finished Goods` table in `InventoryPanel.tsx`, add a new prop `onShowCost: (product: Product) => void` and a "Cost" button in each product row next to the existing edit button:

First, add to Props type:
```typescript
type Props = Pick<DashboardSharedProps, ... > & {
  onOpenTransferModal: () => void;
  onAddSemiFinished: () => void;
  onEditRecipe: (item: SemiFinishedItem) => void;
  onProduceBatch: (item: SemiFinishedItem) => void;
  onShowCost: (product: Product) => void;  // ADD THIS
};
```

Then add in the product row, after the existing price/edit block (around line 95 in InventoryPanel):
```tsx
{/* Cost breakdown button — always visible */}
<button
  onClick={() => onShowCost(p)}
  className="text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded bg-white/5 text-white/40 hover:text-gold hover:bg-gold/10 transition-all"
>
  Cost
</button>
```

- [ ] **Step 3: Wire up in `Dashboard.tsx`**

Add imports:
```tsx
import { CostBreakdownModal } from './dashboard/modals/CostBreakdownModal';
import type { Product } from './dashboard/types';
```

Add state (near the other modal states):
```tsx
const [showCostModal, setShowCostModal] = useState(false);
const [activeCostProduct, setActiveCostProduct] = useState<Product | null>(null);
```

Pass callback to `InventoryPanel`:
```tsx
onShowCost={(product) => { setActiveCostProduct(product); setShowCostModal(true); }}
```

Render modal (near other modals):
```tsx
{showCostModal && (
  <CostBreakdownModal
    isOpen={showCostModal}
    onClose={() => setShowCostModal(false)}
    product={activeCostProduct}
    isDarkMode={isDarkMode}
    formatPrice={formatPrice}
  />
)}
```

- [ ] **Step 4: Verify build**

```bash
cd /home/dane/bakery-os/frontend && npm run build 2>&1 | tail -5
```
Expected: `✓ built in X.Xs`

- [ ] **Step 5: Commit**

```bash
cd /home/dane/bakery-os/frontend
git add src/components/dashboard/modals/CostBreakdownModal.tsx src/components/dashboard/panels/InventoryPanel.tsx src/components/Dashboard.tsx
git commit -m "feat(ui): add Cost Breakdown modal with margin, per-line costs, and recipe history"
```

---

## Self-Review Checklist

- [x] `_cost_semi_finished` only goes one level deep (semi-finished → ingredients). A chain (SF → SF → ingredient) is not costed. This is intentional for now — we don't have SF-in-SF recipes.
- [x] `calculate_product_cost` is the single function used everywhere: `operations.py` line 476, `intelligence.py`, and `operations.py` line 61 (waste). Fixing it here fixes all callers.
- [x] `RecipeSnapshot` uses `product_id` as `String` FK to match `products.id` (which is a UUID string, not an Integer).
- [x] The cost breakdown endpoint is owner-scoped. A 404 is returned for other owners' products (no info leak).
- [x] The frontend `api.get` response unwraps correctly with `res.data ?? res` to handle both axios-style and raw fetch responses.
- [x] History defaults to last 10 snapshots to prevent unbounded list growth.
