import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import type { ExpiringTabProps } from './ForecastPanel.types';

export const ExpiringTab = (props: ExpiringTabProps) => {
  const { suggestions, loading, isDarkMode, t, formatPrice } = props;
  if (loading) return <div className="h-[400px] flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-gold" /></div>;

  if (!suggestions.length) {
    return (
      <div className="p-12 text-center">
        <AlertTriangle className={`w-16 h-16 mx-auto mb-4 ${isDarkMode ? 'text-white/10' : 'text-slate-200'}`} />
        <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t('no_expiring_stock')}</h3>
        <p className={`mt-2 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>{t('all_stock_fresh')}</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <h2 className={`text-2xl font-bold luxury-font uppercase ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
        {t('expiring_stock_usage_ideas', { defaultValue: 'Expiring Stock Usage Ideas' })}
      </h2>
      <div className="space-y-6">
        {suggestions.map(s => (
          <div key={s.product_id} className={`p-6 rounded-xl border ${isDarkMode ? 'bg-[#1a1a1c] border-white/5' : 'bg-white border-slate-200'}`}>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
              <div>
                <h3 className={`text-xl font-bold luxury-font uppercase ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {s.product_name}
                </h3>
                <p className={`text-sm mt-1 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>
                  {t('use_expiring_ingredients', { defaultValue: 'Use these expiring ingredients in' })} {s.product_name}
                </p>
              </div>
              <span className={`px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-widest ${isDarkMode ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-50 text-amber-700'}`}>
                {t('expiring_soon', { defaultValue: 'Expiring Soon' })}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {s.expiring_ingredients.map((ing: any, i: number) => (
                <div key={i} className={`p-4 rounded-lg ${isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-slate-50 border border-slate-200'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`font-bold ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>{ing.ingredient_name}</span>
                    <span className={`px-2 py-1 rounded text-[10px] font-bold ${isDarkMode ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-100 text-rose-700'}`}>
                      {ing.qty} {'units'}
                    </span>
                  </div>
                  <p className={`text-sm ${isDarkMode ? 'text-cream/60' : 'text-slate-500'}`}>
                    {t('expires', { defaultValue: 'Expires' })}: {ing.expires_at ? new Date(ing.expires_at).toLocaleDateString() : 'Unknown'}
                  </p>
                  {ing.suggested_products && ing.suggested_products.length > 0 && (
                    <p className={`text-[10px] font-bold uppercase tracking-widest mt-2 ${isDarkMode ? 'text-gold/60' : 'text-gold/80'}`}>
                      {t('also_good_for')}: {ing.suggested_products.join(', ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
