/**
 * FinancePanel — Month-end P&L accounting view.
 *
 * Shows filterable date range, revenue vs expense breakdown, net profit,
 * waste deductions, profit-by-product table, and export controls.
 */
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FileText, TrendingDown, TrendingUp } from 'lucide-react';
import { DashboardSharedProps } from '../types';

type Props = Pick<DashboardSharedProps,
  | 'isDarkMode'
  | 'formatPrice'
  | 'accountingRange'
  | 'setAccountingRange'
  | 'filteredSales'
  | 'filteredExpenses'
  | 'filteredWaste'
  | 'filteredPurchaseOrders'
  | 'monthlySales'
  | 'monthlyExpensesTotal'
  | 'monthlyNetAfterExpenses'
  | 'draftPurchaseCommitment'
  | 'expenseBreakdown'
  | 'productProfitability'
  | 'wasteByProduct'
  | 'accountingFeed'
  | 'openDocument'
  | 'API_BASE'
>;

const FinancePanel: React.FC<Props> = ({
  isDarkMode, formatPrice, accountingRange, setAccountingRange,
  filteredSales, filteredExpenses, filteredWaste, filteredPurchaseOrders,
  monthlySales, monthlyExpensesTotal, monthlyNetAfterExpenses, draftPurchaseCommitment,
  expenseBreakdown, productProfitability, wasteByProduct, accountingFeed,
  openDocument, API_BASE,
}) => {
  const totalWasteLoss = filteredWaste.reduce((a: number, w: any) => a + (w.loss_cost || 0), 0);
  const totalCOGS = filteredSales.reduce((a: number, s: any) => a + (s.total_cost || 0), 0);
  const netProfit = monthlySales - totalCOGS - totalWasteLoss - monthlyExpensesTotal;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Date Range + Export */}
      <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6 rounded-[2rem] border transition-colors ${isDarkMode ? 'glass-panel' : 'bg-white border-slate-200 shadow-xl'}`}>
        <div className="flex items-center gap-6">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">From</label>
            <input type="date" value={accountingRange.start} onChange={e => setAccountingRange({ ...accountingRange, start: e.target.value })}
              className={`bg-transparent border-b py-2 outline-none font-bold text-sm ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`} />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">To</label>
            <input type="date" value={accountingRange.end} onChange={e => setAccountingRange({ ...accountingRange, end: e.target.value })}
              className={`bg-transparent border-b py-2 outline-none font-bold text-sm ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`} />
          </div>
        </div>
        <button
          onClick={() => { const year = new Date().getFullYear(); const month = new Date().getMonth() + 1; const token = localStorage.getItem('bakery_token'); openDocument(`${API_BASE}/reports/monthly?month=${month}&year=${year}&format=pdf&token=${token}`, `monthly-report.pdf`); }}
          className={`flex items-center gap-3 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${isDarkMode ? 'bg-gold text-charcoal shadow-gold-glow' : 'bg-slate-900 text-white'}`}>
          <FileText size={16} /> Export PDF
        </button>
      </div>

      {/* P&L KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Gross Revenue', value: formatPrice(monthlySales), color: isDarkMode ? 'text-emerald-400' : 'text-emerald-700', icon: <TrendingUp size={24} /> },
          { label: 'Total COGS', value: formatPrice(totalCOGS), color: 'text-rose-400', icon: <TrendingDown size={24} /> },
          { label: 'Operating Expenses', value: formatPrice(monthlyExpensesTotal), color: 'text-rose-400', icon: <TrendingDown size={24} /> },
          { label: 'Net Profit', value: formatPrice(netProfit), color: netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400', icon: netProfit >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} /> },
        ].map((stat, i) => (
          <div key={i} className={`p-6 rounded-[2rem] border transition-colors ${isDarkMode ? 'glass-panel' : 'bg-white border-slate-200 shadow-xl'}`}>
            <div className={`mb-3 ${stat.color}`}>{stat.icon}</div>
            <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Product Profitability */}
        <div className={`p-8 rounded-[2.5rem] border transition-colors ${isDarkMode ? 'glass-panel' : 'bg-white border-slate-200 shadow-xl'}`}>
          <h3 className={`text-xl font-bold luxury-font uppercase mb-6 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Product Profitability</h3>
          {productProfitability.length > 0 ? (
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productProfitability}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', fontSize: 10 }} />
                  <YAxis hide />
                  <Tooltip contentStyle={{ backgroundColor: isDarkMode ? '#0a0a0b' : '#fff', border: 'none', borderRadius: '12px' }} />
                  <Bar dataKey="revenue" fill="#d4af37" radius={[4, 4, 0, 0]} name="Revenue" />
                  <Bar dataKey="cost" fill={isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} radius={[4, 4, 0, 0]} name="Cost" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="py-20 text-center opacity-20"><FileText size={48} className="mx-auto mb-4" /><p className="text-[10px] font-black uppercase tracking-widest">No Sales Data</p></div>
          )}
        </div>

        {/* Expense Breakdown */}
        <div className={`p-8 rounded-[2.5rem] border transition-colors ${isDarkMode ? 'glass-panel' : 'bg-white border-slate-200 shadow-xl'}`}>
          <h3 className={`text-xl font-bold luxury-font uppercase mb-6 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Expense Breakdown</h3>
          <div className="space-y-4">
            {expenseBreakdown.map(([cat, amount]) => (
              <div key={cat} className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-40">{cat}</span>
                <div className="flex items-center gap-3">
                  <div className={`h-1 rounded-full bg-rose-500/40 transition-all`} style={{ width: `${monthlyExpensesTotal > 0 ? (amount / monthlyExpensesTotal * 120) : 0}px` }} />
                  <span className="font-bold text-sm text-rose-400">-{formatPrice(amount)}</span>
                </div>
              </div>
            ))}
            {expenseBreakdown.length === 0 && <p className="text-[10px] uppercase tracking-widest opacity-20 font-bold text-center py-10">No expenses in range</p>}
          </div>

          {draftPurchaseCommitment > 0 && (
            <div className={`mt-6 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5`}>
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-1">Pending PO Commitment</p>
              <p className="text-xl font-bold text-amber-500">{formatPrice(draftPurchaseCommitment)}</p>
              <p className="text-[10px] opacity-40 mt-1">Orders awaiting receipt</p>
            </div>
          )}
        </div>
      </div>

      {/* Waste Ledger */}
      {wasteByProduct.length > 0 && (
        <div className={`p-8 rounded-[2.5rem] border transition-colors ${isDarkMode ? 'glass-panel' : 'bg-white border-slate-200 shadow-xl'}`}>
          <h3 className={`text-xl font-bold luxury-font uppercase mb-6 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Waste Ledger</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {wasteByProduct.map((w: any) => (
              <div key={w.name} className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-rose-500/5 border-rose-500/20' : 'bg-rose-50 border-rose-100'}`}>
                <p className="font-bold text-sm">{w.name}</p>
                <p className="text-rose-500 font-black text-xs mt-1">-{formatPrice(w.loss_cost)}</p>
                <p className="text-[10px] opacity-40 mt-1">{w.quantity} units</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancePanel;
