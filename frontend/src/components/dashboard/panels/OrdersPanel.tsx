import { useTranslation } from 'react-i18next';
import React, { useMemo } from 'react';
import { Calendar, Crown, FileText, Plus, Zap } from 'lucide-react';
import { DashboardSharedProps } from '../types';

type Props = Pick<DashboardSharedProps,
  'isDarkMode' | 'orders' | 'inventory' | 'formatPrice' | 'addToast' |
  'setShowBookingModal' | 'setBookingForm' | 'bookingForm' | 'fetchData' | 'api'>;

const OrdersPanel: React.FC<Props> = ({
  isDarkMode, orders, inventory, setShowBookingModal, setBookingForm, bookingForm, fetchData, api, addToast,
}) => {
  const { t } = useTranslation();


  // VIP Clienteling: count orders per customer to detect repeat customers
  const customerOrderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach(o => {
      const key = (o.customer_phone || o.customer_name || '').toLowerCase().trim();
      if (key) counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [orders]);

  const isVIP = (order: any) => {
    const key = (order.customer_phone || order.customer_name || '').toLowerCase().trim();
    return (customerOrderCounts[key] || 0) >= 2;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className={`p-8 rounded-[3rem] border transition-colors ${isDarkMode ? 'border-gold/20 bg-black/20 shadow-gold-glow' : 'border-slate-200 bg-white shadow-sm'}`}>
        <div className="flex justify-between items-center mb-10">
          <div>
            <h3 className={`text-2xl font-bold luxury-font uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t('pre_order_ledger')}</h3>
            <div className="flex items-center gap-3 mt-1">
              <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-cream/20' : 'text-slate-400'}`}>Tracking {orders.length} active custom bookings</p>
              {orders.filter(o => isVIP(o)).length > 0 && (
                <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-gold bg-gold/10 px-2 py-1 rounded-full">
                  <Crown size={10} /> {orders.filter(o => isVIP(o)).length} VIP clients
                </span>
              )}
            </div>
          </div>
          <button onClick={() => { setBookingForm({ name: '', phone: '', date: new Date(Date.now() + 86400000).toISOString().slice(0, 16), source: 'ledger', notes: '' }); setShowBookingModal(true); }}
            className={`px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all active:scale-95 ${isDarkMode ? 'bg-gold text-charcoal shadow-gold-glow' : 'bg-slate-900 text-white shadow-xl'}`}>
            {t('create_booking')}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className={`border-b text-[10px] font-black uppercase tracking-[0.3em] ${isDarkMode ? 'border-white/5 text-cream/40' : 'border-slate-100 text-slate-400'}`}>
                <th className="px-8 py-6">{t('customer_identity')}</th>
                <th className="px-8 py-6">{t('pickup_schedule')}</th>
                <th className="px-8 py-6">{t('fulfillment_status')}</th>
                <th className="px-8 py-6 text-right">{t('connect')}</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-white/5' : 'divide-slate-100'}`}>
              {orders.map(order => {
                const vip = isVIP(order);
                return (
                  <tr key={order.id} className={`group hover:bg-white/[0.02] transition-colors ${vip ? (isDarkMode ? 'bg-gold/[0.02]' : 'bg-amber-50/50') : ''}`}>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        {vip && (
                          <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center shadow-[0_0_12px_rgba(212,175,55,0.3)] ${isDarkMode ? 'bg-gold/15' : 'bg-amber-100'}`}>
                            <Crown size={16} className="text-gold" />
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`font-bold text-lg ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>{order.customer_name}</p>
                            {vip && (
                              <span className="text-[8px] font-black uppercase tracking-widest text-gold bg-gold/10 px-2 py-0.5 rounded-full border border-gold/20">
                                {t('vip')}
                              </span>
                            )}
                          </div>
                          <p className={`text-[10px] uppercase font-black tracking-widest ${isDarkMode ? 'text-gold' : 'text-slate-500'}`}>Order Ref: {order.id}</p>
                          {order.notes && (
                              <p className={`text-xs mt-2 italic ${isDarkMode ? 'text-cream/60' : 'text-slate-500'}`}>
                                  " {order.notes} "
                              </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <Calendar size={14} className="text-gold opacity-40" />
                        <p className={`text-sm font-bold ${isDarkMode ? 'text-white/60' : 'text-slate-600'}`}>
                          {new Date(order.pickup_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <select value={order.status}
                        onChange={async (e) => { await api.patch(`/orders/${order.id}/status?status=${e.target.value}`, null); addToast(`Order ${e.target.value.toUpperCase()}`, 'success'); fetchData(); }}
                        className={`appearance-none cursor-pointer px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl border transition-all outline-none ${isDarkMode ? 'bg-black/80 border-gold/20 text-gold hover:bg-gold hover:text-charcoal' : 'bg-slate-50 border-slate-200 text-slate-900 hover:bg-slate-900 hover:text-white'}`}>
                        <option value="pending" className={isDarkMode ? 'bg-[#0a0a0b] text-gold' : ''}>{t('pending')}</option>
                        <option value="baking" className={isDarkMode ? 'bg-[#0a0a0b] text-gold' : ''}>{t('baking')}</option>
                        <option value="ready" className={isDarkMode ? 'bg-[#0a0a0b] text-gold' : ''}>{t('ready')}</option>
                        <option value="picked_up" className={isDarkMode ? 'bg-[#0a0a0b] text-gold' : ''}>{t('picked_up')}</option>
                      </select>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <button onClick={() => {
                        const cleanPhone = (order.customer_phone || '').replace(/\D/g, '');
                        if (cleanPhone.length >= 8) {
                          window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Bonjour ${order.customer_name}${vip ? ' 👑' : ''}, votre commande BakeryOS est maintenant ${order.status.toUpperCase()}! 🥐`)}`, '_blank', 'noopener,noreferrer');
                        }
                      }}
                        className={`p-4 rounded-2xl transition-all ${isDarkMode ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-black' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white'}`} title={vip ? 'Message VIP Client via WhatsApp' : 'Share via WhatsApp'}>
                        <Zap size={18} fill="currentColor" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {orders.length === 0 && (
                <tr><td colSpan={4} className="py-20 text-center opacity-10"><FileText size={48} className="mx-auto mb-4" /><p className="font-black text-[10px] uppercase tracking-widest">{t('no_active_bookings')}</p></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OrdersPanel;
