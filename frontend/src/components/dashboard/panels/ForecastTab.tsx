import React from 'react';
import { Loader2, TrendingUp } from 'lucide-react';
import { SummaryCard } from './ForecastSummaryCard';
import { InsightCard } from './ForecastInsightCard';
import type { ForecastTabProps } from './ForecastPanel.types';

export const ForecastTab = (props: ForecastTabProps) => {
  const { forecasts, loading, isDarkMode, t, targetDate, confidenceColor, confidenceLabel } = props;

  if (loading) {
    return (
      <div className="h-[400px] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-gold" />
        <p className={`text-sm ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>
          {t('calculating_forecast', { defaultValue: 'Calculating demand forecast...' })}
        </p>
      </div>
    );
  }

  if (!forecasts.length) {
    return (
      <div className="p-12 text-center">
        <TrendingUp className={`w-16 h-16 mx-auto mb-4 ${isDarkMode ? 'text-white/10' : 'text-slate-200'}`} />
        <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
          {t('no_forecast_data', { defaultValue: 'No forecast data available' })}
        </h3>
        <p className={`mt-2 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>
          {t('no_forecast_data_desc', { defaultValue: 'Add sales history to generate forecasts' })}
        </p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={TrendingUp}
          label={t('total_demand', { defaultValue: 'Total Demand' })}
          value={forecasts.reduce((sum, f) => sum + f.horizon_qty, 0)}
          isDarkMode={isDarkMode}
          color="gold"
          t={t}
        />
        <SummaryCard
          icon={TrendingUp}
          label={t('high_confidence', { defaultValue: 'High Confidence' })}
          value={forecasts.filter(f => f.confidence === 'high').length}
          isDarkMode={isDarkMode}
          color="emerald"
          t={t}
        />
        <SummaryCard
          icon={TrendingUp}
          label={t('this_weekday_demand') || `Demand on ${new Date().toLocaleDateString('en-US', { weekday: 'long' })}`}
          value={Math.round(
            forecasts.reduce((sum, f) => {
              const wd = new Date().toLocaleDateString('en-US', { weekday: 'short' });
              return sum + (f.weekday_forecast[wd] || 0);
            }, 0)
          )}
          isDarkMode={isDarkMode}
          color="blue"
          t={t}
        />
        <SummaryCard
          icon={TrendingUp}
          label={t('products_with_data', { defaultValue: 'Products with Data' })}
          value={forecasts.filter(f => f.data_points > 0).length}
          isDarkMode={isDarkMode}
          color="violet"
          t={t}
        />
      </div>

      {/* Forecast Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className={`border-b text-[10px] font-black uppercase tracking-[0.2em] ${isDarkMode ? 'border-white/5 text-cream/40' : 'border-slate-100 text-slate-400'}`}>
              <th className="px-6 py-4">{t('product')}</th>
              <th className="px-6 py-4 text-center">{t('confidence')}</th>
              <th className="px-6 py-4 text-center">{t('data_points')}</th>
              <th className="px-6 py-4">{t('weekday_breakdown')}</th>
              <th className="px-6 py-4 text-right">{t('horizon_qty')}</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDarkMode ? 'divide-white/5' : 'divide-slate-100'}`}>
            {forecasts.map(f => (
              <tr key={f.product_id} className={`group hover:bg-white/[0.02] transition-colors ${isDarkMode ? '' : 'hover:bg-slate-50'}`}>
                <td className="px-6 py-4">
                  <p className={`font-bold text-sm ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>{f.product_name}</p>
                  <p className={`text-[10px] uppercase tracking-widest ${isDarkMode ? 'text-gold/60' : 'text-slate-400'}`}>
                    ID: {f.product_id}
                  </p>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${confidenceColor(f.confidence)}`}>
                    {confidenceLabel(f.confidence)}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`text-sm font-mono ${isDarkMode ? 'text-cream/60' : 'text-slate-500'}`}>
                    {f.data_points}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(f.weekday_forecast).map(([day, qty]) => (
                      <span
                        key={day}
                        className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-widest ${
                          day === new Date().toLocaleDateString('en-US', { weekday: 'short' })
                            ? (isDarkMode ? 'bg-gold/20 text-gold' : 'bg-gold/10 text-gold/90')
                            : (isDarkMode ? 'bg-white/5 text-cream/60' : 'bg-slate-100 text-slate-600')
                        }`}
                      >
                        {day}: {qty as number}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className={`text-xl font-bold ${isDarkMode ? 'text-gold' : 'text-slate-900'}`}>
                    {f.horizon_qty}
                  </span>
                  <span className={`ml-2 text-[10px] uppercase tracking-widest ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>
                    {t('units')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Insights */}
      <div className={`rounded-xl p-6 ${isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-slate-50 border border-slate-200'}`}>
        <h3 className={`text-lg font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
          {t('forecast_insights', { defaultValue: 'Key Insights' })}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InsightCard
            title={t('growth_products', { defaultValue: 'Growth Products' })}
            items={forecasts
              .filter(f => {
                const wd = new Date().toLocaleDateString('en-US', { weekday: 'short' });
                return (f.weekday_forecast[wd] as number) > 10;
              })
              .slice(0, 3)
              .map(f => f.product_name)}
            isDarkMode={isDarkMode}
          />
          <InsightCard
            title={t('declining_demand', { defaultValue: 'Declining Demand' })}
            items={forecasts
              .filter(f => {
                const wd = new Date().toLocaleDateString('en-US', { weekday: 'short' });
                return (f.weekday_forecast[wd] as number) > 0 && (f.weekday_forecast[wd] as number) < 3;
              })
              .slice(0, 3)
              .map(f => f.product_name)}
            isDarkMode={isDarkMode}
          />
          <InsightCard
            title={t('low_confidence', { defaultValue: 'Low Confidence' })}
            items={forecasts
              .filter(f => f.confidence === 'low')
              .slice(0, 3)
              .map(f => f.product_name)}
            isDarkMode={isDarkMode}
          />
        </div>
      </div>
    </div>
  );
};
