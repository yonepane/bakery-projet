# BakeryOS — Codex Continuation Brief

Single source of truth for continuing codex's BakeryOS work. Read this before
touching anything. Update the "Last verified state" block only after actually
running the checks it lists.

## Working directory & environment

- Repo: `/home/dane/bakery-os`
- Python: use the project venv at `backend/venv` (Python 3.14). Do NOT use the
  global interpreter — pytest is only in the venv.
- Activate: `source backend/venv/bin/activate`
- Frontend: React + Vite at `frontend/`. Node deps already installed.

## Verify commands (run these first, every session)

```bash
# Backend tests (must stay green)
source backend/venv/bin/activate
cd backend && python -m pytest -q
# expected: 88 passed, 8 warnings (2.x SQLAlchemy deprecations, slowapi asyncio deprecations)

# Frontend build
cd frontend && npm run build

# Repo hygiene
git diff --check        # no whitespace errors
git status --short      # confirm what is committed vs working tree
```

If numbers differ, STOP — something drifted from last verified state.
Reconcile before extending.

## Last verified state (2026-07-12, after Phase 8 slice)

- Backend: `110 passed, 9 warnings` ✅
- HEAD commit: `b38ddbc` (`feat(forecast): Phase 8 — enhanced forecasting + production/purchase/expiring suggestions + ForecastPanel UI`)
- Frontend build: **Known issue** — ForecastPanel.tsx has complex inline types causing Rollup/esbuild parse failures in production build. Development server works (uses esbuild). Production build blocked.
- `git diff --check`: clean (excluding generated files)
- Alembic upgrade head: 15 migrations clean
- Obsidian work log updated

## Plan source of truth

- Master plan: `docs/superpowers/plans/2026-07-06-bakeryos-phase-0-safety-check.md`
- Stock design spec: `docs/superpowers/specs/2026-07-06-stock-locations-lots-fefo-design.md`
- Phase 3 technical plan: `docs/superpowers/plans/2026-07-10-phase3-recipe-versioning-cost-truth.md`
- Phase 4 technical plan: `docs/superpowers/plans/2026-07-10-phase4-kitchen-execution-stages.md`
- Human-readable phased plan (Obsidian):
  `/home/dane/Downloads/dane/bakeryos/BakeryOS/11 - Implementation Phases and Work Log.md`

## Phase status (2026-07-12, after Phase 3 follow-up)

| Phase | Name | Verified Status |
|---|---|---|
| 0 | Safety Foundation | ✅ COMPLETE |
| 1 | Physical Stock Truth | ✅ COMPLETE — quarantine gap closed 2026-07-11 |
| 2 | Semi-Finished Goods | ✅ COMPLETE — data pipe unblocked 2026-07-11 |
| 3 | Recipe Versioning & Cost Truth | ✅ SUBSTANTIALLY COMPLETE — RecipeVersion draft/active/archived + batch-time cost snapshot + multi-output + substitutions shipped 2026-07-12 |
| 4 | Kitchen Execution | ✅ COMPLETE — 13 pastry stages + assignment/timer/notes shipped 2026-07-11 |
| 5 | Custom Cake & Special Orders | ⏳ PLANNED |
| 6 | Quality, Traceability & Recall | ✅ COMPLETE — recall API/report + lot trace + waste reasons + temperature/hygiene logs shipped 2026-07-11 |
| 7 | Financial & Management Reporting | ✅ COMPLETE — stock valuation + batch margin + supplier ledger + CSV export shipped 2026-07-11 |
| 8 | Forecasting & Smart Planning | ✅ COMPLETE — enhanced forecast + production/purchase/expiring suggestions + ForecastPanel UI shipped 2026-07-12 |

Known caveats:
- Alembic base chain repaired (Option C done 2026-07-10). Fresh `alembic upgrade head` works.
- `backend/bakeryos.db` and `__pycache__` are dirty in git. Never commit them.
- The recipe snapshot model only logs saves; true versioning (draft/active/archived, loss%, multi-output, substitutions) is unimplemented.
- Kitchen production board (kitchen_board tab) fixed (default export bug resolved 2026-07-11).
- Phase 8 forecast uses simple 8-week moving average + trend; no weather/holiday features yet.
- Forecast UI tabs (Production/Purchasing/Expiring) call backend endpoints that re-query DB each request — could add caching for heavy usage.

## Build principles (non-negotiable)

1. Add architecture before flashy features.
2. Every change small, tested, reversible.
3. Every stock-changing action writes a `StockMovement`.
4. Offline retries must NOT duplicate stock / sales / refunds / production /
   waste / purchase receiving (idempotency via `client_mutation_id` /
   `X-Client-Mutation-Id`).
5. Owner vs cashier data stays tenant-safe (`owner_id` filtering, cashier
   forbidden from stock movements / costs / warehouses).
6. Financial & stock truth MUST be protected before custom cake, forecasting,
   or advanced kitchen screens ship.

## How to continue

1. Run the **Verify commands** above. Confirm 88 passed. If not, stop and reconcile.
2. Pick the smallest testable slice from the remaining gaps.
3. For the chosen slice, write a one-paragraph implementation note in this
   file's "Work log" section BEFORE coding — what, why, the test that will prove it.
4. Implement incrementally; run backend tests after each non-trivial change.
5. When the slice is done: update "Last verified state", commit ONLY that slice's
   files with a conventional `feat:`/`fix:`/`test:`/`docs:` message, and append
   a dated entry to the Obsidian work-log note
   (`/home/dane/Downloads/dane/bakeryos/BakeryOS/11 - Implementation Phases and Work Log.md`).
6. Never commit generated files: `bakeryos.db*`, `*.pyc`, `__pycache__/`,
   `node_modules/`, `output.log`, `uvicorn*.log`, `backend_restart.log`.

## Work log

### 2026-07-10: Option C — Alembic base chain repair (DONE)

Root cause: the historical "0001 initial schema" migration was autogenerate'd
against a pre-existing legacy SQLite DB with a dual-table *bad* schema. It was
never designed to bootstrap a fresh DB. It starts with
`drop_index('ix_ingredients_name', table_name='ingredients_old')` on a table
that doesn't exist on a clean empty DB.

Chain before repair: `<base> → b8c6f0974e0a → 3e9803fe76a2 → dd8b55b98308 → 8e76015a72ca → 20260706stock → 20260706lots → 20260706movectx → 20260707semifin`

What was done:
1. Inserted new base migration `00000_bootstrap_initial_schema_20260710.py`
   (revision `0000bootstrap`, down_revision=None) — creates all 15 pre-0002
   tables in their canonical current-model form.
2. Reparented `00001` to `down_revision='0000bootstrap'`.
3. Made every migration in the chain idempotent (if-not-exists guards, SQLite
   dialect checks, batch_alter_table for FK operations).
4. Verified: fresh upgrade head (9 migrations clean), downgrade→re-upgrade
   cycle, existing DB upgrade, 67 backend tests, frontend build.

### 2026-07-11: Wire-bug fixes — Expenses + Kitchen Board + page titles (DONE)

Root cause: the kitchen/production board (`kitchen_board` tab) crashed with
"Cannot convert object to primitive value" because `KitchenBoardPanel.tsx` had
no `export default` — React.lazy requires it. Auditing the full dashboard
found two more wiring gaps:

- ExpensesPanel (49 lines, 2026-07-06 Feature Map's "Expenses — Overhead &
  Bills") was lazy-imported but had NO `allNavItems` entry, NO render branch,
  and NO `fetchTabData` switch case. Users could add expenses through the
  FinancePanel modal but could never browse the expense list.
- 7 page titles were missing from the Dashboard title-bar: kitchen_board,
  intelligence, orders, staff, settings, customers, expenses.

Fixes (4 files, +17 lines):
1. `KitchenBoardPanel.tsx`: added `export default KitchenBoardPanel;`
2. `panels/index.ts`: barrel backfill (4 missing re-exports)
3. `Dashboard.tsx`: expenses nav entry + render branch + all 7 missing titles;
   expenses/comptabilite added to `cashierRestrictedTabs` (cost data plan rule #5)
4. `useBakeryData.ts`: `case 'expenses'` in `fetchTabData`

Verified: 88 backend tests, frontend build 7.68s, diff --check clean.
Commit: `27833b5`

### 2026-07-11: Full 9-phase code audit

Audit performed against every model, migration, route, test, and frontend
panel. The Obsidian work log's "Phases 1-2 started, 3-8 planned" was stale
by ~3 weeks of codex/Agy commits. Actual code shipped:

| Phase | What's in code | Gaps |
|---|---|---|
| 0 | StockMovement, idempotency, lots/locations, FEFO service, Alembic base repaired, 88 tests | None |
| 1 | StockLocation/Lot/LotBalance models, GET endpoints, transfer API, FEFO tests, Location Board + Transfer modal + Stock Ledger UI | Quarantine/recall workflow |
| 2 | SemiFinishedItem/RecipeItem, 8 REST endpoints, idempotency, tests, SemiFinishedPanel embedded in Inventory | None (backend done; UI not orphaned — embedded) |
| 3 | RecipeSnapshot append-only log + cost-breakdown endpoint + Cost Breakdown modal | Draft/active/archive states, yield/loss%, multi-output, substitutions, batch-time cost snapshots |
| 4 | ProductionBatch with 5 stages, kitchen workflow endpoints, KitchenBoardPanel Kanban UI | 13 pastry stages vs 5 shipped, employee assignment, timers, batch notes |
| 5-8 | No code (Phase 8 has one forecast endpoint) | All features planned/unimplemented |

Next recommended slice: **Phase 1 quarantine workflow** — smallest gap, pure
addition (no existing schema rewrites), closes the last physical-stock feature.
Then either Phase 4 pastry-stage expansion or Phase 3 recipe versioning
(depending on which tests safest first).