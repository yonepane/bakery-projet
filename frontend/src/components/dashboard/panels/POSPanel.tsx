import React from 'react';
import { Calendar, Plus, Trash2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { DashboardSharedProps } from '../types';

type Props = Pick<DashboardSharedProps,
  'isDarkMode' | 'inventory' | 'cart' | 'setCart' | 'addToCart' | 'finalizeSale' |
  'formatPrice' | 'lastTransaction' | 'setShowReceiptModal' | 'setShowBookingModal' |
  'setBookingForm' | 'bookingForm' | 'API_BASE'>;

const POSPanel: React.FC<Props> = ({
  isDarkMode, inventory, cart, setCart, addToCart, finalizeSale, formatPrice,
  lastTransaction, setShowReceiptModal, setShowBookingModal, setBookingForm, bookingForm, API_BASE,
}) => (
  <div className="flex gap-8 h-[calc(100vh-250px)]">
    <div className="flex-1 grid grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pr-4 custom-scrollbar">
      {inventory.products.map(p => (
        <div key={p.id} onClick={() => addToCart(p)}
          className={`p-8 rounded-[2rem] border transition-all duration-300 cursor-pointer group active:scale-95 ${isDarkMode ? 'glass-panel hover:-translate-y-2' : 'border-slate-200 bg-white hover:border-slate-400 shadow-sm'}`}>
          <div className="text-5xl mb-6 group-hover:scale-110 transition-transform">{p.icon}</div>
          <h4 className={`text-xl font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{p.name}</h4>
          <p className={`text-[10px] font-black uppercase tracking-widest mb-6 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>{p.stock} in stock</p>
          <div className={`flex justify-between items-center pt-6 border-t ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
            <span className={`text-2xl font-bold ${isDarkMode ? 'text-gold' : 'text-slate-900'}`}>{formatPrice(p.price)}</span>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ${isDarkMode ? 'bg-gold/10 text-gold group-hover:bg-gold group-hover:text-charcoal group-hover:shadow-gold-glow' : 'bg-slate-100 text-slate-900 group-hover:bg-slate-900 group-hover:text-white'}`}>
              <Plus size={20} />
            </div>
          </div>
        </div>
      ))}
    </div>

    <div className={`w-96 rounded-[2.5rem] flex flex-col overflow-hidden transition-all duration-500 ${isDarkMode ? 'glass-panel border-gold/10 shadow-glass' : 'border border-slate-200 bg-white shadow-2xl'}`}>
      <div className={`p-8 border-b backdrop-blur-md ${isDarkMode ? 'border-white/5 bg-white/5' : 'border-slate-100 bg-slate-50'}`}>
        <h3 className={`text-xl font-bold luxury-font uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Current Tray</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
        {cart.map(item => (
          <div key={item.id} className={`flex justify-between items-center p-4 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
            <div>
              <p className={`font-bold text-sm ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>{item.name}</p>
              <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>{item.qty} x {formatPrice(item.price)}</p>
            </div>
            <div className="flex items-center gap-4">
              <span className={`font-bold ${isDarkMode ? 'text-gold' : 'text-slate-900'}`}>{formatPrice(item.qty * item.price)}</span>
              <button onClick={() => setCart(cart.filter(i => i.id !== item.id))} className="text-rose-500/30 hover:text-rose-500 transition-colors"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
        {cart.length === 0 && <div className="h-full flex items-center justify-center opacity-10 py-20 uppercase tracking-widest text-[10px] font-bold">Tray is Empty</div>}
      </div>
      <div className={`p-8 border-t ${isDarkMode ? 'border-white/5 bg-black/40' : 'border-slate-100 bg-slate-50'}`}>
        <div className="flex justify-between items-end mb-8">
          <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gold' : 'text-slate-400'}`}>Total Due</span>
          <span className={`text-5xl font-bold tracking-tighter ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>
            {formatPrice(cart.reduce((a, c) => a + (c.price * c.qty), 0)).split(' ')[0]}
          </span>
        </div>
        <div className="flex gap-4">
          <button onClick={finalizeSale} disabled={cart.length === 0}
            className={`flex-1 py-6 font-black rounded-2xl uppercase tracking-widest active:scale-95 transition-all ${isDarkMode ? 'bg-gold text-charcoal shadow-gold-glow' : 'bg-slate-900 text-white shadow-xl'}`}>
            Complete Sale
          </button>
          <button
            onClick={() => { setBookingForm({ ...bookingForm, source: 'pos', date: new Date(Date.now() + 86400000).toISOString().slice(0, 16) }); setShowBookingModal(true); }}
            disabled={cart.length === 0}
            className={`p-6 rounded-2xl border transition-all ${isDarkMode ? 'border-white/10 bg-white/5 text-gold hover:bg-white/10' : 'border-slate-200 bg-white text-slate-900'}`}
            title="Save as Pre-Order">
            <Calendar size={24} />
          </button>
        </div>
        {lastTransaction && (
          <button onClick={() => setShowReceiptModal(true)}
            className={`w-full mt-4 py-4 rounded-xl font-bold text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 border transition-all ${isDarkMode ? 'border-gold/20 text-gold hover:bg-gold/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            <QRCodeSVG value={window.location.origin + API_BASE + '/transactions/' + lastTransaction.transaction_id + '/receipt?format=pdf&paper=80mm'} size={16} />
            Show Last Receipt
          </button>
        )}
      </div>
    </div>
  </div>
);

export default POSPanel;
