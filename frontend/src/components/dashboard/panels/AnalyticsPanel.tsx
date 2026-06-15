import { useTranslation } from 'react-i18next';
import React, { useMemo } from 'react';
import { FileText, Plus, TrendingUp, X } from 'lucide-react';
import { BarChart, Bar, XAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { motion } from 'framer-motion';
import { DashboardSharedProps } from '../types';

const PIE_COLORS = ['#d4af37', '#b8860b', '#f3e5ab', '#10b981', '#f43f5e'];

const CustomTooltip = ({ active, payload, label, isDarkMode }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className={`p-4 luxury-card ${isDarkMode ? 'shadow-gold-glow' : 'shadow-xl'}`}>
        <p className={`text-[11px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>{label}</p>
        <p className="text-xl font-black text-gold">
          {payload[0].value}
        </p>
      </div>
    );
  }
  return null;
};

type Props = Pick<DashboardSharedProps,
  'isDarkMode' | 'analytics' | 'inventory' | 'simPrices' | 'setSimPrices' |
  'simulatedInflations' | 'setSimulatedInflations' | 'formatPrice' |
  'handleUpdateProductField' | 'api' | 'fetchData' | 'addToast'>;

const AnalyticsPanel: React.FC<Props> = ({
  isDarkMode, analytics, inventory, simPrices, setSimPrices,
  simulatedInflations, setSimulatedInflations, formatPrice,
  handleUpdateProductField, api, fetchData, addToast
}) => {
  const { t } = useTranslation();


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
        addToast(t('pricing_strategy_committed_suc'), 'success');
        setSimPrices({});
        setSimulatedInflations({});
        fetchData();
      } else {
        addToast(t('no_price_changes_to_commit'), 'info');
      }
    } catch (e) {
      addToast(t('failed_to_commit_pricing_strat'), 'error');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Master Elite Pricing Engine */}
      <div className={`p-10 luxury-panel ${isDarkMode ? 'border-gold/20' : ''}`}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
          <div>
            <h3 className={`text-2xl font-bold luxury-font uppercase flex items-center gap-3 tracking-tighter ${isDarkMode ? 'text-gold' : 'text-slate-900'}`}>
              <div className={`p-3 rounded-2xl ${isDarkMode ? 'bg-gold/10' : 'bg-slate-100'}`}>
                <TrendingUp size={20} className={isDarkMode ? 'text-gold' : 'text-slate-900'} />
              </div>
              {t('elite_master_pricing_engine')}
            </h3>
            <p className="text-[11px] uppercase tracking-widest opacity-60 mt-2 ml-14">{t('simulate_cost_hikes')}</p>
          </div>
          
          <div className="flex items-center gap-4">
            {Object.keys(simPrices).length > 0 && (
              <button onClick={handleCommitStrategy} className={`px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-xl ${isDarkMode ? 'bg-gold text-charcoal hover:scale-105 shadow-[0_0_20px_rgba(212,175,55,0.4)]' : 'bg-slate-900 text-white hover:bg-slate-800'}`}>
                {t('commit_strategy')}
              </button>
            )}
            <div className="relative group">
              <select 
                onChange={(e) => { addSimulation(e.target.value); e.target.value = ''; }}
                className={`appearance-none cursor-pointer pl-6 pr-12 py-4 text-[11px] font-black uppercase tracking-widest rounded-2xl border transition-all outline-none ${isDarkMode ? 'bg-black/80 border-gold/20 text-gold hover:bg-gold hover:text-charcoal' : 'bg-slate-50 border-slate-200 text-slate-900 hover:bg-slate-900 hover:text-white'}`}
                defaultValue=""
              >
                <option value="" disabled className={isDarkMode ? 'bg-[#0a0a0b] text-gold/50' : ''}>{t('inflate_ingredient_cost')}</option>
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
            <div key={ingredient} className={`p-6 relative group overflow-hidden luxury-card ${inflation > 0 ? (isDarkMode ? 'shadow-[0_0_30px_rgba(244,63,94,0.15)] border-rose-500/30' : 'shadow-lg border-rose-200') : ''}`}>
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
            <div className={`col-span-full py-12 flex flex-col items-center justify-center luxury-card opacity-60`}>
              <TrendingUp size={32} className="mb-4 text-gold opacity-50" />
              <p className="text-[11px] uppercase font-black tracking-widest">{t('no_ingredient_inflations_activ')}</p>
            </div>
          )}
        </div>

        {/* Real-time Impact Matrix */}
        <div className="space-y-4">
          <h4 className={`text-[11px] font-black uppercase tracking-[0.3em] mb-6 ${isDarkMode ? 'text-gold' : 'text-slate-500'}`}>{t('product_price_adjustment_profi')}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {inventory.products.map(p => {
              // 1. Calculate Old vs New Cost
              const oldCost = p.ingredients.reduce((sum, ing) => {
                const mat = inventory.materials[ing.name];
                const factor = mat && ['kg', 'L', 'l'].includes(mat.unit) ? 1000 : 1;
                return sum + ((ing.quantity / factor) * (mat ? mat.price : 0));
              }, 0) || p.live_cost || 0;

              const newCost = p.ingredients.reduce((sum, ing) => {
                const mat = inventory.materials[ing.name];
                const factor = mat && ['kg', 'L', 'l'].includes(mat.unit) ? 1000 : 1;
                const basePrice = mat ? mat.price : 0;
                const inflationMult = 1 + ((simulatedInflations[ing.name] || 0) / 100);
                return sum + ((ing.quantity / factor) * basePrice * inflationMult);
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
                <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`p-6 luxury-card ${isMarginCritical ? 'border-rose-500/30 shadow-[0_0_20px_rgba(244,63,94,0.1)]' : ''}`}>
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
                      <span className="text-[10px] opacity-40 font-black">{t('mad')}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-60">{t('unit_cost_impact')}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] line-through opacity-60">{formatPrice(oldCost)}</span>
                        <span className={`text-xs font-bold ${costDelta > 0 ? 'text-rose-400' : ''}`}>{formatPrice(newCost)}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-60">{t('unit_profit_impact')}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] line-through opacity-60">{formatPrice(oldProfit)}</span>
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
        <div className="p-8 luxury-panel">
          <h3 className={`text-xl font-bold luxury-font uppercase mb-8 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t('hourly_volume')}</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.hourlySales}>
                <defs>
                  <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f3e5ab" />
                    <stop offset="50%" stopColor="#d4af37" />
                    <stop offset="100%" stopColor="#b8860b" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} vertical={false} />
                <XAxis dataKey="hour" fontSize={10} axisLine={false} tickLine={false} tick={{ fill: isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }} />
                <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} />} cursor={{fill: 'transparent'}} />
                <Bar dataKey="value" fill="url(#goldGradient)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Volume Distribution */}
        <div className="p-8 luxury-panel">
          <h3 className={`text-xl font-bold luxury-font uppercase mb-8 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t('volume_distribution')}</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={analytics.topProducts} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {analytics.topProducts.map((_, idx) => <Cell key={idx} fill={PIE_COLORS[idx % 5]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-4 mt-4">
            {analytics.topProducts.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % 5] }} />
                <span className="text-[11px] font-bold uppercase tracking-widest opacity-60">{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPanel;
