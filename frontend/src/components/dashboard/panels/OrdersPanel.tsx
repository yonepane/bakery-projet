import React from 'react';
import { Calendar, FileText, Plus, Trash2, Zap } from 'lucide-react';
import { DashboardSharedProps } from '../types';

type Props = Pick<DashboardSharedProps,
  'isDarkMode' | 'orders' | 'inventory' | 'formatPrice' | 'addToast' |
  'setShowBookingModal' | 'setBookingForm' | 'bookingForm' | 'fetchData' | 'api'>;

const OrdersPanel: React.FC<Props> = ({
  isDarkMode, orders, inventory, setShowBookingModal, setBookingForm, bookingForm, fetchData, api, addToast,
}) => (
  <div className="space-y-8 animate-in fade-in duration-500">
    <div className={`p-8 rounded-[3rem] border transition-colors ${isDarkMode ? 'border-gold/20 bg-black/20 shadow-gold-glow' : 'border-slate-200 bg-white shadow-sm'}`}>
      <div className="flex justify-between items-center mb-10">
        <div>
          <h3 className={`text-2xl font-bold luxury-font uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Pre-Order Ledger</h3>
          <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${isDarkMode ? 'text-cream/20' : 'text-slate-400'}`}>Tracking {orders.length} active custom bookings</p>
        </div>
        <button onClick={() => { setBookingForm({ name: '', phone: '', date: new Date(Date.now() + 86400000).toISOString().slice(0, 16), source: 'ledger' }); setShowBookingModal(true); }}
          className={`px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all active:scale-95 ${isDarkMode ? 'bg-gold text-charcoal shadow-gold-glow' : 'bg-slate-900 text-white shadow-xl'}`}>
          Create Booking
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className={`border-b text-[10px] font-black uppercase tracking-[0.3em] ${isDarkMode ? 'border-white/5 text-cream/40' : 'border-slate-100 text-slate-400'}`}>
              <th className="px-8 py-6">Customer Identity</th>
              <th className="px-8 py-6">Pickup Schedule</th>
              <th className="px-8 py-6">Fulfillment Status</th>
              <th className="px-8 py-6 text-right">Connect</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDarkMode ? 'divide-white/5' : 'divide-slate-100'}`}>
            {orders.map(order => (
              <tr key={order.id} className="group hover:bg-white/[0.02] transition-colors">
                <td className="px-8 py-6">
                  <p className={`font-bold text-lg ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>{order.customer_name}</p>
                  <p className={`text-[10px] uppercase font-black tracking-widest ${isDarkMode ? 'text-gold' : 'text-slate-500'}`}>Order Ref: {order.id}</p>
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
                    className={`bg-transparent font-black text-[10px] uppercase tracking-widest outline-none cursor-pointer ${order.status === 'picked_up' ? 'text-emerald-500' : order.status === 'ready' ? 'text-gold' : 'text-white/20 hover:text-white/40'}`}>
                    <option value="pending" className={isDarkMode ? 'bg-[#0a0a0b] text-gold' : ''}>Pending</option>
                    <option value="baking" className={isDarkMode ? 'bg-[#0a0a0b] text-gold' : ''}>Baking</option>
                    <option value="ready" className={isDarkMode ? 'bg-[#0a0a0b] text-gold' : ''}>Ready</option>
                    <option value="picked_up" className={isDarkMode ? 'bg-[#0a0a0b] text-gold' : ''}>Picked Up</option>
                  </select>
                </td>
                <td className="px-8 py-6 text-right">
                  <button onClick={() => window.open(`https://wa.me/${(order.customer_phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(`Bonjour ${order.customer_name}, votre commande BakeryOS est maintenant ${order.status.toUpperCase()}! 🥐`)}`, '_blank')}
                    className={`p-4 rounded-2xl transition-all ${isDarkMode ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-black' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white'}`} title="Share via WhatsApp">
                    <Zap size={18} fill="currentColor" />
                  </button>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan={4} className="py-20 text-center opacity-10"><FileText size={48} className="mx-auto mb-4" /><p className="font-black text-[10px] uppercase tracking-widest">No Active Bookings</p></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

export default OrdersPanel;
