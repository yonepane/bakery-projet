# Command Palette Navigation Improvements Design Spec

## Overview
The goal of this update is to expand the global Command Palette (`/` or `Cmd+K`) to support navigation across all sections of the application. It will replace the hardcoded English commands with dynamically translated labels (e.g., "Comptabilité", "Tableau de Bord") and enforce role-based access control, hiding restricted areas from cashiers.

## Architecture

**Location:** `frontend/src/components/Dashboard.tsx`

### 1. Navigation Item Definition
We will define an array of all possible navigation tabs inside `Dashboard.tsx` (before or around where `commandActions` is defined), matching the existing sidebar and operations dropdown routes.

```typescript
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
```

### 2. Role-Based Access Filtering
We will apply the same access rules as the sidebar. Cashiers are restricted from accessing certain management tabs.

```typescript
const cashierRestrictedTabs = ['simulator', 'inventory', 'purchasing', 'intelligence', 'staff'];

const filteredNavItems = allNavItems.filter(item => {
  if (user?.role === 'cashier' && cashierRestrictedTabs.includes(item.id)) return false;
  return true;
});
```

### 3. Action Construction
We will construct the `Navigation` actions dynamically from the filtered list, allowing the user to search directly by the tab's localized name.

```typescript
const navigationActions = filteredNavItems.map(item => ({
  name: item.label,
  category: 'Navigation',
  onSelect: () => setActiveTab(item.id)
}));

const commandActions = [
  ...navigationActions,
  // Existing Recipe actions
  ...(inventory?.products || []).map(p => ({
    name: `Recipe: ${p.name}`,
    category: 'Products',
    onSelect: () => setSelectedProduct(p)
  }))
];
```

## Considerations & Constraints
- Maintains the current clean Search UX without adding unnecessary action prefixes (like "Go to").
- Automatically reflects language changes since the `label` maps to the translation object `t`.
- Prevents cashiers from inadvertently navigating to restricted views like `comptabilite` (if we decide to lock it) or `staff` via the command palette.
