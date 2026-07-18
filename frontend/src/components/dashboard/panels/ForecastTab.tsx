import React from 'react';
import { TrendingUp } from 'lucide-react';
import { SummaryCard } from './ForecastSummaryCard';
import { InsightCard } from './ForecastInsightCard';
import type { ForecastTabProps } from './ForecastPanel.types';
import { Table, TableHeader, TableBody, TableRow, Th, Td } from '../../ui/Table';
import { LoadingSpinner } from '../../ui/LoadingSpinner';
import { EmptyState } from '../../ui/EmptyState';

export const ForecastTab = (props: ForecastTabProps) => {
  const { forecasts, loading, isDarkMode, t, targetDate, confidenceColor, confidenceLabel } = props;

  if (loading) {
    return (
      <LoadingSpinner
        message={t('calculating_forecast', { defaultValue: 'Calculating demand forecast...' })}
        isDarkMode={isDarkMode}
      />
    );
  }

  if (!forecasts.length) {
    return (
      <EmptyState
        icon={TrendingUp}
        title={t('no_forecast_data', { defaultValue: 'No forecast data available' })}
        subtitle={t('no_forecast_data_desc', { defaultValue: 'Add sales history to generate forecasts' })}
        isDarkMode={isDarkMode}
      />
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
        <Table>
          <TableHeader isDarkMode={isDarkMode}>
            <Th className="px-6 py-4">{t('product')}</Th>
            <Th className="px-6 py-4 text-center">{t('confidence')}</Th>
            <Th className="px-6 py-4 text-center">{t('data_points')}</Th>
            <Th className="px-6 py-4">{t('weekday_breakdown')}</Th>
            <Th className="px-6 py-4 text-right">{t('horizon_qty')}</Th>
          </TableHeader>
          <TableBody isDarkMode={isDarkMode}>
            {forecasts.map(f => (
              <TableRow key={f.product_id} className={isDarkMode ? '' : 'hover:bg-slate-50'} isDarkMode={isDarkMode}>
                <Td className="px-6 py-4">
                  <p className={`font-bold text-sm ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>{f.product_name}</p>
                  <p className={`text-[10px] uppercase tracking-widest ${isDarkMode ? 'text-gold/60' : 'text-slate-400'}`}>
                    ID: {f.product_id}
                  </p>
                </Td>
                <Td className="px-6 py-4 text-center">
                  <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${confidenceColor(f.confidence)}`}>
                    {confidenceLabel(f.confidence)}
                  </span>
                </Td>
                <Td className="px-6 py-4 text-center">
                  <span className={`text-sm font-mono ${isDarkMode ? 'text-cream/60' : 'text-slate-500'}`}>
                    {f.data_points}
                  </span>
                </Td>
                <Td className="px-6 py-4">
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
                </Td>
                <Td className="px-6 py-4 text-right">
                  <span className={`text-xl font-bold ${isDarkMode ? 'text-gold' : 'text-slate-900'}`}>
                    {f.horizon_qty}
                  </span>
                  <span className={`ml-2 text-[10px] uppercase tracking-widest ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>
                    {t('units')}
                  </span>
                </Td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
