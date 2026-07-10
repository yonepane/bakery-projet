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
  lang: string;
  setLang: (l: string) => void;

  // ─── Data ─────────────────────────────────────────────────────────────────
  inventory: { materials: Record<string, Ingredient>; products: Product[] };
  analytics: Analytics;
  customers: Customer[];
  history: Transaction[];
  stockMovements: StockMovement[];
  stockLocations: StockLocation[];
  stockLotBalances: StockLotBalance[];
  semiFinishedItems: SemiFinishedItem[];
  planner: PlanItem[];
  orders: any[];
  expenses: Expense[];
  suppliers: Supplier[];
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
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  addToCart: (product: Product) => void;
  finalizeSale: (customerId?: string | null) => void;
  lastTransaction: any;

  // ─── Modals ───────────────────────────────────────────────────────────────
  showTransferModal: boolean;
  setShowTransferModal: (v: boolean) => void;
  setShowReceiptModal: (v: boolean) => void;
  setShowBookingModal: (v: boolean) => void;
  bookingForm: { name: string; phone: string; date: string; source: 'pos' | 'ledger'; notes?: string };
  setBookingForm: (f: any) => void;
  setShowAddProduct: (v: boolean) => void;
  setShowAddMaterial: (v: boolean) => void;
  setShowAddExpense: (v: boolean) => void;
  editingExpense: Expense | null;
  setEditingExpense: (e: Expense | null) => void;
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
  poReceiveDraft: Record<string, {
    qty: number;
    price: number;
    lot_code?: string;
    supplier_lot_code?: string;
    expires_at?: string;
    location_id?: number | null;
  }>;
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
  handleDuplicateProduct: (id: string) => void;
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
  handleDeleteExpense: (id: number) => void;
  handleDeleteSupplier: (supp: any) => void;
  handleAddSupplier: () => void;
  handleCreateLocation: (payload: { name: string; type: string; branch_name?: string }) => void;
  handleTransferStock: (payload: { item_type: string; item_id: string; from_location_id: number; to_location_id: number; quantity: number; lot_id?: number | null }) => void;
  handleResetSession: () => void;
  handleCompletePlan: (planId: string) => void;

  // ─── Helpers ──────────────────────────────────────────────────────────────
  formatPrice: (v: number) => string;
  displayUnit: (v: number, unit: string) => string;
  openDocument: (url: string, filename: string) => void;
  getDownloadToken: () => Promise<string>;
  openSelector: (config: any) => void;
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  showConfirm: (config: any) => void;
  fetchData: () => void;
  fetchTabData: (tab: string) => void;
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
  allergens?: string[];
  is_organic?: boolean;
  purchase_unit?: string;
  purchase_to_base_ratio?: number;
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
  allergens?: string[];
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
  status?: string; // 'completed' | 'refunded'
  revenue?: number;
  cost?: number;
  product?: string;
  items?: any[];
}

export interface StockMovement {
  id: number;
  created_at?: string | null;
  item_type: 'ingredient' | 'product' | string;
  item_id: string;
  item_name: string;
  quantity_delta: number;
  unit?: string | null;
  movement_type: string;
  source_type?: string | null;
  source_id?: string | null;
  reason?: string | null;
  before_qty: number;
  after_qty: number;
  created_by_user_id?: number | null;
  client_mutation_id?: string | null;
  location_id?: number | null;
  location_name?: string | null;
  lot_id?: number | null;
  lot_code?: string | null;
  expires_at?: string | null;
  unit_cost?: number | null;
  correlation_id?: string | null;
}

export interface StockLocation {
  id: number;
  name: string;
  type: string;
  branch_name?: string | null;
  is_default: boolean;
  is_active: boolean;
  created_at?: string | null;
}

export interface StockLotBalance {
  id: number;
  quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  updated_at?: string | null;
  location: {
    id: number;
    name: string;
    type: string;
    branch_name?: string | null;
  } | null;
  lot: {
    id: number;
    item_type: string;
    item_id: string;
    item_name: string;
    lot_code?: string | null;
    supplier_lot_code?: string | null;
    internal_batch_code?: string | null;
    source_type?: string | null;
    source_id?: string | null;
    received_at?: string | null;
    produced_at?: string | null;
    expires_at?: string | null;
    unit?: string | null;
    unit_cost?: number | null;
    status: string;
    created_at?: string | null;
  } | null;
}

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

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  points: number;
  created_at: string;
}

export interface ExpensePayment {
  id: number;
  expense_id: number;
  amount: number;
  paid_at: string;
  payment_method: 'cash' | 'bank_transfer' | 'card' | 'cheque';
}

export interface Expense {
  id: number;
  date: string;
  category: string;
  description?: string;
  amount: number;
  
  // Accounting
  input_mode: 'HT' | 'TTC';
  amount_ht: number;
  amount_ttc: number;
  tva_rate: number;
  tva_amount: number;
  is_tva_deductible: boolean;
  
  // Supplier & Billing
  supplier_id?: number;
  invoice_ref?: string;
  
  // Treasury
  status: 'paid' | 'pending' | 'partial';
  amount_paid: number;
  payments?: ExpensePayment[];
  supplier?: Supplier;
}

export interface Supplier {
  id: number;
  name: string;
  contact_info?: string;
  ice?: string;
  email?: string;
  phone?: string;
}

/** Minimal shared dependencies passed into every mutation hook. */
export interface MutationDeps {
  fetchData: () => void;
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  showConfirm: (config: ConfirmConfig) => void;
}
