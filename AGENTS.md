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
# Backend tests (must stay green; codex left them at 67 passed)
source backend/venv/bin/activate
cd backend && python -m pytest -q
# expected: 67 passed, 6 warnings  (2.x SQLAlchemy deprecations, slowapi asyncio deprecations)

# Frontend build
cd frontend && npm run build

# Repo hygiene
git diff --check        # no whitespace errors
git status --short      # confirm what is committed vs working tree
```

If numbers differ, STOP — something drifted from codex's last verified state.
Reconcile before extending.

## Last verified state (2026-07-07, confirmed in this session)

- Backend: `67 passed, 6 warnings` ✅
- HEAD commit: `e1bec89` ("docs: add implementation plans for allergen
  traceability and usability improvements")
- ALL Phase 0 + Phase 1/2 foundation work is UNCOMMITTED in the working tree.
  Do not `git stash`/`reset` blindly — that deletes codex's in-progress work.
- New untracked files (codex's work):
  - `backend/routers/semi_finished.py`
  - `backend/services/stock.py`
  - `backend/services/locations.py`
  - `backend/alembic/versions/0005..0008_*.py`
  - `backend/tests/test_fefo_production.py`, `test_semi_finished.py`,
    `test_stock_locations_lots.py`, `test_stock_movements.py`,
    `test_waste.py`, `test_pos.py`
  - `frontend/.../panels/StockMovementsPanel.tsx`
  - `docs/superpowers/plans/2026-07-06-bakeryos-phase-0-safety-check.md`
  - `docs/superpowers/specs/2026-07-06-stock-locations-lots-fefo-design.md`

## Plan source of truth

- Master plan (read this): `docs/superpowers/plans/2026-07-06-bakeryos-phase-0-safety-check.md`
- Stock design spec: `docs/superpowers/specs/2026-07-06-stock-locations-lots-fefo-design.md`
- Human-readable phased plan:
  `/home/dane/Downloads/dane/bakeryos/BakeryOS/11 - Implementation Phases and Work Log.md`
  (Obsidian vault — this is the narrative status doc; the repo `.md` files are the specs.)

## Phase status (as of last verification)

| Phase | Name | Status |
|---|---|---|
| 0 | Safety Foundation (stock ledger, idempotency, lots/locations) | ✅ Foundation complete |
| 1 | Physical Stock Truth (FEFO, transfers, location board UI) | 🟡 Backend started; UI not built |
| 2 | Semi-Finished Goods | 🟡 Backend foundation started; contracts need cleanup |
| 3 | Recipe Versioning & Cost Truth | ⏳ Planned |
| 4 | Kitchen Execution stages | ⏳ Planned |
| 5+ | Custom orders, recall, reporting, forecasting | ⏳ Planned |

Known caveats (do not ignore):
- `alembic/versions/00001_initial_schema_b8c6f0974e0a.py` breaks a FRESH
  `alembic upgrade head` (dropping SQLite indexes/tables before they exist).
  Model-creation + route tests cover the new stock work, but a clean DB
  upgrade is NOT trustworthy until the base chain is repaired.
- Semi-finished schemas/API shape are a first draft — need a cleanup pass
  before they become public SaaS surface.
- Committed/generated files are dirty in the repo: `backend/bakeryos.db`,
  `backend/__pycache__`. These are noise, not architecture. Don't "clean"
  them by deleting without checking they're not used live.

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

## The fork codex left (pick ONE, small, testable slice)

| Option | Slice | Why | Risk |
|---|---|---|---|
| A | Polish semi-finished backend contracts, schemas, tests, docs | Makes Phase 2 backend publicly usable; unblocks Phase 3 | Touches schema other code already relies on — needs care |
| B | Build owner-facing lot balance + expiring-stock board UI | Phase 1 product completion; gives owners usable FEFO view | Pure read/UI + small read API additions |
| C | Repair the old Alembic base chain so fresh `alembic upgrade head` works | Smallest slice; unblocks trust in ALL later migrations; explicitly flagged as a known caveat | Must not perturb existing DBs — repair pass only |

Rule from the plan: **do not add another large module until the chosen slice is
done.** Each slice must stay testable: backend tests green + frontend build green
+ `git diff --check` clean.

Recommended starting point: **Option C** first (unblocks trustworthy DB
upgrades), then **Option A** (closes the loosest contract), then **Option B**
(visible product value). But confirm with the user before starting.

## How to continue

1. Run the **Verify commands** above. Confirm 67 passed. If not, stop and
   reconcile.
2. Confirm the slice to work on with the user (default: Option C).
3. For the chosen slice, write a one-paragraph implementation note in this
   file's "Work log" section BEFORE coding — what, why, the test that will prove
   it.
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
against a pre-existing legacy SQLite DB with a dual-table *bad* schema (e.g.
`ingredients` and `ingredients_old` coexisting, TEXT/REAL types from sqlite
autotyping). It was never designed to bootstrap a fresh DB. It starts with
`drop_index('ix_ingredients_name', table_name='ingredients_old')` on a table
that doesn't exist on a clean empty DB.

Chain before repair: `<base> → b8c6f0974e0a → 3e9803fe76a2 → dd8b55b98308 → 8e76015a72ca → 20260706stock → 20260706lots → 20260706movectx → 20260707semifin`

What was done:
1. Inserted new base migration `00000_bootstrap_initial_schema_20260710.py`
   (revision `0000bootstrap`, down_revision=None) — creates all 15 pre-0002
   tables (users through expense_payments) in their canonical current-model
   form, with FKs, without customer_id/semi_finished_id columns (added by
   0002/0008), and without any secondary indexes (added by 0001/0002/0004).
2. Reparented `00001` to `down_revision='0000bootstrap'`.
3. Made every migration in the chain idempotent:
   - 0001: legacy-cleanup drops guarded with drop_table_if_exists /
     drop_index_if_exists; alter_column calls wrapped in `if not is_sqlite`
     (SQLite doesn't support ALTER COLUMN TYPE); create_index calls wrapped
     in create_index_if_not_exists; downgrade similarly guarded.
   - 0002: create_table/create_index/add_column guarded with
     if-not-exists helpers; downgrade guarded.
   - 0004: every create_index wrapped in create_index_if_not_exists; drops
     guarded with drop_index_if_exists; FK operations wrapped in
     `if not is_sqlite`.
   - 0005–0008: table creation guarded with `if not _table_exists(...)`;
     create_index/index drops guarded; add_column guarded with
     `if not _column_exists(...)`; 0008's add_column + FK on recipe_items
     uses batch_alter_table for SQLite safety; downgrade order fixed
     (recipe_items column dropped BEFORE semi_finished_items table).
4. Verified:
   - `alembic upgrade head` on fresh empty SQLite: 9 migrations run clean.
   - Full downgrade-to-base → re-upgrade cycle: clean.
   - Existing runtime DB (`bakeryos.db`) at stamp `8e76015a72ca`: upgrades
     to head `20260707semifin` cleanly.
   - Backend tests: 67 passed, 6 warnings.
   - Frontend build: success.
   - `git diff --check`: clean.
