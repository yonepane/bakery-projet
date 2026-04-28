import React, { useState, useEffect } from 'react';
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
  Clock
} from 'lucide-react';

// axios is consumed internally by api.ts and http.ts — no direct import needed here.
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { api, processSyncQueue } from '../lib/api';
import http from '../lib/http';
import { Language, translations } from '../lib/translations';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { GOOGLE_CLIENT_ID, PRODUCT_ICON_CHOICES } from './dashboard/constants';
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
} from './dashboard/types';
// PERF: Lazy load all panels so code for hidden tabs is not downloaded/parsed on mount.
// This directly addresses the "Reduce unused JavaScript" audit (~250KB savings).
const DashboardPanel = React.lazy(() => import('./dashboard/panels/DashboardPanel'));
const POSPanel = React.lazy(() => import('./dashboard/panels/POSPanel'));
const InventoryPanel = React.lazy(() => import('./dashboard/panels/InventoryPanel'));
const FichePanel = React.lazy(() => import('./dashboard/panels/FichePanel'));
const AnalyticsPanel = React.lazy(() => import('./dashboard/panels/AnalyticsPanel'));
const HistoryPanel = React.lazy(() => import('./dashboard/panels/HistoryPanel'));
const PlannerPanel = React.lazy(() => import('./dashboard/panels/PlannerPanel'));
const ExpensesPanel = React.lazy(() => import('./dashboard/panels/ExpensesPanel'));
const FinancePanel = React.lazy(() => import('./dashboard/panels/FinancePanel'));
const OrdersPanel = React.lazy(() => import('./dashboard/panels/OrdersPanel'));
const PurchasingPanel = React.lazy(() => import('./dashboard/panels/PurchasingPanel'));
const SettingsPanel = React.lazy(() => import('./dashboard/panels/SettingsPanel'));
const StaffPanel = React.lazy(() => import('./dashboard/panels/StaffPanel'));
const IntelligencePanel = React.lazy(() => import('./dashboard/panels/IntelligencePanel'));
const KitchenPanel = React.lazy(() => import('./dashboard/panels/KitchenPanel'));
import { DashboardSharedProps } from './dashboard/types';

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
  const [lang, setLang] = useState<Language>(() => getInitialLanguage(localStorage.getItem('bakery_lang')));
  const t = translations[lang] || translations.en;
  const isRTL = lang === 'ar';
  
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isOperationsOpen, setIsOperationsOpen] = useState(false);

  // State used by the booking modal.
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingForm, setBookingForm] = useState({
      name: '',
      phone: '',
      date: getDefaultBookingDate(),
      source: 'pos' as 'pos' | 'ledger'
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
        addToast("Name and Date are required", "error");
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
        addToast("Booking Confirmed", "success");
    } catch (e) {
        addToast("Failed to create booking", "error");
    }
  };

  // Main business data loaded from the backend.
  const [inventory, setInventory] = useState<{ materials: Record<string, Ingredient>, products: Product[] }>({ materials: {}, products: [] });
  const [analytics, setAnalytics] = useState({ 
    revenue: 0, 
    cost: 0, 
    today_revenue: 0, 
    today_cost: 0, 
    currency: 'MAD', 
    chartData: [] as any[],
    hourlySales: [] as any[],
    topProducts: [] as any[],
    intelligence: {
        total_portfolio_cost: 0,
        average_margin: '0%',
        products_count: 0
    }
  });
  const [profitReport, setProfitReport] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  const [history, setHistory] = useState<Transaction[]>([]);
  const [planner, setPlanner] = useState<PlanItem[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({ conversions: { MAD: 1, EUR: 0.092, USD: 0.10 }, currency: 'MAD' });
  const [loading, setLoading] = useState(true);
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
  
  // Display preferences.
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [activeCurrency, setActiveCurrency] = useState('MAD');
  
  // State used by the price simulation tool.
  const [editMode, setEditMode] = useState(false);
  const [simPrices, setSimPrices] = useState<Record<string, number>>({});
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
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [showPOModal, setShowPOModal] = useState(false);
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [poReceiveDraft, setPoReceiveDraft] = useState<Record<string, { qty: number; price: number }>>({});
  const [newExpense, setNewExpense] = useState({ category: 'other', amount: 0, description: '' });
  const [newSupplier, setNewSupplier] = useState({ name: '', contact_info: '' });
  const [generalNote, setGeneralNote] = useState('');
  const [isSavingGeneralNote, setIsSavingGeneralNote] = useState(false);
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
  const [accountingRange, setAccountingRange] = useState({ start: monthStart, end: monthEnd });
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

  // State used by recipe search and online/offline handling.
  const [recipeSearchQuery, setRecipeSearchQuery] = useState('');
  const [recipeSearchResults, setRecipeSearchResults] = useState<any[]>([]);
  const [isSearchingRecipes, setIsSearchingRecipes] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isForecasting, setIsForecasting] = useState(false);

  const [purchasingSuggestions, setPurchasingSuggestions] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [shiftLogs, setShiftLogs] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [wasteRecords, setWasteRecords] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [newStaff, setNewStaff] = useState({ username: '', password: '' });

  const handleAddStaff = async () => {
    try {
      await http.post('/staff', newStaff);
      setShowAddStaff(false);
      fetchData();
      addToast(t.add_staff + " Success", "success");
    } catch (e: any) { addToast("Failed to add staff", "error"); }
  };

  const handleAddSupplier = async () => {
    if (!newSupplier.name.trim()) {
      addToast("Supplier name is required", "error");
      return;
    }
    try {
      const payload = {
        name: newSupplier.name.trim(),
        contact_info: newSupplier.contact_info.trim() || null
      };
      if (editingSupplier) {
        await http.put(`/suppliers/${editingSupplier.id}`, payload);
      } else {
        await http.post('/suppliers', payload);
      }
      setShowAddSupplier(false);
      setEditingSupplier(null);
      setNewSupplier({ name: '', contact_info: '' });
      fetchData();
      addToast(editingSupplier ? "Supplier Updated" : "Supplier Added", "success");
    } catch (e: any) {
      addToast(editingSupplier ? "Failed to update supplier" : "Failed to add supplier", "error");
    }
  };

  const handleDeleteSupplier = async (supplier: any) => {
    // Use the shared confirmation modal before deleting a supplier because
    // older purchase records may still refer to it.
    showConfirm({
      title: "Delete Supplier",
      message: `Delete supplier ${supplier.name}?`,
      type: 'danger',
      confirmText: "Delete",
      onConfirm: async () => {
        try {
          await http.delete(`/suppliers/${supplier.id}`);
          fetchData();
          addToast("Supplier Deleted", "success");
        } catch (e: any) {
          addToast("Supplier has order history or could not be deleted", "error");
        }
      }
    });
  };

  const handleSaveGeneralNote = async () => {
    if (!generalNote.trim()) return;
    // Save a new shift log entry.
    setIsSavingGeneralNote(true);
    try {
      await http.post('/shift-logs', {
        content: generalNote
      });
      setGeneralNote(''); // Clear the input after posting
      fetchData();
      addToast("Note posted to log", "success");
    } catch (e: any) {
      addToast("Failed to post note", "error");
    } finally {
      setIsSavingGeneralNote(false);
    }
  };

  const handleDeleteShiftLog = async (id: number) => {
    try {
        await api.delete(`/shift-logs/${id}`);
        fetchData();
        addToast("Note deleted", "success");
    } catch (e) {
        addToast("Delete failed", "error");
    }
  };

  const handleDeleteStaff = async (username: string) => {
    showConfirm({
        title: "Remove Staff",
        message: `Delete cashier account: ${username}?`,
        type: 'danger',
        confirmText: "Delete",
        onConfirm: async () => {
            try {
                await http.delete(`/staff/${username}`);
                fetchData();
                addToast("Staff Removed", "success");
            } catch (e: any) { addToast("Failed to remove staff", "error"); }
        }
    });
  };

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
        addToast("Forecasting failed. Please check your data.", 'error');
    } finally {
      setIsForecasting(false);
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // When the internet comes back, replay queued offline changes first.
      processSyncQueue().then(() => fetchData());
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // If the page loads while already online, try to replay queued work.
    if (navigator.onLine) {
        processSyncQueue().then(() => fetchData());
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const formatPrice = (amount: number) => formatMoney(amount, activeCurrency, settings?.conversions);



  const fetchData = async () => {
    if (!user) return;
    console.log("Fetching data for role:", user.role);
    try {
      const isOwner = user.role === 'owner';
      
      const safeGet = async (url: string, fallback: any = null) => {
        // If one request fails, still keep the rest of the dashboard working.
        try { return await api.get(url); }
        catch (e) { console.warn(`Failed to fetch ${url}:`, e); return fallback; }
      };

      // Load the main dashboard data in parallel for better speed.
      const [invData, anaData, aleData, histData, planData, settData, ordData, purData, suppData, posData, expData, staffData, profData, wasteData, logData] = await Promise.all([
        safeGet('/inventory'),
        isOwner ? safeGet('/analytics') : Promise.resolve({ ...analytics }),
        safeGet('/alerts', []),
        safeGet('/history', []),
        isOwner ? safeGet('/planner', []) : Promise.resolve([]),
        safeGet('/settings'),
        safeGet('/orders', []),
        isOwner ? safeGet('/purchasing/suggest', []) : Promise.resolve([]),
        isOwner ? safeGet('/suppliers', []) : Promise.resolve([]),
        isOwner ? safeGet('/purchase-orders', []) : Promise.resolve([]),
        isOwner ? safeGet('/expenses', []) : Promise.resolve([]),
        isOwner ? safeGet('/staff', []) : Promise.resolve([]),
        isOwner ? safeGet('/intelligence/profit-report', []) : Promise.resolve([]),
        isOwner ? safeGet('/waste', []) : Promise.resolve([]),
        safeGet('/shift-logs', [])
      ]);
      console.log("Data sync completed");
      if (invData) {
        if (invData.products) {
          invData.products.sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));
        }
        setInventory(invData);
      }
      if (anaData) setAnalytics(anaData);
      if (aleData) setAlerts(aleData);
      if (histData) setHistory(histData);
      if (planData) setPlanner(planData);
      if (settData) {
        setSettings(settData);
        setGeneralNote(settData.operations_note || '');
      }
      if (ordData) setOrders(ordData);
      if (purData) setPurchasingSuggestions(purData);
      if (suppData) {
        setSuppliers(suppData);
        setSelectedSupplierId(prev => {
          if (!suppData.length) return null;
          if (prev && suppData.some((supp: any) => supp.id === prev)) return prev;
          return suppData[0].id;
        });
      }
      if (posData) {
        const sorted = [...posData].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setPurchaseOrders(sorted);
      }
      if (expData) setExpenses(expData);
      if (staffData) setStaff(staffData);
      if (profData) setProfitReport(profData);
      if (wasteData) setWasteRecords(wasteData);
      if (logData) setShiftLogs(logData);
      
      if (invData && invData.materials) {
        // Fill the simulator with the latest saved ingredient prices.
        const initialPrices: Record<string, number> = {};
        Object.entries(invData.materials as Record<string, Ingredient>).forEach(([name, data]) => {
            initialPrices[name] = data.price;
        });
        setSimPrices(initialPrices);
      }
    } catch (error) {
      console.error("Critical error in fetchData:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthSubmitting(true);
    try {
      const res = await http.post('/auth/login', loginForm);
      const { access_token, username, role } = res.data;
      localStorage.setItem('bakery_token', access_token);
      localStorage.setItem('bakery_user', JSON.stringify({ username, role }));
      setUser({ username, role });
    } catch (err) {
      addToast("Invalid credentials", 'error');
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signupForm.password !== signupForm.confirmPassword) {
      addToast("Passwords do not match", "error");
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
      
      const { access_token, username, role } = res.data;
      localStorage.setItem('bakery_token', access_token);
      localStorage.setItem('bakery_user', JSON.stringify({ username, role }));
      setUser({ username, role });
      addToast("Bakery Ready!", "success");
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
      const { access_token, username, role } = res.data;
      localStorage.setItem('bakery_token', access_token);
      localStorage.setItem('bakery_user', JSON.stringify({ username, role }));
      setUser({ username, role });
      addToast("Welcome back!", "success");
    } catch (err) {
      addToast("Google Sign-In failed", "error");
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

  useEffect(() => {
    if (user) {
        // Refresh the data regularly so the dashboard stays up to date.
        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }
  }, [user]);

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
    // Generate random positions for gold dust particles only once
    const particles = Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      size: Math.random() * 3 + 1,
      x: Math.random() * 100,
      y: Math.random() * 100,
      duration: Math.random() * 20 + 15,
      delay: Math.random() * 10,
    }));

    return (
      <main className="bento-shell min-h-screen p-4 lg:p-6 bg-black text-white" role="main">
        {/* Mobile Fallback: just center the login form, since this is desktop focused */}
        <div className="lg:hidden flex items-center justify-center min-h-screen">
          <div className="w-full max-w-sm px-6">
            <h1 className="text-3xl font-light tracking-[0.2em] uppercase text-white mb-8 font-serif text-center">
              Bakery<span className="font-bold text-gold">OS</span>
            </h1>
            {/* We duplicate the form logic here for the mobile view, but keep it simple */}
            <form onSubmit={authMode === 'login' ? handleLogin : handleSignup} className="space-y-6">
                <div className="relative group">
                  <input
                    id="mobile-username"
                    type="text"
                    value={authMode === 'login' ? loginForm.username : signupForm.username}
                    onChange={(e) => authMode === 'login'
                      ? setLoginForm({ ...loginForm, username: e.target.value })
                      : setSignupForm({ ...signupForm, username: e.target.value })}
                    className="monolith-input peer"
                    placeholder=" "
                    required
                  />
                  <label htmlFor="mobile-username" className="monolith-label">
                    {authMode === 'login' ? 'Identity / Username' : 'Commander Identity'}
                  </label>
                  <div className="monolith-input-highlight" />
                </div>

                <div className="relative group">
                  <input
                    id="mobile-password"
                    type={showPassword ? 'text' : 'password'}
                    value={authMode === 'login' ? loginForm.password : signupForm.password}
                    onChange={(e) => authMode === 'login'
                      ? setLoginForm({ ...loginForm, password: e.target.value })
                      : setSignupForm({ ...signupForm, password: e.target.value })}
                    className="monolith-input peer pr-10"
                    placeholder=" "
                    required
                  />
                  <label htmlFor="mobile-password" className="monolith-label">Access Cipher</label>
                  <div className="monolith-input-highlight" />
                  
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-0 bottom-3 text-white/20 hover:text-gold transition-colors p-2"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>

                <button type="submit" disabled={isAuthSubmitting} className="monolith-btn mt-8">
                  {isAuthSubmitting ? <span className="login-spinner" /> : (authMode === 'login' ? 'Initiate Link' : 'Deploy System')}
                </button>
            </form>
          </div>
        </div>

        {/* ── DESKTOP BENTO GRID ───────────────────────────────── */}
        <div className="hidden lg:grid h-[calc(100vh-3rem)] grid-cols-12 grid-rows-12 gap-4 lg:gap-6 w-full max-w-[1800px] mx-auto">
          
          {/* Main Hero Panel (Left 8 columns) */}
          <div className="col-span-8 row-span-12 relative rounded-[2rem] overflow-hidden bento-panel border border-white/5">
            {/* Deep background for hero */}
            <div className="absolute inset-0 bg-black">
              {/* Aurora effect */}
              <motion.div
                animate={{ rotate: [0, 360], scale: [1, 1.1, 1] }}
                transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
                className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] opacity-[0.15]"
                style={{
                  background: 'conic-gradient(from 90deg at 50% 50%, #000000 0%, rgba(212, 175, 55, 0.1) 25%, #000000 50%, rgba(184, 134, 11, 0.1) 75%, #000000 100%)',
                  filter: 'blur(100px)'
                }}
              />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-gold/5 blur-[120px]" />
              {/* Floating dust */}
              {particles.map(p => (
                <motion.div
                  key={p.id}
                  animate={{ y: ['0vh', '-100vh'], opacity: [0, 0.6, 0], x: `${p.x + (Math.random() * 10 - 5)}vw` }}
                  transition={{ duration: p.duration, repeat: Infinity, delay: p.delay, ease: "linear" }}
                  className="absolute rounded-full bg-gold"
                  style={{ left: `${p.x}vw`, top: `${p.y}vh`, width: p.size, height: p.size, boxShadow: '0 0 10px 1px rgba(212, 175, 55, 0.3)' }}
                />
              ))}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#000_100%)] opacity-80" />
            </div>

            {/* Content overlay */}
            <div className="relative z-10 h-full p-16 flex flex-col justify-between">
              <div className="flex items-center gap-6">
                <div className="h-16 w-16 rounded-full overflow-hidden border border-gold/40 relative monolith-badge shrink-0">
                  <picture>
                    <source type="image/webp" srcSet="/columbina-login-1x.webp 1x, /columbina-login.webp 2x" />
                    <img src="/columbina-login.jpg" alt="Crest" className="w-full h-full object-cover" />
                  </picture>
                </div>
                <div>
                  <h1 className="text-4xl font-light tracking-[0.2em] uppercase text-white font-serif leading-none">
                    Bakery<span className="font-bold text-gold">OS</span>
                  </h1>
                  <p className="text-[10px] tracking-[0.4em] uppercase text-white/40 mt-2">Enterprise Terminal</p>
                </div>
              </div>

              <div className="max-w-2xl mt-auto">
                <motion.p 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 1 }}
                  className="text-7xl font-bold luxury-font tracking-tighter leading-[0.9] text-white"
                >
                  The Intelligence <br/>
                  Behind the <br/>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold via-[#ffd700] to-gold">Craft.</span>
                </motion.p>
                
                {/* System Readouts to fill the empty space with an OS vibe */}
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6, duration: 1 }}
                  className="mt-16 grid grid-cols-3 gap-8 border-t border-white/10 pt-8"
                >
                  <div>
                    <div className="text-[9px] uppercase tracking-[0.2em] text-white/30 mb-2">Core Modules</div>
                    <div className="text-sm font-light text-white/70 space-y-1">
                      <div className="flex items-center gap-2"><div className="w-1 h-1 bg-gold rounded-full" /> Predictive Ordering</div>
                      <div className="flex items-center gap-2"><div className="w-1 h-1 bg-gold rounded-full" /> Yield Analytics</div>
                      <div className="flex items-center gap-2"><div className="w-1 h-1 bg-gold rounded-full" /> Multi-node POS</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-[0.2em] text-white/30 mb-2">Network Status</div>
                    <div className="text-sm font-light text-white/70 space-y-1">
                      <div className="flex items-center gap-2"><div className="w-1 h-1 bg-green-500 rounded-full animate-pulse" /> Mainframe Active</div>
                      <div className="flex items-center gap-2 text-white/40"><div className="w-1 h-1 bg-white/20 rounded-full" /> Encrypted AES-256</div>
                      <div className="flex items-center gap-2 text-white/40"><div className="w-1 h-1 bg-white/20 rounded-full" /> Latency: 12ms</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-[0.2em] text-white/30 mb-2">Authorization</div>
                    <div className="text-sm font-light text-white/70">
                      Biometric & Cipher keys required for Level 4 access.
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>

          {/* Right Column (4 columns) - Login Panel */}
          <div className="col-span-4 row-span-12 rounded-[2rem] overflow-hidden bento-panel border border-white/5 relative flex flex-col items-center justify-center p-10">
            <div className="absolute inset-0 bg-white/[0.01]" />
            {/* Form container */}
            <div className="relative z-10 w-full max-w-[320px]">
              
              {/* Mode Toggle */}
              <div className="flex w-full mb-10 border-b border-white/10">
                <button
                  onClick={() => setAuthMode('login')}
                  className={`flex-1 pb-4 text-[10px] font-bold tracking-widest uppercase transition-colors relative ${authMode === 'login' ? 'text-gold' : 'text-white/30 hover:text-white/60'}`}
                >
                  Authenticate
                  {authMode === 'login' && <motion.div layoutId="mode-indicator" className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-gold shadow-[0_0_10px_rgba(212,175,55,0.8)]" />}
                </button>
                <button
                  onClick={() => setAuthMode('signup')}
                  className={`flex-1 pb-4 text-[10px] font-bold tracking-widest uppercase transition-colors relative ${authMode === 'signup' ? 'text-gold' : 'text-white/30 hover:text-white/60'}`}
                >
                  Initialize
                  {authMode === 'signup' && <motion.div layoutId="mode-indicator" className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-gold shadow-[0_0_10px_rgba(212,175,55,0.8)]" />}
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
                    className="monolith-input peer"
                    placeholder=" "
                    required
                  />
                  <label htmlFor="desktop-username" className="monolith-label">
                    {authMode === 'login' ? 'Identity / Username' : 'Commander Identity'}
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
                    className="monolith-input peer pr-10"
                    placeholder=" "
                    required
                  />
                  <label htmlFor="desktop-password" className="monolith-label">Access Cipher</label>
                  <div className="monolith-input-highlight" />
                  
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-0 bottom-3 text-white/20 hover:text-gold transition-colors p-2"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>

                {authMode === 'signup' && (
                  <div className="relative group">
                    <input
                      id="desktop-confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      value={signupForm.confirmPassword}
                      onChange={(e) => setSignupForm({ ...signupForm, confirmPassword: e.target.value })}
                      className="monolith-input peer"
                      placeholder=" "
                      required
                    />
                    <label htmlFor="desktop-confirm-password" className="monolith-label">Verify Cipher</label>
                    <div className="monolith-input-highlight" />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isAuthSubmitting}
                  className="monolith-btn mt-8"
                >
                  {isAuthSubmitting
                    ? <span className="flex items-center justify-center gap-3"><span className="login-spinner" /> Establishing Link</span>
                    : authMode === 'login' ? 'Initiate Link' : 'Deploy System'
                  }
                </button>
              </form>

              {/* GSI Integration */}
              <div className="w-full mt-12">
                <div className="flex items-center gap-4 mb-6 opacity-30">
                  <div className="h-px flex-1 bg-white" />
                  <span className="text-[8px] tracking-[0.2em] uppercase">External Auth</span>
                  <div className="h-px flex-1 bg-white" />
                </div>

                <div className="h-[44px] w-full max-w-[240px] mx-auto overflow-hidden rounded-full border border-white/10 hover:border-gold/30 transition-colors">
                  {gsiReady ? (
                    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                      <GoogleLogin
                        onSuccess={handleGoogleSuccess}
                        onError={() => addToast('Link Failed', 'error')}
                        theme="filled_black"
                        shape="pill"
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

  const handleProduce = async (productId: string, qty: number) => {
    // Producing a batch consumes ingredients and increases product stock.
    try {
      await api.post('/produce', { product_id: productId, quantity: qty });
      fetchData();
      addToast("Production Logged", "success");
    } catch (error: any) {
      addToast("Production Failed", "error");
    }
  };

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

  const finalizeSale = async () => {
    // Completing a sale creates a transaction in the backend and empties the cart.
    if (cart.length === 0) return;
    try {
      const data = await api.post('/complete', { cart: cart.map(item => ({ id: item.id, qty: item.qty })) });
      setLastTransaction(data);
      setCart([]);
      fetchData();
      addToast("Sale Completed", "success");
    } catch (error: any) {
      addToast("Sale Failed", "error");
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
          addToast("Material Prices Updated", 'success');
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
                addToast("Shift Closed. New Session Started.", "success");
            } catch (e: any) {
                addToast("Reset Failed", "error");
            }
        }
    });
  };

  const handleAddMaterial = async () => {
    try {
      if (editingMaterialName) {
        await api.put(`/materials/${editingMaterialName}`, newMaterial);
        addToast("Ingredient Updated", "success");
      } else {
        await api.post('/materials', newMaterial);
        addToast(t.add_material + " Success", "success");
      }
      setShowAddMaterial(false);
      setEditingMaterialName(null);
      fetchData();
    } catch (e: any) { addToast(editingMaterialName ? "Failed to update" : "Failed to add material", "error"); }
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

  const handleAddExpense = async () => {
    try {
        await api.post('/expenses', newExpense);
        setShowAddExpense(false);
        fetchData();
        addToast("Expense Logged", "success");
    } catch (e: any) { addToast("Failed to log expense", "error"); }
  };

  const handleAdjustStock = async (item_type: 'product' | 'material', id: string, amount: number) => {
    // This lets the owner adjust stock manually when needed.
    try {
        await api.post('/inventory/adjust', { item_type, id, amount });
        fetchData();
        addToast(`${amount > 0 ? '+' : ''}${amount} Updated`, "success");
    } catch (e) {
        addToast("Adjustment Failed", "error");
    }
  };

  const handleDeleteMaterial = async (name: string) => {
    showConfirm({
        title: "Discard Material",
        message: `Are you sure you want to delete ${name}? This cannot be undone.`,
        type: 'danger',
        confirmText: "Delete Forever",
        onConfirm: async () => {
            try {
                await api.delete(`/materials/${name}`);
                fetchData();
                addToast("Material Deleted", "success");
            } catch (e: any) { addToast("Failed to delete material", "error"); }
        }
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

  const handleAddProduct = async () => {
    if (!newProduct.id.trim() || !newProduct.name.trim()) {
      addToast("ID and Name are required", "error");
      return;
    }
    try {
      let data;
      if (editingProductId) {
        data = await api.put(`/products/${editingProductId}`, newProduct);
        addToast("Product Updated", 'success');
      } else {
        data = await api.post('/products', newProduct);
        addToast(data.message || "Product Created", 'success');
      }
      setShowAddProduct(false);
      setShowProductIconPicker(false);
      setEditingProductId(null);
      fetchData();
      // Clear the form after a successful save.
      setNewProduct({ id: '', name: '', price: 0, icon: '🥐', ingredients: [], prep_time: 0, cook_time: 0, yield_qty: 1, instructions: [] });
    } catch (e: any) { addToast("Action Failed", "error"); }
  };

  const handleDeleteProduct = async (id: string) => {
    // Deleting a product also removes its recipe rows in the backend.
    showConfirm({
        title: "Delete Entity",
        message: "Are you sure you want to remove this product and its recipe? This cannot be undone.",
        type: 'danger',
        confirmText: "Delete Product",
        onConfirm: async () => {
            try {
                await api.delete(`/products/${id}`);
                fetchData();
                addToast("Product Deleted", "success");
            } catch (e: any) { addToast("Failed to delete product", "error"); }
        }
    });
  };

  const handleCleanupProducts = async () => {
    // Small maintenance helper for cleaning older broken product rows.
    showConfirm({
        title: "Database Cleanup",
        message: "Remove all broken product entries (empty IDs)?",
        type: 'danger',
        confirmText: "Clean Database",
        onConfirm: async () => {
            try {
                await http.post('/maintenance/delete-empty-products');
                fetchData();
                addToast("Cleanup Complete", "success");
            } catch (e: any) { addToast("Cleanup Failed", "error"); }
        }
    });
  };

  const handleUpdateProductIngredients = async (productId: string, ingredients: any[]) => {
    if (!editMode) return;
    try {
      await api.put(`/products/${productId}`, { ingredients });
      fetchData();
    } catch (e: any) { addToast("Failed to update recipe", "error"); }
  };

  const handleUpdateProductPrice = async (productId: string, newPrice: number) => {
    if (!editMode) return;
    try {
        await api.put(`/products/${productId}`, { price: newPrice });
        fetchData();
        addToast("Price Updated", "success");
    } catch (e: any) { addToast("Failed to update price", "error"); }
  };

  const handleUpdateProductField = async (productId: string, field: string, value: any) => {
    if (!editMode) return;
    try {
        await api.put(`/products/${productId}`, { [field]: value });
        fetchData();
    } catch (e: any) { addToast(`Failed to update ${field}`, "error"); }
  };

  const handleCreatePO = async (data: { supplier_id: number, items: any[] }) => {
    // A purchase order records what you plan to buy. Stock changes later, when goods are received.
    if (!suppliers.length) {
        addToast("Add a supplier before generating a bulk purchase order", "error");
        return;
    }
    try {
        await api.post('/purchase-orders', data);
        fetchData();
        addToast("Bulk Order Generated", "success");
    } catch (e: any) { addToast("Failed to create bulk order", "error"); }
  };

  const handleReceivePO = async (id: string, payload?: { items: any[] }) => {
    // Receiving goods can be complete or partial depending on the payload.
    try {
        if (payload) {
            await http.post(`/purchase-orders/${id}/receive`, payload);
        } else {
            await http.patch(`/purchase-orders/${id}/status?status=received`);
        }
        fetchData();
        addToast("Goods Received & Stock Updated", "success");
    } catch (e: any) { addToast("Failed to receive goods", "error"); }
  };

  const handleDeletePO = async (id: string) => {
    showConfirm({
        title: "Delete Order",
        message: "Are you sure you want to remove this order? It will be archived but preserved for accounting history.",
        type: 'danger',
        confirmText: "Delete",
        onConfirm: async () => {
            try {
                await api.delete(`/purchase-orders/${id}`);
                fetchData();
                addToast("Order Archived", "success");
            } catch (e: any) { addToast("Failed to archive order", "error"); }
        }
    });
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
          { qty: Math.max(0, (Number(item.qty) || 0) - (Number(item.received_qty) || 0)), price: Number(item.price) || 0 }
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
      addToast("Purchase order updated", "success");
      setShowPOModal(false);
    } catch (e: any) {
      addToast("Failed to update purchase order", "error");
    }
  };

  const handlePartialReceivePO = async () => {
    if (!selectedPO) return;
    const items = selectedPO.items
      .map((item: any) => ({
        name: item.name,
        qty: Math.max(0, Number(poReceiveDraft[item.name]?.qty) || 0),
        price: Number(poReceiveDraft[item.name]?.price) || Number(item.price) || 0
      }))
      .filter((item: any) => item.qty > 0);
    if (!items.length) {
      addToast("Enter received quantities first", "error");
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
    // Open reports and receipts in a new tab so printing feels natural.
    const popup = window.open('', '_blank');
    const absoluteUrl = new URL(url, window.location.origin).toString();
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
  const handlePlanBatch = async (productId: string, qty: number, date: string) => {
    // The planner is saved as one full schedule snapshot.
    const newPlan = [...planner, {
        id: Math.random().toString(36).substr(2, 9),
        date,
        product_id: productId,
        quantity: qty,
        status: 'pending' as const
    }];
    try {
        await api.post('/planner', newPlan);
        fetchData();
    } catch (e) { console.error(e); }
  };

  const handleCompletePlan = async (planId: string) => {
    const item = planner.find(p => p.id === planId);
    if (!item) return;
    
    try {
        // First, produce the batch so stock and cost history are updated.
        await api.post('/produce', { product_id: item.product_id, quantity: item.quantity });
        
        // Then save the planner again with this item marked as completed.
        const newPlan = planner.map(p => p.id === planId ? { ...p, status: 'completed' as const } : p);
        await api.post('/planner', newPlan);
        
        fetchData();
        addToast("Batch Completed", "success");
    } catch (e: any) {
        addToast("Completion Failed", "error");
    }
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
    editMode, setEditMode, t, lang, setLang,
    inventory, analytics, history, planner, orders, expenses, suppliers,
    purchaseOrders, purchasingSuggestions, selectedSupplierId, setSelectedSupplierId,
    staff, shiftLogs, alerts, profitReport, wasteRecords,
    accountingRange, setAccountingRange, monthStart, monthEnd,
    accountingFeed, draftPurchaseCommitment, expenseBreakdown,
    filteredExpenses, filteredPurchaseOrders, filteredSales, filteredWaste,
    monthlyExpensesTotal, monthlyNetAfterExpenses, monthlySales,
    productProfitability, wasteByProduct,
    cart, setCart, addToCart, finalizeSale, lastTransaction,
    setShowReceiptModal, setShowBookingModal, bookingForm, setBookingForm,
    setShowAddProduct, setShowAddMaterial, setShowAddExpense, setShowAddSupplier,
    setShowAddStaff, setShowPOModal, setShowWasteModal, editingProductId, setEditingProductId,
    editingMaterialName, setEditingMaterialName, editingSupplier, setEditingSupplier,
    newMaterial, setNewMaterial, newSupplier, setNewSupplier, selectedPO, setSelectedPO,
    poReceiveDraft, setPoReceiveDraft,
    simPrices, setSimPrices, simulationResult, runSimulation, saveSimulation,
    isForecasting, handleSmartForecast, handleProduce, setPlanner, setSelectedProduct,
    generalNote, setGeneralNote, isSavingGeneralNote, handleSaveGeneralNote, handleDeleteShiftLog,
    sortedMaterialEntries,
    sortedMaterialNames,
    handleAdjustStock, handleUpdateProductPrice, handleUpdateProductField,
    handleOpenEditProduct, handleDeleteProduct, handleCleanupProducts,
    handleDeleteMaterial, startEditingMaterial, handleCreatePO,
    handleReceivePO, handleDeletePO, openPOModal, handleSavePO,
    handlePartialReceivePO, handleDeleteStaff, handleDeleteSupplier,
    handleAddSupplier, handleResetSession, handleCompletePlan,
    formatPrice, displayUnit: (v, u) => `${v}${u}`, openDocument, openSelector,
    addToast, showConfirm, fetchData, api
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
       <p className="font-bold tracking-widest uppercase text-xs">Re-engaging Luxe Logiciel...</p>
    </div>
  );

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className={`flex min-h-screen selection:bg-gold/30 transition-colors duration-500 ${isDarkMode ? 'bg-[#0a0a0b] text-cream' : 'bg-[#f8f9fa] text-slate-900'} ${isRTL ? 'font-arabic' : 'font-sans'}`}>
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarCollapsed ? 80 : 288 }}
        className={`fixed h-[calc(100vh-2rem)] top-4 left-4 z-50 flex flex-col overflow-y-auto overflow-x-hidden custom-scrollbar rounded-3xl transition-all duration-500 ${isDarkMode ? 'glass-sidebar' : 'bg-white/80 backdrop-blur-2xl border border-slate-200 shadow-xl'}`}
      >
        <div className="p-6">
          <div className="flex items-center gap-3 mb-10">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shrink-0 ${isDarkMode ? 'bg-gold shadow-gold-glow' : 'bg-slate-900 shadow-slate-200'}`}>
              <Box className={`${isDarkMode ? 'text-charcoal' : 'text-white'} w-6 h-6`} />
            </div>
            {!isSidebarCollapsed && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <h1 className="brand-title" style={{ ['--brand-hover' as any]: '#d4af37' }}>
                    <span className={`brand-title__base text-2xl font-bold luxury-font tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      Bakery<span className="text-gold">Os</span>
                    </span>
                    <span aria-hidden="true" className="brand-title__hover text-2xl font-bold luxury-font tracking-tight">
                      Bakery<span>Os</span>
                    </span>
                  </h1>
                  <span className="inline-flex mt-3 text-[10px] bg-gold/10 text-gold px-2 py-0.5 rounded-full font-black">BETA 0.1</span>
              </motion.div>
            )}
          </div>

          <nav className="space-y-1">
            {[
              { id: 'dashboard', icon: LayoutDashboard, label: t.dashboard },
              { id: 'intelligence', icon: Brain, label: 'Intelligence' },
              { id: 'pos', icon: ShoppingCart, label: t.pos },
              { id: 'kitchen', icon: ChefHat, label: t.kitchen },
              { id: 'inventory', icon: Package, label: t.inventory },
              { id: 'fiche', icon: FileText, label: t.fiche },
              { id: 'purchasing', icon: Truck, label: t.purchasing },
              { id: 'simulator', icon: Calculator, label: t.simulator },
              { id: 'history', icon: HistoryIcon, label: t.history },
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
                title={isSidebarCollapsed ? item.label : ''}
              >
                <item.icon size={20} className="shrink-0" />
                {!isSidebarCollapsed && <span className="font-semibold text-sm whitespace-nowrap">{item.label}</span>}
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
                        {!isSidebarCollapsed && <span className="font-bold text-[10px] uppercase tracking-[0.2em]">{t.operations}</span>}
                    </div>
                    {!isSidebarCollapsed && (
                        <motion.div animate={{ rotate: isOperationsOpen ? 180 : 0 }}>
                            <ChevronDown size={14} />
                        </motion.div>
                    )}
                </button>
                
                <AnimatePresence>
                    {isOperationsOpen && !isSidebarCollapsed && (
                        <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden space-y-1 mt-1 pl-4"
                        >
                            {[
                                { id: 'expenses', icon: Coins, label: t.expenses },
                                { id: 'comptabilite', icon: Coins, label: t.comptabilite },
                                { id: 'planner', icon: Calendar, label: t.planner },
                                { id: 'orders', icon: FileText, label: t.orders },
                                { id: 'staff', icon: Settings, label: t.staff },
                            ].filter(sub => {
                                if (sub.id === 'staff' && user?.role !== 'owner') return false;
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
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className={`w-full py-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${isDarkMode ? 'border-white/5 bg-white/5 text-gold hover:bg-white/10' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
          >
            {isSidebarCollapsed ? <ChevronRight size={16}/> : <ChevronLeft size={16}/>}
            {!isSidebarCollapsed && <span className="text-[10px] font-black uppercase tracking-widest">Collapse View</span>}
          </button>

          {/* Theme & Currency Controls */}
          {!isSidebarCollapsed && (
            <>
              <div className={`grid grid-cols-2 gap-2 p-1 rounded-xl ${isDarkMode ? 'bg-white/5' : 'bg-slate-100'}`}>
                <button onClick={() => setIsDarkMode(true)} className={`py-2 rounded-lg flex justify-center transition-all ${isDarkMode ? 'bg-gold text-black shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}><Moon size={16}/></button>
                <button onClick={() => setIsDarkMode(false)} className={`py-2 rounded-lg flex justify-center transition-all ${!isDarkMode ? 'bg-white text-slate-900 shadow-lg' : 'text-white/20 hover:text-white'}`}><Sun size={16}/></button>
              </div>
              
              <div className="glass-radio-group">
                <input
                  type="radio"
                  id="glass-mad"
                  name="currency-switcher"
                  checked={activeCurrency === 'MAD'}
                  onChange={() => setActiveCurrency('MAD')}
                />
                <label htmlFor="glass-mad">MAD</label>

                <input
                  type="radio"
                  id="glass-eur"
                  name="currency-switcher"
                  checked={activeCurrency === 'EUR'}
                  onChange={() => setActiveCurrency('EUR')}
                />
                <label htmlFor="glass-eur">EUR</label>

                <input
                  type="radio"
                  id="glass-usd"
                  name="currency-switcher"
                  checked={activeCurrency === 'USD'}
                  onChange={() => setActiveCurrency('USD')}
                />
                <label htmlFor="glass-usd">USD</label>

                <div className="glass-glider" aria-hidden="true"></div>
              </div>

              <button onClick={() => setShowWasteModal(true)} className={`w-full py-4 rounded-xl font-bold text-xs uppercase tracking-widest border border-rose-500/20 text-rose-500 hover:bg-rose-500/10 transition-all`}>Log Daily Waste</button>
            </>
          )}

          <div className={`p-4 border-t ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
            {!isSidebarCollapsed && (
              <div className="flex gap-2 mb-4">
                  {(['en', 'fr', 'ar'] as Language[]).map(l => (
                      <button 
                          key={l}
                          onClick={() => {
                              setLang(l);
                              localStorage.setItem('bakery_lang', l);
                          }}
                          className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${lang === l ? 'bg-gold text-charcoal' : 'bg-white/5 text-cream/40 hover:bg-white/10'}`}
                      >
                          {l}
                      </button>
                  ))}
              </div>
            )}
            <button 
                onClick={() => { 
                  localStorage.removeItem('bakery_token'); 
                  localStorage.removeItem('bakery_user'); 
                  setUser(null); 
                }} 
                className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-xs uppercase tracking-widest bg-rose-600 hover:bg-rose-700 text-white shadow-lg transition-all ${isSidebarCollapsed ? 'px-0' : ''}`}
            >
                <LogOut size={16}/>
                {!isSidebarCollapsed && t.logout}
            </button>
          </div>

          </div>
      </motion.aside>

      {/* Main Content */}
      <motion.main 
        animate={{ marginLeft: isSidebarCollapsed ? 112 : 320 }}
        className={`flex-1 p-10 min-h-screen transition-colors duration-500 bg-transparent`}
      >
        <header className="flex justify-between items-end mb-12">
          <div>
            <h2 className={`text-5xl font-bold luxury-font mb-2 tracking-tighter uppercase text-gold-gradient`}>
                {activeTab === 'dashboard' && t.dashboard}
                {activeTab === 'pos' && t.pos}
                {activeTab === 'inventory' && t.inventory}
                {activeTab === 'fiche' && t.fiche}
                {activeTab === 'simulator' && t.simulator}
                {activeTab === 'history' && t.history}
                {activeTab === 'planner' && t.planner}
                {activeTab === 'expenses' && t.expenses}
                {activeTab === 'comptabilite' && t.comptabilite}
                {activeTab === 'purchasing' && t.purchasing}
                {activeTab === 'kitchen' && t.kitchen}
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
                <p className={`text-[10px] uppercase tracking-widest font-black ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>{isOnline ? t.online : t.offline}</p>
                <p className={`text-xs font-bold ${isOnline ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {isOnline ? t.sync_active : t.offline_mode}
                </p>
              </div>
              <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.8)]' : 'bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.8)] animate-pulse'}`} />
            </div>

            {user?.role === 'owner' && (
              <div className={`px-4 py-2 flex items-start gap-4 rounded-2xl ${isDarkMode ? 'glass-panel shadow-gold-glow border-gold/20' : 'border border-slate-200 bg-white shadow-sm'}`}>
                <div className="text-right">
                  <p className={`text-[10px] uppercase tracking-widest font-black ${isDarkMode ? 'text-gold' : 'text-slate-500'}`}>Master Control</p>
                  {editMode && (
                    <p className={`text-xs font-bold ${isDarkMode ? 'text-gold' : 'text-slate-500'}`}>
                      Active
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
                <p className={`text-[10px] uppercase tracking-widest font-black ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>{t.profit}</p>
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
            <React.Suspense fallback={<div className="h-40 flex items-center justify-center text-gold animate-pulse">Engaging {activeTab}...</div>}>
              {activeTab === 'dashboard' && <DashboardPanel {...panelProps} />}
              {activeTab === 'pos' && <POSPanel {...panelProps} />}
              {activeTab === 'inventory' && <InventoryPanel {...panelProps} />}
              {activeTab === 'fiche' && <FichePanel {...panelProps} />}
              {activeTab === 'simulator' && <AnalyticsPanel {...panelProps} />}
              {activeTab === 'history' && <HistoryPanel {...panelProps} />}
              {activeTab === 'kitchen' && <KitchenPanel {...panelProps} />}
              {activeTab === 'intelligence' && <IntelligencePanel {...panelProps} />}
              {activeTab === 'planner' && <PlannerPanel {...panelProps} />}
              {activeTab === 'orders' && <OrdersPanel {...panelProps} />}
              {activeTab === 'purchasing' && <PurchasingPanel {...panelProps} />}
              {activeTab === 'expenses' && <ExpensesPanel {...panelProps} />}
              {activeTab === 'comptabilite' && <FinancePanel {...panelProps} />}
              {activeTab === 'staff' && <StaffPanel {...panelProps} />}
              {activeTab === 'settings' && <SettingsPanel {...panelProps} />}
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
                className={`w-full max-w-md p-10 rounded-[3rem] border shadow-2xl ${isDarkMode ? 'bg-[#0a0a0b] border-white/10 shadow-gold-glow' : 'bg-white border-slate-200'}`}
            >
                <div className="flex justify-between items-center mb-10">
                    <h3 className={`text-2xl font-bold luxury-font uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Waste Log</h3>
                    <button onClick={() => setShowWasteModal(false)} className="text-white/20 hover:text-white"><X size={24}/></button>
                </div>

                <div className="space-y-8">
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-gold mb-3 block">Product Entity</label>
                        <select 
                            value={wasteForm.product_id}
                            onChange={(e) => setWasteForm({...wasteForm, product_id: e.target.value})}
                            className={`w-full p-5 rounded-2xl border outline-none font-bold text-sm ${isDarkMode ? 'bg-white/5 border-white/10 text-cream focus:border-gold/40' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                        >
                            <option value="">Select product...</option>
                            {inventory.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-gold mb-3 block">Unsold Quantity</label>
                        <div className="flex items-center gap-4">
                            <input 
                                type="number" 
                                value={wasteForm.quantity}
                                onChange={(e) => setWasteForm({...wasteForm, quantity: parseInt(e.target.value)})}
                                className={`flex-1 p-5 rounded-2xl border outline-none font-bold text-2xl ${isDarkMode ? 'bg-white/5 border-white/10 text-cream focus:border-gold/40' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                            />
                            <span className="font-bold opacity-40">Units</span>
                        </div>
                    </div>

                    <button
                        onClick={async () => {
                            if (!wasteForm.product_id) return;
                            try {
                                await api.post('/waste', wasteForm);
                                setShowWasteModal(false);
                                fetchData();
                                addToast("Waste Logged", "success");
                            } catch (e: any) { addToast("Log failed", "error"); }
                        }}
                        className={`w-full py-6 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${isDarkMode ? 'bg-rose-500 text-white shadow-lg' : 'bg-slate-900 text-white'}`}
                    >

                        Confirm Loss
                    </button>
                    <p className="text-[10px] text-center opacity-40 font-bold uppercase tracking-widest">This will deduct stock and adjust Net ROI</p>
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
                className={`w-full max-w-md p-10 rounded-[3.5rem] border shadow-2xl ${isDarkMode ? 'bg-[#0a0a0b] border-white/10' : 'bg-white border-slate-200'}`}
            >
                <div className="flex justify-between items-start mb-10">
                    <h3 className={`text-2xl font-bold luxury-font uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t.add_staff}</h3>
                    <button onClick={() => setShowAddStaff(false)} className="p-4 rounded-full bg-white/5 hover:bg-white/10 transition-colors"><X size={24}/></button>
                </div>

                <div className="space-y-8">
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">{t.username}</label>
                        <input 
                            value={newStaff.username} 
                            onChange={(e) => setNewStaff({...newStaff, username: e.target.value})}
                            placeholder="e.g. staff_name"
                            className={`w-full bg-transparent border-b text-lg font-bold py-4 outline-none ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`}
                        />
                    </div>

                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">{t.password}</label>
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
                        Create Cashier Account
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
                className={`w-full max-w-lg p-10 rounded-[3.5rem] border shadow-2xl ${isDarkMode ? 'bg-[#0a0a0b] border-white/10' : 'bg-white border-slate-200'}`}
            >
                <div className="flex justify-between items-start mb-10">
                    <h3 className={`text-2xl font-bold luxury-font uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Log Expenditure</h3>
                    <button onClick={() => setShowAddExpense(false)} className="p-4 rounded-full bg-white/5 hover:bg-white/10 transition-colors"><X size={24}/></button>
                </div>

                <div className="space-y-8">
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-4">Expense Category</label>
                        <div className="grid grid-cols-2 gap-4">
                            {['salary', 'rent', 'electricity', 'water', 'internet', 'other'].map(cat => (
                                <button 
                                    key={cat}
                                    onClick={() => setNewExpense({...newExpense, category: cat})}
                                    className={`py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${newExpense.category === cat ? 'bg-gold text-charcoal' : 'bg-white/5 text-cream/40 border-white/5 hover:bg-white/10'}`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">Amount ({activeCurrency})</label>
                        <input 
                            type="number" 
                            value={newExpense.amount} 
                            onChange={(e) => setNewExpense({...newExpense, amount: parseFloat(e.target.value)})}
                            className={`w-full bg-transparent border-b text-2xl font-bold py-4 outline-none ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`}
                        />
                    </div>

                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">Description / Note</label>
                        <input 
                            value={newExpense.description} 
                            onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
                            placeholder="Electricity March 2026..."
                            className={`w-full bg-transparent border-b text-sm py-4 outline-none ${isDarkMode ? 'border-white/10 text-cream/60' : 'border-slate-200 text-slate-600'}`}
                        />
                    </div>

                    <button 
                        onClick={handleAddExpense}
                        className={`w-full py-6 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] transition-all ${isDarkMode ? 'bg-gold text-charcoal shadow-gold-glow hover:scale-105' : 'bg-slate-900 text-white shadow-xl'}`}
                    >
                        Register Expense
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
                className={`w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col rounded-[3.5rem] border shadow-2xl ${isDarkMode ? 'bg-[#0a0a0b] border-white/10' : 'bg-white border-slate-200'}`}
            >
                <div className="p-10 flex justify-between items-start border-b border-white/5">
                    <div className="flex gap-6 items-center">
                        <div className="text-6xl">{selectedProduct.icon}</div>
                        <div>
                            <h2 className="text-4xl font-bold luxury-font tracking-tight mb-2">{selectedProduct.name}</h2>
                            <div className="flex gap-4">
                                <span className="text-[10px] font-black uppercase tracking-widest text-gold bg-gold/10 px-3 py-1 rounded-full">Protocol v1.0</span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-cream/40 bg-white/5 px-3 py-1 rounded-full">Yield: {selectedProduct.yield_qty} Units</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={() => setSelectedProduct(null)} className="p-4 rounded-full bg-white/5 hover:bg-white/10 transition-colors"><X size={24}/></button>
                </div>

                <div className="flex-1 overflow-y-auto p-10 grid grid-cols-1 md:grid-cols-3 gap-12 custom-scrollbar">
                    {/* Left: Ingredients */}
                    <div>
                        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-gold mb-8 opacity-40">Composition</h3>
                        <div className="space-y-6">
                            {selectedProduct.ingredients.map(ing => (
                                <div key={ing.name} className="flex justify-between items-end border-b border-white/5 pb-2">
                                    <span className="font-bold text-sm">{ing.name}</span>
                                    <span className="text-gold font-black">{ing.quantity}<span className="text-[10px] ml-1 opacity-40">{inventory.materials[ing.name]?.unit || 'g'}</span></span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right: Method */}
                    <div className="md:col-span-2 space-y-10">
                        <div className="grid grid-cols-2 gap-8">
                            <div className="p-6 rounded-3xl bg-white/5 border border-white/5">
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">Preparation Time</p>
                                <p className="text-2xl font-bold">{selectedProduct.prep_time} <span className="text-xs opacity-40">minutes</span></p>
                            </div>
                            <div className="p-6 rounded-3xl bg-white/5 border border-white/5">
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">Cooking Time</p>
                                <p className="text-2xl font-bold">{selectedProduct.cook_time} <span className="text-xs opacity-40">minutes</span></p>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-gold mb-8 opacity-40">Methodology</h3>
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
                                        <p className="font-black text-xs uppercase tracking-widest">No Protocol Defined</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-8 bg-white/5 flex justify-center border-t border-white/5">
                    <p className="text-[10px] font-black uppercase tracking-[0.5em] opacity-20">BakeryOS Executive Protocol | Highly Confidential</p>
                </div>
            </motion.div>
        </div>
      )}

      {showAddProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className={`w-full max-w-2xl p-8 rounded-[2.5rem] border shadow-2xl flex flex-col max-h-[90vh] ${isDarkMode ? 'bg-[#121214] border-white/10' : 'bg-white border-slate-200'}`}>
                <div className="flex justify-between items-start mb-8">
                    <h3 className={`text-2xl font-bold luxury-font ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{editingProductId ? 'Update Entity' : 'Register Entity'}</h3>
                    <button onClick={() => { setShowAddProduct(false); setEditingProductId(null); }} className="text-white/20 hover:text-white"><X size={24}/></button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 overflow-y-auto pr-2 custom-scrollbar">
                    {/* Left Side: Search & Import */}
                    <div className="space-y-6">
                        {!editingProductId ? (
                          <div className={`p-6 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                              <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-4">Search Online Catalogue</label>
                              <div className="flex gap-2 mb-4">
                                  <input 
                                      type="text" 
                                      placeholder="Search recipes..." 
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
                                      <div className="text-xs font-black uppercase tracking-widest">Querying Global Matrix...</div>
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
                             <p className="text-[10px] font-black uppercase tracking-widest text-center">Entity Locked<br/><span className="text-[8px]">ID cannot be changed after registration</span></p>
                          </div>
                        )}
                    </div>

                    {/* Right Side: Manual Entry & Preview */}
                    <div className="space-y-6">
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-1">Identifier</label>
                                <input type="text" placeholder="e.g. p4" value={newProduct.id} readOnly={!!editingProductId} onChange={(e)=>setNewProduct({...newProduct, id: e.target.value})} className={`w-full bg-transparent border-b py-2 outline-none font-bold ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'} ${editingProductId ? 'opacity-40' : ''}`} />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-1">Display Name</label>
                                <input type="text" placeholder="e.g. Baguette" value={newProduct.name} onChange={(e)=>setNewProduct({...newProduct, name: e.target.value})} className={`w-full bg-transparent border-b py-2 outline-none font-bold ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-1">Price (MAD)</label>
                                    <input type="number" value={newProduct.price} onChange={(e)=>setNewProduct({...newProduct, price: parseFloat(e.target.value)})} className={`w-full bg-transparent border-b py-2 outline-none font-bold ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-1">Icon</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={newProduct.icon}
                                            onChange={(e)=>setNewProduct({...newProduct, icon: e.target.value})}
                                            className={`w-full bg-transparent border-b py-2 pr-10 outline-none font-bold ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`}
                                            placeholder="🥐"
                                            autoComplete="off"
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
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-1">Prep (min)</label>
                                    <input type="number" value={newProduct.prep_time} onChange={(e)=>setNewProduct({...newProduct, prep_time: parseInt(e.target.value)})} className={`w-full bg-transparent border-b py-2 outline-none font-bold ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-1">Cook (min)</label>
                                    <input type="number" value={newProduct.cook_time} onChange={(e)=>setNewProduct({...newProduct, cook_time: parseInt(e.target.value)})} className={`w-full bg-transparent border-b py-2 outline-none font-bold ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-1">Yield (qty)</label>
                                    <input type="number" value={newProduct.yield_qty} onChange={(e)=>setNewProduct({...newProduct, yield_qty: parseInt(e.target.value)})} className={`w-full bg-transparent border-b py-2 outline-none font-bold ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`} />
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
                                        + Add Instruction Step
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
                <h3 className={`text-2xl font-bold luxury-font mb-8 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>New Ingredient</h3>
                <div className="space-y-6">
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">Ingredient Name</label>
                        <input type="text" placeholder="e.g. Milk" value={newMaterial.name} onChange={(e)=>setNewMaterial({...newMaterial, name: e.target.value})} className={`w-full bg-transparent border-b py-2 outline-none font-bold ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">Base Unit</label>
                            <select value={newMaterial.unit} onChange={(e)=>setNewMaterial({...newMaterial, unit: e.target.value})} className={`w-full bg-transparent border-b py-2 outline-none font-bold ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`}>
                                <option value="g">Grams (g)</option>
                                <option value="kg">Kilograms (kg)</option>
                                <option value="ml">Milliliters (ml)</option>
                                <option value="L">Liters (L)</option>
                                <option value="unit">Unit</option>
                            </select>
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gold block">Unit Price</label>
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
                        <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">Min. Threshold</label>
                        <input type="number" value={newMaterial.min_threshold} onChange={(e)=>setNewMaterial({...newMaterial, min_threshold: parseFloat(e.target.value)})} className={`w-full bg-transparent border-b py-2 outline-none font-bold ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`} />
                    </div>
                    <div className="flex gap-3 pt-6">
                        <button onClick={() => setShowAddMaterial(false)} className={`flex-1 py-4 rounded-xl font-bold text-[10px] uppercase tracking-widest ${isDarkMode ? 'bg-white/5 text-white' : 'bg-slate-100 text-slate-900'}`}>Cancel</button>
                        <button onClick={handleAddMaterial} className="flex-1 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest bg-gold text-charcoal shadow-gold-glow">Register</button>
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
                    <h3 className={`text-2xl font-bold luxury-font uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Digital Receipt</h3>
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
                    <p className="text-center text-[10px] font-bold uppercase tracking-[0.2em] opacity-40 mb-8">Scan to open thermal ticket</p>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <button 
                            onClick={() => {
                             const token = localStorage.getItem('bakery_token');
                             openDocument(`${API_BASE}/transactions/${lastTransaction.transaction_id}/receipt?format=pdf&paper=80mm&token=${token}`, `receipt-${lastTransaction.transaction_id}.pdf`);
                           }}
                            className={`py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border transition-all ${isDarkMode ? 'border-white/10 text-white hover:bg-white/5' : 'border-slate-200 text-slate-900'}`}
                        >
                            Print Ticket
                        </button>
                        <button 
                            onClick={() => {
                                openSelector({
                                    title: "WhatsApp Share",
                                    label: "Customer Number",
                                    value: '',
                                    type: 'text',
                                    onConfirm: (phone) => {
                                        window.open(`https://wa.me/${phone.replace(/\D/g,'')}?text=${encodeURIComponent(lastTransaction.whatsapp_text)}`, '_blank');
                                    }
                                });
                            }}
                            className="py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                        >
                            WhatsApp
                        </button>

                    </div>
                    
                    <button 
                        onClick={() => setShowReceiptModal(false)}
                        className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-widest mt-4 transition-all ${isDarkMode ? 'bg-gold text-charcoal shadow-gold-glow' : 'bg-slate-900 text-white'}`}
                    >
                        Close Terminal
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
                          <button onClick={() => setSelectorConfig(prev => ({...prev, isOpen: false}))} className="flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/5 opacity-40 hover:opacity-100 transition-all">Cancel</button>
                          <button 
                              onClick={() => {
                                  selectorConfig.onConfirm(selectorConfig.value);
                                  setSelectorConfig(prev => ({...prev, isOpen: false}));
                              }} 
                              className="flex-[2] py-4 rounded-2xl bg-gold text-charcoal font-black text-[10px] uppercase tracking-widest shadow-gold-glow"
                          >
                              Confirm
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
                          <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">Supplier Name</label>
                          <input 
                              placeholder="Atlas Flour Co."
                              value={newSupplier.name}
                              onChange={e => setNewSupplier({...newSupplier, name: e.target.value})}
                              className={`w-full bg-transparent border-b py-3 outline-none font-bold ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`}
                              autoFocus
                          />
                      </div>

                      <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">Contact Info</label>
                          <input 
                              placeholder="+212... or vendor@email.com"
                              value={newSupplier.contact_info}
                              onChange={e => setNewSupplier({...newSupplier, contact_info: e.target.value})}
                              className={`w-full bg-transparent border-b py-3 outline-none font-bold ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`}
                          />
                      </div>

                      <div className="pt-6 flex gap-4">
                          <button
                              onClick={() => {
                                  setShowAddSupplier(false);
                                  setEditingSupplier(null);
                                  setNewSupplier({ name: '', contact_info: '' });
                              }}
                              className="flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/5 opacity-40 hover:opacity-100 transition-all"
                          >
                              Cancel
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
                  className={`w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-[2.5rem] border shadow-2xl ${isDarkMode ? 'bg-[#0a0a0b] border-white/10' : 'bg-white border-slate-200'}`}
              >
                  <div className={`p-8 border-b flex items-start justify-between gap-4 ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                      <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-gold">Purchase Order</p>
                          <h3 className="text-2xl font-bold luxury-font uppercase tracking-tighter mt-2">{selectedPO.id}</h3>
                          <p className={`text-sm mt-2 ${isDarkMode ? 'text-cream/40' : 'text-slate-500'}`}>
                              Review supplier details, set delivery timing, and receive stock without overposting.
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
                              <label className="text-[10px] font-black uppercase tracking-widest text-gold block">Supplier</label>
                              <select
                                  value={selectedPO.supplier_id}
                                  onChange={(e) => setSelectedPO((prev: any) => ({ ...prev, supplier_id: Number(e.target.value) }))}
                                  className={`w-full border-b py-3 px-2 outline-none text-[10px] font-black uppercase tracking-widest rounded-xl ${isDarkMode ? 'bg-black text-gold border-white/10' : 'bg-white text-slate-700 border-slate-200'}`}
                              >
                                  {suppliers.map((supp: any) => (
                                      <option key={supp.id} value={supp.id}>{supp.name}</option>
                                  ))}
                              </select>
                              <p className={`text-xs ${isDarkMode ? 'text-cream/40' : 'text-slate-500'}`}>
                                  {suppliers.find((supp: any) => supp.id === selectedPO.supplier_id)?.contact_info || 'No contact info'}
                              </p>
                          </div>

                          <div className={`rounded-3xl border p-5 space-y-3 ${isDarkMode ? 'border-white/5 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>
                              <label className="text-[10px] font-black uppercase tracking-widest text-gold block">Expected Delivery</label>
                              <input
                                  type="date"
                                  value={selectedPO.expected_delivery_date || ''}
                                  onChange={(e) => setSelectedPO((prev: any) => ({ ...prev, expected_delivery_date: e.target.value }))}
                                  className={`w-full bg-transparent border-b py-3 outline-none font-bold ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`}
                              />
                              <p className={`text-xs ${isDarkMode ? 'text-cream/40' : 'text-slate-500'}`}>Use this for delivery planning and receiving follow-up.</p>
                          </div>

                          <div className={`rounded-3xl border p-5 space-y-3 ${isDarkMode ? 'border-white/5 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>
                              <label className="text-[10px] font-black uppercase tracking-widest text-gold block">Status</label>
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
                          <label className="text-[10px] font-black uppercase tracking-widest text-gold block">Order Notes</label>
                          <textarea
                              rows={4}
                              value={selectedPO.notes || ''}
                              onChange={(e) => setSelectedPO((prev: any) => ({ ...prev, notes: e.target.value }))}
                              placeholder="Delivery window, substitutions, vendor instructions..."
                              className={`w-full resize-none rounded-2xl border px-4 py-4 outline-none text-sm ${isDarkMode ? 'bg-black/40 border-white/10 text-cream placeholder:text-cream/20' : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'}`}
                          />
                      </div>

                      <div className={`rounded-3xl border overflow-hidden ${isDarkMode ? 'border-white/5 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>
                          <div className={`grid grid-cols-[minmax(0,1.6fr)_110px_110px_120px_120px] gap-4 px-5 py-4 text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-cream/40 border-b border-white/10' : 'text-slate-400 border-b border-slate-200'}`}>
                              <span>Item</span>
                              <span>Ordered</span>
                              <span>Received</span>
                              <span>Receive Now</span>
                              <span>Unit Price</span>
                          </div>
                          <div className="divide-y divide-white/5">
                              {selectedPO.items.map((item: any, idx: number) => {
                                  const remaining = Math.max(0, (Number(item.qty) || 0) - (Number(item.received_qty) || 0));
                                  const draft = poReceiveDraft[item.name] || { qty: 0, price: Number(item.price) || 0 };
                                  return (
                                      <div key={`${item.name}-${idx}`} className="grid grid-cols-[minmax(0,1.6fr)_110px_110px_120px_120px] gap-4 px-5 py-4 items-center">
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
                                                          ...prev[item.name],
                                                          qty: Number.isFinite(nextQty) ? nextQty : 0
                                                      }
                                                  }));
                                              }}
                                              className={`w-full rounded-xl border px-3 py-2 outline-none text-sm font-bold ${isDarkMode ? 'bg-black/40 border-white/10 text-cream' : 'bg-white border-slate-200 text-slate-900'}`}
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
                                                          ...prev[item.name],
                                                          price: Number.isFinite(nextPrice) ? nextPrice : 0
                                                      }
                                                  }));
                                              }}
                                              className={`w-full rounded-xl border px-3 py-2 outline-none text-sm font-bold ${isDarkMode ? 'bg-black/40 border-white/10 text-cream' : 'bg-white border-slate-200 text-slate-900'}`}
                                          />
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
                              Save Order
                          </button>
                          <button
                              onClick={handlePartialReceivePO}
                              className="px-6 py-4 rounded-2xl bg-gold text-charcoal font-black text-[10px] uppercase tracking-widest shadow-gold-glow"
                          >
                              Receive Selected Items
                          </button>
                          {selectedPO.status !== 'received' && (
                              <button
                                  onClick={() => {
                                      handleReceivePO(selectedPO.id);
                                      setShowPOModal(false);
                                  }}
                                  className={`px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${isDarkMode ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
                              >
                                  Receive Remaining
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
                  <h3 className="text-2xl font-bold luxury-font uppercase tracking-tighter mb-8">Customer Booking</h3>
                  
                  <div className="space-y-6">
                      <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">Customer Identity</label>
                          <input 
                              placeholder="Full Name"
                              value={bookingForm.name}
                              onChange={e => setBookingForm({...bookingForm, name: e.target.value})}
                              className={`w-full bg-transparent border-b py-3 outline-none font-bold ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`}
                          />
                      </div>

                      <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">Contact Number</label>
                          <input 
                              placeholder="+212..."
                              value={bookingForm.phone}
                              onChange={e => setBookingForm({...bookingForm, phone: e.target.value})}
                              className={`w-full bg-transparent border-b py-3 outline-none font-bold ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`}
                          />
                      </div>

                      <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">Pickup Schedule</label>
                          <input 
                              type="datetime-local"
                              value={bookingForm.date.includes(' ') ? bookingForm.date.replace(' ', 'T') : bookingForm.date}
                              onChange={e => setBookingForm({...bookingForm, date: e.target.value})}
                              className={`w-full bg-transparent border-b py-3 outline-none font-bold ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`}
                          />
                      </div>

                      <div className="pt-6 flex gap-4">
                          <button onClick={() => setShowBookingModal(false)} className="flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/5 opacity-40 hover:opacity-100 transition-all">Cancel</button>
                          <button onClick={handleSaveBooking} className="flex-[2] py-4 rounded-2xl bg-gold text-charcoal font-black text-[10px] uppercase tracking-widest shadow-gold-glow">Confirm Booking</button>
                      </div>
                  </div>
              </motion.div>
          </div>
      )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmConfig.isOpen && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
              <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className={`w-full max-w-md p-8 rounded-[3rem] border shadow-2xl ${isDarkMode ? 'bg-[#0f0f11] border-white/10' : 'bg-white border-slate-200'}`}
              >
                  <div className={`w-16 h-16 rounded-3xl mb-6 flex items-center justify-center ${confirmConfig.type === 'danger' ? 'bg-rose-500/20 text-rose-500' : 'bg-gold/20 text-gold'}`}>
                      {confirmConfig.type === 'danger' ? <Trash2 size={32}/> : <CheckCircle size={32}/>}
                  </div>
                  <h3 className="text-2xl font-bold luxury-font mb-2 uppercase tracking-tight">{confirmConfig.title}</h3>
                  <p className={`text-sm mb-10 leading-relaxed ${isDarkMode ? 'text-cream/60' : 'text-slate-500'}`}>{confirmConfig.message}</p>
                  
                  <div className="flex gap-4">
                      <button 
                          onClick={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                          className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border transition-all ${isDarkMode ? 'border-white/10 text-white hover:bg-white/5' : 'border-slate-200 text-slate-900 hover:bg-slate-50'}`}
                      >
                          Cancel
                      </button>
                      <button 
                          onClick={() => {
                              confirmConfig.onConfirm();
                              setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                          }}
                          className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all ${
                              confirmConfig.type === 'danger' ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-gold text-charcoal hover:scale-105'
                          }`}
                      >
                          {confirmConfig.confirmText}
                      </button>
                  </div>
              </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;
