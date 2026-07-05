# Pastry Usability Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Recipe Duplication, Smart Unit Parser, and Kitchen Mode to improve usability for pastry managers and kitchen staff.

**Architecture:** Add duplication endpoint in backend; add unit parser utility in frontend; add client-side kitchenMode state filtering sidebar navigation and hiding financial data in panels.

**Tech Stack:** FastAPI, SQLAlchemy, React, TypeScript

---

## Plan of Action

### Task 1: Backend Recipe Duplication

**Files:**
- Create: `backend/tests/test_duplication.py`
- Modify: `backend/routers/catalog.py`

- [ ] **Step 1: Write the failing test**
  Create `backend/tests/test_duplication.py` with:
  ```python
  def test_duplicate_product_success(client, auth_headers):
      # Create original product
      client.post("/api/materials", json={
          "name": "Butter", "unit": "g", "price": 0.05, "min_threshold": 100
      }, headers=auth_headers)
      
      client.post("/api/products", json={
          "id": "croissant",
          "name": "Croissant",
          "price": 2.5,
          "icon": "🥐",
          "ingredients": [{"name": "Butter", "quantity": 50}],
      }, headers=auth_headers)
      
      # Duplicate product
      resp = client.post("/api/products/croissant/duplicate", headers=auth_headers)
      assert resp.status_code == 200
      new_id = resp.json()["new_product_id"]
      assert new_id == "croissant-copy"
      
      # Verify duplicated product has the same ingredients
      inv = client.get("/api/inventory", headers=auth_headers).json()
      products = {p["id"]: p for p in inv["products"]}
      assert "croissant-copy" in products
      assert products["croissant-copy"]["name"] == "Croissant (Copy)"
      assert products["croissant-copy"]["price"] == 2.5
      assert len(products["croissant-copy"]["ingredients"]) == 1
      assert products["croissant-copy"]["ingredients"][0]["name"] == "Butter"
      assert products["croissant-copy"]["ingredients"][0]["quantity"] == 50
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `cd /home/dane/bakery-os/backend && python -m pytest tests/test_duplication.py -v`
  Expected: FAIL (404 Not Found)

- [ ] **Step 3: Write minimal implementation**
  Add the endpoint in `backend/routers/catalog.py`:
  ```python
  @router.post("/api/products/{id}/duplicate", dependencies=[Depends(requires_roles(["owner"]))])
  async def duplicate_product(
      id: str,
      db: sqlalchemy.orm.Session = Depends(get_db),
      owner_id: int = Depends(get_effective_owner_id),
  ):
      original = db.query(models.Product).filter(
          models.Product.id == id,
          models.Product.owner_id == owner_id,
      ).first()
      if not original:
          raise HTTPException(status_code=404, detail="Product not found")

      new_id = f"{id}-copy"
      new_name = f"{original.name} (Copy)"
      
      suffix = 1
      while db.query(models.Product).filter(models.Product.id == new_id, models.Product.owner_id == owner_id).first():
          new_id = f"{id}-copy-{suffix}"
          new_name = f"{original.name} (Copy {suffix})"
          suffix += 1

      new_prod = models.Product(
          id=new_id,
          owner_id=owner_id,
          name=new_name,
          price=original.price,
          icon=original.icon,
          prep_time=original.prep_time,
          cook_time=original.cook_time,
          yield_qty=original.yield_qty,
          instructions=original.instructions,
          stock=0,
      )
      db.add(new_prod)
      db.flush()

      for item in original.recipe_items:
          recipe_item = models.RecipeItem(
              product_id=new_prod.id,
              ingredient_id=item.ingredient_id,
              quantity=item.quantity,
          )
          db.add(recipe_item)

      db.commit()
      return {"success": True, "new_product_id": new_prod.id}
  ```

- [ ] **Step 4: Run test to verify it passes**
  Run: `cd /home/dane/bakery-os/backend && python -m pytest tests/test_duplication.py -v`
  Expected: PASS

- [ ] **Step 5: Run full backend test suite**
  Run: `cd /home/dane/bakery-os/backend && python -m pytest -v`
  Expected: All 21 tests pass.

- [ ] **Step 6: Commit**
  Run:
  ```bash
  git -C /home/dane/bakery-os add backend/routers/catalog.py backend/tests/test_duplication.py
  git -C /home/dane/bakery-os commit -m "feat: add backend product duplication endpoint"
  ```

---

### Task 2: Frontend Recipe Duplication

**Files:**
- Modify: `frontend/src/components/dashboard/types.ts`
- Modify: `frontend/src/components/Dashboard.tsx`
- Modify: `frontend/src/components/dashboard/panels/FichePanel.tsx`

- [ ] **Step 1: Update type definitions**
  In `frontend/src/components/dashboard/types.ts`, add `handleDuplicateProduct` to `DashboardSharedProps`:
  ```typescript
  handleDuplicateProduct: (id: string) => void;
  ```

- [ ] **Step 2: Implement handler in `Dashboard.tsx`**
  In `Dashboard.tsx`, implement the duplication handler:
  ```typescript
  const handleDuplicateProduct = async (id: string) => {
    try {
      const res = await api.post(`/products/${id}/duplicate`);
      if (res.data.success) {
        addToast("Recipe duplicated successfully", "success");
        fetchData();
      }
    } catch (e: any) {
      addToast("Failed to duplicate recipe", "error");
    }
  };
  ```
  Add `handleDuplicateProduct` to the `panelProps` object:
  ```typescript
  const panelProps: DashboardSharedProps = {
    // ...
    handleDuplicateProduct,
  };
  ```

- [ ] **Step 3: Update `FichePanel.tsx` props and add duplicate button**
  In `frontend/src/components/dashboard/panels/FichePanel.tsx`:
  - Import `Copy` from `lucide-react`:
    ```typescript
    import { Edit2, Plus, Trash2, X, Copy } from 'lucide-react';
    ```
  - Add `handleDuplicateProduct` to the `Props` Pick list and destructure list.
  - Insert the duplication button in the card header next to the edit button:
    ```tsx
    {editMode && (
      <div className="flex gap-2">
        <button onClick={() => handleDuplicateProduct(p.id)} className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-all" title="Duplicate Recipe">
          <Copy size={16} />
        </button>
        <button onClick={() => handleOpenEditProduct(p)} className="p-2 rounded-lg bg-gold/10 text-gold hover:bg-gold/20 transition-all" title={t('edit_product')}>
          <Edit2 size={16} />
        </button>
      </div>
    )}
    ```

- [ ] **Step 4: Commit**
  Run:
  ```bash
  git -C /home/dane/bakery-os add frontend/src/components/dashboard/types.ts frontend/src/components/Dashboard.tsx frontend/src/components/dashboard/panels/FichePanel.tsx
  git -C /home/dane/bakery-os commit -m "feat: implement frontend recipe duplication button"
  ```

---

### Task 3: Smart Unit Parser

**Files:**
- Modify: `frontend/src/components/dashboard/utils.ts`
- Modify: `frontend/src/components/dashboard/panels/FichePanel.tsx`
- Modify: `frontend/src/components/dashboard/panels/InventoryPanel.tsx`

- [ ] **Step 1: Add parser utility in `utils.ts`**
  In `frontend/src/components/dashboard/utils.ts`, append the `parseQtyString` helper:
  ```typescript
  export const parseQtyString = (input: string, baseUnit: string): number => {
    const cleaned = input.trim().toLowerCase();
    const val = parseFloat(cleaned);
    if (isNaN(val)) return 0;
    
    const suffix = cleaned.replace(val.toString(), '').trim();
    if (!suffix) return val;

    if (baseUnit === 'g') {
      if (suffix === 'kg') return val * 1000;
      if (suffix === 'g') return val;
    }
    if (baseUnit === 'ml') {
      if (suffix === 'l') return val * 1000;
      if (suffix === 'ml') return val;
    }
    if (baseUnit === 'L' || baseUnit === 'l') {
      if (suffix === 'ml') return val / 1000;
      if (suffix === 'l') return val;
    }
    if (baseUnit === 'kg') {
      if (suffix === 'g') return val / 1000;
      if (suffix === 'kg') return val;
    }
    return val;
  };
  ```

- [ ] **Step 2: Update `FichePanel.tsx` to parse input**
  In `FichePanel.tsx`:
  - Import `parseQtyString` from `../utils`.
  - Update the ingredient selector handler to parse user inputs (e.g. `2kg`):
    ```typescript
    const qty = prompt(`Enter quantity for ${e.target.value} in ${promptUnit}:`, "100");
    if (qty) {
      const parsed = parseQtyString(qty, mat ? mat.unit : 'g');
      if (parsed > 0) {
        const newIngredients = [...p.ingredients, { name: e.target.value, quantity: parsed }];
        handleUpdateProductField(p.id, 'ingredients', newIngredients);
      }
    }
    ```

- [ ] **Step 3: Update `InventoryPanel.tsx` to parse input**
  In `InventoryPanel.tsx`:
  - Import `parseQtyString` from `../utils`.
  - Update the Quick Stock handler to parse user inputs:
    ```typescript
    onConfirm: (val) => {
      const parsed = parseQtyString(val, data.unit);
      if (parsed !== 0) handleAdjustStock('material', name, parsed);
    }
    ```

- [ ] **Step 4: Commit**
  Run:
  ```bash
  git -C /home/dane/bakery-os add frontend/src/components/dashboard/utils.ts frontend/src/components/dashboard/panels/FichePanel.tsx frontend/src/components/dashboard/panels/InventoryPanel.tsx
  git -C /home/dane/bakery-os commit -m "feat: add smart unit parser for ingredient and stock inputs"
  ```

---

### Task 4: Kitchen Mode Toggle

**Files:**
- Modify: `frontend/src/components/dashboard/types.ts`
- Modify: `frontend/src/components/Dashboard.tsx`
- Modify: `frontend/src/components/dashboard/panels/InventoryPanel.tsx`
- Modify: `frontend/src/components/dashboard/panels/FichePanel.tsx`

- [ ] **Step 1: Update type definitions**
  In `frontend/src/components/dashboard/types.ts`, add `kitchenMode` to `DashboardSharedProps`:
  ```typescript
  kitchenMode?: boolean;
  ```

- [ ] **Step 2: Implement state & toggle in `Dashboard.tsx`**
  In `Dashboard.tsx`:
  - Declare state:
    ```typescript
    const [kitchenMode, setKitchenMode] = useState(false);
    ```
  - Pass `kitchenMode` in `panelProps`.
  - Add Kitchen Mode button to the header layout near the theme toggle:
    ```tsx
    {/* Kitchen Mode Toggle */}
    <button 
      onClick={() => {
        const next = !kitchenMode;
        setKitchenMode(next);
        if (next) {
          setActiveTab('kitchen');
        } else {
          setActiveTab('dashboard');
        }
        addToast(`Switched to ${next ? 'Kitchen' : 'Manager'} mode`, 'info');
      }} 
      className={`px-4 py-2 rounded-2xl border transition-all flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-widest ${isDarkMode ? 'glass-panel hover:bg-white/5 border-gold/10 text-gold' : 'border-slate-200 bg-white shadow-sm text-slate-600 hover:bg-slate-50'}`}
      title="Toggle Kitchen Mode"
    >
      <ClipboardList size={18} />
      <span>{kitchenMode ? 'Kitchen Mode' : 'Manager Mode'}</span>
    </button>
    ```
  - Update the sidebar tabs filtering to hide financial tabs when `kitchenMode` is active:
    ```typescript
    .filter(item => {
      if (user?.role === 'cashier' && ['simulator', 'inventory', 'purchasing', 'intelligence'].includes(item.id)) return false;
      if (kitchenMode && ['simulator', 'intelligence', 'purchasing', 'history', 'pos', 'dashboard', 'comptabilite', 'orders', 'expenses', 'staff', 'customers', 'settings'].includes(item.id)) return false;
      return true;
    })
    ```

- [ ] **Step 3: Hide prices in `InventoryPanel.tsx`**
  In `InventoryPanel.tsx`:
  - Extract `kitchenMode` from props.
  - Hide pricing column headers, rows, and values if `kitchenMode` is true:
    - Products table: Hide Price/Value header and corresponding cells.
    - Raw materials table: Hide the raw cost labels (`$0.05/g`).
    ```tsx
    {/* Under products header */}
    {!kitchenMode && <th className="px-8 py-6 text-right">{t('price_value')}</th>}

    {/* Under products mapping */}
    {!kitchenMode && (
      <td className="px-8 py-6 text-right">
        {/* ... price values ... */}
      </td>
    )}

    {/* Under raw materials layout */}
    <p className={`font-bold truncate ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>{name}</p>
    {!kitchenMode && (
      <p className={`text-[10px] uppercase font-bold tracking-widest ${isDarkMode ? 'text-gold/60' : 'text-slate-400'}`}>{formatPrice(data.price)}/{data.unit}</p>
    )}
    ```

- [ ] **Step 4: Hide margins and costs in `FichePanel.tsx`**
  In `FichePanel.tsx`:
  - Extract `kitchenMode` from props.
  - Wrap cost and margin details in a check `{!kitchenMode && ...}`:
    - Hide unit cost block.
    - Hide true net margin block.
    ```tsx
    {/* Under unit_cost container */}
    {!kitchenMode && (
      <div>
        <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gold' : 'text-slate-400'}`}>{t('unit_cost')}</p>
        <p className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{formatPrice(materialCost)}</p>
        {hourlyWage > 0 && (
          <p className={`text-[9px] font-bold mt-1 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>
            +{formatPrice(laborCostPerUnit)} labor
          </p>
        )}
      </div>
    )}

    {/* Under true_net_margin container */}
    {!kitchenMode && (
      <div>
        <p className={`text-[10px] font-black uppercase tracking-widest ${isLowMargin ? 'text-rose-500' : (isDarkMode ? 'text-emerald-500/50' : 'text-emerald-600')}`}>{t('true_net_margin')}</p>
        <p className={`text-xl font-bold ${isLowMargin ? 'text-rose-500' : 'text-emerald-500'}`}>{margin}%</p>
        {hourlyWage > 0 && (
          <p className={`text-[9px] font-black uppercase tracking-widest mt-1 ${isDarkMode ? 'text-cream/30' : 'text-slate-400'}`}>
            incl. {formatPrice(laborCostPerUnit)} / unit labor
          </p>
        )}
      </div>
    )}
    ```

- [ ] **Step 5: Run typescript checks & compile**
  Run: `cd /home/dane/bakery-os/frontend && npx tsc --noEmit`
  Expected: Success (no compiler errors)

- [ ] **Step 6: Commit**
  Run:
  ```bash
  git -C /home/dane/bakery-os add frontend/src/components/dashboard/types.ts frontend/src/components/Dashboard.tsx frontend/src/components/dashboard/panels/InventoryPanel.tsx frontend/src/components/dashboard/panels/FichePanel.tsx
  git -C /home/dane/bakery-os commit -m "feat: implement kitchen mode toggle hiding financial data"
  ```
