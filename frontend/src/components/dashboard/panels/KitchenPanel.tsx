import React from 'react';
import { Calendar, CheckCircle, FileText, Zap } from 'lucide-react';
import { DashboardSharedProps } from '../types';

type Props = Pick<DashboardSharedProps,
  'isDarkMode' | 'planner' | 'inventory' | 'orders' | 'api' |
  'addToast' | 'fetchData' | 'setSelectedProduct' | 'handleCompletePlan'>;

const KitchenPanel: React.FC<Props> = ({
  isDarkMode, planner, inventory, orders, api, addToast, fetchData,
  setSelectedProduct, handleCompletePlan,
}) => (
  <div className="space-y-8 animate-in fade-in duration-500">
    <div className="flex justify-between items-center">
      <div>
        <h3 className={`text-4xl font-bold luxury-font uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Baker's Pipeline</h3>
        <p className={`text-sm mt-1 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>Real-time production monitoring and execution</p>
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
      {/* Live Production Queue */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Zap size={16} className="text-gold" />
          <h4 className="text-xs font-black uppercase tracking-[0.2em] opacity-40">Active Batch Queue</h4>
        </div>
        <div className="space-y-4">
          {planner.filter(p => p.status === 'pending').map(batch => (
            <div key={batch.id} className={`p-8 rounded-[2.5rem] border flex items-center justify-between group transition-all ${isDarkMode ? 'bg-white/5 border-white/5 hover:border-gold/20' : 'bg-white border-slate-200 shadow-sm'}`}>
              <div className="flex items-center gap-6">
                <div className="text-5xl">{inventory.products.find(x => x.id === batch.product_id)?.icon}</div>
                <div>
                  <p className="text-xl font-bold mb-1">{inventory.products.find(x => x.id === batch.product_id)?.name}</p>
                  <p className="text-xs font-black text-gold uppercase tracking-widest">{batch.quantity} Units Required</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedProduct(inventory.products.find(x => x.id === batch.product_id) || null)}
                  className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all"
                  title="View Recipe"
                >
                  <FileText size={20} />
                </button>
                <button
                  onClick={() => handleCompletePlan(batch.id)}
                  className={`px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${isDarkMode ? 'bg-gold text-charcoal shadow-gold-glow hover:scale-105' : 'bg-slate-900 text-white shadow-xl'}`}
                >
                  Finish Batch
                </button>
              </div>
            </div>
          ))}
          {planner.filter(p => p.status === 'pending').length === 0 && (
            <div className="py-20 border-2 border-dashed border-white/5 rounded-[3rem] flex flex-col items-center justify-center opacity-10">
              <CheckCircle size={48} className="mb-4" />
              <p className="font-black text-xs uppercase tracking-widest">No Active Batches</p>
            </div>
          )}
        </div>
      </div>

      {/* Pre-Order Baking Alerts */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Calendar size={16} className="text-gold" />
          <h4 className="text-xs font-black uppercase tracking-[0.2em] opacity-40">Pre-Order Deadlines</h4>
        </div>
        <div className="space-y-4">
          {orders.filter(o => o.status === 'pending' || o.status === 'baking').map(order => (
            <div key={order.id} className={`p-6 rounded-3xl border flex items-center justify-between transition-all ${isDarkMode ? 'bg-black/40 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
              <div>
                <p className="font-bold text-sm">{order.customer_name}</p>
                <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>
                  Pickup: {new Date(order.pickup_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
                <div className="flex gap-1 mt-2">
                  {order.items.map((it: any, idx: number) => (
                    <span key={idx} className="text-[10px] bg-white/5 px-2 py-0.5 rounded-full">{it.qty}x {inventory.products.find(x => x.id === it.id)?.name}</span>
                  ))}
                </div>
              </div>
              <select
                value={order.status}
                onChange={async (e) => {
                  await api.patch(`/orders/${order.id}/status?status=${e.target.value}`, null);
                  if (e.target.value === 'ready') {
                    addToast(`Order for ${order.customer_name} is Ready!`, "success");
                    const msg = encodeURIComponent(`Bonjour ${order.customer_name}, votre commande chez BakeryOS est prête! 🥐`);
                    if (order.customer_phone) {
                      window.open(`https://wa.me/${order.customer_phone.replace(/\D/g, '')}?text=${msg}`, '_blank');
                    }
                  }
                  fetchData();
                }}
                className={`bg-transparent text-[10px] font-black uppercase tracking-widest outline-none ${order.status === 'baking' ? 'text-gold' : 'text-cream/40'}`}
              >
                <option value="pending">Queued</option>
                <option value="baking">In Oven</option>
                <option value="ready">Ready</option>
              </select>
            </div>
          ))}
          {orders.filter(o => o.status === 'pending' || o.status === 'baking').length === 0 && (
            <div className="py-20 border-2 border-dashed border-white/5 rounded-[3rem] flex flex-col items-center justify-center opacity-10">
              <CheckCircle size={48} className="mb-4" />
              <p className="font-black text-xs uppercase tracking-widest">No Pending Orders</p>
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
);

export default KitchenPanel;
