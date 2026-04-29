import React, { useMemo } from 'react';
import { FileText, Plus, TrendingUp, X } from 'lucide-react';
import { BarChart, Bar, XAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { motion } from 'framer-motion';
import { DashboardSharedProps } from '../types';

const PIE_COLORS = ['#d4af37', '#b8860b', '#f3e5ab', '#10b981', '#f43f5e'];

type Props = Pick<DashboardSharedProps,
  'isDarkMode' | 'analytics' | 'inventory' | 'simPrices' | 'setSimPrices' |
  'simulatedInflations' | 'setSimulatedInflations' | 'formatPrice' |
  'handleUpdateProductField' | 'api' | 'fetchData' | 'addToast'>;

const AnalyticsPanel: React.FC<Props> = ({
  isDarkMode, analytics, inventory, simPrices, setSimPrices,
  simulatedInflations, setSimulatedInflations, formatPrice,
  handleUpdateProductField, api, fetchData, addToast
}) => {

  const allIngredients = useMemo(() => {
    const ingredients = new Set<string>();
    inventory.products.forEach(p => p.ingredients.forEach(ing => ingredients.add(ing.name)));
    return Array.from(ingredients).sort();
  }, [inventory]);

  const addSimulation = (ingredientName: string) => {
    if (ingredientName && !simulatedInflations[ingredientName]) {
      setSimulatedInflations({ ...simulatedInflations, [ingredientName]: 0 });
    }
  };

  const removeSimulation = (ingredientName: string) => {
    const copy = { ...simulatedInflations };
    delete copy[ingredientName];
    setSimulatedInflations(copy);
  };

  const updateInflation = (ingredientName: string, value: number) => {
    setSimulatedInflations({ ...simulatedInflations, [ingredientName]: value });
  };

  const handleCommitStrategy = async () => {
    try {
      let committedAny = false;
      for (const p of inventory.products) {
        if (simPrices[p.id] !== undefined && simPrices[p.id] !== p.price) {
          handleUpdateProductField(p.id, 'price', simPrices[p.id]);
          committedAny = true;
        }
      }
      
      if (committedAny) {
        addToast('Pricing Strategy Committed successfully!', 'success');
        setSimPrices({});
        setSimulatedInflations({});
        fetchData();
      } else {
        addToast('No price changes to commit.', 'info');
      }
    } catch (e) {
      addToast('Failed to commit pricing strategy', 'error');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Master Elite Pricing Engine */}
      <div className={`p-10 rounded-[3rem] border transition-all duration-500 ${isDarkMode ? 'glass-panel border-gold/20 shadow-[0_0_40px_rgba(212,175,55,0.05)]' : 'bg-white border-slate-200 shadow-2xl'}`}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
          <div>
            <h3 className={`text-2xl font-bold luxury-font uppercase flex items-center gap-3 tracking-tighter ${isDarkMode ? 'text-gold' : 'text-slate-900'}`}>
              <div className={`p-3 rounded-2xl ${isDarkMode ? 'bg-gold/10' : 'bg-slate-100'}`}>
                <TrendingUp size={20} className={isDarkMode ? 'text-gold' : 'text-slate-900'} />
              </div>
              Elite Master Pricing Engine
            </h3>
            <p className="text-[10px] uppercase tracking-widest opacity-40 mt-2 ml-14">Simulate simultaneous ingredient cost hikes and product selling price adjustments</p>
          </div>
          
          <div className="flex items-center gap-4">
            {Object.keys(simPrices).length > 0 && (
              <button onClick={handleCommitStrategy} className={`px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl ${isDarkMode ? 'bg-gold text-charcoal hover:scale-105 shadow-[0_0_20px_rgba(212,175,55,0.4)]' : 'bg-slate-900 text-white hover:bg-slate-800'}`}>
                Commit Strategy
              </button>
            )}
            <div className="relative group">
              <select 
                onChange={(e) => { addSimulation(e.target.value); e.target.value = ''; }}
                className={`appearance-none cursor-pointer pl-6 pr-12 py-4 text-[10px] font-black uppercase tracking-widest rounded-2xl border transition-all outline-none ${isDarkMode ? 'bg-black/80 border-gold/20 text-gold hover:bg-gold hover:text-charcoal' : 'bg-slate-50 border-slate-200 text-slate-900 hover:bg-slate-900 hover:text-white'}`}
                defaultValue=""
              >
                <option value="" disabled className={isDarkMode ? 'bg-[#0a0a0b] text-gold/50' : ''}>+ Inflate Ingredient Cost...</option>
                {allIngredients.filter(ing => !(ing in simulatedInflations)).map(ing => (
                  <option key={ing} value={ing} className={isDarkMode ? 'bg-[#0a0a0b] text-gold' : ''}>{ing}</option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none transition-transform group-hover:rotate-180 duration-500">
                <Plus size={16} className={isDarkMode ? 'group-hover:text-charcoal' : 'group-hover:text-white'} />
              </div>
            </div>
          </div>
        </div>
        
        {/* Ingredient Cost Inflation Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {Object.entries(simulatedInflations).map(([ingredient, inflation]) => (
            <div key={ingredient} className={`p-6 rounded-[2rem] border transition-all duration-300 relative group overflow-hidden ${isDarkMode ? 'bg-black/20 border-white/5 hover:border-gold/30' : 'bg-slate-50 border-slate-100 hover:border-slate-300'} ${inflation > 0 ? (isDarkMode ? 'shadow-[0_0_30px_rgba(244,63,94,0.15)] border-rose-500/30' : 'shadow-lg border-rose-200') : ''}`}>
              {inflation > 0 && <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500 to-orange-500" />}
              
              <div className="flex justify-between items-center mb-6">
                <span className={`text-sm font-bold uppercase tracking-widest flex items-center gap-2 ${isDarkMode ? 'text-cream' : 'text-slate-800'}`}>
                  {ingredient}
                </span>
                <div className="flex items-center gap-3">
                  <span className={`text-xl font-black luxury-font ${inflation > 0 ? 'text-rose-500' : (isDarkMode ? 'text-cream/20' : 'text-slate-300')}`}>
                    +{inflation}%
                  </span>
                  <button onClick={() => removeSimulation(ingredient)} className="w-8 h-8 rounded-full flex items-center justify-center border border-transparent transition-all opacity-0 group-hover:opacity-100 hover:bg-rose-500/10 hover:border-rose-500/20 hover:text-rose-500 hover:rotate-90">
                    <X size={14} />
                  </button>
                </div>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={inflation} 
                onChange={(e) => updateInflation(ingredient, Number(e.target.value))}
                className="w-full accent-rose-500 cursor-ew-resize opacity-80 hover:opacity-100 transition-opacity" 
              />
            </div>
          ))}
          {Object.keys(simulatedInflations).length === 0 && (
            <div className={`col-span-full py-6 flex flex-col items-center justify-center rounded-[2rem] border border-dashed transition-colors ${isDarkMode ? 'border-white/10 text-white/20' : 'border-slate-200 text-slate-400'}`}>
              <p className="text-[10px] uppercase font-black tracking-widest opacity-50">No ingredient inflations active. Baseline costs applied.</p>
            </div>
          )}
        </div>

        {/* Real-time Impact Matrix */}
        <div className="space-y-4">
          <h4 className={`text-[10px] font-black uppercase tracking-[0.3em] mb-6 ${isDarkMode ? 'text-gold' : 'text-slate-500'}`}>Product Price Adjustment & Profit Impact</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {inventory.products.map(p => {
              // 1. Calculate Old vs New Cost
              const oldCost = p.ingredients.reduce((sum, ing) => {
                const mat = inventory.materials[ing.name];
                return sum + ((ing.quantity / 1000) * (mat ? mat.price : 0));
              }, 0) || p.live_cost || 0;

              const newCost = p.ingredients.reduce((sum, ing) => {
                const mat = inventory.materials[ing.name];
                const basePrice = mat ? mat.price : 0;
                const inflationMult = 1 + ((simulatedInflations[ing.name] || 0) / 100);
                return sum + ((ing.quantity / 1000) * basePrice * inflationMult);
              }, 0) || p.live_cost || 0;

              const costDelta = newCost - oldCost;

              // 2. Selling Price Simulation
              const currentSimPrice = simPrices[p.id] ?? p.price;
              const priceDelta = currentSimPrice - p.price;

              // 3. Profit & Margin Calculations
              const oldProfit = p.price - oldCost;
              const newProfit = currentSimPrice - newCost;
              const profitDelta = newProfit - oldProfit;
              
              const oldMargin = p.price > 0 ? (oldProfit / p.price) * 100 : 0;
              const newMargin = currentSimPrice > 0 ? (newProfit / currentSimPrice) * 100 : 0;
              
              const isMarginCritical = newMargin < 65;

              return (
                <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`p-6 rounded-3xl border transition-all ${isDarkMode ? 'border-white/5 bg-white/5' : 'border-slate-200 bg-white shadow-sm'} ${isMarginCritical ? 'border-rose-500/30 shadow-[0_0_20px_rgba(244,63,94,0.1)]' : ''}`}>
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{p.icon}</span>
                      <div>
                        <h5 className="font-bold uppercase text-xs tracking-widest">{p.name}</h5>
                        <p className={`text-[9px] uppercase font-black tracking-widest ${isMarginCritical ? 'text-rose-500' : 'text-emerald-500'}`}>Margin: {newMargin.toFixed(1)}%</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={currentSimPrice}
                        onChange={(e) => setSimPrices({ ...simPrices, [p.id]: parseFloat(e.target.value) || 0 })}
                        className={`w-20 text-right font-black bg-transparent border-b-2 outline-none py-1 text-sm transition-colors ${currentSimPrice !== p.price ? 'border-gold text-gold' : (isDarkMode ? 'border-white/10 text-white' : 'border-slate-200 text-slate-900')}`}
                      />
                      <span className="text-[10px] opacity-40 font-black">MAD</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-[8px] font-black uppercase tracking-widest opacity-40">Unit Cost Impact</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] line-through opacity-40">{formatPrice(oldCost)}</span>
                        <span className={`text-xs font-bold ${costDelta > 0 ? 'text-rose-400' : ''}`}>{formatPrice(newCost)}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[8px] font-black uppercase tracking-widest opacity-40">Unit Profit Impact</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] line-through opacity-40">{formatPrice(oldProfit)}</span>
                        <span className={`text-xs font-bold ${profitDelta < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{formatPrice(newProfit)}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Hourly Sales */}
        <div className={`p-8 rounded-[2.5rem] border transition-colors ${isDarkMode ? 'glass-panel' : 'bg-white border-slate-200 shadow-xl'}`}>
          <h3 className={`text-xl font-bold luxury-font uppercase mb-8 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Hourly Volume</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.hourlySales}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} vertical={false} />
                <XAxis dataKey="hour" fontSize={10} axisLine={false} tickLine={false} tick={{ fill: isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }} />
                <Tooltip contentStyle={{ backgroundColor: isDarkMode ? '#0a0a0b' : '#fff', border: 'none', borderRadius: '15px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }} itemStyle={{ color: '#d4af37', fontWeight: 'bold' }} />
                <Bar dataKey="value" fill="#d4af37" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Volume Distribution */}
        <div className={`p-8 rounded-[2.5rem] border transition-colors ${isDarkMode ? 'glass-panel' : 'bg-white border-slate-200 shadow-xl'}`}>
          <h3 className={`text-xl font-bold luxury-font uppercase mb-8 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Volume Distribution</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={analytics.topProducts} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {analytics.topProducts.map((_, idx) => <Cell key={idx} fill={PIE_COLORS[idx % 5]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: isDarkMode ? '#0a0a0b' : '#fff', border: 'none', borderRadius: '15px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-4 mt-4">
            {analytics.topProducts.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % 5] }} />
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPanel;
