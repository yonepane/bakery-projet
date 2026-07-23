import { useTranslation } from 'react-i18next';
import React, { useState, useEffect } from 'react';
import { useUISelector, useServerDataSelector, useAuthSelector, useModalSelector } from '../DashboardContext';
import { useCart } from '../CartContext';
import type { Product } from '../types';
import { Calendar, Plus, Trash2, Lock, X, CheckCircle, Users, Search } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const HoldableButton: React.FC<{ onClick: () => void; className?: string; children: React.ReactNode }> = ({ onClick, className, children }) => {
  const holdIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const holdTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const startHold = (e: React.PointerEvent) => {
    // Only start on primary mouse button or touch
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    onClick(); // Immediate action
    holdTimeoutRef.current = setTimeout(() => {
      holdIntervalRef.current = setInterval(() => {
        onClick();
      }, 100);
    }, 400);
  };

  const stopHold = () => {
    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
  };

  return (
    <button
      onPointerDown={startHold}
      onPointerUp={stopHold}
      onPointerLeave={stopHold}
      onPointerCancel={stopHold}
      onContextMenu={(e) => e.preventDefault()}
      className={className}
      style={{ touchAction: 'manipulation', userSelect: 'none' }}
    >
      {children}
    </button>
  );
};

const POSPanel: React.FC = () => {
  const { isDarkMode, formatPrice } = useUISelector();
  const { inventory, history, fetchData, customers } = useServerDataSelector();
  const { cart, setCart, addToCart, finalizeSale, lastTransaction, setShowReceiptModal, setShowBookingModal, setBookingForm, bookingForm, API_BASE, api } = useCart();
  const { user } = useAuthSelector();
  const { openSelector } = useModalSelector();
  const { t } = useTranslation();

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

  const filteredProducts = inventory.products.filter((p: Product) =>
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
    <div className="flex gap-4 h-[calc(100vh-250px)] relative">
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
            placeholder={t('search_products')}
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
        <div className="flex-1 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 overflow-y-auto pr-1 custom-scrollbar content-start">
          {filteredProducts.map((p: Product) => (
            <div key={p.id} onClick={() => addToCart(p)}
              className={`p-4 rounded-[1.4rem] border transition-all duration-300 cursor-pointer group active:scale-95 ${isDarkMode ? 'glass-panel hover:-translate-y-1' : 'border-slate-200 bg-white hover:border-slate-400 shadow-sm'}`}>
              <div className="text-3xl mb-2.5 group-hover:scale-110 transition-transform">{p.icon}</div>
              <h4 className={`text-sm font-bold mb-0.5 leading-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{p.name}</h4>
              {p.allergens && p.allergens.length > 0 && (
                <div className="allergen-badges mb-2">
                  {p.allergens.map((a: string) => (
                    <span key={a} className="allergen-badge">{a}</span>
                  ))}
                </div>
              )}
              <p className={`text-[9px] font-black uppercase tracking-widest mb-2.5 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>{p.stock} in stock</p>
              <div className={`flex justify-between items-center pt-2.5 border-t ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                <span className={`text-sm font-bold ${isDarkMode ? 'text-gold' : 'text-slate-900'}`}>{formatPrice(p.price)}</span>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-500 ${isDarkMode ? 'bg-gold/10 text-gold group-hover:bg-gold group-hover:text-charcoal group-hover:shadow-gold-glow' : 'bg-slate-100 text-slate-900 group-hover:bg-slate-900 group-hover:text-white'}`}>
                  <Plus size={14} />
                </div>
              </div>
            </div>
          ))}

          {/* Empty State */}
          {filteredProducts.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-24 text-center select-none">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-5 ${isDarkMode ? 'bg-white/5' : 'bg-slate-100'}`}>
                <Search size={28} className={`${isDarkMode ? 'text-cream/20' : 'text-slate-300'}`} />
              </div>
              <p className={`text-sm font-bold mb-1 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>{t('no_products_found')}</p>
              <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-cream/20' : 'text-slate-300'}`}>
                {t('try_a_different_keyword')}
              </p>
            </div>
          )}
        </div>

      </div>

      <div className={`w-96 flex-shrink-0 rounded-[2.5rem] flex flex-col overflow-hidden transition-all duration-500 ${isDarkMode ? 'glass-panel border-gold/10 shadow-glass' : 'border border-slate-200 bg-white shadow-2xl'}`}>
        <div className={`px-6 py-4 border-b backdrop-blur-md flex justify-between items-center ${isDarkMode ? 'border-white/5 bg-white/5' : 'border-slate-100 bg-slate-50'}`}>
          <h3 className={`text-xl font-bold luxury-font uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t('current_tray')}</h3>
          <button onClick={() => setShowCloseShift(true)} className="p-2 rounded-full bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors" title={t('close_shift')}>
            <Lock size={15} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {cart.map(item => (
            <div key={item.id} className={`flex justify-between items-center p-4 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
              <div>
                <p className={`font-bold text-base ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>{item.name}</p>
                <p className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>{item.qty} x {formatPrice(item.price)}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <HoldableButton onClick={() => setCart(prev => prev.map(i => i.id === item.id ? { ...i, qty: Math.max(1, i.qty - 1) } : i))} className={`w-6 h-6 rounded-md flex items-center justify-center text-xs ${isDarkMode ? 'bg-white/5 hover:bg-white/10 text-cream' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'}`}>-</HoldableButton>
                  <span 
                    onClick={() => openSelector({
                      title: 'Set Quantity',
                      label: 'Quantity',
                      value: item.qty.toString(),
                      type: 'text',
                      onConfirm: (val) => {
                        const parsed = parseInt(val);
                        if (!isNaN(parsed) && parsed > 0) {
                          setCart(prev => prev.map(i => i.id === item.id ? { ...i, qty: parsed } : i));
                        }
                      }
                    })}
                    className={`font-bold text-sm min-w-[2ch] text-center cursor-pointer hover:text-gold transition-colors ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}
                    title={t('click_to_enter_exact_quantity')}
                  >
                    {item.qty}
                  </span>
                  <HoldableButton onClick={() => setCart(prev => prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i))} className={`w-6 h-6 rounded-md flex items-center justify-center text-xs ${isDarkMode ? 'bg-white/5 hover:bg-white/10 text-cream' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'}`}>+</HoldableButton>
                  <button 
                    onClick={() => {
                      const product = inventory.products.find((p: Product) => p.id === item.id);
                      if (product && product.stock > 0) {
                        setCart(prev => prev.map(i => i.id === item.id ? { ...i, qty: product.stock } : i));
                      }
                    }} 
                    className={`px-1.5 h-6 rounded-md flex items-center justify-center text-[9px] font-black uppercase tracking-wider ${isDarkMode ? 'bg-gold/10 text-gold hover:bg-gold/20' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                    title={t('sell_all_stock')}
                  >
                    MAX
                  </button>
                </div>
                <span className={`font-bold text-base ${isDarkMode ? 'text-gold' : 'text-slate-900'}`}>{formatPrice(item.qty * item.price)}</span>
                <button onClick={() => setCart(cart.filter(i => i.id !== item.id))} className="text-rose-500/30 hover:text-rose-500 transition-colors"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
          {cart.length === 0 && <div className="h-full flex items-center justify-center opacity-10 py-20 uppercase tracking-widest text-[10px] font-bold">{t('tray_is_empty')}</div>}
        </div>
        <div className={`p-5 border-t ${isDarkMode ? 'border-white/5 bg-black/40' : 'border-slate-100 bg-slate-50'}`}>
          {(() => {
            const total = cart.reduce((a, c) => a + (c.price * c.qty), 0);
            return (
              <>
                <div className="flex justify-between items-end mb-4">
                  <span className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-gold' : 'text-slate-400'}`}>{t('total_due')}</span>
                  <span className={`text-4xl font-bold tracking-tighter ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>
                    {formatPrice(total).split(' ')[0]}
                  </span>
                </div>

                {/* Cash + Customer row */}
                <div className="flex gap-2 mb-3">
                  {/* Cash input with embedded Exact button */}
                  <div className="relative flex-1">
                    <input
                      type="number"
                      value={cashGiven === null ? '' : cashGiven}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCashGiven(val === '' ? null : parseFloat(val));
                      }}
                      placeholder={t('enter_cash_received') || "Cash..."}
                      className={`w-full pl-3 pr-14 py-2.5 rounded-xl border text-sm font-bold outline-none transition-all ${isDarkMode ? 'bg-white/5 border-white/10 text-cream focus:border-gold/40 placeholder:text-cream/20' : 'bg-white border-slate-200 text-slate-900 focus:border-slate-400 placeholder:text-slate-400'}`}
                    />
                    <button
                      onClick={() => setCashGiven(total)}
                      className={`absolute right-1 top-1 bottom-1 px-2.5 rounded-lg text-[10px] font-black uppercase border transition-all ${cashGiven === total ? 'bg-gold text-charcoal border-gold' : isDarkMode ? 'bg-white/10 border-white/5 text-gold hover:bg-white/20' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'}`}
                    >
                      {t('exact')}
                    </button>
                  </div>
                  {/* Customer icon button */}
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                      <Users size={11} className={isDarkMode ? 'text-gold' : 'text-slate-400'} />
                    </div>
                    <select
                      value={selectedCustomerId}
                      onChange={(e) => setSelectedCustomerId(e.target.value)}
                      className={`pl-7 pr-1 py-2.5 w-24 rounded-xl border appearance-none outline-none font-bold text-xs transition-all ${isDarkMode ? 'bg-black/50 border-white/10 text-cream focus:border-gold/40' : 'bg-white border-slate-200 text-slate-900 focus:border-slate-400'}`}
                    >
                      <option value="" className={isDarkMode ? 'bg-[#0a0a0b] text-cream/50' : 'text-slate-500'}>—</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id} className={isDarkMode ? 'bg-[#0a0a0b] text-gold' : 'text-slate-900'}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {cashGiven !== null && (
                  <div className={`mb-4 px-4 py-2 rounded-xl flex justify-between items-center text-xs font-black uppercase tracking-wider border ${cashGiven >= total ? (isDarkMode ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-green-50 text-green-700 border-green-200') : (isDarkMode ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-rose-50 text-rose-700 border-rose-200')}`}>
                    <span>{t('change_due')}</span>
                    <span>{cashGiven >= total ? (cashGiven - total).toFixed(2) : 'Insufficient'} {t('mad')}</span>
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={() => finalizeSale(selectedCustomerId || null)} disabled={cart.length === 0}
                    className={`flex-1 py-5 font-black rounded-2xl uppercase tracking-widest active:scale-95 transition-all text-sm ${isDarkMode ? 'bg-gold text-charcoal shadow-gold-glow' : 'bg-slate-900 text-white shadow-xl'}`}>
                    {t('complete_sale')}
                  </button>
                  <button
                    onClick={() => { setBookingForm({ ...bookingForm, source: 'pos', date: new Date(Date.now() + 86400000).toISOString().slice(0, 16), notes: '' }); setShowBookingModal(true); }}
                    disabled={cart.length === 0}
                    className={`p-3.5 rounded-2xl border transition-all ${isDarkMode ? 'border-white/10 bg-white/5 text-gold hover:bg-white/10' : 'border-slate-200 bg-white text-slate-900'}`}
                    title={t('save_as_pre_order')}>
                    <Calendar size={18} />
                  </button>
                </div>

                {lastTransaction && (
                  <button onClick={() => setShowReceiptModal(true)}
                    className={`w-full mt-2.5 py-2 rounded-xl font-bold text-[9px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 border transition-all ${isDarkMode ? 'border-gold/20 text-gold hover:bg-gold/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    <QRCodeSVG value={window.location.origin + API_BASE + '/transactions/' + lastTransaction.transaction_id || lastTransaction.id + '/receipt?format=pdf&paper=80mm'} size={12} />
                    {t('show_last_receipt')}
                  </button>
                )}
              </>
            );
          })()}
        </div>
      </div>

      {/* Blind Cash Reconciliation Modal */}
      {showCloseShift && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl animate-in fade-in rounded-[2rem]">
          <div className={`w-full max-w-md p-10 rounded-[3rem] border shadow-2xl ${isDarkMode ? 'bg-[#0a0a0b] border-white/10 shadow-gold-glow' : 'bg-white border-slate-200'}`}>
            <div className="flex justify-between items-center mb-8">
              <h3 className={`text-2xl font-bold luxury-font uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t('cl_ture_de_caisse')}</h3>
              <button onClick={() => { setShowCloseShift(false); setShiftClosed(false); setShiftResult(null); }} className="text-white/20 hover:text-white"><X size={24} /></button>
            </div>

            {!shiftClosed ? (
              <div className="space-y-8">
                <p className="text-sm opacity-60">{t('please_count_the_physical_cash')}</p>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-4">{t('total_cash_counted')}</label>
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
                  {t('lock_register')}
                </button>
              </div>
            ) : (
              <div className="space-y-8 text-center animate-in zoom-in duration-300">
                <CheckCircle size={64} className="mx-auto text-emerald-500 mb-6" />
                <h4 className="text-xl font-bold luxury-font uppercase">{t('shift_closed')}</h4>
                <div className="p-6 rounded-2xl bg-white/5 space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="opacity-60">{t('counted_cash')}</span>
                    <span className="font-bold">{formatPrice(shiftResult?.counted || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="opacity-60">{t('system_expected')}</span>
                    <span className="font-bold">{formatPrice(shiftResult?.expected || 0)}</span>
                  </div>
                  <div className="pt-4 border-t border-white/10 flex justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-60 mt-1">{t('cart_diff')}</span>
                    <span className={`text-xl font-bold ${(shiftResult?.diff || 0) < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                      {formatPrice(shiftResult?.diff || 0)}
                    </span>
                  </div>
                </div>
                <p className="text-[10px] uppercase tracking-widest opacity-40">{t('recorded_to_shift_ledger')}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default POSPanel;
