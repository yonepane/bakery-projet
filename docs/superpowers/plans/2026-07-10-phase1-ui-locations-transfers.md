# Phase 1 UI (Locations & Transfers) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the "Location Board" and "Stock Transfer" frontend UI to expose Phase 1 backend capabilities, updating `useBakeryData.ts`, `InventoryPanel.tsx`, and adding a new `TransferModal.tsx`.

**Architecture:** 
- The backend `/api/stock-locations` and `/api/stock-locations/balances` provide the data. 
- We will hook them up in `useBakeryData.ts` to populate `stockLocations` and `stockLotBalances`.
- We'll build a new `LocationsPanel.tsx` (or tab within Inventory) that groups `stockLotBalances` by location.
- We'll build a generic `TransferModal.tsx` that allows selecting `item_type`, `item_id`, `from_location_id`, `to_location_id`, and `quantity` and posts to `/api/stock-locations/transfer`.

**Tech Stack:** React, Tailwind CSS, TypeScript, Vite.

---

### Task 1: Wire up data fetching in `useBakeryData.ts`

**Files:**
- Modify: `frontend/src/components/dashboard/useBakeryData.ts`

- [ ] **Step 1: Add state for locations and balances**
Update `useBakeryData.ts` to initialize and expose the state. It already imports the types `StockLocation` and `StockLotBalance`.

```typescript
  // Add below inventory/analytics state:
  const [stockLocations, setStockLocations] = useState<StockLocation[]>([]);
  const [stockLotBalances, setStockLotBalances] = useState<StockLotBalance[]>([]);
```

- [ ] **Step 2: Add fetch calls**
Update the `fetchData` and `fetchTabData` functions to fetch `/api/stock-locations` and `/api/stock-locations/balances`.

```typescript
// Inside `fetchData` or `fetchTabData` where appropriate:
try {
  const [locRes, balRes] = await Promise.all([
    api.get('/api/stock-locations'),
    api.get('/api/stock-locations/balances')
  ]);
  setStockLocations(locRes.data);
  setStockLotBalances(balRes.data);
} catch (err) {
  console.error("Failed to load location data", err);
}
```
*(Make sure to expose `stockLocations, stockLotBalances` in the hook's return object).*

- [ ] **Step 3: Update `Dashboard.tsx` to pass the props down**
`frontend/src/components/Dashboard.tsx` uses the hook. Make sure it extracts `stockLocations` and `stockLotBalances` and passes them to `DashboardSharedProps`. (They might already be in the type, just pass them).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/dashboard/useBakeryData.ts frontend/src/components/Dashboard.tsx
git commit -m "feat(ui): hook up stock locations and balances API fetching"
```

---

### Task 2: Build the `TransferModal` Component

**Files:**
- Create: `frontend/src/components/dashboard/modals/TransferModal.tsx`
- Modify: `frontend/src/components/Dashboard.tsx` (to render it)
- Modify: `frontend/src/components/dashboard/types.ts` (to add to `DashboardSharedProps`)

- [ ] **Step 1: Define UI state for the modal in `types.ts`**
Add to `DashboardSharedProps` (if not already there):
```typescript
  showTransferModal: boolean;
  setShowTransferModal: (v: boolean) => void;
```

- [ ] **Step 2: Build the modal component**
Create `TransferModal.tsx` that uses the `stockLocations` and `inventory` to let users pick an item, a source, destination, and amount. Upon submit, it calls the `handleTransferStock` prop.

```tsx
import React, { useState } from 'react';
import { StockLocation, Ingredient, Product } from '../types';
import { X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  locations: StockLocation[];
  inventory: { materials: Record<string, Ingredient>, products: Product[] };
  onTransfer: (payload: any) => void;
  isDarkMode: boolean;
}

export const TransferModal: React.FC<Props> = ({ isOpen, onClose, locations, inventory, onTransfer, isDarkMode }) => {
  const [itemType, setItemType] = useState('ingredient');
  const [itemId, setItemId] = useState('');
  const [fromLoc, setFromLoc] = useState('');
  const [toLoc, setToLoc] = useState('');
  const [qty, setQty] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onTransfer({
      item_type: itemType,
      item_id: itemId,
      from_location_id: parseInt(fromLoc),
      to_location_id: parseInt(toLoc),
      quantity: parseFloat(qty)
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`w-full max-w-md rounded-2xl p-6 ${isDarkMode ? 'bg-[#1a1a1c] text-white' : 'bg-white text-slate-900'}`}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Transfer Stock</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Form fields for item_type, item_id, fromLoc, toLoc, qty */}
            <button type="submit" className="w-full py-3 bg-gold text-black font-bold rounded-xl mt-6">Transfer</button>
        </form>
      </div>
    </div>
  );
};
```

- [ ] **Step 3: Render it in Dashboard.tsx**
```tsx
{showTransferModal && (
  <TransferModal 
    isOpen={showTransferModal} 
    onClose={() => setShowTransferModal(false)}
    locations={stockLocations}
    inventory={inventory}
    onTransfer={handleTransferStock}
    isDarkMode={isDarkMode}
  />
)}
```

- [ ] **Step 4: Commit**
```bash
git add frontend/src/components/dashboard/
git commit -m "feat(ui): add Stock Transfer modal component"
```

---

### Task 3: Build the Location Board UI

**Files:**
- Modify: `frontend/src/components/dashboard/panels/InventoryPanel.tsx`

- [ ] **Step 1: Add a "Locations" section to InventoryPanel**
Update the props of `InventoryPanel` to accept `stockLotBalances` and `stockLocations`. Map over `stockLocations`, and for each location, render a table of the balances (`stockLotBalances.filter(b => b.location?.id === loc.id)`).

- [ ] **Step 2: Add a "Transfer Stock" button**
In the header of the Location Board, add a button that calls `setShowTransferModal(true)`.

- [ ] **Step 3: Commit**
```bash
git add frontend/src/components/dashboard/panels/InventoryPanel.tsx
git commit -m "feat(ui): build Location Board inside InventoryPanel"
```
