import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Sun, Moon, Bell, CheckCircle, AlertTriangle, TrendingUp } from 'lucide-react';
import { useDashboard } from '../DashboardContext';
import { formatPrice as formatMoney } from '../utils';

interface DashboardHeaderProps {
  isOnline: boolean;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({ isOnline }) => {
  const { t } = useTranslation();
  const {
    isDarkMode, setIsDarkMode,
    activeTab,
    user,
    alerts,
    editMode, setEditMode,
    activeCurrency, liveRates,
    analytics,
    showAlertsPopover, setShowAlertsPopover,
    notificationRef
  } = useDashboard();

  // Alerts popover click-outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowAlertsPopover(false);
      }
    };

    if (showAlertsPopover) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAlertsPopover, setShowAlertsPopover]);

  const formatPrice = (amount: number) => formatMoney(amount, activeCurrency, liveRates);

  return (
    <header className="flex justify-between items-end mb-12">
      <div>
        <h2 className={`text-5xl font-bold luxury-font mb-2 tracking-tighter uppercase text-gold-gradient`}>
            {activeTab === 'dashboard' && t('dashboard')}
            {activeTab === 'pos' && t('pos')}
            {activeTab === 'inventory' && t('inventory')}
            {activeTab === 'stock_movements' && 'Stock Ledger'}
            {activeTab === 'planner' && t('planner')}
            {activeTab === 'comptabilite' && t('comptabilite')}
            {activeTab === 'expenses' && t('expenses_1')}
            {activeTab === 'purchasing' && t('purchasing')}
            {activeTab === 'kitchen' && t('kitchen')}
            {activeTab === 'kitchen_board' && 'Kitchen Board'}
            {activeTab === 'intelligence' && 'Intelligence'}
            {activeTab === 'forecast' && (t('forecast') || 'Forecast')}
            {activeTab === 'orders' && t('orders')}
            {activeTab === 'staff' && t('staff')}
            {activeTab === 'settings' && t('settings')}
            {activeTab === 'customers' && t('customers')}
            {activeTab === 'history' && t('history')}
            {activeTab === 'fiche' && t('fiche')}
            {activeTab === 'simulator' && t('simulator')}
        </h2>
        <div className="luxury-accent-bar mb-6" />
        <div className="flex flex-wrap items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-white/5 text-cream/45' : 'bg-white text-slate-500 border border-slate-200'}`}>
            {user?.role === 'owner' ? 'Head Baker' : user?.role || 'Staff'}
          </span>
          <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${isDarkMode ? 'bg-gold/10 text-gold' : 'bg-slate-900 text-white'}`}>
            {user?.username || 'Operator'}
          </span>
          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${isOnline ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
            {isOnline ? 'Connected' : 'Offline'}
          </span>
          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-white/5 text-cream/45' : 'bg-white text-slate-500 border border-slate-200'}`}>
            {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}
          </span>
        </div>
      </div>
      <div className="flex gap-4">
        <div className={`px-4 py-2 flex items-center gap-3 rounded-2xl ${isDarkMode ? 'glass-panel' : 'border border-slate-200 bg-white shadow-sm'}`}>
          <div className="text-right">
            <p className={`text-[10px] uppercase tracking-widest font-black ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>{isOnline ? t('online') : t('offline')}</p>
            <p className={`text-xs font-bold ${isOnline ? 'text-emerald-500' : 'text-rose-500'}`}>
              {isOnline ? t('sync_active') : t('offline_mode')}
            </p>
          </div>
          <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.8)]' : 'bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.8)] animate-pulse'}`} />
        </div>

        {/* Theme Toggle */}
        <button 
          onClick={() => {
            const newTheme = !isDarkMode;
            setIsDarkMode(newTheme);
            localStorage.setItem('bakery_theme', newTheme ? 'dark' : 'light');
          }} 
          className={`p-3 rounded-2xl border transition-all flex items-center justify-center ${isDarkMode ? 'glass-panel hover:bg-white/5 border-gold/10 text-gold' : 'border-slate-200 bg-white shadow-sm text-slate-600 hover:bg-slate-50'}`}
          title={t('toggle_theme')}
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        {/* Notifications Bell */}
        <div className="relative">
          <button 
            onClick={() => setShowAlertsPopover(!showAlertsPopover)}
            className={`p-3 rounded-2xl border transition-all relative ${isDarkMode ? 'glass-panel hover:bg-white/5 border-gold/10 text-gold' : 'border-slate-200 bg-white shadow-sm text-slate-600 hover:bg-slate-50'}`}
          >
            <Bell size={20} />
            {alerts.length > 0 && (
              <span className="absolute top-2 right-2 w-4 h-4 bg-rose-500 text-white text-[8px] font-black flex items-center justify-center rounded-full border-2 border-[#0a0a0b] animate-pulse">
                {alerts.length}
              </span>
            )}
          </button>

          <AnimatePresence>
            {showAlertsPopover && (
              <motion.div 
                ref={notificationRef}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className={`absolute right-0 mt-4 w-80 rounded-3xl border shadow-2xl z-[150] overflow-hidden ${isDarkMode ? 'bg-[#0a0a0b] border-white/10' : 'bg-white border-slate-200'}`}
              >
                <div className={`p-6 border-b ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                  <h4 className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-gold' : 'text-slate-900'}`}>{t('live_alerts')}</h4>
                </div>
                <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                  {alerts.length === 0 ? (
                    <div className="p-10 text-center">
                      <CheckCircle className="mx-auto mb-4 opacity-20" size={32} />
                      <p className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-cream/30' : 'text-slate-400'}`}>{t('system_clear')}</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {alerts.map(alert => (
                        <div key={alert.id} className="p-5 hover:bg-white/5 transition-colors group">
                          <div className="flex gap-4">
                            <div className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${alert.severity === 'high' ? 'bg-rose-500/10 text-rose-500' : 'bg-gold/10 text-gold'}`}>
                              <AlertTriangle size={16} />
                            </div>
                            <div>
                              <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${alert.severity === 'high' ? 'text-rose-400' : 'text-gold/60'}`}>{alert.type}</p>
                              <p className={`text-xs font-bold leading-relaxed ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>{alert.message}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {user?.role === 'owner' && (
          <div className={`px-4 py-2 flex items-start gap-4 rounded-2xl ${isDarkMode ? 'glass-panel shadow-gold-glow border-gold/20' : 'border border-slate-200 bg-white shadow-sm'}`}>
            <div className="text-right">
              <p className={`text-[10px] uppercase tracking-widest font-black ${isDarkMode ? 'text-gold' : 'text-slate-500'}`}>{t('master_control')}</p>
              {editMode && (
                <p className={`text-xs font-bold ${isDarkMode ? 'text-gold' : 'text-slate-500'}`}>
                  {t('active')}
                </p>
              )}
            </div>
            <div className="neo-toggle-container shrink-0">
              <input
                className="neo-toggle-input"
                id="master-control-toggle"
                type="checkbox"
                checked={editMode}
                onChange={(e) => setEditMode(e.target.checked)}
              />
              <label className={`neo-toggle ${editMode ? 'neo-activated neo-progress' : ''}`} htmlFor="master-control-toggle">
                <div className="neo-track">
                  <div className="neo-background-layer"></div>
                  <div className="neo-grid-layer"></div>
                  <div className="neo-spectrum-analyzer">
                    <div className="neo-spectrum-bar"></div>
                    <div className="neo-spectrum-bar"></div>
                    <div className="neo-spectrum-bar"></div>
                    <div className="neo-spectrum-bar"></div>
                    <div className="neo-spectrum-bar"></div>
                    <div className="neo-spectrum-bar"></div>
                  </div>
                  <div className="neo-track-highlight"></div>
                </div>

                <div className="neo-thumb">
                  <div className="neo-thumb-ring"></div>
                  <div className="neo-thumb-core">
                    <div className="neo-thumb-icon">
                      <div className="neo-thumb-wave"></div>
                      <div className="neo-thumb-pulse"></div>
                    </div>
                  </div>
                </div>

                <div className="neo-gesture-area"></div>

                <div className="neo-interaction-feedback">
                  <div className="neo-ripple"></div>
                  <div className="neo-progress-arc"></div>
                </div>

                <div className="neo-status">
                  <div className="neo-status-indicator">
                    <div className="neo-status-dot"></div>
                    <div className="neo-status-text"></div>
                  </div>
                </div>
              </label>
            </div>
          </div>
        )}

        <div className={`px-3 py-1.5 flex items-center gap-3 border rounded-xl ${isDarkMode ? 'border-gold/10 bg-black/20' : 'border-slate-200 bg-white shadow-sm'}`}>
          <div className="text-right">
            <p className={`text-[10px] uppercase tracking-widest font-black ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>{t('profit')}</p>
            <p className={`text-xl font-bold ${isDarkMode ? 'text-gold' : 'text-slate-900'}`}>{formatPrice(analytics.today_revenue - analytics.today_cost)}</p>
          </div>
          <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-gold/10 text-gold' : 'bg-slate-100 text-slate-900'}`}><TrendingUp size={20} /></div>
        </div>
      </div>
    </header>
  );
};
