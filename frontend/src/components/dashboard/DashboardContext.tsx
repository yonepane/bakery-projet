/**
 * DashboardContext — Composition root for all dashboard contexts.
 * Provides a single `useDashboard` hook that re-exports everything from sub-contexts.
 * Panels continue to import `useDashboard` — zero code change in consumers.
 */

import React, { useMemo, useContext } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { UIProvider, useUI } from './UIContext';
import { ServerDataProvider, useServerData } from './ServerDataContext';
import { TabFetcherProvider, useTabFetcher } from './TabFetcherContext';
import { NotificationProvider, useNotification } from './NotificationContext';
import { ModalProvider, useModal } from './ModalContext';
import { MutationProvider, useMutation } from './MutationContext';
import { CartProvider, useCart } from './CartContext';
import { type UserSession } from './types';

// ── Sub-context hooks (aliased to avoid name conflicts) ──────────────────────

const useAuthCtx = useAuth;
const useUICtx = useUI;
const useServerDataCtx = useServerData;
const useTabFetcherCtx = useTabFetcher;
const useNotifCtx = useNotification;
const useModalCtx = useModal;
const useMutCtx = useMutation;
const useCartCtx = useCart;

// ── Aggregated hook ──────────────────────────────────────────────────────────

export const useDashboard = () => {
  const auth = useAuth();
  const ui = useUI();
  const data = useServerData();
  const notif = useNotification();
  const modal = useModal();
  const mut = useMutation();
  const cart = useCart();

  // Merge all contexts into the old DashboardContextValue shape
  return useMemo(
    () => ({
      ...auth,
      ...ui,
      ...data,
      ...notif,
      ...modal,
      ...mut,
      ...cart,
    }),
    [auth, ui, data, notif, modal, mut, cart]
  );
};

// ── Internal: Connect ServerData -> TabFetcher -> Mutation ───────────────────

interface ServerDataBridgeProps {
  user: UserSession | null;
  activeTab: string;
  children: React.ReactNode;
}

// This component sits inside ServerDataProvider and consumes its context
// to pass setters to TabFetcherProvider
const ServerDataBridge: React.FC<ServerDataBridgeProps> = ({
  user,
  activeTab,
  children
}) => {
  const serverData = useServerData();

  return (
    <TabFetcherProvider
      user={user}
      activeTab={activeTab}
      // Server data context setters
      setInventory={serverData.setInventory}
      setAnalytics={serverData.setAnalytics}
      setProfitReport={serverData.setProfitReport}
      setAlerts={serverData.setAlerts}
      setHistory={serverData.setHistory}
      setStockMovements={serverData.setStockMovements}
      setStockLocations={serverData.setStockLocations}
      setStockLotBalances={serverData.setStockLotBalances}
      setSemiFinishedItems={serverData.setSemiFinishedItems}
      setKitchenBatches={serverData.setKitchenBatches}
      setPlanner={serverData.setPlanner}
      setOrders={serverData.setOrders}
      setSettings={serverData.setSettings}
      setLiveRates={serverData.setLiveRates}
      setCustomers={serverData.setCustomers}
      setExpenses={serverData.setExpenses}
      setWasteRecords={serverData.setWasteRecords}
      setStaff={serverData.setStaff}
      setSuppliers={serverData.setSuppliers}
      setSelectedSupplierId={serverData.setSelectedSupplierId}
      setPurchaseOrders={serverData.setPurchaseOrders}
      setPurchasingSuggestions={serverData.setPurchasingSuggestions}
      setShiftLogs={serverData.setShiftLogs}
      setLoading={serverData.setLoading}
    >
      {children}
    </TabFetcherProvider>
  );
};

// This component sits inside TabFetcherProvider and consumes its context
// to provide fetchTabData to MutationProvider
interface MutationBridgeProps {
  children: React.ReactNode;
}

const MutationBridge: React.FC<MutationBridgeProps> = ({ children }) => {
  return (
    <MutationProvider>
      {children}
    </MutationProvider>
  );
};

// ── Provider Composition (used by Dashboard.tsx) ────────────────────────

interface DashboardProvidersProps {
  user: UserSession | null;
  setUser: (u: UserSession | null) => void;
  activeTab: string;
  children: React.ReactNode;
}

export const DashboardProviders: React.FC<DashboardProvidersProps> = ({
  user, setUser, activeTab, children
}) => (
  <AuthProvider>
    <UIProvider liveRates={{ MAD: 1.0, EUR: 0.0916, USD: 0.0998, GBP: 0.0787 }} initialActiveTab={activeTab}>
      <ServerDataProvider user={user} activeTab={activeTab}>
        <ServerDataBridge user={user} activeTab={activeTab}>
          <CartProvider>
            <NotificationProvider>
              <ModalProvider>
                <MutationBridge>
                  {children}
                </MutationBridge>
              </ModalProvider>
            </NotificationProvider>
          </CartProvider>
        </ServerDataBridge>
      </ServerDataProvider>
    </UIProvider>
  </AuthProvider>
);

// ── Selector hooks (for panels that need granular subscriptions) ────────────

// Use distinct names to avoid infinite recursion
export const useAuthSelector = () => useAuth();
export const useUISelector = () => useUI();
export const useServerDataSelector = () => useServerData();
export const useTabFetcherSelector = () => useTabFetcher();
export const useNotificationSelector = () => useNotification();
export const useModalSelector = () => useModal();
export const useMutationSelector = () => useMutation();

// ── Export types ────────────────────────────────────────────────────────────

export { type UserSession } from './types';