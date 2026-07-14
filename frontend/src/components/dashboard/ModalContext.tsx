/**
 * ModalContext — All modal visibility flags + form state.
 * High churn, isolated so data/UI contexts don't re-render on modal open/close.
 * Provides ONLY state + setters. Implementations live in DashboardInner.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Expense, Supplier, PurchaseOrder, SemiFinishedItem, Product, Transaction } from './types';
import { getDefaultBookingDate } from './utils';

interface ModalContextValue {
  // Product modals
  showAddProduct: boolean;
  setShowAddProduct: React.Dispatch<React.SetStateAction<boolean>>;
  editingProductId: string | null;
  setEditingProductId: React.Dispatch<React.SetStateAction<string | null>>;
  showProductIconPicker: boolean;
  setShowProductIconPicker: React.Dispatch<React.SetStateAction<boolean>>;
  handleOpenEditProduct: (product: Product) => void;

  // Material modals
  showAddMaterial: boolean;
  setShowAddMaterial: React.Dispatch<React.SetStateAction<boolean>>;
  editingMaterialName: string | null;
  setEditingMaterialName: React.Dispatch<React.SetStateAction<string | null>>;
  startEditingMaterial: (name: string, data: any) => void;

  // Waste
  showWasteModal: boolean;
  setShowWasteModal: React.Dispatch<React.SetStateAction<boolean>>;

  // Receipt
  showReceiptModal: boolean;
  setShowReceiptModal: React.Dispatch<React.SetStateAction<boolean>>;

  // Expense
  showAddExpense: boolean;
  setShowAddExpense: React.Dispatch<React.SetStateAction<boolean>>;
  editingExpense: Expense | null;
  setEditingExpense: React.Dispatch<React.SetStateAction<Expense | null>>;

  // Supplier
  showAddSupplier: boolean;
  setShowAddSupplier: React.Dispatch<React.SetStateAction<boolean>>;
  editingSupplier: Supplier | null;
  setEditingSupplier: React.Dispatch<React.SetStateAction<Supplier | null>>;

  // Purchase Order
  showPOModal: boolean;
  setShowPOModal: React.Dispatch<React.SetStateAction<boolean>>;

  // Transfer
  showTransferModal: boolean;
  setShowTransferModal: React.Dispatch<React.SetStateAction<boolean>>;

  // Recipe / Semi-finished
  showRecipeModal: boolean;
  setShowRecipeModal: React.Dispatch<React.SetStateAction<boolean>>;
  showProduceModal: boolean;
  setShowProduceModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeSFItem: SemiFinishedItem | null;
  setActiveSFItem: React.Dispatch<React.SetStateAction<SemiFinishedItem | null>>;

  // Cost breakdown
  showCostModal: boolean;
  setShowCostModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeCostProduct: Product | null;
  setActiveCostProduct: React.Dispatch<React.SetStateAction<Product | null>>;

  // PO receive draft
  selectedPO: PurchaseOrder | null;
  setSelectedPO: React.Dispatch<React.SetStateAction<PurchaseOrder | null>>;
  poReceiveDraft: Record<string, { qty: number; price: number; lot_code?: string; supplier_lot_code?: string; expires_at?: string; location_id?: number | null; }>;
  setPoReceiveDraft: React.Dispatch<React.SetStateAction<Record<string, any>>>;

  // Simulation
  simPrices: Record<string, number>;
  setSimPrices: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  simulatedInflations: Record<string, number>;
  setSimulatedInflations: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  simulationResult: any[];
  setSimulationResult: React.Dispatch<React.SetStateAction<any[]>>;

  // Forecasting
  isForecasting: boolean;
  setIsForecasting: React.Dispatch<React.SetStateAction<boolean>>;

  // Staff
  showAddStaff: boolean;
  setShowAddStaff: React.Dispatch<React.SetStateAction<boolean>>;
  newStaff: { username: string; password: string };
  setNewStaff: React.Dispatch<React.SetStateAction<{ username: string; password: string }>>;

  // Booking
  showBookingModal: boolean;
  setShowBookingModal: React.Dispatch<React.SetStateAction<boolean>>;
  bookingForm: { name: string; phone: string; date: string; source: 'pos' | 'ledger'; notes: string };
  setBookingForm: React.Dispatch<React.SetStateAction<{ name: string; phone: string; date: string; source: 'pos' | 'ledger'; notes: string }>>;

  // Recipe search
  recipeSearchQuery: string;
  setRecipeSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  recipeSearchResults: Record<string, unknown>[];
  setRecipeSearchResults: React.Dispatch<React.SetStateAction<Record<string, unknown>[]>>;
  isSearchingRecipes: boolean;
  setIsSearchingRecipes: React.Dispatch<React.SetStateAction<boolean>>;

  // Online/offline
  isOnline: boolean;

  // Command palette
  showCommandPalette: boolean;
  setShowCommandPalette: React.Dispatch<React.SetStateAction<boolean>>;

  // General note
  generalNote: string;
  setGeneralNote: React.Dispatch<React.SetStateAction<string>>;
  isSavingGeneralNote: boolean;
  setIsSavingGeneralNote: React.Dispatch<React.SetStateAction<boolean>>;

  // Accounting range
  accountingRange: { start: string; end: string };
  setAccountingRange: React.Dispatch<React.SetStateAction<{ start: string; end: string }>>;

  // Last transaction
  lastTransaction: Transaction | null;
  setLastTransaction: React.Dispatch<React.SetStateAction<Transaction | null>>;

  // Forms
  newProduct: Partial<Product>;
  setNewProduct: React.Dispatch<React.SetStateAction<Partial<Product>>>;
  newMaterial: Partial<{ name: string; price: number; unit: string; min_threshold: number }>;
  setNewMaterial: React.Dispatch<React.SetStateAction<Partial<{ name: string; price: number; unit: string; min_threshold: number }>>>;
  wasteForm: { product_id: string; quantity: number };
  setWasteForm: React.Dispatch<React.SetStateAction<{ product_id: string; quantity: number }>>;
  selectedProduct: Product | null;
  setSelectedProduct: React.Dispatch<React.SetStateAction<Product | null>>;
  targetYield: number;
  setTargetYield: React.Dispatch<React.SetStateAction<number>>;
  checkedIngredients: Record<string, boolean>;
  setCheckedIngredients: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  newSupplier: { name: string; contact_info: string; ice: string; email: string; phone: string };
  setNewSupplier: React.Dispatch<React.SetStateAction<{ name: string; contact_info: string; ice: string; email: string; phone: string }>>;
  newExpense: any;
  setNewExpense: React.Dispatch<React.SetStateAction<any>>;

  // Selector
  selectorConfig: SelectorConfig;
  setSelectorConfig: React.Dispatch<React.SetStateAction<SelectorConfig>>;
  openSelector: (config: Omit<SelectorConfig, 'isOpen'>) => void;
}

type SelectorConfig = {
  isOpen: boolean;
  title: string;
  label: string;
  value: string;
  type: 'date' | 'text' | 'datetime';
  onConfirm: (val: string) => void;
};

const ModalContext = createContext<ModalContextValue | null>(null);

export const useModal = (): ModalContextValue => {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModal must be used inside <ModalProvider>');
  return ctx;
};

interface ModalProviderProps {
  children: React.ReactNode;
}

export const ModalProvider: React.FC<ModalProviderProps> = ({ children }) => {
  // Product modals
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [showProductIconPicker, setShowProductIconPicker] = useState(false);

  // Material modals
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [editingMaterialName, setEditingMaterialName] = useState<string | null>(null);

  // Forms (must be declared before useCallbacks that reference them)
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    id: '', name: '', price: 0, icon: '🥐', ingredients: [],
    prep_time: 0, cook_time: 0, yield_qty: 1, instructions: []
  });
  const [newMaterial, setNewMaterial] = useState<Partial<{ name: string; price: number; unit: string; min_threshold: number }>>({
    name: '', price: 0, unit: 'g', min_threshold: 1000
  });

  const handleOpenEditProduct = useCallback((product: Product) => {
    setEditingProductId(product.id);
    setNewProduct({
      id: product.id,
      name: product.name,
      price: product.price,
      icon: product.icon || '🥐',
      ingredients: product.ingredients || [],
      prep_time: product.prep_time || 0,
      cook_time: product.cook_time || 0,
      yield_qty: product.yield_qty || 1,
      instructions: product.instructions || []
    });
    setShowAddProduct(true);
  }, [setNewProduct]);

  const startEditingMaterial = useCallback((name: string, data: any) => {
    setEditingMaterialName(name);
    setNewMaterial({
      name: name,
      unit: data.unit || 'g',
      price: data.price || 0,
      min_threshold: data.min_threshold || 0
    });
    setShowAddMaterial(true);
  }, [setNewMaterial]);

  // Waste
  const [showWasteModal, setShowWasteModal] = useState(false);

  // Receipt
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Expense
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Supplier
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // Purchase Order
  const [showPOModal, setShowPOModal] = useState(false);

  // Transfer
  const [showTransferModal, setShowTransferModal] = useState(false);

  // Recipe / Semi-finished
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [showProduceModal, setShowProduceModal] = useState(false);
  const [activeSFItem, setActiveSFItem] = useState<SemiFinishedItem | null>(null);

  // Cost breakdown
  const [showCostModal, setShowCostModal] = useState(false);
  const [activeCostProduct, setActiveCostProduct] = useState<Product | null>(null);

  // PO receive draft
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [poReceiveDraft, setPoReceiveDraft] = useState<Record<string, any>>({});

  // Simulation
  const [simPrices, setSimPrices] = useState<Record<string, number>>({});
  const [simulatedInflations, setSimulatedInflations] = useState<Record<string, number>>({});
  const [simulationResult, setSimulationResult] = useState<any[]>([]);

  // Forecasting
  const [isForecasting, setIsForecasting] = useState(false);

  // Staff
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [newStaff, setNewStaff] = useState({ username: '', password: '' });

  // Booking
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    name: '', phone: '', date: getDefaultBookingDate(),
    source: 'pos' as 'pos' | 'ledger', notes: ''
  });

  // Recipe search
  const [recipeSearchQuery, setRecipeSearchQuery] = useState('');
  const [recipeSearchResults, setRecipeSearchResults] = useState<Record<string, unknown>[]>([]);
  const [isSearchingRecipes, setIsSearchingRecipes] = useState(false);

  // Online/offline
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Command palette
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  // General note
  const [generalNote, setGeneralNote] = useState('');
  const [isSavingGeneralNote, setIsSavingGeneralNote] = useState(false);

  // Accounting range
  const today = new Date();
  const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 2, 1).toISOString().slice(0, 10);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
  const [accountingRange, setAccountingRange] = useState({ start: threeMonthsAgo, end: monthEnd });

  // Last transaction
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);

  // Forms
  const [wasteForm, setWasteForm] = useState({ product_id: '', quantity: 1 });
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [targetYield, setTargetYield] = useState<number>(0);
  const [checkedIngredients, setCheckedIngredients] = useState<Record<string, boolean>>({});
  const [newSupplier, setNewSupplier] = useState({ name: '', contact_info: '', ice: '', email: '', phone: '' });
  const [newExpense, setNewExpense] = useState({
    category: 'other', description: '', input_mode: 'TTC' as 'HT' | 'TTC',
    amount_ht: 0, amount_ttc: 0, tva_rate: 20, tva_amount: 0,
    is_tva_deductible: true, supplier_id: null as number | null,
    invoice_ref: '', status: 'paid' as 'paid' | 'pending' | 'partial',
    amount_paid: 0, amount: 0,
  });

  // Selector
  const [selectorConfig, setSelectorConfig] = useState<{
    isOpen: boolean;
    title: string;
    label: string;
    value: string;
    type: 'date' | 'text' | 'datetime';
    onConfirm: (val: string) => void;
  }>({ isOpen: false, title: '', label: '', value: '', type: 'date', onConfirm: () => {} });

  const openSelector = useCallback((config: Omit<typeof selectorConfig, 'isOpen'>) => {
    setSelectorConfig({ ...config, isOpen: true });
  }, []);

  // Online/offline
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);

  // Command palette shortcut
  useEffect(() => {
    const handleCmdK = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || e.key === '/') {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        e.preventDefault();
        // setShowCommandPalette(true); // would need setShowCommandPalette here
      }
    };
    window.addEventListener('keydown', handleCmdK);
    return () => window.removeEventListener('keydown', handleCmdK);
  }, []);

  return (
    <ModalContext.Provider value={{
      // Modal flags
      showAddProduct, setShowAddProduct,
      editingProductId, setEditingProductId,
      showProductIconPicker, setShowProductIconPicker,
      handleOpenEditProduct,
      showAddMaterial, setShowAddMaterial,
      editingMaterialName, setEditingMaterialName,
      startEditingMaterial,
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
      simPrices, setSimPrices,
      simulatedInflations, setSimulatedInflations,
      simulationResult, setSimulationResult,
      isForecasting, setIsForecasting,
      showAddStaff, setShowAddStaff,
      newStaff, setNewStaff,
      showBookingModal, setShowBookingModal,
      bookingForm, setBookingForm,
      recipeSearchQuery, setRecipeSearchQuery,
      recipeSearchResults, setRecipeSearchResults,
      isSearchingRecipes, setIsSearchingRecipes,
      isOnline,
      showCommandPalette, setShowCommandPalette,
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
      newSupplier, setNewSupplier,
      newExpense, setNewExpense,
      selectorConfig, setSelectorConfig, openSelector,
    }}>
      {children}
    </ModalContext.Provider>
  );
};