/**
 * TabFetcherContext — Tab-aware data fetching logic.
 * Isolates tab-switching logic from raw data cache.
 */
import React, { createContext, useContext, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { UserSession } from './types';

interface TabFetcherContextValue {
  fetchTabData: (tab: string) => Promise<void>;
  fetchData: () => Promise<void>;
  fetchLiveRates: () => Promise<void>;
  applyInventory: (invData: any) => void;
  applySettings: (settData: any) => void;
}

const TabFetcherContext = createContext<TabFetcherContextValue | null>(null);

export const useTabFetcher = (): TabFetcherContextValue => {
  const ctx = useContext(TabFetcherContext);
  if (!ctx) throw new Error('useTabFetcher must be used inside <TabFetcherProvider>');
  return ctx;
};

interface TabFetcherProviderProps {
  user: UserSession | null;
  activeTab: string;
  // Server data context setters
  setInventory: React.Dispatch<React.SetStateAction<any>>;
  setAnalytics: React.Dispatch<React.SetStateAction<any>>;
  setProfitReport: React.Dispatch<React.SetStateAction<any[]>>;
  setAlerts: React.Dispatch<React.SetStateAction<any[]>>;
  setHistory: React.Dispatch<React.SetStateAction<any[]>>;
  setStockMovements: React.Dispatch<React.SetStateAction<any[]>>;
  setStockLocations: React.Dispatch<React.SetStateAction<any[]>>;
  setStockLotBalances: React.Dispatch<React.SetStateAction<any[]>>;
  setSemiFinishedItems: React.Dispatch<React.SetStateAction<any[]>>;
  setKitchenBatches: React.Dispatch<React.SetStateAction<any[]>>;
  setPlanner: React.Dispatch<React.SetStateAction<any[]>>;
  setOrders: React.Dispatch<React.SetStateAction<any[]>>;
  setSettings: React.Dispatch<React.SetStateAction<any>>;
  setLiveRates: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setCustomers: React.Dispatch<React.SetStateAction<any[]>>;
  setExpenses: React.Dispatch<React.SetStateAction<any[]>>;
  setWasteRecords: React.Dispatch<React.SetStateAction<any[]>>;
  setStaff: React.Dispatch<React.SetStateAction<any[]>>;
  setSuppliers: React.Dispatch<React.SetStateAction<any[]>>;
  setSelectedSupplierId: React.Dispatch<React.SetStateAction<number | null>>;
  setPurchaseOrders: React.Dispatch<React.SetStateAction<any[]>>;
  setPurchasingSuggestions: React.Dispatch<React.SetStateAction<any[]>>;
  setShiftLogs: React.Dispatch<React.SetStateAction<any[]>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  children: React.ReactNode;
}

export const TabFetcherProvider: React.FC<TabFetcherProviderProps> = ({
  user,
  activeTab,
  // Server data context setters
  setInventory,
  setAnalytics,
  setProfitReport,
  setAlerts,
  setHistory,
  setStockMovements,
  setStockLocations,
  setStockLotBalances,
  setSemiFinishedItems,
  setKitchenBatches,
  setPlanner,
  setOrders,
  setSettings,
  setLiveRates,
  setCustomers,
  setExpenses,
  setWasteRecords,
  setStaff,
  setSuppliers,
  setSelectedSupplierId,
  setPurchaseOrders,
  setPurchasingSuggestions,
  setShiftLogs,
  setLoading,
  children
}) => {
  const queryClient = useQueryClient();

  const safeGet = useCallback(async (url: string, fallback: any = null) => {
    try { return await api.get(url); }
    catch (e) { console.warn(`Failed to fetch ${url}:`, e); return fallback; }
  }, []);

  const applyInventory = useCallback((invData: any) => {
    if (!invData) return;
    if (invData.products) {
      invData.products.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
    }
    setInventory(invData);
  }, [setInventory]);

  const applySettings = useCallback((settData: any) => {
    if (!settData) return;
    setSettings(settData);
  }, [setSettings]);

  const fetchLiveRates = useCallback(async () => {
    try {
      const data = await api.get('/currency/rates');
      if (data?.rates && typeof data.rates === 'object') {
        setLiveRates(data.rates);
      }
    } catch { console.warn('Could not fetch live exchange rates — using fallback rates.'); }
  }, [setLiveRates]);

  const fetchTabData = useCallback(async (tab: string) => {
    if (!user) return;
    const isOwner = user.role === 'owner' || user.role === 'chef_executif';

    try {
      switch (tab) {
        case 'dashboard': {
          const [invData, anaData, settData, logData] = await Promise.all([
            safeGet('/inventory'),
            safeGet('/analytics'),
            safeGet('/settings'),
            safeGet('/shift-logs', []),
          ]);
          applyInventory(invData);
          if (anaData) setAnalytics(anaData);
          applySettings(settData);
          if (logData) setShiftLogs(logData);
          break;
        }
        case 'pos': {
          const [invData, ordData, custData, settData] = await Promise.all([
            safeGet('/inventory'),
            safeGet('/orders', []),
            safeGet('/customers', []),
            safeGet('/settings'),
          ]);
          applyInventory(invData);
          if (ordData) setOrders(ordData);
          if (custData) setCustomers(custData);
          applySettings(settData);
          break;
        }
        case 'inventory': {
          const [invData, locRes, balRes, sfRes] = await Promise.all([
            safeGet('/inventory'),
            safeGet('/stock-locations', []),
            safeGet('/stock-lot-balances', []),
            safeGet('/semi-finished', []),
          ]);
          applyInventory(invData);
          setStockLocations(locRes);
          setStockLotBalances(balRes);
          setSemiFinishedItems(sfRes ?? []);
          break;
        }
        case 'history': {
          const histData = await safeGet('/history', []);
          if (histData) setHistory(histData);
          break;
        }
        case 'stock_movements': {
          const [movementData, locRes, balRes] = await Promise.all([
            safeGet('/stock-movements', []),
            safeGet('/stock-locations', []),
            safeGet('/stock-lot-balances', []),
          ]);
          if (movementData) setStockMovements(movementData);
          setStockLocations(locRes);
          setStockLotBalances(balRes);
          break;
        }
        case 'intelligence': {
          const [invData, anaData] = await Promise.all([
            safeGet('/inventory'),
            safeGet('/analytics'),
          ]);
          applyInventory(invData);
          if (anaData) setAnalytics(anaData);
          break;
        }
        case 'comptabilite':
        case 'expenses':
        case 'finance': {
          const [histData, expData, wasteData, ordData, suppData] = await Promise.all([
            safeGet('/history', []),
            safeGet('/expenses', []),
            safeGet('/waste', []),
            safeGet('/orders', []),
            safeGet('/suppliers', []),
          ]);
          if (histData) setHistory(histData);
          if (expData) setExpenses(expData);
          if (wasteData) setWasteRecords(wasteData);
          if (ordData) setOrders(ordData);
          if (suppData) setSuppliers(suppData);
          break;
        }
        case 'purchasing': {
          const [purData, suppData, posData, invData] = await Promise.all([
            safeGet('/purchasing/suggest', []),
            safeGet('/suppliers', []),
            safeGet('/purchase-orders', []),
            safeGet('/inventory'),
          ]);
          if (purData) setPurchasingSuggestions(purData);
          if (suppData) {
            setSuppliers(suppData);
            setSelectedSupplierId(prev => {
              if (!suppData.length) return null;
              if (prev && suppData.some((s: any) => s.id === prev)) return prev;
              return suppData[0].id;
            });
          }
          if (posData) {
            const sorted = [...posData].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setPurchaseOrders(sorted);
          }
          applyInventory(invData);
          break;
        }
        case 'planner': {
          const [planData, invData] = await Promise.all([
            safeGet('/planner', []),
            safeGet('/inventory'),
          ]);
          if (planData) setPlanner(planData);
          applyInventory(invData);
          break;
        }
        case 'staff': {
          const [staffData, logData] = await Promise.all([
            safeGet('/staff', []),
            safeGet('/shift-logs', []),
          ]);
          if (staffData) setStaff(staffData);
          if (logData) setShiftLogs(logData);
          break;
        }
        case 'kitchen': {
          const [invData, planData, batches] = await Promise.all([
            safeGet('/inventory'),
            safeGet('/planner', []),
            safeGet('/kitchen/batches', []),
          ]);
          applyInventory(invData);
          if (planData) setPlanner(planData);
          setKitchenBatches(batches || []);
          break;
        }
        case 'kitchen_board': {
          const batches = await safeGet('/kitchen/batches', []);
          setKitchenBatches(batches || []);
          break;
        }
        case 'orders': {
          const [ordData, custData] = await Promise.all([
            safeGet('/orders', []),
            safeGet('/customers', []),
          ]);
          if (ordData) setOrders(ordData);
          if (custData) setCustomers(custData);
          break;
        }
        case 'customers': {
          const custData = await safeGet('/customers', []);
          if (custData) setCustomers(custData);
          break;
        }
        case 'settings': {
          const settData = await safeGet('/settings');
          applySettings(settData);
          break;
        }
        default: {
          const [invData, settData] = await Promise.all([
            safeGet('/inventory'),
            safeGet('/settings'),
          ]);
          applyInventory(invData);
          applySettings(settData);
        }
      }
    } catch (error) {
      console.error(`Error loading tab "${tab}":`, error);
    } finally {
      setLoading(false);
    }
  }, [user, safeGet, applyInventory, applySettings,
    setAnalytics, setAlerts, setHistory,
    setStockMovements,
    setStockLocations,
    setStockLotBalances,
    setSemiFinishedItems,
    setKitchenBatches,
    setPlanner,
    setOrders,
    setSettings,
    setLiveRates,
    setCustomers,
    setExpenses,
    setWasteRecords,
    setStaff,
    setSuppliers,
    setSelectedSupplierId,
    setPurchaseOrders,
    setPurchasingSuggestions,
    setShiftLogs,
    setLoading]);

  const fetchData = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['inventory'] });
    await queryClient.invalidateQueries({ queryKey: ['settings'] });
    return fetchTabData(activeTab);
  }, [fetchTabData, activeTab, queryClient]);

  return (
    <TabFetcherContext.Provider value={{
      fetchTabData,
      fetchData,
      fetchLiveRates,
      applyInventory,
      applySettings,
    }}>
      {children}
    </TabFetcherContext.Provider>
  );
};