import React from 'react';
import { CheckCircle, Edit2, FileText, Package, Plus, Trash2, Truck } from 'lucide-react';
import { DashboardSharedProps } from '../types';

type Props = Pick<DashboardSharedProps,
  'isDarkMode' | 'purchasingSuggestions' | 'purchaseOrders' | 'suppliers' | 'selectedSupplierId' |
  'setSelectedSupplierId' | 'formatPrice' | 'inventory' | 'handleCreatePO' | 'handleReceivePO' |
  'handleDeletePO' | 'openPOModal' | 'addToast' | 'setShowAddSupplier' | 'setEditingSupplier' |
  'setNewSupplier' | 'handleDeleteSupplier'>;

const PurchasingPanel: React.FC<Props> = ({
  isDarkMode, purchasingSuggestions, purchaseOrders, suppliers, selectedSupplierId,
  setSelectedSupplierId, formatPrice, inventory, handleCreatePO, handleReceivePO,
  handleDeletePO, openPOModal, addToast, setShowAddSupplier, setEditingSupplier,
  setNewSupplier, handleDeleteSupplier,
}) => (
  <div className="space-y-8 animate-in fade-in duration-500">
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Procurement Intelligence */}
      <div className={`lg:col-span-2 rounded-[2rem] border overflow-hidden transition-colors ${isDarkMode ? 'glass-panel' : 'bg-white border-slate-200 shadow-xl'}`}>
        <div className="p-8 border-b border-white/5 flex justify-between items-center">
          <h3 className={`text-xl font-bold luxury-font uppercase ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Procurement Intelligence</h3>
          <p className="text-[10px] font-black uppercase tracking-widest text-gold bg-gold/10 px-3 py-1 rounded-full">Auto-Suggestions</p>
        </div>
        <div className="p-8 space-y-6">
          {purchasingSuggestions.length > 0 ? (
            <div className="space-y-4">
              <div className={`p-5 rounded-2xl border flex items-center justify-between gap-4 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                <div>
                  <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>Bulk Order Supplier</p>
                  <p className={`text-sm font-bold mt-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {selectedSupplierId ? suppliers.find(s => s.id === selectedSupplierId)?.name || 'Select supplier' : 'No supplier selected'}
                  </p>
                </div>
                <select value={selectedSupplierId ?? ''} onChange={(e) => setSelectedSupplierId(e.target.value ? Number(e.target.value) : null)}
                  className={`min-w-[220px] border-b py-3 px-2 outline-none text-[10px] font-black uppercase tracking-widest rounded-xl ${isDarkMode ? 'bg-black text-gold border-white/10' : 'bg-white text-slate-700 border-slate-200'}`}>
                  {suppliers.length === 0 ? <option value="">Add supplier first</option> : suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              {purchasingSuggestions.map(s => (
                <div key={s.name} className={`p-6 rounded-3xl border flex items-center justify-between ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gold/10 flex items-center justify-center text-gold"><Package size={20} /></div>
                    <div>
                      <p className="font-bold text-sm">{s.name}</p>
                      <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>Stock: {s.current_stock}{s.unit} | Min: {s.min_threshold}{s.unit}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-gold uppercase tracking-widest">Buy +{s.suggested_buy}{s.unit}</p>
                    <p className="text-[10px] font-bold opacity-40">Est. {formatPrice(s.estimated_cost)}</p>
                  </div>
                </div>
              ))}
              <button
                onClick={async () => {
                  if (!suppliers.length) { addToast('Add a supplier first', 'error'); return; }
                  if (!selectedSupplierId) { addToast('Select a supplier first', 'error'); return; }
                  const items = purchasingSuggestions.map(s => ({ name: s.name, qty: s.suggested_buy, price: inventory.materials[s.name]?.price || 0 }));
                  await handleCreatePO({ supplier_id: selectedSupplierId, items });
                }}
                disabled={!suppliers.length || !selectedSupplierId}
                className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-40 ${isDarkMode ? 'bg-gold text-charcoal shadow-gold-glow' : 'bg-slate-900 text-white'}`}>
                Generate Bulk Purchase Order
              </button>
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center opacity-20">
              <CheckCircle size={48} className="mb-4" />
              <p className="font-black text-xs uppercase tracking-widest text-center">Stock Levels Optimal<br /><span className="text-[10px] lowercase font-bold tracking-normal opacity-60">No procurement suggested</span></p>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar: Recent Orders + Suppliers */}
      <div className="space-y-8">
        {/* Recent Orders */}
        <div className={`rounded-[2rem] border overflow-hidden transition-colors ${isDarkMode ? 'glass-panel' : 'bg-white border-slate-200 shadow-xl'}`}>
          <div className="p-8 border-b border-white/5 flex justify-between items-center">
            <h3 className={`text-xl font-bold luxury-font uppercase ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Recent Orders</h3>
            <div className="flex items-center gap-3">
              <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-cream/30' : 'text-slate-400'}`}>{purchaseOrders.length} orders</p>
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
          </div>
          <div className="p-6 space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar">
            {purchaseOrders.filter(po => !po.archived).map(po => (
              <div key={po.id} className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Order ID</p>
                    <p className="font-bold font-mono text-sm">{po.id}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${po.status === 'received' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-gold/10 text-gold'}`}>{po.status}</span>
                    <button onClick={() => handleDeletePO(po.id)} className="p-1.5 rounded-lg text-rose-500/30 hover:text-rose-500 hover:bg-rose-500/10"><Trash2 size={14} /></button>
                  </div>
                </div>
                <div className="space-y-2 mb-4">
                  <button onClick={() => openPOModal(po)} className={`w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest ${isDarkMode ? 'bg-white/10 hover:bg-white/15' : 'bg-slate-200 text-slate-900'}`}>Manage Order</button>
                  {po.status === 'draft' && <button onClick={() => handleReceivePO(po.id)} className={`w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest ${isDarkMode ? 'bg-gold text-charcoal' : 'bg-slate-900 text-white'}`}>Mark as Fully Received</button>}
                </div>
              </div>
            ))}
            {purchaseOrders.filter(po => !po.archived).length === 0 && <div className="py-10 text-center opacity-20"><FileText size={32} className="mx-auto mb-4" /><p className="text-[10px] font-black uppercase tracking-widest">No Recent Orders</p></div>}
          </div>
        </div>

        {/* Suppliers */}
        <div className={`rounded-[2rem] border overflow-hidden transition-colors ${isDarkMode ? 'glass-panel' : 'bg-white border-slate-200 shadow-xl'}`}>
          <div className="p-8 border-b border-white/5 flex justify-between items-center">
            <h3 className={`text-xl font-bold luxury-font uppercase ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Suppliers</h3>
            <button onClick={() => setShowAddSupplier(true)} className="text-gold p-2 hover:bg-gold/10 rounded-lg transition-all"><Plus size={16} /></button>
          </div>
          <div className="p-6 space-y-4">
            {suppliers.map(supp => (
              <div key={supp.id} className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate">{supp.name}</p>
                  <p className={`text-[10px] opacity-40 uppercase tracking-widest font-black truncate ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>{supp.contact_info || 'No contact info'}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => { setEditingSupplier(supp); setNewSupplier({ name: supp.name || '', contact_info: supp.contact_info || '' }); setShowAddSupplier(true); }} className={`p-2 rounded-xl ${isDarkMode ? 'bg-white/5 hover:bg-white/10 text-gold' : 'bg-white hover:bg-slate-100 text-slate-700'}`}><Edit2 size={14} /></button>
                  <button onClick={() => handleDeleteSupplier(supp)} className={`p-2 rounded-xl ${isDarkMode ? 'bg-white/5 hover:bg-rose-500/20 text-rose-400' : 'bg-white hover:bg-rose-50 text-rose-600'}`}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
            {suppliers.length === 0 && <div className="py-10 text-center opacity-20"><Truck size={32} className="mx-auto mb-4" /><p className="text-[10px] font-black uppercase tracking-widest">No Registered Suppliers</p></div>}
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default PurchasingPanel;
