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
  Coins
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
  Area 
} from 'recharts';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE = '/api';

// Types
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

const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [inventory, setInventory] = useState<{ materials: Record<string, Ingredient>, products: Product[] }>({ materials: {}, products: [] });
  const [analytics, setAnalytics] = useState({ revenue: 0, cost: 0, currency: 'MAD', chartData: [] });
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [history, setHistory] = useState<Transaction[]>([]);
  const [planner, setPlanner] = useState<PlanItem[]>([]);
  const [settings, setSettings] = useState<any>({ conversions: { MAD: 1, EUR: 0.092, USD: 0.10 }, currency: 'MAD' });
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Theme & Currency States
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [activeCurrency, setActiveCurrency] = useState('MAD');
  
  // Simulation & Edit States
  const [editMode, setEditMode] = useState(false);
  const [simPrices, setSimPrices] = useState<Record<string, number>>({});
  const [simulationResult, setSimulationResult] = useState<any[]>([]);

  const formatPrice = (amount: number) => {
    const rate = settings.conversions[activeCurrency] || 1;
    return (amount * rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + activeCurrency;
  };

  const fetchData = async () => {
    try {
      const [invRes, anaRes, aleRes, histRes, planRes, settRes] = await Promise.all([
        axios.get(`${API_BASE}/inventory`),
        axios.get(`${API_BASE}/analytics`),
        axios.get(`${API_BASE}/alerts`),
        axios.get(`${API_BASE}/history`),
        axios.get(`${API_BASE}/planner`),
        axios.get(`${API_BASE}/settings`)
      ]);
      setInventory(invRes.data);
      setAnalytics(anaRes.data);
      setAlerts(aleRes.data);
      setHistory(histRes.data);
      setPlanner(planRes.data);
      setSettings(settRes.data);
      
      const initialPrices: Record<string, number> = {};
      Object.entries(invRes.data.materials as Record<string, Ingredient>).forEach(([name, data]) => {
          initialPrices[name] = data.price;
      });
      setSimPrices(initialPrices);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleProduce = async (productId: string, qty: number) => {
    try {
      await axios.post(`${API_BASE}/produce`, { product_id: productId, quantity: qty });
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.detail || "Production failed");
    }
  };

  const addToCart = (product: Product) => {
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
    if (cart.length === 0) return;
    try {
      await axios.post(`${API_BASE}/complete`, { cart: cart.map(item => ({ id: item.id, qty: item.qty })) });
      setCart([]);
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.detail || "Sale failed");
    }
  };

  const runSimulation = async () => {
      try {
          const res = await axios.post(`${API_BASE}/simulate_price`, simPrices);
          setSimulationResult(res.data);
      } catch (e) { console.error(e); }
  };

  const saveSimulation = async () => {
      try {
          await axios.post(`${API_BASE}/update_material_prices`, simPrices);
          fetchData();
          alert("GLOBAL MATERIAL PRICES UPDATED");
      } catch (e) { console.error(e); }
  };

  if (loading) return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-charcoal text-gold">
       <div className="w-16 h-16 border-4 border-gold/20 border-t-gold rounded-full animate-spin mb-4"></div>
       <p className="font-bold tracking-widest uppercase text-xs">Re-engaging Luxe Logiciel...</p>
    </div>
  );

  return (
    <div className={`flex min-h-screen selection:bg-gold/30 transition-colors duration-500 ${isDarkMode ? 'bg-[#0a0a0b] text-cream' : 'bg-[#f8f9fa] text-slate-900'}`}>
      {/* Sidebar */}
      <aside className={`w-72 fixed h-full z-50 flex flex-col border-r transition-colors duration-500 ${isDarkMode ? 'bg-[#0f0f11] border-white/5' : 'bg-white border-slate-200 shadow-xl'}`}>
        <div className="p-8">
          <div className="flex items-center gap-3 mb-10">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${isDarkMode ? 'bg-gold shadow-gold-glow' : 'bg-slate-900 shadow-slate-200'}`}>
              <Box className={`${isDarkMode ? 'text-charcoal' : 'text-white'} w-6 h-6`} />
            </div>
            <h1 className={`text-2xl font-bold tracking-tight luxury-font ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Bakery<span className="text-gold">OS</span></h1>
          </div>

          <nav className="space-y-1">
            {[
              { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
              { id: 'pos', icon: ShoppingCart, label: 'POS Terminal' },
              { id: 'inventory', icon: Package, label: 'Inventory' },
              { id: 'fiche', icon: FileText, label: 'Fiche Technique' },
              { id: 'simulator', icon: Calculator, label: 'Simulator' },
              { id: 'history', icon: HistoryIcon, label: 'History' },
              { id: 'planner', icon: Calendar, label: 'Planner' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300 ${
                  activeTab === item.id 
                    ? (isDarkMode ? 'bg-gold/10 text-gold border border-gold/20 shadow-gold-glow' : 'bg-slate-100 text-slate-900 border border-slate-200 shadow-sm') 
                    : (isDarkMode ? 'text-cream/40 hover:bg-white/5 hover:text-cream' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700')
                }`}
              >
                <item.icon size={20} />
                <span className="font-semibold text-sm">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-8 space-y-4">
          {/* Theme & Currency Controls */}
          <div className={`grid grid-cols-2 gap-2 p-1 rounded-xl ${isDarkMode ? 'bg-white/5' : 'bg-slate-100'}`}>
            <button onClick={() => setIsDarkMode(true)} className={`py-2 rounded-lg flex justify-center transition-all ${isDarkMode ? 'bg-gold text-black shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}><Moon size={16}/></button>
            <button onClick={() => setIsDarkMode(false)} className={`py-2 rounded-lg flex justify-center transition-all ${!isDarkMode ? 'bg-white text-slate-900 shadow-lg' : 'text-white/20 hover:text-white'}`}><Sun size={16}/></button>
          </div>
          
          <div className={`grid grid-cols-3 gap-1 p-1 rounded-xl ${isDarkMode ? 'bg-white/5' : 'bg-slate-100'}`}>
            {['MAD', 'EUR', 'USD'].map(curr => (
              <button key={curr} onClick={() => setActiveCurrency(curr)} className={`py-2 rounded-lg text-[10px] font-black tracking-widest transition-all ${activeCurrency === curr ? (isDarkMode ? 'text-gold' : 'bg-white text-slate-900 shadow-sm') : (isDarkMode ? 'text-white/20' : 'text-slate-400')}`}>{curr}</button>
            ))}
          </div>

          <button 
            onClick={() => setEditMode(!editMode)}
            className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${
                editMode ? 'bg-rose-500 text-white shadow-lg' : (isDarkMode ? 'bg-gold text-charcoal shadow-gold-glow' : 'bg-slate-900 text-white shadow-xl')
            }`}
          >
            {editMode ? <X size={16}/> : <Edit2 size={16}/>}
            {editMode ? 'Exit Control' : 'Master Control'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 ml-72 p-10 transition-colors duration-500 ${isDarkMode ? 'bg-[#0a0a0b]' : 'bg-[#f8f9fa]'}`}>
        <header className="flex justify-between items-end mb-12">
          <div>
            <h2 className={`text-5xl font-bold luxury-font mb-2 tracking-tighter uppercase ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {activeTab === 'dashboard' && "Operational Matrix"}
                {activeTab === 'pos' && "Luxe Terminal"}
                {activeTab === 'inventory' && "Full Inventory"}
                {activeTab === 'fiche' && "Fiche Technique"}
                {activeTab === 'simulator' && "Price Engine"}
                {activeTab === 'history' && "Event History"}
                {activeTab === 'planner' && "Batch Planner"}
            </h2>
            <p className={`font-medium ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>Head Baker: Dane | Connected | {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}</p>
          </div>
          <div className="flex gap-4">
            <div className={`px-6 py-3 flex items-center gap-4 border rounded-2xl ${isDarkMode ? 'border-gold/10 bg-black/20' : 'border-slate-200 bg-white shadow-sm'}`}>
              <div className="text-right">
                <p className={`text-[10px] uppercase tracking-widest font-black ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>Session Profit</p>
                <p className={`text-xl font-bold ${isDarkMode ? 'text-gold' : 'text-slate-900'}`}>{formatPrice(analytics.revenue - analytics.cost)}</p>
              </div>
              <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-gold/10 text-gold' : 'bg-slate-100 text-slate-900'}`}><TrendingUp size={20} /></div>
            </div>
          </div>
        </header>

        {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in duration-700">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    <div className={`p-6 rounded-[2rem] border transition-colors ${isDarkMode ? 'border-white/5 bg-black/20' : 'border-slate-200 bg-white shadow-sm'}`}>
                      <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>Total Revenue</p>
                      <p className={`text-3xl font-bold ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>{formatPrice(analytics.revenue)}</p>
                    </div>
                    <div className={`p-6 rounded-[2rem] border transition-colors ${isDarkMode ? 'border-white/5 bg-black/20' : 'border-slate-200 bg-white shadow-sm'}`}>
                      <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>Total Cost</p>
                      <p className="text-3xl font-bold text-rose-500">{formatPrice(analytics.cost)}</p>
                    </div>
                    <div className={`p-6 rounded-[2rem] border transition-colors ${isDarkMode ? 'border-white/5 bg-black/20' : 'border-slate-200 bg-white shadow-sm'}`}>
                      <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>Net ROI</p>
                      <p className={`text-3xl font-bold ${analytics.revenue > analytics.cost ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {analytics.revenue > 0 ? (((analytics.revenue - analytics.cost) / analytics.revenue) * 100).toFixed(1) : 0}%
                      </p>
                    </div>
                    <div className={`p-6 rounded-[2rem] border transition-colors ${isDarkMode ? 'border-white/5 bg-black/20' : 'border-slate-200 bg-white shadow-sm'}`}>
                      <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>BOM Entities</p>
                      <p className={`text-3xl font-bold ${isDarkMode ? 'text-gold' : 'text-slate-900'}`}>{inventory.products.length}</p>
                    </div>
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
                        <h3 className={`text-xl font-bold luxury-font uppercase mb-8 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Live Alerts</h3>
                        <div className="space-y-4">
                            {alerts.map((alert) => (
                                <div key={alert.id} className={`p-4 rounded-2xl border flex items-center gap-4 ${alert.severity === 'high' ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' : 'bg-gold/10 border-gold/20 text-gold'}`}>
                                    <AlertTriangle size={20} />
                                    <p className="text-xs font-bold uppercase tracking-wide">{alert.message}</p>
                                </div>
                            ))}
                            {alerts.length === 0 && <div className="py-20 opacity-10 flex flex-col items-center"><Zap size={48}/><p className="mt-4 font-bold uppercase tracking-widest text-[10px]">System Nominal</p></div>}
                        </div>
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
                        <button onClick={finalizeSale} disabled={cart.length === 0} className={`w-full py-6 font-black rounded-2xl uppercase tracking-widest active:scale-95 transition-all ${isDarkMode ? 'bg-gold text-charcoal shadow-gold-glow' : 'bg-slate-900 text-white shadow-xl'}`}>Finalize Transaction</button>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'inventory' && (
            <div className={`rounded-[2rem] border overflow-hidden transition-colors ${isDarkMode ? 'border-white/5 bg-black/20' : 'border-slate-200 bg-white shadow-sm'}`}>
                <table className="w-full text-left">
                    <thead>
                        <tr className={`border-b text-[10px] font-black uppercase tracking-[0.2em] ${isDarkMode ? 'border-white/5 text-cream/40' : 'border-slate-100 text-slate-400'}`}>
                            <th className="px-8 py-6">Entity</th>
                            <th className="px-8 py-6">Unit Price</th>
                            <th className="px-8 py-6">In Stock</th>
                            <th className="px-8 py-6 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className={`divide-y ${isDarkMode ? 'divide-white/5' : 'divide-slate-100'}`}>
                        {inventory.products.map(p => (
                            <tr key={p.id} className="group hover:bg-white/[0.02] transition-colors">
                                <td className="px-8 py-6">
                                    <div className="flex items-center gap-4">
                                        <span className="text-3xl">{p.icon}</span>
                                        <div><p className={`font-bold ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>{p.name}</p><p className={`text-[10px] uppercase font-bold tracking-widest ${isDarkMode ? 'text-cream/20' : 'text-slate-300'}`}>BOM ID: {p.id}</p></div>
                                    </div>
                                </td>
                                <td className="px-8 py-6">
                                    {editMode ? 
                                        <input type="number" defaultValue={p.price} className={`w-24 border rounded px-2 py-1 font-bold outline-none ${isDarkMode ? 'bg-gold/10 border-gold/30 text-gold' : 'bg-slate-50 border-slate-200 text-slate-900'}`} />
                                        : <span className={`font-bold ${isDarkMode ? 'text-gold' : 'text-slate-900'}`}>{formatPrice(p.price)}</span>
                                    }
                                </td>
                                <td className="px-8 py-6">
                                    {editMode ? 
                                        <input type="number" defaultValue={p.stock} className={`w-20 border rounded px-2 py-1 font-bold outline-none ${isDarkMode ? 'bg-white/5 border-white/10 text-cream' : 'bg-slate-50 border-slate-200 text-slate-900'}`} />
                                        : <span className={`font-bold ${isDarkMode ? 'text-cream/80' : 'text-slate-600'}`}>{p.stock} Units</span>
                                    }
                                </td>
                                <td className="px-8 py-6 text-right">
                                    <div className="flex justify-end gap-3">
                                        <button onClick={() => handleProduce(p.id, 10)} className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${isDarkMode ? 'bg-white/5 hover:bg-gold hover:text-charcoal' : 'bg-slate-100 hover:bg-slate-900 hover:text-white'}`}>Restock +10</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}

        {activeTab === 'fiche' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in slide-in-from-bottom duration-500">
                {inventory.products.map(p => (
                    <div key={p.id} className={`p-8 rounded-[2.5rem] border transition-colors ${isDarkMode ? 'border-white/5 bg-black/20' : 'border-slate-200 bg-white shadow-sm'}`}>
                        <div className="flex justify-between items-start mb-8">
                            <div><span className="text-4xl mb-2 block">{p.icon}</span><h3 className={`text-xl font-bold luxury-font ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{p.name}</h3></div>
                            <div className="text-right">
                                <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gold' : 'text-slate-400'}`}>Unit Cost</p>
                                <p className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{formatPrice(p.live_cost || 0)}</p>
                            </div>
                        </div>
                        <div className="space-y-4 mb-8">
                            {p.ingredients.map(ing => (
                                <div key={ing.name} className="flex justify-between items-center text-xs">
                                    <span className={isDarkMode ? 'text-cream/40' : 'text-slate-500'}>{ing.name}</span>
                                    <span className={`font-bold ${isDarkMode ? 'text-cream/80' : 'text-slate-700'}`}>{ing.quantity}{inventory.materials[ing.name]?.unit || 'g'}</span>
                                </div>
                            ))}
                        </div>
                        <div className={`pt-6 border-t flex justify-between items-center ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                            <div>
                                <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-emerald-500/50' : 'text-emerald-600'}`}>Projected Margin</p>
                                <p className="text-xl font-bold text-emerald-500">{p.price > 0 ? (((p.price - (p.live_cost || 0)) / p.price) * 100).toFixed(1) : 0}%</p>
                            </div>
                            <button className={`p-3 rounded-xl transition-all ${isDarkMode ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-slate-100 text-slate-900 hover:bg-slate-200'}`}><Edit2 size={16}/></button>
                        </div>
                    </div>
                ))}
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
                                    <p className={`font-bold ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>{tx.id}</p>
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
                                <td className={`px-8 py-6 text-right font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{formatPrice(tx.revenue || tx.cost)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}

        {activeTab === 'planner' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
                <div className={`lg:col-span-2 p-8 rounded-[2.5rem] border transition-colors ${isDarkMode ? 'border-white/5 bg-black/20' : 'border-slate-200 bg-white shadow-sm'}`}>
                    <h3 className={`text-xl font-bold luxury-font uppercase mb-10 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Production Schedule</h3>
                    <div className="space-y-4">
                        {planner.map(item => (
                            <div key={item.id} className={`p-6 rounded-2xl border flex justify-between items-center ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-gold/10 text-gold' : 'bg-slate-200 text-slate-900'}`}><Calendar size={20}/></div>
                                    <div>
                                        <p className={`font-bold ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>{inventory.products.find(p => p.id === item.product_id)?.name}</p>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-gold">{item.date}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{item.quantity} Units</p>
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${item.status === 'completed' ? 'text-emerald-500' : 'text-gold'}`}>{item.status}</span>
                                </div>
                            </div>
                        ))}
                        {planner.length === 0 && <div className="py-20 opacity-10 flex flex-col items-center transition-colors"><Calendar size={48}/><p className="mt-4 font-bold uppercase tracking-widest text-xs">No batches planned</p></div>}
                    </div>
                </div>
                <div className={`p-8 rounded-[2.5rem] border transition-colors ${isDarkMode ? 'border-gold/10 bg-black/20' : 'border-slate-200 bg-white shadow-sm'}`}>
                    <h3 className={`text-xl font-bold luxury-font uppercase mb-10 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Quick Plan</h3>
                    <div className="space-y-6">
                        <div>
                            <label className={`text-[10px] font-black uppercase tracking-widest mb-2 block ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>Select Entity</label>
                            <select className={`w-full border rounded-xl px-4 py-3 font-bold outline-none transition-all ${isDarkMode ? 'bg-[#1a1a1c] border-white/10 text-cream focus:border-gold/40' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-slate-400'}`}>
                                {inventory.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={`text-[10px] font-black uppercase tracking-widest mb-2 block ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>Batch Size</label>
                            <input type="number" defaultValue={50} className={`w-full border rounded-xl px-4 py-3 font-bold outline-none transition-all ${isDarkMode ? 'bg-[#1a1a1c] border-white/10 text-cream focus:border-gold/40' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-slate-400'}`} />
                        </div>
                        <button className={`w-full py-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${isDarkMode ? 'bg-gold text-charcoal shadow-gold-glow active:scale-95' : 'bg-slate-900 text-white shadow-xl active:scale-95'}`}>Schedule Batch</button>
                    </div>
                </div>
            </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
