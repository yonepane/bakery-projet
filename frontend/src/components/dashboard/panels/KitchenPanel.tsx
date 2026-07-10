import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';
import { Calendar, CheckCircle, FileText, Zap, Croissant, Cake, AlertTriangle } from 'lucide-react';
import { DashboardSharedProps } from '../types';

type Props = Pick<DashboardSharedProps,
  'isDarkMode' | 'planner' | 'inventory' | 'orders' | 'api' |
  'addToast' | 'fetchData' | 'setSelectedProduct' | 'handleCompletePlan'>;

const KitchenPanel: React.FC<Props> = ({
  isDarkMode, planner, inventory, orders, api, addToast, fetchData,
  setSelectedProduct, handleCompletePlan,
}) => {
  const { t } = useTranslation();

  const [activeCategory, setActiveCategory] = useState<'breads_viennoiserie' | 'patisserie'>('breads_viennoiserie');

  // Simple category routing based on name
  const getCategory = (productName: string) => {
    const lower = (productName || '').toLowerCase();
    if (lower.includes('cake') || lower.includes('macaron') || lower.includes('tart') || lower.includes('eclair') || lower.includes('cookie')) {
      return 'patisserie';
    }
    return 'breads_viennoiserie';
  };

  const pendingBatches = planner.filter(p => p.status === 'pending');
  const categoryBatches = pendingBatches.filter(batch => {
    const product = inventory.products.find(x => x.id === batch.product_id);
    return product && getCategory(product.name) === activeCategory;
  });

  // Calculate Low Stock (less than or equal to 5 units) that don't already have a pending batch
  const lowStockAlerts = inventory.products.filter(p => 
    p.stock <= 5 && 
    getCategory(p.name) === activeCategory &&
    !pendingBatches.some(b => b.product_id === p.id)
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h3 className={`text-4xl font-bold luxury-font uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t('kitchen')}</h3>
          <p className={`text-sm mt-1 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>Master Baking Schedule & Inventory Refills</p>
        </div>
      </div>

      {/* Production Categories */}
      <div className={`p-2 rounded-full border inline-flex gap-2 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
        <button 
          onClick={() => setActiveCategory('breads_viennoiserie')}
          className={`px-6 py-3 rounded-full flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${activeCategory === 'breads_viennoiserie' ? 'bg-gold text-charcoal shadow-gold-glow scale-105' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
        >
          <Croissant size={14} /> Breads & Viennoiserie
        </button>
        <button 
          onClick={() => setActiveCategory('patisserie')}
          className={`px-6 py-3 rounded-full flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${activeCategory === 'patisserie' ? 'bg-rose-500 text-white shadow-lg scale-105' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
        >
          <Cake size={14} /> Pâtisserie & Sweets
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Daily Baking Targets & Refills */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Zap size={16} className="text-gold" />
            <h4 className="text-xs font-black uppercase tracking-[0.2em] opacity-40">Production Targets & Low Stock Refills</h4>
          </div>
          
          <div className="space-y-4">
            {/* Show Low Stock Alerts First */}
            {lowStockAlerts.map(product => (
              <div key={`low-${product.id}`} className={`p-6 rounded-[2rem] border-2 border-dashed flex items-center justify-between group transition-all ${isDarkMode ? 'bg-rose-500/5 border-rose-500/30' : 'bg-rose-50 border-rose-200 shadow-sm'}`}>
                <div className="flex items-center gap-6">
                  <div className="text-4xl">{product.icon}</div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle size={14} className="text-rose-500" />
                      <p className={`text-xs font-black text-rose-500 uppercase tracking-widest`}>Low Stock Alert ({product.stock} left)</p>
                    </div>
                    <p className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{product.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedProduct(product)}
                  className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${isDarkMode ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-rose-500 text-white hover:bg-rose-600'}`}
                >
                  Create Batch
                </button>
              </div>
            ))}

            {/* Then Show Planned Batches */}
            {categoryBatches.map(batch => (
              <div key={batch.id} className={`p-8 rounded-[2rem] border flex items-center justify-between group transition-all ${isDarkMode ? 'bg-white/5 border-white/5 hover:border-gold/20' : 'bg-white border-slate-200 shadow-sm'}`}>
                <div className="flex items-center gap-6">
                  <div className="text-5xl">{inventory.products.find(x => x.id === batch.product_id)?.icon}</div>
                  <div>
                    <p className={`text-xl font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{inventory.products.find(x => x.id === batch.product_id)?.name}</p>
                    <p className="text-xs font-black text-gold uppercase tracking-widest">Bake {batch.quantity} Units</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setSelectedProduct(inventory.products.find(x => x.id === batch.product_id) || null)}
                    className={`p-4 rounded-2xl transition-all ${isDarkMode ? 'bg-white/5 hover:bg-white/10 text-white/40 hover:text-white' : 'bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-900'}`}
                    title={t('view_recipe')}
                  >
                    <FileText size={20} />
                  </button>
                  <button
                    onClick={() => handleCompletePlan(batch.id)}
                    className={`px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${isDarkMode ? 'bg-gold text-charcoal shadow-gold-glow hover:scale-105' : 'bg-slate-900 text-white shadow-xl hover:scale-105'}`}
                  >
                    {t('finish_batch')}
                  </button>
                </div>
              </div>
            ))}

            {categoryBatches.length === 0 && lowStockAlerts.length === 0 && (
              <div className="py-20 border-2 border-dashed border-white/5 rounded-[3rem] flex flex-col items-center justify-center opacity-10">
                <CheckCircle size={48} className="mb-4" />
                <p className="font-black text-xs uppercase tracking-widest">All Targets Met</p>
              </div>
            )}
          </div>
        </div>

        {/* Pre-Order Baking Alerts */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Calendar size={16} className="text-gold" />
            <h4 className="text-xs font-black uppercase tracking-[0.2em] opacity-40">{t('pre_order_deadlines')}</h4>
          </div>
          <div className="space-y-4">
            {orders.filter(o => o.status === 'pending' || o.status === 'baking').map(order => (
              <div key={order.id} className={`p-6 rounded-3xl border flex items-center justify-between transition-all ${isDarkMode ? 'bg-black/40 border-white/5' : 'bg-slate-50 border-slate-200 shadow-sm'}`}>
                <div>
                  <p className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{order.customer_name}</p>
                  <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>
                    Pickup: {new Date(order.pickup_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <div className="flex gap-1 mt-2">
                    {order.items.map((it: any, idx: number) => (
                      <span key={idx} className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isDarkMode ? 'bg-white/5 text-white' : 'bg-white border text-slate-700'}`}>
                        {it.qty}x {inventory.products.find(x => x.id === it.id)?.name}
                      </span>
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
                        const cleanPhone = order.customer_phone.replace(/\D/g, '');
                        if (cleanPhone.length >= 8) {
                          window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank', 'noopener,noreferrer');
                        }
                      }
                    }
                    fetchData();
                  }}
                  className={`appearance-none cursor-pointer px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl border transition-all outline-none ${isDarkMode ? 'bg-black/80 border-gold/20 text-gold hover:bg-gold hover:text-charcoal' : 'bg-white border-slate-200 text-slate-900 hover:bg-slate-100 hover:text-slate-900'}`}
                >
                  <option value="pending" className={isDarkMode ? 'bg-[#0a0a0b] text-gold' : ''}>{t('queued')}</option>
                  <option value="baking" className={isDarkMode ? 'bg-[#0a0a0b] text-gold' : ''}>{t('in_oven')}</option>
                  <option value="ready" className={isDarkMode ? 'bg-[#0a0a0b] text-gold' : ''}>{t('ready')}</option>
                </select>
              </div>
            ))}
            {orders.filter(o => o.status === 'pending' || o.status === 'baking').length === 0 && (
              <div className="py-20 border-2 border-dashed border-white/5 rounded-[3rem] flex flex-col items-center justify-center opacity-10">
                <CheckCircle size={48} className="mb-4" />
                <p className="font-black text-xs uppercase tracking-widest">{t('no_pending_orders')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default KitchenPanel;
