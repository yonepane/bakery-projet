# BakeryOS Phase 0 Safety Check

> Product architecture guardrail for expanding BakeryOS toward the pastry ERP roadmap without breaking current stock, money, auth, or offline behavior.

## Goal

Prepare the codebase for pastry-specific ERP expansion by identifying current high-risk flows and defining the first safe implementation path.

This is the bridge between the Obsidian note `10 - Pastry ERP Master Plan` and code changes in `/home/dane/bakery-os`.

## Current Stack Observed

- Backend: FastAPI, SQLAlchemy, Pydantic, SQLite by default.
- Frontend: React, TypeScript, Vite, Dexie offline cache, Axios.
- Auth: JWT access tokens, refresh tokens, owner/cashier roles, effective owner filtering.
- Tenancy model: records are filtered by `owner_id`; cashier accounts point to owner through `parent_owner_id`.

## Current Safety Status

Status: Stock ledger foundation and owner-facing stock movement history are implemented.

Reasons:

- Stock still keeps operational balances on `ingredients.stock` and `products.stock`, but all covered mutation routes now write append-only movement rows through the stock service.
- A central stock movement ledger now exists for current stock-changing flows.
- Money events are stored mainly through `transactions`, `expenses`, and purchase-order JSON.
- Offline queued mutations now carry and replay idempotency keys for covered mutation routes.
- The current `pytest` suite now completes after replacing `TestClient` with an `httpx.ASGITransport`-based test client and making auth role dependencies async.

## Backend Verification Attempt

Commands tried:

```bash
cd /home/dane/bakery-os/backend
python -m pytest -v
./venv/bin/python -m pytest -v
/home/dane/bakery-os/.venv/bin/python -m pytest -v
```

Results:

- System Python: `No module named pytest`.
- Backend `venv`: `No module named pytest`.
- Root `.venv`: collected 21 tests, then hung on `tests/test_auth.py::test_signup_creates_user`.
- A minimal FastAPI `TestClient` request also hung, which points to a test-environment/framework compatibility issue rather than a single BakeryOS route.
- `httpx.AsyncClient` with `ASGITransport` worked for the app.
- Authenticated routes initially hung because sync dependencies wrapped the async `get_current_user` dependency.
- Converting `get_effective_owner_id` and `requires_roles` role checker to async removed the threadpool boundary and fixed authenticated route execution.
- Final backend test result: 21 passed.

Completed before risky backend edits:

- Replaced the `TestClient` fixture with an `ASGITransport`-based sync wrapper.
- Confirmed all existing tests complete.

Still required before stock-ledger migration:

- Add targeted tests for stock and money mutation behavior before introducing ledger behavior.

## Stock Mutation Map

## Production

File: `backend/routers/pos.py`

Route: `POST /api/produce`

Current behavior:

- Reads product recipe items.
- Checks ingredient availability.
- Decrements `Ingredient.stock`.
- Increments `Product.stock`.
- Creates `Transaction(type="production")`.

Risk:

- No stock movement rows.
- No lot, location, expiry, or FEFO support.
- No idempotency key for offline retries.

## POS Sale

File: `backend/routers/pos.py`

Route: `POST /api/complete`

Current behavior:

- Checks product stock.
- Decrements `Product.stock`.
- Creates `Transaction(type="sale")`.
- Awards customer loyalty points.

Risk:

- No stock movement rows.
- No idempotency key.
- A duplicated offline replay could deduct stock and create revenue twice.

## Refund

File: `backend/routers/pos.py`

Route: `POST /api/transactions/{id}/refund`

Current behavior:

- Restores product stock from transaction item snapshot.
- Deducts loyalty points.
- Marks transaction as refunded.

Risk:

- No reversal movement rows.
- Only sale transactions can be refunded, which is good.
- Already-refunded guard exists, which reduces double-refund risk.

## Waste

File: `backend/routers/operations.py`

Route: `POST /api/waste`

Current behavior:

- Checks product stock.
- Decrements `Product.stock`.
- Creates `WasteRecord`.

Risk:

- Waste reason is not captured.
- No movement row.
- No location, lot, or expiry context.

## Manual Stock Adjustment

File: `backend/routers/catalog.py`

Route: `POST /api/inventory/adjust`

Current behavior:

- Adjusts either product stock or ingredient stock.
- Floors final stock at zero.
- Accepts a reason field.

Risk:

- Reason is not persisted anywhere.
- No movement row.
- Flooring can hide a larger negative adjustment than available stock.

## Purchase Receiving

File: `backend/routers/purchasing.py`

Routes:

- `POST /api/purchase-orders/{id}/receive`
- `PATCH /api/purchase-orders/{id}/status`

Current behavior:

- Adds received quantities to ingredient stock.
- Uses `purchase_to_base_ratio` on explicit receiving route.
- Updates ingredient price and last purchase price.
- Updates purchase order status.

Risk:

- No supplier lot or expiry.
- No receiving movement row.
- `PATCH status=received` adds raw `delta` without the purchase-unit conversion used by the explicit receive endpoint.

## Money Mutation Map

## Sales Revenue and COGS

File: `backend/routers/pos.py`

Route: `POST /api/complete`

Current behavior:

- Creates transaction with `total_revenue`, `total_cost`, and item snapshot.

Risk:

- No separate immutable financial event ledger.
- Refund marks transaction refunded but does not create a separate reversal event.

## Production Cost

File: `backend/routers/pos.py`

Route: `POST /api/produce`

Current behavior:

- Creates production transaction with `total_cost`.

Risk:

- Cost calculation depends on current ingredient price.
- No explicit recipe-cost snapshot table.

## Expenses

File: `backend/routers/finance.py`

Routes:

- `POST /api/expenses`
- `PUT /api/expenses/{expense_id}`
- `DELETE /api/expenses/{expense_id}`

Current behavior:

- Stores expense rows and payment rows.
- Owner-only.

Risk:

- Expense deletion removes financial history.
- No audit event for edits/deletes.

## Purchase Orders

File: `backend/routers/purchasing.py`

Current behavior:

- Stores purchase-order item costs in JSON.
- Receiving updates ingredient stock and price.

Risk:

- No invoice matching table.
- No committed cost event.

## Auth and Tenant Safety Observed

Positive:

- Most owner-only mutations use `requires_roles(["owner"])`.
- Query filtering usually includes `owner_id == owner_id`.
- Cashier data access is routed through effective owner ID.
- Query-token use has been tightened for download URLs.
- Generated HTML receipt/prep-sheet paths now escape stored text in the dirty worktree.

Risks to address:

- `POST /api/complete` has no explicit role dependency; it relies on authentication through `owner_id = Depends(get_effective_owner_id)`. This allows cashier access by design, but should be documented and tested.
- Refund and transaction delete routes currently have no explicit role dependency. They are authenticated through `owner_id`, but refund/delete permissions should be explicit.
- `GET /api/inventory` intentionally has no role guard, but this should remain read-only and tested for tenant isolation.
- Cashier/kitchen roles need stronger modeling before exposing kitchen workflows.

## Offline Sync Risks

Files:

- `frontend/src/lib/api.ts`
- `frontend/src/lib/db.ts`

Current behavior:

- GET responses are cached in Dexie.
- Offline POST/PUT/PATCH/DELETE operations are queued.
- Queue replays in timestamp order.
- Replay stops on first failure.

Risk:

- Queued mutations have no idempotency key.
- Backend routes do not accept or persist client mutation IDs.
- POS sale, production, receiving, waste, refund, and adjustment could be duplicated if the frontend retries after an uncertain network failure.

Required before offline-safe stock ledger:

- Add `client_mutation_id` support to risky mutation schemas.
- Add a backend idempotency table or unique field on movement/transaction records.
- Return the existing result when the same mutation is replayed.

## First Safe Implementation Sequence

## Step 1 - Fix Test Harness

Priority: Critical

Status: Completed

- Replaced `TestClient` with an `httpx.ASGITransport`-based sync test wrapper.
- Kept in-memory SQLite isolation.
- Changed auth dependencies to async to avoid authenticated-route deadlocks.
- Existing 21 tests now complete reliably.

Exit criteria:

- `pytest -v` completes.
- Auth, inventory, produce, purchasing, and duplication tests pass.

## Step 2 - Add Stock Movement Model Without Changing Behavior

Priority: Critical

Status: First slice completed

Add table:

- `stock_movements`

Fields:

- `id`
- `owner_id`
- `item_type`: `ingredient` or `product`
- `item_id`
- `item_name_snapshot`
- `quantity_delta`
- `unit_snapshot`
- `movement_type`
- `source_type`
- `source_id`
- `reason`
- `before_qty`
- `after_qty`
- `created_at`
- `created_by_user_id`
- `client_mutation_id`

Important:

- This should be additive only.
- Do not remove existing stock columns yet.
- Existing stock columns remain in place.
- Manual stock adjustment now writes movement rows.
- Waste recording now writes movement rows.
- Purchase receiving now writes movement rows.
- Production now writes ingredient input and finished product output movement rows.
- POS sale now writes movement rows.
- Refund now writes movement rows.

## Step 3 - Add Movement Service

Priority: Critical

Status: First slice completed

Create one backend helper responsible for stock changes:

- Validate item belongs to owner.
- Validate stock cannot go negative unless explicitly allowed.
- Update stock column.
- Write stock movement row.
- Support idempotency for `client_mutation_id`.

Current implementation:

- `backend/services/stock.py` provides `apply_stock_delta`.
- Manual stock adjustment uses the service.
- Waste recording uses the service.
- Purchase receiving uses the service.
- Production uses the service for ingredient consumption and product output.
- POS sale uses the service for finished product stock deductions.
- Refund uses the service for finished product stock restoration.
- Negative stock is rejected instead of silently floored to zero.
- `client_mutation_id` is stored on the movement model, but route-level idempotency is not implemented yet.

Initial movement types:

- `production_input`
- `production_output`
- `sale`
- `refund`
- `waste`
- `adjustment`
- `purchase_receive`

## Step 4 - Migrate One Route at a Time

Priority: Critical

Recommended order:

1. Manual stock adjustment.
2. Waste.
3. Purchase receiving.
4. Production.
5. POS sale.
6. Refund.

Reason:

Adjustment and waste are simpler, while POS and production combine stock, cost, customer, and transaction behavior.

Current status:

- Manual stock adjustment is migrated.
- Waste is migrated.
- Purchase receiving is migrated.
- Production is migrated.
- POS sale is migrated.
- Refund is migrated.
- Next recommended backend step: idempotency for offline queued stock mutations.

## Verification After First Stock-Ledger Slice

Command:

```bash
cd /home/dane/bakery-os/backend
/home/dane/bakery-os/.venv/bin/python -m pytest -v
```

Result:

- 24 passed.
- Added tests for material adjustment movement, product adjustment movement, and negative-stock rejection.

## Verification After Waste Stock-Ledger Slice

Command:

```bash
cd /home/dane/bakery-os/backend
/home/dane/bakery-os/.venv/bin/python -m pytest -v
```

Result:

- 26 passed.
- Added tests for waste movement creation and insufficient-stock behavior.

## Verification After Purchase Receiving Stock-Ledger Slice

Command:

```bash
cd /home/dane/bakery-os/backend
/home/dane/bakery-os/.venv/bin/python -m pytest -v
```

Result:

- 27 passed.
- Explicit PO receiving writes ingredient movement rows.
- Marking a PO as received writes ingredient movement rows.
- Status-based receiving now respects `purchase_to_base_ratio`, matching explicit receiving behavior.

## Verification After Production Stock-Ledger Slice

Command:

```bash
cd /home/dane/bakery-os/backend
/home/dane/bakery-os/.venv/bin/python -m pytest -v
```

Result:

- 28 passed.
- Production writes `production_input` movements for consumed ingredients.
- Production writes `production_output` movements for finished product stock.
- Failed production does not create transactions or stock movement rows.

## Verification After POS Sale Stock-Ledger Slice

Command:

```bash
cd /home/dane/bakery-os/backend
/home/dane/bakery-os/.venv/bin/python -m pytest -v
```

Result:

- 30 passed.
- POS sale writes `sale` movements for finished product stock deductions.
- Failed sale due to insufficient stock does not create transactions or stock movement rows.

## Verification After Refund Stock-Ledger Slice

Command:

```bash
cd /home/dane/bakery-os/backend
/home/dane/bakery-os/.venv/bin/python -m pytest -v
```

Result:

- 32 passed.
- Refund writes `refund` movements for restored finished product stock.
- Double refund is blocked and does not create a second refund movement row.

## Current Stock-Ledger Coverage

Covered:

- Manual stock adjustment.
- Waste.
- Purchase receiving.
- Production ingredient consumption.
- Production finished product output.
- POS sale.
- Refund.

Remaining risk:

- Offline queued stock mutations now carry and replay `client_mutation_id`.
- Lot, expiry, FEFO, locations, and semi-finished goods are not implemented yet.

## Verification After Offline Idempotency Slice

Command:

```bash
cd /home/dane/bakery-os/backend
/home/dane/bakery-os/.venv/bin/python -m pytest -v
```

Result:

- 38 passed.
- Manual adjustment, waste, production, purchase receiving, POS sale, and refund reject duplicate stock effects when replayed with the same mutation ID.
- Refund idempotency works through the `X-Client-Mutation-Id` header for routes without request-body schemas.

Frontend verification:

```bash
cd /home/dane/bakery-os
npm --prefix frontend run build
```

Result:

- Build passed.
- Mutating API calls now attach a `client_mutation_id` to request bodies and `X-Client-Mutation-Id` headers.
- Offline queued mutations preserve the same mutation ID during replay.

## Next Recommended Step

Add owner-only UI access to the read-only stock movement history before adding lots/locations.

Reason:

- The backend now writes and exposes an audit ledger, but owners cannot inspect it from the app UI yet.
- A read-only audit screen is lower risk than changing more stock semantics.
- It gives immediate operational value before moving into lot, expiry, FEFO, and semi-finished goods.

## Verification After Stock Movement History API Slice

Command:

```bash
cd /home/dane/bakery-os/backend
/home/dane/bakery-os/.venv/bin/python -m pytest -v
```

Result:

- 41 passed.
- Added owner-only `GET /api/stock-movements`.
- Movement history is tenant-filtered by `owner_id`.
- Cashier users cannot read the stock movement ledger.

## Verification After Stock Movement History UI Slice

Commands:

```bash
cd /home/dane/bakery-os
npm --prefix frontend run build

cd /home/dane/bakery-os/backend
/home/dane/bakery-os/.venv/bin/python -m pytest -v
```

Result:

- Frontend build passed.
- Backend suite passed: 41 passed, 9 warnings.
- Added owner-only Stock Ledger navigation under Operations.
- Added lazy-loaded `StockMovementsPanel`.
- Added tab-aware `/stock-movements` fetching through `useBakeryData`.
- Added search, item-type filter, movement-type filter, inbound/outbound KPIs, and a read-only movement table.

## Step 5 - Audit Screens

Priority: Important

Status: First slice completed

- Stock Movements screen is implemented as a read-only owner audit screen.
- Adjustment, purchase receiving, and waste records are visible through movement types and source fields.
- Dedicated reports for adjustment history, purchase receiving history, and waste reason analysis can be added later if the owner needs deeper filtering/export.

## Do Not Build Yet

Do not start these until the stock truth layer is stable:

- Semi-finished goods.
- Recipe versions.
- Production stages.
- Custom cake builder.
- FEFO picking.
- Branch transfers.
- Forecasting upgrades.

## Immediate Recommendation

Next code task:

Design the next stock truth layer before changing behavior:

- Stock locations / warehouses.
- Lots and expiration dates.
- FEFO picking rules.
- Semi-finished goods.

Reason:

The current ledger is now visible and idempotent for covered routes. The next risk is data modeling: locations, lots, and semi-finished goods will affect recipes, production, purchasing, inventory counts, and POS availability.

Design artifact:

- `docs/superpowers/specs/2026-07-06-stock-locations-lots-fefo-design.md`

Recommended implementation slice:

1. Add `StockLocation`, `StockLot`, and `StockLotBalance` as additive tables.
2. Add Alembic and bootstrap schema support.
3. Add owner/tenant isolation tests and default-location tests.
4. Do not change purchase receiving, production, POS, or waste behavior in this first slice.

## Verification After Stock Location and Lot Schema Slice

Command:

```bash
cd /home/dane/bakery-os/backend
/home/dane/bakery-os/.venv/bin/python -m pytest -v
```

Result:

- 45 passed, 9 warnings.
- Added additive `StockLocation`, `StockLot`, and `StockLotBalance` models.
- Added Alembic migration `00006_add_stock_locations_lots_20260706.py`.
- Added runtime bootstrap table/index creation for local/dev databases.
- Added `ensure_default_stock_locations` service with per-owner default locations:
  - Main Warehouse
  - Kitchen
  - Fridge
  - Freezer
  - Display Counter
  - Quarantine
- Added tests for default location creation, tenant isolation, and lot-balance non-negative constraints.
- Existing stock-changing route behavior remains unchanged in this slice.

Next implementation slice:

Extend `apply_stock_delta` with optional location/lot parameters while preserving legacy behavior when those parameters are absent.

## Verification After Stock Service Lot/Location Context Slice

Commands:

```bash
cd /home/dane/bakery-os/backend
/home/dane/bakery-os/.venv/bin/python -m pytest tests/test_stock_locations_lots.py -vv
/home/dane/bakery-os/.venv/bin/python -m pytest -v

cd /home/dane/bakery-os
npm --prefix frontend run build
```

Result:

- Targeted stock location/lot tests passed: 7 passed.
- Full backend suite passed: 48 passed, 9 warnings.
- Frontend build passed.
- `apply_stock_delta` now accepts optional `location_id`, `lot_id`, `expires_at`, `unit_cost`, and `correlation_id`.
- Legacy stock-service calls still update the legacy item balance and movement row without creating lot balances.
- Explicit lot/location stock-service calls update the legacy balance, the lot balance, and the movement context in one path.
- Lot/location shortages are rejected before mutating the legacy item balance or writing a movement row.
- `GET /api/stock-movements` now includes optional lot/location context fields.
- Stock Ledger UI displays lot code and location when movement context exists.

Alembic note:

- A fresh `alembic upgrade head` check is currently blocked by the pre-existing `00001_initial_schema_b8c6f0974e0a.py`, which tries to drop old SQLite indexes/tables before they exist.
- The new service behavior is verified through SQLAlchemy model creation in tests.
- The older Alembic base should be repaired or replaced before relying on fresh migration-chain validation.

Next implementation slice:

Migrate purchase receiving to optionally create ingredient lots and lot balances when receiving payloads include lot, expiry, and location fields. Keep the old receiving payload behavior unchanged.

## Verification After Purchase Receiving Lot Context Slice

Commands:

```bash
cd /home/dane/bakery-os/backend
/home/dane/bakery-os/.venv/bin/python -m pytest tests/test_purchasing.py -vv
/home/dane/bakery-os/.venv/bin/python -m pytest -v

cd /home/dane/bakery-os
npm --prefix frontend run build
```

Result:

- Targeted purchasing tests passed: 7 passed.
- Full backend suite passed: 51 passed, 5 warnings.
- Frontend build passed.
- `POReceiveItem` now accepts optional `lot_code`, `supplier_lot_code`, `expires_at`, and `location_id`.
- Existing receive payloads still update legacy ingredient stock and stock movements without creating lot balances.
- Receive payloads with lot context create `StockLot`, default to Main Warehouse when no location is supplied, update `StockLotBalance`, and write movement lot/location context.
- Purchase receiving lot context is idempotent through `client_mutation_id`.
- Supplier creation now uses Pydantic `model_dump()` instead of deprecated `.dict()`.

Next implementation slice:

Add owner-facing location and lot read APIs so the UI can choose receiving locations and inspect expiring lot balances before FEFO production migration.

## Verification After Stock Location and Lot Balance Read API Slice

Commands:

```bash
cd /home/dane/bakery-os/backend
/home/dane/bakery-os/.venv/bin/python -m pytest tests/test_stock_locations_lots.py -vv
/home/dane/bakery-os/.venv/bin/python -m pytest -v

cd /home/dane/bakery-os
npm --prefix frontend run build
```

Result:

- Targeted stock location/lot tests passed: 12 passed.
- Full backend suite passed: 56 passed, 5 warnings.
- Frontend build passed.
- Added owner-only `GET /api/stock-locations`.
- Added owner-only `GET /api/stock-lot-balances`.
- Stock location reads create missing per-owner defaults and preserve operational default order.
- Lot balance reads return location, lot, available quantity, expiry, source, status, and cost context.
- Lot balance reads support `item_type`, `item_id`, `location_id`, and `include_zero` filters.
- Cashiers cannot read locations or lot balances.
- Lot balance reads are tenant-isolated.
- Dashboard data hook now fetches stock locations and lot balances for purchasing and stock-ledger tabs.

Next implementation slice:

Add receiving-location selection fields in the Purchasing UI, using the new read APIs, while keeping the existing receive workflow usable when no lot data is entered.
