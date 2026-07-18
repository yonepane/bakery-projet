import { useTranslation } from 'react-i18next';
import React, { useState, useMemo, useEffect } from 'react';
import { useDashboard } from '../DashboardContext';
import { createPortal } from 'react-dom';
import { FileText, Search, TrendingUp, TrendingDown, Calendar, RotateCcw, X, AlertTriangle, Trash2 } from 'lucide-react';
import { Table, TableHeader, TableBody, TableRow, Th, Td } from '../../ui/Table';
import { TabStrip } from '../../ui/TabStrip';
import { SearchInput } from '../../ui/SearchInput';
import { openWhatsApp } from '../../../lib/whatsapp';
import { RefundModal } from '../modals/RefundModal';

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
        <TabStrip
          tabs={[
            { value: 'all', label: 'all' },
            { value: 'sale', label: 'sale' },
            { value: 'produce', label: 'produce' },
          ]}
          active={typeFilter}
          onChange={(v) => setTypeFilter(v as any)}
          isDarkMode={isDarkMode}
        />

        {/* Search */}
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t('search_by_id_or_product')}
          isDarkMode={isDarkMode}
        />
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
          <Table>
            <TableHeader isDarkMode={isDarkMode}>
              <Th>{t('transaction')}</Th>
              <Th>{t('timestamp')}</Th>
              <Th>{t('type')}</Th>
              <Th className="text-right">{t('value')}</Th>
              <Th className="text-right">{t('actions')}</Th>
            </TableHeader>
            <TableBody isDarkMode={isDarkMode}>
              {filtered.map(tx => {
                const isRefunded = (tx as any).status === 'refunded';
                return (
                  <TableRow key={tx.id} className={isRefunded ? 'opacity-50 hover:bg-transparent' : ''} isDarkMode={isDarkMode}>
                    <Td className="px-8 py-5">
                      <p className={`font-bold font-mono text-sm ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>{tx.id}</p>
                      <p className={`text-[10px] uppercase font-bold tracking-widest mt-0.5 ${isDarkMode ? 'text-cream/20' : 'text-slate-300'}`}>
                        {tx.type === 'sale' ? tx.items?.map((i: any) => i.name).join(', ') : tx.product}
                      </p>
                    </Td>
                    <Td className={`px-8 py-5 font-medium text-xs ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>
                      {new Date(tx.timestamp).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </Td>
                    <Td className="px-8 py-5">
                      {isRefunded ? (
                        <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-rose-500/10 text-rose-500 line-through">
                          refunded
                        </span>
                      ) : (
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${tx.type === 'sale' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-gold/10 text-gold'}`}>
                          {tx.type}
                        </span>
                      )}
                    </Td>
                    <Td className={`px-8 py-5 text-right font-bold ${isRefunded ? 'line-through opacity-50' : ''} ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      {formatPrice(tx.revenue || tx.cost || 0)}
                    </Td>
                    <Td className="px-8 py-5 text-right">
                      {tx.type === 'sale' && (
                        <div className="flex items-center justify-end gap-2">
                          {/* Receipt PDF */}
                          {!isRefunded && (
                            <button
                              onClick={async () => {
                                try {
                                  const dlToken = await getDownloadToken();
                                  openDocument(`${API_BASE}/transactions/${tx.id}/receipt?format=pdf&paper=80mm&token=${dlToken}`, `receipt-${tx.id}.pdf`);
                                } catch (err) {
                                  addToast(t('failed_to_download_file'), 'error');
                                }
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
                                  const itemsText = tx.items?.map((i: any) => `- ${i.name} x${i.qty}`).join('\n') || '';
                                  const msg = `BAKERY OS: Receipt ${tx.id}\n${itemsText}\n\nTOTAL: ${tx.revenue} MAD`;
                                  openWhatsApp(phone, msg);
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
                    </Td>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow isDarkMode={isDarkMode}><Td colSpan={5} className="px-8 py-24 text-center">
                  <Search size={40} className="mx-auto mb-4 opacity-10" />
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-20">{t('no_transactions_match')}</p>
                </Td></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default HistoryPanel;
