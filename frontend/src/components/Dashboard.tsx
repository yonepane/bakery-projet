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
  ChefHat
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { api, processSyncQueue } from '../lib/api';
import http from '../lib/http';
import { Language, translations } from '../lib/translations';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';

// Google uses this client ID when the user signs in with Google.
const GOOGLE_CLIENT_ID = "183197193874-qhf5nd87o77oo86jhksat53ncq3ahjp8.apps.googleusercontent.com";

// These TypeScript interfaces describe the data shape used by the dashboard.
// They mostly match what the backend sends us.
interface Ingredient {
  stock: number;
  min_threshold: number;
  unit: string;
  price: number;
}

interface Product {
  id: string;
  name: string;
  stock: number;
  price: number;
  icon?: string;
  live_cost?: number;
  prep_time: number;
  cook_time: number;
  yield_qty: number;
  instructions: string[];
  ingredients: { name: string; quantity: number }[];
}

interface Alert {
  type: 'stock' | 'margin';
  severity: 'high' | 'medium';
  message: string;
  id: string;
}

interface CartItem extends Product {
  qty: number;
}

interface Transaction {
  id: string;
  timestamp: string;
  type: 'sale' | 'production';
  items?: { name: string; qty: number; price: number }[];
  revenue: number;
  cost: number;
  profit?: number;
  product?: string;
  quantity?: number;
}

interface PlanItem {
  id: string;
  date: string;
  product_id: string;
  quantity: number;
  status: 'pending' | 'completed';
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ConfirmConfig {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  type: 'danger' | 'info';
  confirmText: string;
}

const PRODUCT_ICON_CHOICES = [
  '🥐', '🍞', '🥖', '🧁', '🍰', '🎂',
  '🍪', '🥨', '🥯', '🧇', '🍩', '🥞',
  '🍫', '🍮', '🥧', '🍯'
];

const Dashboard: React.FC = () => {
  const API_BASE = '/api';
  // Login state and current user information.
  const [user, setUser] = useState<{username: string, role: string} | null>(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  
  // UI state for navigation and language.
  const [activeTab, setActiveTab] = useState('dashboard');
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('bakery_lang');
    return (saved === 'en' || saved === 'fr' || saved === 'ar') ? saved : 'en';
  });
  const t = translations[lang] || translations.en;
  const isRTL = lang === 'ar';
  
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isOperationsOpen, setIsOperationsOpen] = useState(false);

  // State used by the booking modal.
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingForm, setBookingForm] = useState({
      name: '',
      phone: '',
      date: new Date(Date.now() + 86400000).toISOString().slice(0, 16).replace('T', ' '),
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
  const [alerts, setAlerts] = useState<Alert[]>([]);
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
    const id = Math.random().toString(36).substr(2, 9);
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
    // Save the owner's operations note inside the settings store.
    setIsSavingGeneralNote(true);
    try {
      await http.patch('/settings', {
        updates: {
          operations_note: generalNote
        }
      });
      setSettings((prev: any) => ({ ...prev, operations_note: generalNote }));
      addToast("Operations note saved", "success");
    } catch (e: any) {
      addToast("Failed to save operations note", "error");
    } finally {
      setIsSavingGeneralNote(false);
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

  const formatPrice = (amount: number) => {
    // Prices are stored in the base currency. Conversion here is only for display.
    const rate = settings?.conversions?.[activeCurrency] || 1;
    return (amount * rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + activeCurrency;
  };

  const displayUnit = (value: number, unit: string) => {
    // Show large gram or milliliter values as kilograms or liters when that is easier to read.
    if (unit === 'g' && value >= 1000) return (value / 1000).toFixed(2) + ' kg';
    if (unit === 'ml' && value >= 1000) return (value / 1000).toFixed(2) + ' L';
    return value.toFixed(0) + ' ' + unit;
  };

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
      const [invData, anaData, aleData, histData, planData, settData, ordData, purData, suppData, posData, expData, staffData, profData, wasteData] = await Promise.all([
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
        isOwner ? safeGet('/waste', []) : Promise.resolve([])
      ]);
      
      console.log("Data sync completed");
      if (invData) setInventory(invData);
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
      if (posData) setPurchaseOrders(posData);
      if (expData) setExpenses(expData);
      if (staffData) setStaff(staffData);
      if (profData) setProfitReport(profData);
      if (wasteData) setWasteRecords(wasteData);
      
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
    try {
      const res = await http.post('/auth/login', loginForm);
      const { access_token, username, role } = res.data;
      localStorage.setItem('bakery_token', access_token);
      localStorage.setItem('bakery_user', JSON.stringify({ username, role }));
      setUser({ username, role });
    } catch (err) {
      addToast("Invalid credentials", 'error');
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

  if (!user) {
    return (
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <div className={`login-shell min-h-screen flex items-center justify-center px-6 ${isDarkMode ? 'text-white' : 'bg-slate-50 text-slate-900'}`}>
          <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`login-card p-12 rounded-[3rem] w-full max-w-md ${isDarkMode ? 'shadow-gold-glow' : 'bg-white border-slate-200 shadow-2xl'}`}
          >
            <div className="relative text-center mb-10">
              <div className="login-badge mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[2rem] border border-gold/25 bg-gold/10 text-4xl text-gold">🥐</div>
              <div className="login-title-wrap">
                <h1 className="text-4xl font-bold luxury-font tracking-tighter uppercase mb-3">
                  <span className="text-white">Bakery</span>
                  <span className="text-gold">OS</span>
                </h1>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-cream/40">BETA 0.1</p>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gold/65 mb-2 block">Operator ID</label>
                <input
                  type="text"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                  className={`login-input w-full font-bold ${isDarkMode ? 'login-input--dark' : ''}`}
                  placeholder="Username"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gold/65 mb-2 block">Secure Key</label>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                  className={`login-input w-full font-bold ${isDarkMode ? 'login-input--dark' : ''}`}
                  placeholder="••••••••"
                />
              </div>
              <button className={`login-gold-button w-full py-5 rounded-2xl font-black text-xs uppercase tracking-[0.24em] ${isDarkMode ? '' : 'bg-slate-900 text-white shadow-xl'}`}>
                Access Terminal
              </button>
            </form>

            <div className="mt-8 flex flex-col items-center gap-6">
              <div className="flex items-center w-full gap-4 text-gold/30">
                <div className="h-px bg-gold/20 flex-1" />
                <span className="text-[8px] font-bold uppercase tracking-widest">Or Secure Login</span>
                <div className="h-px bg-gold/20 flex-1" />
              </div>

              <div className="w-full flex justify-center">
                <GoogleLogin 
                  onSuccess={handleGoogleSuccess}
                  onError={() => addToast("Login Interrupted", "error")}
                  theme={isDarkMode ? 'filled_black' : 'outline'}
                  shape="pill"
                />
              </div>
            </div>
          </motion.div>
        </div>
      </GoogleOAuthProvider>
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

  const handleAddProduct = async () => {
    if (!newProduct.id.trim() || !newProduct.name.trim()) {
      addToast("ID and Name are required", "error");
      return;
    }
    try {
      const data = await api.post('/products', newProduct);
      addToast(data.message || "Product Created", 'success');
      setShowAddProduct(false);
      setShowProductIconPicker(false);
      fetchData();
      // Clear the form after a successful save.
      setNewProduct({ id: '', name: '', price: 0, icon: '🥐', ingredients: [] });
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
  const isWithinAccountingRange = (value?: string) => {
    // Used by the accounting screen to filter rows by date range.
    if (!value) return false;
    const date = new Date(value);
    const start = new Date(`${accountingRange.start}T00:00:00`);
    const end = new Date(`${accountingRange.end}T23:59:59`);
    return date >= start && date <= end;
  };

  const filteredSales = history.filter(tx => tx.type === 'sale' && isWithinAccountingRange(tx.timestamp));
  const filteredExpenses = expenses.filter((exp: any) => isWithinAccountingRange(exp.date));
  const filteredPurchaseOrders = purchaseOrders.filter((po: any) => isWithinAccountingRange(po.date));
  const filteredWaste = wasteRecords.filter((record: any) => isWithinAccountingRange(record.date));

  const monthlySales = filteredSales
    .reduce((sum, tx) => sum + (tx.revenue || 0), 0);
  const monthlyExpensesTotal = filteredExpenses
    .reduce((sum: number, exp: any) => sum + (Number(exp.amount) || 0), 0);
  const draftPurchaseCommitment = filteredPurchaseOrders
    .filter((po: any) => po.status !== 'received')
    .reduce((sum: number, po: any) => sum + po.items.reduce((poSum: number, item: any) => poSum + ((Number(item.qty) || 0) * (Number(item.price) || 0)), 0), 0);
  const monthlyNetAfterExpenses = monthlySales - monthlyExpensesTotal;
  const expenseBreakdown = Object.entries(
    filteredExpenses
      .reduce((acc: Record<string, number>, exp: any) => {
        const key = exp.category || 'other';
        acc[key] = (acc[key] || 0) + (Number(exp.amount) || 0);
        return acc;
      }, {})
  )
    .sort((a, b) => b[1] - a[1]);
  const accountingFeed = [
    ...filteredExpenses.map((exp: any) => ({
      id: `expense-${exp.id}`,
      type: 'expense',
      date: exp.date,
      label: exp.description || exp.category,
      meta: exp.category,
      amount: Number(exp.amount) || 0,
    })),
    ...filteredPurchaseOrders.map((po: any) => ({
      id: `po-${po.id}`,
      type: 'purchase_order',
      date: po.date,
      label: suppliers.find(supp => supp.id === po.supplier_id)?.name || `Supplier #${po.supplier_id}`,
      meta: `${po.items.length} lines`,
      amount: po.items.reduce((sum: number, item: any) => sum + ((Number(item.qty) || 0) * (Number(item.price) || 0)), 0),
      status: po.status,
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);
  const productProfitability = Object.values(
    filteredSales.reduce((acc: Record<string, any>, tx) => {
      (tx.items || []).forEach((item: any) => {
        const key = item.name || 'Unknown';
        if (!acc[key]) {
          acc[key] = { name: key, qty: 0, revenue: 0, cost: 0, profit: 0 };
        }
        const qty = Number(item.qty) || 0;
        const price = Number(item.price) || 0;
        const unitCost = Number(item.cost) || 0;
        acc[key].qty += qty;
        acc[key].revenue += qty * price;
        acc[key].cost += qty * unitCost;
        acc[key].profit = acc[key].revenue - acc[key].cost;
      });
      return acc;
    }, {})
  ).sort((a: any, b: any) => b.profit - a.profit).slice(0, 6);
  const wasteByProduct = Object.values(
    filteredWaste.reduce((acc: Record<string, any>, record: any) => {
      const key = record.product_name || 'Unknown';
      if (!acc[key]) {
        acc[key] = { name: key, qty: 0, loss: 0 };
      }
      acc[key].qty += Number(record.quantity) || 0;
      acc[key].loss += Number(record.loss_cost) || 0;
      return acc;
    }, {})
  ).sort((a: any, b: any) => b.loss - a.loss).slice(0, 6);
  const sortedMaterialEntries = Object.entries(inventory.materials).sort(([nameA], [nameB]) =>
    nameA.localeCompare(nameB)
  );
  const sortedMaterialNames = sortedMaterialEntries.map(([name]) => name);

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
        className={`fixed h-full z-50 flex flex-col border-r overflow-y-auto overflow-x-hidden custom-scrollbar transition-colors duration-500 ${isDarkMode ? 'bg-[#0f0f11] border-white/5' : 'bg-white border-slate-200 shadow-xl'}`}
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
        animate={{ marginLeft: isSidebarCollapsed ? 80 : 288 }}
        className={`flex-1 p-10 transition-colors duration-500 ${isDarkMode ? 'bg-[#0a0a0b]' : 'bg-[#f8f9fa]'}`}
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
            <div className={`px-6 py-3 flex items-center gap-4 border rounded-2xl ${isDarkMode ? 'border-white/10 bg-black/20' : 'border-slate-200 bg-white shadow-sm'}`}>
              <div className="text-right">
                <p className={`text-[10px] uppercase tracking-widest font-black ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>{isOnline ? t.online : t.offline}</p>
                <p className={`text-xs font-bold ${isOnline ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {isOnline ? t.sync_active : t.offline_mode}
                </p>
              </div>
              <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)] animate-pulse'}`} />
            </div>

            {user?.role === 'owner' && (
              <div className={`px-5 py-3 flex items-start gap-3 border rounded-2xl ${isDarkMode ? 'border-gold/10 bg-black/20' : 'border-slate-200 bg-white shadow-sm'}`}>
                <div className="text-right">
                  <p className={`text-[10px] uppercase tracking-widest font-black ${isDarkMode ? 'text-gold' : 'text-slate-500'}`}>Master Control</p>
                  <p className={`text-xs font-bold ${editMode ? 'text-gold' : isDarkMode ? 'text-cream/40' : 'text-slate-500'}`}>
                    {editMode ? 'Active' : 'Standby'}
                  </p>
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

            <div className={`px-6 py-3 flex items-center gap-4 border rounded-2xl ${isDarkMode ? 'border-gold/10 bg-black/20' : 'border-slate-200 bg-white shadow-sm'}`}>
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
            {activeTab === 'dashboard' && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                  {[
                    { label: 'Total Revenue', value: formatPrice(analytics.revenue), color: isDarkMode ? 'text-cream' : 'text-slate-900' },
                    { label: 'Total Cost', value: formatPrice(analytics.cost), color: 'text-rose-500' },
                    { label: 'Net Profit & ROI', value: `${formatPrice(analytics.revenue - analytics.cost)} (${analytics.revenue > 0 ? (((analytics.revenue - analytics.cost) / analytics.revenue) * 100).toFixed(1) : 0}%)`, color: analytics.revenue > analytics.cost ? 'text-emerald-500' : 'text-rose-500' },
                    { label: 'BOM Entities', value: inventory.products.length, color: isDarkMode ? 'text-gold' : 'text-slate-900' }
                  ].map((stat, i) => (
                    <div key={i} className={`p-6 rounded-[2rem] border transition-colors ${isDarkMode ? 'border-white/5 bg-black/20' : 'border-slate-200 bg-white shadow-sm'}`}>
                      <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>{stat.label}</p>
                      <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className={`lg:col-span-2 p-8 rounded-[2.5rem] border min-h-[400px] transition-colors ${isDarkMode ? 'border-gold/20 bg-black/20 gold-border-glow' : 'border-slate-200 bg-white shadow-lg'}`}>
                    <h3 className={`text-xl font-bold luxury-font uppercase mb-8 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Market Performance</h3>
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={analytics.chartData}>
                          <defs>
                            <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="#D4AF37" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.05)"} />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: isDarkMode ? 'rgba(245,245,220,0.3)' : 'rgba(0,0,0,0.4)', fontSize: 10}} />
                          <YAxis hide />
                          <Tooltip contentStyle={{ backgroundColor: isDarkMode ? '#121212' : '#fff', border: isDarkMode ? '1px solid rgba(212,175,55,0.2)' : '1px solid #ddd', borderRadius: '12px' }} />
                          <Area type="monotone" dataKey="revenue" stroke="#D4AF37" fillOpacity={1} fill="url(#colorRev)" strokeWidth={4} />
                          <Area type="monotone" dataKey="cost" stroke={isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className={`p-8 rounded-[2.5rem] border transition-colors ${isDarkMode ? 'border-gold/10 bg-black/20' : 'border-slate-200 bg-white shadow-sm'}`}>
                    <h3 className={`text-xl font-bold luxury-font uppercase mb-6 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Operations Note</h3>
                    <p className={`text-sm mb-6 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>Shared shift note for handoff context, vendor issues, reminders, or anything the next person should see immediately.</p>
                    <textarea
                      value={generalNote}
                      onChange={(e) => setGeneralNote(e.target.value)}
                      placeholder="Shift handoff, urgent stock note, delivery issue, tomorrow prep reminder..."
                      className={`w-full min-h-[190px] resize-none rounded-2xl border p-5 text-sm leading-6 outline-none transition-all ${isDarkMode ? 'bg-white/5 border-white/10 text-cream placeholder:text-cream/20' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400'}`}
                    />
                    <div className="mt-5 flex items-center justify-between gap-4">
                      <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-cream/25' : 'text-slate-400'}`}>{generalNote.trim().length} chars</p>
                      <button
                        onClick={handleSaveGeneralNote}
                        disabled={isSavingGeneralNote}
                        className={`px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all disabled:cursor-not-allowed disabled:opacity-40 ${isDarkMode ? 'bg-gold text-charcoal shadow-gold-glow' : 'bg-slate-900 text-white shadow-xl'}`}
                      >
                        {isSavingGeneralNote ? 'Saving...' : 'Save Note'}
                      </button>
                    </div>
                  </div>
                  <div className={`p-8 rounded-[2.5rem] border transition-colors ${isDarkMode ? 'border-gold/10 bg-black/20' : 'border-slate-200 bg-white shadow-sm'}`}>
                    <h3 className={`text-xl font-bold luxury-font uppercase mb-8 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Financial Intelligence</h3>
                    <p className={`text-sm mb-6 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>Generate executive summaries for accounting and performance review.</p>
                    <div className="flex gap-4">
                        <button 
                            onClick={() => {
                                const year = new Date().getFullYear();
                                const month = new Date().getMonth() + 1;
                                const token = localStorage.getItem('bakery_token');
                                openDocument(`${API_BASE}/reports/monthly?month=${month}&year=${year}&format=pdf&token=${token}`, `monthly-report-${year}-${month}.pdf`);
                            }}
                            className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border transition-all ${isDarkMode ? 'border-gold/20 text-gold hover:bg-gold hover:text-charcoal' : 'bg-slate-900 text-white shadow-xl'}`}
                        >
                            Generate {new Date().toLocaleString('default', { month: 'long' })} Report
                        </button>
                        <button 
                            onClick={handleResetSession}
                            className={`px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-gold/20 text-gold hover:bg-gold hover:text-charcoal transition-all`}
                        >
                            Close Shift / Reset Session
                        </button>
                    </div>
                  </div>

                  <div className={`p-8 rounded-[2.5rem] border transition-colors ${isDarkMode ? 'border-gold/10 bg-black/20' : 'border-slate-200 bg-white shadow-sm'}`}>
                    <h3 className={`text-xl font-bold luxury-font uppercase mb-8 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Live Alerts</h3>
                    <div className="space-y-4">
                      {alerts.map((alert) => (
                        <motion.div 
                          key={alert.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`p-5 rounded-3xl border flex items-center justify-between group transition-all ${
                            alert.severity === 'high' 
                              ? (isDarkMode ? 'bg-rose-500/10 border-rose-500/20 text-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.1)]' : 'bg-rose-50 border-rose-100 text-rose-600') 
                              : (isDarkMode ? 'bg-gold/10 border-gold/20 text-gold shadow-[0_0_20px_rgba(212,175,55,0.1)]' : 'bg-amber-50 border-amber-100 text-amber-700')
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-2xl ${alert.severity === 'high' ? 'bg-rose-500/20' : 'bg-gold/20'}`}>
                              <AlertTriangle size={20} className={alert.severity === 'high' ? 'animate-pulse' : ''} />
                            </div>
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mb-1">{alert.type} Alert</p>
                              <p className="text-sm font-bold tracking-tight">{alert.message}</p>
                            </div>
                          </div>
                          <ChevronRight size={16} className="opacity-0 group-hover:opacity-40 transition-opacity" />
                        </motion.div>
                      ))}
                      {alerts.length === 0 && <div className="py-20 opacity-10 flex flex-col items-center"><Zap size={48}/><p className="mt-4 font-bold uppercase tracking-widest text-[10px]">System Nominal</p></div>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'kitchen' && (
              <div className="space-y-8 animate-in fade-in duration-500">
                <div className="flex justify-between items-center">
                    <div>
                        <h3 className={`text-4xl font-bold luxury-font uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Baker's Pipeline</h3>
                        <p className={`text-sm mt-1 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>Real-time production monitoring and execution</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    {/* Live Production Queue */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <Zap size={16} className="text-gold" />
                            <h4 className="text-xs font-black uppercase tracking-[0.2em] opacity-40">Active Batch Queue</h4>
                        </div>
                        <div className="space-y-4">
                            {planner.filter(p => p.status === 'pending').map(batch => (
                                <div key={batch.id} className={`p-8 rounded-[2.5rem] border flex items-center justify-between group transition-all ${isDarkMode ? 'bg-white/5 border-white/5 hover:border-gold/20' : 'bg-white border-slate-200 shadow-sm'}`}>
                                    <div className="flex items-center gap-6">
                                        <div className="text-5xl">{inventory.products.find(x => x.id === batch.product_id)?.icon}</div>
                                        <div>
                                            <p className="text-xl font-bold mb-1">{inventory.products.find(x => x.id === batch.product_id)?.name}</p>
                                            <p className="text-xs font-black text-gold uppercase tracking-widest">{batch.quantity} Units Required</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <button 
                                            onClick={() => setSelectedProduct(inventory.products.find(x => x.id === batch.product_id) || null)}
                                            className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all"
                                            title="View Recipe"
                                        >
                                            <FileText size={20} />
                                        </button>
                                        <button 
                                            onClick={() => handleCompletePlan(batch.id)}
                                            className={`px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${isDarkMode ? 'bg-gold text-charcoal shadow-gold-glow hover:scale-105' : 'bg-slate-900 text-white shadow-xl'}`}
                                        >
                                            Finish Batch
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {planner.filter(p => p.status === 'pending').length === 0 && (
                                <div className="py-20 border-2 border-dashed border-white/5 rounded-[3rem] flex flex-col items-center justify-center opacity-10">
                                    <CheckCircle size={48} className="mb-4" />
                                    <p className="font-black text-xs uppercase tracking-widest">No Active Batches</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Pre-Order Baking Alerts */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <Calendar size={16} className="text-gold" />
                            <h4 className="text-xs font-black uppercase tracking-[0.2em] opacity-40">Pre-Order Deadlines</h4>
                        </div>
                        <div className="space-y-4">
                            {orders.filter(o => o.status === 'pending' || o.status === 'baking').map(order => (
                                <div key={order.id} className={`p-6 rounded-3xl border flex items-center justify-between transition-all ${isDarkMode ? 'bg-black/40 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                                    <div>
                                        <p className="font-bold text-sm">{order.customer_name}</p>
                                        <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>
                                            Pickup: {new Date(order.pickup_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                        <div className="flex gap-1 mt-2">
                                            {order.items.map((it:any, idx:number) => (
                                                <span key={idx} className="text-[10px] bg-white/5 px-2 py-0.5 rounded-full">{it.qty}x {inventory.products.find(x=>x.id===it.id)?.name}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <select 
                                        value={order.status}
                                        onChange={async (e) => {
                                            await api.patch(`/orders/${order.id}/status?status=${e.target.value}`, null);
                                            if (e.target.value === 'ready') {
                                                addToast(`Order for ${order.customer_name} is Ready!`, "success");
                                                // Phase 10 trigger placeholder
                                                const msg = encodeURIComponent(`Bonjour ${order.customer_name}, votre commande chez BakeryOS est prête! 🥐`);
                                                if (order.customer_phone) {
                                                    window.open(`https://wa.me/${order.customer_phone.replace(/\D/g,'')}?text=${msg}`, '_blank');
                                                }
                                            }
                                            fetchData();
                                        }}
                                        className={`bg-transparent text-[10px] font-black uppercase tracking-widest outline-none ${order.status === 'baking' ? 'text-gold' : 'text-cream/40'}`}
                                    >
                                        <option value="pending">Queued</option>
                                        <option value="baking">In Oven</option>
                                        <option value="ready">Ready</option>
                                    </select>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
              </div>
            )}

            {activeTab === 'intelligence' && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className={`p-8 rounded-[2.5rem] border transition-all ${isDarkMode ? 'border-gold/20 bg-black/40 shadow-[0_0_50px_rgba(212,175,55,0.05)]' : 'border-slate-200 bg-white shadow-xl'}`}>
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 rounded-2xl bg-gold/20 text-gold"><Zap size={24} /></div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Portfolio Cost</p>
                                <h4 className="text-2xl font-bold">{formatPrice(analytics.intelligence.total_portfolio_cost)}</h4>
                            </div>
                        </div>
                        <p className="text-xs opacity-40">Total theoretical cost to produce 1 unit of every SKU in your inventory.</p>
                    </div>
                    <div className={`p-8 rounded-[2.5rem] border transition-all ${isDarkMode ? 'border-emerald-500/20 bg-black/40' : 'border-emerald-100 bg-white shadow-xl'}`}>
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-500"><TrendingUp size={24} /></div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Average Margin</p>
                                <h4 className="text-2xl font-bold text-emerald-500">{analytics.intelligence.average_margin}</h4>
                            </div>
                        </div>
                        <p className="text-xs opacity-40">Weighted average gross margin across all active product entities.</p>
                    </div>
                    <div className={`p-8 rounded-[2.5rem] border transition-all ${isDarkMode ? 'border-gold/20 bg-black/40' : 'border-slate-200 bg-white shadow-xl'}`}>
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 rounded-2xl bg-gold/20 text-gold"><Box size={24} /></div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-40">SKU Intelligence</p>
                                <h4 className="text-2xl font-bold">{profitReport.length} Products</h4>
                            </div>
                        </div>
                        <p className="text-xs opacity-40">Active products currently being tracked for financial performance.</p>
                    </div>
                </div>

                <div className={`p-8 rounded-[2.5rem] border transition-all ${isDarkMode ? 'border-white/5 bg-black/20' : 'border-slate-200 bg-white shadow-xl'}`}>
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-xl font-bold luxury-font uppercase">Recipe Financial Intelligence</h3>
                            <p className="text-sm opacity-40">Granular unit-level profitability analysis</p>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-left border-b border-white/5">
                                    <th className="pb-4 text-[10px] font-black uppercase tracking-widest opacity-40">Product</th>
                                    <th className="pb-4 text-[10px] font-black uppercase tracking-widest opacity-40">Cost Price</th>
                                    <th className="pb-4 text-[10px] font-black uppercase tracking-widest opacity-40">Selling Price</th>
                                    <th className="pb-4 text-[10px] font-black uppercase tracking-widest opacity-40">Net Profit</th>
                                    <th className="pb-4 text-[10px] font-black uppercase tracking-widest opacity-40">ROI</th>
                                    <th className="pb-4 text-[10px] font-black uppercase tracking-widest opacity-40">Margin</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {profitReport.map((item, i) => (
                                    <tr key={i} className="group hover:bg-white/5 transition-colors">
                                        <td className="py-4 font-bold">{item.product_name}</td>
                                        <td className="py-4 font-mono text-rose-400">{formatPrice(item.cost_price)}</td>
                                        <td className="py-4 font-mono">{formatPrice(item.selling_price)}</td>
                                        <td className={`py-4 font-mono font-bold ${item.net_profit > 0 ? 'text-emerald-400' : 'text-rose-500'}`}>{formatPrice(item.net_profit)}</td>
                                        <td className="py-4">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black ${parseFloat(item.roi_percentage) > 50 ? 'bg-emerald-500/20 text-emerald-500' : 'bg-gold/20 text-gold'}`}>
                                                {item.roi_percentage}
                                            </span>
                                        </td>
                                        <td className="py-4 font-bold text-cream/60">{item.margin_percentage}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
              </div>
            )}

            {activeTab === 'pos' && (
              <div className="flex gap-8 h-[calc(100vh-250px)]">
                <div className="flex-1 grid grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pr-4 custom-scrollbar">
                  {inventory.products.map(p => (
                    <div key={p.id} onClick={() => addToCart(p)} className={`p-8 rounded-[2rem] border transition-all cursor-pointer group active:scale-95 ${isDarkMode ? 'border-white/5 bg-black/20 hover:border-gold/40' : 'border-slate-200 bg-white hover:border-slate-400 shadow-sm'}`}>
                      <div className="text-5xl mb-6 group-hover:scale-110 transition-transform">{p.icon}</div>
                      <h4 className={`text-xl font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{p.name}</h4>
                      <p className={`text-[10px] font-black uppercase tracking-widest mb-6 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>{p.stock} in stock</p>
                      <div className={`flex justify-between items-center pt-6 border-t ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                        <span className={`text-2xl font-bold ${isDarkMode ? 'text-gold' : 'text-slate-900'}`}>{formatPrice(p.price)}</span>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isDarkMode ? 'bg-gold/10 text-gold group-hover:bg-gold group-hover:text-charcoal' : 'bg-slate-100 text-slate-900 group-hover:bg-slate-900 group-hover:text-white'}`}><Plus size={20}/></div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className={`w-96 rounded-[2.5rem] border flex flex-col overflow-hidden transition-all ${isDarkMode ? 'border-gold/20 bg-black/40 shadow-gold-glow' : 'border-slate-200 bg-white shadow-2xl'}`}>
                  <div className={`p-8 border-b ${isDarkMode ? 'border-white/5 bg-gold/5' : 'border-slate-100 bg-slate-50'}`}><h3 className={`text-xl font-bold luxury-font uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Current Tray</h3></div>
                  <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                    {cart.map(item => (
                      <div key={item.id} className={`flex justify-between items-center p-4 rounded-2xl border transition-colors ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                        <div>
                          <p className={`font-bold text-sm ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>{item.name}</p>
                          <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>{item.qty} x {formatPrice(item.price)}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`font-bold ${isDarkMode ? 'text-gold' : 'text-slate-900'}`}>{formatPrice(item.qty * item.price)}</span>
                          <button onClick={() => setCart(cart.filter(i => i.id !== item.id))} className="text-rose-500/30 hover:text-rose-500 transition-colors"><Trash2 size={16}/></button>
                        </div>
                      </div>
                    ))}
                    {cart.length === 0 && <div className="h-full flex items-center justify-center opacity-10 py-20 uppercase tracking-widest text-[10px] font-bold">Tray is Empty</div>}
                  </div>
                  <div className={`p-8 border-t ${isDarkMode ? 'border-white/5 bg-black/40' : 'border-slate-100 bg-slate-50'}`}>
                    <div className="flex justify-between items-end mb-8">
                      <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gold' : 'text-slate-400'}`}>Total Due</span>
                      <span className={`text-5xl font-bold tracking-tighter ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>{formatPrice(cart.reduce((a,c)=>a+(c.price*c.qty),0)).split(' ')[0]}</span>
                    </div>
                    <div className="flex gap-4">
                       <button 
                           onClick={finalizeSale} 
                           disabled={cart.length === 0} 
                           className={`flex-1 py-6 font-black rounded-2xl uppercase tracking-widest active:scale-95 transition-all ${isDarkMode ? 'bg-gold text-charcoal shadow-gold-glow' : 'bg-slate-900 text-white shadow-xl'}`}
                       >
                           Complete Sale
                       </button>
                       <button 
                           onClick={() => {
                               setBookingForm({
                                   ...bookingForm,
                                   source: 'pos',
                                   date: new Date(Date.now() + 86400000).toISOString().slice(0, 16)
                               });
                               setShowBookingModal(true);
                           }} 
                           disabled={cart.length === 0}
                           className={`p-6 rounded-2xl border transition-all ${isDarkMode ? 'border-white/10 bg-white/5 text-gold hover:bg-white/10' : 'border-slate-200 bg-white text-slate-900'}`}
                           title="Save as Pre-Order"
                       >

                           <Calendar size={24} />
                           </button>
                           </div>

                           {lastTransaction && (
                        <button 
                            onClick={() => setShowReceiptModal(true)}
                            className={`w-full mt-4 py-4 rounded-xl font-bold text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 border transition-all ${
                                isDarkMode ? 'border-gold/20 text-gold hover:bg-gold/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            <QRCodeSVG 
                                value={window.location.origin + API_BASE + "/transactions/" + lastTransaction.transaction_id + "/receipt?format=pdf&paper=80mm"}
                                size={16}
                            />
                            Show Last Receipt
                        </button>
                           )}
                    </div>
                 </div>
               </div>
            )}

            {activeTab === 'staff' && (
              <div className="space-y-8 animate-in fade-in duration-500">
                <div className="flex justify-between items-center">
                    <div>
                        <h3 className={`text-4xl font-bold luxury-font uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t.staff}</h3>
                        <p className={`text-sm mt-1 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>Manage your bakery team and access credentials</p>
                    </div>
                    <button 
                        onClick={() => setShowAddStaff(true)}
                        className={`px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 transition-all ${isDarkMode ? 'bg-gold text-charcoal shadow-gold-glow' : 'bg-slate-900 text-white'}`}
                    >
                        <Plus size={16}/>
                        {t.add_staff}
                    </button>
                </div>

                <div className={`rounded-[2.5rem] border overflow-hidden transition-colors ${isDarkMode ? 'border-white/5 bg-black/20' : 'border-slate-200 bg-white shadow-sm'}`}>
                    <table className="w-full text-left">
                        <thead>
                            <tr className={`border-b text-[10px] font-black uppercase tracking-[0.2em] ${isDarkMode ? 'border-white/5 text-cream/40' : 'border-slate-100 text-slate-400'}`}>
                                <th className="px-8 py-6">{t.username}</th>
                                <th className="px-8 py-6">Role</th>
                                <th className="px-8 py-6 text-right">{t.actions}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {staff.map((member) => (
                                <tr key={member.id} className={`border-b last:border-0 ${isDarkMode ? 'border-white/5 hover:bg-white/5' : 'border-slate-50 hover:bg-slate-50'} transition-colors`}>
                                    <td className="px-8 py-6 font-bold text-sm">{member.username}</td>
                                    <td className="px-8 py-6"><span className="text-[10px] font-black uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full">{member.role}</span></td>
                                    <td className="px-8 py-6 text-right">
                                        <button onClick={() => handleDeleteStaff(member.username)} className="text-rose-500/20 hover:text-rose-500 transition-colors p-2"><Trash2 size={16}/></button>
                                    </td>
                                </tr>
                            ))}
                            {staff.length === 0 && <tr><td colSpan={3} className="py-20 text-center opacity-10 font-black uppercase tracking-widest text-[10px]">No staff accounts created yet</td></tr>}
                        </tbody>
                    </table>
                </div>
              </div>
            )}

            {activeTab === 'comptabilite' && (
              <div className="space-y-8 animate-in fade-in duration-500">
                <div className="flex justify-between items-center">
                    <div>
                        <h3 className={`text-4xl font-bold luxury-font uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t.comptabilite}</h3>
                        <p className={`text-sm mt-1 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>Accounting overview, filtered performance, and purchase commitments.</p>
                    </div>
                    <div className="flex gap-4">
                        <button
                            onClick={() => {
                                const token = localStorage.getItem('bakery_token');
                                openExternal(`${API_BASE}/accounting/export?start=${accountingRange.start}&end=${accountingRange.end}&token=${token}`);
                            }}
                            className={`px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 transition-all ${isDarkMode ? 'border border-white/10 text-white hover:bg-white/5' : 'border border-slate-200 bg-white text-slate-900'}`}
                        >
                            <FileText size={16}/>
                            Export CSV
                        </button>
                        <button
                            onClick={() => {
                                const year = now.getFullYear();
                                const month = now.getMonth() + 1;
                                const token = localStorage.getItem('bakery_token');
                                openDocument(`${API_BASE}/reports/monthly?month=${month}&year=${year}&format=pdf&token=${token}`, `monthly-report-${year}-${month}.pdf`);
                            }}
                            className={`px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 transition-all ${isDarkMode ? 'border border-gold/20 text-gold hover:bg-gold hover:text-charcoal' : 'border border-slate-200 bg-white text-slate-900'}`}
                        >
                            <FileText size={16}/>
                            Monthly Report
                        </button>
                        <button 
                            onClick={() => setShowAddExpense(true)}
                            className={`px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 transition-all ${isDarkMode ? 'bg-gold text-charcoal shadow-gold-glow' : 'bg-slate-900 text-white'}`}
                        >
                            <Plus size={16}/>
                            Log Expense
                        </button>
                    </div>
                </div>

                <div className={`p-6 rounded-[2rem] border flex flex-wrap items-end gap-4 transition-colors ${isDarkMode ? 'border-white/5 bg-black/20' : 'border-slate-200 bg-white shadow-sm'}`}>
                    <div>
                        <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>From</p>
                        <input
                            type="date"
                            value={accountingRange.start}
                            max={accountingRange.end}
                            onChange={(e) => setAccountingRange(prev => ({ ...prev, start: e.target.value }))}
                            className={`border-b py-3 px-2 outline-none text-sm font-bold rounded-xl transition-all ${isDarkMode ? 'bg-black text-gold border-white/10' : 'bg-white text-slate-700 border-slate-200'}`}
                        />
                    </div>
                    <div>
                        <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>To</p>
                        <input
                            type="date"
                            value={accountingRange.end}
                            min={accountingRange.start}
                            onChange={(e) => setAccountingRange(prev => ({ ...prev, end: e.target.value }))}
                            className={`border-b py-3 px-2 outline-none text-sm font-bold rounded-xl transition-all ${isDarkMode ? 'bg-black text-gold border-white/10' : 'bg-white text-slate-700 border-slate-200'}`}
                        />
                    </div>
                    <button
                        onClick={() => setAccountingRange({ start: monthStart, end: monthEnd })}
                        className={`px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${isDarkMode ? 'border border-white/10 text-cream/60 hover:text-white hover:bg-white/5' : 'border border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                    >
                        This Month
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                    {[
                        { label: 'Filtered Revenue', value: formatPrice(monthlySales), tone: isDarkMode ? 'text-white' : 'text-slate-900' },
                        { label: 'Filtered Expenses', value: formatPrice(monthlyExpensesTotal), tone: 'text-rose-500' },
                        { label: 'Net After Expenses', value: formatPrice(monthlyNetAfterExpenses), tone: monthlyNetAfterExpenses >= 0 ? 'text-emerald-500' : 'text-rose-500' },
                        { label: 'Open PO Commitment', value: formatPrice(draftPurchaseCommitment), tone: isDarkMode ? 'text-gold' : 'text-slate-900' },
                    ].map((card, idx) => (
                        <div key={idx} className={`p-6 rounded-[2rem] border transition-colors ${isDarkMode ? 'border-white/5 bg-black/20' : 'border-slate-200 bg-white shadow-sm'}`}>
                            <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>{card.label}</p>
                            <p className={`text-3xl font-bold ${card.tone}`}>{card.value}</p>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                    <div className={`xl:col-span-2 rounded-[2.5rem] border overflow-hidden transition-colors ${isDarkMode ? 'border-white/5 bg-black/20' : 'border-slate-200 bg-white shadow-sm'}`}>
                        <div className="p-8 border-b border-white/5 flex justify-between items-center">
                            <h3 className={`text-xl font-bold luxury-font uppercase ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Accounting Feed</h3>
                            <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-cream/30' : 'text-slate-400'}`}>Latest 8 entries</p>
                        </div>
                        <div className="p-6 space-y-4">
                            {accountingFeed.length > 0 ? accountingFeed.map((entry) => (
                                <div key={entry.id} className={`p-5 rounded-2xl border flex items-center justify-between ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                                    <div>
                                        <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${entry.type === 'expense' ? 'text-rose-500' : 'text-gold'}`}>
                                            {entry.type === 'expense' ? 'Expense' : 'Purchase Order'}
                                        </p>
                                        <p className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{entry.label}</p>
                                        <p className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${isDarkMode ? 'text-cream/30' : 'text-slate-400'}`}>
                                            {new Date(entry.date).toLocaleDateString()} | {entry.meta}{entry.status ? ` | ${entry.status}` : ''}
                                        </p>
                                    </div>
                                    <p className={`text-sm font-black ${entry.type === 'expense' ? 'text-rose-500' : 'text-gold'}`}>
                                        {entry.type === 'expense' ? '-' : ''}{formatPrice(entry.amount)}
                                    </p>
                                </div>
                            )) : (
                                <div className="py-20 text-center opacity-10 font-black uppercase tracking-widest text-[10px]">No accounting activity yet</div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-8">
                        <div className={`rounded-[2.5rem] border overflow-hidden transition-colors ${isDarkMode ? 'border-white/5 bg-black/20' : 'border-slate-200 bg-white shadow-sm'}`}>
                            <div className="p-8 border-b border-white/5">
                                <h3 className={`text-xl font-bold luxury-font uppercase ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Expense Breakdown</h3>
                            </div>
                            <div className="p-6 space-y-4">
                                {expenseBreakdown.length > 0 ? expenseBreakdown.map(([category, total]) => (
                                    <div key={category} className={`p-4 rounded-2xl border flex items-center justify-between ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                                        <div>
                                            <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-cream/30' : 'text-slate-400'}`}>Category</p>
                                            <p className={`font-bold text-sm mt-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{category}</p>
                                        </div>
                                        <p className="font-black text-rose-500 text-sm">-{formatPrice(total as number)}</p>
                                    </div>
                                )) : (
                                    <div className="py-16 text-center opacity-10 font-black uppercase tracking-widest text-[10px]">No expenses in selected range</div>
                                )}
                            </div>
                        </div>

                        <div className={`rounded-[2.5rem] border overflow-hidden transition-colors ${isDarkMode ? 'border-white/5 bg-black/20' : 'border-slate-200 bg-white shadow-sm'}`}>
                            <div className="p-8 border-b border-white/5">
                                <h3 className={`text-xl font-bold luxury-font uppercase ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Quick Ledger</h3>
                            </div>
                            <div className="p-6 space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-cream/30' : 'text-slate-400'}`}>Range</p>
                                    <p className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{accountingRange.start} to {accountingRange.end}</p>
                                </div>
                                <div className="flex items-center justify-between">
                                    <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-cream/30' : 'text-slate-400'}`}>Sales Entries</p>
                                    <p className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{filteredSales.length}</p>
                                </div>
                                <div className="flex items-center justify-between">
                                    <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-cream/30' : 'text-slate-400'}`}>Expense Entries</p>
                                    <p className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{filteredExpenses.length}</p>
                                </div>
                                <div className="flex items-center justify-between">
                                    <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-cream/30' : 'text-slate-400'}`}>Open Purchase Orders</p>
                                    <p className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{filteredPurchaseOrders.filter((po: any) => po.status !== 'received').length}</p>
                                </div>
                                <div className="flex items-center justify-between">
                                    <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-cream/30' : 'text-slate-400'}`}>Waste Entries</p>
                                    <p className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{filteredWaste.length}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    <div className={`rounded-[2.5rem] border overflow-hidden transition-colors ${isDarkMode ? 'border-white/5 bg-black/20' : 'border-slate-200 bg-white shadow-sm'}`}>
                        <div className="p-8 border-b border-white/5">
                            <h3 className={`text-xl font-bold luxury-font uppercase ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Product Profitability</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            {productProfitability.length > 0 ? productProfitability.map((entry: any) => (
                                <div key={entry.name} className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                                    <div className="flex items-center justify-between">
                                        <p className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{entry.name}</p>
                                        <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-cream/30' : 'text-slate-400'}`}>{entry.qty} sold</p>
                                    </div>
                                    <div className="mt-4 space-y-1 text-sm font-bold">
                                        <div className="flex justify-between"><span className={isDarkMode ? 'text-cream/40' : 'text-slate-500'}>Revenue</span><span>{formatPrice(entry.revenue)}</span></div>
                                        <div className="flex justify-between"><span className={isDarkMode ? 'text-cream/40' : 'text-slate-500'}>Cost</span><span className="text-rose-500">{formatPrice(entry.cost)}</span></div>
                                        <div className="flex justify-between"><span className={isDarkMode ? 'text-cream/40' : 'text-slate-500'}>Profit</span><span className={entry.profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}>{formatPrice(entry.profit)}</span></div>
                                    </div>
                                </div>
                            )) : (
                                <div className="py-16 text-center opacity-10 font-black uppercase tracking-widest text-[10px]">No sales in selected range</div>
                            )}
                        </div>
                    </div>

                    <div className={`rounded-[2.5rem] border overflow-hidden transition-colors ${isDarkMode ? 'border-white/5 bg-black/20' : 'border-slate-200 bg-white shadow-sm'}`}>
                        <div className="p-8 border-b border-white/5">
                            <h3 className={`text-xl font-bold luxury-font uppercase ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Waste Visibility</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            {wasteByProduct.length > 0 ? wasteByProduct.map((entry: any) => (
                                <div key={entry.name} className={`p-4 rounded-2xl border flex items-center justify-between ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                                    <div>
                                        <p className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{entry.name}</p>
                                        <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${isDarkMode ? 'text-cream/30' : 'text-slate-400'}`}>{entry.qty} wasted units</p>
                                    </div>
                                    <p className="font-black text-rose-500 text-sm">-{formatPrice(entry.loss)}</p>
                                </div>
                            )) : (
                                <div className="py-16 text-center opacity-10 font-black uppercase tracking-widest text-[10px]">No waste in selected range</div>
                            )}
                        </div>
                    </div>
                </div>
              </div>
            )}

            {activeTab === 'expenses' && (
              <div className="space-y-8 animate-in fade-in duration-500">
                <div className="flex justify-between items-center">
                    <div>
                        <h3 className={`text-4xl font-bold luxury-font uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t.expenses}</h3>
                        <p className={`text-sm mt-1 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>Track business overhead, bills, and payroll</p>
                    </div>
                    <button 
                        onClick={() => setShowAddExpense(true)}
                        className={`px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 transition-all ${isDarkMode ? 'bg-gold text-charcoal shadow-gold-glow' : 'bg-slate-900 text-white'}`}
                    >
                        <Plus size={16}/>
                        Log New Expense
                    </button>
                </div>

                <div className={`rounded-[2.5rem] border overflow-hidden transition-colors ${isDarkMode ? 'border-white/5 bg-black/20' : 'border-slate-200 bg-white shadow-sm'}`}>
                    <table className="w-full text-left">
                        <thead>
                            <tr className={`border-b text-[10px] font-black uppercase tracking-[0.2em] ${isDarkMode ? 'border-white/5 text-cream/40' : 'border-slate-100 text-slate-400'}`}>
                                <th className="px-8 py-6">Date</th>
                                <th className="px-8 py-6">Category</th>
                                <th className="px-8 py-6">Description</th>
                                <th className="px-8 py-6 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {expenses.map((exp) => (
                                <tr key={exp.id} className={`border-b last:border-0 ${isDarkMode ? 'border-white/5 hover:bg-white/5' : 'border-slate-50 hover:bg-slate-50'} transition-colors`}>
                                    <td className="px-8 py-6 font-bold text-sm">{new Date(exp.date).toLocaleDateString()}</td>
                                    <td className="px-8 py-6"><span className="text-[10px] font-black uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full">{exp.category}</span></td>
                                    <td className={`px-8 py-6 text-sm ${isDarkMode ? 'text-cream/40' : 'text-slate-500'}`}>{exp.description}</td>
                                    <td className="px-8 py-6 text-right font-bold text-rose-500">-{formatPrice(exp.amount)}</td>
                                </tr>
                            ))}
                            {expenses.length === 0 && <tr><td colSpan={4} className="py-20 text-center opacity-10 font-black uppercase tracking-widest text-[10px]">No expenses logged yet</td></tr>}
                        </tbody>
                    </table>
                </div>
              </div>
            )}

            {activeTab === 'purchasing' && (
              <div className="space-y-8 animate-in fade-in duration-500">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Shopping List / Suggestions */}
                  <div className={`lg:col-span-2 rounded-[2rem] border overflow-hidden transition-colors ${isDarkMode ? 'border-white/5 bg-black/20' : 'border-slate-200 bg-white shadow-sm'}`}>
                    <div className="p-8 border-b border-white/5 flex justify-between items-center">
                        <h3 className={`text-xl font-bold luxury-font uppercase ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Procurement Intelligence</h3>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gold bg-gold/10 px-3 py-1 rounded-full">Auto-Suggestions</p>
                    </div>
                    <div className="p-8 space-y-6">
                        {purchasingSuggestions.length > 0 ? (
                            <div className="space-y-4">
                                <div className={`p-5 rounded-2xl border flex items-center justify-between gap-4 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                                    <div>
                                        <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>Bulk Order Supplier</p>
                                        <p className={`text-sm font-bold mt-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                            {selectedSupplierId ? suppliers.find(supp => supp.id === selectedSupplierId)?.name || 'Select supplier' : 'No supplier selected'}
                                        </p>
                                    </div>
                                    <select
                                        value={selectedSupplierId ?? ''}
                                        onChange={(e) => setSelectedSupplierId(e.target.value ? Number(e.target.value) : null)}
                                        className={`min-w-[220px] border-b py-3 px-2 outline-none text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${isDarkMode ? 'bg-black text-gold border-white/10' : 'bg-white text-slate-700 border-slate-200'}`}
                                    >
                                        {suppliers.length === 0 ? (
                                            <option value="">Add supplier first</option>
                                        ) : (
                                            suppliers.map((supp: any) => (
                                                <option key={supp.id} value={supp.id}>{supp.name}</option>
                                            ))
                                        )}
                                    </select>
                                </div>
                                {purchasingSuggestions.map(s => (
                                    <div key={s.name} className={`p-6 rounded-3xl border flex items-center justify-between transition-all ${isDarkMode ? 'bg-white/5 border-white/10 hover:border-gold/20' : 'bg-slate-50 border-slate-200'}`}>
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-gold/10 flex items-center justify-center text-gold">
                                                <Package size={20} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm">{s.name}</p>
                                                <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>Stock: {s.current_stock}{s.unit} | Min: {s.min_threshold}{s.unit}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-black text-gold uppercase tracking-widest">Buy +{s.suggested_buy}{s.unit}</p>
                                            <p className="text-[10px] font-bold opacity-40">Est. {formatPrice(s.estimated_cost)}</p>
                                        </div>
                                    </div>
                                ))}
                                <button
                                    onClick={async () => {
                                       if (!suppliers.length) {
                                           addToast("Add a supplier before generating a bulk purchase order", "error");
                                           return;
                                       }
                                       if (!selectedSupplierId) {
                                           addToast("Select a supplier before generating a bulk purchase order", "error");
                                           return;
                                       }
                                       const items = purchasingSuggestions.map(s => ({
                                           name: s.name,
                                           qty: s.suggested_buy,
                                           price: inventory.materials[s.name]?.price || 0
                                       }));
                                       await handleCreatePO({ supplier_id: selectedSupplierId, items });
                                    }}
                                    disabled={!suppliers.length || !selectedSupplierId}
                                    className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all disabled:cursor-not-allowed disabled:opacity-40 ${isDarkMode ? 'bg-gold text-charcoal shadow-gold-glow' : 'bg-slate-900 text-white'}`}
                                >
                                    Generate Bulk Purchase Order
                                </button>

                            </div>
                        ) : (
                            <div className="py-20 flex flex-col items-center opacity-20">
                                <CheckCircle size={48} className="mb-4" />
                                <p className="font-black text-xs uppercase tracking-widest text-center">Stock Levels Optimal<br/><span className="text-[10px] lowercase font-bold tracking-normal opacity-60">No procurement suggested</span></p>
                            </div>
                        )}
                    </div>
                  </div>

                  {/* Supplier Directory */}
                  <div className="space-y-8">
                    <div className={`rounded-[2rem] border overflow-hidden transition-colors ${isDarkMode ? 'border-white/5 bg-black/20' : 'border-slate-200 bg-white shadow-sm'}`}>
                        <div className="p-8 border-b border-white/5 flex justify-between items-center">
                            <h3 className={`text-xl font-bold luxury-font uppercase ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Recent Orders</h3>
                            <div className="flex items-center gap-3">
                                <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-cream/30' : 'text-slate-400'}`}>{purchaseOrders.length} orders</p>
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            </div>
                        </div>
                        <div className="p-6 space-y-4 max-h-[640px] overflow-y-auto custom-scrollbar">
                            {purchaseOrders.length > 0 ? (
                                purchaseOrders.map(po => (
                                    <div key={po.id} className={`p-6 rounded-3xl border transition-all ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Order ID</p>
                                                <p className="font-bold font-mono text-sm">{po.id}</p>
                                            </div>
                                            <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${po.status === 'received' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-gold/10 text-gold'}`}>
                                                {po.status}
                                            </span>
                                        </div>
                                        <div className={`grid grid-cols-2 gap-3 mb-5 text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-cream/35' : 'text-slate-400'}`}>
                                            <div>
                                                <p>Supplier</p>
                                                <p className={`mt-1 text-xs font-bold normal-case tracking-normal ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                                    {suppliers.find(supp => supp.id === po.supplier_id)?.name || `Supplier #${po.supplier_id}`}
                                                </p>
                                            </div>
                                            <div>
                                                <p>Date</p>
                                                <p className={`mt-1 text-xs font-bold normal-case tracking-normal ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                                    {new Date(po.date).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <div>
                                                <p>Lines</p>
                                                <p className={`mt-1 text-xs font-bold normal-case tracking-normal ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                                    {po.items.length}
                                                </p>
                                            </div>
                                            <div>
                                                <p>Estimated Total</p>
                                                <p className="mt-1 text-xs font-bold normal-case tracking-normal text-gold">
                                                    {formatPrice(po.items.reduce((sum: number, item: any) => sum + ((Number(item.qty) || 0) * (Number(item.price) || 0)), 0))}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="space-y-2 mb-6">
                                            {po.items.map((item: any, idx: number) => (
                                                <div key={idx} className="flex justify-between text-xs font-bold opacity-60">
                                                    <span>{item.name}</span>
                                                    <span>x{item.received_qty ? `${item.received_qty}/${item.qty}` : item.qty}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="space-y-2">
                                            <button 
                                                onClick={() => openPOModal(po)}
                                                className={`w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${isDarkMode ? 'bg-white/10 hover:bg-white/15' : 'bg-slate-200 text-slate-900'}`}
                                            >
                                                Manage Order
                                            </button>
                                            {po.status === 'draft' && (
                                                <button 
                                                    onClick={() => handleReceivePO(po.id)}
                                                    className={`w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${isDarkMode ? 'bg-gold text-charcoal hover:opacity-90' : 'bg-slate-900 text-white'}`}
                                                >
                                                    Mark as Fully Received
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="py-10 text-center opacity-20">
                                    <FileText size={32} className="mx-auto mb-4" />
                                    <p className="text-[10px] font-black uppercase tracking-widest">No Recent Orders</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className={`rounded-[2rem] border overflow-hidden transition-colors ${isDarkMode ? 'border-white/5 bg-black/20' : 'border-slate-200 bg-white shadow-sm'}`}>
                        <div className="p-8 border-b border-white/5 flex justify-between items-center">
                            <h3 className={`text-xl font-bold luxury-font uppercase ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Suppliers</h3>
                            <button onClick={() => setShowAddSupplier(true)} className="text-gold p-2 hover:bg-gold/10 rounded-lg transition-all"><Plus size={16}/></button>
                        </div>
                        <div className="p-6 space-y-4">
                            {suppliers.length > 0 ? (
                                suppliers.map(supp => (
                                    <div key={supp.id} className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                                        <div className="min-w-0">
                                            <p className="font-bold text-sm truncate">{supp.name}</p>
                                            <p className={`text-[10px] opacity-40 uppercase tracking-widest font-black truncate ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>{supp.contact_info || 'No contact info'}</p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                onClick={() => {
                                                    setEditingSupplier(supp);
                                                    setNewSupplier({ name: supp.name || '', contact_info: supp.contact_info || '' });
                                                    setShowAddSupplier(true);
                                                }}
                                                className={`p-2 rounded-xl transition-all ${isDarkMode ? 'bg-white/5 hover:bg-white/10 text-gold' : 'bg-white hover:bg-slate-100 text-slate-700'}`}
                                                title="Edit supplier"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteSupplier(supp)}
                                                className={`p-2 rounded-xl transition-all ${isDarkMode ? 'bg-white/5 hover:bg-rose-500/20 text-rose-400' : 'bg-white hover:bg-rose-50 text-rose-600'}`}
                                                title="Delete supplier"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="py-10 text-center opacity-20">
                                    <Truck size={32} className="mx-auto mb-4" />
                                    <p className="text-[10px] font-black uppercase tracking-widest">No Registered Suppliers</p>
                                </div>
                            )}
                        </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'inventory' && (
              <div className="space-y-8 animate-in fade-in duration-500">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className={`rounded-[2rem] border overflow-hidden transition-colors ${isDarkMode ? 'border-white/5 bg-black/20' : 'border-slate-200 bg-white shadow-sm'}`}>
                    <div className="p-8 border-b border-white/5 flex justify-between items-center">
                        <h3 className={`text-xl font-bold luxury-font uppercase ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Finished Goods</h3>
                        {editMode && <button onClick={() => setShowAddProduct(true)} className={`p-2 rounded-lg transition-all ${isDarkMode ? 'bg-gold/10 text-gold' : 'bg-slate-100 text-slate-900'}`}><Plus size={16}/></button>}
                    </div>
                    <table className="w-full text-left">
                        <thead>
                            <tr className={`border-b text-[10px] font-black uppercase tracking-[0.2em] ${isDarkMode ? 'border-white/5 text-cream/40' : 'border-slate-100 text-slate-400'}`}>
                                <th className="px-8 py-6">Entity</th>
                                <th className="px-8 py-6">Stock</th>
                                <th className="px-8 py-6 text-right">Margin</th>
                            </tr>
                            </thead>
                            <tbody className={`divide-y ${isDarkMode ? 'divide-white/5' : 'divide-slate-100'}`}>
                            {inventory.products.map(p => {
                                const margin = p.price > 0 ? ((p.price - (p.live_cost || 0)) / p.price * 100) : 0;
                                return (
                                    <tr key={p.id} className="group hover:bg-white/[0.02] transition-colors">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-4">
                                                <span className="text-3xl">{p.icon}</span>
                                                <p className={`font-bold ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>{p.name}</p>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-3">
                                                <button 
                                                    onClick={() => handleAdjustStock('product', p.id, -1)}
                                                    className={`w-6 h-6 rounded-md flex items-center justify-center text-xs transition-all ${isDarkMode ? 'bg-white/5 hover:bg-rose-500/20 text-rose-500' : 'bg-slate-100 hover:bg-rose-100 text-rose-600'}`}
                                                >
                                                    -
                                                </button>
                                                <span className={`font-bold text-sm min-w-[3ch] text-center ${p.stock < 10 ? 'text-rose-500' : ''}`}>{p.stock}</span>
                                                <button 
                                                    onClick={() => {
                                                        openSelector({
                                                            title: "Quick Stock",
                                                            label: "Add Quantity",
                                                            value: "50",
                                                            type: "text",
                                                            onConfirm: (val) => handleAdjustStock('product', p.id, parseInt(val))
                                                        });
                                                    }}
                                                    className={`w-6 h-6 rounded-md flex items-center justify-center text-xs transition-all ${isDarkMode ? 'bg-white/5 hover:bg-emerald-500/20 text-emerald-500' : 'bg-slate-100 hover:bg-emerald-100 text-emerald-600'}`}
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex flex-col items-end gap-1">
                                                <div className="flex items-center gap-2 group/price">
                                                    <span className={`text-sm font-bold ${isDarkMode ? 'text-gold' : 'text-slate-900'}`}>{formatPrice(p.price)}</span>
                                                    {editMode && (
                                                        <button 
                                                            onClick={() => openSelector({
                                                                title: "Update Price",
                                                                label: "New Selling Price (MAD)",
                                                                value: p.price.toString(),
                                                                type: "text",
                                                                onConfirm: (val) => handleUpdateProductPrice(p.id, parseFloat(val))
                                                            })}
                                                            className="text-gold/40 hover:text-gold transition-colors"
                                                        >
                                                            <Edit2 size={12}/>
                                                        </button>
                                                    )}
                                                </div>
                                                <span className={`text-[10px] font-bold ${margin > 30 ? 'text-emerald-500' : 'text-rose-500'}`}>{margin.toFixed(1)}% Margin</span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            </tbody>

                    </table>
                  </div>

                  <div className={`rounded-[2rem] border overflow-hidden transition-colors ${isDarkMode ? 'border-white/5 bg-black/20' : 'border-slate-200 bg-white shadow-sm'}`}>
                    <div className="p-8 border-b border-white/5 flex justify-between items-center">
                        <h3 className={`text-xl font-bold luxury-font uppercase ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Raw Materials</h3>
                        {editMode && (
                            <button 
                                onClick={() => {
                                    setEditingMaterialName(null);
                                    setNewMaterial({ name: '', unit: 'g', price: 0, min_threshold: 0 });
                                    setShowAddMaterial(true);
                                }} 
                                className={`p-2 rounded-lg transition-all ${isDarkMode ? 'bg-gold/10 text-gold' : 'bg-slate-100 text-slate-900'}`}
                            >
                                <Plus size={16}/>
                            </button>
                        )}
                    </div>
                    <table className="w-full text-left">
                        <thead>
                            <tr className={`border-b text-[10px] font-black uppercase tracking-[0.2em] ${isDarkMode ? 'border-white/5 text-cream/40' : 'border-slate-100 text-slate-400'}`}>
                                <th className="px-8 py-6">Ingredient</th>
                                <th className="px-8 py-6">Level</th>
                                <th className="px-8 py-6">Supplier</th>
                                {editMode && <th className="px-8 py-6 text-right">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${isDarkMode ? 'divide-white/5' : 'divide-slate-100'}`}>
                            {sortedMaterialEntries.map(([name, data]) => (
                                <tr key={name} className="group hover:bg-white/[0.02] transition-colors">
                                    <td className="px-8 py-6">
                                        <p className={`font-bold ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>{name}</p>
                                        <p className={`text-[10px] uppercase font-bold tracking-widest ${isDarkMode ? 'text-gold/60' : 'text-slate-400'}`}>{formatPrice(data.price)} / {data.unit}</p>
                                    </td>
                                    <td className="px-8 py-6 font-bold">
                                        <div className="flex items-center gap-3">
                                            <button 
                                                onClick={() => handleAdjustStock('material', name, -100)}
                                                className={`w-6 h-6 rounded-md flex items-center justify-center text-xs transition-all ${isDarkMode ? 'bg-white/5 hover:bg-rose-500/20 text-rose-500' : 'bg-slate-100 hover:bg-rose-100 text-rose-600'}`}
                                            >
                                              -
                                            </button>
                                            <span className={`font-bold text-sm min-w-[5ch] text-center ${data.stock < data.min_threshold ? 'text-rose-500' : (isDarkMode ? 'text-gold' : 'text-slate-900')}`}>
                                                {data.stock}
                                            </span>
                                            <button 
                                                onClick={() => {
                                                    openSelector({
                                                        title: "Quick Stock",
                                                        label: "Add Quantity (" + data.unit + ")",
                                                        value: "1000",
                                                        type: "text",
                                                        onConfirm: (val) => handleAdjustStock('material', name, parseInt(val))
                                                    });
                                                }}
                                                className={`w-6 h-6 rounded-md flex items-center justify-center text-xs transition-all ${isDarkMode ? 'bg-white/5 hover:bg-emerald-500/20 text-emerald-500' : 'bg-slate-100 hover:bg-emerald-100 text-emerald-600'}`}
                                            >
                                              +
                                            </button>
                                            <span className="text-[10px] opacity-40">{data.unit}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-cream/20' : 'text-slate-300'}`}>
                                            {(data as any).supplier || 'Standard'}
                                        </span>
                                    </td>
                                    {editMode && (
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex justify-end">
                                                <button 
                                                    onClick={(e) => {
                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                        openSelector({
                                                            title: `Ingredient: ${name}`,
                                                            label: "Select Action",
                                                            value: "edit",
                                                            type: "choice",
                                                            options: [
                                                                { label: "✏️ Edit Definition", value: "edit" },
                                                                { label: "🗑️ Delete Ingredient", value: "delete" }
                                                            ],
                                                            onConfirm: (val) => {
                                                                if (val === 'edit') startEditingMaterial(name, data);
                                                                else if (val === 'delete') handleDeleteMaterial(name);
                                                            }
                                                        });
                                                    }}
                                                    className={`p-2 rounded-lg transition-all ${isDarkMode ? 'bg-white/5 text-cream/40 hover:text-gold hover:bg-gold/10' : 'bg-slate-50 text-slate-400 hover:text-slate-900 hover:bg-slate-100'}`}
                                                >
                                                    <Settings size={14}/>
                                                </button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>

                  </div>
                </div>
              </div>
            )}

            {activeTab === 'fiche' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {inventory.products.map(p => (
                  <div key={p.id} className={`p-8 rounded-[2.5rem] border transition-colors ${isDarkMode ? 'border-white/5 bg-black/20' : 'border-slate-200 bg-white shadow-sm'}`}>
                    <div className="flex justify-between items-start mb-8">
                      <div><span className="text-4xl mb-2 block">{p.icon}</span><h3 className={`text-xl font-bold luxury-font ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{p.name}</h3></div>
                      <div className="text-right">
                        <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gold' : 'text-slate-400'}`}>Unit Cost</p>
                        <p className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{formatPrice(p.live_cost || 0)}</p>
                      </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mb-8 p-3 rounded-2xl bg-white/5 border border-white/5">
                       <div className="text-center">
                           <p className="text-[8px] uppercase font-black opacity-40 mb-1">Prep</p>
                           {editMode ? (
                               <input 
                                 type="number" 
                                 value={p.prep_time}
                                 onChange={(e) => handleUpdateProductField(p.id, 'prep_time', parseInt(e.target.value) || 0)}
                                 className="w-full bg-transparent text-center font-bold text-xs outline-none"
                               />
                           ) : (
                               <p className="text-xs font-bold">{p.prep_time}m</p>
                           )}
                       </div>
                       <div className="text-center border-x border-white/5">
                           <p className="text-[8px] uppercase font-black opacity-40 mb-1">Cook</p>
                           {editMode ? (
                               <input 
                                 type="number" 
                                 value={p.cook_time}
                                 onChange={(e) => handleUpdateProductField(p.id, 'cook_time', parseInt(e.target.value) || 0)}
                                 className="w-full bg-transparent text-center font-bold text-xs outline-none"
                               />
                           ) : (
                               <p className="text-xs font-bold">{p.cook_time}m</p>
                           )}
                       </div>
                       <div className="text-center">
                           <p className="text-[8px] uppercase font-black opacity-40 mb-1">Yield</p>
                           {editMode ? (
                               <input 
                                 type="number" 
                                 value={p.yield_qty}
                                 onChange={(e) => handleUpdateProductField(p.id, 'yield_qty', parseInt(e.target.value) || 0)}
                                 className="w-full bg-transparent text-center font-bold text-xs outline-none"
                               />
                           ) : (
                               <p className="text-xs font-bold">{p.yield_qty}</p>
                           )}
                       </div>
                      </div>

                      <div className="space-y-2 mb-8">
                      {p.ingredients.map((ing, idx) => (
                        <div key={ing.name} className="flex justify-between items-center text-xs group/ing">
                          <span className={isDarkMode ? 'text-cream/40' : 'text-slate-500'}>{ing.name}</span>
                          <div className="flex items-center gap-3">
                            {editMode ? (
                              <>
                                <input 
                                  type="number" 
                                  value={ing.quantity}
                                  onChange={(e) => {
                                    const newIngs = [...p.ingredients];
                                    newIngs[idx].quantity = parseFloat(e.target.value);
                                    handleUpdateProductIngredients(p.id, newIngs);
                                  }}
                                  className={`w-16 text-right font-bold bg-transparent outline-none border-b border-transparent focus:border-gold/30 ${isDarkMode ? 'text-cream/80' : 'text-slate-700'}`}
                                />
                                <span className="opacity-40">{inventory.materials[ing.name]?.unit || 'g'}</span>
                                <button 
                                  onClick={() => {
                                    const newIngs = p.ingredients.filter((_, i) => i !== idx);
                                    handleUpdateProductIngredients(p.id, newIngs);
                                  }}
                                  className="text-rose-500 transition-opacity"
                                >
                                  <X size={12}/>
                                </button>
                              </>
                            ) : (
                              <span className="font-bold opacity-60">{ing.quantity} {inventory.materials[ing.name]?.unit || 'g'}</span>
                            )}
                          </div>
                        </div>
                      ))}
                      
                      {editMode && (
                        <div className="pt-4">
                          <select 
                            className={`w-full border-b border-white/5 text-[10px] font-black uppercase tracking-widest py-3 px-2 outline-none rounded-xl transition-all ${isDarkMode ? 'bg-black text-gold' : 'bg-slate-100 text-slate-600'}`}
                            value=""
                            onChange={(e) => {
                              if (!e.target.value) return;
                              if (p.ingredients.some(ing => ing.name === e.target.value)) return;
                              const newIngs = [...p.ingredients, { name: e.target.value, quantity: 0 }];
                              handleUpdateProductIngredients(p.id, newIngs);
                            }}
                          >
                            <option value="" className={isDarkMode ? 'bg-charcoal text-gold' : ''}>+ Add Ingredient</option>
                            {sortedMaterialNames.map(m => (
                              <option key={m} value={m} className={isDarkMode ? 'bg-charcoal text-cream' : ''}>{m}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                    <div className={`pt-6 border-t flex justify-between items-center ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                      <div>
                        <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-emerald-500/50' : 'text-emerald-600'}`}>Projected Margin</p>
                        <p className="text-xl font-bold text-emerald-500">{p.price > 0 ? (((p.price - (p.live_cost || 0)) / p.price) * 100).toFixed(1) : 0}%</p>
                      </div>
                      {editMode && <button onClick={() => handleDeleteProduct(p.id)} className="text-rose-500/20 hover:text-rose-500 transition-colors"><Trash2 size={16}/></button>}
                    </div>
                    
                    <button 
                        onClick={() => setSelectedProduct(p)}
                        className={`w-full mt-4 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border transition-all ${isDarkMode ? 'border-gold/20 text-gold hover:bg-gold hover:text-charcoal' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                        View Executive Protocol
                    </button>
                  </div>
                ))}

                {editMode && (
                   <>
                    <div onClick={handleCleanupProducts} className={`p-8 rounded-[2.5rem] border border-dashed flex flex-col items-center justify-center cursor-pointer border-rose-500/20 hover:border-rose-500 group transition-all min-h-[300px] ${isDarkMode ? 'bg-rose-500/5' : 'bg-rose-50'}`}>
                          <div className="w-16 h-16 rounded-full border-2 border-dashed border-rose-500/20 flex items-center justify-center group-hover:border-rose-500 group-hover:scale-110 transition-all mb-4 text-rose-500">
                              <Trash2 size={24} />
                          </div>
                          <p className="font-black text-[10px] uppercase tracking-[0.2em] text-rose-500 opacity-40 group-hover:opacity-100 transition-all text-center">Cleanup Broken Data<br/><span className="text-[8px] opacity-60">Removes empty IDs</span></p>
                    </div>

                    <div onClick={() => setShowAddProduct(true)} className={`p-8 rounded-[2.5rem] border border-dashed flex flex-col items-center justify-center cursor-pointer hover:border-gold/40 group transition-all min-h-[300px] ${isDarkMode ? 'border-white/10 bg-black/5' : 'border-slate-300 bg-slate-50'}`}>
                        <div className="w-16 h-16 rounded-full border-2 border-dashed border-white/10 flex items-center justify-center group-hover:border-gold/40 group-hover:scale-110 transition-all mb-4">
                            <Plus className="opacity-20 group-hover:opacity-100 group-hover:text-gold transition-all" />
                        </div>
                        <p className="font-black text-[10px] uppercase tracking-[0.2em] opacity-20 group-hover:opacity-100 group-hover:text-gold transition-all">New Entity</p>
                    </div>
                   </>
                )}
              </div>
            )}

            {activeTab === 'simulator' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in slide-in-from-bottom-4 duration-500">
                <div className={`p-10 rounded-[3rem] border transition-colors ${isDarkMode ? 'border-gold/20 bg-black/40 shadow-gold-glow' : 'border-slate-200 bg-white shadow-sm'}`}>
                  <div className="flex justify-between items-center mb-10">
                    <div>
                        <h3 className={`text-2xl font-bold luxury-font uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Price Engine</h3>
                        <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${isDarkMode ? 'text-cream/20' : 'text-slate-400'}`}>Simulate Global Market Shifts</p>
                    </div>
                    <button onClick={runSimulation} className={`p-4 rounded-2xl shadow-lg transition-all hover:scale-105 active:scale-95 ${isDarkMode ? 'bg-gold text-charcoal shadow-gold-glow' : 'bg-slate-900 text-white'}`}><Zap size={24}/></button>
                  </div>
                  
                  <div className="space-y-4 max-h-[600px] overflow-y-auto pr-6 custom-scrollbar">
                    {sortedMaterialEntries.map(([name, data]) => (
                      <div key={name} className="p-6 rounded-2xl border border-white/5 bg-white/5 space-y-4">
                        <div className="flex justify-between items-end">
                          <div>
                            <p className={`text-[10px] font-black uppercase tracking-[0.2em] text-gold mb-1`}>{name}</p>
                            <p className={`text-xs font-bold ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>Current: {formatPrice(data.price)} / {data.unit}</p>
                          </div>
                          <div className="text-right flex flex-col items-end gap-2">
                             <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black opacity-20 uppercase tracking-widest">New:</span>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    value={simPrices[name] !== undefined ? simPrices[name] : data.price}
                                    onChange={(e) => {
                                        const val = parseFloat(e.target.value) || 0;
                                        const newPrices = {...simPrices, [name]: val};
                                        setSimPrices(newPrices);
                                        if (simulationResult.length) runSimulation();
                                    }}
                                    className={`w-20 bg-transparent border-b border-gold/40 text-right font-black text-sm outline-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
                                />
                                <span className="text-[10px] font-bold opacity-40">{activeCurrency}</span>
                             </div>
                             <p className={`text-[10px] font-bold uppercase ${ (simPrices[name] || data.price) > data.price ? 'text-rose-500' : 'text-emerald-500'}`}>
                                {data.price > 0 ? ((((simPrices[name] || data.price) - data.price) / data.price * 100).toFixed(1)) : 'NEW'}% Change
                             </p>
                          </div>
                        </div>
                        
                        <input 
                          type="range" 
                          min={data.price > 0 ? data.price * 0.5 : 0} 
                          max={data.price > 0 ? data.price * 2 : 100} 
                          step={data.price > 0 ? data.price * 0.01 : 1}
                          value={simPrices[name] !== undefined ? simPrices[name] : data.price}
                          onChange={(e) => {
                              const newPrices = {...simPrices, [name]: parseFloat(e.target.value)};
                              setSimPrices(newPrices);
                              if (simulationResult.length) runSimulation();
                          }}
                          className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-gold"
                        />
                      </div>
                    ))}
                  </div>
                  
                  {editMode && (
                    <button 
                      onClick={saveSimulation} 
                      className={`mt-10 w-full py-6 border rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all ${isDarkMode ? 'border-gold/30 text-gold hover:bg-gold hover:text-charcoal shadow-gold-glow/20' : 'border-slate-900 text-slate-900 hover:bg-slate-900 hover:text-white'}`}
                    >
                      Apply New Global Pricing
                    </button>
                  )}
                </div>

                <div className="space-y-6">
                    <div className={`lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-8`}>
                      {/* Hourly Heatmap */}
                      <div className={`p-8 rounded-[2.5rem] border transition-colors ${isDarkMode ? 'border-white/5 bg-black/20' : 'border-slate-200 bg-white shadow-sm'}`}>
                        <h3 className={`text-xl font-bold luxury-font uppercase mb-8 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Hourly Sales Heatmap</h3>
                        <div className="h-[250px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={analytics.hourlySales}>
                              <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} vertical={false} />
                              <XAxis dataKey="hour" fontSize={10} axisLine={false} tickLine={false} tick={{fill: isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'}} />
                              <Tooltip 
                                  contentStyle={{ backgroundColor: isDarkMode ? '#0a0a0b' : '#fff', border: 'none', borderRadius: '15px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}
                                  itemStyle={{ color: '#d4af37', fontWeight: 'bold' }}
                              />
                              <Bar dataKey="value" fill="#d4af37" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Product Popularity */}
                      <div className={`p-8 rounded-[2.5rem] border transition-colors ${isDarkMode ? 'border-white/5 bg-black/20' : 'border-slate-200 bg-white shadow-sm'}`}>
                        <h3 className={`text-xl font-bold luxury-font uppercase mb-8 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Volume Distribution</h3>
                        <div className="h-[250px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={analytics.topProducts}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                              >
                                {analytics.topProducts.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={['#d4af37', '#b8860b', '#f3e5ab', '#10b981', '#f43f5e'][index % 5]} />
                                ))}
                              </Pie>
                              <Tooltip 
                                  contentStyle={{ backgroundColor: isDarkMode ? '#0a0a0b' : '#fff', border: 'none', borderRadius: '15px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex flex-wrap justify-center gap-4 mt-4">
                          {analytics.topProducts.map((p, i) => (
                              <div key={i} className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full" style={{backgroundColor: ['#d4af37', '#b8860b', '#f3e5ab', '#10b981', '#f43f5e'][i % 5]}} />
                                  <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">{p.name}</span>
                              </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className={`lg:col-span-2 rounded-[2.5rem] border p-8 transition-colors ${isDarkMode ? 'border-white/5 bg-black/20' : 'border-slate-200 bg-white shadow-sm'}`}>
                      <h3 className={`text-xl font-bold luxury-font uppercase mb-8 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Market Performance</h3>

                        <div className="space-y-4">
                            {simulationResult.map((res: any) => {
                                const isPositive = res.profit_delta > 0;
                                return (
                                    <motion.div 
                                        key={res.name}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className={`p-6 rounded-3xl border transition-all ${isDarkMode ? 'border-white/5 bg-white/5' : 'border-slate-200 bg-white shadow-sm'}`}
                                    >
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h5 className="font-black luxury-font uppercase text-xs">{res.name}</h5>
                                                <p className="text-[10px] opacity-40">Margin: {res.margin_impact}%</p>
                                            </div>
                                            <div className={`px-3 py-1 rounded-full text-[10px] font-black ${isPositive ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'}`}>
                                                {isPositive ? '+' : ''}{formatPrice(res.profit_delta)} / unit
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <p className="text-[8px] font-black uppercase tracking-widest opacity-40">Unit Cost</p>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs line-through opacity-20">{formatPrice(res.old_cost)}</span>
                                                    <span className="text-xs font-bold text-rose-400">{formatPrice(res.new_cost)}</span>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[8px] font-black uppercase tracking-widest opacity-40">Unit Profit</p>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs line-through opacity-20">{formatPrice(res.old_profit)}</span>
                                                    <span className={`text-xs font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>{formatPrice(res.new_profit)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                            {!simulationResult.length && (
                                <div className="py-32 flex flex-col items-center opacity-10">
                                    <Calculator size={64} />
                                    <p className="mt-6 font-black text-xs uppercase tracking-[0.3em]">Initialize Projection</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div className={`rounded-[2rem] border overflow-hidden transition-colors ${isDarkMode ? 'border-white/5 bg-black/20' : 'border-slate-200 bg-white shadow-sm'}`}>
                <table className="w-full text-left">
                  <thead>
                    <tr className={`border-b text-[10px] font-black uppercase tracking-[0.2em] ${isDarkMode ? 'border-white/5 text-cream/40' : 'border-slate-100 text-slate-400'}`}>
                      <th className="px-8 py-6">Transaction</th>
                      <th className="px-8 py-6">Timestamp</th>
                      <th className="px-8 py-6">Type</th>
                      <th className="px-8 py-6 text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDarkMode ? 'divide-white/5' : 'divide-slate-100'}`}>
                    {history.slice().reverse().map(tx => (
                      <tr key={tx.id} className="group hover:bg-white/[0.02] transition-colors">
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-3">
                            <p className={`font-bold ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>{tx.id}</p>
                            {tx.type === 'sale' && (
                              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                <button 
                                  onClick={() => {
                                  const token = localStorage.getItem('bakery_token');
                                  openDocument(`${API_BASE}/transactions/${tx.id}/receipt?format=pdf&paper=80mm&token=${token}`, `receipt-${tx.id}.pdf`);
                                }}
                                  className={`p-2 rounded-lg ${isDarkMode ? 'bg-gold/10 text-gold' : 'bg-slate-100 text-slate-900'}`}
                                  title="Print Receipt"
                                >
                                  <FileText size={14} />
                                </button>
                                <button 
                                  onClick={() => {
                                      openSelector({
                                          title: "WhatsApp Share",
                                          label: "Customer Number",
                                          value: '',
                                          type: 'text',
                                          onConfirm: (phone) => {
                                              const itemsText = tx.items?.map((i: any) => `- ${i.name} x${i.qty}`).join('%0A') || '';
                                              const text = `BAKERY OS: Receipt ${tx.id}%0A${itemsText}%0A%0ATOTAL: ${tx.revenue} MAD`;
                                              window.open(`https://wa.me/${phone.replace(/\D/g,'')}?text=${text}`, '_blank');
                                          }
                                      });
                                  }}
                                  className={`p-2 rounded-lg ${isDarkMode ? 'bg-emerald-500/10 text-emerald-500' : 'bg-emerald-50 text-emerald-600'}`}
                                  title="Share to WhatsApp"
                                >
                                  <Zap size={14} />
                                </button>
                              </div>
                            )}
                          </div>
                          <p className={`text-[10px] uppercase font-bold tracking-widest ${isDarkMode ? 'text-cream/20' : 'text-slate-300'}`}>
                            {tx.type === 'sale' ? tx.items?.map(i => i.name).join(', ') : tx.product}
                          </p>
                        </td>
                        <td className={`px-8 py-6 font-medium text-xs ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>
                          {new Date(tx.timestamp).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-8 py-6">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${tx.type === 'sale' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-gold/10 text-gold'}`}>{tx.type}</span>
                        </td>
                        <td className={`px-8 py-6 text-right font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{formatPrice(tx.revenue || tx.cost || 0)}</td>
                      </tr>
                    ))}
                  </tbody>

                </table>
              </div>
            )}

            {activeTab === 'planner' && (
              <div className="space-y-8 animate-in fade-in duration-500">
                <div className={`p-10 rounded-[3.5rem] border transition-colors ${isDarkMode ? 'border-gold/20 bg-black/20 shadow-gold-glow' : 'border-slate-200 bg-white shadow-sm'}`}>
                  <div className="flex justify-between items-center mb-10">
                    <div>
                        <h3 className={`text-2xl font-bold luxury-font uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Production Strategy</h3>
                        <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${isDarkMode ? 'text-cream/20' : 'text-slate-400'}`}>Operational Batch Planning</p>
                    </div>
                    <div className="flex gap-4">
                      <button 
                          onClick={() => {
                              openSelector({
                                  title: "Smart Forecast",
                                  label: "Target Date",
                                  value: new Date(Date.now() + 86400000).toISOString().split('T')[0],
                                  type: 'date',
                                  onConfirm: (date) => handleSmartForecast(date)
                              });
                          }}
                          disabled={isForecasting}
                          className={`flex items-center gap-3 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${isDarkMode ? 'bg-white/5 text-gold border border-white/10 hover:bg-gold hover:text-charcoal' : 'bg-slate-100 text-slate-900 border border-slate-200 hover:bg-slate-200 shadow-sm'}`}
                      >
                          <Zap size={16} className={isForecasting ? 'animate-pulse' : ''} />
                          {isForecasting ? 'Analyzing...' : 'Smart Suggest'}
                      </button>
                      <button 
                          onClick={() => {
                              openSelector({
                                  title: "Production Sheet",
                                  label: "Sheet Date",
                                  value: new Date().toISOString().split('T')[0],
                                  type: 'date',
                                  onConfirm: (date) => {
                                  const token = localStorage.getItem('bakery_token');
                                  openDocument(`${API_BASE}/planner/prep-sheet?date=${date}&token=${token}`, `prep-sheet-${date}.pdf`);
                                }
                              });
                          }}
                          className={`flex items-center gap-3 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${isDarkMode ? 'bg-gold/10 text-gold border border-gold/20 hover:bg-gold hover:text-charcoal' : 'bg-slate-900 text-white shadow-xl'}`}
                      >
                          <FileText size={16} />
                          Print Prep List
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <div className="space-y-6">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">Initialize Batch</label>
                        <div className="grid grid-cols-2 gap-4">
                            <select 
                                onChange={(e) => {
                                    const p = inventory.products.find(x => x.id === e.target.value);
                                    if(p) setPlanner([...planner, { id: Math.random().toString(36).substr(2, 9), date: new Date().toISOString(), product_id: p.id, quantity: 10, status: 'pending' }]);
                                }}
                                className={`p-4 rounded-2xl border outline-none font-bold text-sm ${isDarkMode ? 'bg-white/5 border-white/10 text-cream focus:border-gold/40' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-slate-400'}`}
                            >
                                <option value="">Select Entity...</option>
                                {inventory.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>

                        <div className="space-y-4">
                            {planner.filter(p => p.status === 'pending').map(item => (
                                <div key={item.id} className={`p-6 rounded-2xl border flex items-center justify-between ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-100'}`}>
                                    <div className="flex items-center gap-4">
                                        <div className="text-2xl">{inventory.products.find(p => p.id === item.product_id)?.icon}</div>
                                        <div>
                                            <p className={`font-bold text-sm ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>{inventory.products.find(p => p.id === item.product_id)?.name}</p>
                                            <p className="text-[10px] text-gold font-black uppercase tracking-widest">Pending Execution</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <input 
                                            type="number" 
                                            value={item.quantity}
                                            onChange={(e) => setPlanner(planner.map(p => p.id === item.id ? { ...p, quantity: parseInt(e.target.value) || 0 } : p))}
                                            className="w-16 bg-transparent border-b border-gold/20 text-center font-bold text-gold outline-none"
                                        />
                                        <button 
                                            onClick={() => handleProduce(item.product_id, item.quantity)}
                                            className="p-3 bg-gold/10 text-gold rounded-xl hover:bg-gold hover:text-charcoal transition-all"
                                        >
                                            <Zap size={18} />
                                        </button>
                                        <button 
                                            onClick={() => setPlanner(planner.filter(p => p.id !== item.id))}
                                            className="text-white/10 hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className={`p-8 rounded-3xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gold mb-8">Resource Forecast</h4>
                        <div className="space-y-6">
                            {Object.entries(
                                planner.filter(p => p.status === 'pending').reduce((acc, item) => {
                                    const prod = inventory.products.find(p => p.id === item.product_id);
                                    prod?.ingredients.forEach(ing => {
                                        acc[ing.name] = (acc[ing.name] || 0) + (ing.quantity * item.quantity);
                                    });
                                    return acc;
                                }, {} as Record<string, number>)
                            ).sort(([nameA], [nameB]) => nameA.localeCompare(nameB)).map(([name, req]) => (
                                <div key={name} className="flex justify-between items-end">
                                    <div>
                                        <p className={`text-xs font-bold ${isDarkMode ? 'text-cream/60' : 'text-slate-500'}`}>{name}</p>
                                        <p className={`text-lg font-black luxury-font ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                            {displayUnit(req, inventory.materials[name]?.unit || 'g')}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-bold text-gold uppercase tracking-widest">Available</p>
                                        <p className={`text-sm font-bold ${inventory.materials[name]?.stock < req ? 'text-red-500' : 'text-emerald-500'}`}>
                                            {displayUnit(inventory.materials[name]?.stock || 0, inventory.materials[name]?.unit || 'g')}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'orders' && (
              <div className="space-y-8 animate-in fade-in duration-500">
                <div className={`p-8 rounded-[3rem] border transition-colors ${isDarkMode ? 'border-gold/20 bg-black/20 shadow-gold-glow' : 'border-slate-200 bg-white shadow-sm'}`}>
                  <div className="flex justify-between items-center mb-10">
                    <div>
                        <h3 className={`text-2xl font-bold luxury-font uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Pre-Order Ledger</h3>
                        <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${isDarkMode ? 'text-cream/20' : 'text-slate-400'}`}>Tracking {orders.length} active custom bookings</p>
                    </div>
                    <button 
                        onClick={() => {
                            setBookingForm({
                                name: '',
                                phone: '',
                                date: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
                                source: 'ledger'
                            });
                            setShowBookingModal(true);
                        }} 
                        className={`px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all active:scale-95 ${isDarkMode ? 'bg-gold text-charcoal shadow-gold-glow' : 'bg-slate-900 text-white shadow-xl'}`}
                    >
                        Create Booking
                    </button>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className={`border-b text-[10px] font-black uppercase tracking-[0.3em] ${isDarkMode ? 'border-white/5 text-cream/40' : 'border-slate-100 text-slate-400'}`}>
                          <th className="px-8 py-6">Customer Identity</th>
                          <th className="px-8 py-6">Pickup Schedule</th>
                          <th className="px-8 py-6">Fulfillment Status</th>
                          <th className="px-8 py-6 text-right">Connect</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${isDarkMode ? 'divide-white/5' : 'divide-slate-100'}`}>
                        {orders.map(order => (
                          <tr key={order.id} className="group hover:bg-white/[0.02] transition-colors">
                            <td className="px-8 py-6">
                              <p className={`font-bold text-lg ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>{order.customer_name}</p>
                              <p className={`text-[10px] uppercase font-black tracking-widest ${isDarkMode ? 'text-gold' : 'text-slate-500'}`}>Order Ref: {order.id}</p>
                            </td>
                            <td className="px-8 py-6">
                              <div className="flex items-center gap-3">
                                <Calendar size={14} className="text-gold opacity-40" />
                                <p className={`text-sm font-bold ${isDarkMode ? 'text-white/60' : 'text-slate-600'}`}>
                                  {new Date(order.pickup_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </td>
                            <td className="px-8 py-6">
                              <select 
                                value={order.status}
                                onChange={async (e) => {
                                  const newStatus = e.target.value;
                                  await api.patch(`/orders/${order.id}/status?status=${newStatus}`, null);
                                  addToast(`Order ${newStatus.toUpperCase()}`, "success");
                                  fetchData();
                                }}

                                className={`bg-transparent font-black text-[10px] uppercase tracking-widest outline-none cursor-pointer transition-colors ${
                                  order.status === 'picked_up' ? 'text-emerald-500' : (order.status === 'ready' ? 'text-gold drop-shadow-gold' : 'text-white/20 hover:text-white/40')
                                }`}
                              >
                                <option value="pending" className="bg-slate-900">Pending</option>
                                <option value="baking" className="bg-slate-900">Baking</option>
                                <option value="ready" className="bg-slate-900">Ready</option>
                                <option value="picked_up" className="bg-slate-900">Picked Up</option>
                              </select>
                            </td>
                            <td className="px-8 py-6 text-right">
                               <button 
                                  onClick={() => {
                                      openSelector({
                                          title: "WhatsApp Share",
                                          label: "Customer Number",
                                          value: order.customer_phone || '',
                                          type: 'text',
                                          onConfirm: (phone) => {
                                              const text = `Bonjour ${order.customer_name}, votre commande BakeryOS (${order.id}) est maintenant ${order.status.toUpperCase()}! À bientôt! 🥐`;
                                              window.open(`https://wa.me/${phone.replace(/\D/g,'')}?text=${encodeURIComponent(text)}`, '_blank');
                                          }
                                      });
                                  }}
                                  className={`p-4 rounded-2xl transition-all active:scale-90 ${isDarkMode ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-black shadow-emerald-500/20 shadow-lg' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white'}`}
                                  title="Share via WhatsApp"
                               >

                                 <Zap size={18} fill="currentColor" />
                               </button>
                            </td>
                          </tr>
                        ))}
                        {orders.length === 0 && (
                            <tr>
                                <td colSpan={4} className="py-20 text-center opacity-10">
                                    <FileText size={48} className="mx-auto mb-4" />
                                    <p className="font-black text-[10px] uppercase tracking-widest">No Active Bookings</p>
                                </td>
                            </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
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
                    <h3 className={`text-2xl font-bold luxury-font ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Register Entity</h3>
                    <button onClick={() => setShowAddProduct(false)} className="text-white/20 hover:text-white"><X size={24}/></button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 overflow-y-auto pr-2 custom-scrollbar">
                    {/* Left Side: Search & Import */}
                    <div className="space-y-6">
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
                                        <img src={recipe.thumb} className="w-12 h-12 rounded-lg object-cover" alt={recipe.name} />
                                        <div className="flex-1 min-w-0">
                                            <p className={`font-bold text-xs truncate ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>{recipe.name}</p>
                                            <p className="text-[10px] text-gold uppercase font-bold">{recipe.category}</p>
                                        </div>
                                        <Plus size={14} className="text-gold opacity-40" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Side: Manual Entry & Preview */}
                    <div className="space-y-6">
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-1">Identifier</label>
                                <input type="text" placeholder="e.g. p4" value={newProduct.id} onChange={(e)=>setNewProduct({...newProduct, id: e.target.value})} className={`w-full bg-transparent border-b py-2 outline-none font-bold ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`} />
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

                        <button onClick={handleAddProduct} className="w-full py-5 rounded-2xl font-black text-xs uppercase tracking-widest bg-gold text-charcoal shadow-gold-glow active:scale-95 transition-all mt-4">Commit to Registry</button>
                    </div>
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
      <div className="fixed top-8 right-8 z-[300] space-y-4 pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
              className={`flex items-center gap-4 px-6 py-4 rounded-2xl shadow-2xl border pointer-events-auto backdrop-blur-xl ${
                toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                toast.type === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' :
                'bg-gold/10 border-gold/20 text-gold'
              }`}
            >
              {toast.type === 'success' && <CheckCircle size={20} />}
              {toast.type === 'error' && <XCircle size={20} />}
              {toast.type === 'info' && <Info size={20} />}
              <p className="text-xs font-black uppercase tracking-widest">{toast.message}</p>
              <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} className="ml-4 opacity-40 hover:opacity-100">
                <X size={14} />
              </button>
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
