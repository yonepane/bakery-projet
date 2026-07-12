# Phase 4 — Kitchen Execution Stages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve the bakery from simple point-in-time "produce" clicks to a real-world kitchen workflow (Kanban). Replace the basic `Planner` status string with a structured, multi-stage `ProductionBatch` pipeline where ingredients are consumed when prep begins, but finished goods aren't available for sale until baking is complete.

**Architecture:**
- Introduce a real `ProductionBatch` model to supersede the old `Planner` model. It tracks the precise stage of production: `planned` → `prepping` → `proofing` → `baking` → `ready`.
- Move stock deduction from a single `produce` endpoint to the state transitions:
  - `planned` → `prepping`: Deduct raw ingredients/semi-finished goods from stock (they are committed to the bowl).
  - `baking` → `ready`: Add the finished product to sellable stock.
- Frontend: Add a "Kitchen Board" (Kanban view) to the Dashboard. Columns represent the stages. Cards represent batches. Staff can drag or click buttons to advance batches through the kitchen.

---

### Task 1 — Backend: `ProductionBatch` Model & Migrations

**Files:**
- Modify: `backend/models.py`
- Create: `backend/alembic/versions/00010_kitchen_execution_stages_20260710.py`

- [ ] **Step 1: Create `ProductionBatch` Model**
Append to `models.py`:
```python
class ProductionBatch(Base):
    """Tracks a specific production run through kitchen stages."""
    __tablename__ = "production_batches"

    id = Column(String, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)
    product_id = Column(String, ForeignKey("products.id"), index=True)
    quantity = Column(Float)
    
    # Workflow stage: planned, prepping, proofing, baking, ready, cancelled
    stage = Column(String, default="planned", index=True)
    
    # Timestamps for analytics
    planned_for_date = Column(String, index=True) # YYYY-MM-DD
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    notes = Column(String, nullable=True)

    product = relationship("Product")
```
*(Note: We will eventually deprecate the old `Planner` table, but we leave it for now to avoid breaking existing frontend code until the board is ready).*

- [ ] **Step 2: Create Alembic Migration**
Create `00010_kitchen_execution_stages_20260710.py`. Make sure `down_revision` points to `00009`. Create the `production_batches` table with all columns and indices.

- [ ] **Step 3: Run Migration**
Run `alembic upgrade head`. Verify the table exists.

- [ ] **Step 4: Commit**
`feat(models): add ProductionBatch model for kitchen workflow stages`

---

### Task 2 — Backend: Kitchen Board API endpoints

**Files:**
- Modify/Create: `backend/routers/kitchen.py` (New router dedicated to kitchen operations)
- Modify: `backend/main.py` (Include new router)

- [ ] **Step 1: Create `backend/routers/kitchen.py`**
Implement the following routes:
- `GET /api/kitchen/batches`: Returns all active batches (not cancelled, not ready longer than 24 hours).
- `POST /api/kitchen/batches`: Creates a new batch in `planned` state.
- `PUT /api/kitchen/batches/{batch_id}/stage`: Advances a batch to a new stage.
  - **CRITICAL LOGIC:** 
  - If transitioning from `planned` → `prepping`: This is when we **deduct** ingredient stock (call a shared stock helper or implement the deduction logic here).
  - If transitioning to `ready`: This is when we **add** finished product stock (call a shared stock helper or implement the addition logic here).
  - Record `started_at` when entering `prepping`. Record `completed_at` when entering `ready`.

- [ ] **Step 2: Hook up in `main.py`**
`app.include_router(kitchen.router)`

- [ ] **Step 3: Write Tests**
Create `backend/tests/test_kitchen_workflow.py` to ensure that advancing a batch to `prepping` deducts stock, and advancing to `ready` adds stock.

- [ ] **Step 4: Commit**
`feat(api): add kitchen workflow endpoints and stock deduction logic`

---

### Task 3 — Frontend: The Kitchen Board UI

**Files:**
- Create: `frontend/src/components/dashboard/panels/KitchenBoardPanel.tsx`
- Modify: `frontend/src/components/Dashboard.tsx`
- Modify: `frontend/src/components/dashboard/hooks/useKitchenMutations.ts` (New hook)

- [ ] **Step 1: Data fetching & Hooks**
Create `useKitchenMutations.ts` with functions to fetch active batches and advance their stage. Add `kitchenBatches` to the shared data context in `Dashboard.tsx`.

- [ ] **Step 2: Create `KitchenBoardPanel.tsx`**
A visual Kanban board.
Columns: **To Do (Planned)** | **Prep & Mix** | **Proofing** | **Baking** | **Ready (Done)**
Render batch cards in each column based on their `stage`. Provide a button on each card (e.g. "Start Prep", "Move to Proof", "Load Oven", "Finish") that calls the advance endpoint.

- [ ] **Step 3: Wire into Dashboard**
Add a new tab for "Kitchen" alongside "Inventory", "POS", etc. Render `KitchenBoardPanel` when active.

- [ ] **Step 4: Commit**
`feat(ui): add visual Kanban Kitchen Board for stage-based production`
