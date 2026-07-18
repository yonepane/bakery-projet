import { useTranslation } from 'react-i18next';
import React from 'react';
import { useDashboard } from '../DashboardContext';
import type { Product } from '../types';
import { FileText, Plus, Trash2, Zap } from 'lucide-react';
import { usePlannerMutations } from '../../../hooks/usePlannerMutations';

const PlannerPanel: React.FC = () => {
  const { isDarkMode, inventory, planner, setPlanner, formatPrice,
  isForecasting, handleSmartForecast, handleProduce, displayUnit, openSelector, getDownloadToken, API_BASE,
  wasteRecords, api, addToast, fetchData, } = useDashboard();
  const { t } = useTranslation();
  const { savePlan } = usePlannerMutations();

  const resourceForecast = Object.entries(
    planner.filter((p: { status: string }) => p.status === 'pending').reduce((acc: Record<string, number>, item: { product_id: string; quantity: number }) => {
      const prod = inventory.products.find((p: Product) => p.id === item.product_id);
      prod?.ingredients.forEach((ing: { name: string; quantity: number }) => { acc[ing.name] = (acc[ing.name] || 0) + (ing.quantity * item.quantity); });
      return acc;
    }, {} as Record<string, number>)
  ).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className={`p-10 rounded-[3.5rem] border transition-colors ${isDarkMode ? 'border-gold/20 bg-black/20 shadow-gold-glow' : 'border-slate-200 bg-white shadow-sm'}`}>
        <div className="flex justify-between items-center mb-10">
          <div>
            <h3 className={`text-2xl font-bold luxury-font uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t('production_strategy')}</h3>
            <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${isDarkMode ? 'text-cream/20' : 'text-slate-400'}`}>{t('operational_batch_planning')}</p>
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
              onClick={async () => {
                await savePlan.execute(planner);
              }}
              className={`flex items-center gap-3 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${isDarkMode ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white' : 'bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100 shadow-sm'}`}>
              {t('save_plan')}
            </button>
            <button
              onClick={() => openSelector({ title: 'Production Sheet', label: 'Sheet Date', value: new Date().toISOString().split('T')[0], type: 'date',
                onConfirm: async (date: string) => {
                  const dlToken = await getDownloadToken();
                  window.open(`${API_BASE}/planner/prep-sheet?date=${encodeURIComponent(date)}&token=${encodeURIComponent(dlToken)}`, '_blank', 'noopener,noreferrer');
                }
              })}
              className={`flex items-center gap-3 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${isDarkMode ? 'bg-gold/10 text-gold border border-gold/20 hover:bg-gold hover:text-charcoal' : 'bg-slate-900 text-white shadow-xl'}`}>
              <FileText size={16} />
              {t('print_prep_list')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="space-y-6">
            <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">{t('initialize_batch')}</label>
            <select onChange={(e) => {
              const p = inventory.products.find((x: Product) => x.id === e.target.value);
              if (p) setPlanner([...planner, { id: Math.random().toString(36).substr(2, 9), date: new Date().toISOString(), product_id: p.id, quantity: 10, status: 'pending' }]);
            }} className={`appearance-none cursor-pointer pl-6 pr-12 py-4 text-[10px] font-black uppercase tracking-widest rounded-2xl border transition-all outline-none ${isDarkMode ? 'bg-black/80 border-gold/20 text-gold hover:bg-gold hover:text-charcoal' : 'bg-slate-50 border-slate-200 text-slate-900 hover:bg-slate-900 hover:text-white'}`}>
              <option value="" disabled className={isDarkMode ? 'bg-[#0a0a0b] text-gold/50' : ''}>{t('select_entity')}</option>
              {inventory.products.map((p: Product) => <option key={p.id} value={p.id} className={isDarkMode ? 'bg-[#0a0a0b] text-gold' : ''}>{p.name}</option>)}
            </select>

            <div className="space-y-4">
              {planner.filter(p => p.status === 'pending').map(item => {
                // Predictive Wastage Engine: check last 7 days of waste for this product
                const recentWaste = wasteRecords.filter(w => {
                  const daysAgo = (Date.now() - new Date(w.date).getTime()) / (1000 * 60 * 60 * 24);
                  return w.product_id === item.product_id && daysAgo <= 7;
                });
                const totalWasted = recentWaste.reduce((sum, w) => sum + w.quantity, 0);
                const isHighWasteRisk = totalWasted > 0;

                return (
                <div key={item.id} className={`p-6 rounded-2xl border transition-all ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-100'} ${isHighWasteRisk ? 'border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.1)]' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-2xl">{inventory.products.find((p: Product) => p.id === item.product_id)?.icon}</div>
                      <div>
                        <p className={`font-bold text-sm ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>{inventory.products.find((p: Product) => p.id === item.product_id)?.name}</p>
                        {isHighWasteRisk ? (
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[8px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full">{t('high_waste_risk')}</span>
                            <span className={`text-[8px] font-bold ${isDarkMode ? 'text-cream/30' : 'text-slate-400'}`}>{totalWasted} units wasted last 7 days</span>
                          </div>
                        ) : (
                          <p className="text-[10px] text-gold font-black uppercase tracking-widest">{t('pending_execution')}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {isHighWasteRisk && (
                        <button
                          onClick={() => setPlanner(planner.map(p => p.id === item.id ? { ...p, quantity: Math.max(1, Math.round(item.quantity * 0.7)) } : p))}
                          className="px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-black transition-all"
                          title={t('auto_scale_down_by_30')}
                        >
                          {t('auto_scale_down')}
                        </button>
                      )}
                      <input type="number" value={item.quantity}
                        onChange={(e) => setPlanner(planner.map(p => p.id === item.id ? { ...p, quantity: parseInt(e.target.value) || 0 } : p))}
                        className="w-16 bg-transparent border-b border-gold/20 text-center font-bold text-gold outline-none" />
                      <button onClick={() => handleProduce(item.product_id, item.quantity)} className="p-3 bg-gold/10 text-gold rounded-xl hover:bg-gold hover:text-charcoal transition-all"><Zap size={18} /></button>
                      <button onClick={() => setPlanner(planner.filter(p => p.id !== item.id))} className="text-white/10 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          </div>

          <div className={`p-8 rounded-3xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gold mb-8">{t('resource_forecast')}</h4>
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
                    <p className="text-[10px] font-bold text-gold uppercase tracking-widest">{t('available')}</p>
                    <p className={`text-sm font-bold ${(inventory.materials[name]?.stock || 0) < req ? 'text-red-500' : 'text-emerald-500'}`}>
                      {displayUnit(inventory.materials[name]?.stock || 0, inventory.materials[name]?.unit || 'g')}
                    </p>
                  </div>
                </div>
              ))}
              {resourceForecast.length === 0 && <p className="text-[10px] opacity-20 uppercase tracking-widest font-bold text-center py-10">{t('add_items_to_batch_first')}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlannerPanel;
