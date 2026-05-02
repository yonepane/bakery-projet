import React from 'react';
import { Brain, TrendingUp, TrendingDown, Zap, Trophy, Star } from 'lucide-react';
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
        <div className={`relative overflow-hidden rounded-[2rem] border transition-all ${
          isDarkMode
            ? 'border-gold/30 bg-gradient-to-br from-gold/10 via-gold/5 to-transparent'
            : 'bg-gradient-to-br from-amber-50 via-yellow-50 to-white border-amber-200'
        }`}>
          {/* Glow blob */}
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-gold/10 blur-3xl pointer-events-none" />

          <div className="relative p-7 flex items-center gap-6">
            {/* Rank badge */}
            <div className={`relative shrink-0 w-20 h-20 rounded-2xl flex flex-col items-center justify-center shadow-lg ${
              isDarkMode ? 'bg-gold/20 border border-gold/30' : 'bg-amber-100 border border-amber-300'
            }`}>
              <Trophy size={26} className="text-gold" />
              <span className="text-[9px] font-black uppercase tracking-widest text-gold mt-1">#1</span>
            </div>

            {/* Main info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Star size={11} className="text-gold fill-gold" />
                <p className="text-[10px] font-black uppercase tracking-widest text-gold">Top Performer</p>
              </div>
              <p className={`text-2xl font-bold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {topProduct.icon} {topProduct.name}
              </p>
              {/* Margin bar */}
              <div className="mt-3 flex items-center gap-3">
                <div className={`flex-1 h-2 rounded-full ${isDarkMode ? 'bg-white/10' : 'bg-amber-100'}`}>
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-gold to-amber-300 transition-all duration-700"
                    style={{ width: `${Math.min(topProduct.margin, 100)}%` }}
                  />
                </div>
                <span className="text-gold font-black text-sm shrink-0">{topProduct.margin.toFixed(1)}%</span>
              </div>
            </div>

            {/* Stat pills */}
            <div className="shrink-0 flex flex-col gap-2">
              <div className={`px-4 py-2 rounded-xl text-center ${
                isDarkMode ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-200'
              }`}>
                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Sell</p>
                <p className="text-sm font-bold text-emerald-400">{formatPrice(topProduct.sellPrice)}</p>
              </div>
              <div className={`px-4 py-2 rounded-xl text-center ${
                isDarkMode ? 'bg-rose-500/10 border border-rose-500/20' : 'bg-rose-50 border border-rose-200'
              }`}>
                <p className="text-[9px] font-black uppercase tracking-widest text-rose-400">Cost</p>
                <p className="text-sm font-bold text-rose-400">{formatPrice(topProduct.unitCost)}</p>
              </div>
            </div>
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
