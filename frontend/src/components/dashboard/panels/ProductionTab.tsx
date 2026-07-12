import React from 'react';
import { Package, Loader2 } from 'lucide-react';
import type { ProductionTabProps } from './ForecastPanel.types';

export const ProductionTab = (props: ProductionTabProps) => {
  const { suggestions, loading, isDarkMode, t, formatPrice } = props;
  if (loading) return <div className="h-[400px] flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-gold" /></div>;

  if (!suggestions.length) {
    return (
      <div className="p-12 text-center">
        <Package className={`w-16 h-16 mx-auto mb-4 ${isDarkMode ? 'text-white/10' : 'text-slate-200'}`} />
        <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t('no_production_needed')}</h3>
        <p className={`mt-2 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>{t('stock_covers_demand')}</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <h2 className={`text-2xl font-bold luxury-font uppercase ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
        {t('production_plan_for', { defaultValue: 'Production Plan for' })} {new Date().toLocaleDateString()}
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className={`border-b text-[10px] font-black uppercase tracking-[0.2em] ${isDarkMode ? 'border-white/5 text-cream/40' : 'border-slate-100 text-slate-400'}`}>
              <th className="px-6 py-4">{t('product')}</th>
              <th className="px-6 py-4 text-center">{t('demand')}</th>
              <th className="px-6 py-4 text-center">{t('current_stock')}</th>
              <th className="px-6 py-4 text-center">{t('to_produce')}</th>
              <th className="px-6 py-4">{t('ingredient_readiness')}</th>
              <th className="px-6 py-4 text-right">{t('estimated_cost')}</th>
            </tr>
          </thead>
          <tbody className={`${isDarkMode ? 'divide-white/5' : 'divide-slate-100'}`}>
            {suggestions.map(s => (
              <tr key={s.product_id} className="group hover:bg-white/[0.02] transition-colors">
                <td className="px-6 py-4">
                  <p className={`font-bold text-sm ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>{s.product_name}</p>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{s.demand}</span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`text-sm ${isDarkMode ? 'text-cream/60' : 'text-slate-500'}`}>{s.current_stock}</span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`font-bold text-lg ${s.net_production > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {s.net_production > 0 ? '+' : ''}{s.net_production}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1.5">
                    {s.lot_usage.slice(0, 3).map(lu => (
                      <span
                        key={lu.ingredient_id}
                        className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest ${
                          s.can_produce
                            ? (isDarkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-700')
                            : (isDarkMode ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-50 text-rose-700')
                        }`}
                      >
                        {lu.ingredient_name}: {lu.required_qty}/{lu.available_lots.reduce((a, b) => a + b.quantity, 0)}
                      </span>
                    ))}
                    {s.lot_usage.length > 3 && (
                      <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'bg-white/5 text-cream/40' : 'bg-slate-100 text-slate-500'}`}>
                        +{s.lot_usage.length - 3} more
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className={`text-lg font-bold ${isDarkMode ? 'text-gold' : 'text-slate-900'}`}>
                    {formatPrice(s.lot_usage.reduce((sum, lu) => sum + lu.required_qty * 0.5, 0))}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
