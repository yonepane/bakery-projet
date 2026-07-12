import React from 'react';
import { Truck, Loader2 } from 'lucide-react';
import type { PurchasingTabProps } from './ForecastPanel.types';

export const PurchasingTab = (props: PurchasingTabProps) => {
  const { suggestions, loading, isDarkMode, t, formatPrice } = props;
  if (loading) return <div className="h-[400px] flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-gold" /></div>;

  if (!suggestions.length) {
    return (
      <div className="p-12 text-center">
        <Truck className={`w-16 h-16 mx-auto mb-4 ${isDarkMode ? 'text-white/10' : 'text-slate-200'}`} />
        <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t('no_purchase_needed')}</h3>
        <p className={`mt-2 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>{t('stock_covers_demand')}</p>
      </div>
    );
  }

  const highPriority = suggestions.filter(s => s.priority === 'high');
  const totalCost = suggestions.reduce((sum, s) => sum + s.estimated_cost, 0);

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
        <div>
          <h2 className={`text-2xl font-bold luxury-font uppercase ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            {t('purchase_suggestions', { defaultValue: 'Purchase Suggestions' })}
          </h2>
          <p className={`text-sm mt-1 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>
            {t('based_on_forecast_and_expiring', { defaultValue: 'Based on demand forecast and expiring stock' })}
          </p>
        </div>
        <div className="flex items-center gap-6">
          <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-slate-50 border border-slate-200'}`}>
            <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>
              {t('total_estimated_cost')}
            </p>
            <p className={`text-3xl font-bold mt-1 ${isDarkMode ? 'text-gold' : 'text-slate-900'}`}>
              {formatPrice(totalCost)}
            </p>
          </div>
          <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-rose-500/20 border border-rose-500/30' : 'bg-rose-50 border-rose-200'}`}>
            <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-rose-300' : 'text-rose-700'}`}>
              {t('high_priority_items')}
            </p>
            <p className={`text-3xl font-bold mt-1 ${isDarkMode ? 'text-rose-300' : 'text-rose-600'}`}>
              {highPriority.length}
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className={`border-b text-[10px] font-black uppercase tracking-[0.2em] ${isDarkMode ? 'border-white/5 text-cream/40' : 'border-slate-100 text-slate-400'}`}>
              <th className="px-6 py-4">{t('ingredient')}</th>
              <th className="px-6 py-4 text-center">{t('current_stock')}</th>
              <th className="px-6 py-4 text-center">{t('expiring_soon')}</th>
              <th className="px-6 py-4 text-center">{t('total_needed')}</th>
              <th className="px-6 py-4 text-center">{t('suggested_order')}</th>
              <th className="px-6 py-4 text-center">{t('priority')}</th>
              <th className="px-6 py-4 text-right">{t('est_cost')}</th>
            </tr>
          </thead>
          <tbody className={`${isDarkMode ? 'divide-white/5' : 'divide-slate-100'}`}>
            {suggestions.map(s => (
              <tr key={s.ingredient_id} className="group hover:bg-white/[0.02] transition-colors">
                <td className="px-6 py-4">
                  <p className={`font-bold text-sm ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>{s.ingredient_name}</p>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`text-sm ${isDarkMode ? 'text-cream/60' : 'text-slate-500'}`}>{s.current_stock} {s.unit}</span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${s.expiring_soon_qty > 0 ? (isDarkMode ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-50 text-amber-700') : (isDarkMode ? 'bg-white/5 text-cream/40' : 'bg-slate-100 text-slate-400')}`}>
                    {s.expiring_soon_qty} {s.unit}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{s.total_needed} {s.unit}</span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`font-bold text-lg ${isDarkMode ? 'text-gold' : 'text-slate-900'}`}>{s.suggested_order_qty} {s.unit}</span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                    s.priority === 'high' ? (isDarkMode ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-100 text-rose-700')
                    : s.priority === 'medium' ? (isDarkMode ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700')
                    : (isDarkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700')
                  }`}>
                    {t(s.priority)}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className={`font-bold ${isDarkMode ? 'text-gold' : 'text-slate-900'}`}>
                    {formatPrice(s.estimated_cost)}
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
