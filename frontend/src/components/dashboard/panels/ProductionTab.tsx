import React from 'react';
import { Package } from 'lucide-react';
import type { ProductionTabProps } from './ForecastPanel.types';
import { Table, TableHeader, TableBody, TableRow, Th, Td } from '../../ui/Table';
import { LoadingSpinner } from '../../ui/LoadingSpinner';
import { EmptyState } from '../../ui/EmptyState';

export const ProductionTab = (props: ProductionTabProps) => {
  const { suggestions, loading, isDarkMode, t, formatPrice } = props;
  if (loading) return <LoadingSpinner />;

  if (!suggestions.length) {
    return (
      <EmptyState
        icon={Package}
        title={t('no_production_needed')}
        subtitle={t('stock_covers_demand')}
        isDarkMode={isDarkMode}
      />
    );
  }

  return (
    <div className="p-8 space-y-8">
      <h2 className={`text-2xl font-bold luxury-font uppercase ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
        {t('production_plan_for', { defaultValue: 'Production Plan for' })} {new Date().toLocaleDateString()}
      </h2>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader isDarkMode={isDarkMode}>
            <Th className="px-6 py-4">{t('product')}</Th>
            <Th className="px-6 py-4 text-center">{t('demand')}</Th>
            <Th className="px-6 py-4 text-center">{t('current_stock')}</Th>
            <Th className="px-6 py-4 text-center">{t('to_produce')}</Th>
            <Th className="px-6 py-4">{t('ingredient_readiness')}</Th>
            <Th className="px-6 py-4 text-right">{t('estimated_cost')}</Th>
          </TableHeader>
          <TableBody isDarkMode={isDarkMode}>
            {suggestions.map(s => (
              <TableRow key={s.product_id} isDarkMode={isDarkMode}>
                <Td className="px-6 py-4">
                  <p className={`font-bold text-sm ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>{s.product_name}</p>
                </Td>
                <Td className="px-6 py-4 text-center">
                  <span className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{s.demand}</span>
                </Td>
                <Td className="px-6 py-4 text-center">
                  <span className={`text-sm ${isDarkMode ? 'text-cream/60' : 'text-slate-500'}`}>{s.current_stock}</span>
                </Td>
                <Td className="px-6 py-4 text-center">
                  <span className={`font-bold text-lg ${s.net_production > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {s.net_production > 0 ? '+' : ''}{s.net_production}
                  </span>
                </Td>
                <Td className="px-6 py-4">
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
                </Td>
                <Td className="px-6 py-4 text-right">
                  <span className={`text-lg font-bold ${isDarkMode ? 'text-gold' : 'text-slate-900'}`}>
                    {formatPrice(s.lot_usage.reduce((sum, lu) => sum + lu.required_qty * 0.5, 0))}
                  </span>
                </Td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
