/**
 * FinancePanel — Month-end P&L accounting view.
 *
 * Shows filterable date range, revenue vs expense breakdown, net profit,
 * waste deductions, profit-by-product table, and export controls.
 */
import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FileText, TrendingDown, TrendingUp, Briefcase, FileClock, Table } from 'lucide-react';
import { DashboardSharedProps } from '../types';
import http from '../../../lib/http';


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
  | 'orders'
>;

const FinancePanel: React.FC<Props> = ({
  isDarkMode, formatPrice, accountingRange, setAccountingRange,
  filteredSales, filteredExpenses, filteredWaste, filteredPurchaseOrders,
  monthlySales, monthlyExpensesTotal, monthlyNetAfterExpenses, draftPurchaseCommitment,
  expenseBreakdown, productProfitability, wasteByProduct, accountingFeed,
  openDocument, API_BASE, orders
}) => {
  const [isHT, setIsHT] = useState(false);
  const TAX_RATE = 1.20; // 20% standard TVA assumed

  // Fetch a short-lived download token, then open the report URL.
  // This avoids embedding the long-lived session JWT in the URL.
  const openReport = async (format: 'pdf' | 'excel') => {
    try {
      const { data } = await http.get('/auth/download-token');
      const dlToken = data.download_token;
      const year = new Date().getFullYear();
      const month = new Date().getMonth() + 1;
      const ext = format === 'pdf' ? 'pdf' : 'xlsx';
      openDocument(
        `${API_BASE}/reports/monthly?month=${month}&year=${year}&format=${format}&token=${dlToken}`,
        `monthly-report.${ext}`,
      );
    } catch {
      // Fallback: open without token if download-token endpoint fails
      const year = new Date().getFullYear();
      const month = new Date().getMonth() + 1;
      const legacyToken = localStorage.getItem('bakery_token');
      const ext = format === 'pdf' ? 'pdf' : 'xlsx';
      openDocument(
        `${API_BASE}/reports/monthly?month=${month}&year=${year}&format=${format}&token=${legacyToken}`,
        `monthly-report.${ext}`,
      );
    }
  };

  const applyTaxMode = (val: number) => isHT ? val / TAX_RATE : val;
  const noTaxKeywords = ['labor', 'payroll', 'salary', 'salaire', 'wage', 'rent', 'loyer', 'insurance', 'assurance', 'tax', 'impot', 'taxes', 'other', 'others', 'autre', 'autres'];
  const applyExpenseTaxMode = (val: number, category: string) => {
    const isNoTax = noTaxKeywords.some(kw => (category || '').toLowerCase().includes(kw));
    return (isHT && !isNoTax) ? val / TAX_RATE : val;
  };

  const totalWasteLossRaw = filteredWaste.reduce((a: number, w: any) => a + (w.loss_cost || 0), 0);
  const totalCOGSRaw = filteredSales.reduce((a: number, s: any) => a + (s.cost || 0), 0);
  
  const displayRevenue = applyTaxMode(monthlySales);
  const displayCOGS = applyTaxMode(totalCOGSRaw);
  const displayExpenses = filteredExpenses.reduce((sum: number, exp: any) => {
    return sum + applyExpenseTaxMode(Number(exp.amount) || 0, exp.category || '');
  }, 0);
  const displayWaste = applyTaxMode(totalWasteLossRaw);
  
  const displayNetProfit = displayRevenue - displayCOGS - displayWaste - displayExpenses;
  
  // Gross Margin Calculation
  const grossMarginValue = displayRevenue - displayCOGS;
  const grossMarginPercent = displayRevenue > 0 ? ((grossMarginValue / displayRevenue) * 100).toFixed(1) + '%' : '0.0%';

  // Labor Costs Calculation
  const laborKeywords = ['labor', 'payroll', 'salary', 'salaire', 'wage'];
  const laborCostsRaw = filteredExpenses
    .filter((exp: any) => laborKeywords.some(kw => (exp.category || '').toLowerCase().includes(kw)))
    .reduce((sum: number, exp: any) => sum + (Number(exp.amount) || 0), 0);
  const displayLaborCosts = laborCostsRaw;

  // Accounts Receivable (Pending B2B Debt) from Orders
  const pendingDebtRaw = (orders || [])
    .filter(o => o.status !== 'completed')
    .reduce((sum, o) => {
      const remaining = (Number(o.total_price) || 0) - (Number(o.deposit_paid) || 0);
      return sum + (remaining > 0 ? remaining : 0);
    }, 0);
  const displayPendingDebt = applyTaxMode(pendingDebtRaw);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Date Range + Export + Tax Toggle */}
      <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6 rounded-[2rem] border transition-colors ${isDarkMode ? 'glass-panel' : 'bg-white border-slate-200 shadow-xl'}`}>
        <div className="flex items-center gap-8 flex-wrap">
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
          
          <div className="h-10 w-px bg-white/10 hidden sm:block" />

          {/* HT / TTC Toggle */}
          <div className="flex items-center gap-3 bg-white/5 p-1 rounded-full border border-white/10">
            <button
              onClick={() => setIsHT(true)}
              className={`px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase transition-all ${isHT ? 'bg-gold text-charcoal shadow-[0_0_15px_rgba(212,175,55,0.4)]' : 'text-white/40 hover:text-white/80'}`}
            >
              HT
            </button>
            <button
              onClick={() => setIsHT(false)}
              className={`px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase transition-all ${!isHT ? 'bg-gold text-charcoal shadow-[0_0_15px_rgba(212,175,55,0.4)]' : 'text-white/40 hover:text-white/80'}`}
            >
              TTC
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => openReport('pdf')}
            className={`flex items-center gap-3 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${isDarkMode ? 'bg-gold text-charcoal shadow-gold-glow' : 'bg-slate-900 text-white'}`}>
            <FileText size={16} /> Export PDF
          </button>
          <button
            onClick={() => openReport('excel')}
            className={`flex items-center gap-3 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${isDarkMode ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-emerald-600 text-white'}`}>
            <Table size={16} /> Export Excel
          </button>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4 lg:gap-6">
        {[
          { label: `Gross Revenue (${isHT ? 'HT' : 'TTC'})`, value: formatPrice(displayRevenue), color: isDarkMode ? 'text-emerald-400' : 'text-emerald-700', icon: <TrendingUp size={20} /> },
          { label: `Total COGS (${isHT ? 'HT' : 'TTC'})`, value: formatPrice(displayCOGS), color: 'text-amber-400', icon: <TrendingDown size={20} /> },
          { label: `Gross Margin %`, value: grossMarginPercent, color: 'text-gold', icon: <TrendingUp size={20} /> },
          { label: `Operating Expenses (${isHT ? 'HT' : 'TTC'})`, value: formatPrice(displayExpenses), color: 'text-rose-400', icon: <TrendingDown size={20} /> },
          { label: `Net Profit (${isHT ? 'HT' : 'TTC'})`, value: formatPrice(displayNetProfit), color: displayNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400', icon: displayNetProfit >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} /> },
        ].map((stat, i) => (
          <div key={i} className={`p-5 rounded-[2rem] border transition-colors ${isDarkMode ? 'glass-panel' : 'bg-white border-slate-200 shadow-xl'}`}>
            <div className={`mb-3 ${stat.color}`}>{stat.icon}</div>
            <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>{stat.label}</p>
            <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Secondary KPI Cards (Labor & Debt) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
        <div className={`p-6 rounded-[2rem] border flex items-center justify-between ${isDarkMode ? 'bg-rose-500/5 border-rose-500/20' : 'bg-rose-50 border-rose-100'}`}>
          <div>
            <div className="flex items-center gap-2 text-rose-400 mb-2">
              <Briefcase size={16} />
              <p className="text-[10px] font-black uppercase tracking-widest">Masse Salariale (Labor)</p>
            </div>
            <p className="text-2xl font-bold text-rose-400">{formatPrice(displayLaborCosts)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] opacity-40 uppercase tracking-widest font-bold mb-1">% of Revenue</p>
            <p className="text-sm font-bold text-rose-400/70">{displayRevenue > 0 ? ((displayLaborCosts / displayRevenue) * 100).toFixed(1) : 0}%</p>
          </div>
        </div>

        <div className={`p-6 rounded-[2rem] border flex items-center justify-between ${isDarkMode ? 'bg-sky-500/5 border-sky-500/20' : 'bg-sky-50 border-sky-100'}`}>
          <div>
            <div className="flex items-center gap-2 text-sky-400 mb-2">
              <FileClock size={16} />
              <p className="text-[10px] font-black uppercase tracking-widest">Accounts Receivable (Pending B2B)</p>
            </div>
            <p className="text-2xl font-bold text-sky-400">{formatPrice(displayPendingDebt)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] opacity-40 uppercase tracking-widest font-bold mb-1">Impact</p>
            <p className="text-sm font-bold text-sky-400/70">Unpaid Invoices</p>
          </div>
        </div>
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
                  <Tooltip contentStyle={{ backgroundColor: isDarkMode ? '#0a0a0b' : '#fff', border: 'none', borderRadius: '12px' }} formatter={(value: number) => formatPrice(applyTaxMode(value))} />
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
              <div key={cat as string} className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-40">{cat as string}</span>
                <div className="flex items-center gap-3">
                  <div className={`h-1 rounded-full bg-rose-500/40 transition-all`} style={{ width: `${monthlyExpensesTotal > 0 ? ((amount as number) / monthlyExpensesTotal * 120) : 0}px` }} />
                  <span className="font-bold text-sm text-rose-400">-{formatPrice(applyExpenseTaxMode(amount as number, cat as string))}</span>
                </div>
              </div>
            ))}
            {expenseBreakdown.length === 0 && <p className="text-[10px] uppercase tracking-widest opacity-20 font-bold text-center py-10">No expenses in range</p>}
          </div>

          {draftPurchaseCommitment > 0 && (
            <div className={`mt-6 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5`}>
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-1">Pending PO Commitment</p>
              <p className="text-xl font-bold text-amber-500">{formatPrice(applyTaxMode(draftPurchaseCommitment))}</p>
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
                <p className="text-rose-500 font-black text-xs mt-1">-{formatPrice(applyTaxMode(w.loss_cost))}</p>
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
