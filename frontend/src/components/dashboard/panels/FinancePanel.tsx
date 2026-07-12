import { useTranslation } from 'react-i18next';
/**
 * FinancePanel — Month-end P&L accounting view.
 *
 * Shows filterable date range, revenue vs expense breakdown, net profit,
 * waste deductions, profit-by-product table, and export controls.
 */
import React, { useState } from 'react';
import { useDashboard } from '../DashboardContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FileText, TrendingDown, TrendingUp, Briefcase, FileClock, Table, Plus } from 'lucide-react';
import http from '../../../lib/http';

import { deriveAccountingMetrics } from '../utils';

const FinancePanel: React.FC = () => {
  const { isDarkMode, formatPrice, accountingRange, setAccountingRange,
  history, wasteRecords, purchaseOrders,
  openDocument, orders, expenses, suppliers,
  setShowAddExpense, editingExpense, setEditingExpense, handleDeleteExpense,
  showConfirm, addToast } = useDashboard();
  
  const {
    accountingFeed,
    draftPurchaseCommitment,
    expenseBreakdown,
    filteredExpenses,
    filteredPurchaseOrders,
    filteredSales,
    filteredWaste,
    monthlyExpensesTotal,
    monthlyNetAfterExpenses,
    monthlySales,
    productProfitability,
    wasteByProduct,
  } = deriveAccountingMetrics({
    history,
    expenses,
    purchaseOrders,
    wasteRecords,
    suppliers,
    accountingRange,
  });

  const API_BASE = http.defaults.baseURL || '';
  const { t } = useTranslation();

  const [isHT, setIsHT] = useState(false);
  const TAX_RATE = 1.10; // 10% Moroccan food TVA 2026

  // Helper: open expense modal pre-filled for editing
  const openEditExpense = (exp: any) => {
    setEditingExpense(exp);
    // Pre-populate the shared newExpense state via the setter exposed by parent
    // We do this by dispatching a custom event that Dashboard reads — but since
    // we have direct prop access, we just call setShowAddExpense and the parent
    // will read editingExpense from state.
    // Actually we need to set newExpense in Dashboard — we do so by:
    // The modal reads `editingExpense` and on open it populates `newExpense` from it.
    setShowAddExpense(true);
  };

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
      addToast('Could not create a secure report download link', 'error');
    }
  };

  const applyTaxMode = (val: number) => isHT ? val / TAX_RATE : val;

  const totalWasteLossRaw = filteredWaste.reduce((a: number, w: any) => a + (w.loss_cost || 0), 0);
  const totalCOGSRaw = filteredSales.reduce((a: number, s: any) => a + (s.cost || 0), 0);
  
  // Moroccan VAT Engine
  const getSalesTvaCollected = (tx: any) => {
    let totalTva = 0;
    if (tx.items && Array.isArray(tx.items)) {
      tx.items.forEach((item: any) => {
        const name = (item.name || '').toLowerCase();
        const isBread = name.includes('pain') || name.includes('bread') || name.includes('baguette');
        const rate = isBread ? 0 : 0.10;
        const itemRevenue = (Number(item.qty) || 0) * (Number(item.price) || 0);
        const ht = itemRevenue / (1 + rate);
        totalTva += itemRevenue - ht;
      });
    } else {
      const totalRevenue = Number(tx.total_revenue) || 0;
      totalTva = totalRevenue - (totalRevenue / 1.10);
    }
    return totalTva;
  };

  const tvaCollectee = filteredSales.reduce((sum, tx) => sum + getSalesTvaCollected(tx), 0);
  const tvaDeductible = filteredExpenses.reduce((sum: number, exp: any) => {
    return sum + (exp.is_tva_deductible ? (Number(exp.tva_amount) || 0) : 0);
  }, 0);
  const tvaAPayer = tvaCollectee - tvaDeductible;

  const displayRevenue = isHT 
    ? filteredSales.reduce((sum: number, tx: any) => {
        let txHt = 0;
        if (tx.items && Array.isArray(tx.items)) {
          tx.items.forEach((item: any) => {
            const name = (item.name || '').toLowerCase();
            const isBread = name.includes('pain') || name.includes('bread') || name.includes('baguette');
            const rate = isBread ? 0 : 0.10;
            const itemRevenue = (Number(item.qty) || 0) * (Number(item.price) || 0);
            txHt += itemRevenue / (1 + rate);
          });
        } else {
          txHt = (Number(tx.total_revenue) || 0) / 1.10;
        }
        return sum + txHt;
      }, 0)
    : monthlySales;

  const displayCOGS = isHT
  ? filteredSales.reduce((sum: number, s: any) => {
      const cost = Number(s.cost) || 0;
      const name = (s.product_name || s.name || '').toLowerCase();
      const isBread = name.includes('pain') || name.includes('bread') || name.includes('baguette');
      const rate = isBread ? 0 : 0.10;
      return sum + (cost / (1 + rate));
    }, 0)
  : totalCOGSRaw;
  const displayExpenses = isHT 
    ? filteredExpenses.reduce((sum: number, exp: any) => {
        // If tax is deductible, the "real cost" is HT. If not, the full amount is a loss.
        const tax = exp.is_tva_deductible ? (Number(exp.tva_amount) || 0) : 0;
        return sum + (Number(exp.amount) - tax);
      }, 0)
    : monthlyExpensesTotal;

  const displayWaste = isHT
    ? filteredWaste.reduce((sum: number, w: any) => {
        const loss = Number(w.loss_cost) || 0;
        const name = (w.product_name || '').toLowerCase();
        const isBread = name.includes('pain') || name.includes('bread') || name.includes('baguette');
        const rate = isBread ? 0 : 0.10;
        return sum + (loss / (1 + rate));
      }, 0)
    : totalWasteLossRaw;
  
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
              <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">{t('from')}</label>
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
            <FileText size={16} /> {t('export_pdf')}
          </button>
          <button
            onClick={() => openReport('excel')}
            className={`flex items-center gap-3 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${isDarkMode ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-emerald-600 text-white'}`}>
            <Table size={16} /> {t('export_excel')}
          </button>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4 lg:gap-6">
        {[
          { label: `Gross Revenue (${isHT ? 'HT' : 'TTC'})`, value: formatPrice(displayRevenue), color: isDarkMode ? 'text-emerald-400' : 'text-emerald-700', icon: <TrendingUp size={20} /> },
          { label: 'Total COGS', value: formatPrice(displayCOGS), color: 'text-amber-400', icon: <TrendingDown size={20} /> },
          { label: `Gross Margin %`, value: grossMarginPercent, color: 'text-gold', icon: <TrendingUp size={20} /> },
          { label: 'Operating Expenses', value: formatPrice(displayExpenses), color: 'text-rose-400', icon: <TrendingDown size={20} /> },
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
              <p className="text-[10px] font-black uppercase tracking-widest">{t('masse_salariale_labor')}</p>
            </div>
            <p className="text-2xl font-bold text-rose-400">{formatPrice(displayLaborCosts)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] opacity-40 uppercase tracking-widest font-bold mb-1">{t('of_revenue')}</p>
            <p className="text-sm font-bold text-rose-400/70">{displayRevenue > 0 ? ((displayLaborCosts / displayRevenue) * 100).toFixed(1) : 0}%</p>
          </div>
        </div>

        <div className={`p-6 rounded-[2rem] border flex items-center justify-between ${isDarkMode ? 'bg-sky-500/5 border-sky-500/20' : 'bg-sky-50 border-sky-100'}`}>
          <div>
            <div className="flex items-center gap-2 text-sky-400 mb-2">
              <FileClock size={16} />
              <p className="text-[10px] font-black uppercase tracking-widest">{t('accounts_receivable_pending_b2')}</p>
            </div>
            <p className="text-2xl font-bold text-sky-400">{formatPrice(displayPendingDebt)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] opacity-40 uppercase tracking-widest font-bold mb-1">{t('impact')}</p>
            <p className="text-sm font-bold text-sky-400/70">{t('unpaid_invoices')}</p>
          </div>
        </div>
      </div>

      {/* Moroccan VAT (TVA) Settlement */}
      <div className={`p-6 rounded-[2rem] border transition-all ${isDarkMode ? 'glass-panel border-gold/20 bg-gold/5' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h4 className={`text-md font-bold luxury-font uppercase tracking-wider ${isDarkMode ? 'text-gold' : 'text-slate-900'}`}>{t('moroccan_vat_tva_settlement')}</h4>
            <p className={`text-[11px] ${isDarkMode ? 'text-cream/40' : 'text-slate-500'}`}>{t('moroccan_tax_desc')}</p>
          </div>
          <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${isDarkMode ? 'bg-gold/10 text-gold' : 'bg-slate-900 text-white'}`}>{t('moroccan_dgi_engine')}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-1">
            <p className={`text-[9px] font-black uppercase tracking-[0.15em] ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>{t('tva_collect_e_sales')}</p>
            <p className="text-xl font-bold text-emerald-500">+{formatPrice(tvaCollectee)}</p>
            <p className="text-[10px] opacity-40">{t('10_on_pastries_0_on_bread')}</p>
          </div>
          <div className="space-y-1">
            <p className={`text-[9px] font-black uppercase tracking-[0.15em] ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>{t('tva_d_ductible_expenses')}</p>
            <p className="text-xl font-bold text-rose-500">-{formatPrice(tvaDeductible)}</p>
            <p className="text-[10px] opacity-40">{t('from_qualified_expenses')}</p>
          </div>
          <div className={`p-4 rounded-xl ${tvaAPayer >= 0 ? (isDarkMode ? 'bg-rose-500/10 border border-rose-500/20' : 'bg-rose-50 border border-rose-100') : (isDarkMode ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-100')}`}>
            <p className={`text-[9px] font-black uppercase tracking-[0.15em] ${tvaAPayer >= 0 ? 'text-rose-500' : 'text-emerald-500'} mb-1`}>
              {tvaAPayer >= 0 ? 'TVA à Payer (Owed)' : 'Crédit de TVA (Refund)'}
            </p>
            <p className={`text-xl font-bold ${tvaAPayer >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
              {formatPrice(Math.abs(tvaAPayer))}
            </p>
            <p className="text-[10px] opacity-60 mt-1">
              {tvaAPayer >= 0 ? 'Reserve this amount for tax' : 'Rolls over to next month'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Product Profitability */}
        <div className={`p-8 rounded-[2.5rem] border transition-colors ${isDarkMode ? 'glass-panel' : 'bg-white border-slate-200 shadow-xl'}`}>
          <h3 className={`text-xl font-bold luxury-font uppercase mb-6 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t('product_profitability')}</h3>
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
            <div className="py-20 text-center opacity-20"><FileText size={48} className="mx-auto mb-4" /><p className="text-[10px] font-black uppercase tracking-widest">{t('no_sales_data')}</p></div>
          )}
        </div>

        {/* Expense Breakdown */}
        <div className={`p-8 rounded-[2.5rem] border transition-colors ${isDarkMode ? 'glass-panel' : 'bg-white border-slate-200 shadow-xl'}`}>
          <h3 className={`text-xl font-bold luxury-font uppercase mb-6 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t('expense_breakdown')}</h3>
          <div className="space-y-4">
            {expenseBreakdown.map(([cat, amount]) => (
              <div key={cat as string} className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-40">{cat as string}</span>
                <div className="flex items-center gap-3">
                  <div className={`h-1 rounded-full bg-rose-500/40 transition-all`} style={{ width: `${monthlyExpensesTotal > 0 ? ((amount as number) / monthlyExpensesTotal * 120) : 0}px` }} />
                  <span className="font-bold text-sm text-rose-400">-{formatPrice(amount as number)}</span>
                </div>
              </div>
            ))}
            {expenseBreakdown.length === 0 && <p className="text-[10px] uppercase tracking-widest opacity-20 font-bold text-center py-10">{t('no_expenses_in_range')}</p>}
          </div>

          {draftPurchaseCommitment > 0 && (
            <div className={`mt-6 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5`}>
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-1">{t('pending_po_commitment')}</p>
              <p className="text-xl font-bold text-amber-500">{formatPrice(applyTaxMode(draftPurchaseCommitment))}</p>
              <p className="text-[10px] opacity-40 mt-1">{t('orders_awaiting_receipt')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Waste Ledger */}
      {wasteByProduct.length > 0 && (
        <div className={`p-8 rounded-[2.5rem] border transition-colors ${isDarkMode ? 'glass-panel' : 'bg-white border-slate-200 shadow-xl'}`}>
          <h3 className={`text-xl font-bold luxury-font uppercase mb-6 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t('waste_ledger')}</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {wasteByProduct.map((w: any) => {
              const name = (w.name || '').toLowerCase();
              const isBread = name.includes('pain') || name.includes('bread') || name.includes('baguette');
              const rate = isBread ? 0 : 0.10;
              const displayLoss = isHT ? (Number(w.loss_cost || w.loss) || 0) / (1 + rate) : (Number(w.loss_cost || w.loss) || 0);
              return (
                <div key={w.name} className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-rose-500/5 border-rose-500/20' : 'bg-rose-50 border-rose-100'}`}>
                  <p className="font-bold text-sm">{w.name}</p>
                  <p className="text-rose-500 font-black text-xs mt-1">-{formatPrice(displayLoss)}</p>
                  <p className="text-[10px] opacity-40 mt-1">{w.quantity || w.qty} units</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Overhead & Bills ─────────────────────────────────────────────── */}
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h3 className={`text-3xl font-bold luxury-font uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t('overhead_amp_bills')}</h3>
            <p className={`text-sm mt-1 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>{t('track_business_expenses_rent_p')}</p>
          </div>
          <button
            onClick={() => setShowAddExpense(true)}
            className={`px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 transition-all ${
              isDarkMode ? 'bg-gold text-charcoal shadow-gold-glow hover:opacity-90' : 'bg-slate-900 text-white hover:bg-slate-700'
            }`}
          >
            <Plus size={16} /> {t('log_new_expense')}
          </button>
        </div>

        <div className={`rounded-[2.5rem] border overflow-hidden transition-colors ${isDarkMode ? 'glass-panel' : 'bg-white border-slate-200 shadow-xl'}`}>
          <table className="w-full text-left">
            <thead>
              <tr className={`border-b text-[10px] font-black uppercase tracking-[0.2em] ${isDarkMode ? 'border-black/60 text-cream/40' : 'border-black/10 text-slate-400'}`}>
                <th className="px-8 py-6">{t('date')}</th>
                <th className="px-8 py-6">{t('supplier_ref')}</th>
                <th className="px-8 py-6">{t('category')}</th>
                <th className="px-8 py-6">{t('tax_vat')}</th>
                <th className="px-8 py-6">{t('status')}</th>
                <th className="px-8 py-6 text-right">{t('amount')}</th>
                <th className="px-8 py-6 text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {(filteredExpenses || []).map((exp: any) => {
                const suppName = exp.supplier?.name || (exp.supplier_id ? `Supplier #${exp.supplier_id}` : 'None');
                const tvaRateStr = exp.tva_rate !== undefined ? `${exp.tva_rate}%` : 'Legacy';
                
                let statusBadge = '';
                if (exp.status === 'paid') statusBadge = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
                else if (exp.status === 'partial') statusBadge = 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
                else statusBadge = 'bg-rose-500/10 text-rose-400 border border-rose-500/20';

                return (
                  <tr key={exp.id} className={`border-b last:border-0 ${
                    isDarkMode ? 'border-black/50 hover:bg-white/5' : 'border-black/5 hover:bg-slate-50'
                  } transition-colors`}>
                    <td className="px-8 py-5 font-bold text-sm">{new Date(exp.date).toLocaleDateString()}</td>
                    <td className="px-8 py-5">
                      <div className="font-bold text-sm">{suppName}</div>
                      {exp.invoice_ref && (
                        <div className="text-[10px] opacity-40 font-mono mt-0.5">Ref: {exp.invoice_ref}</div>
                      )}
                    </td>
                    <td className="px-8 py-5">
                      <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                        isDarkMode ? 'bg-white/5 text-cream/70' : 'bg-slate-100 text-slate-600'
                      }`}>{exp.category}</span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="text-sm font-semibold">{tvaRateStr} TVA</div>
                      <div className="text-[10px] mt-0.5">
                        {exp.is_tva_deductible ? (
                          <span className="text-emerald-400 font-bold uppercase tracking-wider text-[9px]">{t('deductible')}</span>
                        ) : (
                          <span className="text-white/30 uppercase tracking-wider text-[9px]">{t('non_deductible')}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${statusBadge}`}>
                        {exp.status}
                      </span>
                      {exp.status === 'partial' && (
                        <div className="text-[10px] opacity-40 font-semibold mt-1">
                          Paid: {formatPrice(exp.amount_paid || 0)}
                        </div>
                      )}
                    </td>
	                    <td className="px-8 py-5 text-right">
	                      <div className="font-bold text-sm text-rose-500">
	                        -{formatPrice(exp.amount_ttc || exp.amount)}
	                      </div>
	                      <div className="text-[10px] opacity-40 mt-0.5">
	                        {`HT: ${formatPrice(exp.amount_ht || exp.amount / 1.10)}`}
	                      </div>
	                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditExpense(exp)}
                          className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-gold/10 text-gold hover:bg-gold/20 transition-all border border-gold/20"
                        >
                          {t('edit')}
                        </button>
                        <button
                          onClick={() => showConfirm({
                            title: 'Delete Expense',
                            message: `Delete this ${exp.category} expense of ${formatPrice(exp.amount_ttc || exp.amount)}? This cannot be undone.`,
                            type: 'danger',
                            confirmText: 'Delete',
                            onConfirm: () => handleDeleteExpense(exp.id),
                          })}
                          className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all border border-rose-500/20"
                        >
                          {t('delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {(!expenses || expenses.length === 0) && (
                <tr>
                  <td colSpan={7} className="py-20 text-center opacity-20 font-black uppercase tracking-widest text-[10px]">
                    {t('no_expenses_logged')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FinancePanel;
