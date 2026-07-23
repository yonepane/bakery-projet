import React, { Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDashboard } from '../DashboardContext';

// Panels (lazy loaded)
const DashboardPanel = React.lazy(() => import('../panels/DashboardPanel'));
const POSPanel = React.lazy(() => import('../panels/POSPanel'));
const InventoryPanel = React.lazy(() => import('../panels/InventoryPanel'));
const FichePanel = React.lazy(() => import('../panels/FichePanel'));
const AnalyticsPanel = React.lazy(() => import('../panels/AnalyticsPanel'));
const HistoryPanel = React.lazy(() => import('../panels/HistoryPanel'));
const StockMovementsPanel = React.lazy(() => import('../panels/StockMovementsPanel'));
const PlannerPanel = React.lazy(() => import('../panels/PlannerPanel'));
const ExpensesPanel = React.lazy(() => import('../panels/ExpensesPanel'));
const FinancePanel = React.lazy(() => import('../panels/FinancePanel'));
const OrdersPanel = React.lazy(() => import('../panels/OrdersPanel'));
const PurchasingPanel = React.lazy(() => import('../panels/PurchasingPanel'));
const SettingsPanel = React.lazy(() => import('../panels/SettingsPanel'));
const StaffPanel = React.lazy(() => import('../panels/StaffPanel'));
const IntelligencePanel = React.lazy(() => import('../panels/IntelligencePanel'));
const KitchenPanel = React.lazy(() => import('../panels/KitchenPanel'));
const KitchenBoardPanel = React.lazy(() => import('../panels/KitchenBoardPanel'));
const CustomersPanel = React.lazy(() => import('../panels/CustomersPanel'));
const ForecastPanel = React.lazy(() => import('../panels/ForecastPanel'));

export const DashboardRouter: React.FC = () => {
  const { activeTab } = useDashboard();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
      >
        <Suspense fallback={
          <div className="h-40 flex flex-col items-center justify-center gap-4 text-gold">
            <div className="pinwheel pinwheel--sm" aria-hidden="true">
              <div className="pinwheel__line"></div>
              <div className="pinwheel__line"></div>
              <div className="pinwheel__line"></div>
              <div className="pinwheel__line"></div>
              <div className="pinwheel__line"></div>
              <div className="pinwheel__line"></div>
            </div>
            <div className="text-[11px] font-black uppercase tracking-widest opacity-60">Engaging {activeTab}...</div>
          </div>
        }>
          {activeTab === 'dashboard' && <DashboardPanel />}
          {activeTab === 'pos' && <POSPanel />}
          {activeTab === 'inventory' && <InventoryPanel />}
          {activeTab === 'kitchen_board' && <KitchenBoardPanel />}
          {activeTab === 'fiche' && <FichePanel />}
          {activeTab === 'simulator' && <AnalyticsPanel />}
          {activeTab === 'history' && <HistoryPanel />}
          {activeTab === 'stock_movements' && <StockMovementsPanel />}
          {activeTab === 'kitchen' && <KitchenPanel />}
          {activeTab === 'intelligence' && <IntelligencePanel />}
          {activeTab === 'forecast' && <ForecastPanel />}
          {activeTab === 'planner' && <PlannerPanel />}
          {activeTab === 'orders' && <OrdersPanel />}
          {activeTab === 'purchasing' && <PurchasingPanel />}
          {activeTab === 'comptabilite' && <FinancePanel />}
          {activeTab === 'expenses' && <ExpensesPanel />}
          {activeTab === 'staff' && <StaffPanel />}
          {activeTab === 'settings' && <SettingsPanel />}
          {activeTab === 'customers' && <CustomersPanel />}
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
};
