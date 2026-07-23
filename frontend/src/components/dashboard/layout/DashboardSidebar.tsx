import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { 
  Box, LayoutDashboard, Brain, ShoppingCart, ChefHat, 
  ClipboardList, Package, FileText, Truck, Calculator, 
  History as HistoryIcon, Settings, Coins, Calendar, 
  Activity, Users, ChevronRight, ChevronLeft, ChevronDown, 
  AlertTriangle, LogOut 
} from 'lucide-react';
import { useDashboard } from '../DashboardContext';

interface DashboardSidebarProps {
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (v: boolean) => void;
  sidebarHoverMode: boolean;
  isSidebarHovered: boolean;
  setIsSidebarHovered: (v: boolean) => void;
  isOperationsOpen: boolean;
  setIsOperationsOpen: (v: boolean) => void;
}

export const DashboardSidebar: React.FC<DashboardSidebarProps> = ({
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  sidebarHoverMode,
  isSidebarHovered,
  setIsSidebarHovered,
  isOperationsOpen,
  setIsOperationsOpen,
}) => {
  const { t } = useTranslation();
  const {
    isDarkMode,
    activeTab,
    setActiveTab,
    user,
    setUser,
    setShowWasteModal
  } = useDashboard();

  const shouldShowSidebarText = sidebarHoverMode ? isSidebarHovered : !isSidebarCollapsed;

  return (
    <motion.aside 
      initial={false}
      animate={{ 
        width: sidebarHoverMode ? (isSidebarHovered ? 288 : 80) : (isSidebarCollapsed ? 80 : 288),
        opacity: sidebarHoverMode ? (isSidebarHovered ? 1 : 0.3) : 1
      }}
      onMouseEnter={() => sidebarHoverMode && setIsSidebarHovered(true)}
      onMouseLeave={() => sidebarHoverMode && setIsSidebarHovered(false)}
      className={`fixed h-[calc(100vh-2rem)] top-4 left-4 z-50 flex flex-col overflow-y-auto overflow-x-hidden rounded-3xl transition-all duration-500 ${
        (sidebarHoverMode ? isSidebarHovered : !isSidebarCollapsed) ? 'custom-scrollbar' : 'no-scrollbar'
      } ${
        sidebarHoverMode
          ? (isSidebarHovered
              ? (isDarkMode ? 'glass-sidebar' : 'bg-white/80 backdrop-blur-2xl border border-slate-200 shadow-xl')
              : 'bg-transparent border-transparent shadow-none backdrop-blur-none')
          : (isDarkMode ? 'glass-sidebar' : 'bg-white/80 backdrop-blur-2xl border border-slate-200 shadow-xl')
      }`}
    >
      <div className="p-6">
        <div className="flex items-center gap-3 mb-10">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shrink-0 ${isDarkMode ? 'bg-gold shadow-gold-glow' : 'bg-slate-900 shadow-slate-200'}`}>
            <Box className={`${isDarkMode ? 'text-charcoal' : 'text-white'} w-6 h-6`} />
          </div>
          {!(sidebarHoverMode ? !isSidebarHovered : isSidebarCollapsed) && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h1 className="brand-title" style={{ ['--brand-hover' as any]: '#d4af37' }}>
                  <span className={`brand-title__base text-2xl font-bold luxury-font tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {t('bakery')}<span className="text-gold">Os</span>
                  </span>
                  <span aria-hidden="true" className="brand-title__hover text-2xl font-bold luxury-font tracking-tight">
                    {t('bakery')}<span>Os</span>
                  </span>
                </h1>
                <span className="inline-flex mt-3 text-[10px] bg-gold/10 text-gold px-2 py-0.5 rounded-full font-black">{t('beta_0_1')}</span>
            </motion.div>
          )}
        </div>

        <nav className="space-y-1">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: t('dashboard') },
            { id: 'intelligence', icon: Brain, label: 'Intelligence' },
            { id: 'pos', icon: ShoppingCart, label: t('pos') },
            { id: 'kitchen', icon: ChefHat, label: t('kitchen') },
            { id: 'kitchen_board', icon: ClipboardList, label: 'Kitchen Board' },
            { id: 'inventory', icon: Package, label: t('inventory') },
            { id: 'fiche', icon: FileText, label: t('fiche') },
            { id: 'purchasing', icon: Truck, label: t('purchasing') },
            { id: 'simulator', icon: Calculator, label: t('simulator') },
            { id: 'history', icon: HistoryIcon, label: t('history') },
            ].filter(item => {
            if (user?.role === 'cashier' && ['simulator', 'inventory', 'purchasing', 'intelligence'].includes(item.id)) return false;
            return true;
            })
          .map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300 ${
                activeTab === item.id 
                  ? (isDarkMode ? 'bg-gold/10 text-gold border border-gold/20 shadow-gold-glow' : 'bg-slate-100 text-slate-900 border border-slate-200 shadow-sm') 
                  : (isDarkMode ? 'text-cream/40 hover:bg-white/5 hover:text-cream' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700')
              }`}
              title={(sidebarHoverMode ? !isSidebarHovered : isSidebarCollapsed) ? item.label : ''}
            >
              <item.icon size={20} className="shrink-0" />
              {!(sidebarHoverMode ? !isSidebarHovered : isSidebarCollapsed) && <span className="font-semibold text-sm whitespace-nowrap">{item.label}</span>}
            </button>
          ))}

          {/* Operations Dropdown */}
          <div className="pt-4">
              <button 
                  onClick={() => setIsOperationsOpen(!isOperationsOpen)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${isDarkMode ? 'text-gold/60 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                  <div className="flex items-center gap-4">
                      <Settings size={20} />
                      {shouldShowSidebarText && <span className="font-bold text-[10px] uppercase tracking-[0.2em]">{t('operations')}</span>}
                  </div>
                  {shouldShowSidebarText && (
                      <motion.div animate={{ rotate: isOperationsOpen ? 180 : 0 }}>
                          <ChevronDown size={14} />
                      </motion.div>
                  )}
              </button>
              
              <AnimatePresence>
                  {isOperationsOpen && shouldShowSidebarText && (
                      <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden space-y-1 mt-1 pl-4"
                      >
                          {[
                              { id: 'comptabilite', icon: Coins, label: t('comptabilite') },
                              { id: 'planner', icon: Calendar, label: t('planner') },
                            { id: 'orders', icon: FileText, label: t('orders') },
                              { id: 'stock_movements', icon: Activity, label: 'Stock Ledger' },
                              { id: 'customers', icon: Users, label: t('customers') },
                              { id: 'staff', icon: Users, label: t('staff') },
                              { id: 'settings', icon: Settings, label: t('settings') },
                          ].filter(sub => {
                              if ((sub.id === 'staff' || sub.id === 'stock_movements') && user?.role !== 'owner') return false;
                              return true;
                          }).map(sub => (
                            <button
                                key={sub.id}
                                onClick={() => setActiveTab(sub.id)}
                                className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-all ${
                                    activeTab === sub.id 
                                        ? (isDarkMode ? 'text-gold border-l-2 border-gold bg-gold/5' : 'text-slate-900 border-l-2 border-slate-900 bg-slate-50') 
                                        : (isDarkMode ? 'text-cream/30 hover:text-cream' : 'text-slate-400 hover:text-slate-700')
                                }`}
                            >
                                <sub.icon size={16} />
                                <span className="font-bold text-[11px] uppercase tracking-widest">{sub.label}</span>
                            </button>
                        ))}
                      </motion.div>
                  )}
              </AnimatePresence>
          </div>
        </nav>
      </div>

      <div className="mt-auto p-6 space-y-4">
        {!sidebarHoverMode && (
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className={`w-full py-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${isDarkMode ? 'border-white/5 bg-white/5 text-gold hover:bg-white/10' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
        >
          {isSidebarCollapsed ? <ChevronRight size={16}/> : <ChevronLeft size={16}/>}
          {!isSidebarCollapsed && <span className="text-[10px] font-black uppercase tracking-widest">{t('collapse_view')}</span>}
        </button>
        )}

        {/* Action & Logout Controls */}
        <div className={`mt-4 pt-4 border-t ${isDarkMode ? 'border-white/5' : 'border-slate-100'} space-y-2`}>
          <button 
            onClick={() => setShowWasteModal(true)} 
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs uppercase tracking-widest border border-rose-500/20 text-rose-500 hover:bg-rose-500/10 transition-all ${isSidebarCollapsed ? 'px-0' : ''}`}
            title={t('log_daily_waste')}
          >
            {(sidebarHoverMode ? !isSidebarHovered : isSidebarCollapsed) ? <AlertTriangle size={16}/> : 'Log Daily Waste'}
          </button>
          <button 
              onClick={() => { 
                localStorage.removeItem('bakery_token'); 
                localStorage.removeItem('bakery_user');
                localStorage.removeItem('bakery_refresh_token');
                setUser(null); 
              }} 
              className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-xs uppercase tracking-widest bg-rose-600 hover:bg-rose-700 text-white shadow-lg transition-all ${isSidebarCollapsed ? 'px-0' : ''}`}
              title={t('logout')}
          >
              <LogOut size={16}/>
              {!(sidebarHoverMode ? !isSidebarHovered : isSidebarCollapsed) && t('logout')}
          </button>
        </div>

      </div>
    </motion.aside>
  );
};
