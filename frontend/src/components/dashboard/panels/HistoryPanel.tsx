import React, { useState, useMemo } from 'react';
import { FileText, Search, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { DashboardSharedProps } from '../types';

type Props = Pick<DashboardSharedProps,
  'isDarkMode' | 'history' | 'formatPrice' | 'openDocument' | 'getDownloadToken' | 'openSelector' | 'API_BASE'>;

const HistoryPanel: React.FC<Props> = ({ isDarkMode, history, formatPrice, openDocument, getDownloadToken, openSelector, API_BASE }) => {
  const today = new Date().toISOString().slice(0, 10);

  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [typeFilter, setTypeFilter] = useState<'all' | 'sale' | 'produce'>('all');

  const filtered = useMemo(() => {
    return history.slice().reverse().filter(tx => {
      const txDate = tx.timestamp?.slice(0, 10) || '';
      const matchDate = txDate >= dateFrom && txDate <= dateTo;
      const matchType = typeFilter === 'all' || tx.type === typeFilter;
      const matchSearch = !search ||
        tx.id?.toLowerCase().includes(search.toLowerCase()) ||
        tx.items?.some((i: any) => i.name?.toLowerCase().includes(search.toLowerCase())) ||
        tx.product?.toLowerCase().includes(search.toLowerCase());
      return matchDate && matchType && matchSearch;
    });
  }, [history, dateFrom, dateTo, typeFilter, search]);

  const totalRevenue = filtered.filter(t => t.type === 'sale').reduce((a, t) => a + (t.revenue || 0), 0);
  const totalCost = filtered.filter(t => t.type !== 'sale').reduce((a, t) => a + (t.cost || 0), 0);
  const txCount = filtered.length;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* Header */}
      <div>
        <h3 className={`text-4xl font-bold luxury-font uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>History Explorer</h3>
        <p className={`text-sm mt-2 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>Analyze performance for any specific period</p>
      </div>

      {/* Filter Bar */}
      <div className={`p-6 rounded-[2rem] border flex flex-wrap items-center gap-5 ${isDarkMode ? 'glass-panel' : 'bg-white border-slate-200 shadow-xl'}`}>
        {/* Date range */}
        <div className="flex items-center gap-3">
          <Calendar size={16} className="text-gold shrink-0" />
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className={`bg-transparent border-b py-2 outline-none font-bold text-sm w-36 ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`}
            />
            <span className="opacity-30 text-sm">→</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className={`bg-transparent border-b py-2 outline-none font-bold text-sm w-36 ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`}
            />
          </div>
        </div>

        {/* Type filter */}
        <div className="flex gap-2">
          {(['all', 'sale', 'produce'] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${typeFilter === t
                ? (isDarkMode ? 'bg-gold text-charcoal' : 'bg-slate-900 text-white')
                : (isDarkMode ? 'bg-white/5 text-cream/40 hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className={`flex-1 flex items-center gap-3 border-b min-w-[180px] ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
          <Search size={14} className="opacity-40 shrink-0" />
          <input
            type="text"
            placeholder="Search by ID or product…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`w-full bg-transparent py-2 outline-none text-sm font-bold ${isDarkMode ? 'text-cream placeholder:text-cream/20' : 'text-slate-900 placeholder:text-slate-300'}`}
          />
        </div>
      </div>

      {/* Period KPIs */}
      <div className="grid grid-cols-3 gap-5">
        {[
          { label: 'Transactions', value: String(txCount), icon: <FileText size={20} />, color: isDarkMode ? 'text-gold' : 'text-slate-900' },
          { label: 'Revenue (period)', value: formatPrice(totalRevenue), icon: <TrendingUp size={20} />, color: 'text-emerald-400' },
          { label: 'Production Cost', value: formatPrice(totalCost), icon: <TrendingDown size={20} />, color: 'text-rose-400' },
        ].map((kpi, i) => (
          <div key={i} className={`p-6 rounded-[2rem] border transition-all ${isDarkMode ? 'glass-panel hover:-translate-y-1' : 'bg-white border-slate-200 shadow-xl'}`}>
            <div className={`mb-3 ${kpi.color}`}>{kpi.icon}</div>
            <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>{kpi.label}</p>
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Transaction Table */}
      <div className={`rounded-[2rem] border overflow-hidden transition-colors ${isDarkMode ? 'glass-panel' : 'bg-white border-slate-200 shadow-xl'}`}>
        <div className={`p-6 border-b ${isDarkMode ? 'border-white/5' : 'border-slate-100'} flex justify-between items-center`}>
          <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className={`border-b text-[10px] font-black uppercase tracking-[0.2em] ${isDarkMode ? 'border-white/5 text-cream/40' : 'border-slate-100 text-slate-400'}`}>
                <th className="px-8 py-5">Transaction</th>
                <th className="px-8 py-5">Timestamp</th>
                <th className="px-8 py-5">Type</th>
                <th className="px-8 py-5 text-right">Value</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-white/5' : 'divide-slate-100'}`}>
              {filtered.map(tx => (
                <tr key={tx.id} className="group hover:bg-white/[0.02] transition-colors">
                  <td className="px-8 py-5">
                    <p className={`font-bold font-mono text-sm ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>{tx.id}</p>
                    <p className={`text-[10px] uppercase font-bold tracking-widest mt-0.5 ${isDarkMode ? 'text-cream/20' : 'text-slate-300'}`}>
                      {tx.type === 'sale' ? tx.items?.map((i: any) => i.name).join(', ') : tx.product}
                    </p>
                  </td>
                  <td className={`px-8 py-5 font-medium text-xs ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>
                    {new Date(tx.timestamp).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-8 py-5">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${tx.type === 'sale' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-gold/10 text-gold'}`}>{tx.type}</span>
                  </td>
                  <td className={`px-8 py-5 text-right font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{formatPrice(tx.revenue || tx.cost || 0)}</td>
                  <td className="px-8 py-5 text-right">
                    {tx.type === 'sale' && (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={async () => {
                            const dlToken = await getDownloadToken();
                            openDocument(`${API_BASE}/transactions/${tx.id}/receipt?format=pdf&paper=80mm&token=${dlToken}`, `receipt-${tx.id}.pdf`);
                          }}
                          className={`p-2 rounded-lg transition-all ${isDarkMode ? 'bg-gold/10 text-gold hover:bg-gold/20' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`} title="Print Receipt">
                          <FileText size={14} />
                        </button>
                        <button
                          onClick={() => openSelector({ title: 'WhatsApp Share', label: 'Customer Number', value: '', type: 'text',
                            onConfirm: (phone: string) => {
                              const itemsText = tx.items?.map((i: any) => `- ${i.name} x${i.qty}`).join('%0A') || '';
                              const text = `BAKERY OS: Receipt ${tx.id}%0A${itemsText}%0A%0ATOTAL: ${tx.revenue} MAD`;
                              window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${text}`, '_blank');
                            }
                          })}
                          className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-all" title="Share to WhatsApp">
                          <span className="text-[10px] font-black">WA</span>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-8 py-24 text-center">
                  <Search size={40} className="mx-auto mb-4 opacity-10" />
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-20">No transactions match your filters</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default HistoryPanel;
