# Allergen Traceability and Unit Conversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement allergen tagging, organic labeling, and automatic purchase-to-base unit conversions to improve food safety, compliance, and stock intake accuracy.

**Architecture:** Extend the `Ingredient` model to store allergens, organic flags, purchase unit definitions, and conversion ratios. The backend will dynamically calculate allergens for `Product` endpoints by joining its recipe items. The inventory intake will auto-convert bulk purchase units to base units using the conversion ratio.

**Tech Stack:** FastAPI, SQLAlchemy, SQLite, React + TypeScript (Vite)

---

### Task 1: Update Database Models and Schemas for Allergens & Units

**Files:**
- Modify: [backend/models.py](file:///home/dane/bakery-os/backend/models.py)
- Modify: [backend/schemas.py](file:///home/dane/bakery-os/backend/schemas.py)
- Test: [backend/tests/test_inventory.py](file:///home/dane/bakery-os/backend/tests/test_inventory.py)

- [ ] **Step 1: Add new fields to models.py**
  Add the following columns to the `Ingredient` model in `backend/models.py`:
  ```python
  # Add around line 31
  allergens = Column(JSON, nullable=True) # e.g. ["gluten", "dairy"]
  is_organic = Column(Boolean, default=False)
  purchase_unit = Column(String, nullable=True) # e.g. "box_of_180" or "sack_25kg"
  purchase_to_base_ratio = Column(Float, default=1.0) # Multiply incoming by this ratio to get base unit qty
  ```

- [ ] **Step 2: Update schemas.py**
  Add these fields to the Pydantic models for raw materials/ingredients:
  - In `MaterialCreate`:
    ```python
    # Update MaterialCreate
    class MaterialCreate(BaseModel):
        name: str
        price: float
        unit: str
        min_threshold: float
        allergens: Optional[List[str]] = None
        is_organic: Optional[bool] = False
        purchase_unit: Optional[str] = None
        purchase_to_base_ratio: Optional[float] = 1.0
    ```

- [ ] **Step 3: Write tests for field storage**
  Create a test in `backend/tests/test_inventory.py` verifying that allergen and conversion info are stored and retrieved successfully.
  ```python
  def test_add_material_with_allergens_and_units(client, auth_headers):
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
  ```

- [ ] **Step 4: Run tests and ensure they pass**
  Run: `pytest backend/tests/test_inventory.py -v`
  Expected: PASS

---

### Task 2: Calculate Product Allergens Dynamically

**Files:**
- Modify: [backend/routers/catalog.py](file:///home/dane/bakery-os/backend/routers/catalog.py)
- Test: [backend/tests/test_produce.py](file:///home/dane/bakery-os/backend/tests/test_produce.py)

- [ ] **Step 1: Implement Dynamic Allergen Calculation**
  When products are retrieved, look up all their recipe ingredients to aggregate allergens and return them as an `allergens` list in the response.
  Modify the Product response serialization in `backend/routers/catalog.py` to merge ingredient allergens.
  ```python
  # Example logic to add when responding with products:
  # product_allergens = set()
  # for item in product.recipe_items:
  #     if item.ingredient.allergens:
  #         product_allergens.update(item.ingredient.allergens)
  ```

- [ ] **Step 2: Write test for Product Allergen aggregation**
  Write a test in `backend/tests/test_produce.py` ensuring that if Product A uses Ingredient B (with allergen "dairy"), Product A's API response returns `["dairy"]` in its allergens.

- [ ] **Step 3: Run tests**
  Run: `pytest backend/tests/test_produce.py -v`
  Expected: PASS

---

### Task 3: Handle Purchase Unit Conversion on Intake

**Files:**
- Modify: [backend/routers/purchasing.py](file:///home/dane/bakery-os/backend/routers/purchasing.py)
- Test: [backend/tests/test_inventory.py](file:///home/dane/bakery-os/backend/tests/test_inventory.py)

- [ ] **Step 1: Implement conversion logic during inventory receiving**
  In the API endpoint that receives items/materials (e.g. from purchase orders or manual stock additions), check if the incoming unit matches the `purchase_unit`. If it does, multiply the quantity by `purchase_to_base_ratio` before adding it to `stock` in base unit.

- [ ] **Step 2: Add validation test**
  Write a test that adds a purchase order or stock intake for 2 crates of milk (ratio 12.0) and verifies the stock of Milk increases by 24L.

- [ ] **Step 3: Run all backend tests**
  Run: `pytest -v`
  Expected: PASS

---

### Task 4: UI Support in Frontend

**Files:**
- Modify: [frontend/src/components/Dashboard.tsx](file:///home/dane/bakery-os/frontend/src/components/Dashboard.tsx)
- Modify: [frontend/src/components/dashboard/CatalogView.tsx](file:///home/dane/bakery-os/frontend/src/components/dashboard/CatalogView.tsx) (or equivalent sub-components)

- [ ] **Step 1: Display allergen badges on catalog items**
  Add visual indicators/badges for "Allergens" (e.g., Gluten, Dairy) and "Organic" status on cards/list items in the Product Catalog and Point of Sale interface.

- [ ] **Step 2: Unit conversion calculator in purchase form**
  In the ingredient stock intake form, show the option to switch between receiving in the "Base Unit" or the "Purchase Unit", showing a helper preview of the converted base stock addition.
