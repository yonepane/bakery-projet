import React from 'react';
import { FileText, Plus, Trash2, Zap } from 'lucide-react';
import { DashboardSharedProps } from '../types';

type Props = Pick<DashboardSharedProps,
  'isDarkMode' | 'inventory' | 'planner' | 'setPlanner' | 'formatPrice' |
  'isForecasting' | 'handleSmartForecast' | 'handleProduce' | 'displayUnit' |
  'openSelector' | 'API_BASE'>;

const PlannerPanel: React.FC<Props> = ({
  isDarkMode, inventory, planner, setPlanner, formatPrice,
  isForecasting, handleSmartForecast, handleProduce, displayUnit, openSelector, API_BASE,
}) => {
  const resourceForecast = Object.entries(
    planner.filter(p => p.status === 'pending').reduce((acc, item) => {
      const prod = inventory.products.find(p => p.id === item.product_id);
      prod?.ingredients.forEach(ing => { acc[ing.name] = (acc[ing.name] || 0) + (ing.quantity * item.quantity); });
      return acc;
    }, {} as Record<string, number>)
  ).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className={`p-10 rounded-[3.5rem] border transition-colors ${isDarkMode ? 'border-gold/20 bg-black/20 shadow-gold-glow' : 'border-slate-200 bg-white shadow-sm'}`}>
        <div className="flex justify-between items-center mb-10">
          <div>
            <h3 className={`text-2xl font-bold luxury-font uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Production Strategy</h3>
            <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${isDarkMode ? 'text-cream/20' : 'text-slate-400'}`}>Operational Batch Planning</p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => openSelector({ title: 'Smart Forecast', label: 'Target Date', value: new Date(Date.now() + 86400000).toISOString().split('T')[0], type: 'date', onConfirm: handleSmartForecast })}
              disabled={isForecasting}
              className={`flex items-center gap-3 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${isDarkMode ? 'bg-white/5 text-gold border border-white/10 hover:bg-gold hover:text-charcoal' : 'bg-slate-100 text-slate-900 border border-slate-200 hover:bg-slate-200 shadow-sm'}`}>
              <Zap size={16} className={isForecasting ? 'animate-pulse' : ''} />
              {isForecasting ? 'Analyzing...' : 'Smart Suggest'}
            </button>
            <button
              onClick={() => openSelector({ title: 'Production Sheet', label: 'Sheet Date', value: new Date().toISOString().split('T')[0], type: 'date',
                onConfirm: (date: string) => { const token = localStorage.getItem('bakery_token'); window.open(`${API_BASE}/planner/prep-sheet?date=${date}&token=${token}`, '_blank'); }
              })}
              className={`flex items-center gap-3 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${isDarkMode ? 'bg-gold/10 text-gold border border-gold/20 hover:bg-gold hover:text-charcoal' : 'bg-slate-900 text-white shadow-xl'}`}>
              <FileText size={16} />
              Print Prep List
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="space-y-6">
            <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">Initialize Batch</label>
            <select onChange={(e) => {
              const p = inventory.products.find(x => x.id === e.target.value);
              if (p) setPlanner([...planner, { id: Math.random().toString(36).substr(2, 9), date: new Date().toISOString(), product_id: p.id, quantity: 10, status: 'pending' }]);
            }} className={`p-4 rounded-2xl border outline-none font-bold text-sm ${isDarkMode ? 'bg-white/5 border-white/10 text-cream focus:border-gold/40' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-slate-400'}`}>
              <option value="">Select Entity...</option>
              {inventory.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>

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
                    <input type="number" value={item.quantity}
                      onChange={(e) => setPlanner(planner.map(p => p.id === item.id ? { ...p, quantity: parseInt(e.target.value) || 0 } : p))}
                      className="w-16 bg-transparent border-b border-gold/20 text-center font-bold text-gold outline-none" />
                    <button onClick={() => handleProduce(item.product_id, item.quantity)} className="p-3 bg-gold/10 text-gold rounded-xl hover:bg-gold hover:text-charcoal transition-all"><Zap size={18} /></button>
                    <button onClick={() => setPlanner(planner.filter(p => p.id !== item.id))} className="text-white/10 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={`p-8 rounded-3xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gold mb-8">Resource Forecast</h4>
            <div className="space-y-6">
              {resourceForecast.map(([name, req]) => (
                <div key={name} className="flex justify-between items-end">
                  <div>
                    <p className={`text-xs font-bold ${isDarkMode ? 'text-cream/60' : 'text-slate-500'}`}>{name}</p>
                    <p className={`text-lg font-black luxury-font ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      {displayUnit(req, inventory.materials[name]?.unit || 'g')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-gold uppercase tracking-widest">Available</p>
                    <p className={`text-sm font-bold ${(inventory.materials[name]?.stock || 0) < req ? 'text-red-500' : 'text-emerald-500'}`}>
                      {displayUnit(inventory.materials[name]?.stock || 0, inventory.materials[name]?.unit || 'g')}
                    </p>
                  </div>
                </div>
              ))}
              {resourceForecast.length === 0 && <p className="text-[10px] opacity-20 uppercase tracking-widest font-bold text-center py-10">Add items to batch first</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlannerPanel;
