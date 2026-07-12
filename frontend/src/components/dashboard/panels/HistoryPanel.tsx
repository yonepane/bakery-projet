import { useTranslation } from 'react-i18next';
import React, { useState, useMemo, useEffect } from 'react';
import { useDashboard } from '../DashboardContext';
import { createPortal } from 'react-dom';
import { FileText, Search, TrendingUp, TrendingDown, Calendar, RotateCcw, X, AlertTriangle, Trash2 } from 'lucide-react';

interface RefundProps {
  tx: any;
  isDarkMode: boolean;
  formatPrice: (amount: number) => string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}

const RefundModal: React.FC<RefundProps> = ({ tx, isDarkMode, formatPrice, onConfirm, onCancel, loading }) => {
  const { t } = useTranslation();
  
  // Prevent body scroll when modal is open
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = originalStyle; };
  }, []);

  const modalContent = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-xl animate-in fade-in duration-200">
      <div className={`w-full max-w-md mx-4 p-8 rounded-[2.5rem] border shadow-2xl animate-in zoom-in-95 duration-200 ${
        isDarkMode ? 'bg-[#0a0a0b] border-rose-500/20 shadow-[0_0_60px_rgba(244,63,94,0.15)]' : 'bg-white border-slate-200'
      }`}>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 flex items-center justify-center">
              <AlertTriangle size={18} className="text-rose-500" />
            </div>
            <h3 className={`text-xl font-bold luxury-font uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {t('cancel_sale') || 'Cancel Sale'}
            </h3>
          </div>
          <button onClick={onCancel} className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'text-cream/30 hover:text-cream hover:bg-white/5' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'}`}>
            <X size={18} />
          </button>
        </div>

        {/* Transaction Info */}
        <div className={`p-5 rounded-2xl mb-5 border ${isDarkMode ? 'bg-white/3 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
          <p className={`text-[10px] font-black uppercase tracking-widest mb-3 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>
            {t('transaction') || 'Transaction'}: <span className={`font-mono ${isDarkMode ? 'text-gold' : 'text-slate-700'}`}>{tx.id}</span>
          </p>
          <div className="space-y-1.5 mb-3">
            {(typeof tx.items === 'string' ? JSON.parse(tx.items) : tx.items)?.map((item: any, i: number) => (
              <div key={i} className="flex justify-between text-sm">
                <span className={`font-medium ${isDarkMode ? 'text-cream/70' : 'text-slate-600'}`}>{item.name} × {item.qty}</span>
                <span className={`font-bold ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>{formatPrice(item.price * item.qty)}</span>
              </div>
            ))}
          </div>
          <div className={`pt-3 border-t flex justify-between ${isDarkMode ? 'border-white/5' : 'border-slate-200'}`}>
            <span className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>{t('total') || 'Total'}</span>
            <span className={`font-bold text-lg ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{formatPrice(tx.revenue || 0)}</span>
          </div>
        </div>

        {/* Warning */}
        <p className={`text-sm mb-6 text-center ${isDarkMode ? 'text-cream/50' : 'text-slate-500'}`}>
          {t('refund_warning') || 'Stock will be restored. This action cannot be undone.'}
        </p>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className={`flex-1 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all border ${
              isDarkMode ? 'border-white/10 text-cream/60 hover:bg-white/5 hover:text-cream' : 'border-slate-200 text-slate-500 hover:bg-slate-100'
            }`}
          >
            {t('keep') || 'Keep'}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all bg-rose-500 text-white hover:bg-rose-600 shadow-[0_0_20px_rgba(244,63,94,0.35)] active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <RotateCcw size={14} />
            )}
            {loading ? (t('cancelling') || 'Cancelling…') : (t('confirm_cancel') || 'Confirm Cancel')}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

// ─── Main Panel ───────────────────────────────────────────────────────────────
const HistoryPanel: React.FC = () => {
  const { isDarkMode, history, formatPrice, openDocument, getDownloadToken, openSelector, API_BASE, api, fetchData, fetchTabData, addToast, showConfirm } = useDashboard();
  const { t } = useTranslation();

  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'sale' | 'produce'>('all');

  // Refund modal state
  const [refundTx, setRefundTx] = useState<any | null>(null);
  const [refundLoading, setRefundLoading] = useState(false);

  const filtered = useMemo(() => {
    return history.filter(tx => {
      const txDate = tx.timestamp?.slice(0, 10) || '';
      const matchDate = (!dateFrom || txDate >= dateFrom) && (!dateTo || txDate <= dateTo);
      const matchType = typeFilter === 'all' || tx.type === typeFilter;
      const items = typeof tx.items === 'string' ? JSON.parse(tx.items) : tx.items;
      const matchSearch = !search ||
        tx.id?.toLowerCase().includes(search.toLowerCase()) ||
        items?.some((i: any) => i.name?.toLowerCase().includes(search.toLowerCase())) ||
        tx.product?.toLowerCase().includes(search.toLowerCase());
      return matchDate && matchType && matchSearch;
    }).sort((a, b) => {
      const aSort = Number((a as any).sort_index);
      const bSort = Number((b as any).sort_index);
      if (Number.isFinite(aSort) && Number.isFinite(bSort) && aSort !== bSort) {
        return bSort - aSort;
      }
      const byTime = new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime();
      return byTime || String(b.id || '').localeCompare(String(a.id || ''));
    });
  }, [history, dateFrom, dateTo, typeFilter, search]);

  const totalRevenue = filtered.filter(t => t.type === 'sale').reduce((a, t) => a + (t.revenue || 0), 0);
  const totalCost = filtered.filter(t => t.type !== 'sale').reduce((a, t) => a + (t.cost || 0), 0);
  const txCount = filtered.length;

  const handleRefund = async () => {
    if (!refundTx) return;
    setRefundLoading(true);
    try {
      await api.post(`/transactions/${refundTx.id}/refund`, {});
      addToast(`Sale ${refundTx.id} cancelled & stock restored.`, 'success');
      setRefundTx(null);
      // Refresh history (updates status badges + comptabilite derived metrics)
      fetchData();
      // Also refresh dashboard analytics (clears server cache + updates KPIs)
      fetchTabData('dashboard');
    } catch (err: any) {
      addToast(err?.message || 'Refund failed.', 'error');
    } finally {
      setRefundLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* Refund Modal */}
      {refundTx && (
        <RefundModal
          tx={refundTx}
          isDarkMode={isDarkMode}
          formatPrice={formatPrice}
          onConfirm={handleRefund}
          onCancel={() => setRefundTx(null)}
          loading={refundLoading}
        />
      )}

      {/* Header */}
      <div>
        <h3 className={`text-4xl font-bold luxury-font uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t('history_explorer')}</h3>
        <p className={`text-sm mt-2 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>{t('analyze_performance')}</p>
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
            placeholder={t('search_by_id_or_product')}
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
                <th className="px-8 py-5">{t('transaction')}</th>
                <th className="px-8 py-5">{t('timestamp')}</th>
                <th className="px-8 py-5">{t('type')}</th>
                <th className="px-8 py-5 text-right">{t('value')}</th>
                <th className="px-8 py-5 text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-white/5' : 'divide-slate-100'}`}>
              {filtered.map(tx => {
                const isRefunded = (tx as any).status === 'refunded';
                return (
                  <tr key={tx.id} className={`group transition-colors ${isRefunded ? 'opacity-50' : 'hover:bg-white/[0.02]'}`}>
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
                      {isRefunded ? (
                        <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-rose-500/10 text-rose-500 line-through">
                          refunded
                        </span>
                      ) : (
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${tx.type === 'sale' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-gold/10 text-gold'}`}>
                          {tx.type}
                        </span>
                      )}
                    </td>
                    <td className={`px-8 py-5 text-right font-bold ${isRefunded ? 'line-through opacity-50' : ''} ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      {formatPrice(tx.revenue || tx.cost || 0)}
                    </td>
                    <td className="px-8 py-5 text-right">
                      {tx.type === 'sale' && (
                        <div className="flex items-center justify-end gap-2">
                          {/* Receipt PDF */}
                          {!isRefunded && (
                            <button
                              onClick={async () => {
                                const dlToken = await getDownloadToken();
                                openDocument(`${API_BASE}/transactions/${tx.id}/receipt?format=pdf&paper=80mm&token=${dlToken}`, `receipt-${tx.id}.pdf`);
                              }}
                              className={`p-2 rounded-lg transition-all ${isDarkMode ? 'bg-gold/10 text-gold hover:bg-gold/20' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                              title={t('print_receipt')}
                            >
                              <FileText size={14} />
                            </button>
                          )}

                          {/* WhatsApp Share */}
                          {!isRefunded && (
                            <button
                              onClick={() => openSelector({ title: 'WhatsApp Share', label: 'Customer Number', value: '', type: 'text',
                                onConfirm: (phone: string) => {
                                  const cleanPhone = phone.replace(/\D/g, '');
                                  if (cleanPhone.length < 8) return;
                                  const itemsText = tx.items?.map((i: any) => `- ${i.name} x${i.qty}`).join('\n') || '';
                                  const text = encodeURIComponent(`BAKERY OS: Receipt ${tx.id}\n${itemsText}\n\nTOTAL: ${tx.revenue} MAD`);
                                  window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank', 'noopener,noreferrer');
                                }
                              })}
                              className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-all"
                              title={t('share_to_whatsapp')}
                            >
                              <span className="text-[10px] font-black">WA</span>
                            </button>
                          )}

                          {/* Cancel / Refund button or Delete button */}
                          {isRefunded ? (
                            <div className="flex items-center gap-2">
                              <span className="p-2 rounded-lg text-rose-500/40 cursor-not-allowed" title="Already refunded">
                                <RotateCcw size={14} />
                              </span>
                              <button
                                onClick={() => {
                                  showConfirm({
                                    title: "Delete Transaction",
                                    message: `Transaction ${tx.id} is already refunded. Deleting it will remove the audit row from history permanently.`,
                                    type: 'danger',
                                    confirmText: "Delete forever",
                                    onConfirm: async () => {
                                      try {
                                        await api.delete(`/transactions/${tx.id}`);
                                        addToast(`Transaction ${tx.id} deleted.`, 'success');
                                        fetchData();
                                      } catch (err: any) {
                                        addToast(err?.response?.data?.detail || err?.message || 'Delete failed.', 'error');
                                      }
                                    }
                                  });
                                }}
                                className="p-2 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-all"
                                title="Delete refunded transaction"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setRefundTx(tx)}
                              className="p-2 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-all"
                              title={t('cancel_sale') || 'Cancel sale & restore stock'}
                            >
                              <RotateCcw size={14} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-8 py-24 text-center">
                  <Search size={40} className="mx-auto mb-4 opacity-10" />
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-20">{t('no_transactions_match')}</p>
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
