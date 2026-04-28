import React from 'react';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import { DashboardSharedProps } from '../types';

type Props = Pick<DashboardSharedProps,
  'isDarkMode' | 'inventory' | 'editMode' | 'formatPrice' |
  'handleOpenEditProduct' | 'handleDeleteProduct' | 'handleCleanupProducts' |
  'setShowAddProduct' | 'setSelectedProduct'>;

const FichePanel: React.FC<Props> = ({
  isDarkMode, inventory, editMode, formatPrice,
  handleOpenEditProduct, handleDeleteProduct, handleCleanupProducts,
  setShowAddProduct, setSelectedProduct,
}) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
    {inventory.products.map(p => (
      <div key={p.id} className={`p-8 rounded-[2.5rem] border transition-colors ${isDarkMode ? 'glass-panel' : 'bg-white border-slate-200 shadow-xl'}`}>
        <div className="flex justify-between items-start mb-8">
          <div>
            <span className="text-4xl mb-2 block">{p.icon}</span>
            <h3 className={`text-xl font-bold luxury-font ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{p.name}</h3>
          </div>
          <div className="text-right flex flex-col items-end gap-2">
            {editMode && (
              <button onClick={() => handleOpenEditProduct(p)} className="p-2 rounded-lg bg-gold/10 text-gold hover:bg-gold/20 transition-all" title="Edit Product">
                <Edit2 size={16} />
              </button>
            )}
            <div>
              <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gold' : 'text-slate-400'}`}>Unit Cost</p>
              <p className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{formatPrice(p.live_cost || 0)}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-8 p-3 rounded-2xl bg-white/5 border border-white/5">
          <div className="text-center"><p className="text-[8px] uppercase font-black opacity-40 mb-1">Prep</p><p className="text-xs font-bold">{p.prep_time}m</p></div>
          <div className="text-center border-x border-white/5"><p className="text-[8px] uppercase font-black opacity-40 mb-1">Cook</p><p className="text-xs font-bold">{p.cook_time}m</p></div>
          <div className="text-center"><p className="text-[8px] uppercase font-black opacity-40 mb-1">Yield</p><p className="text-xs font-bold">{p.yield_qty}</p></div>
        </div>

        <div className="space-y-2 mb-8">
          {p.ingredients.map((ing, idx) => (
            <div key={idx} className="flex justify-between items-center text-xs">
              <span className={isDarkMode ? 'text-cream/40' : 'text-slate-500'}>{ing.name}</span>
              <span className="font-bold opacity-60">{ing.quantity}g</span>
            </div>
          ))}
        </div>

        <div className={`pt-6 border-t flex justify-between items-center ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
          <div>
            <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-emerald-500/50' : 'text-emerald-600'}`}>Projected Margin</p>
            <p className="text-xl font-bold text-emerald-500">{p.price > 0 ? (((p.price - (p.live_cost || 0)) / p.price) * 100).toFixed(1) : 0}%</p>
          </div>
          {editMode && <button onClick={() => handleDeleteProduct(p.id)} className="text-rose-500/20 hover:text-rose-500 transition-colors"><Trash2 size={16} /></button>}
        </div>

        <button onClick={() => setSelectedProduct(p)} className={`w-full mt-4 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border transition-all ${isDarkMode ? 'border-gold/20 text-gold hover:bg-gold hover:text-charcoal' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
          View Executive Protocol
        </button>
      </div>
    ))}

    {editMode && (
      <>
        <div onClick={handleCleanupProducts} className={`p-8 rounded-[2.5rem] border border-dashed flex flex-col items-center justify-center cursor-pointer border-rose-500/20 hover:border-rose-500 group transition-all min-h-[300px] ${isDarkMode ? 'bg-rose-500/5' : 'bg-rose-50'}`}>
          <div className="w-16 h-16 rounded-full border-2 border-dashed border-rose-500/20 flex items-center justify-center group-hover:border-rose-500 group-hover:scale-110 transition-all mb-4 text-rose-500"><Trash2 size={24} /></div>
          <p className="font-black text-[10px] uppercase tracking-[0.2em] text-rose-500 opacity-40 group-hover:opacity-100 transition-all text-center">Cleanup Broken Data<br /><span className="text-[8px] opacity-60">Removes empty IDs</span></p>
        </div>
        <div onClick={() => setShowAddProduct(true)} className={`p-8 rounded-[2.5rem] border border-dashed flex flex-col items-center justify-center cursor-pointer hover:border-gold/40 group transition-all min-h-[300px] ${isDarkMode ? 'border-white/10 bg-black/5' : 'border-slate-300 bg-slate-50'}`}>
          <div className="w-16 h-16 rounded-full border-2 border-dashed border-white/10 flex items-center justify-center group-hover:border-gold/40 group-hover:scale-110 transition-all mb-4">
            <Plus className="opacity-20 group-hover:opacity-100 group-hover:text-gold transition-all" />
          </div>
          <p className="font-black text-[10px] uppercase tracking-[0.2em] opacity-20 group-hover:opacity-100 group-hover:text-gold transition-all">New Entity</p>
        </div>
      </>
    )}
  </div>
);

export default FichePanel;
