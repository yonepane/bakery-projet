# BakeryOS Daily Usability Improvements Design Spec

## Overview
This document specifies four workflow improvements for BakeryOS aimed at streamlining daily operations in the kitchen, register, and back-office.

## Features

### 1. Interactive Recipe Scaling & Baker's Checklist
**Location:** `Dashboard.tsx` (Recipe Detail Modal)
**Details:**
- Add a "Target Yield" interactive input/slider, defaulting to the product's base `yield_qty`.
- As the target yield changes, dynamically calculate a `scaleMultiplier` (Target / Base).
- Multiply all ingredient quantities by the `scaleMultiplier` in the UI.
- Add a transient checklist toggle (checkbox) next to each ingredient row so bakers can check them off as they weigh them.

### 2. Global Command Palette
**Location:** `Dashboard.tsx` (Root level overlay)
**Details:**
- Implement a global `Cmd+K` / `Ctrl+K` and `/` keyboard listener.
- When triggered, open a glassmorphic modal with a search input.
- **Commands Available:**
  - *Navigation:* "Go to Kitchen", "Go to POS", etc.
  - *Quick Actions:* "Log Waste" (opens an alert/toast), "Add Expense" (opens expense modal if possible, or navigates to Finance).
  - *Search:* Typing a product name filters and allows clicking to instantly open the Recipe Detail Modal.
- Supports keyboard navigation (Up/Down/Enter) and click outside to close.

### 3. POS Quick Payment & Cash Assistant
**Location:** `POSPanel.tsx`
**Details:**
- In the checkout/cart summary section, add quick-cash preset buttons.
- **Presets:** Exact Amount, 50 MAD, 100 MAD, 200 MAD (currency from settings).
- Clicking a preset calculates the change due immediately and clearly displays it before finalizing the checkout.

### 4. Notifications Dropdown Click-Outside
**Location:** `Dashboard.tsx`
**Details:**
- Add a `useRef` to the notifications dropdown container.
- Implement a `useEffect` with a `mousedown` document listener.
- If the user clicks outside the ref bounds while `showNotifications` is true, set `showNotifications` to false.

## Technical Considerations
- All changes must adhere to the existing high-end UI/UX style (Framer Motion animations, Tailwind glassmorphism).
- State for checklists and scaling is purely local to the modal; it resets when the modal closes.
- POS Quick Payments must respect the user's active currency.
