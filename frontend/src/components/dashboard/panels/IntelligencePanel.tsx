import React from 'react';
import { Brain, TrendingUp, TrendingDown, Zap } from 'lucide-react';
import { DashboardSharedProps } from '../types';

type Props = Pick<DashboardSharedProps,
  'isDarkMode' | 'profitReport' | 'inventory' | 'formatPrice' | 'analytics'>;

const IntelligencePanel: React.FC<Props> = ({ isDarkMode, profitReport, inventory, formatPrice, analytics }) => {
  // Normalize the profit report — backend may return product_name/cost_price/selling_price
  // or name/unit_cost/sell_price depending on cache state. Support both shapes.
  const normalizedReport = (profitReport.length > 0 ? profitReport : inventory.products.map(p => ({
    product_name: p.name,
    name: p.name,
    icon: p.icon,
    selling_price: p.price,
    sell_price: p.price,
    cost_price: p.live_cost || 0,
    unit_cost: p.live_cost || 0,
    margin_percentage: p.price > 0 ? `${((p.price - (p.live_cost || 0)) / p.price * 100).toFixed(1)}%` : '0%',
  }))).map((p: any) => ({
    name: p.product_name || p.name || 'Unknown',
    icon: p.icon || '🥐',
    sellPrice: p.selling_price ?? p.sell_price ?? 0,
    unitCost: p.cost_price ?? p.unit_cost ?? 0,
    margin: parseFloat((p.margin_percentage || p.margin || '0').toString().replace('%', '')),
    roi: p.roi_percentage ? parseFloat(p.roi_percentage.replace('%', '')) : 0,
  }));

  const topProduct = [...normalizedReport].sort((a, b) => b.margin - a.margin)[0];
  const atRisk = normalizedReport.filter(p => p.margin < 25);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-gold/10 text-gold shadow-gold-glow' : 'bg-slate-900 text-white'}`}>
          <Brain size={26} />
        </div>
        <div>
          <h3 className={`text-3xl font-bold luxury-font uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Intelligence Matrix</h3>
          <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${isDarkMode ? 'text-cream/30' : 'text-slate-400'}`}>Live portfolio performance analysis</p>
        </div>
      </div>

      {/* Portfolio KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { label: 'Portfolio Cost', value: formatPrice(analytics.intelligence.total_portfolio_cost), color: 'text-rose-400' },
          { label: 'Average Margin', value: analytics.intelligence.average_margin, color: 'text-emerald-400' },
          { label: 'Active SKUs', value: String(analytics.intelligence.products_count || normalizedReport.length), color: isDarkMode ? 'text-gold' : 'text-slate-900' },
          { label: 'At-Risk Products', value: String(atRisk.length), color: atRisk.length > 0 ? 'text-rose-400' : 'text-emerald-400' },
        ].map((kpi, i) => (
          <div key={i} className={`p-6 rounded-[2rem] border transition-all ${isDarkMode ? 'glass-panel hover:-translate-y-1' : 'bg-white border-slate-200 shadow-xl'}`}>
            <p className={`text-[10px] font-black uppercase tracking-widest mb-3 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>{kpi.label}</p>
            <p className={`text-3xl font-bold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Star product callout */}
      {topProduct && (
        <div className={`p-6 rounded-[2rem] border flex items-center gap-5 ${isDarkMode ? 'border-gold/20 bg-gold/5' : 'bg-amber-50 border-amber-200'}`}>
          <Zap size={22} className="text-gold shrink-0" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gold">Top Performer</p>
            <p className={`text-lg font-bold mt-0.5 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {topProduct.icon} {topProduct.name} — {topProduct.margin.toFixed(1)}% margin
            </p>
          </div>
        </div>
      )}

      {/* Profit Report Table */}
      <div className={`rounded-[2rem] border overflow-hidden transition-colors ${isDarkMode ? 'glass-panel' : 'bg-white border-slate-200 shadow-xl'}`}>
        <div className={`p-8 border-b ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
          <h3 className={`text-xl font-bold luxury-font uppercase ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Per-Product Profitability</h3>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className={`border-b text-[10px] font-black uppercase tracking-[0.2em] ${isDarkMode ? 'border-white/5 text-cream/40' : 'border-slate-100 text-slate-400'}`}>
              <th className="px-8 py-5">Product</th>
              <th className="px-8 py-5 text-right">Sell Price</th>
              <th className="px-8 py-5 text-right">Unit Cost</th>
              <th className="px-8 py-5 text-right">Margin</th>
              <th className="px-8 py-5 text-right">Signal</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDarkMode ? 'divide-white/5' : 'divide-slate-100'}`}>
            {normalizedReport.map((p, i) => {
              const isHealthy = p.margin >= 25;
              return (
                <tr key={i} className="group hover:bg-white/[0.02] transition-colors">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{p.icon}</span>
                      <p className={`font-bold ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>{p.name}</p>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <span className={`font-bold ${isDarkMode ? 'text-gold' : 'text-slate-900'}`}>{formatPrice(p.sellPrice)}</span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <span className="font-bold text-rose-400">{formatPrice(p.unitCost)}</span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <span className={`font-bold text-sm ${isHealthy ? 'text-emerald-400' : 'text-rose-400'}`}>{p.margin.toFixed(1)}%</span>
                      <div className={`h-1 rounded-full w-16 ${isDarkMode ? 'bg-white/5' : 'bg-slate-100'}`}>
                        <div className={`h-1 rounded-full transition-all ${isHealthy ? 'bg-emerald-400' : 'bg-rose-400'}`} style={{ width: `${Math.min(p.margin, 100)}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    {isHealthy
                      ? <div className="flex items-center justify-end gap-2 text-emerald-500 text-[10px] font-black uppercase tracking-widest"><TrendingUp size={14} /> Healthy</div>
                      : <div className="flex items-center justify-end gap-2 text-rose-500 text-[10px] font-black uppercase tracking-widest"><TrendingDown size={14} /> Low Margin</div>
                    }
                  </td>
                </tr>
              );
            })}
            {normalizedReport.length === 0 && (
              <tr><td colSpan={5} className="px-8 py-20 text-center">
                <Brain size={48} className="mx-auto mb-4 opacity-10" />
                <p className="text-[10px] font-black uppercase tracking-widest opacity-20">No products found — add products in Inventory</p>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default IntelligencePanel;
