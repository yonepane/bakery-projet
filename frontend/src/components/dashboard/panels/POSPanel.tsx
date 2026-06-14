import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Trash2, Lock, X, CheckCircle, Users, Search } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { DashboardSharedProps } from '../types';

type Props = Pick<DashboardSharedProps,
  'isDarkMode' | 'inventory' | 'cart' | 'setCart' | 'addToCart' | 'finalizeSale' |
  'formatPrice' | 'lastTransaction' | 'setShowReceiptModal' | 'setShowBookingModal' |
  'setBookingForm' | 'bookingForm' | 'API_BASE' | 'history' | 'api' | 'fetchData' | 'user' | 'customers' | 'openSelector'>;

const POSPanel: React.FC<Props> = ({
  isDarkMode, inventory, cart, setCart, addToCart, finalizeSale, formatPrice,
  lastTransaction, setShowReceiptModal, setShowBookingModal, setBookingForm, bookingForm, API_BASE,
  history, api, fetchData, user, customers, openSelector
}) => {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [showCloseShift, setShowCloseShift] = useState(false);
  const [countedCash, setCountedCash] = useState<string>('');
  const [shiftClosed, setShiftClosed] = useState(false);
  const [shiftResult, setShiftResult] = useState<{ expected: number, counted: number, diff: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [cashGiven, setCashGiven] = useState<number | null>(null);

  useEffect(() => {
    if (cart.length === 0) setCashGiven(null);
  }, [cart.length]);

  const filteredProducts = inventory.products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCloseShift = async () => {
    // Calculate expected cash from today's sales
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expectedCash = history
      .filter(tx => tx.type === 'sale' && new Date(tx.timestamp) >= today)
      .reduce((sum, tx) => sum + (tx.revenue || 0), 0);
      
    const counted = parseFloat(countedCash) || 0;
    const diff = counted - expectedCash;
    
    // Log discrepancy to shift logs
    const logContent = `[CLÔTURE DE CAISSE] Expected: ${expectedCash.toFixed(2)}, Counted: ${counted.toFixed(2)}, Écart: ${diff.toFixed(2)}`;
    await api.post('/shift-logs', { author: user?.username || 'System', content: logContent });
    
    setShiftResult({ expected: expectedCash, counted, diff });
    setShiftClosed(true);
    fetchData();
  };

  return (
    <div className="flex gap-8 h-[calc(100vh-250px)] relative">
      {/* Left: Product Catalog */}
      <div className="flex-1 flex flex-col gap-5 min-h-0">

        {/* Search Bar */}
        <div className={`relative flex-shrink-0`}>
          <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
            <Search size={16} className={`transition-colors ${searchQuery ? (isDarkMode ? 'text-gold' : 'text-slate-700') : (isDarkMode ? 'text-cream/30' : 'text-slate-300')}`} />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search products…"
            className={`w-full pl-12 pr-5 py-4 rounded-2xl border outline-none font-bold text-sm transition-all duration-300 ${
              isDarkMode
                ? 'bg-slate-900/60 border-white/5 text-cream placeholder:text-cream/20 focus:border-gold/40 focus:bg-slate-900/80 focus:shadow-[0_0_0_3px_rgba(212,175,55,0.06)]'
                : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-300 focus:border-slate-400 focus:shadow-[0_0_0_3px_rgba(0,0,0,0.04)] shadow-sm'
            }`}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className={`absolute inset-y-0 right-0 pr-5 flex items-center transition-opacity hover:opacity-70 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Product Grid */}
        <div className="flex-1 grid grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pr-1 custom-scrollbar content-start">
          {filteredProducts.map(p => (
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

          {/* Empty State */}
          {filteredProducts.length === 0 && (
            <div className="col-span-3 flex flex-col items-center justify-center py-24 text-center select-none">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-5 ${isDarkMode ? 'bg-white/5' : 'bg-slate-100'}`}>
                <Search size={28} className={`${isDarkMode ? 'text-cream/20' : 'text-slate-300'}`} />
              </div>
              <p className={`text-sm font-bold mb-1 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>No products found</p>
              <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-cream/20' : 'text-slate-300'}`}>
                Try a different keyword
              </p>
            </div>
          )}
        </div>

      </div>

      <div className={`w-96 rounded-[2.5rem] flex flex-col overflow-hidden transition-all duration-500 ${isDarkMode ? 'glass-panel border-gold/10 shadow-glass' : 'border border-slate-200 bg-white shadow-2xl'}`}>
        <div className={`p-8 border-b backdrop-blur-md flex justify-between items-center ${isDarkMode ? 'border-white/5 bg-white/5' : 'border-slate-100 bg-slate-50'}`}>
          <h3 className={`text-xl font-bold luxury-font uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Current Tray</h3>
          <button onClick={() => setShowCloseShift(true)} className="p-2 rounded-full bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors" title="Close Shift">
            <Lock size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {cart.map(item => (
            <div key={item.id} className={`flex justify-between items-center p-4 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
              <div>
                <p className={`font-bold text-sm ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>{item.name}</p>
                <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>{item.qty} x {formatPrice(item.price)}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <button onClick={() => setCart(cart.map(i => i.id === item.id ? { ...i, qty: Math.max(1, i.qty - 1) } : i))} className={`w-6 h-6 rounded-md flex items-center justify-center text-xs ${isDarkMode ? 'bg-white/5 hover:bg-white/10 text-cream' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'}`}>-</button>
                  <span 
                    onClick={() => openSelector({
                      title: 'Set Quantity',
                      label: 'Quantity',
                      value: item.qty.toString(),
                      type: 'text',
                      onConfirm: (val) => {
                        const parsed = parseInt(val);
                        if (!isNaN(parsed) && parsed > 0) {
                          setCart(cart.map(i => i.id === item.id ? { ...i, qty: parsed } : i));
                        }
                      }
                    })}
                    className={`font-bold text-sm min-w-[2ch] text-center cursor-pointer hover:text-gold transition-colors ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}
                    title="Click to enter exact quantity"
                  >
                    {item.qty}
                  </span>
                  <button onClick={() => setCart(cart.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i))} className={`w-6 h-6 rounded-md flex items-center justify-center text-xs ${isDarkMode ? 'bg-white/5 hover:bg-white/10 text-cream' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'}`}>+</button>
                </div>
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

          <div className="mb-6">
            <p className={`text-xs font-black uppercase tracking-widest mb-3 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>Quick Cash Payment</p>
            <div className="grid grid-cols-4 gap-2">
              <button onClick={() => setCashGiven(cart.reduce((a, c) => a + (c.price * c.qty), 0))} className={`py-2 rounded-xl text-sm font-bold border transition-colors ${cashGiven === cart.reduce((a, c) => a + (c.price * c.qty), 0) ? 'bg-gold text-charcoal border-gold' : isDarkMode ? 'bg-white/5 border-white/10 hover:border-gold/30' : 'bg-slate-50 border-slate-200 text-slate-900 hover:border-slate-400'}`}>Exact</button>
              {[50, 100, 200].map(amt => (
                <button key={amt} onClick={() => setCashGiven(amt)} className={`py-2 rounded-xl text-sm font-bold border transition-colors ${cashGiven === amt ? 'bg-gold text-charcoal border-gold' : isDarkMode ? 'bg-white/5 border-white/10 hover:border-gold/30 text-white' : 'bg-slate-50 border-slate-200 text-slate-900 hover:border-slate-400'}`}>{amt}</button>
              ))}
            </div>
            {cashGiven !== null && (
              <div className={`mt-4 p-4 rounded-2xl flex justify-between items-center ${cashGiven >= cart.reduce((a, c) => a + (c.price * c.qty), 0) ? (isDarkMode ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-green-50 text-green-700 border border-green-200') : (isDarkMode ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-rose-50 text-rose-700 border border-rose-200')}`}>
                <span className="font-bold text-sm uppercase tracking-widest">Change Due:</span>
                <span className="text-2xl font-black">{cashGiven >= cart.reduce((a, c) => a + (c.price * c.qty), 0) ? (cashGiven - cart.reduce((a, c) => a + (c.price * c.qty), 0)).toFixed(2) : 'Insufficient'} <span className="text-sm">MAD</span></span>
              </div>
            )}
          </div>
          
          {/* Customer Selection for Loyalty Points */}
          <div className="mb-6 relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Users size={16} className={isDarkMode ? 'text-gold' : 'text-slate-400'} />
            </div>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className={`w-full pl-12 pr-4 py-3 rounded-2xl border appearance-none outline-none font-bold text-sm transition-all ${isDarkMode ? 'bg-black/50 border-white/10 text-cream focus:border-gold/40' : 'bg-white border-slate-200 text-slate-900 focus:border-slate-400'}`}
            >
              <option value="" className={isDarkMode ? 'bg-[#0a0a0b] text-cream/50' : 'text-slate-500'}>Walk-in Customer</option>
              {customers.map(c => (
                <option key={c.id} value={c.id} className={isDarkMode ? 'bg-[#0a0a0b] text-gold' : 'text-slate-900'}>
                  {c.name} ({c.points} pts)
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-4">
            <button onClick={() => finalizeSale(selectedCustomerId || null)} disabled={cart.length === 0}
              className={`flex-1 py-6 font-black rounded-2xl uppercase tracking-widest active:scale-95 transition-all ${isDarkMode ? 'bg-gold text-charcoal shadow-gold-glow' : 'bg-slate-900 text-white shadow-xl'}`}>
              Complete Sale
            </button>
            <button
              onClick={() => { setBookingForm({ ...bookingForm, source: 'pos', date: new Date(Date.now() + 86400000).toISOString().slice(0, 16), notes: '' }); setShowBookingModal(true); }}
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

      {/* Blind Cash Reconciliation Modal */}
      {showCloseShift && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl animate-in fade-in rounded-[2rem]">
          <div className={`w-full max-w-md p-10 rounded-[3rem] border shadow-2xl ${isDarkMode ? 'bg-[#0a0a0b] border-white/10 shadow-gold-glow' : 'bg-white border-slate-200'}`}>
            <div className="flex justify-between items-center mb-8">
              <h3 className={`text-2xl font-bold luxury-font uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Clôture de Caisse</h3>
              <button onClick={() => { setShowCloseShift(false); setShiftClosed(false); setShiftResult(null); }} className="text-white/20 hover:text-white"><X size={24} /></button>
            </div>

            {!shiftClosed ? (
              <div className="space-y-8">
                <p className="text-sm opacity-60">Please count the physical cash in the drawer and enter the total amount below. (Blind Count)</p>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-4">Total Cash Counted</label>
                  <input
                    type="number"
                    value={countedCash}
                    onChange={(e) => setCountedCash(e.target.value)}
                    className="w-full text-4xl bg-transparent border-b-2 border-white/10 outline-none pb-4 font-bold text-center"
                    placeholder="0.00"
                    autoFocus
                  />
                </div>
                <button
                  onClick={handleCloseShift}
                  disabled={!countedCash}
                  className={`w-full py-6 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${!countedCash ? 'opacity-50 cursor-not-allowed bg-white/5' : (isDarkMode ? 'bg-rose-500 text-white shadow-[0_0_20px_rgba(244,63,94,0.4)]' : 'bg-slate-900 text-white shadow-xl')}`}
                >
                  Lock Register
                </button>
              </div>
            ) : (
              <div className="space-y-8 text-center animate-in zoom-in duration-300">
                <CheckCircle size={64} className="mx-auto text-emerald-500 mb-6" />
                <h4 className="text-xl font-bold luxury-font uppercase">Shift Closed</h4>
                <div className="p-6 rounded-2xl bg-white/5 space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="opacity-60">Counted Cash</span>
                    <span className="font-bold">{formatPrice(shiftResult?.counted || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="opacity-60">System Expected</span>
                    <span className="font-bold">{formatPrice(shiftResult?.expected || 0)}</span>
                  </div>
                  <div className="pt-4 border-t border-white/10 flex justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-60 mt-1">Écart (Diff)</span>
                    <span className={`text-xl font-bold ${(shiftResult?.diff || 0) < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                      {formatPrice(shiftResult?.diff || 0)}
                    </span>
                  </div>
                </div>
                <p className="text-[10px] uppercase tracking-widest opacity-40">Recorded to Shift Ledger</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default POSPanel;
