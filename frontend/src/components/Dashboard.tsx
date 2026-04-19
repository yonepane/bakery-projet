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
  Zap
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
  item: string;
  current: number;
  threshold: number;
}

interface CartItem extends Product {
  qty: number;
}

const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [inventory, setInventory] = useState<{ materials: Record<string, Ingredient>, products: Product[] }>({ materials: {}, products: [] });
  const [analytics, setAnalytics] = useState({ revenue: 0, cost: 0, currency: 'MAD', chartData: [] });
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Simulation & Edit States
  const [editMode, setEditMode] = useState(false);
  const [simPrices, setSimPrices] = useState<Record<string, number>>({});
  const [simulationResult, setSimulationResult] = useState<any[]>([]);

  const fetchData = async () => {
    try {
      const [invRes, anaRes, aleRes] = await Promise.all([
        axios.get(`${API_BASE}/inventory`),
        axios.get(`${API_BASE}/analytics`),
        axios.get(`${API_BASE}/alerts`)
      ]);
      setInventory(invRes.data);
      setAnalytics(anaRes.data);
      setAlerts(aleRes.data);
      
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
    <div className="flex min-h-screen text-cream selection:bg-gold/30 bg-charcoal">
      {/* Original Sidebar Style */}
      <aside className="w-72 glass-sidebar fixed h-full z-50 flex flex-col">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-gold rounded-xl flex items-center justify-center shadow-gold-glow">
              <Box className="text-charcoal w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-luxury">Bakery<span className="text-gold">OS</span></h1>
          </div>

          <nav className="space-y-2">
            {[
              { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
              { id: 'pos', icon: ShoppingCart, label: 'POS Terminal' },
              { id: 'inventory', icon: Package, label: 'Inventory' },
              { id: 'simulator', icon: Calculator, label: 'Simulator' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300 ${
                  activeTab === item.id 
                    ? 'bg-gold/10 text-gold border border-gold/20 shadow-gold-glow' 
                    : 'text-cream/50 hover:bg-white/5 hover:text-cream'
                }`}
              >
                <item.icon size={20} />
                <span className="font-medium">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-8">
          <button 
            onClick={() => setEditMode(!editMode)}
            className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${
                editMode ? 'bg-rose-500 text-white shadow-lg' : 'bg-gold text-charcoal shadow-gold-glow'
            }`}
          >
            {editMode ? <X size={16}/> : <Edit2 size={16}/>}
            {editMode ? 'Exit Control' : 'Master Control'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-72 p-10 bg-charcoal-dark/30">
        <header className="flex justify-between items-end mb-12">
          <div>
            <h2 className="text-4xl font-bold text-luxury mb-2 uppercase tracking-tighter">
                {activeTab === 'dashboard' && "Operational Matrix"}
                {activeTab === 'pos' && "Luxe Terminal"}
                {activeTab === 'inventory' && "Full Inventory"}
                {activeTab === 'simulator' && "Price Engine"}
            </h2>
            <p className="text-cream/40 font-medium">Head Baker: Connected | {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}</p>
          </div>
          <div className="flex gap-4">
            <div className="glass-card px-6 py-3 flex items-center gap-4 border-gold/10 bg-black/20">
              <div className="text-right">
                <p className="text-[10px] text-cream/40 uppercase tracking-widest font-bold">Session Revenue</p>
                <p className="text-xl font-bold text-gold">{analytics.revenue.toLocaleString()} <span className="text-sm font-normal opacity-60">DH</span></p>
              </div>
              <div className="p-2 bg-gold/10 rounded-lg text-gold"><TrendingUp size={20} /></div>
            </div>
          </div>
        </header>

        {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in duration-700">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    <div className="glass-card p-6 bg-black/20"><p className="text-[10px] font-bold text-cream/40 uppercase tracking-widest mb-2">Total Revenue</p><p className="text-3xl font-bold text-cream">{analytics.revenue.toLocaleString()} <span className="text-xs text-gold">DH</span></p></div>
                    <div className="glass-card p-6 bg-black/20"><p className="text-[10px] font-bold text-cream/40 uppercase tracking-widest mb-2">Total Cost</p><p className="text-3xl font-bold text-rose-500">{analytics.cost.toLocaleString()} <span className="text-xs">DH</span></p></div>
                    <div className="glass-card p-6 bg-black/20"><p className="text-[10px] font-bold text-cream/40 uppercase tracking-widest mb-2">Daily Profit</p><p className="text-3xl font-bold text-emerald-500">{(analytics.revenue - analytics.cost).toLocaleString()} <span className="text-xs">DH</span></p></div>
                    <div className="glass-card p-6 bg-black/20"><p className="text-[10px] font-bold text-cream/40 uppercase tracking-widest mb-2">Items Count</p><p className="text-3xl font-bold text-gold">{inventory.products.length}</p></div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 glass-card p-8 gold-border-glow bg-black/20 min-h-[400px]">
                        <h3 className="text-xl font-bold text-luxury uppercase mb-8">Performance Chart</h3>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={analytics.chartData}>
                                    <defs>
                                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.4}/>
                                            <stop offset="95%" stopColor="#D4AF37" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'rgba(245,245,220,0.3)', fontSize: 10}} />
                                    <YAxis hide />
                                    <Tooltip contentStyle={{ backgroundColor: '#121212', border: '1px solid rgba(212,175,55,0.2)', borderRadius: '12px' }} />
                                    <Area type="monotone" dataKey="revenue" stroke="#D4AF37" fillOpacity={1} fill="url(#colorRev)" strokeWidth={4} />
                                    <Area type="monotone" dataKey="cost" stroke="rgba(255,255,255,0.1)" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div className="glass-card p-8 border-gold/10 bg-black/20">
                        <h3 className="text-xl font-bold text-luxury uppercase mb-8">Quick BOM monitor</h3>
                        <div className="space-y-6">
                            {Object.entries(inventory.materials).slice(0, 8).map(([name, data]) => (
                                <div key={name} className="space-y-2">
                                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                                        <span className="text-cream/40">{name}</span>
                                        <span className={data.stock < data.min_threshold ? 'text-rose-500' : 'text-gold'}>{data.stock}{data.unit}</span>
                                    </div>
                                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                        <div className={`h-full ${data.stock < data.min_threshold ? 'bg-rose-500' : 'bg-gold'}`} style={{ width: `${Math.min((data.stock / 20000) * 100, 100)}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'pos' && (
            <div className="flex gap-8 h-[calc(100vh-250px)]">
                <div className="flex-1 grid grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pr-4 custom-scrollbar">
                    {inventory.products.map(p => (
                        <div key={p.id} onClick={() => addToCart(p)} className="glass-card p-8 border-white/5 bg-black/20 hover:border-gold/40 transition-all cursor-pointer group active:scale-95">
                            <div className="text-5xl mb-6 group-hover:scale-110 transition-transform">{p.icon}</div>
                            <h4 className="text-xl font-bold mb-1">{p.name}</h4>
                            <p className="text-[10px] text-cream/40 font-bold uppercase tracking-widest mb-6">{p.stock} in stock</p>
                            <div className="flex justify-between items-center pt-6 border-t border-white/5">
                                <span className="text-2xl font-bold text-gold">{p.price} DH</span>
                                <div className="w-10 h-10 bg-gold/10 rounded-full flex items-center justify-center text-gold group-hover:bg-gold group-hover:text-charcoal transition-colors"><Plus size={20}/></div>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="w-96 glass-card border-gold/20 bg-black/40 flex flex-col overflow-hidden shadow-gold-glow">
                    <div className="p-8 border-b border-white/5 bg-gold/5"><h3 className="text-xl font-bold text-luxury uppercase tracking-tighter">Current Tray</h3></div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                        {cart.map(item => (
                            <div key={item.id} className="flex justify-between items-center p-4 bg-white/5 rounded-2xl border border-white/5">
                                <div>
                                    <p className="font-bold text-cream text-sm">{item.name}</p>
                                    <p className="text-[10px] text-cream/40 font-bold uppercase tracking-widest">{item.qty} x {item.price} DH</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="font-bold text-gold">{(item.qty * item.price).toFixed(2)}</span>
                                    <button onClick={() => setCart(cart.filter(i => i.id !== item.id))} className="text-rose-500/30 hover:text-rose-500"><Trash2 size={16}/></button>
                                </div>
                            </div>
                        ))}
                        {cart.length === 0 && <div className="h-full flex items-center justify-center opacity-10 py-20 uppercase tracking-widest text-[10px] font-bold">Tray is Empty</div>}
                    </div>
                    <div className="p-8 border-t border-white/5 bg-black/40">
                        <div className="flex justify-between items-end mb-8">
                            <span className="text-[10px] font-bold text-gold uppercase tracking-widest">Total Due</span>
                            <span className="text-5xl font-bold text-cream tracking-tighter">{cart.reduce((a,c)=>a+(c.price*c.qty),0).toFixed(2)}</span>
                        </div>
                        <button onClick={finalizeSale} disabled={cart.length === 0} className="w-full py-6 bg-gold text-charcoal font-black rounded-2xl uppercase tracking-widest shadow-gold-glow active:scale-95 transition-all">Finalize Transaction</button>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'inventory' && (
            <div className="glass-card border-white/5 bg-black/20 overflow-hidden">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-white/5 text-[10px] font-black uppercase tracking-[0.2em] text-cream/40">
                            <th className="px-8 py-6">Entity</th>
                            <th className="px-8 py-6">Price Control</th>
                            <th className="px-8 py-6">Stock Control</th>
                            <th className="px-8 py-6 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {inventory.products.map(p => (
                            <tr key={p.id} className="group hover:bg-white/[0.02] transition-colors">
                                <td className="px-8 py-6">
                                    <div className="flex items-center gap-4">
                                        <span className="text-3xl">{p.icon}</span>
                                        <div><p className="font-bold text-cream">{p.name}</p><p className="text-[10px] text-cream/20 uppercase font-bold tracking-widest">BOM ID: {p.id}</p></div>
                                    </div>
                                </td>
                                <td className="px-8 py-6">
                                    {editMode ? 
                                        <input type="number" defaultValue={p.price} className="w-24 bg-gold/10 border border-gold/30 rounded px-2 py-1 text-gold font-bold outline-none" />
                                        : <span className="font-bold text-gold">{p.price} DH</span>
                                    }
                                </td>
                                <td className="px-8 py-6">
                                    {editMode ? 
                                        <input type="number" defaultValue={p.stock} className="w-20 bg-white/5 border border-white/10 rounded px-2 py-1 text-cream font-bold outline-none" />
                                        : <span className="font-bold text-cream/80">{p.stock} Units</span>
                                    }
                                </td>
                                <td className="px-8 py-6 text-right">
                                    <div className="flex justify-end gap-3">
                                        <button onClick={() => handleProduce(p.id, 10)} className="px-4 py-2 bg-white/5 hover:bg-gold hover:text-charcoal rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all">Restock +10</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}

        {activeTab === 'simulator' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-500">
                <div className="glass-card p-8 border-gold/10 bg-black/20">
                    <div className="flex justify-between items-center mb-10">
                        <h3 className="text-xl font-bold text-luxury uppercase">Cost Simulation</h3>
                        <button onClick={runSimulation} className="p-3 bg-gold text-charcoal rounded-xl shadow-gold-glow"><Zap size={20}/></button>
                    </div>
                    <div className="space-y-6 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
                        {Object.entries(inventory.materials).map(([name, data]) => (
                            <div key={name} className="space-y-3">
                                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                                    <span className="text-cream/40">{name}</span>
                                    <span className="text-gold/60">Current: {data.price}</span>
                                </div>
                                <input 
                                    type="number" step="0.001"
                                    value={simPrices[name] || 0}
                                    onChange={(e) => setSimPrices({...simPrices, [name]: parseFloat(e.target.value)})}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-cream font-bold focus:border-gold/40 outline-none"
                                />
                            </div>
                        ))}
                    </div>
                    <button onClick={saveSimulation} className="mt-10 w-full py-5 border border-gold/30 text-gold rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-gold hover:text-charcoal transition-all">Save Global Prices</button>
                </div>
                <div className="glass-card p-8 border-white/5 bg-black/20">
                    <h3 className="text-xl font-bold text-luxury uppercase mb-10">Simulation Analysis</h3>
                    <div className="space-y-4">
                        {simulationResult.map((res: any) => (
                            <div key={res.name} className="p-6 bg-white/5 rounded-2xl border border-white/5 flex justify-between items-center">
                                <div><p className="font-bold text-cream">{res.name}</p><p className="text-[10px] text-cream/30 uppercase font-bold tracking-widest">Impact: {res.new_cost.toFixed(2)} DH</p></div>
                                <div className="text-right">
                                    <p className={`text-sm font-bold ${res.margin_impact > 30 ? 'text-emerald-500' : 'text-rose-500'}`}>{res.margin_impact.toFixed(1)}%</p>
                                    <p className="text-[10px] text-cream/20 uppercase font-bold tracking-widest">New ROI</p>
                                </div>
                            </div>
                        ))}
                        {!simulationResult.length && <div className="py-20 opacity-10 flex flex-col items-center"><Calculator size={48}/><p className="mt-4 font-bold uppercase tracking-widest text-xs">Run Simulation</p></div>}
                    </div>
                </div>
            </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
