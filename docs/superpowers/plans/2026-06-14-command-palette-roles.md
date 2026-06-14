# Command Palette Navigation Roles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the Command Palette to include all navigation routes dynamically translated and filtered by the user's role.

**Architecture:** We will replace the hardcoded `commandActions` array in `Dashboard.tsx` with a dynamically mapped array of all application routes, applying the exact same role-restriction logic used by the Sidebar.

**Tech Stack:** React, TypeScript, TailwindCSS

---

### Task 1: Update Command Palette Navigation

**Files:**
- Modify: `frontend/src/components/Dashboard.tsx`

- [ ] **Step 1: Replace the hardcoded `commandActions` definition**

Locate the existing `commandActions` definition in `Dashboard.tsx` (around line 318):

```tsx
  const commandActions = [
    { name: 'Go to POS', category: 'Navigation', onSelect: () => setActiveTab('pos') },
    // ...
```

Replace it entirely with the following code block:

```tsx
  const allNavItems = [
    { id: 'dashboard', label: t.dashboard },
    { id: 'intelligence', label: 'Intelligence' },
    { id: 'pos', label: t.pos },
    { id: 'kitchen', label: t.kitchen },
    { id: 'inventory', label: t.inventory },
    { id: 'fiche', label: t.fiche },
    { id: 'purchasing', label: t.purchasing },
    { id: 'simulator', label: t.simulator },
    { id: 'history', label: t.history },
    { id: 'planner', label: t.planner },
    { id: 'orders', label: t.orders },
    { id: 'comptabilite', label: t.comptabilite },
    { id: 'staff', label: t.staff },
    { id: 'settings', label: 'Settings' },
    { id: 'customers', label: 'Customers' }
  ];

  const cashierRestrictedTabs = ['simulator', 'inventory', 'purchasing', 'intelligence', 'staff'];

  const filteredNavItems = allNavItems.filter(item => {
    if (user?.role === 'cashier' && cashierRestrictedTabs.includes(item.id)) return false;
    return true;
  });

  const navigationActions = filteredNavItems.map(item => ({
    name: item.label,
    category: 'Navigation',
    onSelect: () => setActiveTab(item.id)
  }));

  const commandActions = [
    ...navigationActions,
    ...(inventory?.products || []).map(p => ({
      name: `Recipe: ${p.name}`,
      category: 'Products',
      onSelect: () => setSelectedProduct(p)
    }))
  ];
```

- [ ] **Step 2: Verify TypeScript Compilation**

Run: `npm run build` inside the `frontend` directory.
Expected: Build passes successfully with no type errors.

- [ ] **Step 3: Commit the changes**

```bash
git add frontend/src/components/Dashboard.tsx
git commit -m "feat: add dynamic role-based navigation to command palette"
```
