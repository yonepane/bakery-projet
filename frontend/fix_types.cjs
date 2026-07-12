const fs = require('fs');

const path = 'src/components/dashboard/types.ts';
let content = fs.readFileSync(path, 'utf8');

// 1. Add missing interfaces at the end
const newInterfaces = `
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
  status: 'pending' | 'completed' | 'cancelled';
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
}

export interface PurchasingSuggestion {
  item_name: string;
  suggested_qty: number;
  reason: string;
  current_stock: number;
  supplier_id?: number;
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
  description: string;
  amount: number;
  type: 'sale' | 'expense' | 'purchase';
  reference?: string;
}

export interface ProductProfitability {
  product_id: string;
  name: string;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  sales_count: number;
}

export interface WasteByProduct {
  product_id: string;
  name: string;
  waste_quantity: number;
  waste_cost: number;
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
`;

content += newInterfaces;

// 2. Replace all instances of `any` with appropriate types
const replacements = [
  ['settings: any;', 'settings: Record<string, string | number | boolean>;'],
  ['orders: any[];', 'orders: Order[];'],
  ['purchaseOrders: any[];', 'purchaseOrders: PurchaseOrder[];'],
  ['purchasingSuggestions: any[];', 'purchasingSuggestions: PurchasingSuggestion[];'],
  ['staff: any[];', 'staff: Staff[];'],
  ['shiftLogs: any[];', 'shiftLogs: ShiftLog[];'],
  ['profitReport: any[];', 'profitReport: ProfitReportRow[];'],
  ['wasteRecords: any[];', 'wasteRecords: WasteRecord[];'],
  ['accountingFeed: any[];', 'accountingFeed: AccountingFeedItem[];'],
  ['filteredExpenses: any[];', 'filteredExpenses: Expense[];'],
  ['filteredPurchaseOrders: any[];', 'filteredPurchaseOrders: PurchaseOrder[];'],
  ['filteredSales: any[];', 'filteredSales: Transaction[];'],
  ['filteredWaste: any[];', 'filteredWaste: WasteRecord[];'],
  ['productProfitability: any[];', 'productProfitability: ProductProfitability[];'],
  ['wasteByProduct: any[];', 'wasteByProduct: WasteByProduct[];'],
  ['lastTransaction: any;', 'lastTransaction: Transaction | null;'],
  ['setBookingForm: (f: any) => void;', 'setBookingForm: (f: Partial<Order>) => void;'],
  ['editingSupplier: any;', 'editingSupplier: Supplier | null;'],
  ['setEditingSupplier: (s: any) => void;', 'setEditingSupplier: (s: Supplier | null) => void;'],
  ['newMaterial: any;', 'newMaterial: Partial<Ingredient>;'],
  ['setNewMaterial: (m: any) => void;', 'setNewMaterial: (m: Partial<Ingredient>) => void;'],
  ['selectedPO: any;', 'selectedPO: PurchaseOrder | null;'],
  ['setSelectedPO: (po: any) => void;', 'setSelectedPO: (po: PurchaseOrder | null) => void;'],
  ['setPoReceiveDraft: (d: any) => void;', 'setPoReceiveDraft: (d: Partial<PurchaseOrder>) => void;'],
  ['simulationResult: any[];', 'simulationResult: SimulationResult[];'],
  ['handleUpdateProductField: (id: string, field: string, value: any) => void;', 'handleUpdateProductField: (id: string, field: string, value: string | number | boolean | unknown[]) => void;'],
  ['handleCreatePO: (data: { supplier_id: number; items: any[] }) => void;', 'handleCreatePO: (data: { supplier_id: number; items: PurchaseOrderItem[] }) => void;'],
  ['handleReceivePO: (id: string, payload?: { items: any[] }) => void;', 'handleReceivePO: (id: string, payload?: { items: PurchaseOrderReceiveItem[] }) => void;'],
  ['openPOModal: (po: any) => void;', 'openPOModal: (po: PurchaseOrder) => void;'],
  ['handleDeleteSupplier: (supp: any) => void;', 'handleDeleteSupplier: (supp: Supplier) => void;'],
  ['openSelector: (config: any) => void;', 'openSelector: (config: SelectorConfig) => void;'],
  ['showConfirm: (config: any) => void;', 'showConfirm: (config: ConfirmConfig) => void;'],
  ['api: any;', 'api: unknown;'],
  ['recipe_items?: any[];', 'recipe_items?: RecipeItem[];'],
  ['items?: any[];', 'items?: CartItem[];'],
  ['chartData: any[];', 'chartData: ChartDataPoint[];'],
  ['hourlySales: any[];', 'hourlySales: HourlySalesPoint[];'],
  ['topProducts: any[];', 'topProducts: TopProductPoint[];']
];

let replacedCount = 0;
for (const [search, replace] of replacements) {
  if (content.includes(search)) {
    content = content.replace(search, replace);
    replacedCount++;
  } else {
    console.log(`Could not find: ${search}`);
  }
}

// Write the file
fs.writeFileSync(path, content);
console.log(`Done. Replaced ${replacedCount} types.`);
