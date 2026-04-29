/**
 * DashboardSharedProps — the full set of props that Dashboard.tsx passes
 * down to each panel. Every panel picks only what it needs via `Pick<>`.
 *
 * Keep this file in sync whenever new state is added to Dashboard.tsx.
 */
export interface DashboardSharedProps {
  // ─── Auth / User ─────────────────────────────────────────────────────────
  user: UserSession | null;
  API_BASE: string;
  settings: any;

  // ─── UI ──────────────────────────────────────────────────────────────────
  isDarkMode: boolean;
  setIsDarkMode: (v: boolean) => void;
  activeCurrency: string;
  setActiveCurrency: (v: string) => void;
  editMode: boolean;
  setEditMode: (v: boolean) => void;
  t: Record<string, string>;
  lang: string;
  setLang: (l: string) => void;

  // ─── Data ─────────────────────────────────────────────────────────────────
  inventory: { materials: Record<string, Ingredient>; products: Product[] };
  analytics: Analytics;
  history: Transaction[];
  planner: PlanItem[];
  orders: any[];
  expenses: any[];
  suppliers: any[];
  purchaseOrders: any[];
  purchasingSuggestions: any[];
  selectedSupplierId: number | null;
  setSelectedSupplierId: (id: number | null) => void;
  staff: any[];
  shiftLogs: any[];
  alerts: DashboardAlert[];
  profitReport: any[];
  wasteRecords: any[];
  accountingRange: { start: string; end: string };
  setAccountingRange: (r: { start: string; end: string }) => void;
  monthStart: string;
  monthEnd: string;

  // ─── Derived accounting metrics ──────────────────────────────────────────
  accountingFeed: any[];
  draftPurchaseCommitment: number;
  expenseBreakdown: [string, number][];
  filteredExpenses: any[];
  filteredPurchaseOrders: any[];
  filteredSales: any[];
  filteredWaste: any[];
  monthlyExpensesTotal: number;
  monthlyNetAfterExpenses: number;
  monthlySales: number;
  productProfitability: any[];
  wasteByProduct: any[];

  // ─── POS ──────────────────────────────────────────────────────────────────
  cart: CartItem[];
  setCart: (cart: CartItem[]) => void;
  addToCart: (product: Product) => void;
  finalizeSale: () => void;
  lastTransaction: any;

  // ─── Modals ───────────────────────────────────────────────────────────────
  setShowReceiptModal: (v: boolean) => void;
  setShowBookingModal: (v: boolean) => void;
  bookingForm: { name: string; phone: string; date: string; source: 'pos' | 'ledger' };
  setBookingForm: (f: any) => void;
  setShowAddProduct: (v: boolean) => void;
  setShowAddMaterial: (v: boolean) => void;
  setShowAddExpense: (v: boolean) => void;
  setShowAddSupplier: (v: boolean) => void;
  setShowAddStaff: (v: boolean) => void;
  setShowPOModal: (v: boolean) => void;
  setShowWasteModal: (v: boolean) => void;
  editingProductId: string | null;
  setEditingProductId: (id: string | null) => void;
  editingMaterialName: string | null;
  setEditingMaterialName: (name: string | null) => void;
  editingSupplier: any;
  setEditingSupplier: (s: any) => void;
  newMaterial: any;
  setNewMaterial: (m: any) => void;
  newSupplier: { name: string; contact_info: string };
  setNewSupplier: (s: { name: string; contact_info: string }) => void;
  selectedPO: any;
  setSelectedPO: (po: any) => void;
  poReceiveDraft: Record<string, { qty: number; price: number }>;
  setPoReceiveDraft: (d: any) => void;

  // ─── Planner / simulation ─────────────────────────────────────────────────
  simPrices: Record<string, number>;
  setSimPrices: (p: Record<string, number>) => void;
  simulatedInflations: Record<string, number>;
  setSimulatedInflations: (p: Record<string, number>) => void;
  simulationResult: any[];
  runSimulation: () => void;
  saveSimulation: () => void;
  isForecasting: boolean;
  handleSmartForecast: (date: string) => void;
  handleProduce: (productId: string, qty: number) => void;
  setPlanner: (p: PlanItem[]) => void;
  setSelectedProduct: (p: Product | null) => void;

  // ─── Shift log ────────────────────────────────────────────────────────────
  generalNote: string;
  setGeneralNote: (n: string) => void;
  isSavingGeneralNote: boolean;
  handleSaveGeneralNote: () => void;
  handleDeleteShiftLog: (id: string) => void;

  // ─── Sorted material helpers ──────────────────────────────────────────────
  sortedMaterialEntries: [string, Ingredient][];
  sortedMaterialNames: string[];

  // ─── Handlers ────────────────────────────────────────────────────────────
  handleAdjustStock: (type: 'product' | 'material', id: string, amount: number) => void;
  handleUpdateProductPrice: (id: string, price: number) => void;
  handleUpdateProductField: (id: string, field: string, value: any) => void;
  handleOpenEditProduct: (p: Product) => void;
  handleDeleteProduct: (id: string) => void;
  handleCleanupProducts: () => void;
  handleDeleteMaterial: (name: string) => void;
  startEditingMaterial: (name: string, data: Ingredient) => void;
  handleCreatePO: (data: { supplier_id: number; items: any[] }) => void;
  handleReceivePO: (id: string, payload?: { items: any[] }) => void;
  handleDeletePO: (id: string) => void;
  openPOModal: (po: any) => void;
  handleSavePO: () => void;
  handlePartialReceivePO: () => void;
  handleDeleteStaff: (username: string) => void;
  handleDeleteSupplier: (supp: any) => void;
  handleAddSupplier: () => void;
  handleResetSession: () => void;
  handleCompletePlan: (planId: string) => void;

  // ─── Helpers ──────────────────────────────────────────────────────────────
  formatPrice: (v: number) => string;
  displayUnit: (v: number, unit: string) => string;
  openDocument: (url: string, filename: string) => void;
  openSelector: (config: any) => void;
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  showConfirm: (config: any) => void;
  fetchData: () => void;
  api: any;
}

// ─── Re-export core types used across panels ──────────────────────────────────

export interface UserSession {
  username: string;
  role: string;
  id?: number;
}

export interface Ingredient {
  name: string;
  quantity: number;
  stock: number;
  price: number;
  unit: string;
  min_threshold: number;
  supplier?: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  icon: string;
  stock: number;
  live_cost?: number;
  ingredients: Array<{ name: string; quantity: number }>;
  recipe_items?: any[];
  prep_time: number;
  cook_time: number;
  yield_qty: number;
  instructions: string[];
}

export interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
}

export interface PlanItem {
  id: string;
  date: string;
  product_id: string;
  quantity: number;
  status: 'pending' | 'completed';
}

export interface Transaction {
  id: string;
  timestamp: string;
  type: string;
  revenue?: number;
  cost?: number;
  product?: string;
  items?: any[];
}

export interface DashboardAlert {
  id: string;
  type: string;
  message: string;
  severity: 'high' | 'medium';
}

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface ConfirmConfig {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  type: 'danger' | 'info';
  confirmText: string;
}

export interface Analytics {
  revenue: number;
  cost: number;
  today_revenue: number;
  today_cost: number;
  currency: string;
  chartData: any[];
  hourlySales: any[];
  topProducts: any[];
  intelligence: {
    total_portfolio_cost: number;
    average_margin: string;
    products_count: number;
  };
}
