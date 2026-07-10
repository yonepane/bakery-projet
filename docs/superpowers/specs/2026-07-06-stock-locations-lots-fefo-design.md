# Stock Locations, Lots, FEFO, and Semi-Finished Goods Design

## Purpose

Define the next BakeryOS stock architecture step after the append-only stock movement ledger.

This design keeps the current app stable while preparing BakeryOS for real pastry workflows:

- Multiple physical stock locations.
- Supplier lots and internal production batches.
- Expiration dates and FEFO picking.
- Semi-finished goods such as creams, doughs, tart shells, sponge layers, fillings, and glazes.

## Current State

Current stock truth:

- `ingredients.stock` stores raw material balance.
- `products.stock` stores finished product balance.
- `stock_movements` records covered stock-changing actions.
- `apply_stock_delta` centralizes owner validation, negative-stock prevention, legacy balance updates, and audit movement creation.

Current limitations:

- No location-specific stock.
- No lot or expiry tracking.
- No FEFO selection.
- No semi-finished item type.
- Purchase receiving stores receipt progress in `purchase_orders.items` JSON.
- Production consumes recipe ingredients directly and adds finished product stock directly.

## Design Principle

Do not replace legacy balance columns first.

Add location and lot records beside the current balances, then let `apply_stock_delta` update both:

1. Legacy balance column for existing screens.
2. Location/lot balance rows for new traceability workflows.
3. Stock movement row for audit.

This avoids a large rewrite and gives each route a safe migration path.

## New Entities

## StockLocation

Represents a physical or operational place where stock can exist.

Fields:

- `id`
- `owner_id`
- `name`
- `type`: `warehouse`, `kitchen`, `fridge`, `freezer`, `display`, `delivery_staging`, `branch`, `quarantine`, `waste`
- `branch_name`
- `is_default`
- `is_active`
- `created_at`

Rules:

- Each owner gets default locations on first use:
  - Main Warehouse
  - Kitchen
  - Fridge
  - Freezer
  - Display Counter
  - Quarantine
- One owner can have multiple branch/display locations.
- Cashiers should only see stock relevant to POS/display unless granted more access.

## StockLot

Represents one trackable lot/batch of stock.

Fields:

- `id`
- `owner_id`
- `item_type`: `ingredient`, `semi_finished`, `product`
- `item_id`
- `item_name_snapshot`
- `lot_code`
- `supplier_lot_code`
- `internal_batch_code`
- `source_type`: `purchase_order`, `production_batch`, `manual_opening`, `adjustment`
- `source_id`
- `received_at`
- `produced_at`
- `expires_at`
- `unit_snapshot`
- `unit_cost_snapshot`
- `status`: `active`, `expired`, `consumed`, `quarantine`, `recalled`
- `created_at`

Rules:

- Purchase receiving creates ingredient lots.
- Production creates product or semi-finished lots.
- Manual opening stock can create lots only through an owner-only controlled flow.
- Expired and quarantined lots are not eligible for automatic picking.

## StockLotBalance

Represents quantity of one lot in one location.

Fields:

- `id`
- `owner_id`
- `lot_id`
- `location_id`
- `quantity`
- `reserved_quantity`
- `updated_at`

Rules:

- Available quantity = `quantity - reserved_quantity`.
- A lot can exist in multiple locations after transfers.
- Lot balance rows must never go below zero unless an explicit correction mode is used.

## SemiFinishedItem

Represents pastry components that can be produced, stored, and used in other recipes.

Fields:

- `id`
- `owner_id`
- `name`
- `unit`
- `stock`
- `min_threshold`
- `default_storage_location_type`: `fridge`, `freezer`, `kitchen`, `warehouse`
- `shelf_life_hours`
- `price_or_cost_override`
- `allergens`
- `is_active`
- `created_at`

Rules:

- Semi-finished items have recipes like products.
- Semi-finished items can be ingredients in product recipes.
- Semi-finished production creates `semi_finished` stock movements and lots.

## StockMovement Extensions

Add optional context fields:

- `location_id`
- `location_name_snapshot`
- `lot_id`
- `lot_code_snapshot`
- `expires_at`
- `unit_cost_snapshot`
- `correlation_id`

Reason:

The existing ledger already proves what changed. These fields let the ledger also prove where it changed and which lot/batch was involved.

## FEFO Picking

FEFO means first-expired, first-out.

Eligible lots:

- Same `owner_id`.
- Same `item_type` and `item_id`.
- `status = active`.
- `expires_at` is null or in the future, unless the user explicitly allows expired stock.
- Available quantity above zero.
- Location is allowed for the operation.

Sort order:

1. Lots with expiration dates before lots without expiration dates.
2. Earliest `expires_at`.
3. Earliest `received_at` or `produced_at`.
4. Lowest `lot_id` for deterministic results.

When FEFO cannot fulfill requested quantity:

- Reject the operation by default.
- Return shortage details by item and location.
- Do not partially mutate stock unless the route explicitly supports partial completion.

## Route Migration Sequence

## Slice 1 - Add Location and Lot Tables Without Behavior Change

Priority: Critical

Add models, migration, and bootstrap creation only:

- `stock_locations`
- `stock_lots`
- `stock_lot_balances`
- optional `semi_finished_items` table if implementing semi-finished in the same migration is still small

Tests:

- Default locations can be created per owner.
- Owners cannot see each other's locations/lots.
- Lot balance constraints reject negative quantities.

No existing stock route should change behavior in this slice.

## Slice 2 - Extend Stock Service Internals

Priority: Critical

Extend `apply_stock_delta` with optional parameters:

- `location_id`
- `lot_id`
- `expires_at`
- `unit_cost`
- `picking_strategy`

Behavior:

- If no location/lot is supplied, keep current legacy behavior.
- If supplied, update lot balance and legacy stock in one database transaction.
- For negative deltas with `picking_strategy="fefo"`, select eligible lot balances automatically.
- Write one stock movement per affected lot when FEFO splits a deduction across lots.

Tests:

- Legacy calls behave exactly as before.
- Positive lot/location movement creates lot balance.
- Negative lot/location movement decrements the selected balance.
- FEFO picks earliest expiring lot first.
- Failed FEFO shortage writes no movements.

## Slice 3 - Purchase Receiving Creates Ingredient Lots

Priority: Critical

Extend receiving payloads:

- `lot_code`
- `expires_at`
- `location_id`

Default behavior:

- If no location is provided, receive into Main Warehouse.
- If no expiration is provided, create a lot without expiry but flag it as missing expiry for perishable ingredients later.

Tests:

- Receiving PO creates ingredient lot and balance.
- Receiving still updates legacy ingredient stock.
- Receiving writes stock movement with lot/location context.
- Idempotent receiving does not duplicate lots or balances.

## Slice 4 - Production Uses FEFO for Raw Materials

Priority: Critical

Production should:

- Consume ingredient lots by FEFO from allowed production locations.
- Create finished product lot in Kitchen or Display Counter depending on product configuration.
- Keep current transaction behavior.

Tests:

- Production consumes earliest expiring ingredient lots.
- Production can split consumption across lots.
- Failed production due to lot shortage writes no rows.
- Product output lot receives expiry from product shelf-life rules when available.

## Slice 5 - Semi-Finished Goods

Priority: Critical

Add recipe support for item references:

- Raw ingredient.
- Semi-finished item.

Production should support:

- Producing a semi-finished item.
- Consuming semi-finished stock in a finished product recipe.
- Creating internal batch codes for semi-finished lots.

Tests:

- Semi-finished item can be produced into stock.
- Finished product can consume semi-finished stock.
- Allergen inheritance includes semi-finished recipe allergens.

## Slice 6 - Owner UI

Priority: Important

Add screens only after backend behavior is stable:

- Locations manager.
- Lot receiving fields inside PO receiving.
- Expiring stock board.
- FEFO stock view by item.
- Transfer stock between locations.

## Security and Permissions

Owner:

- Full location, lot, receiving, transfer, and recall access.

Manager:

- Can view and transfer operational stock if this role exists.

Baker:

- Can consume production stock from allowed kitchen locations.
- Cannot edit costs or supplier lot metadata.

Cashier:

- Can view sellable/display stock.
- Cannot view supplier cost or full warehouse stock unless explicitly permitted.

## Data Integrity Rules

- Every lot, location, balance, and movement must include `owner_id`.
- All route queries must filter by effective owner.
- Balance changes and movement creation must happen in the same transaction.
- Idempotency must cover lot creation and lot balance updates, not only movement creation.
- Expired/quarantined/recalled lots are excluded from automatic picking.
- Manual corrections must require a reason.

## Recommended Next Implementation

Implement Slice 1 only:

- Add `StockLocation`, `StockLot`, and `StockLotBalance`.
- Add an Alembic migration.
- Add bootstrap creation for SQLite/dev installs.
- Add owner-only read APIs for locations and lot balances if needed for tests.
- Add tests for tenant isolation and default locations.

Do not modify production, POS, waste, or purchasing behavior in Slice 1.

Reason:

The stock ledger is now stable. The safest next move is to introduce the physical stock model without changing live stock behavior, then migrate purchasing and production one route at a time.
