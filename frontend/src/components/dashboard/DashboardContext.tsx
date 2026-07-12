/**
 * DashboardContext
 *
 * Provides global UI state (user session, active tab, toasts, confirm dialog,
 * lang, sidebar, currency, dark-mode) to the entire authenticated shell.
 *
 * Panels consume this via useDashboard() instead of receiving 40+ props.
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { api, processSyncQueue } from '../../lib/api';
import http from '../../lib/http';
import { Language } from '../../lib/translations';
import {
  CartItem,
  ConfirmConfig,
  Toast,
  UserSession,
} from './types';
import { createToastId, formatPrice as formatMoney, getDefaultBookingDate } from './utils';
import { useBakeryData } from './useBakeryData';
import {
  useInventoryMutations,
  useProductMutations,
  useExpenseMutations,
  usePurchasingMutations,
  useStaffMutations,
  usePlannerMutations,
} from './hooks';
import { useSemiFinishedMutations } from './hooks/useSemiFinishedMutations';
import { useKitchenMutations } from './hooks/useKitchenMutations';
import type { Expense, Ingredient, Product, PurchaseOrder, SemiFinishedItem, Supplier, SimulationResult, Transaction } from './types';

// ── Context value shape ───────────────────────────────────────────────────────

export interface DashboardContextValue {
  // Auth
  user: UserSession | null;
  setUser: (u: UserSession | null) => void;

  // Navigation
  activeTab: string;
  setActiveTab: (tab: string) => void;

  // Server data (from useBakeryData)
  inventory: ReturnType<typeof useBakeryData>['inventory'];
  analytics: ReturnType<typeof useBakeryData>['analytics'];
  profitReport: ReturnType<typeof useBakeryData>['profitReport'];
  alerts: ReturnType<typeof useBakeryData>['alerts'];
  history: ReturnType<typeof useBakeryData>['history'];
  stockMovements: ReturnType<typeof useBakeryData>['stockMovements'];
  stockLocations: ReturnType<typeof useBakeryData>['stockLocations'];
  stockLotBalances: ReturnType<typeof useBakeryData>['stockLotBalances'];
  semiFinishedItems: ReturnType<typeof useBakeryData>['semiFinishedItems'];
  kitchenBatches: ReturnType<typeof useBakeryData>['kitchenBatches'];
  planner: ReturnType<typeof useBakeryData>['planner'];
  setPlanner: ReturnType<typeof useBakeryData>['setPlanner'];
  orders: ReturnType<typeof useBakeryData>['orders'];
  settings: ReturnType<typeof useBakeryData>['settings'];
  liveRates: ReturnType<typeof useBakeryData>['liveRates'];
  customers: ReturnType<typeof useBakeryData>['customers'];
  expenses: ReturnType<typeof useBakeryData>['expenses'];
  wasteRecords: ReturnType<typeof useBakeryData>['wasteRecords'];
  staff: ReturnType<typeof useBakeryData>['staff'];
  suppliers: ReturnType<typeof useBakeryData>['suppliers'];
  selectedSupplierId: ReturnType<typeof useBakeryData>['selectedSupplierId'];
  setSelectedSupplierId: ReturnType<typeof useBakeryData>['setSelectedSupplierId'];
  purchaseOrders: ReturnType<typeof useBakeryData>['purchaseOrders'];
  purchasingSuggestions: ReturnType<typeof useBakeryData>['purchasingSuggestions'];
  shiftLogs: ReturnType<typeof useBakeryData>['shiftLogs'];
  loading: ReturnType<typeof useBakeryData>['loading'];
  setLoading: ReturnType<typeof useBakeryData>['setLoading'];
  setInventory: ReturnType<typeof useBakeryData>['setInventory'];
  setAnalytics: ReturnType<typeof useBakeryData>['setAnalytics'];
  setHistory: ReturnType<typeof useBakeryData>['setHistory'];
  setOrders: ReturnType<typeof useBakeryData>['setOrders'];
  setSettings: ReturnType<typeof useBakeryData>['setSettings'];
  setCustomers: ReturnType<typeof useBakeryData>['setCustomers'];
  setExpenses: ReturnType<typeof useBakeryData>['setExpenses'];
  setWasteRecords: ReturnType<typeof useBakeryData>['setWasteRecords'];
  setStaff: ReturnType<typeof useBakeryData>['setStaff'];
  setSuppliers: ReturnType<typeof useBakeryData>['setSuppliers'];
  setPurchaseOrders: ReturnType<typeof useBakeryData>['setPurchaseOrders'];
  setPurchasingSuggestions: ReturnType<typeof useBakeryData>['setPurchasingSuggestions'];
  setShiftLogs: ReturnType<typeof useBakeryData>['setShiftLogs'];
  fetchData: ReturnType<typeof useBakeryData>['fetchData'];
  fetchTabData: ReturnType<typeof useBakeryData>['fetchTabData'];
  applyInventory: ReturnType<typeof useBakeryData>['applyInventory'];
  applySettings: ReturnType<typeof useBakeryData>['applySettings'];

  // Toasts
  toasts: Toast[];
  addToast: (message: string, type?: Toast['type']) => void;

  // Confirm dialog
  confirmConfig: ConfirmConfig;
  showConfirm: (config: Omit<ConfirmConfig, 'isOpen'>) => void;
  setConfirmConfig: React.Dispatch<React.SetStateAction<ConfirmConfig>>;

  // Cart (POS)
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;

  // Language
  lang: Language;
  setLang: (l: Language) => void;
  isRTL: boolean;

  // Sidebar
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  sidebarHoverMode: boolean;
  setSidebarHoverMode: React.Dispatch<React.SetStateAction<boolean>>;
  isSidebarHovered: boolean;
  setIsSidebarHovered: React.Dispatch<React.SetStateAction<boolean>>;
  notificationRef: React.RefObject<HTMLDivElement | null>;

  // Alerts popover
  showAlertsPopover: boolean;
  setShowAlertsPopover: React.Dispatch<React.SetStateAction<boolean>>;
  isOperationsOpen: boolean;
  setIsOperationsOpen: React.Dispatch<React.SetStateAction<boolean>>;

  // Display preferences
  isDarkMode: boolean;
  setIsDarkMode: React.Dispatch<React.SetStateAction<boolean>>;
  activeCurrency: string;
  setActiveCurrency: React.Dispatch<React.SetStateAction<string>>;
  formatPrice: (amount: number) => string;

  // Simulator state
  editMode: boolean;
  setEditMode: React.Dispatch<React.SetStateAction<boolean>>;
  simPrices: Record<string, number>;
  setSimPrices: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  simulatedInflations: Record<string, number>;
  setSimulatedInflations: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  simulationResult: SimulationResult[];
  setSimulationResult: React.Dispatch<React.SetStateAction<SimulationResult[]>>;

  // Modal visibility flags
  showAddProduct: boolean;
  setShowAddProduct: React.Dispatch<React.SetStateAction<boolean>>;
  editingProductId: string | null;
  setEditingProductId: React.Dispatch<React.SetStateAction<string | null>>;
  showProductIconPicker: boolean;
  setShowProductIconPicker: React.Dispatch<React.SetStateAction<boolean>>;
  showAddMaterial: boolean;
  setShowAddMaterial: React.Dispatch<React.SetStateAction<boolean>>;
  editingMaterialName: string | null;
  setEditingMaterialName: React.Dispatch<React.SetStateAction<string | null>>;
  showWasteModal: boolean;
  setShowWasteModal: React.Dispatch<React.SetStateAction<boolean>>;
  showReceiptModal: boolean;
  setShowReceiptModal: React.Dispatch<React.SetStateAction<boolean>>;
  showAddExpense: boolean;
  setShowAddExpense: React.Dispatch<React.SetStateAction<boolean>>;
  editingExpense: Expense | null;
  setEditingExpense: React.Dispatch<React.SetStateAction<Expense | null>>;
  showAddSupplier: boolean;
  setShowAddSupplier: React.Dispatch<React.SetStateAction<boolean>>;
  editingSupplier: Supplier | null;
  setEditingSupplier: React.Dispatch<React.SetStateAction<Supplier | null>>;
  showPOModal: boolean;
  setShowPOModal: React.Dispatch<React.SetStateAction<boolean>>;
  showTransferModal: boolean;
  setShowTransferModal: React.Dispatch<React.SetStateAction<boolean>>;
  showRecipeModal: boolean;
  setShowRecipeModal: React.Dispatch<React.SetStateAction<boolean>>;
  showProduceModal: boolean;
  setShowProduceModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeSFItem: SemiFinishedItem | null;
  setActiveSFItem: React.Dispatch<React.SetStateAction<SemiFinishedItem | null>>;
  showCostModal: boolean;
  setShowCostModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeCostProduct: Product | null;
  setActiveCostProduct: React.Dispatch<React.SetStateAction<Product | null>>;
  selectedPO: PurchaseOrder | null;
  setSelectedPO: React.Dispatch<React.SetStateAction<PurchaseOrder | null>>;
  poReceiveDraft: Record<string, { qty: number; price: number; lot_code?: string; supplier_lot_code?: string; expires_at?: string; location_id?: number | null; }>;
  setPoReceiveDraft: React.Dispatch<React.SetStateAction<Record<string, any>>>;

  // Form state
  newExpense: any;
  setNewExpense: React.Dispatch<React.SetStateAction<any>>;
  newSupplier: { name: string; contact_info: string; ice: string; email: string; phone: string };
  setNewSupplier: React.Dispatch<React.SetStateAction<any>>;
  generalNote: string;
  setGeneralNote: React.Dispatch<React.SetStateAction<string>>;
  isSavingGeneralNote: boolean;
  setIsSavingGeneralNote: React.Dispatch<React.SetStateAction<boolean>>;
  accountingRange: { start: string; end: string };
  setAccountingRange: React.Dispatch<React.SetStateAction<{ start: string; end: string }>>;
  lastTransaction: Transaction | null;
  setLastTransaction: React.Dispatch<React.SetStateAction<Transaction | null>>;
  newProduct: Partial<Product>;
  setNewProduct: React.Dispatch<React.SetStateAction<Partial<Product>>>;
  newMaterial: Partial<Ingredient>;
  setNewMaterial: React.Dispatch<React.SetStateAction<Partial<Ingredient>>>;
  wasteForm: { product_id: string; quantity: number };
  setWasteForm: React.Dispatch<React.SetStateAction<{ product_id: string; quantity: number }>>;
  selectedProduct: Product | null;
  setSelectedProduct: React.Dispatch<React.SetStateAction<Product | null>>;
  targetYield: number;
  setTargetYield: React.Dispatch<React.SetStateAction<number>>;
  checkedIngredients: Record<string, boolean>;
  setCheckedIngredients: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  recipeSearchQuery: string;
  setRecipeSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  recipeSearchResults: Record<string, unknown>[];
  setRecipeSearchResults: React.Dispatch<React.SetStateAction<Record<string, unknown>[]>>;
  isSearchingRecipes: boolean;
  setIsSearchingRecipes: React.Dispatch<React.SetStateAction<boolean>>;
  isOnline: boolean;
  isForecasting: boolean;
  showCommandPalette: boolean;
  setShowCommandPalette: React.Dispatch<React.SetStateAction<boolean>>;
  showAddStaff: boolean;
  setShowAddStaff: React.Dispatch<React.SetStateAction<boolean>>;
  newStaff: { username: string; password: string };
  setNewStaff: React.Dispatch<React.SetStateAction<{ username: string; password: string }>>;
  showBookingModal: boolean;
  setShowBookingModal: React.Dispatch<React.SetStateAction<boolean>>;
  bookingForm: { name: string; phone: string; date: string; source: 'pos' | 'ledger'; notes: string };
  setBookingForm: React.Dispatch<React.SetStateAction<any>>;
  selectorConfig: {
    isOpen: boolean; title: string; label: string; value: string;
    type: 'date' | 'text' | 'datetime'; onConfirm: (val: string) => void;
  };
  setSelectorConfig: React.Dispatch<React.SetStateAction<any>>;
  openSelector: (config: Omit<DashboardContextValue['selectorConfig'], 'isOpen'>) => void;

  // Mutation handlers
  handleAdjustStock: ReturnType<typeof useInventoryMutations>['handleAdjustStock'];
  handleAddMaterial: ReturnType<typeof useInventoryMutations>['handleAddMaterial'];
  handleDeleteMaterial: ReturnType<typeof useInventoryMutations>['handleDeleteMaterial'];
  handleTransferStock: ReturnType<typeof useInventoryMutations>['handleTransferStock'];
  handleAddProduct: ReturnType<typeof useProductMutations>['handleAddProduct'];
  handleDeleteProduct: ReturnType<typeof useProductMutations>['handleDeleteProduct'];
  handleDuplicateProduct: ReturnType<typeof useProductMutations>['handleDuplicateProduct'];
  handleUpdateProductPrice: ReturnType<typeof useProductMutations>['handleUpdateProductPrice'];
  handleUpdateProductField: ReturnType<typeof useProductMutations>['handleUpdateProductField'];
  handleUpdateProductIngredients: ReturnType<typeof useProductMutations>['handleUpdateProductIngredients'];
  handleCleanupProducts: ReturnType<typeof useProductMutations>['handleCleanupProducts'];
  handleAddExpense: ReturnType<typeof useExpenseMutations>['handleAddExpense'];
  handleUpdateExpense: ReturnType<typeof useExpenseMutations>['handleUpdateExpense'];
  handleDeleteExpense: ReturnType<typeof useExpenseMutations>['handleDeleteExpense'];
  handleAddSupplier: ReturnType<typeof usePurchasingMutations>['handleAddSupplier'];
  handleDeleteSupplier: ReturnType<typeof usePurchasingMutations>['handleDeleteSupplier'];
  handleCreatePO: ReturnType<typeof usePurchasingMutations>['handleCreatePO'];
  handleReceivePO: ReturnType<typeof usePurchasingMutations>['handleReceivePO'];
  handleDeletePO: ReturnType<typeof usePurchasingMutations>['handleDeletePO'];
  handleAddStaff: ReturnType<typeof useStaffMutations>['handleAddStaff'];
  handleDeleteStaff: ReturnType<typeof useStaffMutations>['handleDeleteStaff'];
  handleDeleteShiftLog: ReturnType<typeof useStaffMutations>['handleDeleteShiftLog'];
  handleSaveGeneralNote: ReturnType<typeof useStaffMutations>['handleSaveGeneralNote'];
  handleProduce: ReturnType<typeof usePlannerMutations>['handleProduce'];
  handlePlanBatch: ReturnType<typeof usePlannerMutations>['handlePlanBatch'];
  handleCompletePlan: ReturnType<typeof usePlannerMutations>['handleCompletePlan'];
  handleSaveRecipe: ReturnType<typeof useSemiFinishedMutations>['handleSaveRecipe'];
  handleProduceBatch: ReturnType<typeof useSemiFinishedMutations>['handleProduceBatch'];
  handleCreateSemiFinished: ReturnType<typeof useSemiFinishedMutations>['handleCreateSemiFinished'];
  handleAdvanceStage: ReturnType<typeof useKitchenMutations>['handleAdvanceStage'];
  isKitchenUpdating: boolean;

  // Misc actions
  handleSmartForecast: (date: string) => Promise<void>;
  handleSaveBooking: () => Promise<void>;
  getDownloadToken: () => Promise<string>;
  addToCart: (product: Product) => void;
  finalizeSale: (customerId?: string | null) => Promise<void>;
  runSimulation: () => Promise<void>;
  saveSimulation: () => Promise<void>;
  handleResetSession: () => void;
  startEditingMaterial: (name: string, data: any) => void;
  updateExpenseCalculations: (updated: Partial<any>) => void;
  handleOpenEditProduct: (product: Product) => void;
  openPOModal: (po: any) => void;
  handleSavePO: () => Promise<void>;
  handlePartialReceivePO: () => Promise<void>;
  openDocument: (url: string, fallbackFilename: string) => Promise<void>;
  handleSearchRecipes: () => Promise<void>;
}

// ── Context creation ──────────────────────────────────────────────────────────

const DashboardContext = createContext<DashboardContextValue | null>(null);

export const useDashboard = (): DashboardContextValue => {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used inside <DashboardProvider>');
  return ctx;
};

// ── Provider ──────────────────────────────────────────────────────────────────

interface DashboardProviderProps {
  user: UserSession;
  setUser: (u: UserSession | null) => void;
  children: React.ReactNode;
}

export const DashboardProvider: React.FC<DashboardProviderProps> = ({ user, setUser, children }) => {
  const { t, i18n } = useTranslation();

  const [activeTab, setActiveTab] = useState('dashboard');

  // Server data
  const bakeryData = useBakeryData(user, activeTab);

  // ── Toast ──
  const [toasts, setToasts] = useState<Toast[]>([]);
  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = createToastId();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);

  // ── Confirm ──
  const [confirmConfig, setConfirmConfig] = useState<ConfirmConfig>({
    isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'info', confirmText: 'Confirm'
  });
  const showConfirm = useCallback((config: Omit<ConfirmConfig, 'isOpen'>) => {
    setConfirmConfig({ ...config, isOpen: true });
  }, []);

  // ── Mutation deps ──
  const mutationDeps = { fetchData: bakeryData.fetchData, addToast, showConfirm };
  const inventoryMutations = useInventoryMutations(mutationDeps);
  const productMutations = useProductMutations(mutationDeps);
  const expenseMutations = useExpenseMutations(mutationDeps);
  const purchasingMutations = usePurchasingMutations(mutationDeps);
  const staffMutations = useStaffMutations(mutationDeps);
  const plannerMutations = usePlannerMutations(mutationDeps);
  const sfMutations = useSemiFinishedMutations({ fetchTabData: bakeryData.fetchTabData, addToast });
  const kitchenMutations = useKitchenMutations({ fetchTabData: bakeryData.fetchTabData, addToast });

  // ── Language ──
  const [lang, setLangState] = useState<Language>(() => (i18n.language as Language) || 'en');
  const setLang = (newLang: Language) => {
    setLangState(newLang);
    i18n.changeLanguage(newLang);
    localStorage.setItem('bakery_lang', newLang);
  };
  const isRTL = lang === 'ar';

  // ── Sidebar ──
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [sidebarHoverMode, setSidebarHoverMode] = useState(() => localStorage.getItem('bakery_sidebar_hover') === 'true');
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [showAlertsPopover, setShowAlertsPopover] = useState(false);
  const [isOperationsOpen, setIsOperationsOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowAlertsPopover(false);
      }
    };
    if (showAlertsPopover) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAlertsPopover]);

  // ── Cart ──
  const [cart, setCart] = useState<CartItem[]>([]);

  // ── Display ──
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [activeCurrency, setActiveCurrency] = useState('MAD');
  const formatPrice = (amount: number) => formatMoney(amount, activeCurrency, bakeryData.liveRates);

  // ── Simulator ──
  const [editMode, setEditMode] = useState(false);
  const [simPrices, setSimPrices] = useState<Record<string, number>>({});
  const [simulatedInflations, setSimulatedInflations] = useState<Record<string, number>>({});
  const [simulationResult, setSimulationResult] = useState<SimulationResult[]>([]);

  // ── Modal flags ──
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [showProductIconPicker, setShowProductIconPicker] = useState(false);
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [editingMaterialName, setEditingMaterialName] = useState<string | null>(null);
  const [showWasteModal, setShowWasteModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [showPOModal, setShowPOModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [showProduceModal, setShowProduceModal] = useState(false);
  const [activeSFItem, setActiveSFItem] = useState<SemiFinishedItem | null>(null);
  const [showCostModal, setShowCostModal] = useState(false);
  const [activeCostProduct, setActiveCostProduct] = useState<Product | null>(null);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [poReceiveDraft, setPoReceiveDraft] = useState<Record<string, any>>({});

  // ── Forms ──
  const [newExpense, setNewExpense] = useState({
    category: 'other', description: '', input_mode: 'TTC' as 'HT' | 'TTC',
    amount_ht: 0, amount_ttc: 0, tva_rate: 20, tva_amount: 0,
    is_tva_deductible: true, supplier_id: null as number | null,
    invoice_ref: '', status: 'paid' as 'paid' | 'pending' | 'partial',
    amount_paid: 0, amount: 0,
  });
  const [newSupplier, setNewSupplier] = useState({ name: '', contact_info: '', ice: '', email: '', phone: '' });
  const [generalNote, setGeneralNote] = useState('');
  const [isSavingGeneralNote, setIsSavingGeneralNote] = useState(false);

  const today = new Date();
  const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 2, 1).toISOString().slice(0, 10);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
  const [accountingRange, setAccountingRange] = useState({ start: threeMonthsAgo, end: monthEnd });
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    id: '', name: '', price: 0, icon: '🥐', ingredients: [],
    prep_time: 0, cook_time: 0, yield_qty: 1, instructions: []
  });
  const [newMaterial, setNewMaterial] = useState<Partial<Ingredient>>({ name: '', price: 0, unit: 'g', min_threshold: 1000 });
  const [wasteForm, setWasteForm] = useState({ product_id: '', quantity: 1 });
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [targetYield, setTargetYield] = useState<number>(0);
  const [checkedIngredients, setCheckedIngredients] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (selectedProduct) {
      setTargetYield(selectedProduct.yield_qty || 1);
      setCheckedIngredients({});
    }
  }, [selectedProduct]);

  const [recipeSearchQuery, setRecipeSearchQuery] = useState('');
  const [recipeSearchResults, setRecipeSearchResults] = useState<Record<string, unknown>[]>([]);
  const [isSearchingRecipes, setIsSearchingRecipes] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isForecasting, setIsForecasting] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [newStaff, setNewStaff] = useState({ username: '', password: '' });

  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    name: '', phone: '', date: getDefaultBookingDate(),
    source: 'pos' as 'pos' | 'ledger', notes: ''
  });
  const [selectorConfig, setSelectorConfig] = useState<{
    isOpen: boolean; title: string; label: string; value: string;
    type: 'date' | 'text' | 'datetime'; onConfirm: (val: string) => void;
  }>({ isOpen: false, title: '', label: '', value: '', type: 'date', onConfirm: () => {} });

  const openSelector = (config: Omit<typeof selectorConfig, 'isOpen'>) => {
    setSelectorConfig({ ...config, isOpen: true });
  };

  // ── Online/offline ──
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      processSyncQueue().then(() => bakeryData.fetchTabData(activeTab));
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [activeTab, bakeryData.fetchTabData]);

  // ── Command palette shortcut ──
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

  // ── Misc handlers ──
  const handleSmartForecast = async (date: string) => {
    setIsForecasting(true);
    try {
      const data = await api.get(`/forecast?target_date=${date}`);
      const newPlans = data.map((item: Record<string, unknown>) => ({
        id: Math.random().toString(36).substr(2, 9),
        date, product_id: item.product_id,
        quantity: item.suggested_qty, status: 'pending' as const
      }));
      bakeryData.setPlanner(prev => [...prev.filter(p => p.date !== date), ...newPlans]);
      addToast(`Smart Plan generated for ${date}`, 'success');
    } catch (e) {
      console.error(e);
      addToast(t('forecasting_failed_please_chec'), 'error');
    } finally {
      setIsForecasting(false);
    }
  };

  const addToCart = (product: Product) => {
    if (editMode) return;
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const finalizeSale = async (customerId?: string | null) => {
    if (cart.length === 0) return;
    try {
      const data = await api.post('/complete', {
        cart: cart.map(item => ({ id: item.id, qty: item.qty })),
        customer_id: customerId || undefined
      });
      setLastTransaction(data);
      setCart([]);
      bakeryData.fetchData();
      addToast(t('sale_completed'), 'success');
    } catch (error: any) {
      addToast(error.response?.data?.detail || 'Sale Failed', 'error');
    }
  };

  const runSimulation = async () => {
    try {
      const res = await http.post('/simulate_price', simPrices);
      setSimulationResult(res.data);
    } catch (e) { console.error(e); addToast(t('simulation_failed'), 'error'); }
  };

  const saveSimulation = async () => {
    if (!editMode) return;
    try {
      await http.post('/update_material_prices', simPrices);
      bakeryData.fetchData();
      addToast(t('material_prices_updated'), 'success');
    } catch (e) { console.error(e); addToast(t('save_failed'), 'error'); }
  };

  const handleResetSession = () => {
    showConfirm({
      title: 'Close Current Shift',
      message: 'This will reset the Session Profit counter to 0 for a new shift. Your global history is safe.',
      type: 'info',
      confirmText: 'Start New Shift',
      onConfirm: async () => {
        try {
          await http.post('/maintenance/reset-session');
          bakeryData.fetchData();
          addToast(t('shift_closed_new_session_start'), 'success');
        } catch {
          addToast(t('reset_failed'), 'error');
        }
      }
    });
  };

  const startEditingMaterial = (name: string, data: any) => {
    setEditingMaterialName(name);
    setNewMaterial({ name, unit: data.unit || 'g', price: data.price || 0, min_threshold: data.min_threshold || 0 });
    setShowAddMaterial(true);
  };

  const updateExpenseCalculations = (updated: Partial<any>) => {
    setNewExpense((prev: any) => {
      const next = { ...prev, ...updated };
      const rate = next.tva_rate !== undefined && !isNaN(Number(next.tva_rate)) ? Number(next.tva_rate) : 20;
      if (next.input_mode === 'TTC') {
        const ttc = Number(next.amount_ttc) || 0;
        next.amount_ht = parseFloat((ttc / (1 + rate / 100)).toFixed(2));
        next.tva_amount = parseFloat((ttc - next.amount_ht).toFixed(2));
      } else {
        const ht = Number(next.amount_ht) || 0;
        next.amount_ttc = parseFloat((ht * (1 + rate / 100)).toFixed(2));
        next.tva_amount = parseFloat((next.amount_ttc - ht).toFixed(2));
      }
      if (next.status === 'paid') next.amount_paid = next.amount_ttc;
      else if (next.status === 'pending') next.amount_paid = 0;
      else if (updated.status === 'partial') next.amount_paid = parseFloat((next.amount_ttc / 2).toFixed(2));
      next.amount = next.amount_ttc;
      return next;
    });
  };

  const handleOpenEditProduct = (product: Product) => {
    setEditingProductId(product.id);
    setNewProduct({
      id: product.id, name: product.name, price: product.price, icon: product.icon || '🥐',
      ingredients: product.ingredients || [], prep_time: product.prep_time || 0,
      cook_time: product.cook_time || 0, yield_qty: product.yield_qty || 1,
      instructions: product.instructions || []
    });
    setShowAddProduct(true);
  };

  const openPOModal = (po: any) => {
    setSelectedPO({ ...po, expected_delivery_date: po.expected_delivery_date ? po.expected_delivery_date.slice(0, 10) : '', notes: po.notes || '' });
    setPoReceiveDraft(
      Object.fromEntries(
        po.items.map((item: any) => [
          item.name,
          {
            qty: Math.max(0, (Number(item.qty) || 0) - (Number(item.received_qty) || 0)),
            price: Number(item.price) || 0,
            lot_code: '', supplier_lot_code: '', expires_at: '',
            location_id: bakeryData.stockLocations.find((loc: any) => loc.type === 'warehouse')?.id ?? bakeryData.stockLocations[0]?.id ?? null,
          }
        ])
      )
    );
    setShowPOModal(true);
  };

  const handleSavePO = async () => {
    if (!selectedPO) return;
    try {
      await http.patch(`/purchase-orders/${selectedPO.id}`, {
        supplier_id: selectedPO.supplier_id,
        notes: selectedPO.notes || null,
        expected_delivery_date: selectedPO.expected_delivery_date ? `${selectedPO.expected_delivery_date}T00:00:00` : null,
        items: selectedPO.items
      });
      bakeryData.fetchData();
      addToast(t('purchase_order_updated'), 'success');
      setShowPOModal(false);
    } catch {
      addToast(t('failed_to_update_purchase_orde'), 'error');
    }
  };

  const handlePartialReceivePO = async () => {
    if (!selectedPO) return;
    const items = selectedPO.items
      .map((item: any) => {
        const draft = poReceiveDraft[item.name] || { qty: 0, price: Number(item.price) || 0 };
        const receiveItem: any = { name: item.name, qty: Math.max(0, Number(draft.qty) || 0), price: Number(draft.price) || Number(item.price) || 0 };
        const lotCode = draft.lot_code?.trim();
        const supplierLotCode = draft.supplier_lot_code?.trim();
        if (lotCode) receiveItem.lot_code = lotCode;
        if (supplierLotCode) receiveItem.supplier_lot_code = supplierLotCode;
        if (draft.expires_at) receiveItem.expires_at = `${draft.expires_at}T00:00:00`;
        if (draft.location_id) receiveItem.location_id = draft.location_id;
        return receiveItem;
      })
      .filter((item: any) => item.qty > 0);
    if (!items.length) { addToast(t('enter_received_quantities_firs'), 'error'); return; }
    await purchasingMutations.handleReceivePO(selectedPO.id, { items });
    setShowPOModal(false);
  };

  const openDocument = async (url: string, fallbackFilename: string) => {
    const absoluteUrl = new URL(url, window.location.origin).toString();
    const isDownload = fallbackFilename.toLowerCase().endsWith('.xlsx') ||
      fallbackFilename.toLowerCase().endsWith('.xls') ||
      fallbackFilename.toLowerCase().endsWith('.csv');
    if (isDownload) {
      const link = document.createElement('a');
      link.href = absoluteUrl;
      link.download = fallbackFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }
    const win = window.open(absoluteUrl, '_blank', 'noopener,noreferrer');
    if (!win) window.location.assign(absoluteUrl);
  };

  const handleSearchRecipes = async () => {
    if (!recipeSearchQuery.trim()) return;
    setIsSearchingRecipes(true);
    try {
      const res = await http.get(`/external-recipes/search?query=${recipeSearchQuery}`);
      setRecipeSearchResults(res.data);
    } catch { addToast(t('recipe_search_failed'), 'error'); }
    finally { setIsSearchingRecipes(false); }
  };

  const handleSaveBooking = async () => {
    if (!bookingForm.name || !bookingForm.date) {
      addToast(t('name_and_date_are_required'), 'error');
      return;
    }
    try {
      await api.post('/orders', {
        customer_name: bookingForm.name,
        customer_phone: bookingForm.phone,
        pickup_date: bookingForm.date.replace(' ', 'T'),
        items: bookingForm.source === 'pos' ? cart.map(i => ({ id: i.id, qty: i.qty })) : [],
        deposit_paid: 0
      });
      if (bookingForm.source === 'pos') setCart([]);
      setShowBookingModal(false);
      bakeryData.fetchData();
      addToast(t('booking_confirmed'), 'success');
    } catch {
      addToast(t('failed_to_create_booking'), 'error');
    }
  };

  const getDownloadToken = async (): Promise<string> => {
    const { data } = await http.get('/auth/download-token');
    return data.download_token;
  };

  // ── Sync editingExpense → newExpense ──
  useEffect(() => {
    if (editingExpense) {
      setNewExpense((prev: any) => ({
        ...prev,
        category: editingExpense.category || 'other',
        description: editingExpense.description || '',
        invoice_ref: editingExpense.invoice_ref || '',
        tva_rate: editingExpense.tva_rate ?? 20,
        is_tva_deductible: editingExpense.is_tva_deductible ?? true,
        supplier_id: editingExpense.supplier_id || null,
        status: editingExpense.status || 'paid',
        amount_paid: editingExpense.amount_paid || 0,
        amount: editingExpense.amount_ttc || editingExpense.amount || 0,
      }));
    }
  }, [editingExpense]);

  const value: DashboardContextValue = {
    // Auth
    user, setUser,

    // Navigation
    activeTab, setActiveTab,

    // Server data
    ...bakeryData,

    // Toasts
    toasts, addToast,

    // Confirm
    confirmConfig, showConfirm, setConfirmConfig,

    // Cart
    cart, setCart,

    // Language
    lang, setLang, isRTL,

    // Sidebar
    isSidebarCollapsed, setIsSidebarCollapsed,
    sidebarHoverMode, setSidebarHoverMode,
    isSidebarHovered, setIsSidebarHovered,
    notificationRef,
    showAlertsPopover, setShowAlertsPopover,
    isOperationsOpen, setIsOperationsOpen,

    // Display
    isDarkMode, setIsDarkMode,
    activeCurrency, setActiveCurrency,
    formatPrice,

    // Simulator
    editMode, setEditMode,
    simPrices, setSimPrices,
    simulatedInflations, setSimulatedInflations,
    simulationResult, setSimulationResult,

    // Modal flags
    showAddProduct, setShowAddProduct,
    editingProductId, setEditingProductId,
    showProductIconPicker, setShowProductIconPicker,
    showAddMaterial, setShowAddMaterial,
    editingMaterialName, setEditingMaterialName,
    showWasteModal, setShowWasteModal,
    showReceiptModal, setShowReceiptModal,
    showAddExpense, setShowAddExpense,
    editingExpense, setEditingExpense,
    showAddSupplier, setShowAddSupplier,
    editingSupplier, setEditingSupplier,
    showPOModal, setShowPOModal,
    showTransferModal, setShowTransferModal,
    showRecipeModal, setShowRecipeModal,
    showProduceModal, setShowProduceModal,
    activeSFItem, setActiveSFItem,
    showCostModal, setShowCostModal,
    activeCostProduct, setActiveCostProduct,
    selectedPO, setSelectedPO,
    poReceiveDraft, setPoReceiveDraft,

    // Forms
    newExpense, setNewExpense,
    newSupplier, setNewSupplier,
    generalNote, setGeneralNote,
    isSavingGeneralNote, setIsSavingGeneralNote,
    accountingRange, setAccountingRange,
    lastTransaction, setLastTransaction,
    newProduct, setNewProduct,
    newMaterial, setNewMaterial,
    wasteForm, setWasteForm,
    selectedProduct, setSelectedProduct,
    targetYield, setTargetYield,
    checkedIngredients, setCheckedIngredients,
    recipeSearchQuery, setRecipeSearchQuery,
    recipeSearchResults, setRecipeSearchResults,
    isSearchingRecipes, setIsSearchingRecipes,
    isOnline, isForecasting,
    showCommandPalette, setShowCommandPalette,
    showAddStaff, setShowAddStaff,
    newStaff, setNewStaff,
    showBookingModal, setShowBookingModal,
    bookingForm, setBookingForm,
    selectorConfig, setSelectorConfig, openSelector,

    // Mutations
    ...inventoryMutations,
    ...productMutations,
    ...expenseMutations,
    ...purchasingMutations,
    ...staffMutations,
    ...plannerMutations,
    handleSaveRecipe: sfMutations.handleSaveRecipe,
    handleProduceBatch: sfMutations.handleProduceBatch,
    handleCreateSemiFinished: sfMutations.handleCreateSemiFinished,
    handleAdvanceStage: kitchenMutations.handleAdvanceStage,
    isKitchenUpdating: kitchenMutations.isUpdating,

    // Actions
    handleSmartForecast,
    handleSaveBooking,
    getDownloadToken,
    addToCart,
    finalizeSale,
    runSimulation,
    saveSimulation,
    handleResetSession,
    startEditingMaterial,
    updateExpenseCalculations,
    handleOpenEditProduct,
    openPOModal,
    handleSavePO,
    handlePartialReceivePO,
    openDocument,
    handleSearchRecipes,
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
};
