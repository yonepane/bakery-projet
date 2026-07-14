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
  settings: Record<string, string | number | boolean>;

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
  orders: Order[];
  expenses: Expense[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  purchasingSuggestions: PurchasingSuggestion[];
  selectedSupplierId: number | null;
  setSelectedSupplierId: (id: number | null) => void;
  staff: Staff[];
  shiftLogs: ShiftLog[];
  alerts: DashboardAlert[];
  profitReport: ProfitReportRow[];
  wasteRecords: WasteRecord[];
  accountingRange: { start: string; end: string };
  setAccountingRange: (r: { start: string; end: string }) => void;
  monthStart: string;
  monthEnd: string;

  // ─── Derived accounting metrics ──────────────────────────────────────────
  accountingFeed: AccountingFeedItem[];
  draftPurchaseCommitment: number;
  expenseBreakdown: [string, number][];
  filteredExpenses: Expense[];
  filteredPurchaseOrders: PurchaseOrder[];
  filteredSales: Transaction[];
  filteredWaste: WasteRecord[];
  monthlyExpensesTotal: number;
  monthlyNetAfterExpenses: number;
  monthlySales: number;
  productProfitability: ProductProfitability[];
  wasteByProduct: WasteByProduct[];

  // ─── POS ──────────────────────────────────────────────────────────────────
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  addToCart: (product: Product) => void;
  finalizeSale: (customerId?: string | null) => void;
  lastTransaction: Transaction | null;

  // ─── Modals ───────────────────────────────────────────────────────────────
  showTransferModal: boolean;
  setShowTransferModal: (v: boolean) => void;
  setShowReceiptModal: (v: boolean) => void;
  setShowBookingModal: (v: boolean) => void;
  bookingForm: { name: string; phone: string; date: string; source: 'pos' | 'ledger'; notes?: string };
  setBookingForm: React.Dispatch<React.SetStateAction<any>>;
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
  editingSupplier: Supplier | null;
  setEditingSupplier: (s: Supplier | null) => void;
  newMaterial: Partial<Ingredient>;
  setNewMaterial: (m: Partial<Ingredient>) => void;
  newSupplier: { name: string; contact_info: string };
  setNewSupplier: (s: { name: string; contact_info: string }) => void;
  selectedPO: PurchaseOrder | null;
  setSelectedPO: (po: PurchaseOrder | null) => void;
  poReceiveDraft: Record<string, {
    qty: number;
    price: number;
    lot_code?: string;
    supplier_lot_code?: string;
    expires_at?: string;
    location_id?: number | null;
  }>;
  setPoReceiveDraft: React.Dispatch<React.SetStateAction<any>>;

  // ─── Planner / simulation ─────────────────────────────────────────────────
  simPrices: Record<string, number>;
  setSimPrices: (p: Record<string, number>) => void;
  simulatedInflations: Record<string, number>;
  setSimulatedInflations: (p: Record<string, number>) => void;
  simulationResult: SimulationResult[];
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
  handleUpdateGeneralNote: (content: string) => Promise<void>;
  handleDeleteShiftLog: (id: number) => Promise<void>;

  // ─── Sorted material helpers ──────────────────────────────────────────────
  sortedMaterialEntries: [string, Ingredient][];
  sortedMaterialNames: string[];

  // ─── Handlers ────────────────────────────────────────────────────────────
  handleAdjustStock: (type: 'product' | 'material', id: string, amount: number) => void;
  handleUpdateProductPrice: (id: string, price: number) => void;
  handleUpdateProductField: (id: string, field: string, value: string | number | boolean | unknown[]) => void;
  handleOpenEditProduct: (p: Product) => void;
  handleDeleteProduct: (id: string) => void;
  handleDuplicateProduct: (id: string) => void;
  handleCleanupProducts: () => void;
  handleDeleteMaterial: (name: string) => void;
  startEditingMaterial: (name: string, data: Ingredient) => void;
  handleCreatePO: (data: { supplier_id: number; items: PurchaseOrderItem[] }) => void;
  handleReceivePO: (id: string, payload?: { items: PurchaseOrderReceiveItem[] }) => void;
  handleDeletePO: (id: string) => void;
  openPOModal: (po: PurchaseOrder) => void;
  handleSavePO: () => void;
  handlePartialReceivePO: () => void;
  handleDeleteStaff: (username: string) => Promise<void>;
  handleDeleteExpense: (id: number) => void;
  handleDeleteSupplier: (id: number) => Promise<void>;
  handleAddSupplier: (supplierData: Record<string, unknown>) => Promise<void>;
  handleCreateLocation: (payload: { name: string; type: string; branch_name?: string }) => void;
  handleTransferStock: (payload: { item_type: string; item_id: string; from_location_id: number; to_location_id: number; quantity: number; lot_id?: number | null }) => void;
  handleResetSession: () => void;
  handleCompletePlan: (planId: string) => void;

  // ─── Helpers ──────────────────────────────────────────────────────────────
  formatPrice: (v: number) => string;
  displayUnit: (v: number, unit: string) => string;
  openDocument: (url: string, filename: string) => void;
  getDownloadToken: () => Promise<string>;
  openSelector: (config: Omit<{ isOpen: boolean; title: string; label: string; value: string; type: "date" | "text" | "datetime"; onConfirm: (val: string) => void; }, "isOpen">) => void;
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  showConfirm: (config: Omit<ConfirmConfig, 'isOpen'>) => void;
  fetchData: (tab?: string) => void;
  fetchTabData: (tab: string) => void;
  api: import('axios').AxiosInstance;
}

// ─── Re-export core types used across panels ──────────────────────────────────

export interface BakeryInventory {
  materials: Record<string, Ingredient>;
  products: Product[];
}

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
  recipe_items?: RecipeItem[];
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
  transaction_id?: string;
  timestamp: string;
  type: string;
  status?: string; // 'completed' | 'refunded'
  revenue?: number;
  cost?: number;
  product?: string;
  items?: CartItem[];
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
  severity: 'high' | 'medium' | 'low';
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
  chartData: ChartDataPoint[];
  hourlySales: HourlySalesPoint[];
  topProducts: TopProductPoint[];
  intelligence: {
    total_portfolio_cost: number;
    average_margin: string;
    products_count: number;
  };
}

export interface BakeryAnalytics {
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
  fetchTabData?: (tab: string) => Promise<void>;
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  showConfirm?: (config: ConfirmConfig) => void;
}

export type DashboardLanguage = 'en' | 'fr' | 'ar';

export interface AccountingRange {
  start: string;
  end: string;
}

// --- New Interfaces replacing 'any' ---
export interface Order {
  id: string;
  customer_name: string;
  customer_phone?: string;
  customer_id?: string;
  items: CartItem[];
  total_price: number;
  deposit_paid: number;
  pickup_date: string;
  status: 'pending' | 'baking' | 'completed' | 'cancelled';
  notes?: string;
  created_at: string;
}

export interface PurchaseOrderItem {
  name: string;
  qty: number;
  price: number;
  received_qty?: number;
}

export interface PurchaseOrderReceiveItem extends PurchaseOrderItem {
  lot_code?: string;
  supplier_lot_code?: string;
  expires_at?: string;
  location_id?: number;
}

export interface PurchaseOrder {
  id: string;
  supplier_id: number;
  supplier?: Supplier;
  items: PurchaseOrderItem[];
  status: 'draft' | 'ordered' | 'partial' | 'received' | 'cancelled';
  expected_delivery_date?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
  total_price?: number;
  archived?: boolean;
  date?: string;
}

export interface PurchasingSuggestion {
  name: string;
  suggested_buy: number;
  reason: string;
  current_stock: number;
  supplier_id?: number;
  unit?: string;
  min_threshold?: number;
  estimated_cost?: number;
}

export interface Staff {
  id: number;
  username: string;
  role: string;
}

export interface ShiftLog {
  id: number;
  username: string;
  action: string;
  timestamp: string;
  details?: string;
}

export interface ProfitReportRow {
  date?: string;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
}

export interface WasteRecord {
  id: number;
  date: string;
  product_id: string;
  product?: Product;
  quantity: number;
  loss_cost: number;
  reason?: string;
}

export interface AccountingFeedItem {
  id: string;
  date: string;
  description?: string;
  label?: string;
  meta?: string;
  status?: string;
  archived?: boolean;
  amount: number;
  type: 'sale' | 'expense' | 'purchase';
  reference?: string;
}

export interface ProductProfitability {
  product_id?: string;
  name: string;
  revenue: number;
  cost: number;
  profit: number;
  margin?: number;
  sales_count?: number;
  qty?: number;
}

export interface WasteByProduct {
  product_id?: string;
  name: string;
  waste_quantity?: number;
  waste_cost?: number;
  qty?: number;
  loss?: number;
}

export interface SimulationResult {
  product_id: string;
  name: string;
  current_margin: number;
  simulated_margin: number;
  price_change_impact: number;
}

export interface RecipeItem {
  id: number;
  product_id: string;
  ingredient_id?: number;
  semi_finished_id?: number;
  quantity: number;
  ingredient?: Ingredient;
  semi_finished?: SemiFinishedItem;
  substitutes_for_ingredient_id?: number;
  substitute_ingredient?: Ingredient;
}

export interface SelectorConfig {
  type: string;
  onSelect: (item: any) => void;
  title?: string;
  filters?: Record<string, string | number | boolean>;
}

export interface ChartDataPoint {
  date: string;
  [key: string]: string | number;
}

export interface HourlySalesPoint {
  hour: string;
  sales: number;
  revenue: number;
}

export interface TopProductPoint {
  name: string;
  revenue: number;
  qty: number;
}
