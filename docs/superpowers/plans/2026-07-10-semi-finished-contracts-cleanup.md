# Semi-Finished Backend Contracts & Tests Cleanup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace inline ad-hoc schemas in `routers/semi_finished.py` with proper Pydantic schemas in `schemas.py`, complete the missing REST endpoints, fix two safety bugs, and add 10 new tests — no model changes, no migration.

**Architecture:** All new schemas live in `backend/schemas.py` (mirroring `MaterialCreate` validation style). The router imports them. New endpoints follow the same owner-scoped pattern as the existing catalog router. Tests extend `tests/test_semi_finished.py` without modifying existing tests.

**Tech Stack:** FastAPI, Pydantic v2, SQLAlchemy, pytest (same stack as existing tests)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `backend/schemas.py` | Modify | Add 6 new schemas + refactor allergen sanitizer to shared helper |
| `backend/routers/semi_finished.py` | Modify | Delete inline schemas, import from schemas, add 5 new endpoints, fix idempotency bug |
| `backend/routers/operations.py` | Modify | Fix `StockTransfer` item_type validation; reject non-numeric semi_finished item_id with 400 |
| `backend/tests/test_semi_finished.py` | Modify | Add 10 new test functions |

---

## Task 1 — Shared allergen sanitizer helper + new schemas in `schemas.py`

> **Why first:** All downstream tasks import from schemas.py. Defining schemas before touching routers or tests ensures everything compiles.

**Files:**
- Modify: `backend/schemas.py`

- [ ] **Step 1.1: Add the shared `_sanitize_allergens` helper and refactor `MaterialCreate` to call it**

  Insert after the `clean_required_text` function (line ~36) and update `MaterialCreate.sanitize_allergens`.

  ```python
  # --- add this helper after clean_required_text ---
  def _sanitize_allergens(value: list[str] | None) -> list[str] | None:
      """Deduplicate, lowercase, and clean allergen strings.

      Preserves first-seen order. Strips control chars/HTML. Caps at 30 items, 40 chars each.
      Input ["Dairy","dairy","EGG"] -> ["dairy", "egg"].
      """
      if value is None:
          return None
      seen: dict[str, None] = {}
      for item in value[:30]:
          cleaned = clean_required_text(item, max_length=40)
          if cleaned:
              key = cleaned.lower()
              if key not in seen:
                  seen[key] = None
      return list(seen.keys()) if seen else None
  ```

  Then update `MaterialCreate.sanitize_allergens` to delegate:

  ```python
  @field_validator("allergens")
  @classmethod
  def sanitize_allergens(cls, value: list[str] | None) -> list[str] | None:
      return _sanitize_allergens(value)
  ```

- [ ] **Step 1.2: Add the six new semi-finished schemas at the bottom of `schemas.py`**

  Append after `CustomerUpdate`:

  ```python
  # ---------------------------------------------------------------------------
  # Semi-finished goods
  # ---------------------------------------------------------------------------

  class SemiFinishedItemCreate(BaseModel):
      """Create a new semi-finished item (e.g. Creme Patissiere, Ganache)."""
      name: str = Field(min_length=1, max_length=160)
      unit: str = Field(min_length=1, max_length=20)
      min_threshold: float = Field(default=0.0, ge=0, le=1_000_000_000)
      shelf_life_hours: Optional[int] = Field(default=None, ge=0, le=10_000)
      allergens: Optional[List[str]] = Field(default=None, max_length=30)

      @field_validator("name")
      @classmethod
      def sanitize_name(cls, value: str) -> str:
          return clean_required_text(value, max_length=160)

      @field_validator("unit")
      @classmethod
      def sanitize_unit(cls, value: str) -> str:
          return clean_required_text(value, max_length=20)

      @field_validator("allergens")
      @classmethod
      def sanitize_allergens(cls, value: list[str] | None) -> list[str] | None:
          return _sanitize_allergens(value)


  class SemiFinishedItemUpdate(BaseModel):
      """Partial update for a semi-finished item — all fields optional."""
      name: Optional[str] = Field(default=None, min_length=1, max_length=160)
      unit: Optional[str] = Field(default=None, min_length=1, max_length=20)
      min_threshold: Optional[float] = Field(default=None, ge=0, le=1_000_000_000)
      shelf_life_hours: Optional[int] = Field(default=None, ge=0, le=10_000)
      allergens: Optional[List[str]] = Field(default=None, max_length=30)
      is_active: Optional[bool] = None

      @field_validator("name")
      @classmethod
      def sanitize_name(cls, value: str | None) -> str | None:
          return clean_text(value, max_length=160) if value is not None else None

      @field_validator("unit")
      @classmethod
      def sanitize_unit(cls, value: str | None) -> str | None:
          return clean_text(value, max_length=20) if value is not None else None

      @field_validator("allergens")
      @classmethod
      def sanitize_allergens(cls, value: list[str] | None) -> list[str] | None:
          return _sanitize_allergens(value)


  class SemiFinishedRecipeItemCreate(BaseModel):
      """One ingredient line in a semi-finished recipe."""
      ingredient_id: int = Field(ge=1)
      quantity: float = Field(gt=0, le=1_000_000)


  class SemiFinishedRecipeUpdate(BaseModel):
      """Full-replace recipe for a semi-finished item (min 1, max 200 lines)."""
      items: List[SemiFinishedRecipeItemCreate] = Field(min_length=1, max_length=200)


  class SemiFinishedProduceRequest(BaseModel):
      """Request to produce a quantity of a semi-finished item.

      `quantity` is the output amount in the item's own unit (kg, L, units...).
      E.g. quantity=2 with unit="kg" produces 2 kg, consuming 2x the recipe.
      """
      semi_finished_id: int = Field(ge=1)
      quantity: float = Field(gt=0, le=100_000)
      client_mutation_id: Optional[str] = Field(default=None, max_length=120)

      @field_validator("client_mutation_id")
      @classmethod
      def sanitize_client_mutation_id(cls, value: str | None) -> str | None:
          return clean_text(value, max_length=120)


  class SemiFinishedItemResponse(BaseModel):
      """Public response shape — excludes internal fields (owner_id, cost)."""
      id: int
      name: str
      unit: str
      stock: float
      min_threshold: float
      shelf_life_hours: Optional[int]
      allergens: Optional[List[str]]
      is_active: bool
      created_at: Optional[str]  # ISO string for JSON compatibility

      model_config = {"from_attributes": True}


  class SemiFinishedRecipeLineResponse(BaseModel):
      ingredient_id: int
      ingredient_name: str
      quantity: float
      unit: str

      model_config = {"from_attributes": True}


  class SemiFinishedRecipeResponse(BaseModel):
      semi_finished_id: int
      items: List[SemiFinishedRecipeLineResponse]


  class StockTransferRequest(BaseModel):
      """Transfer stock between two locations."""
      item_type: Literal["ingredient", "product", "semi_finished"]
      item_id: str = Field(min_length=1, max_length=120)
      from_location_id: int = Field(ge=1)
      to_location_id: int = Field(ge=1)
      quantity: float = Field(gt=0, le=1_000_000_000)
      lot_id: Optional[int] = Field(default=None, ge=1)
      client_mutation_id: Optional[str] = Field(default=None, max_length=120)

      @field_validator("item_id")
      @classmethod
      def sanitize_item_id(cls, value: str) -> str:
          return clean_required_text(value, max_length=120)

      @field_validator("client_mutation_id")
      @classmethod
      def sanitize_client_mutation_id(cls, value: str | None) -> str | None:
          return clean_text(value, max_length=120)
  ```

- [ ] **Step 1.3: Run the import check**

  ```bash
  cd /home/dane/bakery-os/backend && source venv/bin/activate && python -c "
  from schemas import (
      SemiFinishedItemCreate, SemiFinishedItemUpdate,
      SemiFinishedRecipeUpdate, SemiFinishedProduceRequest,
      SemiFinishedItemResponse, SemiFinishedRecipeResponse,
      StockTransferRequest,
  )
  print('OK')
  "
  ```

  Expected: `OK` (no import errors).

- [ ] **Step 1.4: Verify allergen dedup behaviour**

  ```bash
  cd /home/dane/bakery-os/backend && source venv/bin/activate && python -c "
  from schemas import SemiFinishedItemCreate
  item = SemiFinishedItemCreate(name='Test', unit='kg', allergens=['Dairy', 'dairy', 'EGG'])
  assert item.allergens == ['dairy', 'egg'], f'Got: {item.allergens}'
  print('allergen dedup OK')
  "
  ```

  Expected: `allergen dedup OK`

- [ ] **Step 1.5: Commit**

  ```bash
  cd /home/dane/bakery-os/backend
  git add schemas.py
  git commit -m "feat(schemas): add semi-finished + StockTransferRequest schemas, shared allergen sanitizer"
  ```

---

## Task 2 — Rewrite `routers/semi_finished.py`

> Delete the two inline schemas, import from schemas, add `response_model`, add 5 missing endpoints, fix the idempotency bug.

**Files:**
- Modify: `backend/routers/semi_finished.py`

- [ ] **Step 2.1: Replace the imports and inline schema block (lines 1–42)**

  Replace the entire file header through the inline class definitions with:

  ```python
  """Routes for semi-finished goods: CRUD and production."""

  from datetime import datetime, timezone
  import uuid

  import sqlalchemy.orm
  from fastapi import APIRouter, Depends, HTTPException, Header
  from sqlalchemy.orm import joinedload

  try:
      from ..auth import get_current_user, get_effective_owner_id, requires_roles
      from ..database import get_db
      from .. import models
      from ..schemas import (
          SemiFinishedItemCreate,
          SemiFinishedItemUpdate,
          SemiFinishedItemResponse,
          SemiFinishedRecipeUpdate,
          SemiFinishedRecipeResponse,
          SemiFinishedRecipeLineResponse,
          SemiFinishedProduceRequest,
      )
      from ..services.stock import apply_stock_delta, find_movements_by_client_mutation
  except ImportError:
      from auth import get_current_user, get_effective_owner_id, requires_roles
      from database import get_db
      import models
      from schemas import (
          SemiFinishedItemCreate,
          SemiFinishedItemUpdate,
          SemiFinishedItemResponse,
          SemiFinishedRecipeUpdate,
          SemiFinishedRecipeResponse,
          SemiFinishedRecipeLineResponse,
          SemiFinishedProduceRequest,
      )
      from services.stock import apply_stock_delta, find_movements_by_client_mutation


  router = APIRouter()
  ```

- [ ] **Step 2.2: Add `_to_response` helper + `_get_owned_sf` + update list/create endpoints**

  Insert after `router = APIRouter()` and before the production section:

  ```python
  # ---------------------------------------------------------------------------
  # Internal helpers
  # ---------------------------------------------------------------------------

  def _to_response(item: models.SemiFinishedItem) -> SemiFinishedItemResponse:
      return SemiFinishedItemResponse(
          id=item.id,
          name=item.name,
          unit=item.unit,
          stock=item.stock,
          min_threshold=item.min_threshold,
          shelf_life_hours=item.shelf_life_hours,
          allergens=item.allergens,
          is_active=item.is_active,
          created_at=item.created_at.isoformat() if item.created_at else None,
      )


  def _get_owned_sf(db, owner_id: int, item_id: int) -> models.SemiFinishedItem:
      """Load a semi-finished item by id, scoped to owner. Raises 404 if missing."""
      item = db.query(models.SemiFinishedItem).filter(
          models.SemiFinishedItem.id == item_id,
          models.SemiFinishedItem.owner_id == owner_id,
      ).first()
      if not item:
          raise HTTPException(status_code=404, detail="Semi-finished item not found")
      return item


  # ---------------------------------------------------------------------------
  # CRUD
  # ---------------------------------------------------------------------------

  @router.get(
      "/api/semi-finished",
      response_model=list[SemiFinishedItemResponse],
      dependencies=[Depends(requires_roles(["owner"]))],
  )
  async def list_semi_finished(
      include_inactive: bool = False,
      db: sqlalchemy.orm.Session = Depends(get_db),
      owner_id: int = Depends(get_effective_owner_id),
  ):
      """Return semi-finished items for the owner. Pass ?include_inactive=true to include deactivated items."""
      q = db.query(models.SemiFinishedItem).filter(
          models.SemiFinishedItem.owner_id == owner_id,
      )
      if not include_inactive:
          q = q.filter(models.SemiFinishedItem.is_active == True)
      return [_to_response(i) for i in q.all()]


  @router.post(
      "/api/semi-finished",
      response_model=SemiFinishedItemResponse,
      dependencies=[Depends(requires_roles(["owner"]))],
  )
  async def create_semi_finished(
      body: SemiFinishedItemCreate,
      db: sqlalchemy.orm.Session = Depends(get_db),
      owner_id: int = Depends(get_effective_owner_id),
  ):
      """Create a new semi-finished item."""
      item = models.SemiFinishedItem(
          owner_id=owner_id,
          name=body.name,
          unit=body.unit,
          min_threshold=body.min_threshold,
          shelf_life_hours=body.shelf_life_hours,
          allergens=body.allergens,
      )
      db.add(item)
      db.commit()
      db.refresh(item)
      return _to_response(item)


  @router.get(
      "/api/semi-finished/{item_id}",
      response_model=SemiFinishedItemResponse,
      dependencies=[Depends(requires_roles(["owner"]))],
  )
  async def get_semi_finished(
      item_id: int,
      db: sqlalchemy.orm.Session = Depends(get_db),
      owner_id: int = Depends(get_effective_owner_id),
  ):
      """Return a single semi-finished item by id."""
      return _to_response(_get_owned_sf(db, owner_id, item_id))


  @router.put(
      "/api/semi-finished/{item_id}",
      response_model=SemiFinishedItemResponse,
      dependencies=[Depends(requires_roles(["owner"]))],
  )
  async def update_semi_finished(
      item_id: int,
      body: SemiFinishedItemUpdate,
      db: sqlalchemy.orm.Session = Depends(get_db),
      owner_id: int = Depends(get_effective_owner_id),
  ):
      """Partially update a semi-finished item. Only supplied fields are changed."""
      item = _get_owned_sf(db, owner_id, item_id)
      if body.name is not None:
          item.name = body.name
      if body.unit is not None:
          item.unit = body.unit
      if body.min_threshold is not None:
          item.min_threshold = body.min_threshold
      if body.shelf_life_hours is not None:
          item.shelf_life_hours = body.shelf_life_hours
      if body.allergens is not None:
          item.allergens = body.allergens
      if body.is_active is not None:
          item.is_active = body.is_active
      db.commit()
      db.refresh(item)
      return _to_response(item)


  @router.delete(
      "/api/semi-finished/{item_id}",
      status_code=204,
      dependencies=[Depends(requires_roles(["owner"]))],
  )
  async def delete_semi_finished(
      item_id: int,
      db: sqlalchemy.orm.Session = Depends(get_db),
      owner_id: int = Depends(get_effective_owner_id),
  ):
      """Soft-delete a semi-finished item (sets is_active=False). Preserves stock history."""
      item = _get_owned_sf(db, owner_id, item_id)
      item.is_active = False
      db.commit()


  @router.get(
      "/api/semi-finished/{item_id}/recipe",
      response_model=SemiFinishedRecipeResponse,
      dependencies=[Depends(requires_roles(["owner"]))],
  )
  async def get_semi_finished_recipe(
      item_id: int,
      db: sqlalchemy.orm.Session = Depends(get_db),
      owner_id: int = Depends(get_effective_owner_id),
  ):
      """Return the recipe (ingredient list) for a semi-finished item."""
      item = _get_owned_sf(db, owner_id, item_id)
      lines = []
      for ri in item.recipe_items:
          if ri.ingredient_id and ri.ingredient:
              lines.append(SemiFinishedRecipeLineResponse(
                  ingredient_id=ri.ingredient_id,
                  ingredient_name=ri.ingredient.name,
                  quantity=ri.quantity,
                  unit=ri.ingredient.unit,
              ))
      return SemiFinishedRecipeResponse(semi_finished_id=item_id, items=lines)


  @router.put(
      "/api/semi-finished/{item_id}/recipe",
      response_model=SemiFinishedRecipeResponse,
      dependencies=[Depends(requires_roles(["owner"]))],
  )
  async def update_semi_finished_recipe(
      item_id: int,
      body: SemiFinishedRecipeUpdate,
      db: sqlalchemy.orm.Session = Depends(get_db),
      owner_id: int = Depends(get_effective_owner_id),
  ):
      """Full-replace the recipe for a semi-finished item.

      All ingredient_ids must belong to the same owner.
      Returns the new recipe with ingredient names joined.
      """
      item = _get_owned_sf(db, owner_id, item_id)

      requested_ids = [line.ingredient_id for line in body.items]
      owned_ingredients = {
          ing.id: ing
          for ing in db.query(models.Ingredient).filter(
              models.Ingredient.id.in_(requested_ids),
              models.Ingredient.owner_id == owner_id,
          ).all()
      }
      for line in body.items:
          if line.ingredient_id not in owned_ingredients:
              raise HTTPException(
                  status_code=400,
                  detail=f"Ingredient {line.ingredient_id} not found or does not belong to this account",
              )

      # Full replace inside single transaction
      db.query(models.SemiFinishedRecipeItem).filter(
          models.SemiFinishedRecipeItem.semi_finished_id == item_id
      ).delete(synchronize_session=False)

      new_lines = []
      for line in body.items:
          ri = models.SemiFinishedRecipeItem(
              semi_finished_id=item_id,
              ingredient_id=line.ingredient_id,
              quantity=line.quantity,
          )
          db.add(ri)
          ing = owned_ingredients[line.ingredient_id]
          new_lines.append(SemiFinishedRecipeLineResponse(
              ingredient_id=line.ingredient_id,
              ingredient_name=ing.name,
              quantity=line.quantity,
              unit=ing.unit,
          ))

      db.commit()
      return SemiFinishedRecipeResponse(semi_finished_id=item_id, items=new_lines)
  ```

- [ ] **Step 2.3: Fix produce idempotency + update produce signature**

  In the `produce_semi_finished` endpoint, replace the idempotency block:

  ```python
  # BEFORE (lines ~104-112 in original):
  prior = find_movements_by_client_mutation(
      db,
      owner_id=owner_id,
      client_mutation_id=client_mutation_id,
      movement_type="semi_finished_output",
  )
  if prior:
      return {"success": True, "new_stock": prior[-1].after_qty, "idempotent": True}

  # AFTER (includes item_id check):
  if client_mutation_id:
      prior = find_movements_by_client_mutation(
          db,
          owner_id=owner_id,
          client_mutation_id=client_mutation_id,
          movement_type="semi_finished_output",
      )
      matching = [m for m in prior if m.item_id == str(batch.semi_finished_id)]
      if matching:
          return {"success": True, "new_stock": matching[-1].after_qty, "idempotent": True}
  ```

  Also update the produce endpoint signature — change `batch: SemiFinishedBatch` to `batch: SemiFinishedProduceRequest`.

- [ ] **Step 2.4: Run existing tests — must all still pass**

  ```bash
  cd /home/dane/bakery-os/backend && source venv/bin/activate && python -m pytest tests/test_semi_finished.py -v
  ```

  Expected: All 7 existing tests pass.

- [ ] **Step 2.5: Commit**

  ```bash
  git add routers/semi_finished.py
  git commit -m "feat(semi-finished): complete REST surface, response_model, fix idempotency key"
  ```

---

## Task 3 — Harden `StockTransfer` in `routers/operations.py`

**Files:**
- Modify: `backend/routers/operations.py`

- [ ] **Step 3.1: Add `StockTransferRequest` import**

  In the `try/except` import block near the top of `operations.py`, add:

  ```python
  # In the try block:
  from ..schemas import StockTransferRequest
  # In the except block:
  from schemas import StockTransferRequest
  ```

- [ ] **Step 3.2: Remove the inline `StockTransfer` class and update the endpoint**

  Delete the inline `class StockTransfer(BaseModel)` definition (lines ~190-197).

  Update the endpoint function signature:

  ```python
  # Change:
  async def transfer_stock(
      transfer: StockTransfer,
  # To:
  async def transfer_stock(
      transfer: StockTransferRequest,
  ```

- [ ] **Step 3.3: Replace the silent-ValueError `semi_finished` branch**

  ```python
  # BEFORE:
  elif transfer.item_type == "semi_finished":
      try:
          item = db.query(models.SemiFinishedItem).filter(
              models.SemiFinishedItem.id == int(transfer.item_id),
              models.SemiFinishedItem.owner_id == owner_id,
          ).first()
      except ValueError:
          pass

  # AFTER:
  elif transfer.item_type == "semi_finished":
      try:
          sf_id = int(transfer.item_id)
      except ValueError:
          raise HTTPException(
              status_code=400,
              detail="semi_finished item_id must be a numeric id (e.g. '3')",
          )
      item = db.query(models.SemiFinishedItem).filter(
          models.SemiFinishedItem.id == sf_id,
          models.SemiFinishedItem.owner_id == owner_id,
      ).first()
  ```

- [ ] **Step 3.4: Verify all tests still pass**

  ```bash
  cd /home/dane/bakery-os/backend && source venv/bin/activate && python -m pytest -q
  ```

  Expected: 67 passed, 0 failed (pre-new-tests baseline).

- [ ] **Step 3.5: Commit**

  ```bash
  git add routers/operations.py
  git commit -m "fix(operations): StockTransferRequest schema, reject non-numeric semi_finished item_id"
  ```

---

## Task 4 — New tests in `tests/test_semi_finished.py`

> Append all new functions after line 253. Do NOT modify existing tests.

**Files:**
- Modify: `backend/tests/test_semi_finished.py`

- [ ] **Step 4.1: Append the 10 new test functions**

  ```python
  # ---------------------------------------------------------------------------
  # New contract tests
  # ---------------------------------------------------------------------------

  def test_get_semi_finished_by_id_returns_owner_item(client, auth_headers, db, owner_token):
      """GET /api/semi-finished/{id} returns the item and excludes owner_id."""
      owner_id = _get_owner_id(db, owner_token)
      creme, _, _ = _setup_semi_finished_item(db, owner_id)

      resp = client.get(f"/api/semi-finished/{creme.id}", headers=auth_headers)
      assert resp.status_code == 200
      data = resp.json()
      assert data["id"] == creme.id
      assert data["name"] == "Creme Patissiere"
      assert "owner_id" not in data


  def test_get_semi_finished_by_id_404_other_owner(client, db, owner_token):
      """GET /api/semi-finished/{id} returns 404 for another tenant's item."""
      owner_id = _get_owner_id(db, owner_token)
      creme, _, _ = _setup_semi_finished_item(db, owner_id)

      from auth import create_access_token, get_password_hash
      other = models.User(
          username="other_owner_sf1",
          hashed_password=get_password_hash("pw"),
          role="owner",
      )
      db.add(other)
      db.commit()
      other_token = create_access_token({"sub": "other_owner_sf1"})
      other_headers = {"Authorization": f"Bearer {other_token}"}

      resp = client.get(f"/api/semi-finished/{creme.id}", headers=other_headers)
      assert resp.status_code == 404


  def test_update_semi_finished_patch_semantics(client, auth_headers, db, owner_token):
      """PUT /api/semi-finished/{id} only changes the supplied fields."""
      owner_id = _get_owner_id(db, owner_token)
      creme, _, _ = _setup_semi_finished_item(db, owner_id)

      resp = client.put(
          f"/api/semi-finished/{creme.id}",
          json={"name": "Creme Pat v2"},
          headers=auth_headers,
      )
      assert resp.status_code == 200
      data = resp.json()
      assert data["name"] == "Creme Pat v2"
      assert data["unit"] == "kg"                      # unchanged
      assert set(data["allergens"]) == {"dairy", "egg"}  # unchanged


  def test_update_semi_finished_replaces_allergens(client, auth_headers, db, owner_token):
      """PUT /api/semi-finished/{id} with allergens replaces the full list."""
      owner_id = _get_owner_id(db, owner_token)
      creme, _, _ = _setup_semi_finished_item(db, owner_id)

      resp = client.put(
          f"/api/semi-finished/{creme.id}",
          json={"allergens": ["dairy"]},
          headers=auth_headers,
      )
      assert resp.status_code == 200
      assert resp.json()["allergens"] == ["dairy"]


  def test_delete_semi_finished_is_soft_delete(client, auth_headers, db, owner_token):
      """DELETE /api/semi-finished/{id} sets is_active=False; row and history remain."""
      owner_id = _get_owner_id(db, owner_token)
      creme, _, _ = _setup_semi_finished_item(db, owner_id)

      resp = client.delete(f"/api/semi-finished/{creme.id}", headers=auth_headers)
      assert resp.status_code == 204

      # Row still in DB
      db.expire(creme)
      stored = db.query(models.SemiFinishedItem).get(creme.id)
      assert stored is not None
      assert stored.is_active is False

      # Active list no longer includes it
      list_resp = client.get("/api/semi-finished", headers=auth_headers)
      ids = [i["id"] for i in list_resp.json()]
      assert creme.id not in ids

      # But ?include_inactive=true shows it
      list_all = client.get("/api/semi-finished?include_inactive=true", headers=auth_headers)
      ids_all = [i["id"] for i in list_all.json()]
      assert creme.id in ids_all


  def test_get_semi_finished_recipe_returns_ingredient_names(client, auth_headers, db, owner_token):
      """GET /api/semi-finished/{id}/recipe returns lines with joined ingredient names."""
      owner_id = _get_owner_id(db, owner_token)
      creme, milk, eggs = _setup_semi_finished_item(db, owner_id)

      resp = client.get(f"/api/semi-finished/{creme.id}/recipe", headers=auth_headers)
      assert resp.status_code == 200
      data = resp.json()
      assert data["semi_finished_id"] == creme.id
      names = {item["ingredient_name"] for item in data["items"]}
      assert names == {"Milk", "Eggs"}


  def test_put_semi_finished_recipe_full_replace(client, auth_headers, db, owner_token):
      """PUT /api/semi-finished/{id}/recipe replaces the recipe; cross-tenant ingredient -> 400."""
      owner_id = _get_owner_id(db, owner_token)
      creme, milk, eggs = _setup_semi_finished_item(db, owner_id)

      # Full replace with only milk
      resp = client.put(
          f"/api/semi-finished/{creme.id}/recipe",
          json={"items": [{"ingredient_id": milk.id, "quantity": 500}]},
          headers=auth_headers,
      )
      assert resp.status_code == 200
      data = resp.json()
      assert len(data["items"]) == 1
      assert data["items"][0]["ingredient_id"] == milk.id

      # Cross-tenant ingredient_id -> 400
      from auth import get_password_hash
      other = models.User(
          username="other_owner_sf2",
          hashed_password=get_password_hash("pw"),
          role="owner",
      )
      db.add(other)
      db.flush()
      other_ing = models.Ingredient(
          name="OtherFlour", owner_id=other.id, stock=10, unit="kg", price=1.0
      )
      db.add(other_ing)
      db.commit()

      bad_resp = client.put(
          f"/api/semi-finished/{creme.id}/recipe",
          json={"items": [{"ingredient_id": other_ing.id, "quantity": 100}]},
          headers=auth_headers,
      )
      assert bad_resp.status_code == 400
      assert "not found" in bad_resp.json()["detail"].lower()


  def test_produce_idempotent_does_not_silently_succeed_for_different_item(
      client, auth_headers, db, owner_token
  ):
      """Same client_mutation_id for two different SF items must produce both, not silently skip second."""
      owner_id = _get_owner_id(db, owner_token)
      creme, milk, eggs = _setup_semi_finished_item(db, owner_id)

      butter = models.Ingredient(
          name="Butter_idem", owner_id=owner_id, stock=5.0, unit="kg", price=2.0
      )
      db.add(butter)
      db.flush()
      ganache = models.SemiFinishedItem(
          owner_id=owner_id, name="Ganache_idem", unit="kg", stock=0.0
      )
      db.add(ganache)
      db.flush()
      db.add(models.SemiFinishedRecipeItem(
          semi_finished_id=ganache.id, ingredient_id=butter.id, quantity=1000
      ))
      db.commit()

      mutation_id = "test-idem-sf-001"

      # Produce creme first
      r1 = client.post(
          "/api/semi-finished/produce",
          json={"semi_finished_id": creme.id, "quantity": 1, "client_mutation_id": mutation_id},
          headers=auth_headers,
      )
      assert r1.status_code == 200
      assert r1.json().get("idempotent") is None  # first call is real

      # Same mutation_id but for ganache — must NOT be treated as idempotent
      r2 = client.post(
          "/api/semi-finished/produce",
          json={"semi_finished_id": ganache.id, "quantity": 1, "client_mutation_id": mutation_id},
          headers=auth_headers,
      )
      assert r2.status_code == 200
      assert r2.json().get("idempotent") is None  # must have actually run

      db.expire(ganache)
      assert db.query(models.SemiFinishedItem).get(ganache.id).stock == 1.0


  def test_create_semi_finished_allergens_are_deduped_and_lowercased(
      client, auth_headers
  ):
      """POST /api/semi-finished deduplicates and lowercases allergens."""
      resp = client.post(
          "/api/semi-finished",
          json={"name": "Test Dedup Item", "unit": "kg", "allergens": ["Dairy", "dairy", "EGG"]},
          headers=auth_headers,
      )
      assert resp.status_code == 200
      allergens = resp.json()["allergens"]
      assert allergens == ["dairy", "egg"]  # deduped, lowercased, first-seen order


  def test_transfer_stock_rejects_non_numeric_semi_finished_item_id(
      client, auth_headers, db, owner_token
  ):
      """POST /api/stock-locations/transfer with item_type=semi_finished and slug item_id -> 400."""
      owner_id = _get_owner_id(db, owner_token)
      from services.locations import ensure_default_stock_locations
      ensure_default_stock_locations(db, owner_id)
      db.commit()

      locs = (
          db.query(models.StockLocation)
          .filter(models.StockLocation.owner_id == owner_id)
          .limit(2)
          .all()
      )
      if len(locs) < 2:
          import pytest
          pytest.skip("Need at least 2 locations")

      resp = client.post(
          "/api/stock-locations/transfer",
          json={
              "item_type": "semi_finished",
              "item_id": "creme-pat",  # non-numeric -> must 400
              "from_location_id": locs[0].id,
              "to_location_id": locs[1].id,
              "quantity": 1.0,
          },
          headers=auth_headers,
      )
      assert resp.status_code == 400
      assert "numeric" in resp.json()["detail"].lower()
  ```

- [ ] **Step 4.2: Run the full new test file**

  ```bash
  cd /home/dane/bakery-os/backend && source venv/bin/activate && python -m pytest tests/test_semi_finished.py -v
  ```

  Expected: All 17 tests pass (7 original + 10 new).

- [ ] **Step 4.3: Run the complete test suite**

  ```bash
  python -m pytest -q
  ```

  Expected: >= 77 passed, 0 failed.

- [ ] **Step 4.4: Commit**

  ```bash
  git add tests/test_semi_finished.py
  git commit -m "test(semi-finished): 10 new contract tests for endpoints, idempotency, transfer validation"
  ```

---

## Task 5 — Verification

- [ ] **Step 5.1: Full test suite**

  ```bash
  cd /home/dane/bakery-os/backend && source venv/bin/activate && python -m pytest -q 2>&1 | tail -5
  ```

  Expected: `X passed, 0 failed` (X >= 77).

- [ ] **Step 5.2: Frontend build untouched**

  ```bash
  cd /home/dane/bakery-os/frontend && npm run build 2>&1 | tail -5
  ```

  Expected: Build succeeds.

- [ ] **Step 5.3: Confirm no `owner_id` in semi-finished responses**

  ```bash
  cd /home/dane/bakery-os/backend && source venv/bin/activate && python -c "
  import routers.semi_finished as sf, inspect
  src = inspect.getsource(sf)
  assert 'response_model' in src, 'Missing response_model'
  print('response_model check OK')
  "
  ```

- [ ] **Step 5.4: Clean git log**

  ```bash
  cd /home/dane/bakery-os && git log --oneline -6
  ```

  Expected: 4 task commits visible, no whitespace errors.

---

## Out of scope (explicitly deferred)

- No new model columns (`description`, `yield_qty`, `prep_time`, `cook_time`, `instructions`)
- No migration scripts
- No allergen pre-aggregation in catalog's product response
- No frontend UI changes
- No writeable `cost` field via API (cost is server-computed; Phase 3)

---

## Self-Review Checklist

| Requirement | Covered by |
|---|---|
| Inline `SemiFinishedBatch`/`SemiFinishedItemCreate` deleted | Task 2.1 |
| Schemas in `schemas.py` with sanitizers | Task 1 |
| Allergen dedup + lowercase | Task 1.1 (`_sanitize_allergens`), test 4.9 |
| `response_model` on all SF endpoints | Tasks 2.2, 2.3 |
| `owner_id` excluded from response | `_to_response` helper in Task 2.2 |
| GET `/api/semi-finished/{id}` | Task 2.2, tests 4.1 + 4.2 |
| PUT `/api/semi-finished/{id}` (patch semantics) | Task 2.2, tests 4.3 + 4.4 |
| DELETE `/api/semi-finished/{id}` (soft) | Task 2.2, test 4.5 |
| GET `/api/semi-finished/{id}/recipe` | Task 2.2, test 4.6 |
| PUT `/api/semi-finished/{id}/recipe` (full replace, cross-tenant 400) | Task 2.2, test 4.7 |
| `?include_inactive=true` on list | Task 2.2, test 4.5 |
| Idempotency key includes `item_id` | Task 2.3, test 4.8 |
| `StockTransfer` -> `StockTransferRequest` with Literal item_type | Task 3 |
| Non-numeric semi_finished item_id -> 400 (not 404) | Task 3.3, test 4.10 |
