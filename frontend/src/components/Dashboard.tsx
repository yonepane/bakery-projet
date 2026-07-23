import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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

import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { api, processSyncQueue } from '../lib/api';
import { calcAlerts, calcProfitReport } from '../lib/calculations';
import http from '../lib/http';
import { type Language } from '../i18n';
import { useTranslation } from 'react-i18next';
import { GoogleLogin } from '@react-oauth/google';
import { GOOGLE_CLIENT_ID, PRODUCT_ICON_CHOICES } from './dashboard/constants';
import { CommandPalette } from './CommandPalette';
// Types
import {
  CartItem,
  DashboardAlert,
  Ingredient,
  PlanItem,
  Product,
  SimulationResult,
  Transaction,
  UserSession,
  Customer,
} from './dashboard/types';
import { DashboardModals } from './dashboard/layout/DashboardModals';
// Context
import { DashboardProviders, useDashboard } from './dashboard/DashboardContext';
// Utils
import {
  createToastId,
  deriveAccountingMetrics,
  displayUnit,
  formatPrice as formatMoney,
  getInitialLanguage,
} from './dashboard/utils';
import { DashboardSidebar } from './dashboard/layout/DashboardSidebar';
import { DashboardHeader } from './dashboard/layout/DashboardHeader';
import { DashboardRouter } from './dashboard/layout/DashboardRouter';
import { AuthPage } from './auth/AuthPage';

// =============================================================================
// DashboardInner — All dashboard logic that requires context providers
// =============================================================================
const DashboardInner: React.FC = () => {
  const { t, i18n } = useTranslation();

  // Use the new context architecture
  const dashboard = useDashboard();
  const {
    // Auth
    user, setUser,
    // UI
    isDarkMode, setIsDarkMode, activeCurrency, setActiveCurrency, editMode, setEditMode, lang, setLang,
    activeTab, setActiveTab,
    // Data
    inventory, analytics, profitReport, alerts, history, stockMovements,
    stockLocations, stockLotBalances, semiFinishedItems, kitchenBatches, planner, setPlanner,
    orders, settings, liveRates, customers, expenses, wasteRecords,
    staff, suppliers, selectedSupplierId, setSelectedSupplierId,
    purchaseOrders, purchasingSuggestions, shiftLogs, loading, setLoading,
    fetchData, fetchTabData, applyInventory, applySettings,
    // Notifications
    addToast, showConfirm, showAlertsPopover, setShowAlertsPopover, notificationRef,
    // Cart
    cart, setCart, addToCart, finalizeSale, lastTransaction, setLastTransaction,
    API_BASE, api, getDownloadToken, openDocument, handleResetSession, displayUnit, openPOModal,
    bookingForm, setBookingForm, setShowBookingModal,
    // Modals
    showAddProduct, setShowAddProduct, editingProductId, setEditingProductId,
    showProductIconPicker, setShowProductIconPicker, showAddMaterial, setShowAddMaterial,
    editingMaterialName, setEditingMaterialName, showWasteModal, setShowWasteModal,
    showReceiptModal, setShowReceiptModal, showAddExpense, setShowAddExpense,
    editingExpense, setEditingExpense, showAddSupplier, setShowAddSupplier,
    editingSupplier, setEditingSupplier, showPOModal, setShowPOModal, showTransferModal, setShowTransferModal,
    showRecipeModal, setShowRecipeModal, showProduceModal, setShowProduceModal,
    activeSFItem, setActiveSFItem, showCostModal, setShowCostModal,
    activeCostProduct, setActiveCostProduct, selectedPO, setSelectedPO,
    poReceiveDraft, setPoReceiveDraft,
    newExpense, setNewExpense, newSupplier, setNewSupplier,
    generalNote, setGeneralNote, isSavingGeneralNote, handleSaveGeneralNote, handleDeleteShiftLog,
    // Product selection
    selectedProduct, setSelectedProduct,
    // Mutation handlers
    handleAdjustStock, handleAddMaterial, handleDeleteMaterial, handleTransferStock,
    handleAddProduct, handleDeleteProduct, handleDuplicateProduct, handleUpdateProductPrice,
    handleUpdateProductField, handleUpdateProductIngredients, handleCleanupProducts,
    handleAddExpense, handleUpdateExpense, handleDeleteExpense,
    handleAddSupplier, handleDeleteSupplier, handleCreatePO, handleReceivePO, handleDeletePO,
    handleAddStaff, handleDeleteStaff,
    handleSaveRecipe, handleProduceBatch, handleCreateSemiFinished, handleAdvanceStage, isKitchenUpdating,
    // Simulator
    isForecasting, handleSmartForecast,
    // Command palette
    showCommandPalette, setShowCommandPalette,
  } = useDashboard();

  // Sorted materials for simulator (computed from inventory)
  const sortedMaterialEntries = useMemo(() => 
    Object.entries(inventory.materials).sort(([, a], [, b]) => (a as Ingredient).name.localeCompare((b as Ingredient).name))
  , [inventory.materials]);
  const sortedMaterialNames = useMemo(() => 
    sortedMaterialEntries.map(([, item]) => (item as Ingredient).name)
  , [sortedMaterialEntries]);

  // Local Dashboard-only state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [sidebarHoverMode, setSidebarHoverMode] = useState(() => localStorage.getItem('bakery_sidebar_hover') === 'true');
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [isOperationsOpen, setIsOperationsOpen] = useState(false);
  const [recipeSearchQuery, setRecipeSearchQuery] = useState('');
  const [recipeSearchResults, setRecipeSearchResults] = useState<Record<string, unknown>[]>([]);
  const [isSearchingRecipes, setIsSearchingRecipes] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Local UI state for modals/forms (not in contexts)
  const [newProduct, setNewProduct] = useState<Partial<Product>>({ 
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
  const [newMaterial, setNewMaterial] = useState<Partial<Ingredient>>({ name: '', price: 0, unit: 'g', min_threshold: 1000 });
  const [targetYield, setTargetYield] = useState<number>(0);
  const [checkedIngredients, setCheckedIngredients] = useState<Record<string, boolean>>({});

  // Simulator state
  const [simPrices, setSimPrices] = useState<Record<string, number>>({});
  const [simulatedInflations, setSimulatedInflations] = useState<Record<string, number>>({});
  const [simulationResult, setSimulationResult] = useState<SimulationResult[]>([]);

  // Format price using active currency and live rates
  const formatPrice = useCallback((amount: number) => formatMoney(amount, activeCurrency, liveRates), [activeCurrency, liveRates]);

  // ==================== HANDLERS ====================

  // Online/offline handling
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      processSyncQueue().then(() => fetchTabData(activeTab)).catch((err) => console.error('Sync on reconnect failed:', err));
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [activeTab, fetchTabData]);

  // Booking handler
  const handleSaveBooking = useCallback(async () => {
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
  }, [bookingForm, cart, setCart, setShowBookingModal, fetchData, addToast]);

  // External link handler
  const openExternal = useCallback((url: string) => {
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (opened) {
      opened.opener = null;
      return;
    }
    window.location.assign(url);
  }, []);

  // Recipe search
  const handleSearchRecipes = useCallback(async () => {
    if (!recipeSearchQuery.trim()) return;
    setIsSearchingRecipes(true);
    try {
      const res = await http.get(`/external-recipes/search?query=${recipeSearchQuery}`);
      setRecipeSearchResults(res.data);
    } catch (e) { console.error(e); addToast(t('recipe_search_failed'), 'error'); }
    finally { setIsSearchingRecipes(false); }
  }, [recipeSearchQuery, addToast]);

  // Recipe import
  const handleImportRecipe = useCallback(async (recipeId: string) => {
    try {
      const res = await http.get(`/external-recipes/${recipeId}/details`);
      const details = res.data;
      const slug = details.name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 10);
      const randomSuffix = Math.floor(Math.random() * 1000);
      setNewProduct({
        ...newProduct,
        name: details.name,
        ingredients: details.ingredients,
        instructions: details.instructions || [],
        id: `${slug}-${randomSuffix}`
      });
      setRecipeSearchResults([]);
      setRecipeSearchQuery('');
    } catch (e) { console.error(e); addToast(t('import_failed'), 'error'); }
  }, [newProduct, setNewProduct, setRecipeSearchResults, setRecipeSearchQuery, addToast]);

  // Command palette shortcut
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

  const today = new Date();
  const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 2, 1).toISOString().slice(0, 10);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

  // Derived accounting metrics
  const derived = useMemo(() => deriveAccountingMetrics({
    history,
    expenses,
    purchaseOrders,
    wasteRecords,
    suppliers,
    accountingRange: { start: threeMonthsAgo, end: monthEnd },
  }), [history, expenses, purchaseOrders, wasteRecords, suppliers, threeMonthsAgo, monthEnd]);

  const { accountingFeed, draftPurchaseCommitment, expenseBreakdown, filteredExpenses, filteredPurchaseOrders, filteredSales, filteredWaste, monthlyExpensesTotal, monthlyNetAfterExpenses, monthlySales, productProfitability, wasteByProduct } = derived;

  // Loading state
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

  const shouldShowSidebarText = sidebarHoverMode ? isSidebarHovered : !isSidebarCollapsed;

  // ==================== MAIN RENDER ====================
  return (
    <div dir={lang === 'ar' ? 'rtl' : 'ltr'} className={`flex min-h-screen w-full overflow-x-hidden selection:bg-gold/30 transition-colors duration-500 ${isDarkMode ? 'dark bg-[#0a0a0b] text-cream' : 'light bg-slate-100 text-slate-900'} ${lang === 'ar' ? 'font-arabic' : 'font-sans'}`}>
      {/* Sidebar */}
      <DashboardSidebar 
        isSidebarCollapsed={isSidebarCollapsed}
        setIsSidebarCollapsed={setIsSidebarCollapsed}
        sidebarHoverMode={sidebarHoverMode}
        isSidebarHovered={isSidebarHovered}
        setIsSidebarHovered={setIsSidebarHovered}
        isOperationsOpen={isOperationsOpen}
        setIsOperationsOpen={setIsOperationsOpen}
      />

      {/* Main Content */}
      <motion.main 
        animate={{ marginLeft: (sidebarHoverMode || isSidebarCollapsed) ? 112 : 320 }}
        className={`flex-1 p-10 min-h-screen min-w-0 transition-colors duration-500 bg-transparent`}
      >
        <DashboardHeader isOnline={isOnline} />

        <DashboardRouter />
      </motion.main>

      <DashboardModals />
    </div>
  );
};

// =============================================================================
// Dashboard — Main entry point, handles auth then delegates to DashboardInner
// =============================================================================
const Dashboard: React.FC = () => {
  // User state - passed to DashboardProviders when authenticated
  const [user, setUser] = useState<UserSession | null>(null);

  // Restore user session on mount
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('bakery_user');
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
    } catch (e) {
      console.error("Error loading user from storage", e);
      localStorage.removeItem('bakery_user');
    }
  }, [setUser]);

  // If authenticated, render DashboardInner with providers
  if (user) {
    return (
      <DashboardProviders user={user} setUser={setUser} activeTab="dashboard">
        <DashboardInner />
      </DashboardProviders>
    );
  }

  // Render login page
  return <AuthPage onAuthSuccess={setUser} />;
};

export default Dashboard;