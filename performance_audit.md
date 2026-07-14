# BakeryOS — React Rendering Performance Audit

**Date:** 2026-07-13  
**Scope:** Frontend React rendering behavior analysis  
**Method:** Static code analysis + React rendering principles  

---

## 1. Executive Summary

The current architecture has **one mega-component (`DashboardInner`)** that:
- Subscribes to **6 contexts** (196 total exported values) via `useDashboard()`
- Destructures **116+ values** and passes them to **15 panels** via a single `panelProps` object
- Re-renders **all 15 panels + modals + toasts** on **ANY** context change

**Key Finding:** Every context update triggers a full re-render of all 15 panels + modals + toast system because:
1. `DashboardInner` calls `useDashboard()` which spreads 6 contexts into one object
2. `panelProps` is a new object every render (no `useMemo`)
3. No `React.memo` on panels
4. No selector hooks — every panel subscribes to everything

---

## 2. Context Update Frequency Analysis

| Context | Exported Values | Update Frequency | Trigger | Affected Consumers |
|---------|----------------|------------------|---------|-------------------|
| **AuthContext** | 14 | Once (login) → never | Login/logout | All 15 panels + DashboardInner |
| **UIContext** | 16 | Low (user prefs) | Lang/currency/dark/sidebar | All 15 panels + DashboardInner |
| **DataContext** | 63 | **High** | Tab switch, data fetch, online/offline | All 15 panels + DashboardInner |
| **ModalContext** | 63 | Medium | Modal open/close | All 15 panels + DashboardInner |
| **NotificationContext** | 9 | **High** | Every toast/confirm/alert | All 15 panels + DashboardInner |
| **MutationContext** | 31 | Never (stable refs) | Never | All 15 panels + DashboardInner |

**Critical Issue:** `NotificationContext` fires on **every user action** (toasts, confirms) → forces ALL panels to re-render.

---

## 3. Component Re-render Map

### DashboardInner (Root)
- Calls `useDashboard()` → spreads 6 contexts → **new object every render**
- Creates `panelProps` object (116+ keys) — **new object every render**
- Defines 50+ handler functions inline — **new function refs every render**
- Passes `panelProps` to ALL 15 panels + modals

### Panels (15 total) — All re-render on ANY context change

| Panel | Context Values Used | Why It Re-renders |
|-------|---------------------|-------------------|
| DashboardPanel | `API_BASE` | `DataContext` update (any fetch) |
| POSPanel | `history`, `api`, `fetchData`, `user`, `customers`, `openSelector` | `DataContext` + `ModalContext` (any modal) |
| InventoryPanel | 19 values from `useDashboard()` | `DataContext` + `ModalContext` (any modal) |
| FichePanel | `simulatedInflations`, `simPrices`, `addToast`, `settings`, `handleDuplicateProduct` | `ModalContext` (sim prices) + `DataContext` |
| AnalyticsPanel | 9 values | `DataContext` (analytics fetch) |
| HistoryPanel | 13 values | `DataContext` + `ModalContext` |
| StockMovementsPanel | 2 values | `DataContext` |
| PlannerPanel | 4 values | `DataContext` |
| ExpensesPanel | 4 values | `DataContext` + `ModalContext` |
| FinancePanel | 2 values | `DataContext` + `NotificationContext` (toast) |
| OrdersPanel | 7 values | `DataContext` + `ModalContext` |
| PurchasingPanel | 3 values | `DataContext` + `ModalContext` |
| SettingsPanel | 2 values | `UIContext` (sidebar) |
| StaffPanel | 4 values | `DataContext` + `ModalContext` |
| IntelligencePanel | 5 values | `DataContext` |
| KitchenPanel | 3 values | `DataContext` + `ModalContext` |
| KitchenBoardPanel | 4 values | `DataContext` |
| CustomersPanel | 6 values | `DataContext` + `NotificationContext` (toast) |
| ForecastPanel | 1 value | `DataContext` |

**Every panel re-renders when ANY of the 6 contexts update.**

---

## 4. Expensive Render Analysis

### What Actually Costs CPU

| Operation | Location | Frequency | Cost |
|-----------|----------|-----------|------|
| `deriveAccountingMetrics` | `DashboardInner` line 275 | Every render | **High** — loops through history, expenses, POs, waste, suppliers |
| `sortedMaterialEntries` | Line 276 | Every render | **Medium** — `Object.entries().sort()` |
| `panelProps` creation | Line 615+ | Every render | **Medium** — 116-key object spread |
| `panelProps` spread to 15 panels | Lines 537-556 | Every render | **Medium** — 15 × 116 prop spreads |
| Toast/Confirm creation | Every action | High | Low (small components) |

**Top Offender:** `deriveAccountingMetrics` runs on **every single render** of `DashboardInner` — which happens on every toast, modal open, tab switch, data fetch, sidebar toggle.

---

## 5. Root Causes of Unnecessary Renders

| # | Cause | Impact |
|---|-------|--------|
| 1 | `useDashboard()` returns new object every render (spreads 6 contexts) | All 15 panels + modals re-render on ANY context change |
| 2 | `panelProps` is new object every render (no `useMemo`) | All 15 panels receive new props every render |
| 3 | No `React.memo` on panels | Panels can't skip render even if props unchanged |
| 4 | Handler functions created inline | New function refs every render → defeats child `memo` |
| 5 | `panelProps` passed to modals | Modals re-render on every parent render |
| 6 | `NotificationContext` updates on every toast | All 15 panels re-render on every toast |
| 7 | `DataContext` updates on every tab switch + fetch | All panels re-render on tab switch |

---

## 6. Measured Impact (Estimated)

Based on React DevTools profiling patterns for similar architectures:

| Metric | Current | Target |
|--------|---------|--------|
| Renders per toast | 17 (1 root + 15 panels + modal host) | 1 (toast only) |
| Renders per tab switch | 17 | 1-3 (only affected panels) |
| Renders per modal open | 17 | 1 (modal only) |
| Renders per sidebar toggle | 17 | 1-2 |
| `deriveAccountingMetrics` calls per user action | 1 | 0 (memoized) |

---

## 7. Optimization Plan (Prioritized by ROI)

### 🔴 HIGH ROI — Do First

| # | Optimization | Effort | Risk | Expected Gain |
|---|--------------|--------|------|---------------|
| 1 | **Split `DataContext`** → `ServerDataContext` + `DerivedDataContext` + `TabFetcherContext` | M | Low | Isolates 63 values → only affected panels re-render on data fetch |
| 2 | **Memoize `useDashboard()` return** + export selector hooks (`useAuth`, `useUI`, `useData`, etc.) | S | Low | Panels can subscribe to only what they need |
| 3 | **Wrap `panelProps` in `useMemo`** | S | Low | Stable props → `React.memo` panels skip render |
| 4 | **Add `React.memo` to all 15 panels** | S | Low | Panels skip render when props stable |

### 🟡 MEDIUM ROI — Do Next

| # | Optimization | Effort | Risk | Expected Gain |
|---|--------------|--------|------|---------------|
| 5 | **Extract `deriveAccountingMetrics` to `useMemo`** | S | Low | Eliminates expensive computation on every toast/modal |
| 6 | **Extract `sortedMaterialEntries` to `useMemo`** | S | Low | Removes sort on every render |
| 7 | **Move handler functions to `useCallback` or MutationContext** | M | Low | Stable handler refs → child `memo` works |

### 🟢 LOW ROI — Defer

| # | Optimization | Effort | Risk | Gain |
|---|--------------|--------|------|------|
| 8 | Split `ModalContext` (63 values) | M | Medium | Marginal — modals don't open that often |
| 9 | Move `liveRates` to single source | S | Low | Low — rarely changes |
| 10 | Add selector hooks for all contexts | M | Low | Developer ergonomics, minor perf |

---

## 8. Recommended Implementation Order

### Sprint 1 (High Impact, Low Risk)
1. Split `DataContext` → 3 focused contexts
2. Add selector hooks (`useAuth`, `useUI`, `useServerData`, `useDerivedData`, `useTabFetcher`)
3. Memoize `useDashboard()` return + export selector hooks
4. Wrap `panelProps` in `useMemo`
5. Add `React.memo` to all 15 panels
5. Move `deriveAccountingMetrics` + `sortedMaterialEntries` to `useMemo`

### Sprint 2 (Medium Impact)
6. Move inline handlers to `useCallback` or MutationContext
7. Fix `MutationProvider` stub functions → real context consumers
8. Add `useCallback` to remaining inline handlers

---

## 9. Risk Assessment

| Change | Risk | Mitigation |
|--------|------|------------|
| Context split | Low | Pure refactor; same values, different providers |
| Selector hooks | Low | New exports; existing `useDashboard()` still works |
| `React.memo` panels | Low | Props are stable after `useMemo` |
| `useMemo` expensive calcs | Low | Pure functions; same inputs = same outputs |
| Handler `useCallback` | Low | Stable deps from context |

---

## 10. Validation Criteria

| Check | Method |
|-------|--------|
| No behavior change | Manual test all 15 panels + modals + toasts |
| Backend tests pass | `pytest -q` (110 tests) |
| Frontend builds | `npm run build` |
| TypeScript clean | `tsc --noEmit` |
| No circular deps | `madge --circular src/` |

---

## Appendix: Current Context Dependency Graph

```
DashboardInner
  └─ useDashboard() → spreads 6 contexts
       ├─ AuthContext (14) → stable after login
       ├─ UIContext (16) → user prefs only
       ├─ DataContext (63) ← CHANGES OFTEN
       │   ├─ inventory, analytics, profitReport, alerts
       │   ├─ history, stockMovements, stockLocations
       │   ├─ stockLotBalances, semiFinishedItems, kitchenBatches
       │   ├─ planner, orders, settings, liveRates
       │   ├─ customers, expenses, wasteRecords
       │   ├─ staff, suppliers, purchaseOrders
       │   ├─ purchasingSuggestions, shiftLogs, loading
       │   └─ fetchTabData, fetchData, applyInventory, applySettings
       ├─ ModalContext (63) ← modal open/close
       ├─ NotificationContext (9) ← HIGH FREQUENCY (toasts)
       └─ MutationContext (31) → stable refs
```

---

*End of Audit — 2026-07-13*