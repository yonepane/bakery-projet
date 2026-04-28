import React from 'react';
import { FileText, Zap } from 'lucide-react';
import { BarChart, Bar, XAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { motion } from 'framer-motion';
import { DashboardSharedProps } from '../types';

const PIE_COLORS = ['#d4af37', '#b8860b', '#f3e5ab', '#10b981', '#f43f5e'];

type Props = Pick<DashboardSharedProps,
  'isDarkMode' | 'analytics' | 'inventory' | 'simPrices' | 'setSimPrices' |
  'simulationResult' | 'runSimulation' | 'saveSimulation' | 'formatPrice'>;

const AnalyticsPanel: React.FC<Props> = ({
  isDarkMode, analytics, inventory, simPrices, setSimPrices,
  simulationResult, runSimulation, saveSimulation, formatPrice,
}) => (
  <div className="space-y-8 animate-in fade-in duration-500">
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Price Simulation */}
      <div className={`p-8 rounded-[2.5rem] border transition-colors ${isDarkMode ? 'border-gold/20 bg-black/20 shadow-gold-glow' : 'border-slate-200 bg-white shadow-sm'}`}>
        <h3 className={`text-xl font-bold luxury-font uppercase mb-8 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Price Simulation</h3>
        <div className="space-y-6 mb-8">
          {inventory.products.map(p => (
            <div key={p.id} className="flex items-center justify-between gap-4">
              <span className="text-sm font-bold">{p.icon} {p.name}</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={simPrices[p.id] ?? p.price}
                  onChange={(e) => setSimPrices({ ...simPrices, [p.id]: parseFloat(e.target.value) || 0 })}
                  className={`w-24 text-right font-bold bg-transparent border-b outline-none py-1 text-sm ${isDarkMode ? 'border-white/10 text-gold' : 'border-slate-200 text-slate-900'}`}
                />
                <span className="text-[10px] opacity-40">MAD</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-4">
          <button onClick={runSimulation} className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border transition-all ${isDarkMode ? 'border-gold/20 text-gold hover:bg-gold hover:text-charcoal' : 'bg-slate-100 text-slate-900 border-slate-200 hover:bg-slate-200'}`}>
            <Zap size={14} className="inline mr-2" />Run
          </button>
          <button onClick={saveSimulation} disabled={!simulationResult.length} className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-30 ${isDarkMode ? 'bg-gold text-charcoal shadow-gold-glow' : 'bg-slate-900 text-white'}`}>
            Apply
          </button>
        </div>
      </div>

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

    {/* Market Performance - Simulation Results */}
    <div className={`lg:col-span-2 rounded-[2.5rem] border p-8 transition-colors ${isDarkMode ? 'glass-panel' : 'bg-white border-slate-200 shadow-xl'}`}>
      <h3 className={`text-xl font-bold luxury-font uppercase mb-8 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Market Performance</h3>
      <div className="space-y-4">
        {simulationResult.map((res: any) => {
          const isPositive = res.profit_delta > 0;
          return (
            <motion.div key={res.name} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className={`p-6 rounded-3xl border transition-all ${isDarkMode ? 'border-white/5 bg-white/5' : 'border-slate-200 bg-white shadow-sm'}`}>
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
            <FileText size={64} />
            <p className="mt-6 font-black text-xs uppercase tracking-[0.3em]">Initialize Projection</p>
          </div>
        )}
      </div>
    </div>
  </div>
);

export default AnalyticsPanel;
