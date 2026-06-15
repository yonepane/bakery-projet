# BakeryOS Daily Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement daily usability improvements: Notification click-outside, Interactive Recipe Scaling, Global Command Palette, and POS Quick Cash Payments.

**Architecture:** We will modify the existing `Dashboard.tsx` for notifications and recipe scaling, extract the Command Palette into its own component `CommandPalette.tsx` to keep things clean, and update `POSPanel.tsx` for the quick payment buttons.

**Tech Stack:** React, Tailwind CSS, Framer Motion, Lucide Icons

---

### Task 1: Notifications Dropdown Click-Outside

**Files:**
- Modify: `frontend/src/components/Dashboard.tsx`

- [ ] **Step 1: Add click-outside logic to Dashboard.tsx**

Modify `Dashboard.tsx` around the notification panel. Import `useRef` if not already imported.

```tsx
// Inside Dashboard component, near other refs:
const notificationRef = useRef<HTMLDivElement>(null);

// Add useEffect for click outside:
useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
      setShowNotifications(false);
    }
  };

  if (showNotifications) {
    document.addEventListener('mousedown', handleClickOutside);
  }
  return () => {
    document.removeEventListener('mousedown', handleClickOutside);
  };
}, [showNotifications]);
```

- [ ] **Step 2: Attach ref to the notifications dropdown**

In `Dashboard.tsx` JSX where the notifications panel is rendered:
```tsx
// Find the AnimatePresence for showNotifications and add ref to the absolute div
{showNotifications && (
  <motion.div
    ref={notificationRef}
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 10 }}
    className={`absolute right-0 mt-4 w-96 rounded-3xl border shadow-2xl z-50 overflow-hidden ${isDarkMode ? 'bg-[#0a0a0b] border-white/10' : 'bg-white border-slate-200'}`}
  >
    {/* existing notification content */}
  </motion.div>
)}
```

- [ ] **Step 3: Run app to verify**

Run: `npm run dev` in `frontend/`
Expected: Clicking the bell opens notifications. Clicking anywhere else on the screen closes it.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Dashboard.tsx
git commit -m "fix: close notifications on click outside"
```

---

### Task 2: Interactive Recipe Scaling & Baker's Checklist

**Files:**
- Modify: `frontend/src/components/Dashboard.tsx`

- [ ] **Step 1: Add scaling and checklist state to Dashboard.tsx**

In `Dashboard.tsx`, near `selectedProduct`:
```tsx
const [targetYield, setTargetYield] = useState<number>(0);
const [checkedIngredients, setCheckedIngredients] = useState<Record<string, boolean>>({});

// Reset state when a product is selected
useEffect(() => {
  if (selectedProduct) {
    setTargetYield(selectedProduct.yield_qty || 1);
    setCheckedIngredients({});
  }
}, [selectedProduct]);
```

- [ ] **Step 2: Implement Scaling UI in Recipe Modal**

In `Dashboard.tsx` where `selectedProduct` details are rendered:
```tsx
// Replace the yield span with an interactive input
<div className="flex items-center gap-4 mt-4">
  <label className="text-[10px] font-black uppercase tracking-widest text-cream/40">Target Yield:</label>
  <input 
    type="number" 
    value={targetYield}
    onChange={(e) => setTargetYield(Number(e.target.value))}
    className={`w-24 px-3 py-1 rounded-full text-center text-sm font-bold ${isDarkMode ? 'bg-white/5 text-white' : 'bg-slate-100 text-slate-900'}`}
    min="1"
  />
  <span className="text-[10px] font-black uppercase tracking-widest text-cream/40 bg-white/5 px-3 py-1 rounded-full">Base Yield: {selectedProduct.yield_qty} Units</span>
</div>
```

- [ ] **Step 3: Apply Multiplier and Checklist to Ingredients List**

In the ingredients `.map` inside `selectedProduct`:
```tsx
const scaleMultiplier = (targetYield || 1) / (selectedProduct.yield_qty || 1);

// Replace the ingredient rendering loop:
{selectedProduct.ingredients.map((ing, i) => {
  const scaledQty = (ing.quantity * scaleMultiplier).toFixed(2);
  const isChecked = checkedIngredients[ing.name] || false;
  
  return (
    <div key={i} className="flex justify-between items-center py-3 border-b border-white/5 last:border-0 group cursor-pointer" onClick={() => setCheckedIngredients(prev => ({...prev, [ing.name]: !prev[ing.name]}))}>
      <div className="flex items-center gap-3">
        <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${isChecked ? 'bg-gold border-gold text-charcoal' : 'border-white/20'}`}>
          {isChecked && <CheckCircle size={12} />}
        </div>
        <span className={`transition-opacity ${isChecked ? 'opacity-30 line-through' : ''}`}>{ing.name}</span>
      </div>
      <div className="text-right">
        <p className={`font-bold transition-opacity ${isChecked ? 'opacity-30' : ''}`}>{scaledQty} {ing.unit}</p>
      </div>
    </div>
  );
})}
```

- [ ] **Step 4: Run app to verify**

Run: `npm run dev` in `frontend/`
Expected: Opening a recipe allows changing the target yield, which updates ingredient quantities. Clicking an ingredient checks it off.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Dashboard.tsx
git commit -m "feat: add interactive recipe scaling and baker checklist"
```

---

### Task 3: Global Command Palette

**Files:**
- Create: `frontend/src/components/CommandPalette.tsx`
- Modify: `frontend/src/components/Dashboard.tsx`

- [ ] **Step 1: Create CommandPalette.tsx**

```tsx
import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const CommandPalette = ({ isOpen, onClose, isDarkMode, actions }) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onClose(false); } // Toggle externally
      if (e.key === 'Escape') onClose(true);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  const filteredActions = actions.filter(a => a.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-start justify-center pt-32 bg-black/50 backdrop-blur-sm" onClick={() => onClose(true)}>
        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} onClick={e => e.stopPropagation()} className={`w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl border ${isDarkMode ? 'bg-[#0a0a0b] border-white/10' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center px-6 py-4 border-b border-white/10">
            <Search className="text-slate-400 mr-4" size={24} />
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Type a command or search..." className="flex-1 bg-transparent border-none outline-none text-xl" />
            <button onClick={() => onClose(true)}><X size={24} className="text-slate-400" /></button>
          </div>
          <div className="max-h-96 overflow-y-auto p-2">
            {filteredActions.map((action, i) => (
              <button key={i} onClick={() => { action.onSelect(); onClose(true); setQuery(''); }} className={`w-full text-left px-6 py-4 rounded-2xl flex items-center justify-between hover:bg-gold/10 hover:text-gold transition-colors`}>
                <span className="font-bold">{action.name}</span>
                <span className="text-xs uppercase tracking-widest opacity-40">{action.category}</span>
              </button>
            ))}
            {filteredActions.length === 0 && <div className="p-8 text-center opacity-40">No commands found.</div>}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
```

- [ ] **Step 2: Integrate into Dashboard.tsx**

In `Dashboard.tsx`:
```tsx
import { CommandPalette } from './CommandPalette';

// In component state:
const [showCommandPalette, setShowCommandPalette] = useState(false);

useEffect(() => {
  const handleCmdK = (e: KeyboardEvent) => {
    if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || e.key === '/') {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      setShowCommandPalette(true);
    }
  };
  window.addEventListener('keydown', handleCmdK);
  return () => window.removeEventListener('keydown', handleCmdK);
}, []);

// Define actions
const commandActions = [
  { name: 'Go to POS', category: 'Navigation', onSelect: () => setActiveTab('pos') },
  { name: 'Go to Kitchen', category: 'Navigation', onSelect: () => setActiveTab('kitchen') },
  // Map products to recipe open actions
  ...bakery.inventory.products.map(p => ({
    name: `Recipe: ${p.name}`,
    category: 'Products',
    onSelect: () => setSelectedProduct(p)
  }))
];

// Add to JSX, right before the closing tag of the main dashboard div
<CommandPalette isOpen={showCommandPalette} onClose={() => setShowCommandPalette(false)} isDarkMode={isDarkMode} actions={commandActions} />
```

- [ ] **Step 3: Run app to verify**

Run: `npm run dev`
Expected: Pressing `Ctrl+K` or `/` opens the palette. Searching and clicking an action triggers it.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/CommandPalette.tsx frontend/src/components/Dashboard.tsx
git commit -m "feat: add global command palette"
```

---

### Task 4: POS Quick Payment & Cash Assistant

**Files:**
- Modify: `frontend/src/components/dashboard/panels/POSPanel.tsx`

- [ ] **Step 1: Add Payment State to POSPanel.tsx**

```tsx
// Inside POSPanel component:
const [cashGiven, setCashGiven] = useState<number | null>(null);

// In the checkout logic, reset cashGiven when cart is cleared or checkout completes.
```

- [ ] **Step 2: Implement UI for Quick Cash**

In `POSPanel.tsx`, find the checkout/cart summary area (usually under Total calculation) and add:
```tsx
const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

<div className="mt-6 mb-4">
  <p className={`text-xs font-black uppercase tracking-widest mb-3 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>Quick Cash Payment</p>
  <div className="grid grid-cols-4 gap-2">
    <button onClick={() => setCashGiven(total)} className={`py-2 rounded-xl text-sm font-bold border transition-colors ${cashGiven === total ? 'bg-gold text-charcoal border-gold' : isDarkMode ? 'bg-white/5 border-white/10 hover:border-gold/30' : 'bg-slate-50 border-slate-200'}`}>Exact</button>
    {[50, 100, 200].map(amt => (
      <button key={amt} onClick={() => setCashGiven(amt)} className={`py-2 rounded-xl text-sm font-bold border transition-colors ${cashGiven === amt ? 'bg-gold text-charcoal border-gold' : isDarkMode ? 'bg-white/5 border-white/10 hover:border-gold/30' : 'bg-slate-50 border-slate-200'}`}>{amt}</button>
    ))}
  </div>
  {cashGiven !== null && (
    <div className={`mt-4 p-4 rounded-2xl flex justify-between items-center ${cashGiven >= total ? (isDarkMode ? 'bg-green-500/10 text-green-400' : 'bg-green-50 text-green-700') : (isDarkMode ? 'bg-rose-500/10 text-rose-400' : 'bg-rose-50 text-rose-700')}`}>
      <span className="font-bold text-sm uppercase tracking-widest">Change Due:</span>
      <span className="text-2xl font-black">{cashGiven >= total ? (cashGiven - total).toFixed(2) : 'Insufficient'} <span className="text-sm">MAD</span></span>
    </div>
  )}
</div>
```

- [ ] **Step 3: Run app to verify**

Run: `npm run dev`
Expected: Adding items to the POS cart and clicking '100' shows the change due immediately.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/dashboard/panels/POSPanel.tsx
git commit -m "feat: add POS quick cash payment buttons"
```
