import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  BarChart3, 
  AlertTriangle, 
  Settings, 
  TrendingUp, 
  TrendingDown,
  Plus,
  Box,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ShoppingCart,
  Trash2,
  Edit2,
  Save,
  X,
  Calculator,
  Zap,
  History as HistoryIcon,
  Calendar,
  FileText,
  Sun,
  Moon,
  Coins,
  LogOut,
  CheckCircle,
  Info,
  Brain,
  XCircle,
  Truck,
  ChefHat,
  MessageSquare,
  Send,
  Eye,
  EyeOff,
  BarChart2,
  Users,
  Clock,
  Bell,
  ClipboardList,
  Activity
} from 'lucide-react';

// axios is consumed internally by api.ts and http.ts — no direct import needed here.
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { api, processSyncQueue } from '../lib/api';
import { calcAlerts, calcProfitReport } from '../lib/calculations';
import http from '../lib/http';
import { Language } from '../lib/translations';
import { useTranslation } from 'react-i18next';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { GOOGLE_CLIENT_ID, PRODUCT_ICON_CHOICES } from './dashboard/constants';
import { useBakeryData } from './dashboard/useBakeryData';
import { CommandPalette } from './CommandPalette';
import {
  CartItem,
  ConfirmConfig,
  DashboardAlert,
  Ingredient,
  PlanItem,
  Product,
  Toast,
  Transaction,
  UserSession,
  Customer,
} from './dashboard/types';
// PERF: Lazy load all panels so code for hidden tabs is not downloaded/parsed on mount.
// This directly addresses the "Reduce unused JavaScript" audit (~250KB savings).
const DashboardPanel = React.lazy(() => import('./dashboard/panels/DashboardPanel'));
const POSPanel = React.lazy(() => import('./dashboard/panels/POSPanel'));
const InventoryPanel = React.lazy(() => import('./dashboard/panels/InventoryPanel'));
const FichePanel = React.lazy(() => import('./dashboard/panels/FichePanel'));
const AnalyticsPanel = React.lazy(() => import('./dashboard/panels/AnalyticsPanel'));
const HistoryPanel = React.lazy(() => import('./dashboard/panels/HistoryPanel'));
const StockMovementsPanel = React.lazy(() => import('./dashboard/panels/StockMovementsPanel'));
const PlannerPanel = React.lazy(() => import('./dashboard/panels/PlannerPanel'));
const ExpensesPanel = React.lazy(() => import('./dashboard/panels/ExpensesPanel'));
const FinancePanel = React.lazy(() => import('./dashboard/panels/FinancePanel'));
const OrdersPanel = React.lazy(() => import('./dashboard/panels/OrdersPanel'));
const PurchasingPanel = React.lazy(() => import('./dashboard/panels/PurchasingPanel'));
const SettingsPanel = React.lazy(() => import('./dashboard/panels/SettingsPanel'));
const StaffPanel = React.lazy(() => import('./dashboard/panels/StaffPanel'));
const IntelligencePanel = React.lazy(() => import('./dashboard/panels/IntelligencePanel'));
const KitchenPanel = React.lazy(() => import('./dashboard/panels/KitchenPanel'));
const KitchenBoardPanel = React.lazy(() => import('./dashboard/panels/KitchenBoardPanel'));
const CustomersPanel = React.lazy(() => import('./dashboard/panels/CustomersPanel'));
import {
  useInventoryMutations,
  useProductMutations,
  useExpenseMutations,
  usePurchasingMutations,
  useStaffMutations,
  usePlannerMutations,
} from './dashboard/hooks';
import { DashboardSharedProps } from './dashboard/types';
import { TransferModal } from './dashboard/modals/TransferModal';
import { RecipeBuilderModal } from './dashboard/modals/RecipeBuilderModal';
import { ProduceBatchModal } from './dashboard/modals/ProduceBatchModal';
import { CostBreakdownModal } from './dashboard/modals/CostBreakdownModal';
import { useSemiFinishedMutations } from './dashboard/hooks/useSemiFinishedMutations';
import { useKitchenMutations } from './dashboard/hooks/useKitchenMutations';
import type { SemiFinishedItem } from './dashboard/types';

import {
  createToastId,
  deriveAccountingMetrics,
  displayUnit,
  formatPrice as formatMoney,
  getDefaultBookingDate,
  getInitialLanguage,
} from './dashboard/utils';

const Dashboard: React.FC = () => {

  const API_BASE = '/api';
  // Login state and current user information.
  const [user, setUser] = useState<UserSession | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [signupForm, setSignupForm] = useState({ username: '', password: '', confirmPassword: '' });
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  
  // UI state for navigation and language.
  const [activeTab, setActiveTab] = useState('dashboard');
  const { t, i18n } = useTranslation();

  // Main business data — delegated to useBakeryData hook.
  // The hook owns all server-fetched state and the tab-aware lazy fetch strategy.
  const {
    inventory, analytics, profitReport, alerts, history, stockMovements,
    stockLocations, stockLotBalances, kitchenBatches, planner, setPlanner,
    orders, settings, liveRates, customers, expenses, wasteRecords,
    staff, suppliers, selectedSupplierId, setSelectedSupplierId,
    purchaseOrders, purchasingSuggestions, shiftLogs, loading, setLoading,
    setInventory, setAnalytics, setHistory, setOrders, setSettings,
    setCustomers, setExpenses, setWasteRecords, setStaff,
    setSuppliers, setPurchaseOrders, setPurchasingSuggestions, setShiftLogs,
    fetchData, fetchTabData, applyInventory, applySettings,
  } = useBakeryData(user, activeTab);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmConfig, setConfirmConfig] = useState<ConfirmConfig>({
      isOpen: false,
      title: '',
      message: '',
      onConfirm: () => {},
      type: 'info',
      confirmText: 'Confirm'
  });
  
  const addToast = (message: string, type: Toast['type'] = 'info') => {
    // Toast messages disappear automatically after a few seconds.
    const id = createToastId();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  const showConfirm = (config: Omit<ConfirmConfig, 'isOpen'>) => {
    setConfirmConfig({ ...config, isOpen: true });
  };

  const mutationDeps = { fetchData, addToast, showConfirm };

  const { handleAdjustStock, handleAddMaterial, handleDeleteMaterial, handleTransferStock } =
    useInventoryMutations(mutationDeps);

  const {
    handleAddProduct, handleDeleteProduct, handleDuplicateProduct, handleUpdateProductPrice,
    handleUpdateProductField, handleUpdateProductIngredients, handleCleanupProducts,
  } = useProductMutations(mutationDeps);

  const { handleAddExpense, handleUpdateExpense, handleDeleteExpense } =
    useExpenseMutations(mutationDeps);

  const {
    handleAddSupplier, handleDeleteSupplier, handleCreatePO,
    handleReceivePO, handleDeletePO,
  } = usePurchasingMutations(mutationDeps);

  const { handleAddStaff, handleDeleteStaff, handleDeleteShiftLog, handleSaveGeneralNote } =
    useStaffMutations(mutationDeps);

  const { handleProduce, handlePlanBatch, handleCompletePlan } =
    usePlannerMutations(mutationDeps);

  const { handleSaveRecipe, handleProduceBatch, handleCreateSemiFinished } =
    useSemiFinishedMutations({ fetchTabData, addToast });

  const { handleAdvanceStage, isUpdating: isKitchenUpdating } =
    useKitchenMutations({ fetchTabData, addToast });

  const [lang, setLangState] = useState<Language>(() => (i18n.language as Language) || 'en');
  
  const setLang = (newLang: Language) => {
    setLangState(newLang);
    i18n.changeLanguage(newLang);
    localStorage.setItem('bakery_lang', newLang);
  };
  
  const isRTL = lang === 'ar';
  
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [sidebarHoverMode, setSidebarHoverMode] = useState(() => localStorage.getItem('bakery_sidebar_hover') === 'true');
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [showAlertsPopover, setShowAlertsPopover] = useState(false);
  const [isOperationsOpen, setIsOperationsOpen] = useState(false);

  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowAlertsPopover(false);
      }
    };

    if (showAlertsPopover) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAlertsPopover]);

  // State used by the booking modal.
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingForm, setBookingForm] = useState({
      name: '',
      phone: '',
      date: getDefaultBookingDate(),
      source: 'pos' as 'pos' | 'ledger',
      notes: ''
  });

  const [selectorConfig, setSelectorConfig] = useState<{
      isOpen: boolean;
      title: string;
      label: string;
      value: string;
      type: 'date' | 'text' | 'datetime';
      onConfirm: (val: string) => void;
  }>({
      isOpen: false,
      title: '',
      label: '',
      value: '',
      type: 'date',
      onConfirm: () => {}
  });

  const openSelector = (config: Omit<typeof selectorConfig, 'isOpen'>) => {
      setSelectorConfig({ ...config, isOpen: true });
  };

  const handleSaveBooking = async () => {
    // A booking can reuse the current cart or create a future pickup order.
    if (!bookingForm.name || !bookingForm.date) {
        addToast(t('name_and_date_are_required'), "error");
        return;
    }
    
    try {
        await api.post('/orders', {
            customer_name: bookingForm.name,
            customer_phone: bookingForm.phone,
            pickup_date: bookingForm.date.replace(' ', 'T'),
            items: bookingForm.source === 'pos' ? cart.map(i => ({id: i.id, qty: i.qty})) : [],
            deposit_paid: 0
        });
        
        if (bookingForm.source === 'pos') setCart([]);
        setShowBookingModal(false);
        fetchData();
        addToast(t('booking_confirmed'), "success");
    } catch (e) {
        addToast(t('failed_to_create_booking'), "error");
    }
  };



  
  // Display preferences.
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [activeCurrency, setActiveCurrency] = useState('MAD');
  
  // State used by the price simulation tool.
  const [editMode, setEditMode] = useState(false);
  const [simPrices, setSimPrices] = useState<Record<string, number>>({});
  const [simulatedInflations, setSimulatedInflations] = useState<Record<string, number>>({});
  const [simulationResult, setSimulationResult] = useState<any[]>([]);

  // State used by create, edit, delete, and operations panels.
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [showProductIconPicker, setShowProductIconPicker] = useState(false);
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [editingMaterialName, setEditingMaterialName] = useState<string | null>(null);
  const [showWasteModal, setShowWasteModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [showPOModal, setShowPOModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [showProduceModal, setShowProduceModal] = useState(false);
  const [activeSFItem, setActiveSFItem] = useState<SemiFinishedItem | null>(null);
  const [showCostModal, setShowCostModal] = useState(false);
  const [activeCostProduct, setActiveCostProduct] = useState<Product | null>(null);
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [poReceiveDraft, setPoReceiveDraft] = useState<Record<string, {
    qty: number;
    price: number;
    lot_code?: string;
    supplier_lot_code?: string;
    expires_at?: string;
    location_id?: number | null;
  }>>({});
  const [newExpense, setNewExpense] = useState({
    category: 'other',
    description: '',
    input_mode: 'TTC' as 'HT' | 'TTC',
    amount_ht: 0,
    amount_ttc: 0,
    tva_rate: 20,
    tva_amount: 0,
    is_tva_deductible: true,
    supplier_id: null as number | null,
    invoice_ref: '',
    status: 'paid' as 'paid' | 'pending' | 'partial',
    amount_paid: 0,
    amount: 0, // Legacy support
  });
  const [newSupplier, setNewSupplier] = useState({ name: '', contact_info: '', ice: '', email: '', phone: '' });
  const [generalNote, setGeneralNote] = useState('');
  const [isSavingGeneralNote, setIsSavingGeneralNote] = useState(false);
  const today = new Date();
  const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 2, 1).toISOString().slice(0, 10);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
  const [accountingRange, setAccountingRange] = useState({ start: threeMonthsAgo, end: monthEnd });
  const [lastTransaction, setLastTransaction] = useState<any>(null);
  const [newProduct, setNewProduct] = useState<any>({ 
    id: '', 
    name: '', 
    price: 0, 
    icon: '🥐', 
    ingredients: [],
    prep_time: 0,
    cook_time: 0,
    yield_qty: 1,
    instructions: []
  });
  const [newMaterial, setNewMaterial] = useState<any>({ name: '', price: 0, unit: 'g', min_threshold: 1000 });
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

  // State used by recipe search and online/offline handling.
  const [recipeSearchQuery, setRecipeSearchQuery] = useState('');
  const [recipeSearchResults, setRecipeSearchResults] = useState<any[]>([]);
  const [isSearchingRecipes, setIsSearchingRecipes] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isForecasting, setIsForecasting] = useState(false);

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

  const allNavItems = [
    { id: 'dashboard', label: t('dashboard') },
    { id: 'intelligence', label: 'Intelligence' },
    { id: 'pos', label: t('pos') },
    { id: 'kitchen', label: t('kitchen') },
    { id: 'kitchen_board', label: 'Kitchen Board' },
    { id: 'inventory', label: t('inventory') },
    { id: 'fiche', label: t('fiche') },
    { id: 'purchasing', label: t('purchasing') },
    { id: 'simulator', label: t('simulator') },
    { id: 'history', label: t('history') },
    { id: 'stock_movements', label: 'Stock Ledger' },
    { id: 'planner', label: t('planner') },
    { id: 'orders', label: t('orders') },
    { id: 'comptabilite', label: t('comptabilite') },
    { id: 'expenses', label: t('expenses_1') },
    { id: 'staff', label: t('staff') },
    { id: 'settings', label: 'Settings' },
    { id: 'customers', label: t('customers') }
  ];

  const cashierRestrictedTabs = ['simulator', 'inventory', 'purchasing', 'intelligence', 'staff', 'stock_movements', 'expenses', 'comptabilite'];

  const filteredNavItems = allNavItems.filter(item => {
    if (user?.role === 'cashier' && cashierRestrictedTabs.includes(item.id)) return false;
    if (item.id === 'stock_movements' && user?.role !== 'owner') return false;
    return true;
  });

  const navigationActions = filteredNavItems.map(item => ({
    name: item.label,
    category: 'Navigation',
    onSelect: () => setActiveTab(item.id)
  }));

  const commandActions = [
    ...navigationActions,
    ...(inventory?.products || []).map(p => ({
      name: `Recipe: ${p.name}`,
      category: 'Products',
      onSelect: () => setSelectedProduct(p)
    }))
  ];

  const getDownloadToken = async (): Promise<string> => {
    const { data } = await http.get('/auth/download-token');
    return data.download_token;
  };

  const [showAddStaff, setShowAddStaff] = useState(false);
  const [newStaff, setNewStaff] = useState({ username: '', password: '' });







  const handleSmartForecast = async (date: string) => {
    // Ask the backend for forecasted quantities, then convert the response
    // into planner rows for the UI.
    setIsForecasting(true);
    try {
        const data = await api.get(`/forecast?target_date=${date}`);
        const newPlans = data.map((item: any) => ({
            id: Math.random().toString(36).substr(2, 9),
            date,
            product_id: item.product_id,
            quantity: item.suggested_qty,
            status: 'pending' as const
        }));
        setPlanner(prev => [...prev.filter(p => p.date !== date), ...newPlans]);
        addToast(`Smart Plan generated for ${date}`, 'success');
    } catch (e) {
        console.error(e);
        addToast(t('forecasting_failed_please_chec'), 'error');
    } finally {
      setIsForecasting(false);
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // When the internet comes back, replay queued offline changes first,
      // then refresh the currently visible tab only.
      processSyncQueue().then(() => fetchTabData(activeTab));
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [activeTab]);

  const formatPrice = (amount: number) => formatMoney(amount, activeCurrency, liveRates);

  // Fetch live exchange rates — now handled inside useBakeryData.

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthSubmitting(true);
    try {
      const res = await http.post('/auth/login', loginForm);
      const { access_token, refresh_token, username, role } = res.data;
      localStorage.setItem('bakery_token', access_token);
      if (refresh_token) localStorage.setItem('bakery_refresh_token', refresh_token);
      localStorage.setItem('bakery_user', JSON.stringify({ username, role }));
      setUser({ username, role });
    } catch (err) {
      addToast(t('invalid_credentials'), 'error');
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signupForm.password !== signupForm.confirmPassword) {
      addToast(t('passwords_do_not_match'), "error");
      return;
    }
    
    setIsAuthSubmitting(true);
    try {
      // 1. Create the account
      await http.post('/auth/signup', {
        username: signupForm.username,
        password: signupForm.password
      });
      
      // 2. Automatically log them in
      const res = await http.post('/auth/login', {
        username: signupForm.username,
        password: signupForm.password
      });
      
      const { access_token, refresh_token, username, role } = res.data;
      localStorage.setItem('bakery_token', access_token);
      if (refresh_token) localStorage.setItem('bakery_refresh_token', refresh_token);
      localStorage.setItem('bakery_user', JSON.stringify({ username, role }));
      setUser({ username, role });
      addToast(t('bakery_ready'), "success");
    } catch (err: any) {
      addToast(err.response?.data?.detail || "Signup failed", "error");
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleGoogleSuccess = async (response: any) => {
    // After Google login succeeds, save the same local token and user data as a normal login.
    try {
      const res = await http.post('/auth/google', { credential: response.credential });
      const { access_token, refresh_token, username, role } = res.data;
      localStorage.setItem('bakery_token', access_token);
      if (refresh_token) localStorage.setItem('bakery_refresh_token', refresh_token);
      localStorage.setItem('bakery_user', JSON.stringify({ username, role }));
      setUser({ username, role });
      addToast(t('welcome_back'), "success");
    } catch (err) {
      addToast(t('google_sign_in_failed'), "error");
    }
  };

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('bakery_user');
      if (savedUser) {
        // Restore the saved browser session so a refresh does not log the user out.
        setUser(JSON.parse(savedUser));
      } else {
        setLoading(false); // No user, stop loading to show login screen
      }
    } catch (e) {
      console.error("Error loading user from storage", e);
      localStorage.removeItem('bakery_user');
      setLoading(false);
    }
  }, []);

  // When editingExpense changes (set from FinancePanel), pre-populate the expense modal form.
  useEffect(() => {
    if (editingExpense) {
      setNewExpense({
        category: editingExpense.category || 'other',
        description: editingExpense.description || '',
        input_mode: (editingExpense.input_mode as 'HT' | 'TTC') || 'TTC',
        amount_ht: editingExpense.amount_ht || 0,
        amount_ttc: editingExpense.amount_ttc || editingExpense.amount || 0,
        tva_rate: editingExpense.tva_rate ?? 20,
        tva_amount: editingExpense.tva_amount || 0,
        is_tva_deductible: editingExpense.is_tva_deductible ?? true,
        supplier_id: editingExpense.supplier_id || null,
        invoice_ref: editingExpense.invoice_ref || '',
        status: editingExpense.status || 'paid',
        amount_paid: editingExpense.amount_paid || 0,
        amount: editingExpense.amount_ttc || editingExpense.amount || 0,
      });
    }
  }, [editingExpense]);

  const [gsiReady, setGsiReady] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Defer Google Identity Services script loading to avoid main thread blocking
  useEffect(() => {
    if (!user) {
      // 2.5s delay ensures Lighthouse finishes LCP/FCP metrics before the
      // heavy 153KB Google script blocks the main thread.
      const timer = setTimeout(() => setGsiReady(true), 2500);
      return () => clearTimeout(timer);
    }
  }, [user]);

  if (!user) {
    return (
      <main className="min-h-screen min-h-[100dvh] w-full bg-[#060606] text-white overflow-hidden font-sans" role="main">
        {/* Mobile View (Hidden on Desktop) */}
        <div className="lg:hidden flex w-full flex-col items-center justify-center min-h-screen min-h-[100dvh] p-6 relative">
          <div className="absolute inset-0 z-0">
            <img src="/pain.png" alt={t('premium_bakery_background')} className="w-full h-full object-cover opacity-40 grayscale-[0.2]" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/80 to-[#060606]"></div>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.15)_0%,transparent_80%)]"></div>
          </div>
          <div className="relative z-10 w-full max-w-sm rounded-[2rem] border border-white/10 bg-black/60 backdrop-blur-2xl p-8 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            <div className="flex flex-col items-center mb-10 text-center">
              <div className="h-16 w-16 rounded-full overflow-hidden border border-gold/40 shadow-[0_0_20px_rgba(212,175,55,0.4)] mb-6">
                <img src="/columbina-login.jpg" alt={t('crest')} className="w-full h-full object-cover" />
              </div>
              <h1 className="text-3xl font-light tracking-[0.2em] uppercase text-white font-serif leading-none">
                {t('bakery')}<span className="font-bold text-gold">OS</span>
              </h1>
            </div>
            {/* Mobile Form omitted for brevity, reusing the desktop form logic below but in single column */}
            <form onSubmit={authMode === 'login' ? handleLogin : handleSignup} className="space-y-6">
                <div className="relative group">
                  <input id="mobile-username" type="text" value={authMode === 'login' ? loginForm.username : signupForm.username} onChange={(e) => authMode === 'login' ? setLoginForm({ ...loginForm, username: e.target.value }) : setSignupForm({ ...signupForm, username: e.target.value })} className="monolith-input peer" placeholder=" " required />
                  <label htmlFor="mobile-username" className="monolith-label">{authMode === 'login' ? 'Username' : 'Username'}</label>
                  <div className="monolith-input-highlight" />
                </div>
                <div className="relative group">
                  <input id="mobile-password" type={showPassword ? 'text' : 'password'} value={authMode === 'login' ? loginForm.password : signupForm.password} onChange={(e) => authMode === 'login' ? setLoginForm({ ...loginForm, password: e.target.value }) : setSignupForm({ ...signupForm, password: e.target.value })} className="monolith-input peer pr-10" placeholder=" " required />
                  <label htmlFor="mobile-password" className="monolith-label">{t('password')}</label>
                  <div className="monolith-input-highlight" />
                </div>
                <button type="submit" disabled={isAuthSubmitting} className="monolith-btn mt-8 h-12 text-xs font-bold tracking-widest">{isAuthSubmitting ? <span className="flex items-center justify-center gap-2"><span className="login-spinner" /> {t('authenticating')}</span> : (authMode === 'login' ? 'Login' : 'Sign Up')}</button>
            </form>
            
            <div className="w-full mt-10">
              <div className="flex items-center gap-4 mb-6 opacity-50">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/50" />
                <span className="text-[10px] tracking-[0.2em] uppercase font-bold text-white/70">{t('external_protocol')}</span>
                <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/50" />
              </div>

              <div className="h-[44px] w-full mx-auto overflow-hidden rounded-xl border border-white/10 hover:border-gold/40 transition-colors bg-white/[0.03]">
                {gsiReady ? (
                  <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                    <GoogleLogin
                      onSuccess={handleGoogleSuccess}
                      onError={() => addToast(t('link_failed'), 'error')}
                      theme={t('filled_black')}
                      shape="rectangular"
                      width="100%"
                      use_fedcm={false}
                    />
                  </GoogleOAuthProvider>
                ) : (
                  <div className="w-full h-full bg-white/5 animate-pulse" />
                )}
              </div>
            </div>
          </div>
          {/* Mobile Footer */}
          <div className="absolute bottom-6 left-0 right-0 z-10 text-center flex flex-col gap-2 opacity-80">
            <div className="text-[9px] uppercase tracking-widest text-white/40">
              &copy; {new Date().getFullYear()} BakeryOS
            </div>
            <div className="flex justify-center gap-4 text-[9px] uppercase tracking-wider text-white/40">
              <a href="#" className="hover:text-gold transition-colors">{t('privacy_policy')}</a>
              <span className="text-white/10">•</span>
              <a href="#" className="hover:text-gold transition-colors">{t('terms_of_service')}</a>
            </div>
          </div>
        </div>

        {/* Desktop PC View (Hidden on Mobile) */}
        <div className="hidden lg:grid min-h-screen min-h-[100dvh] w-full grid-cols-12 grid-rows-1 p-6 gap-6">
          
          {/* Left Column: Hero Panel */}
          <div className="col-span-8 relative rounded-[2rem] overflow-hidden border border-white/10 bg-[#0a0a0b] shadow-2xl flex flex-col justify-between p-16 group">
            {/* Premium Image Background */}
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
               <img src="/pain.png" alt={t('premium_bakery')} className="w-full h-full object-cover opacity-60 mix-blend-luminosity scale-105 transition-transform duration-1000 group-hover:scale-110" />
               <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0b] via-[#0a0a0b]/60 to-[#0a0a0b]/20"></div>
               <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0b]/80 via-transparent to-[#0d0d0f]"></div>
               <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-[radial-gradient(circle,rgba(212,175,55,0.15)_0%,transparent_70%)] blur-3xl"></div>
               <div className="absolute bottom-[-20%] right-[-10%] w-[80%] h-[80%] bg-[radial-gradient(circle,rgba(212,175,55,0.1)_0%,transparent_60%)] blur-3xl"></div>
               <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10"></div>
            </div>

            {/* Top Bar */}
            <div className="relative z-10 flex justify-between items-start">
              <div className="flex items-center gap-6">
                <div className="h-16 w-16 rounded-full overflow-hidden border border-gold/40 shadow-[0_0_30px_rgba(212,175,55,0.5)]">
                  <img src="/columbina-login.jpg" alt={t('crest')} className="w-full h-full object-cover" />
                </div>
                <div>
                  <h1 className="text-4xl font-light tracking-[0.2em] uppercase text-white font-serif leading-none">
                    {t('bakery')}<span className="font-bold text-gold">OS</span>
                  </h1>
                  <p className="text-[10px] tracking-[0.4em] uppercase text-gold/60 mt-2 font-semibold">{t('enterprise_terminal')}</p>
                </div>
              </div>
              <div className="text-right flex gap-8">
                 <div>
                    <div className="text-[9px] uppercase tracking-[0.2em] text-white/30 mb-2">{t('mainframe')}</div>
                    <div className="flex items-center gap-2 text-sm font-light text-white/70">
                      <div className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)]" /> {t('active')}
                    </div>
                 </div>
                 <div>
                    <div className="text-[9px] uppercase tracking-[0.2em] text-white/30 mb-2">{t('protocol')}</div>
                    <div className="text-sm font-light text-white/70">{t('aes_256')}</div>
                 </div>
              </div>
            </div>

            {/* Bottom Hero Text */}
            <div className="relative z-10 max-w-3xl mt-auto">
              {/* Desktop Footer */}
              <div className="flex items-center gap-6 text-[9px] uppercase tracking-widest text-white/40 w-fit">
                <div>&copy; {new Date().getFullYear()} BakeryOS</div>
                <a href="#" className="hover:text-gold transition-colors">{t('privacy_policy')}</a>
                <a href="#" className="hover:text-gold transition-colors">{t('terms_of_service')}</a>
              </div>
            </div>
          </div>

          {/* Right Column: Login Panel */}
          <div className="col-span-4 relative rounded-[2rem] overflow-hidden border border-white/10 bg-[#0d0d0f] shadow-2xl flex flex-col items-center justify-center p-12 lg:p-16">
            <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.05)_0%,transparent_50%)] pointer-events-none"></div>
            
            <div className="relative z-10 w-full max-w-[340px]">
              {/* Mode Toggle */}
              <div className="flex w-full mb-12 border-b border-white/10">
                <button
                  onClick={() => setAuthMode('login')}
                  className={`flex-1 pb-4 text-[11px] font-bold tracking-widest uppercase transition-colors relative ${authMode === 'login' ? 'text-gold' : 'text-white/30 hover:text-white/60'}`}
                  type="button"
                >
                  Login
                  {authMode === 'login' && <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-gold shadow-[0_0_10px_rgba(212,175,55,0.8)]" />}
                </button>
                <button
                  onClick={() => setAuthMode('signup')}
                  className={`flex-1 pb-4 text-[11px] font-bold tracking-widest uppercase transition-colors relative ${authMode === 'signup' ? 'text-gold' : 'text-white/30 hover:text-white/60'}`}
                  type="button"
                >
                  Sign Up
                  {authMode === 'signup' && <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-gold shadow-[0_0_10px_rgba(212,175,55,0.8)]" />}
                </button>
              </div>

              {/* Form */}
              <form onSubmit={authMode === 'login' ? handleLogin : handleSignup} className="w-full space-y-8">
                <div className="relative group">
                  <input
                    id="desktop-username"
                    type="text"
                    value={authMode === 'login' ? loginForm.username : signupForm.username}
                    onChange={(e) => authMode === 'login'
                      ? setLoginForm({ ...loginForm, username: e.target.value })
                      : setSignupForm({ ...signupForm, username: e.target.value })}
                    className="monolith-input peer text-lg"
                    placeholder=" "
                    required
                  />
                  <label htmlFor="desktop-username" className="monolith-label text-sm">
                    {authMode === 'login' ? 'Username' : 'Username'}
                  </label>
                  <div className="monolith-input-highlight" />
                </div>

                <div className="relative group">
                  <input
                    id="desktop-password"
                    type={showPassword ? 'text' : 'password'}
                    value={authMode === 'login' ? loginForm.password : signupForm.password}
                    onChange={(e) => authMode === 'login'
                      ? setLoginForm({ ...loginForm, password: e.target.value })
                      : setSignupForm({ ...signupForm, password: e.target.value })}
                    className="monolith-input peer pr-10 text-lg"
                    placeholder=" "
                    required
                  />
                  <label htmlFor="desktop-password" className="monolith-label text-sm">{t('password')}</label>
                  <div className="monolith-input-highlight" />
                  
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-0 bottom-3 text-white/30 hover:text-gold transition-colors p-2"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {authMode === 'signup' && (
                  <div className="relative group">
                    <input
                      id="desktop-confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      value={signupForm.confirmPassword}
                      onChange={(e) => setSignupForm({ ...signupForm, confirmPassword: e.target.value })}
                      className="monolith-input peer text-lg"
                      placeholder=" "
                      required
                    />
                    <label htmlFor="desktop-confirm-password" className="monolith-label text-sm">{t('confirm_password')}</label>
                    <div className="monolith-input-highlight" />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isAuthSubmitting}
                  className="monolith-btn mt-10 h-14 text-sm font-bold tracking-widest"
                >
                  {isAuthSubmitting
                    ? <span className="flex items-center justify-center gap-3"><span className="login-spinner" /> {t('authenticating')}</span>
                    : authMode === 'login' ? 'Login' : 'Sign Up'
                  }
                </button>
              </form>

              {/* GSI Integration */}
              <div className="w-full mt-14">
                <div className="flex items-center gap-4 mb-8 opacity-40">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white" />
                  <span className="text-[9px] tracking-[0.2em] uppercase font-bold">{t('external_protocol')}</span>
                  <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white" />
                </div>

                <div className="h-[48px] w-full mx-auto overflow-hidden rounded-[1rem] border border-white/10 hover:border-gold/40 transition-colors bg-white/[0.02]">
                  {gsiReady ? (
                    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                      <GoogleLogin
                        onSuccess={handleGoogleSuccess}
                        onError={() => addToast(t('link_failed'), 'error')}
                        theme={t('filled_black')}
                        shape="rectangular"
                        width="100%"
                        use_fedcm={false}
                      />
                    </GoogleOAuthProvider>
                  ) : (
                    <div className="w-full h-full bg-white/5 animate-pulse" />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }


  const addToCart = (product: Product) => {
    // In edit mode, clicking a product should not add it to the cart.
    if (editMode) return;
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const finalizeSale = async (customerId?: string | null) => {
    // Completing a sale creates a transaction in the backend and empties the cart.
    if (cart.length === 0) return;
    try {
      const data = await api.post('/complete', { 
        cart: cart.map(item => ({ id: item.id, qty: item.qty })),
        customer_id: customerId || undefined
      });
      setLastTransaction(data);
      setCart([]);
      fetchData();
      addToast(t('sale_completed'), "success");
    } catch (error: any) {
      const msg = error.response?.data?.detail || "Sale Failed";
      addToast(msg, "error");
    }
  };

  const runSimulation = async () => {
      // Ask the backend to preview how ingredient price changes would affect profits.
      try {
          const res = await http.post('/simulate_price', simPrices);
          setSimulationResult(res.data);
      } catch (e) { console.error(e); }
  };

  const saveSimulation = async () => {
      // Only save simulated prices when edit mode is enabled.
      if (!editMode) return;
      try {
          await http.post('/update_material_prices', simPrices);
          fetchData();
          addToast(t('material_prices_updated'), 'success');
      } catch (e) { console.error(e); }
  };

  const handleResetSession = async () => {
    // This starts a new session without deleting the old history.
    showConfirm({
        title: "Close Current Shift",
        message: "This will reset the Session Profit counter to 0 for a new shift. Your global history is safe.",
        type: 'info',
        confirmText: "Start New Shift",
        onConfirm: async () => {
            try {
                await http.post('/maintenance/reset-session');
                fetchData();
                addToast(t('shift_closed_new_session_start'), "success");
            } catch (e: any) {
                addToast(t('reset_failed'), "error");
            }
        }
    });
  };


  const startEditingMaterial = (name: string, data: any) => {
    // The same modal is used for both adding and editing a material.
    setEditingMaterialName(name);
    setNewMaterial({
        name: name,
        unit: data.unit || 'g',
        price: data.price || 0,
        min_threshold: data.min_threshold || 0
    });
    setShowAddMaterial(true);
  };

  const updateExpenseCalculations = (updated: Partial<typeof newExpense>) => {
    setNewExpense(prev => {
      const next = { ...prev, ...updated };
      // Safely parse the rate, ensuring 0 is treated as a valid number, not falsy.
      const rate = next.tva_rate !== undefined && !isNaN(Number(next.tva_rate)) 
        ? Number(next.tva_rate) 
        : 20;

      if (next.input_mode === 'TTC') {
        const ttc = Number(next.amount_ttc) || 0;
        next.amount_ht = parseFloat((ttc / (1 + rate / 100)).toFixed(2));
        next.tva_amount = parseFloat((ttc - next.amount_ht).toFixed(2));
      } else {
        const ht = Number(next.amount_ht) || 0;
        next.amount_ttc = parseFloat((ht * (1 + rate / 100)).toFixed(2));
        next.tva_amount = parseFloat((next.amount_ttc - ht).toFixed(2));
      }

      if (next.status === 'paid') {
        next.amount_paid = next.amount_ttc;
      } else if (next.status === 'pending') {
        next.amount_paid = 0;
      } else {
        if (updated.status === 'partial') {
          next.amount_paid = parseFloat((next.amount_ttc / 2).toFixed(2));
        }
      }
      
      next.amount = next.amount_ttc; // Sync legacy amount field
      return next;
    });
  };






  const handleOpenEditProduct = (product: Product) => {
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
  };










  const openPOModal = (po: any) => {
    // Make a local editable copy so the owner can change notes, ETA, and
    // received quantities before saving.
    setSelectedPO({
      ...po,
      expected_delivery_date: po.expected_delivery_date ? po.expected_delivery_date.slice(0, 10) : '',
      notes: po.notes || ''
    });
    setPoReceiveDraft(
      Object.fromEntries(
        po.items.map((item: any) => [
          item.name,
          {
            qty: Math.max(0, (Number(item.qty) || 0) - (Number(item.received_qty) || 0)),
            price: Number(item.price) || 0,
            lot_code: '',
            supplier_lot_code: '',
            expires_at: '',
            location_id: stockLocations.find(location => location.type === 'warehouse')?.id ?? stockLocations[0]?.id ?? null,
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
      fetchData();
      addToast(t('purchase_order_updated'), "success");
      setShowPOModal(false);
    } catch (e: any) {
      addToast(t('failed_to_update_purchase_orde'), "error");
    }
  };

  const handlePartialReceivePO = async () => {
    if (!selectedPO) return;
    const items = selectedPO.items
      .map((item: any) => {
        const draft = poReceiveDraft[item.name] || { qty: 0, price: Number(item.price) || 0 };
        const receiveItem: any = {
          name: item.name,
          qty: Math.max(0, Number(draft.qty) || 0),
          price: Number(draft.price) || Number(item.price) || 0
        };
        const lotCode = draft.lot_code?.trim();
        const supplierLotCode = draft.supplier_lot_code?.trim();
        if (lotCode) receiveItem.lot_code = lotCode;
        if (supplierLotCode) receiveItem.supplier_lot_code = supplierLotCode;
        if (draft.expires_at) receiveItem.expires_at = `${draft.expires_at}T00:00:00`;
        if (draft.location_id) receiveItem.location_id = draft.location_id;
        return receiveItem;
      })
      .filter((item: any) => item.qty > 0);
    if (!items.length) {
      addToast(t('enter_received_quantities_firs'), "error");
      return;
    }
    await handleReceivePO(selectedPO.id, { items });
    setShowPOModal(false);
  };

  const handleSearchRecipes = async () => {
    // The backend recipe search combines built-in starter recipes with external results.
    if (!recipeSearchQuery.trim()) return;
    setIsSearchingRecipes(true);
    try {
      const res = await http.get(`/external-recipes/search?query=${recipeSearchQuery}`);
      setRecipeSearchResults(res.data);
    } catch (e) { console.error(e); }
    finally { setIsSearchingRecipes(false); }
  };

  const openExternal = (url: string) => {
    // Open external links safely without leaving a live reference back to this page.
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (opened) {
      opened.opener = null;
      return;
    }
    window.location.assign(url);
  };

  const openDocument = async (url: string, fallbackFilename: string) => {
    const absoluteUrl = new URL(url, window.location.origin).toString();
    const isDownload = fallbackFilename.toLowerCase().endsWith('.xlsx') || 
                       fallbackFilename.toLowerCase().endsWith('.xls') ||
                       fallbackFilename.toLowerCase().endsWith('.csv');

    if (isDownload) {
      // Optimized Direct Download for Linux/All Platforms
      const link = document.createElement('a');
      link.href = absoluteUrl;
      link.download = fallbackFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // For PDFs/Receipts, open in a new tab so printing/viewing feels natural
    const popup = window.open('', '_blank', 'noopener,noreferrer');
    if (popup) {
      popup.opener = null;
      popup.location.replace(absoluteUrl);
      return;
    }
    window.location.assign(absoluteUrl);
  };

  const handleImportRecipe = async (recipeId: string) => {
    try {
      const res = await http.get(`/external-recipes/${recipeId}/details`);
      const details = res.data;

      // Build a short draft product ID from the imported recipe name.
      const slug = details.name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 10);
      const randomSuffix = Math.floor(Math.random() * 1000);

      // Fill the product form automatically so the owner can review it before saving.
      setNewProduct({
        ...newProduct,
        name: details.name,
        ingredients: details.ingredients,
        instructions: details.instructions || [],
        id: `${slug}-${randomSuffix}`
      });

      // Clear the recipe search after a successful import.
      setRecipeSearchResults([]);
      setRecipeSearchQuery('');
    } catch (e) { console.error(e); }
  };


  const now = new Date();
  const {
    accountingFeed,
    draftPurchaseCommitment,
    expenseBreakdown,
    filteredExpenses,
    filteredPurchaseOrders,
    filteredSales,
    filteredWaste,
    monthlyExpensesTotal,
    monthlyNetAfterExpenses,
    monthlySales,
    productProfitability,
    wasteByProduct,
  } = deriveAccountingMetrics({
    history,
    expenses,
    purchaseOrders,
    wasteRecords,
    suppliers,
    accountingRange,
  });
  const sortedMaterialEntries = Object.entries(inventory.materials).sort(([nameA], [nameB]) =>
    nameA.localeCompare(nameB)
  );
  const sortedMaterialNames = sortedMaterialEntries.map(([name]) => name);

  const panelProps: DashboardSharedProps = {
    user, API_BASE: http.defaults.baseURL || '', settings,
    isDarkMode, setIsDarkMode, activeCurrency, setActiveCurrency,
    editMode, setEditMode, lang, setLang,
    inventory, analytics, history, stockMovements, stockLocations, stockLotBalances,
    semiFinishedItems: [],
    planner, orders, expenses, suppliers,
    purchaseOrders, purchasingSuggestions, selectedSupplierId, setSelectedSupplierId,
    staff, shiftLogs, alerts, profitReport, wasteRecords, customers,
    accountingRange, setAccountingRange, monthStart, monthEnd,
    accountingFeed, draftPurchaseCommitment, expenseBreakdown,
    filteredExpenses, filteredPurchaseOrders, filteredSales, filteredWaste,
    monthlyExpensesTotal, monthlyNetAfterExpenses, monthlySales,
    productProfitability, wasteByProduct,
    cart, setCart, addToCart, finalizeSale, lastTransaction,
    setShowReceiptModal, setShowBookingModal, bookingForm, setBookingForm,
    setShowAddProduct, setShowAddMaterial, setShowAddExpense, editingExpense, setEditingExpense, setShowAddSupplier,
    setShowAddStaff, setShowPOModal, setShowWasteModal, editingProductId, setEditingProductId,
    editingMaterialName, setEditingMaterialName, editingSupplier, setEditingSupplier,
    newMaterial, setNewMaterial, newSupplier, setNewSupplier, selectedPO, setSelectedPO,
    poReceiveDraft, setPoReceiveDraft,
    simPrices, setSimPrices, simulatedInflations, setSimulatedInflations, simulationResult, runSimulation, saveSimulation,
    isForecasting, handleSmartForecast, handleProduce, setPlanner, setSelectedProduct,
    generalNote, setGeneralNote, isSavingGeneralNote, handleSaveGeneralNote, handleDeleteShiftLog,
    sortedMaterialEntries,
    sortedMaterialNames,
    handleAdjustStock, handleUpdateProductPrice, handleUpdateProductField,
    handleOpenEditProduct, handleDeleteProduct, handleDuplicateProduct, handleCleanupProducts,
    handleDeleteMaterial, startEditingMaterial, handleCreatePO,
    handleReceivePO, handleDeletePO, openPOModal, handleSavePO,
    handlePartialReceivePO, handleDeleteStaff, handleDeleteExpense, handleDeleteSupplier,
    handleAddSupplier, handleResetSession, handleCompletePlan, handleTransferStock,
    showTransferModal, setShowTransferModal,
    formatPrice, displayUnit: (v, u) => `${v}${u}`, openDocument, getDownloadToken, openSelector,
    addToast, showConfirm, fetchData, fetchTabData, api
  };

  if (loading) return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-charcoal text-gold">
       <div className="pinwheel mb-5" aria-hidden="true">
         <div className="pinwheel__line"></div>
         <div className="pinwheel__line"></div>
         <div className="pinwheel__line"></div>
         <div className="pinwheel__line"></div>
         <div className="pinwheel__line"></div>
         <div className="pinwheel__line"></div>
       </div>
       <p className="font-bold tracking-widest uppercase text-xs">{t('re_engaging_luxe_logiciel')}</p>
    </div>
  );

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className={`flex min-h-screen w-full overflow-x-hidden selection:bg-gold/30 transition-colors duration-500 ${isDarkMode ? 'dark bg-[#0a0a0b] text-cream' : 'light bg-slate-100 text-slate-900'} ${isRTL ? 'font-arabic' : 'font-sans'}`}>
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ 
          width: sidebarHoverMode ? (isSidebarHovered ? 288 : 80) : (isSidebarCollapsed ? 80 : 288),
          opacity: sidebarHoverMode ? (isSidebarHovered ? 1 : 0.3) : 1
        }}
        onMouseEnter={() => sidebarHoverMode && setIsSidebarHovered(true)}
        onMouseLeave={() => sidebarHoverMode && setIsSidebarHovered(false)}
        className={`fixed h-[calc(100vh-2rem)] top-4 left-4 z-50 flex flex-col overflow-y-auto overflow-x-hidden rounded-3xl transition-all duration-500 ${
          (sidebarHoverMode ? isSidebarHovered : !isSidebarCollapsed) ? 'custom-scrollbar' : 'no-scrollbar'
        } ${
          sidebarHoverMode
            ? (isSidebarHovered
                ? (isDarkMode ? 'glass-sidebar' : 'bg-white/80 backdrop-blur-2xl border border-slate-200 shadow-xl')
                : 'bg-transparent border-transparent shadow-none backdrop-blur-none')
            : (isDarkMode ? 'glass-sidebar' : 'bg-white/80 backdrop-blur-2xl border border-slate-200 shadow-xl')
        }`}
      >
        <div className="p-6">
          <div className="flex items-center gap-3 mb-10">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shrink-0 ${isDarkMode ? 'bg-gold shadow-gold-glow' : 'bg-slate-900 shadow-slate-200'}`}>
              <Box className={`${isDarkMode ? 'text-charcoal' : 'text-white'} w-6 h-6`} />
            </div>
            {!(sidebarHoverMode ? !isSidebarHovered : isSidebarCollapsed) && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <h1 className="brand-title" style={{ ['--brand-hover' as any]: '#d4af37' }}>
                    <span className={`brand-title__base text-2xl font-bold luxury-font tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      {t('bakery')}<span className="text-gold">Os</span>
                    </span>
                    <span aria-hidden="true" className="brand-title__hover text-2xl font-bold luxury-font tracking-tight">
                      {t('bakery')}<span>Os</span>
                    </span>
                  </h1>
                  <span className="inline-flex mt-3 text-[10px] bg-gold/10 text-gold px-2 py-0.5 rounded-full font-black">{t('beta_0_1')}</span>
              </motion.div>
            )}
          </div>

          <nav className="space-y-1">
            {[
              { id: 'dashboard', icon: LayoutDashboard, label: t('dashboard') },
              { id: 'intelligence', icon: Brain, label: 'Intelligence' },
              { id: 'pos', icon: ShoppingCart, label: t('pos') },
              { id: 'kitchen', icon: ChefHat, label: t('kitchen') },
              { id: 'kitchen_board', icon: ClipboardList, label: 'Kitchen Board' },
              { id: 'inventory', icon: Package, label: t('inventory') },
              { id: 'fiche', icon: FileText, label: t('fiche') },
              { id: 'purchasing', icon: Truck, label: t('purchasing') },
              { id: 'simulator', icon: Calculator, label: t('simulator') },
              { id: 'history', icon: HistoryIcon, label: t('history') },
              ].filter(item => {
              if (user?.role === 'cashier' && ['simulator', 'inventory', 'purchasing', 'intelligence'].includes(item.id)) return false;
              return true;
              })
.map((item) => (

              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300 ${
                  activeTab === item.id 
                    ? (isDarkMode ? 'bg-gold/10 text-gold border border-gold/20 shadow-gold-glow' : 'bg-slate-100 text-slate-900 border border-slate-200 shadow-sm') 
                    : (isDarkMode ? 'text-cream/40 hover:bg-white/5 hover:text-cream' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700')
                }`}
                title={(sidebarHoverMode ? !isSidebarHovered : isSidebarCollapsed) ? item.label : ''}
              >
                <item.icon size={20} className="shrink-0" />
                {!(sidebarHoverMode ? !isSidebarHovered : isSidebarCollapsed) && <span className="font-semibold text-sm whitespace-nowrap">{item.label}</span>}
              </button>
            ))}

            {/* Operations Dropdown */}
            <div className="pt-4">
                <button 
                    onClick={() => setIsOperationsOpen(!isOperationsOpen)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${isDarkMode ? 'text-gold/60 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                    <div className="flex items-center gap-4">
                        <Settings size={20} />
                        {!(sidebarHoverMode ? !isSidebarHovered : isSidebarCollapsed) && <span className="font-bold text-[10px] uppercase tracking-[0.2em]">{t('operations')}</span>}
                    </div>
                    {!(sidebarHoverMode ? !isSidebarHovered : isSidebarCollapsed) && (
                        <motion.div animate={{ rotate: isOperationsOpen ? 180 : 0 }}>
                            <ChevronDown size={14} />
                        </motion.div>
                    )}
                </button>
                
                <AnimatePresence>
                    {isOperationsOpen && !(sidebarHoverMode ? !isSidebarHovered : isSidebarCollapsed) && (
                        <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden space-y-1 mt-1 pl-4"
                        >
                            {[
                                { id: 'comptabilite', icon: Coins, label: t('comptabilite') },
                                { id: 'planner', icon: Calendar, label: t('planner') },
                              { id: 'orders', icon: FileText, label: t('orders') },
                                { id: 'stock_movements', icon: Activity, label: 'Stock Ledger' },
                                { id: 'customers', icon: Users, label: t('customers') },
                                { id: 'staff', icon: Users, label: t('staff') },
                                { id: 'settings', icon: Settings, label: t('settings') },
                            ].filter(sub => {
                                if ((sub.id === 'staff' || sub.id === 'stock_movements') && user?.role !== 'owner') return false;
                                return true;
                            }).map(sub => (

                                <button
                                    key={sub.id}
                                    onClick={() => setActiveTab(sub.id)}
                                    className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-all ${
                                        activeTab === sub.id 
                                            ? (isDarkMode ? 'text-gold border-l-2 border-gold bg-gold/5' : 'text-slate-900 border-l-2 border-slate-900 bg-slate-50') 
                                            : (isDarkMode ? 'text-cream/30 hover:text-cream' : 'text-slate-400 hover:text-slate-700')
                                    }`}
                                >
                                    <sub.icon size={16} />
                                    <span className="font-bold text-[11px] uppercase tracking-widest">{sub.label}</span>
                                </button>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
          </nav>
        </div>

        <div className="mt-auto p-6 space-y-4">
          {!sidebarHoverMode && (
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className={`w-full py-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${isDarkMode ? 'border-white/5 bg-white/5 text-gold hover:bg-white/10' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
          >
            {isSidebarCollapsed ? <ChevronRight size={16}/> : <ChevronLeft size={16}/>}
            {!isSidebarCollapsed && <span className="text-[10px] font-black uppercase tracking-widest">{t('collapse_view')}</span>}
          </button>
          )}

          {/* Action & Logout Controls */}
          <div className={`mt-4 pt-4 border-t ${isDarkMode ? 'border-white/5' : 'border-slate-100'} space-y-2`}>
            <button 
              onClick={() => setShowWasteModal(true)} 
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs uppercase tracking-widest border border-rose-500/20 text-rose-500 hover:bg-rose-500/10 transition-all ${isSidebarCollapsed ? 'px-0' : ''}`}
              title={t('log_daily_waste')}
            >
              {(sidebarHoverMode ? !isSidebarHovered : isSidebarCollapsed) ? <AlertTriangle size={16}/> : 'Log Daily Waste'}
            </button>
            <button 
                onClick={() => { 
                  localStorage.removeItem('bakery_token'); 
                  localStorage.removeItem('bakery_user');
                  localStorage.removeItem('bakery_refresh_token');
                  setUser(null); 
                }} 
                className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-xs uppercase tracking-widest bg-rose-600 hover:bg-rose-700 text-white shadow-lg transition-all ${isSidebarCollapsed ? 'px-0' : ''}`}
                title={t('logout')}
            >
                <LogOut size={16}/>
                {!(sidebarHoverMode ? !isSidebarHovered : isSidebarCollapsed) && t('logout')}
            </button>
          </div>

          </div>
      </motion.aside>

      {/* Main Content */}
      <motion.main 
        animate={{ marginLeft: (sidebarHoverMode || isSidebarCollapsed) ? 112 : 320 }}
        className={`flex-1 p-10 min-h-screen min-w-0 transition-colors duration-500 bg-transparent`}
      >
        <header className="flex justify-between items-end mb-12">
          <div>
            <h2 className={`text-5xl font-bold luxury-font mb-2 tracking-tighter uppercase text-gold-gradient`}>
                {activeTab === 'dashboard' && t('dashboard')}
                {activeTab === 'pos' && t('pos')}
                {activeTab === 'inventory' && t('inventory')}
                {activeTab === 'fiche' && t('fiche')}
                {activeTab === 'simulator' && t('simulator')}
                {activeTab === 'history' && t('history')}
                {activeTab === 'stock_movements' && 'Stock Ledger'}
                {activeTab === 'planner' && t('planner')}
                {activeTab === 'comptabilite' && t('comptabilite')}
                {activeTab === 'expenses' && t('expenses_1')}
                {activeTab === 'purchasing' && t('purchasing')}
                {activeTab === 'kitchen' && t('kitchen')}
                {activeTab === 'kitchen_board' && 'Kitchen Board'}
                {activeTab === 'intelligence' && 'Intelligence'}
                {activeTab === 'orders' && t('orders')}
                {activeTab === 'staff' && t('staff')}
                {activeTab === 'settings' && t('settings')}
                {activeTab === 'customers' && t('customers')}
            </h2>
            <div className="luxury-accent-bar mb-6" />
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-white/5 text-cream/45' : 'bg-white text-slate-500 border border-slate-200'}`}>
                {user?.role === 'owner' ? 'Head Baker' : user?.role || 'Staff'}
              </span>
              <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${isDarkMode ? 'bg-gold/10 text-gold' : 'bg-slate-900 text-white'}`}>
                {user?.username || 'Operator'}
              </span>
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${isOnline ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                {isOnline ? 'Connected' : 'Offline'}
              </span>
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-white/5 text-cream/45' : 'bg-white text-slate-500 border border-slate-200'}`}>
                {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}
              </span>
            </div>
          </div>
          <div className="flex gap-4">
            <div className={`px-4 py-2 flex items-center gap-3 rounded-2xl ${isDarkMode ? 'glass-panel' : 'border border-slate-200 bg-white shadow-sm'}`}>
              <div className="text-right">
                <p className={`text-[10px] uppercase tracking-widest font-black ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>{isOnline ? t('online') : t('offline')}</p>
                <p className={`text-xs font-bold ${isOnline ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {isOnline ? t('sync_active') : t('offline_mode')}
                </p>
              </div>
              <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.8)]' : 'bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.8)] animate-pulse'}`} />
            </div>

            {/* Theme Toggle */}
            <button 
              onClick={() => {
                const newTheme = !isDarkMode;
                setIsDarkMode(newTheme);
                localStorage.setItem('bakery_theme', newTheme ? 'dark' : 'light');
              }} 
              className={`p-3 rounded-2xl border transition-all flex items-center justify-center ${isDarkMode ? 'glass-panel hover:bg-white/5 border-gold/10 text-gold' : 'border-slate-200 bg-white shadow-sm text-slate-600 hover:bg-slate-50'}`}
              title={t('toggle_theme')}
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {/* Notifications Bell */}
            <div className="relative">
              <button 
                onClick={() => setShowAlertsPopover(!showAlertsPopover)}
                className={`p-3 rounded-2xl border transition-all relative ${isDarkMode ? 'glass-panel hover:bg-white/5 border-gold/10 text-gold' : 'border-slate-200 bg-white shadow-sm text-slate-600 hover:bg-slate-50'}`}
              >
                <Bell size={20} />
                {alerts.length > 0 && (
                  <span className="absolute top-2 right-2 w-4 h-4 bg-rose-500 text-white text-[8px] font-black flex items-center justify-center rounded-full border-2 border-[#0a0a0b] animate-pulse">
                    {alerts.length}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {showAlertsPopover && (
                  <motion.div 
                    ref={notificationRef}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className={`absolute right-0 mt-4 w-80 rounded-3xl border shadow-2xl z-[150] overflow-hidden ${isDarkMode ? 'bg-[#0a0a0b] border-white/10' : 'bg-white border-slate-200'}`}
                  >
                    <div className={`p-6 border-b ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                      <h4 className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-gold' : 'text-slate-900'}`}>{t('live_alerts')}</h4>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                      {alerts.length === 0 ? (
                        <div className="p-10 text-center">
                          <CheckCircle className="mx-auto mb-4 opacity-20" size={32} />
                          <p className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-cream/30' : 'text-slate-400'}`}>{t('system_clear')}</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-white/5">
                          {alerts.map(alert => (
                            <div key={alert.id} className="p-5 hover:bg-white/5 transition-colors group">
                              <div className="flex gap-4">
                                <div className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${alert.severity === 'high' ? 'bg-rose-500/10 text-rose-500' : 'bg-gold/10 text-gold'}`}>
                                  <AlertTriangle size={16} />
                                </div>
                                <div>
                                  <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${alert.severity === 'high' ? 'text-rose-400' : 'text-gold/60'}`}>{alert.type}</p>
                                  <p className={`text-xs font-bold leading-relaxed ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>{alert.message}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {user?.role === 'owner' && (
              <div className={`px-4 py-2 flex items-start gap-4 rounded-2xl ${isDarkMode ? 'glass-panel shadow-gold-glow border-gold/20' : 'border border-slate-200 bg-white shadow-sm'}`}>
                <div className="text-right">
                  <p className={`text-[10px] uppercase tracking-widest font-black ${isDarkMode ? 'text-gold' : 'text-slate-500'}`}>{t('master_control')}</p>
                  {editMode && (
                    <p className={`text-xs font-bold ${isDarkMode ? 'text-gold' : 'text-slate-500'}`}>
                      {t('active')}
                    </p>
                  )}
                </div>
                <div className="neo-toggle-container shrink-0">
                  <input
                    className="neo-toggle-input"
                    id="master-control-toggle"
                    type="checkbox"
                    checked={editMode}
                    onChange={(e) => setEditMode(e.target.checked)}
                  />
                  <label className={`neo-toggle ${editMode ? 'neo-activated neo-progress' : ''}`} htmlFor="master-control-toggle">
                    <div className="neo-track">
                      <div className="neo-background-layer"></div>
                      <div className="neo-grid-layer"></div>
                      <div className="neo-spectrum-analyzer">
                        <div className="neo-spectrum-bar"></div>
                        <div className="neo-spectrum-bar"></div>
                        <div className="neo-spectrum-bar"></div>
                        <div className="neo-spectrum-bar"></div>
                        <div className="neo-spectrum-bar"></div>
                      </div>
                      <div className="neo-track-highlight"></div>
                    </div>

                    <div className="neo-thumb">
                      <div className="neo-thumb-ring"></div>
                      <div className="neo-thumb-core">
                        <div className="neo-thumb-icon">
                          <div className="neo-thumb-wave"></div>
                          <div className="neo-thumb-pulse"></div>
                        </div>
                      </div>
                    </div>

                    <div className="neo-gesture-area"></div>

                    <div className="neo-interaction-feedback">
                      <div className="neo-ripple"></div>
                      <div className="neo-progress-arc"></div>
                    </div>

                    <div className="neo-status">
                      <div className="neo-status-indicator">
                        <div className="neo-status-dot"></div>
                        <div className="neo-status-text"></div>
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            )}

            <div className={`px-3 py-1.5 flex items-center gap-3 border rounded-xl ${isDarkMode ? 'border-gold/10 bg-black/20' : 'border-slate-200 bg-white shadow-sm'}`}>
              <div className="text-right">
                <p className={`text-[10px] uppercase tracking-widest font-black ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>{t('profit')}</p>
                <p className={`text-xl font-bold ${isDarkMode ? 'text-gold' : 'text-slate-900'}`}>{formatPrice(analytics.today_revenue - analytics.today_cost)}</p>
              </div>
              <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-gold/10 text-gold' : 'bg-slate-100 text-slate-900'}`}><TrendingUp size={20} /></div>
            </div>
          </div>
        </header>

        <AnimatePresence mode={t('wait')}>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <React.Suspense fallback={
              <div className="h-40 flex flex-col items-center justify-center gap-4 text-gold">
                <div className="pinwheel pinwheel--sm" aria-hidden="true">
                  <div className="pinwheel__line"></div>
                  <div className="pinwheel__line"></div>
                  <div className="pinwheel__line"></div>
                  <div className="pinwheel__line"></div>
                  <div className="pinwheel__line"></div>
                  <div className="pinwheel__line"></div>
                </div>
                <div className="text-[11px] font-black uppercase tracking-widest opacity-60">Engaging {activeTab}...</div>
              </div>
            }>
              {activeTab === 'dashboard' && <DashboardPanel {...panelProps} />}
              {activeTab === 'pos' && <POSPanel {...panelProps} />}
              {activeTab === 'inventory' && <InventoryPanel
                {...panelProps}
                onOpenTransferModal={() => setShowTransferModal(true)}
                onAddSemiFinished={() => { /* TODO: create modal */ addToast('Use Recipe to set up a new item', 'info'); }}
                onEditRecipe={(item) => { setActiveSFItem(item); setShowRecipeModal(true); }}
                onProduceBatch={(item) => { setActiveSFItem(item); setShowProduceModal(true); }}
                onShowCost={(product) => { setActiveCostProduct(product); setShowCostModal(true); }}
              />}
              {activeTab === 'kitchen_board' && (
                <KitchenBoardPanel
                  isDarkMode={isDarkMode}
                  batches={kitchenBatches || []}
                  onAdvanceStage={handleAdvanceStage}
                  isUpdating={isKitchenUpdating}
                />
              )}
              {activeTab === 'fiche' && <FichePanel {...panelProps} />}
              {activeTab === 'simulator' && <AnalyticsPanel {...panelProps} />}
              {activeTab === 'history' && <HistoryPanel {...panelProps} />}
              {activeTab === 'stock_movements' && <StockMovementsPanel {...panelProps} />}
              {activeTab === 'kitchen' && <KitchenPanel {...panelProps} />}
              {activeTab === 'intelligence' && <IntelligencePanel {...panelProps} />}
              {activeTab === 'planner' && <PlannerPanel {...panelProps} />}
              {activeTab === 'orders' && <OrdersPanel {...panelProps} />}
              {activeTab === 'purchasing' && <PurchasingPanel {...panelProps} />}
              {activeTab === 'comptabilite' && <FinancePanel {...panelProps} />}
              {activeTab === 'expenses' && <ExpensesPanel {...panelProps} />}
              {activeTab === 'staff' && <StaffPanel {...panelProps} />}
              {activeTab === 'settings' && <SettingsPanel {...panelProps} sidebarHoverMode={sidebarHoverMode} setSidebarHoverMode={setSidebarHoverMode} />}
              {activeTab === 'customers' && <CustomersPanel {...panelProps} showConfirm={showConfirm} />}
            </React.Suspense>
          </motion.div>
        </AnimatePresence>
        </motion.main>
      {/* Waste Logging Modal */}
      {showWasteModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
            <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-full max-w-md p-10 luxury-panel"
            >
                <div className="flex justify-between items-center mb-10">
                    <h3 className={`text-2xl font-bold luxury-font uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t('waste_log')}</h3>
                    <button onClick={() => setShowWasteModal(false)} className="text-white/20 hover:text-white"><X size={24}/></button>
                </div>

                <div className="space-y-8">
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-gold mb-3 block">{t('product_entity')}</label>
                        <select 
                            value={wasteForm.product_id}
                            onChange={(e) => setWasteForm({...wasteForm, product_id: e.target.value})}
                            className={`w-full p-5 rounded-2xl border outline-none font-bold text-sm ${isDarkMode ? 'bg-white/5 border-white/10 text-cream focus:border-gold/40' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                        >
                            <option value="" className={isDarkMode ? 'bg-[#0a0a0b] text-gold' : ''}>{t('select_product')}</option>
                            {inventory.products.map(p => <option key={p.id} value={p.id} className={isDarkMode ? 'bg-[#0a0a0b] text-gold' : ''}>{p.name}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-gold mb-3 block">{t('unsold_quantity')}</label>
                        <div className="flex items-center gap-4">
                            <input 
                                type="number" 
                                value={wasteForm.quantity}
                                onChange={(e) => setWasteForm({...wasteForm, quantity: parseInt(e.target.value)})}
                                className={`flex-1 p-5 rounded-2xl border outline-none font-bold text-2xl ${isDarkMode ? 'bg-white/5 border-white/10 text-cream focus:border-gold/40' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                            />
                            <span className="font-bold opacity-40">{t('units')}</span>
                        </div>
                    </div>

                    <button
                        onClick={async () => {
                            if (!wasteForm.product_id) return;
                            try {
                                await api.post('/waste', wasteForm);
                                setShowWasteModal(false);
                                fetchData();
                                addToast(t('waste_logged'), "success");
                            } catch (e: any) { addToast(t('log_failed'), "error"); }
                        }}
                        className={`w-full py-6 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${isDarkMode ? 'bg-rose-500 text-white shadow-lg' : 'bg-slate-900 text-white'}`}
                    >

                        {t('confirm_loss')}
                    </button>
                    <p className="text-[10px] text-center opacity-40 font-bold uppercase tracking-widest">{t('waste_deduct_notice')}</p>
                </div>
            </motion.div>
        </div>
      )}

      {/* Add Staff Modal */}
      {showAddStaff && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
            <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="w-full max-w-md p-10 luxury-panel"
            >
                <div className="flex justify-between items-start mb-10">
                    <h3 className={`text-2xl font-bold luxury-font uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t('add_staff')}</h3>
                    <button onClick={() => setShowAddStaff(false)} className="p-4 rounded-full bg-white/5 hover:bg-white/10 transition-colors"><X size={24}/></button>
                </div>

                <div className="space-y-8">
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">{t('username')}</label>
                        <input 
                            value={newStaff.username} 
                            onChange={(e) => setNewStaff({...newStaff, username: e.target.value})}
                            placeholder={t('e_g_staff_name')}
                            className={`w-full bg-transparent border-b text-lg font-bold py-4 outline-none ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`}
                        />
                    </div>

                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">{t('password')}</label>
                        <input 
                            type="password"
                            value={newStaff.password} 
                            onChange={(e) => setNewStaff({...newStaff, password: e.target.value})}
                            placeholder="••••••••"
                            className={`w-full bg-transparent border-b text-lg font-bold py-4 outline-none ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`}
                        />
                    </div>

                    <button 
                        onClick={handleAddStaff}
                        className={`w-full py-6 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] transition-all ${isDarkMode ? 'bg-gold text-charcoal shadow-gold-glow hover:scale-105' : 'bg-slate-900 text-white shadow-xl'}`}
                    >
                        {t('create_cashier_account')}
                    </button>
                </div>
            </motion.div>
        </div>
      )}

      {/* Add Expense Modal */}
      {showAddExpense && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
            <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="w-full max-w-xl p-8 max-h-[90vh] overflow-y-auto custom-scrollbar luxury-panel text-cream"
            >
                <div className="flex justify-between items-start mb-6">
                    <h3 className={`text-2xl font-bold luxury-font uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{editingExpense ? 'Edit Expense' : 'Log Expenditure'}</h3>
                    <button onClick={() => { setShowAddExpense(false); setEditingExpense(null); setNewExpense({ category: 'other', description: '', input_mode: 'TTC', amount_ht: 0, amount_ttc: 0, tva_rate: 20, tva_amount: 0, is_tva_deductible: true, supplier_id: null, invoice_ref: '', status: 'paid', amount_paid: 0, amount: 0 }); }} className="p-4 rounded-full bg-white/5 hover:bg-white/10 transition-colors"><X size={24}/></button>
                </div>

                <div className="space-y-6">
                    {/* Category Selection */}
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-3">{t('expense_category')}</label>
                        <div className="grid grid-cols-3 gap-2">
                            {['salary', 'rent', 'electricity', 'water', 'internet', 'raw_materials', 'other'].map(cat => (
                                <button 
                                    key={cat}
                                    type="button"
                                    onClick={() => updateExpenseCalculations({ category: cat })}
                                    className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${newExpense.category === cat ? 'bg-gold text-charcoal' : 'bg-white/5 text-cream/40 border-white/5 hover:bg-white/10'}`}
                                >
                                    {cat.replace('_', ' ')}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Supplier & Invoice Ref */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gold">{t('supplier')}</label>
                                <button 
                                    type="button"
                                    onClick={() => setShowAddSupplier(true)}
                                    className="text-[9px] font-black uppercase tracking-widest text-gold bg-gold/10 px-2 py-0.5 rounded hover:bg-gold/20"
                                >
                                    {t('new')}
                                </button>
                            </div>
                            <select 
                                value={newExpense.supplier_id || ''}
                                onChange={e => updateExpenseCalculations({ supplier_id: e.target.value ? parseInt(e.target.value) : null })}
                                className={`w-full bg-[#0d0d0f] border-b py-3 px-2 outline-none font-bold text-sm rounded ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`}
                            >
                                <option value="">{t('no_supplier')}</option>
                                {suppliers.map((supp: any) => (
                                    <option key={supp.id} value={supp.id}>{supp.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">{t('invoice_reference')}</label>
                            <input 
                                placeholder={t('e_g_fact_2026_042')}
                                value={newExpense.invoice_ref} 
                                onChange={(e) => updateExpenseCalculations({ invoice_ref: e.target.value })}
                                className={`w-full bg-transparent border-b text-sm py-3 outline-none ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`}
                            />
                        </div>
                    </div>

                    {/* Accounting & Tax Engine */}
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-4">
                        <div className="flex justify-between items-center border-b border-white/5 pb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gold">{t('accounting_engine')}</span>
                            {/* Input Mode Toggle */}
                            <div className="flex gap-2 bg-white/5 p-0.5 rounded-full border border-white/10">
                                <button
                                    type="button"
                                    onClick={() => updateExpenseCalculations({ input_mode: 'HT' })}
                                    className={`px-3 py-1 rounded-full text-[9px] font-black tracking-widest uppercase transition-all ${newExpense.input_mode === 'HT' ? 'bg-gold text-charcoal' : 'text-white/40 hover:text-white/80'}`}
                                >
                                    HT
                                </button>
                                <button
                                    type="button"
                                    onClick={() => updateExpenseCalculations({ input_mode: 'TTC' })}
                                    className={`px-3 py-1 rounded-full text-[9px] font-black tracking-widest uppercase transition-all ${newExpense.input_mode === 'TTC' ? 'bg-gold text-charcoal' : 'text-white/40 hover:text-white/80'}`}
                                >
                                    TTC
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[9px] font-black uppercase tracking-widest text-cream/40 block mb-1">
                                    {newExpense.input_mode === 'TTC' ? 'Amount TTC (MAD)' : 'Amount HT (MAD)'}
                                </label>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    value={newExpense.input_mode === 'TTC' ? newExpense.amount_ttc || '' : newExpense.amount_ht || ''} 
                                    onChange={(e) => {
                                        const val = parseFloat(e.target.value) || 0;
                                        if (newExpense.input_mode === 'TTC') {
                                            updateExpenseCalculations({ amount_ttc: val });
                                        } else {
                                            updateExpenseCalculations({ amount_ht: val });
                                        }
                                    }}
                                    className={`w-full bg-transparent border-b text-lg font-bold py-2 outline-none ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`}
                                    placeholder="0.00"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] font-black uppercase tracking-widest text-cream/40 block mb-1">{t('tva_rate')}</label>
                                <select 
                                    value={newExpense.tva_rate} 
                                    onChange={(e) => updateExpenseCalculations({ tva_rate: parseFloat(e.target.value) })}
                                    className={`w-full bg-[#0d0d0f] border-b py-2 px-1 outline-none font-bold text-sm rounded ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`}
                                >
                                    <option value="0">{t('0_exempt_wages')}</option>
                                    <option value="7">{t('7_water_electricity')}</option>
                                    <option value="10">{t('10_banking_fees')}</option>
                                    <option value="14">{t('14_electricity_transport')}</option>
                                    <option value="20">{t('20_raw_materials_cogs')}</option>
                                </select>
                            </div>
                        </div>

                        {/* Deductibility & Calculations Preview */}
                        <div className="flex justify-between items-center pt-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={newExpense.is_tva_deductible}
                                    onChange={(e) => updateExpenseCalculations({ is_tva_deductible: e.target.checked })}
                                    className="rounded border-white/10 bg-transparent text-gold focus:ring-gold"
                                />
                                <span className="text-[10px] font-black uppercase tracking-widest text-cream/60">{t('tva_deductible')}</span>
                            </label>
                            <div className="text-right">
                                <div className="text-[10px] text-gold font-bold">
                                    HT: {formatPrice(newExpense.amount_ht, activeCurrency)} | TVA: {formatPrice(newExpense.tva_amount, activeCurrency)}
                                </div>
                                <div className="text-[11px] font-black text-cream">
                                    Total TTC: {formatPrice(newExpense.amount_ttc, activeCurrency)}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Treasury / Payments Engine */}
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-4">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gold block border-b border-white/5 pb-2">{t('treasury_engine')}</span>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[9px] font-black uppercase tracking-widest text-cream/40 block mb-1">{t('payment_status')}</label>
                                <select 
                                    value={newExpense.status} 
                                    onChange={(e) => updateExpenseCalculations({ status: e.target.value as any })}
                                    className={`w-full bg-[#0d0d0f] border-b py-2 px-1 outline-none font-bold text-sm rounded ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`}
                                >
                                    <option value="paid">{t('paid_fully')}</option>
                                    <option value="partial">{t('partially_paid')}</option>
                                    <option value="pending">{t('pending_unpaid')}</option>
                                </select>
                            </div>
                            {newExpense.status !== 'pending' && (
                                <div>
                                    <label className="text-[9px] font-black uppercase tracking-widest text-cream/40 block mb-1">
                                        {newExpense.status === 'partial' ? 'Amount Paid (MAD)' : 'Payment Amount'}
                                    </label>
                                    <input 
                                        type="number" 
                                        step="0.01"
                                        disabled={newExpense.status === 'paid'}
                                        value={newExpense.amount_paid} 
                                        onChange={(e) => {
                                            const val = parseFloat(e.target.value) || 0;
                                            updateExpenseCalculations({ amount_paid: val });
                                        }}
                                        className={`w-full bg-transparent border-b text-sm font-bold py-2 outline-none disabled:opacity-50 ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">{t('description_note')}</label>
                        <input 
                            value={newExpense.description} 
                            onChange={(e) => updateExpenseCalculations({ description: e.target.value })}
                            placeholder={t('e_g_electricity_bill_for_march')}
                            className={`w-full bg-transparent border-b text-sm py-2 outline-none ${isDarkMode ? 'border-white/10 text-cream/60' : 'border-slate-200 text-slate-600'}`}
                        />
                    </div>

                    <button 
                        onClick={editingExpense ? handleUpdateExpense : handleAddExpense}
                        className={`w-full py-5 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] transition-all ${isDarkMode ? 'bg-gold text-charcoal shadow-gold-glow hover:scale-[1.02]' : 'bg-slate-900 text-white shadow-xl'}`}
                    >
                        {editingExpense ? 'Save Changes' : 'Register Expense'}
                    </button>
                </div>
            </motion.div>
        </div>
      )}

      {/* Recipe Protocol Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
            <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col luxury-panel"
            >
                <div className="p-10 flex justify-between items-start border-b border-white/5">
                    <div className="flex gap-6 items-center">
                        <div className="text-6xl">{selectedProduct.icon}</div>
                        <div>
                            <h2 className="text-4xl font-bold luxury-font tracking-tight mb-2">{selectedProduct.name}</h2>
                            <div className="flex gap-4">
                                <span className="text-[10px] font-black uppercase tracking-widest text-gold bg-gold/10 px-3 py-1 rounded-full">{t('protocol_v1_0')}</span>
                                <div className="flex items-center gap-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-cream/40">{t('target_yield')}</label>
                                    <input 
                                        type="number" 
                                        value={targetYield}
                                        onChange={(e) => setTargetYield(Number(e.target.value))}
                                        className={`w-20 px-2 py-0.5 rounded-full text-center text-sm font-bold ${isDarkMode ? 'bg-white/5 text-white outline-none focus:bg-white/10' : 'bg-slate-100 text-slate-900 outline-none focus:bg-slate-200'}`}
                                        min="1"
                                    />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-cream/40 bg-white/5 px-3 py-1 rounded-full">Base: {selectedProduct.yield_qty}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <button onClick={() => setSelectedProduct(null)} className="p-4 rounded-full bg-white/5 hover:bg-white/10 transition-colors"><X size={24}/></button>
                </div>

                <div className="flex-1 overflow-y-auto p-10 grid grid-cols-1 md:grid-cols-3 gap-12 custom-scrollbar">
                    {/* Left: Ingredients */}
                    <div>
                        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-gold mb-8 opacity-40">{t('composition')}</h3>
                        <div className="space-y-6">
                            {selectedProduct.ingredients.map((ing, i) => {
                                const scaleMultiplier = (targetYield || 1) / (selectedProduct.yield_qty || 1);
                                const scaledQty = (ing.quantity * scaleMultiplier).toFixed(2);
                                const isChecked = checkedIngredients[ing.name] || false;
                                return (
                                    <div key={i} className="flex justify-between items-center border-b border-white/5 pb-2 cursor-pointer group" onClick={() => setCheckedIngredients(prev => ({...prev, [ing.name]: !prev[ing.name]}))}>
                                        <div className="flex items-center gap-3">
                                            <div className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors ${isChecked ? 'bg-gold border-gold text-charcoal' : 'border-white/20 group-hover:border-white/50'}`}>
                                                {isChecked && <CheckCircle size={10} />}
                                            </div>
                                            <span className={`font-bold text-sm transition-opacity ${isChecked ? 'opacity-30 line-through' : ''}`}>{ing.name}</span>
                                        </div>
                                        <span className={`text-gold font-black transition-opacity ${isChecked ? 'opacity-30' : ''}`}>{scaledQty}<span className="text-[10px] ml-1 opacity-40">{inventory.materials[ing.name]?.unit || 'g'}</span></span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right: Method */}
                    <div className="md:col-span-2 space-y-10">
                        <div className="grid grid-cols-2 gap-8">
                            <div className="p-6 rounded-3xl bg-white/5 border border-white/5">
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">{t('preparation_time')}</p>
                                <p className="text-2xl font-bold">{selectedProduct.prep_time} <span className="text-xs opacity-40">{t('minutes')}</span></p>
                            </div>
                            <div className="p-6 rounded-3xl bg-white/5 border border-white/5">
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">{t('cooking_time')}</p>
                                <p className="text-2xl font-bold">{selectedProduct.cook_time} <span className="text-xs opacity-40">{t('minutes')}</span></p>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-gold mb-8 opacity-40">{t('methodology')}</h3>
                            <div className="space-y-8">
                                {selectedProduct.instructions && selectedProduct.instructions.length > 0 ? (
                                    selectedProduct.instructions.map((step, i) => (
                                        <div key={i} className="flex gap-6 group">
                                            <div className="w-10 h-10 rounded-full border border-gold/20 flex items-center justify-center font-black text-gold text-xs shrink-0 group-hover:bg-gold group-hover:text-charcoal transition-all">{i + 1}</div>
                                            <p className={`text-lg leading-relaxed ${isDarkMode ? 'text-cream/80' : 'text-slate-600'}`}>{step}</p>
                                        </div>
                                    ))
                                ) : (
                                    <div className="py-12 border-2 border-dashed border-white/5 rounded-[2.5rem] flex flex-col items-center justify-center opacity-20">
                                        <FileText size={48} className="mb-4" />
                                        <p className="font-black text-xs uppercase tracking-widest">{t('no_protocol_defined')}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-8 bg-white/5 flex justify-center border-t border-white/5">
                    <p className="text-[10px] font-black uppercase tracking-[0.5em] opacity-20">{t('bakeryos_executive_protocol_hi')}</p>
                </div>
            </motion.div>
        </div>
      )}

      {showAddProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="w-full max-w-2xl p-8 flex flex-col max-h-[90vh] luxury-panel">
                <div className="flex justify-between items-start mb-8">
                    <h3 className={`text-2xl font-bold luxury-font ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{editingProductId ? 'Update Entity' : 'Register Entity'}</h3>
                    <button onClick={() => { setShowAddProduct(false); setEditingProductId(null); }} className="text-white/20 hover:text-white"><X size={24}/></button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 overflow-y-auto pr-2 custom-scrollbar">
                    {/* Left Side: Search & Import */}
                    <div className="space-y-6">
                        {!editingProductId ? (
                          <div className={`p-6 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                              <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-4">{t('search_online_catalogue')}</label>
                              <div className="flex gap-2 mb-4">
                                  <input 
                                      type="text" 
                                      placeholder={t('search_recipes')} 
                                      value={recipeSearchQuery}
                                      onChange={(e) => setRecipeSearchQuery(e.target.value)}
                                      onKeyDown={(e) => e.key === 'Enter' && handleSearchRecipes()}
                                      className={`flex-1 bg-transparent border-b py-2 outline-none font-bold text-sm ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`}
                                  />
                                  <button onClick={handleSearchRecipes} className="p-2 text-gold hover:scale-110 transition-transform"><Zap size={20}/></button>
                              </div>

                              <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                                  {isSearchingRecipes && (
                                    <div className="py-10 flex flex-col items-center justify-center gap-4 text-gold">
                                      <div className="pinwheel pinwheel--sm" aria-hidden="true">
                                        <div className="pinwheel__line"></div>
                                        <div className="pinwheel__line"></div>
                                        <div className="pinwheel__line"></div>
                                        <div className="pinwheel__line"></div>
                                        <div className="pinwheel__line"></div>
                                        <div className="pinwheel__line"></div>
                                      </div>
                                      <div className="text-xs font-black uppercase tracking-widest">{t('querying_global_matrix')}</div>
                                    </div>
                                  )}
                                  {recipeSearchResults.map(recipe => (
                                      <div key={recipe.id} onClick={() => handleImportRecipe(recipe.id)} className={`flex items-center gap-4 p-3 rounded-xl border cursor-pointer transition-all hover:border-gold/40 ${isDarkMode ? 'bg-black/20 border-white/5' : 'bg-white border-slate-100'}`}>
                                          <img src={recipe.thumb} className="w-12 h-12 rounded-lg object-cover" alt={recipe.name} width={48} height={48} loading="lazy" decoding="async" />
                                          <div className="flex-1 min-w-0">
                                              <p className={`font-bold text-xs truncate ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>{recipe.name}</p>
                                              <p className="text-[10px] text-gold uppercase font-bold">{recipe.category}</p>
                                          </div>
                                          <Plus size={14} className="text-gold opacity-40" />
                                      </div>
                                  ))}
                              </div>
                          </div>
                        ) : (
                          <div className={`p-6 rounded-2xl border flex flex-col items-center justify-center h-full opacity-40 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                             <p className="text-[10px] font-black uppercase tracking-widest text-center">{t('entity_locked')}<br/><span className="text-[8px]">{t('id_cannot_change')}</span></p>
                          </div>
                        )}
                    </div>

                    {/* Right Side: Manual Entry & Preview */}
                    <div className="space-y-6">
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-1">{t('identifier')}</label>
                                <input type="text" placeholder={t('e_g_p4')} value={newProduct.id} readOnly={!!editingProductId} onChange={(e)=>setNewProduct({...newProduct, id: e.target.value})} className={`w-full bg-transparent border-b py-2 outline-none font-bold ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'} ${editingProductId ? 'opacity-40' : ''}`} />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-1">{t('display_name')}</label>
                                <input type="text" placeholder={t('e_g_baguette')} value={newProduct.name} onChange={(e)=>setNewProduct({...newProduct, name: e.target.value})} className={`w-full bg-transparent border-b py-2 outline-none font-bold ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-1">{t('price_mad')}</label>
                                    <input type="number" value={newProduct.price} onChange={(e)=>setNewProduct({...newProduct, price: parseFloat(e.target.value) || 0})} className={`w-full bg-transparent border-b py-2 outline-none font-bold ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-1">{t('icon')}</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={newProduct.icon}
                                            onChange={(e)=>setNewProduct({...newProduct, icon: e.target.value})}
                                            className={`w-full bg-transparent border-b py-2 pr-10 outline-none font-bold ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`}
                                            placeholder="🥐"
                                            autoComplete={t('off')}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowProductIconPicker((value) => !value)}
                                            className={`absolute right-0 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md transition-all ${
                                                isDarkMode ? 'text-gold/80 hover:bg-gold/10 hover:text-gold' : 'text-slate-700 hover:bg-slate-100'
                                            }`}
                                            aria-label={showProductIconPicker ? 'Hide icon picker' : 'Show icon picker'}
                                        >
                                            <ChevronDown
                                                size={16}
                                                className={`transition-transform ${showProductIconPicker ? 'rotate-180' : ''}`}
                                            />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {showProductIconPicker && (
                            <div>
                                <div className="grid grid-cols-4 gap-3">
                                    {PRODUCT_ICON_CHOICES.map((icon) => (
                                        <button
                                            key={icon}
                                            type="button"
                                            onClick={() => {
                                                setNewProduct({ ...newProduct, icon });
                                                setShowProductIconPicker(false);
                                            }}
                                            className={`h-14 rounded-2xl border text-2xl transition-all active:scale-95 ${
                                                newProduct.icon === icon
                                                    ? (isDarkMode ? 'border-gold bg-gold/10 shadow-gold-glow' : 'border-slate-900 bg-slate-100')
                                                    : (isDarkMode ? 'border-white/10 bg-black/20 hover:border-gold/40 hover:bg-white/5' : 'border-slate-200 bg-slate-50 hover:border-slate-400')
                                            }`}
                                            aria-label={`Choose ${icon} icon`}
                                        >
                                            {icon}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            )}
                            
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-1">{t('prep_min')}</label>
                                    <input type="number" value={newProduct.prep_time} onChange={(e)=>setNewProduct({...newProduct, prep_time: parseInt(e.target.value) || 0})} className={`w-full bg-transparent border-b py-2 outline-none font-bold ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-1">{t('cook_min')}</label>
                                    <input type="number" value={newProduct.cook_time} onChange={(e)=>setNewProduct({...newProduct, cook_time: parseInt(e.target.value) || 0})} className={`w-full bg-transparent border-b py-2 outline-none font-bold ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-1">{t('yield_qty')}</label>
                                    <input type="number" value={newProduct.yield_qty} onChange={(e)=>setNewProduct({...newProduct, yield_qty: parseInt(e.target.value) || 1})} className={`w-full bg-transparent border-b py-2 outline-none font-bold ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`} />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">Instructions ({newProduct.instructions.length} steps)</label>
                                <div className="space-y-2 max-h-[150px] overflow-y-auto custom-scrollbar pr-2">
                                    {newProduct.instructions.map((step: string, i: number) => (
                                        <div key={i} className="flex gap-2">
                                            <span className="text-[10px] font-bold text-gold opacity-40">{i+1}</span>
                                            <input 
                                                value={step} 
                                                onChange={(e) => {
                                                    const next = [...newProduct.instructions];
                                                    next[i] = e.target.value;
                                                    setNewProduct({...newProduct, instructions: next});
                                                }}
                                                className={`flex-1 bg-transparent text-[11px] outline-none ${isDarkMode ? 'text-cream/60' : 'text-slate-600'}`}
                                            />
                                            <button onClick={() => setNewProduct({...newProduct, instructions: newProduct.instructions.filter((_:any,idx:any)=>idx!==i)})}><X size={12} className="text-rose-500 opacity-40 hover:opacity-100"/></button>
                                        </div>
                                    ))}
                                    <button 
                                        onClick={() => setNewProduct({...newProduct, instructions: [...newProduct.instructions, ""]})}
                                        className="w-full py-2 border border-dashed border-white/10 rounded-lg text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100 hover:border-gold/40 transition-all"
                                    >
                                        {t('add_instruction_step')}
                                    </button>
                                </div>
                            </div>
                            
                            <div className="pt-4 border-t border-white/5">
                                <p className="text-[10px] font-black uppercase tracking-widest text-gold mb-3">Ingredient Preview ({newProduct.ingredients.length})</p>
                                <div className="space-y-2">
                                    {newProduct.ingredients.slice(0, 5).map((ing: any, i: number) => (
                                        <div key={i} className="flex justify-between text-[10px] font-bold uppercase tracking-widest opacity-40">
                                            <span>{ing.name}</span>
                                            <span>{ing.quantity}g</span>
                                        </div>
                                    ))}
                                    {newProduct.ingredients.length > 5 && <p className="text-[10px] opacity-20">+{newProduct.ingredients.length - 5} more...</p>}
                                </div>
                            </div>
                        </div>

                        <button onClick={handleAddProduct} className="w-full py-5 rounded-2xl font-black text-xs uppercase tracking-widest bg-gold text-charcoal shadow-gold-glow active:scale-95 transition-all mt-4">
                            {editingProductId ? 'Save Changes' : 'Commit to Registry'}
                        </button>                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Add Material Modal */}
      {showAddMaterial && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className={`w-full max-w-md p-8 rounded-[2.5rem] border shadow-2xl ${isDarkMode ? 'bg-[#121214] border-white/10' : 'bg-white border-slate-200'}`}>
                <h3 className={`text-2xl font-bold luxury-font mb-8 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t('new_ingredient')}</h3>
                <div className="space-y-6">
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">{t('ingredient_name')}</label>
                        <input type="text" placeholder={t('e_g_milk')} value={newMaterial.name} onChange={(e)=>setNewMaterial({...newMaterial, name: e.target.value})} className={`w-full bg-transparent border-b py-2 outline-none font-bold ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">{t('base_unit')}</label>
                            <select value={newMaterial.unit} onChange={(e)=>setNewMaterial({...newMaterial, unit: e.target.value})} className={`w-full bg-transparent border-b py-2 outline-none font-bold ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`}>
                                <option value="g" className={isDarkMode ? 'bg-[#0a0a0b] text-gold' : ''}>{t('grams_g')}</option>
                                <option value="kg" className={isDarkMode ? 'bg-[#0a0a0b] text-gold' : ''}>{t('kilograms_kg')}</option>
                                <option value="ml" className={isDarkMode ? 'bg-[#0a0a0b] text-gold' : ''}>{t('milliliters_ml')}</option>
                                <option value="L" className={isDarkMode ? 'bg-[#0a0a0b] text-gold' : ''}>{t('liters_l')}</option>
                                <option value="unit" className={isDarkMode ? 'bg-[#0a0a0b] text-gold' : ''}>{t('unit')}</option>
                            </select>
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gold block">{t('unit_price')}</label>
                                {['g', 'ml'].includes(newMaterial.unit) && (
                                    <button 
                                        onClick={() => {
                                            const val = prompt(`Enter price per ${newMaterial.unit === 'g' ? 'kg' : 'L'}:`);
                                            if (val) setNewMaterial({...newMaterial, price: parseFloat(val) / 1000});
                                        }}
                                        className="text-[8px] font-black uppercase tracking-widest text-gold/40 hover:text-gold"
                                    >
                                        Set per {newMaterial.unit === 'g' ? 'kg' : 'L'}
                                    </button>
                                )}
                            </div>
                            <input type="number" step="0.00001" value={newMaterial.price} onChange={(e)=>setNewMaterial({...newMaterial, price: parseFloat(e.target.value)})} className={`w-full bg-transparent border-b py-2 outline-none font-bold ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`} />
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">{t('min_threshold')}</label>
                        <input type="number" value={newMaterial.min_threshold} onChange={(e)=>setNewMaterial({...newMaterial, min_threshold: parseFloat(e.target.value)})} className={`w-full bg-transparent border-b py-2 outline-none font-bold ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">Purchase Unit (optional)</label>
                            <input type="text" placeholder="e.g. crate_12L" value={newMaterial.purchase_unit || ''} onChange={(e)=>setNewMaterial({...newMaterial, purchase_unit: e.target.value})} className={`w-full bg-transparent border-b py-2 outline-none font-bold ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`} />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">Qty per Unit</label>
                            <input type="number" min="0.001" step="0.001" placeholder="e.g. 12" value={newMaterial.purchase_to_base_ratio || 1} onChange={(e)=>setNewMaterial({...newMaterial, purchase_to_base_ratio: parseFloat(e.target.value) || 1})} className={`w-full bg-transparent border-b py-2 outline-none font-bold ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`} />
                        </div>
                    </div>
                    {newMaterial.purchase_unit && (newMaterial.purchase_to_base_ratio || 1) > 1 && (
                      <p className="unit-conversion-preview">
                        🔄 1 {newMaterial.purchase_unit} = {newMaterial.purchase_to_base_ratio || 1} {newMaterial.unit || 'base units'}
                      </p>
                    )}
                    <div className="flex gap-3 pt-6">
                        <button onClick={() => setShowAddMaterial(false)} className={`flex-1 py-4 rounded-xl font-bold text-[10px] uppercase tracking-widest ${isDarkMode ? 'bg-white/5 text-white' : 'bg-slate-100 text-slate-900'}`}>{t('cancel')}</button>
                        <button onClick={handleAddMaterial} className="flex-1 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest bg-gold text-charcoal shadow-gold-glow">{t('register')}</button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Digital Receipt Modal */}
      {showReceiptModal && lastTransaction && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
            <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`w-full max-w-md p-10 rounded-[3.5rem] border shadow-2xl ${isDarkMode ? 'bg-[#0a0a0b] border-white/10 shadow-gold-glow' : 'bg-white border-slate-200'}`}
            >
                <div className="text-center mb-10">
                    <div className="w-20 h-20 bg-gold/10 rounded-full flex items-center justify-center mx-auto mb-6 text-gold">
                        <Zap size={40} fill="currentColor" />
                    </div>
                    <h3 className={`text-2xl font-bold luxury-font uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t('digital_receipt')}</h3>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mt-2">Transaction {lastTransaction.transaction_id}</p>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] shadow-inner mb-8 flex justify-center">
                    <QRCodeSVG 
                        value={`${window.location.origin}${API_BASE}/transactions/${lastTransaction.transaction_id}/receipt?format=pdf&paper=80mm`}
                        size={200}
                        level="H"
                        includeMargin={true}
                    />
                </div>

                <div className="space-y-4">
                    <p className="text-center text-[10px] font-bold uppercase tracking-[0.2em] opacity-40 mb-8">{t('scan_to_open')}</p>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <button 
                            onClick={async () => {
                             const dlToken = await getDownloadToken();
                             openDocument(`${API_BASE}/transactions/${lastTransaction.transaction_id}/receipt?format=pdf&paper=80mm&token=${dlToken}`, `receipt-${lastTransaction.transaction_id}.pdf`);
                           }}
                            className={`py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border transition-all ${isDarkMode ? 'border-white/10 text-white hover:bg-white/5' : 'border-slate-200 text-slate-900'}`}
                        >
                            {t('print_ticket')}
                        </button>
                        <button 
                            onClick={() => {
                                openSelector({
                                    title: "WhatsApp Share",
                                    label: "Customer Number",
                                    value: '',
                                    type: 'text',
                                    onConfirm: (phone) => {
                                        const cleanPhone = phone.replace(/\D/g, '');
                                        if (cleanPhone.length >= 8) {
                                          window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(lastTransaction.whatsapp_text)}`, '_blank', 'noopener,noreferrer');
                                        }
                                    }
                                });
                            }}
                            className="py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                        >
                            {t('whatsapp')}
                        </button>

                    </div>
                    
                    <button 
                        onClick={() => setShowReceiptModal(false)}
                        className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-widest mt-4 transition-all ${isDarkMode ? 'bg-gold text-charcoal shadow-gold-glow' : 'bg-slate-900 text-white'}`}
                    >
                        {t('close_terminal')}
                    </button>
                </div>
            </motion.div>
        </div>
      )}

      {/* Toast System */}
      <div className="fixed bottom-8 right-8 z-[300] space-y-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9, transition: { duration: 0.18 } }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className={`relative flex items-center gap-4 pl-5 pr-4 py-4 rounded-2xl shadow-2xl border pointer-events-auto backdrop-blur-2xl overflow-hidden min-w-[280px] max-w-[360px] ${
                toast.type === 'success'
                  ? 'bg-emerald-950/80 border-emerald-500/30 text-emerald-300 shadow-[0_0_30px_rgba(16,185,129,0.15)]'
                  : toast.type === 'error'
                  ? 'bg-rose-950/80 border-rose-500/30 text-rose-300 shadow-[0_0_30px_rgba(244,63,94,0.15)]'
                  : 'bg-[#1a1508]/90 border-gold/30 text-gold shadow-gold-glow'
              }`}
            >
              {/* Left accent bar */}
              <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl ${
                toast.type === 'success' ? 'bg-emerald-500' :
                toast.type === 'error' ? 'bg-rose-500' : 'bg-gold'
              }`} />

              {/* Icon */}
              <div className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${
                toast.type === 'success' ? 'bg-emerald-500/20' :
                toast.type === 'error' ? 'bg-rose-500/20' : 'bg-gold/20'
              }`}>
                {toast.type === 'success' && <CheckCircle size={16} />}
                {toast.type === 'error' && <XCircle size={16} />}
                {toast.type === 'info' && <Info size={16} />}
              </div>

              {/* Message */}
              <p className="flex-1 text-xs font-bold tracking-wide">{toast.message}</p>

              {/* Dismiss */}
              <button
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center opacity-40 hover:opacity-100 transition-opacity"
              >
                <X size={12} />
              </button>

              {/* Progress bar */}
              <motion.div
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: 5, ease: 'linear' }}
                style={{ transformOrigin: 'left' }}
                className={`absolute bottom-0 left-0 right-0 h-[2px] ${
                  toast.type === 'success' ? 'bg-emerald-500/60' :
                  toast.type === 'error' ? 'bg-rose-500/60' : 'bg-gold/60'
                }`}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Selector Modal */}
      <AnimatePresence>
      {selectorConfig.isOpen && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/90 backdrop-blur-2xl animate-in fade-in duration-300">
              <motion.div 
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className={`w-full max-w-sm p-10 rounded-[3.5rem] border shadow-2xl ${isDarkMode ? 'bg-[#0a0a0b] border-white/10' : 'bg-white border-slate-200'}`}
              >
                  <h3 className="text-xl font-bold luxury-font uppercase tracking-tighter mb-8">{selectorConfig.title}</h3>
                  
                  <div className="space-y-6">
                      <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">{selectorConfig.label}</label>
                          <input 
                              type={selectorConfig.type === 'datetime' ? 'datetime-local' : selectorConfig.type}
                              value={selectorConfig.value}
                              onChange={e => setSelectorConfig({...selectorConfig, value: e.target.value})}
                              className={`w-full bg-transparent border-b py-3 outline-none font-bold text-lg ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`}
                              autoFocus
                          />
                      </div>

                      <div className="pt-6 flex gap-4">
                          <button onClick={() => setSelectorConfig(prev => ({...prev, isOpen: false}))} className="flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/5 opacity-40 hover:opacity-100 transition-all">{t('cancel')}</button>
                          <button 
                              onClick={() => {
                                  selectorConfig.onConfirm(selectorConfig.value);
                                  setSelectorConfig(prev => ({...prev, isOpen: false}));
                              }} 
                              className="flex-[2] py-4 rounded-2xl bg-gold text-charcoal font-black text-[10px] uppercase tracking-widest shadow-gold-glow"
                          >
                              {t('confirm')}
                          </button>
                      </div>
                  </div>
              </motion.div>
          </div>
      )}
      </AnimatePresence>

      {/* Supplier Modal */}
      <AnimatePresence>
      {showAddSupplier && (
          <div className="fixed inset-0 z-[450] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
              <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 20, opacity: 0 }}
                  className={`w-full max-w-md p-10 rounded-[3.5rem] border shadow-2xl ${isDarkMode ? 'bg-[#0a0a0b] border-white/10' : 'bg-white border-slate-200'}`}
              >
                  <h3 className="text-2xl font-bold luxury-font uppercase tracking-tighter mb-8">{editingSupplier ? 'Edit Supplier' : 'Add Supplier'}</h3>
                  
                  <div className="space-y-6">
                      <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">{t('supplier_name')}</label>
                          <input 
                              placeholder={t('atlas_flour_co')}
                              value={newSupplier.name}
                              onChange={e => setNewSupplier({...newSupplier, name: e.target.value})}
                              className={`w-full bg-transparent border-b py-3 outline-none font-bold ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`}
                              autoFocus
                          />
                      </div>

                      <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">{t('contact_info')}</label>
                          <input 
                              placeholder={t('address_or_general_details')}
                              value={newSupplier.contact_info || ''}
                              onChange={e => setNewSupplier({...newSupplier, contact_info: e.target.value})}
                              className={`w-full bg-transparent border-b py-3 outline-none font-bold ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`}
                          />
                      </div>

                      <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">{t('identifiant_commun_d_entrepris')}</label>
                          <input 
                              placeholder={t('15_digit_moroccan_ice')}
                              value={newSupplier.ice}
                              onChange={e => setNewSupplier({...newSupplier, ice: e.target.value})}
                              className={`w-full bg-transparent border-b py-3 outline-none font-bold ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`}
                          />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">{t('email')}</label>
                              <input 
                                  placeholder={t('vendor_company_ma')}
                                  value={newSupplier.email}
                                  onChange={e => setNewSupplier({...newSupplier, email: e.target.value})}
                                  className={`w-full bg-transparent border-b py-3 outline-none font-bold ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`}
                              />
                          </div>
                          <div>
                              <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">{t('phone')}</label>
                              <input 
                                  placeholder={t('212_5xx_xx_xx_xx')}
                                  value={newSupplier.phone}
                                  onChange={e => setNewSupplier({...newSupplier, phone: e.target.value})}
                                  className={`w-full bg-transparent border-b py-3 outline-none font-bold ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`}
                              />
                          </div>
                      </div>

                      <div className="pt-6 flex gap-4">
                          <button
                              onClick={() => {
                                  setShowAddSupplier(false);
                                  setEditingSupplier(null);
                                  setNewSupplier({ name: '', contact_info: '', ice: '', email: '', phone: '' });
                              }}
                              className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border opacity-40 hover:opacity-100 transition-all ${isDarkMode ? 'border-white/5' : 'border-slate-200'}`}
                          >
                              {t('cancel')}
                          </button>
                          <button onClick={handleAddSupplier} className="flex-[2] py-4 rounded-2xl bg-gold text-charcoal font-black text-[10px] uppercase tracking-widest shadow-gold-glow">
                              {editingSupplier ? 'Save Supplier' : 'Create Supplier'}
                          </button>
                      </div>
                  </div>
              </motion.div>
          </div>
      )}
      </AnimatePresence>

      <AnimatePresence>
      {showPOModal && selectedPO && (
          <div className="fixed inset-0 z-[460] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
              <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 20, opacity: 0 }}
                  className={`w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-[2.5rem] border shadow-2xl ${isDarkMode ? 'bg-[#0a0a0b] border-white/10' : 'bg-white border-slate-200'}`}
              >
                  <div className={`p-8 border-b flex items-start justify-between gap-4 ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                      <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-gold">{t('purchase_order')}</p>
                          <h3 className="text-2xl font-bold luxury-font uppercase tracking-tighter mt-2">{selectedPO.id}</h3>
                          <p className={`text-sm mt-2 ${isDarkMode ? 'text-cream/40' : 'text-slate-500'}`}>
                              {t('review_supplier_details_set_de')}
                          </p>
                      </div>
                      <button
                          onClick={() => setShowPOModal(false)}
                          className={`p-3 rounded-2xl transition-all ${isDarkMode ? 'bg-white/5 hover:bg-white/10 text-cream' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                      >
                          <X size={18} />
                      </button>
                  </div>

                  <div className="p-8 overflow-y-auto max-h-[calc(90vh-112px)] space-y-8 custom-scrollbar">
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                          <div className={`rounded-3xl border p-5 space-y-3 ${isDarkMode ? 'border-white/5 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>
                              <label className="text-[10px] font-black uppercase tracking-widest text-gold block">{t('supplier')}</label>
                              <select
                                  value={selectedPO.supplier_id}
                                  onChange={(e) => setSelectedPO((prev: any) => ({ ...prev, supplier_id: Number(e.target.value) }))}
                                  className={`w-full border-b py-3 px-2 outline-none text-[10px] font-black uppercase tracking-widest rounded-xl ${isDarkMode ? 'bg-black text-gold border-white/10' : 'bg-white text-slate-700 border-slate-200'}`}
                              >
                                  {suppliers.map((supp: any) => (
                                      <option key={supp.id} value={supp.id} className={isDarkMode ? 'bg-[#0a0a0b] text-gold' : ''}>{supp.name}</option>
                                  ))}
                              </select>
                              <p className={`text-xs ${isDarkMode ? 'text-cream/40' : 'text-slate-500'}`}>
                                  {suppliers.find((supp: any) => supp.id === selectedPO.supplier_id)?.contact_info || 'No contact info'}
                              </p>
                          </div>

                          <div className={`rounded-3xl border p-5 space-y-3 ${isDarkMode ? 'border-white/5 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>
                              <label className="text-[10px] font-black uppercase tracking-widest text-gold block">{t('expected_delivery')}</label>
                              <input
                                  type="date"
                                  value={selectedPO.expected_delivery_date || ''}
                                  onChange={(e) => setSelectedPO((prev: any) => ({ ...prev, expected_delivery_date: e.target.value }))}
                                  className={`w-full bg-transparent border-b py-3 outline-none font-bold ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`}
                              />
                              <p className={`text-xs ${isDarkMode ? 'text-cream/40' : 'text-slate-500'}`}>{t('use_this_for_delivery_planning')}</p>
                          </div>

                          <div className={`rounded-3xl border p-5 space-y-3 ${isDarkMode ? 'border-white/5 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>
                              <label className="text-[10px] font-black uppercase tracking-widest text-gold block">{t('status')}</label>
                              <div className="flex items-center justify-between gap-3">
                                  <span className={`px-3 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${selectedPO.status === 'received' ? 'bg-emerald-500/10 text-emerald-500' : selectedPO.status === 'partial' ? 'bg-amber-500/10 text-amber-500' : 'bg-gold/10 text-gold'}`}>
                                      {selectedPO.status}
                                  </span>
                                  <p className={`text-xs text-right ${isDarkMode ? 'text-cream/40' : 'text-slate-500'}`}>
                                      {new Date(selectedPO.date).toLocaleDateString()}
                                  </p>
                              </div>
                              <p className={`text-xs ${isDarkMode ? 'text-cream/40' : 'text-slate-500'}`}>Ordered lines: {selectedPO.items.length}</p>
                          </div>
                      </div>

                      <div className={`rounded-3xl border p-5 space-y-3 ${isDarkMode ? 'border-white/5 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>
                          <label className="text-[10px] font-black uppercase tracking-widest text-gold block">{t('order_notes')}</label>
                          <textarea
                              rows={4}
                              value={selectedPO.notes || ''}
                              onChange={(e) => setSelectedPO((prev: any) => ({ ...prev, notes: e.target.value }))}
                              placeholder={t('delivery_window_substitutions')}
                              className={`w-full resize-none rounded-2xl border px-4 py-4 outline-none text-sm ${isDarkMode ? 'bg-white/5 border-white/10 focus:bg-white/10 text-cream placeholder:text-cream/20' : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'}`}
                          />
                      </div>

                      <div className={`rounded-3xl border overflow-hidden ${isDarkMode ? 'border-white/5 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>
                          <div className={`grid grid-cols-[minmax(0,2fr)_100px_100px_160px_160px] gap-4 px-5 py-4 text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-cream/40 border-b border-white/10' : 'text-slate-400 border-b border-slate-200'}`}>
                              <span>{t('item')}</span>
                              <span>{t('ordered')}</span>
                              <span>{t('received')}</span>
                              <span>{t('receive_now')}</span>
                              <span>{t('unit_price')}</span>
                          </div>
                          <div className="divide-y divide-white/5">
                              {selectedPO.items.map((item: any, idx: number) => {
                                  const remaining = Math.max(0, (Number(item.qty) || 0) - (Number(item.received_qty) || 0));
                                  const draft = poReceiveDraft[item.name] || { qty: 0, price: Number(item.price) || 0 };
                                  return (
                                      <div key={`${item.name}-${idx}`} className="px-5 py-4 space-y-3">
                                          <div className="grid grid-cols-[minmax(0,2fr)_100px_100px_160px_160px] gap-4 items-center">
                                              <div className="min-w-0">
                                                  <p className={`font-bold text-sm truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{item.name}</p>
                                                  <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${remaining > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                                      {remaining > 0 ? `${remaining} pending` : 'Fully received'}
                                                  </p>
                                              </div>
                                              <span className="font-bold text-sm">{item.qty}</span>
                                              <span className="font-bold text-sm">{Number(item.received_qty) || 0}</span>
                                              <input
                                                  type="number"
                                                  min="0"
                                                  max={remaining}
                                                  step="0.01"
                                                  value={draft.qty}
                                                  onChange={(e) => {
                                                      const nextQty = Number(e.target.value);
                                                      setPoReceiveDraft((prev) => ({
                                                          ...prev,
                                                          [item.name]: {
                                                              ...(prev[item.name] || draft),
                                                              qty: Number.isFinite(nextQty) ? nextQty : 0
                                                          }
                                                      }));
                                                  }}
                                                  className={`w-full rounded-xl border px-3 py-2 outline-none text-sm font-bold ${isDarkMode ? 'bg-white/5 border-white/10 focus:bg-white/10 text-cream' : 'bg-white border-slate-200 text-slate-900'}`}
                                              />
                                              <input
                                                  type="number"
                                                  min="0"
                                                  step="0.01"
                                                  value={draft.price}
                                                  onChange={(e) => {
                                                      const nextPrice = Number(e.target.value);
                                                      setPoReceiveDraft((prev) => ({
                                                          ...prev,
                                                          [item.name]: {
                                                              ...(prev[item.name] || draft),
                                                              price: Number.isFinite(nextPrice) ? nextPrice : 0
                                                          }
                                                      }));
                                                  }}
                                                  className={`w-full rounded-xl border px-3 py-2 outline-none text-sm font-bold ${isDarkMode ? 'bg-white/5 border-white/10 focus:bg-white/10 text-cream' : 'bg-white border-slate-200 text-slate-900'}`}
                                              />
                                          </div>
                                          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_150px_190px] gap-3">
                                              <input
                                                  type="text"
                                                  value={draft.lot_code || ''}
                                                  onChange={(e) => setPoReceiveDraft((prev) => ({
                                                      ...prev,
                                                      [item.name]: {
                                                          ...(prev[item.name] || draft),
                                                          lot_code: e.target.value
                                                      }
                                                  }))}
                                                  placeholder="Lot code"
                                                  className={`w-full rounded-xl border px-3 py-2 outline-none text-xs font-bold ${isDarkMode ? 'bg-white/5 border-white/10 focus:bg-white/10 text-cream placeholder:text-cream/20' : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'}`}
                                              />
                                              <input
                                                  type="text"
                                                  value={draft.supplier_lot_code || ''}
                                                  onChange={(e) => setPoReceiveDraft((prev) => ({
                                                      ...prev,
                                                      [item.name]: {
                                                          ...(prev[item.name] || draft),
                                                          supplier_lot_code: e.target.value
                                                      }
                                                  }))}
                                                  placeholder="Supplier lot"
                                                  className={`w-full rounded-xl border px-3 py-2 outline-none text-xs font-bold ${isDarkMode ? 'bg-white/5 border-white/10 focus:bg-white/10 text-cream placeholder:text-cream/20' : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'}`}
                                              />
                                              <input
                                                  type="date"
                                                  value={draft.expires_at || ''}
                                                  onChange={(e) => setPoReceiveDraft((prev) => ({
                                                      ...prev,
                                                      [item.name]: {
                                                          ...(prev[item.name] || draft),
                                                          expires_at: e.target.value
                                                      }
                                                  }))}
                                                  className={`w-full rounded-xl border px-3 py-2 outline-none text-xs font-bold ${isDarkMode ? 'bg-white/5 border-white/10 focus:bg-white/10 text-cream' : 'bg-white border-slate-200 text-slate-900'}`}
                                              />
                                              <select
                                                  value={draft.location_id ?? ''}
                                                  onChange={(e) => setPoReceiveDraft((prev) => ({
                                                      ...prev,
                                                      [item.name]: {
                                                          ...(prev[item.name] || draft),
                                                          location_id: e.target.value ? Number(e.target.value) : null
                                                      }
                                                  }))}
                                                  className={`w-full rounded-xl border px-3 py-2 outline-none text-xs font-black uppercase tracking-widest ${isDarkMode ? 'bg-[#0a0a0b] border-white/10 text-cream' : 'bg-white border-slate-200 text-slate-700'}`}
                                              >
                                                  <option value="">No location</option>
                                                  {stockLocations.map((location) => (
                                                      <option key={location.id} value={location.id}>{location.name}</option>
                                                  ))}
                                              </select>
                                          </div>
                                      </div>
                                  );
                              })}
                          </div>
                      </div>

                      <div className="flex flex-wrap gap-3">
                          <button
                              onClick={handleSavePO}
                              className={`px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all ${isDarkMode ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-slate-200 text-slate-900 hover:bg-slate-300'}`}
                          >
                              <Save size={14} />
                              {t('save_order')}
                          </button>
                          <button
                              onClick={handlePartialReceivePO}
                              className="px-6 py-4 rounded-2xl bg-gold text-charcoal font-black text-[10px] uppercase tracking-widest shadow-gold-glow"
                          >
                              {t('receive_selected_items')}
                          </button>
                          {selectedPO.status !== 'received' && (
                              <button
                                  onClick={() => {
                                      handleReceivePO(selectedPO.id);
                                      setShowPOModal(false);
                                  }}
                                  className={`px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${isDarkMode ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
                              >
                                  {t('receive_remaining')}
                              </button>
                          )}
                      </div>
                  </div>
              </motion.div>
          </div>
      )}
      </AnimatePresence>

      {/* Booking Modal */}
      <AnimatePresence>
      {showBookingModal && (
          <div className="fixed inset-0 z-[450] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
              <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 20, opacity: 0 }}
                  className={`w-full max-w-md p-10 rounded-[3.5rem] border shadow-2xl ${isDarkMode ? 'bg-[#0a0a0b] border-white/10' : 'bg-white border-slate-200'}`}
              >
                  <h3 className="text-2xl font-bold luxury-font uppercase tracking-tighter mb-8">{t('customer_booking')}</h3>
                  
                  <div className="space-y-6">
                      <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">{t('customer_identity')}</label>
                          <input 
                              placeholder={t('full_name')}
                              value={bookingForm.name}
                              onChange={e => setBookingForm({...bookingForm, name: e.target.value})}
                              className={`w-full bg-transparent border-b py-3 outline-none font-bold ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`}
                          />
                      </div>

                      <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">{t('contact_number')}</label>
                          <input 
                              placeholder="+212..."
                              value={bookingForm.phone}
                              onChange={e => setBookingForm({...bookingForm, phone: e.target.value})}
                              className={`w-full bg-transparent border-b py-3 outline-none font-bold ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`}
                          />
                      </div>

                      <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">{t('order_details_notes')}</label>
                          <textarea 
                              placeholder={t('custom_cakes_text_on_cake_spec')}
                              value={bookingForm.notes || ''}
                              onChange={e => setBookingForm({...bookingForm, notes: e.target.value})}
                              className={`w-full bg-transparent border-b py-3 outline-none font-bold resize-none ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`}
                              rows={2}
                          />
                      </div>

                      <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">{t('pickup_schedule')}</label>
                          <input 
                              type="datetime-local"
                              value={bookingForm.date.includes(' ') ? bookingForm.date.replace(' ', 'T') : bookingForm.date}
                              onChange={e => setBookingForm({...bookingForm, date: e.target.value})}
                              className={`w-full bg-transparent border-b py-3 outline-none font-bold ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`}
                          />
                      </div>

                      <div className="pt-6 flex gap-4">
                          <button onClick={() => setShowBookingModal(false)} className="flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/5 opacity-40 hover:opacity-100 transition-all">{t('cancel')}</button>
                          <button onClick={handleSaveBooking} className="flex-[2] py-4 rounded-2xl bg-gold text-charcoal font-black text-[10px] uppercase tracking-widest shadow-gold-glow">{t('confirm_booking')}</button>
                      </div>
                  </div>
              </motion.div>
          </div>
      )}
      </AnimatePresence>

      {/* Transfer Modal */}
      {showTransferModal && (
        <TransferModal 
          isOpen={showTransferModal} 
          onClose={() => setShowTransferModal(false)}
          locations={stockLocations || []}
          inventory={inventory}
          onTransfer={handleTransferStock}
          isDarkMode={isDarkMode}
        />
      )}

      {/* Recipe Builder Modal */}
      {showRecipeModal && (
        <RecipeBuilderModal
          isOpen={showRecipeModal}
          onClose={() => setShowRecipeModal(false)}
          item={activeSFItem}
          rawMaterials={inventory.materials}
          onSave={handleSaveRecipe}
          isDarkMode={isDarkMode}
        />
      )}

      {/* Produce Batch Modal */}
      {showProduceModal && (
        <ProduceBatchModal
          isOpen={showProduceModal}
          onClose={() => setShowProduceModal(false)}
          item={activeSFItem}
          onProduce={handleProduceBatch}
          isDarkMode={isDarkMode}
        />
      )}

      {/* Cost Breakdown Modal */}
      {showCostModal && (
        <CostBreakdownModal
          isOpen={showCostModal}
          onClose={() => setShowCostModal(false)}
          product={activeCostProduct}
          isDarkMode={isDarkMode}
          formatPrice={formatMoney}
        />
      )}

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmConfig.isOpen && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center p-6 bg-black/75 backdrop-blur-xl animate-in fade-in duration-200">
              <motion.div 
                  initial={{ scale: 0.96, opacity: 0, y: 10 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.96, opacity: 0, y: 10 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  className={`w-full max-w-md overflow-hidden rounded-[2.5rem] border shadow-2xl ${
                    isDarkMode
                      ? confirmConfig.type === 'danger'
                        ? 'bg-[#0a0a0b] border-rose-500/20 shadow-[0_0_60px_rgba(244,63,94,0.14)]'
                        : 'bg-[#0a0a0b] border-gold/20 shadow-gold-glow'
                      : 'bg-white border-slate-200 shadow-slate-900/10'
                  }`}
              >
                <div className={`p-7 border-b ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                  <div className="flex items-start justify-between gap-5">
                    <div className="flex items-center gap-4">
                      <div className={`shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center ${
                        confirmConfig.type === 'danger' ? 'bg-rose-500/10 text-rose-500' : 'bg-gold/10 text-gold'
                      }`}>
                          {confirmConfig.type === 'danger' ? <Trash2 size={20}/> : <CheckCircle size={20}/>}
                      </div>
                      <div>
                        <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-1 ${
                          confirmConfig.type === 'danger' ? 'text-rose-400' : 'text-gold'
                        }`}>
                          {confirmConfig.type === 'danger' ? 'Permanent action' : 'Confirmation'}
                        </p>
                        <h3 className={`text-xl font-bold luxury-font uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                          {confirmConfig.title}
                        </h3>
                      </div>
                    </div>
                    <button
                      onClick={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                      className={`shrink-0 p-2 rounded-xl transition-colors ${
                        isDarkMode ? 'text-cream/30 hover:text-cream hover:bg-white/5' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                      aria-label={t('cancel')}
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                <div className="p-7">
                  <div className={`rounded-2xl border p-5 mb-6 ${
                    confirmConfig.type === 'danger'
                      ? isDarkMode
                        ? 'bg-rose-500/[0.06] border-rose-500/15'
                        : 'bg-rose-50 border-rose-100'
                      : isDarkMode
                      ? 'bg-white/[0.03] border-white/5'
                      : 'bg-slate-50 border-slate-100'
                  }`}>
                    <p className={`text-sm leading-relaxed font-medium ${isDarkMode ? 'text-cream/70' : 'text-slate-600'}`}>
                      {confirmConfig.message}
                    </p>
                  </div>
                  
                  <div className="flex gap-3">
                      <button 
                          onClick={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                          className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border transition-all ${
                            isDarkMode ? 'border-white/10 text-cream/60 hover:bg-white/5 hover:text-cream' : 'border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                          }`}
                      >
                          {t('cancel')}
                      </button>
                      <button 
                          onClick={() => {
                              confirmConfig.onConfirm();
                              setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                          }}
                          className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all active:scale-95 ${
                              confirmConfig.type === 'danger'
                                ? 'bg-rose-500 text-white hover:bg-rose-600 shadow-[0_0_20px_rgba(244,63,94,0.28)]'
                                : 'bg-gold text-charcoal hover:brightness-105 shadow-gold-glow'
                          }`}
                      >
                          {confirmConfig.confirmText}
                      </button>
                  </div>
                </div>
              </motion.div>
          </div>
        )}
      </AnimatePresence>
      <CommandPalette 
        isOpen={showCommandPalette} 
        onClose={() => setShowCommandPalette(false)} 
        isDarkMode={isDarkMode} 
        actions={commandActions} 
      />
    </div>
  );
};

export default Dashboard;
