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
// Panels (lazy loaded)
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
const ForecastPanel = React.lazy(() => import('./dashboard/panels/ForecastPanel'));
// Modals
import { TransferModal } from './dashboard/modals/TransferModal';
import { RecipeBuilderModal } from './dashboard/modals/RecipeBuilderModal';
import { ProduceBatchModal } from './dashboard/modals/ProduceBatchModal';
import { CostBreakdownModal } from './dashboard/modals/CostBreakdownModal';
// Context
import { DashboardProviders, useDashboard } from './dashboard/DashboardContext';
// Utils
import {
  createToastId,
  deriveAccountingMetrics,
  displayUnit,
  formatPrice as formatMoney,
  getDefaultBookingDate,
  getInitialLanguage,
} from './dashboard/utils';

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
    handleAddStaff, handleDeleteStaff, handleProduce, handlePlanBatch, handleCompletePlan,
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

  // Command palette actions
  const commandActions = useMemo(() => [
    ...[
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
    }).map(item => ({
      name: item.label,
      category: 'Navigation',
      onSelect: () => setActiveTab(item.id)
    })),
    ...(inventory?.products || []).map((p: Product) => ({
      name: `Recipe: ${p.name}`,
      category: 'Products',
      onSelect: () => setSelectedProduct(p)
    }))
  ], [user, inventory, t, setActiveTab, setSelectedProduct]);

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
  const [wasteForm, setWasteForm] = useState({ product_id: '', quantity: 1 });
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [newStaff, setNewStaff] = useState({ username: '', password: '' });
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

  // Alerts popover click-outside
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
  }, [showAlertsPopover, setShowAlertsPopover, notificationRef]);

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
                        {shouldShowSidebarText && <span className="font-bold text-[10px] uppercase tracking-[0.2em]">{t('operations')}</span>}
                    </div>
                    {shouldShowSidebarText && (
                        <motion.div animate={{ rotate: isOperationsOpen ? 180 : 0 }}>
                            <ChevronDown size={14} />
                        </motion.div>
                    )}
                </button>
                
                <AnimatePresence>
                    {isOperationsOpen && shouldShowSidebarText && (
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
                {activeTab === 'stock_movements' && 'Stock Ledger'}
                {activeTab === 'planner' && t('planner')}
                {activeTab === 'comptabilite' && t('comptabilite')}
                {activeTab === 'expenses' && t('expenses_1')}
                {activeTab === 'purchasing' && t('purchasing')}
                {activeTab === 'kitchen' && t('kitchen')}
                {activeTab === 'kitchen_board' && 'Kitchen Board'}
                {activeTab === 'intelligence' && 'Intelligence'}
                {activeTab === 'forecast' && (t('forecast') || 'Forecast')}
                {activeTab === 'orders' && t('orders')}
                {activeTab === 'staff' && t('staff')}
                {activeTab === 'settings' && t('settings')}
                {activeTab === 'customers' && t('customers')}
                {activeTab === 'history' && t('history')}
                {activeTab === 'fiche' && t('fiche')}
                {activeTab === 'simulator' && t('simulator')}
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

        <AnimatePresence mode="wait">
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
              {activeTab === 'dashboard' && <DashboardPanel />}
              {activeTab === 'pos' && <POSPanel />}
              {activeTab === 'inventory' && <InventoryPanel />}
              {activeTab === 'kitchen_board' && <KitchenBoardPanel />}
              {activeTab === 'fiche' && <FichePanel />}
              {activeTab === 'simulator' && <AnalyticsPanel />}
              {activeTab === 'history' && <HistoryPanel />}
              {activeTab === 'stock_movements' && <StockMovementsPanel />}
              {activeTab === 'kitchen' && <KitchenPanel />}
              {activeTab === 'intelligence' && <IntelligencePanel />}
              {activeTab === 'forecast' && <ForecastPanel />}
              {activeTab === 'planner' && <PlannerPanel />}
              {activeTab === 'orders' && <OrdersPanel />}
              {activeTab === 'purchasing' && <PurchasingPanel />}
              {activeTab === 'comptabilite' && <FinancePanel />}
              {activeTab === 'expenses' && <ExpensesPanel />}
              {activeTab === 'staff' && <StaffPanel />}
              {activeTab === 'settings' && <SettingsPanel />}
              {activeTab === 'customers' && <CustomersPanel />}
              {activeTab === 'history' && <HistoryPanel />}
              {activeTab === 'fiche' && <FichePanel />}
              {activeTab === 'simulator' && <AnalyticsPanel />}
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
                              {inventory.products.map((p: Product) => <option key={p.id} value={p.id} className={isDarkMode ? 'bg-[#0a0a0b] text-gold' : ''}>{p.name}</option>)}
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
                              type="text" 
                              value={newStaff.username}
                              onChange={(e) => setNewStaff({...newStaff, username: e.target.value})}
                              className={`w-full p-4 rounded-2xl border outline-none font-bold ${isDarkMode ? 'bg-white/5 border-white/10 text-cream focus:border-gold/40' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                              placeholder={t('username')}
                          />
                      </div>
                      <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">{t('password')}</label>
                          <input 
                              type="password" 
                              value={newStaff.password}
                              onChange={(e) => setNewStaff({...newStaff, password: e.target.value})}
                              className={`w-full p-4 rounded-2xl border outline-none font-bold ${isDarkMode ? 'bg-white/5 border-white/10 text-cream focus:border-gold/40' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                              placeholder={t('password')}
                          />
                      </div>
                      <button
                          onClick={async () => {
                              if (!newStaff.username || !newStaff.password) return;
                              try {
                                  await api.post('/staff', newStaff);
                                  setShowAddStaff(false);
                                  fetchData();
                                  addToast(t('staff_added'), "success");
                              } catch (e: any) { addToast(e.response?.data?.detail || t('failed_to_add_staff'), "error"); }
                          }}
                          className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${isDarkMode ? 'bg-gold text-charcoal shadow-gold-glow' : 'bg-slate-900 text-white shadow-xl'}`}
                      >
                          {t('save')}
                      </button>
                  </div>
              </motion.div>
          </div>
        )}

        {/* Other modals */}
        {showTransferModal && <TransferModal 
          isOpen={showTransferModal} 
          onClose={() => setShowTransferModal(false)} 
          locations={stockLocations} 
          inventory={inventory} 
          onTransfer={handleTransferStock} 
          isDarkMode={isDarkMode} 
        />}
        {showRecipeModal && <RecipeBuilderModal 
          isOpen={showRecipeModal} 
          onClose={() => setShowRecipeModal(false)} 
          item={activeSFItem} 
          rawMaterials={inventory.materials} 
          onSave={(itemId, lines) => {
            handleSaveRecipe(itemId, lines);
          }} 
          isDarkMode={isDarkMode} 
        />}
        {showProduceModal && <ProduceBatchModal 
          isOpen={showProduceModal} 
          onClose={() => setShowProduceModal(false)} 
          item={activeSFItem} 
          onProduce={handleProduceBatch} 
          isDarkMode={isDarkMode} 
        />}
        {showCostModal && <CostBreakdownModal 
          isOpen={showCostModal} 
          onClose={() => setShowCostModal(false)} 
          product={activeCostProduct} 
          isDarkMode={isDarkMode} 
          formatPrice={formatPrice} 
        />}
        {showReceiptModal && lastTransaction && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
              <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="w-full max-w-md p-10 luxury-panel"
              >
                  <div className="flex justify-between items-center mb-6">
                      <h3 className={`text-xl font-bold luxury-font uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t('receipt')}</h3>
                      <button onClick={() => setShowReceiptModal(false)} className="text-white/20 hover:text-white"><X size={24}/></button>
                  </div>
                  <div className="space-y-4 text-center">
                      <p className={`font-bold ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>Transaction #{lastTransaction.transaction_id || lastTransaction.id}</p>
                      <p className={`text-sm ${isDarkMode ? 'text-cream/60' : 'text-slate-600'}`}>{new Date(lastTransaction.timestamp).toLocaleString()}</p>
                      <div className={`flex gap-4 ${isDarkMode ? 'text-cream/60' : 'text-slate-600'}`}>
                          <span>Total: {formatPrice(lastTransaction.revenue || 0)}</span>
                          <span>Items: {lastTransaction.items?.length || 0}</span>
                      </div>
                      <button
                          onClick={async () => {
                              try {
                                  const dlToken = await getDownloadToken();
                                  openDocument(`${API_BASE}/transactions/${lastTransaction.transaction_id}/receipt?format=pdf&paper=80mm&token=${dlToken}`, `receipt-${lastTransaction.transaction_id}.pdf`);
                              } catch (err) {
                                  addToast(t('failed_to_download_file'), 'error');
                              }
                          }}
                          className={`w-full py-3 rounded-xl font-bold text-sm ${isDarkMode ? 'bg-gold text-charcoal shadow-gold-glow' : 'bg-slate-900 text-white'}`}
                      >
                          {t('download_receipt')}
                      </button>
                  </div>
              </motion.div>
          </div>
        )}
        {showCommandPalette && <CommandPalette isOpen={showCommandPalette} actions={commandActions} onClose={() => setShowCommandPalette(false)} isDarkMode={isDarkMode} />}
      </div>
  );
};

// =============================================================================
// Dashboard — Main entry point, handles auth then delegates to DashboardInner
// =============================================================================
const Dashboard: React.FC = () => {
  // Auth state (handled locally since we can't use useDashboard() outside providers)
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [signupForm, setSignupForm] = useState({ username: '', password: '', confirmPassword: '' });
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [showPassword, setShowPassword] = useState(false);
  
  const { t, i18n } = useTranslation();

  // User state - passed to DashboardProviders when authenticated
  const [user, setUser] = useState<UserSession | null>(null);
  
  // Local toast for login errors (before providers are mounted)
  const [loginToast, setLoginToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  // Auth handlers
  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthSubmitting(true);
    setLoginToast(null);
    try {
      const res = await http.post('/auth/login', loginForm);
      const { access_token, refresh_token, username, role } = res.data;
      localStorage.setItem('bakery_token', access_token);
      if (refresh_token) localStorage.setItem('bakery_refresh_token', refresh_token);
      localStorage.setItem('bakery_user', JSON.stringify({ username, role }));
      setUser({ username, role });
    } catch (err) {
      setLoginToast({ message: t('invalid_credentials'), type: 'error' });
    } finally {
      setIsAuthSubmitting(false);
    }
  }, [loginForm, setUser, t]);

  const handleSignup = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (signupForm.password !== signupForm.confirmPassword) {
      setLoginToast({ message: t('passwords_do_not_match'), type: 'error' });
      return;
    }
    
    setIsAuthSubmitting(true);
    setLoginToast(null);
    try {
      await http.post('/auth/signup', {
        username: signupForm.username,
        password: signupForm.password
      });
      
      const res = await http.post('/auth/login', {
        username: signupForm.username,
        password: signupForm.password
      });
      
      const { access_token, refresh_token, username, role } = res.data;
      localStorage.setItem('bakery_token', access_token);
      if (refresh_token) localStorage.setItem('bakery_refresh_token', refresh_token);
      localStorage.setItem('bakery_user', JSON.stringify({ username, role }));
      setUser({ username, role });
      setLoginToast({ message: t('bakery_ready'), type: 'success' });
    } catch (err: any) {
      setLoginToast({ message: err.response?.data?.detail || "Signup failed", type: 'error' });
    } finally {
      setIsAuthSubmitting(false);
    }
  }, [signupForm, setUser, t]);

  const handleGoogleSuccess = useCallback(async (response: any) => {
    setLoginToast(null);
    try {
      const res = await http.post('/auth/google', { credential: response.credential });
      const { access_token, refresh_token, username, role } = res.data;
      localStorage.setItem('bakery_token', access_token);
      if (refresh_token) localStorage.setItem('bakery_refresh_token', refresh_token);
      localStorage.setItem('bakery_user', JSON.stringify({ username, role }));
      setUser({ username, role });
      setLoginToast({ message: t('welcome_back'), type: 'success' });
    } catch (err) {
      setLoginToast({ message: t('google_sign_in_failed'), type: 'error' });
    }
  }, [setUser, t]);

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
  return (
    <main className="min-h-screen min-h-[100dvh] w-full bg-[#060606] text-white overflow-hidden font-sans" role="main">
      {/* Login toast */}
      {loginToast && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right duration-300">
          <div className={`px-4 py-3 rounded-xl font-bold text-sm ${
            loginToast.type === 'error' ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
          } shadow-lg`}>
            {loginToast.message}
          </div>
        </div>
      )}

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
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setLoginToast({ message: t('link_failed'), type: 'error' })}
                theme="filled_black"
                shape="rectangular"
                width={400}
              />
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
            <form onSubmit={authMode === 'login' ? handleLogin : handleSignup} className="w-full space-y-6">
              <div className="relative group">
                <input id="desktop-username" type="text" value={authMode === 'login' ? loginForm.username : signupForm.username} onChange={(e) => authMode === 'login' ? setLoginForm({ ...loginForm, username: e.target.value }) : setSignupForm({ ...signupForm, username: e.target.value })} className="monolith-input peer" placeholder=" " required autoComplete="username" />
                <label htmlFor="desktop-username" className="monolith-label">{authMode === 'login' ? 'Username' : 'Username'}</label>
                <div className="monolith-input-highlight" />
              </div>

              <div className="relative group">
                <input id="desktop-password" type={showPassword ? 'text' : 'password'} value={authMode === 'login' ? loginForm.password : signupForm.password} onChange={(e) => authMode === 'login' ? setLoginForm({ ...loginForm, password: e.target.value }) : setSignupForm({ ...signupForm, password: e.target.value })} className="monolith-input peer pr-10 text-lg" placeholder=" " required autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} />
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
                  <input id="desktop-confirm-password" type={showPassword ? 'text' : 'password'} value={signupForm.confirmPassword} onChange={(e) => setSignupForm({ ...signupForm, confirmPassword: e.target.value })} className="monolith-input peer text-lg" placeholder=" " required autoComplete="new-password" />
                  <label htmlFor="desktop-confirm-password" className="monolith-label text-sm">{t('confirm_password')}</label>
                  <div className="monolith-input-highlight" />
                </div>
              )}

              <button
                type="submit"
                disabled={isAuthSubmitting}
                className="monolith-btn mt-10 h-14 text-xs font-bold tracking-widest w-full"
              >
                {isAuthSubmitting
                  ? <span className="flex items-center justify-center gap-2"><span className="login-spinner" /> {t('authenticating')}</span>
                  : authMode === 'login' ? 'Login' : 'Sign Up'
                }
              </button>
            </form>
            
            {/* GSI Integration */}
            <div className="w-full mt-14">
              <div className="flex items-center gap-4 mb-6 opacity-50">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/50" />
                <span className="text-[10px] tracking-[0.2em] uppercase font-bold text-white/70">{t('external_protocol')}</span>
                <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/50" />
              </div>

              <div className="h-[48px] w-full mx-auto overflow-hidden rounded-[1rem] border border-white/10 hover:border-gold/40 transition-colors bg-white/[0.02]">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setLoginToast({ message: t('link_failed'), type: 'error' })}
                  theme="filled_black"
                  shape="rectangular"
                  width={400}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default Dashboard;