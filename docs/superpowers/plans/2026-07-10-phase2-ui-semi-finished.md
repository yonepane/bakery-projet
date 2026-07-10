# Phase 2 UI (Semi-Finished Goods) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Semi-Finished Goods UI — a dedicated tab in the Inventory panel showing creams, doughs, and fillings as tracked inventory, with a Recipe Builder modal and a "Produce Batch" action.

**Architecture:**
- Data is fetched from three new backend endpoints: `GET /api/semi-finished`, `GET /api/semi-finished/{id}/recipe`, `PUT /api/semi-finished/{id}/recipe`, and `POST /api/semi-finished/produce`.
- A new `SemiFinishedPanel.tsx` will render the list of semi-finished items. This panel is added as a new section of the existing Inventory view (or a new panel tab).
- Two modals handle creation/editing: `SemiFinishedFormModal.tsx` (create/edit item) and `RecipeBuilderModal.tsx` (define recipe). A third modal `ProduceBatchModal.tsx` (produce a quantity) is triggered from each row.
- Data fetching lives in `useBakeryData.ts`. Mutations (create, update, produce) live in a new `useSemiFinishedMutations.ts` hook.

**Tech Stack:** React, Tailwind CSS, TypeScript, Vite. Lucide-react for icons.

**Backend endpoints used:**
- `GET /api/semi-finished` → list items
- `POST /api/semi-finished` → create item `{ name, unit, min_threshold, shelf_life_hours?, allergens? }`
- `PUT /api/semi-finished/{id}` → partial update item
- `DELETE /api/semi-finished/{id}` → soft-delete item
- `GET /api/semi-finished/{id}/recipe` → get recipe `{ semi_finished_id, items: [{ ingredient_id, ingredient_name, quantity, unit }] }`
- `PUT /api/semi-finished/{id}/recipe` → set recipe `{ items: [{ ingredient_id, quantity }] }`
- `POST /api/semi-finished/produce` → produce `{ semi_finished_id, quantity, client_mutation_id? }`

---

### Task 1: Types + Data Fetching

**Files:**
- Modify: `frontend/src/components/dashboard/types.ts`
- Modify: `frontend/src/components/dashboard/useBakeryData.ts`
- Modify: `frontend/src/components/Dashboard.tsx`

- [ ] **Step 1: Add `SemiFinishedItem` type to `types.ts`**

Add after the `StockLotBalance` interface:

```typescript
export interface SemiFinishedItem {
  id: number;
  name: string;
  unit: string;
  stock: number;
  min_threshold: number;
  shelf_life_hours?: number | null;
  allergens?: string[] | null;
  is_active: boolean;
  created_at?: string | null;
}

export interface SemiFinishedRecipeLine {
  ingredient_id: number;
  ingredient_name: string;
  quantity: number;
  unit: string;
}

export interface SemiFinishedRecipe {
  semi_finished_id: number;
  items: SemiFinishedRecipeLine[];
}
```

Also add `semiFinishedItems: SemiFinishedItem[]` to `DashboardSharedProps`.

- [ ] **Step 2: Add state and fetch in `useBakeryData.ts`**

Import `SemiFinishedItem` and add state:
```typescript
const [semiFinishedItems, setSemiFinishedItems] = useState<SemiFinishedItem[]>([]);
```

In the `fetchTabData` switch, add a fetch inside `case 'inventory':`:
```typescript
const sfRes = await safeGet('/semi-finished');
setSemiFinishedItems(sfRes);
```

Return `semiFinishedItems` in the hook's return object.

- [ ] **Step 3: Pass down in Dashboard.tsx**

Verify `semiFinishedItems` is destructured from the hook and included in `panelProps`.

- [ ] **Step 4: Commit**
```bash
git add frontend/src/components/dashboard/types.ts frontend/src/components/dashboard/useBakeryData.ts frontend/src/components/Dashboard.tsx
git commit -m "feat(ui): add SemiFinishedItem types and data fetching"
```

---

### Task 2: `SemiFinishedPanel.tsx` — The List View

**Files:**
- Create: `frontend/src/components/dashboard/panels/SemiFinishedPanel.tsx`
- Modify: `frontend/src/components/dashboard/panels/index.ts`
- Modify: `frontend/src/components/Dashboard.tsx` (to render the panel inside the inventory view or as a new panel)

This panel renders a table of semi-finished items, with:
- Low-stock alert styling (amber) when `stock < min_threshold`
- Per-row action buttons: "Edit Recipe" and "Produce Batch"
- An "Add Semi-Finished" button in the header (triggers create modal)

- [ ] **Step 1: Create `SemiFinishedPanel.tsx`**

```tsx
import React from 'react';
import { Plus, FlaskConical, ChefHat } from 'lucide-react';
import { SemiFinishedItem, DashboardSharedProps } from '../types';

type Props = Pick<DashboardSharedProps, 'isDarkMode' | 'semiFinishedItems' | 'editMode'> & {
  onAddItem: () => void;
  onEditRecipe: (item: SemiFinishedItem) => void;
  onProduceBatch: (item: SemiFinishedItem) => void;
};

const SemiFinishedPanel: React.FC<Props> = ({
  isDarkMode, semiFinishedItems, editMode, onAddItem, onEditRecipe, onProduceBatch
}) => (
  <div className={`rounded-[2rem] border overflow-hidden transition-colors ${isDarkMode ? 'bg-[#0a0a0b] border-white/5 shadow-glass backdrop-blur-xl' : 'bg-white border-slate-200 shadow-xl'}`}>
    <div className="p-8 border-b border-white/5 flex justify-between items-center">
      <h3 className={`text-xl font-bold luxury-font uppercase ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
        Semi-Finished Goods
      </h3>
      <button
        onClick={onAddItem}
        className={`p-2 rounded-lg ${isDarkMode ? 'bg-gold/10 text-gold' : 'bg-slate-100 text-slate-900'}`}
      >
        <Plus size={16} />
      </button>
    </div>
    <table className="w-full text-left">
      <thead>
        <tr className={`border-b text-[10px] font-black uppercase tracking-[0.2em] ${isDarkMode ? 'border-white/5 text-cream/40' : 'border-slate-100 text-slate-400'}`}>
          <th className="px-8 py-6">Item</th>
          <th className="px-8 py-6">Stock</th>
          <th className="px-8 py-6">Min Threshold</th>
          <th className="px-8 py-6 text-right">Actions</th>
        </tr>
      </thead>
      <tbody className={`divide-y ${isDarkMode ? 'divide-white/5' : 'divide-slate-100'}`}>
        {semiFinishedItems.length === 0 && (
          <tr>
            <td colSpan={4} className={`px-8 py-12 text-center text-sm ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>
              No semi-finished items yet. Add your first one.
            </td>
          </tr>
        )}
        {semiFinishedItems.map(item => {
          const isLow = item.stock < item.min_threshold;
          return (
            <tr key={item.id} className="group hover:bg-white/[0.02] transition-colors">
              <td className="px-8 py-6">
                <div className="flex items-center gap-3">
                  <span className={`text-xl ${isDarkMode ? 'text-gold/60' : 'text-amber-500'}`}><FlaskConical size={20} /></span>
                  <div>
                    <p className={`font-bold ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>{item.name}</p>
                    <p className={`text-[10px] uppercase tracking-widest ${isDarkMode ? 'text-gold/50' : 'text-slate-400'}`}>{item.unit}</p>
                    {item.allergens && item.allergens.length > 0 && (
                      <div className="allergen-badges">
                        {item.allergens.map(a => <span key={a} className="allergen-badge">{a}</span>)}
                      </div>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-8 py-6">
                <span className={`font-bold text-sm ${isLow ? 'text-amber-500' : (isDarkMode ? 'text-gold' : 'text-slate-900')}`}>
                  {item.stock} {item.unit}
                </span>
                {isLow && <span className="ml-2 text-[9px] font-black uppercase tracking-widest text-amber-500">Low</span>}
              </td>
              <td className="px-8 py-6">
                <span className={`text-sm ${isDarkMode ? 'text-cream/60' : 'text-slate-600'}`}>{item.min_threshold} {item.unit}</span>
              </td>
              <td className="px-8 py-6 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => onEditRecipe(item)}
                    className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${isDarkMode ? 'bg-white/5 text-cream/60 hover:text-gold hover:bg-gold/10' : 'bg-slate-50 text-slate-500 hover:bg-amber-50 hover:text-amber-700'}`}
                  >
                    Recipe
                  </button>
                  <button
                    onClick={() => onProduceBatch(item)}
                    className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-1 ${isDarkMode ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
                  >
                    <ChefHat size={10} />
                    Produce
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

export default SemiFinishedPanel;
```

- [ ] **Step 2: Export from `index.ts`**

Add to `frontend/src/components/dashboard/panels/index.ts`:
```typescript
export { default as SemiFinishedPanel } from './SemiFinishedPanel';
```

- [ ] **Step 3: Render in InventoryPanel or Dashboard**

Import and render `SemiFinishedPanel` inside `InventoryPanel.tsx`, below the Location Board section, or as a full-width section (not in the 2-col grid). Wire it up with placeholder callbacks for now:

```tsx
// in InventoryPanel.tsx props, add:
  semiFinishedItems: SemiFinishedItem[];
  onAddSemiFinished: () => void;
  onEditRecipe: (item: SemiFinishedItem) => void;
  onProduceBatch: (item: SemiFinishedItem) => void;

// in InventoryPanel JSX, after the grid </div>, add:
<SemiFinishedPanel
  isDarkMode={isDarkMode}
  semiFinishedItems={semiFinishedItems}
  editMode={editMode}
  onAddItem={onAddSemiFinished}
  onEditRecipe={onEditRecipe}
  onProduceBatch={onProduceBatch}
/>
```

Pass dummy `() => {}` callbacks from `Dashboard.tsx` for now — they'll be wired in Tasks 3 and 4.

- [ ] **Step 4: Commit**
```bash
git add frontend/src/components/dashboard/panels/SemiFinishedPanel.tsx frontend/src/components/dashboard/panels/index.ts frontend/src/components/dashboard/panels/InventoryPanel.tsx frontend/src/components/Dashboard.tsx
git commit -m "feat(ui): add SemiFinishedPanel list view"
```

---

### Task 3: `RecipeBuilderModal.tsx`

**Files:**
- Create: `frontend/src/components/dashboard/modals/RecipeBuilderModal.tsx`
- Create: `frontend/src/components/dashboard/hooks/useSemiFinishedMutations.ts`
- Modify: `frontend/src/components/Dashboard.tsx`
- Modify: `frontend/src/components/dashboard/types.ts`

- [ ] **Step 1: Create `useSemiFinishedMutations.ts`**

```typescript
import { api } from '../../../lib/api';

interface MutationDeps {
  fetchTabData: (tab: string) => void;
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export function useSemiFinishedMutations({ fetchTabData, addToast }: MutationDeps) {
  const handleCreateSemiFinished = async (payload: {
    name: string; unit: string; min_threshold: number; shelf_life_hours?: number | null;
  }) => {
    try {
      await api.post('/api/semi-finished', payload);
      addToast('Semi-finished item created', 'success');
      fetchTabData('inventory');
    } catch {
      addToast('Failed to create item', 'error');
    }
  };

  const handleSaveRecipe = async (itemId: number, items: Array<{ ingredient_id: number; quantity: number }>) => {
    try {
      await api.put(`/api/semi-finished/${itemId}/recipe`, { items });
      addToast('Recipe saved', 'success');
    } catch {
      addToast('Failed to save recipe', 'error');
    }
  };

  const handleProduceBatch = async (payload: { semi_finished_id: number; quantity: number }) => {
    try {
      const res = await api.post('/api/semi-finished/produce', payload);
      const newStock = res.data?.new_stock ?? '?';
      addToast(`Produced! New stock: ${newStock}`, 'success');
      fetchTabData('inventory');
    } catch {
      addToast('Production failed', 'error');
    }
  };

  const handleDeleteSemiFinished = async (itemId: number) => {
    try {
      await api.delete(`/api/semi-finished/${itemId}`);
      addToast('Item deactivated', 'success');
      fetchTabData('inventory');
    } catch {
      addToast('Failed to deactivate item', 'error');
    }
  };

  return { handleCreateSemiFinished, handleSaveRecipe, handleProduceBatch, handleDeleteSemiFinished };
}
```

- [ ] **Step 2: Create `RecipeBuilderModal.tsx`**

This modal fetches the recipe for an item on open, shows the existing lines, and lets the user add/remove/change lines. On save it calls `onSave` with the new recipe lines.

```tsx
import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { Ingredient, SemiFinishedItem } from '../types';
import { api } from '../../../lib/api';

interface RecipeLine {
  ingredient_id: number;
  ingredient_name: string;
  quantity: number;
  unit: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  item: SemiFinishedItem | null;
  ingredients: Record<string, Ingredient>;  // from inventory.materials
  onSave: (itemId: number, lines: Array<{ ingredient_id: number; quantity: number }>) => void;
  isDarkMode: boolean;
}

export const RecipeBuilderModal: React.FC<Props> = ({
  isOpen, onClose, item, ingredients, onSave, isDarkMode
}) => {
  const [lines, setLines] = useState<RecipeLine[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && item) {
      setLoading(true);
      api.get(`/api/semi-finished/${item.id}/recipe`)
        .then(res => setLines(res.data.items || []))
        .catch(() => setLines([]))
        .finally(() => setLoading(false));
    }
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  const ingredientEntries = Object.entries(ingredients);

  const addLine = () => {
    if (ingredientEntries.length === 0) return;
    const [name, ing] = ingredientEntries[0];
    setLines(prev => [...prev, {
      ingredient_id: (ing as any).id,
      ingredient_name: name,
      quantity: 1,
      unit: ing.unit,
    }]);
  };

  const updateLine = (idx: number, field: 'ingredient_id' | 'quantity', value: number) => {
    setLines(prev => {
      const next = [...prev];
      if (field === 'ingredient_id') {
        const entry = ingredientEntries.find(([, i]) => (i as any).id === value);
        if (entry) {
          next[idx] = { ...next[idx], ingredient_id: value, ingredient_name: entry[0], unit: entry[1].unit };
        }
      } else {
        next[idx] = { ...next[idx], quantity: value };
      }
      return next;
    });
  };

  const removeLine = (idx: number) => setLines(prev => prev.filter((_, i) => i !== idx));

  const handleSave = () => {
    onSave(item.id, lines.map(l => ({ ingredient_id: l.ingredient_id, quantity: l.quantity })));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`w-full max-w-lg rounded-2xl flex flex-col max-h-[85vh] ${isDarkMode ? 'bg-[#1a1a1c] text-white' : 'bg-white text-slate-900'}`}>
        <div className="p-6 border-b border-white/10 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xl font-bold">Recipe Builder</h2>
            <p className={`text-sm mt-0.5 ${isDarkMode ? 'text-white/50' : 'text-slate-400'}`}>{item.name}</p>
          </div>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {loading ? (
            <p className={`text-sm ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Loading recipe...</p>
          ) : lines.length === 0 ? (
            <p className={`text-sm ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>No recipe yet. Add ingredients below.</p>
          ) : (
            lines.map((line, idx) => (
              <div key={idx} className={`flex items-center gap-3 p-3 rounded-xl ${isDarkMode ? 'bg-white/5' : 'bg-slate-50'}`}>
                <select
                  value={line.ingredient_id}
                  onChange={e => updateLine(idx, 'ingredient_id', parseInt(e.target.value))}
                  className={`flex-1 p-2 rounded-lg text-sm border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}
                >
                  {ingredientEntries.map(([name, ing]) => (
                    <option key={(ing as any).id} value={(ing as any).id}>{name}</option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={line.quantity}
                  onChange={e => updateLine(idx, 'quantity', parseFloat(e.target.value))}
                  className={`w-24 p-2 rounded-lg text-sm border text-right ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}
                />
                <span className={`text-xs w-8 shrink-0 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>{line.unit}</span>
                <button onClick={() => removeLine(idx)} className="text-rose-400 hover:text-rose-500">
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
        <div className="p-6 border-t border-white/10 flex gap-3 shrink-0">
          <button
            onClick={addLine}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold ${isDarkMode ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            <Plus size={14} /> Add Ingredient
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2 bg-gold text-black font-bold rounded-xl text-sm"
          >
            Save Recipe
          </button>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 3: Wire up in `Dashboard.tsx`**

```tsx
// imports
import { RecipeBuilderModal } from './dashboard/modals/RecipeBuilderModal';
import { useSemiFinishedMutations } from './dashboard/hooks/useSemiFinishedMutations';

// state
const [showRecipeModal, setShowRecipeModal] = useState(false);
const [activeSFItem, setActiveSFItem] = useState<SemiFinishedItem | null>(null);

const { handleCreateSemiFinished, handleSaveRecipe, handleProduceBatch, handleDeleteSemiFinished }
  = useSemiFinishedMutations({ fetchTabData, addToast });

// JSX
{showRecipeModal && (
  <RecipeBuilderModal
    isOpen={showRecipeModal}
    onClose={() => setShowRecipeModal(false)}
    item={activeSFItem}
    ingredients={bakery.inventory.materials}
    onSave={handleSaveRecipe}
    isDarkMode={isDarkMode}
  />
)}
```

Pass `onEditRecipe={(item) => { setActiveSFItem(item); setShowRecipeModal(true); }}` down to `InventoryPanel`.

- [ ] **Step 4: Commit**
```bash
git add frontend/src/components/dashboard/modals/RecipeBuilderModal.tsx frontend/src/components/dashboard/hooks/useSemiFinishedMutations.ts frontend/src/components/Dashboard.tsx
git commit -m "feat(ui): add Recipe Builder modal and semi-finished mutations hook"
```

---

### Task 4: `ProduceBatchModal.tsx`

**Files:**
- Create: `frontend/src/components/dashboard/modals/ProduceBatchModal.tsx`
- Modify: `frontend/src/components/Dashboard.tsx`

- [ ] **Step 1: Create `ProduceBatchModal.tsx`**

```tsx
import React, { useState } from 'react';
import { X, ChefHat } from 'lucide-react';
import { SemiFinishedItem } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  item: SemiFinishedItem | null;
  onProduce: (payload: { semi_finished_id: number; quantity: number }) => void;
  isDarkMode: boolean;
}

export const ProduceBatchModal: React.FC<Props> = ({ isOpen, onClose, item, onProduce, isDarkMode }) => {
  const [qty, setQty] = useState('1');

  if (!isOpen || !item) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(qty);
    if (isNaN(parsed) || parsed <= 0) return;
    onProduce({ semi_finished_id: item.id, quantity: parsed });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`w-full max-w-sm rounded-2xl p-6 ${isDarkMode ? 'bg-[#1a1a1c] text-white' : 'bg-white text-slate-900'}`}>
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-bold flex items-center gap-2"><ChefHat size={20} /> Produce Batch</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <p className={`text-sm mb-6 ${isDarkMode ? 'text-white/50' : 'text-slate-400'}`}>{item.name}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold mb-2">Quantity to Produce ({item.unit})</label>
            <input
              type="number"
              step="0.001"
              min="0.001"
              value={qty}
              onChange={e => setQty(e.target.value)}
              className={`w-full p-3 rounded-xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}
              required
            />
          </div>
          <p className={`text-xs ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>
            This will consume ingredients according to the recipe and add {qty || '0'} {item.unit} to stock.
          </p>
          <button type="submit" className="w-full py-3 bg-emerald-500 text-white font-bold rounded-xl">
            Confirm Production
          </button>
        </form>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Wire up in `Dashboard.tsx`**

```tsx
import { ProduceBatchModal } from './dashboard/modals/ProduceBatchModal';

// state (reuse activeSFItem from Task 3)
const [showProduceModal, setShowProduceModal] = useState(false);

// JSX
{showProduceModal && (
  <ProduceBatchModal
    isOpen={showProduceModal}
    onClose={() => setShowProduceModal(false)}
    item={activeSFItem}
    onProduce={handleProduceBatch}
    isDarkMode={isDarkMode}
  />
)}
```

Pass `onProduceBatch={(item) => { setActiveSFItem(item); setShowProduceModal(true); }}` down to `InventoryPanel`.

- [ ] **Step 3: Verify build passes**
```bash
cd /home/dane/bakery-os/frontend && npm run build
```
Expected: `✓ built in X.Xs`

- [ ] **Step 4: Commit**
```bash
git add frontend/src/components/dashboard/modals/ProduceBatchModal.tsx frontend/src/components/Dashboard.tsx
git commit -m "feat(ui): add Produce Batch modal for semi-finished goods"
```

---

## Self-Review Checklist

- [x] All 7 backend endpoints accounted for in the UI
- [x] `SemiFinishedItem` type matches `SemiFinishedItemResponse` from backend schemas
- [x] Lazy fetch: semi-finished items fetched only on `inventory` tab
- [x] No inline `any`-typed API calls — all use `api.get/post/put/delete` from `lib/api`
- [x] Dark mode handled for every new component
- [x] `activeSFItem` state is shared across Recipe and Produce modals (same `useState` in Dashboard.tsx)
- [x] Ingredients are identified by `(ing as any).id` — this is a gap; ideally the `Ingredient` type should have an `id` field. Flag as DONE_WITH_CONCERNS if the ingredient type doesn't have `id` — don't break the app trying to fix it.
