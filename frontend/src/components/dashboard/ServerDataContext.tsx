/**
 * ServerDataContext — Raw server data cache + React Query integration.
 * Updates only when React Query cache invalidates or explicit fetch.
 * Pure data container — no derived/computed values.
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, processSyncQueue } from '../../lib/api';
import type {
  DashboardAlert, Ingredient, PlanItem, Product, SemiFinishedItem,
  StockLocation, StockLotBalance, StockMovement, Transaction, UserSession, Customer,
} from './types';
import type { KitchenBatch } from './hooks/useKitchenMutations';
import type { PurchaseOrder, Supplier, Expense, WasteRecord } from './types';

type AnyRecord = Record<string, any>;

interface ServerDataContextValue {
  inventory: any;
  analytics: any;
  profitReport: any[];
  alerts: any[];
  history: Transaction[];
  stockMovements: any[];
  stockLocations: any[];
  stockLotBalances: any[];
  semiFinishedItems: any[];
  kitchenBatches: any[];
  planner: PlanItem[];
  orders: any[];
  settings: AnyRecord;
  liveRates: Record<string, number>;
  customers: Customer[];
  expenses: Expense[];
  wasteRecords: WasteRecord[];
  staff: any[];
  suppliers: Supplier[];
  selectedSupplierId: number | null;
  purchaseOrders: any[];
  purchasingSuggestions: any[];
  shiftLogs: any[];
  loading: boolean;
  fetchError: Error | null;

  setInventory: React.Dispatch<React.SetStateAction<any>>;
  setAnalytics: React.Dispatch<React.SetStateAction<any>>;
  setProfitReport: React.Dispatch<React.SetStateAction<any[]>>;
  setAlerts: React.Dispatch<React.SetStateAction<any[]>>;
  setHistory: React.Dispatch<React.SetStateAction<Transaction[]>>;
  setStockMovements: React.Dispatch<React.SetStateAction<any[]>>;
  setStockLocations: React.Dispatch<React.SetStateAction<any[]>>;
  setStockLotBalances: React.Dispatch<React.SetStateAction<any[]>>;
  setSemiFinishedItems: React.Dispatch<React.SetStateAction<any[]>>;
  setKitchenBatches: React.Dispatch<React.SetStateAction<any[]>>;
  setPlanner: React.Dispatch<React.SetStateAction<PlanItem[]>>;
  setOrders: React.Dispatch<React.SetStateAction<any[]>>;
  setSettings: React.Dispatch<React.SetStateAction<AnyRecord>>;
  setLiveRates: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
  setWasteRecords: React.Dispatch<React.SetStateAction<WasteRecord[]>>;
  setStaff: React.Dispatch<React.SetStateAction<any[]>>;
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
  setSelectedSupplierId: React.Dispatch<React.SetStateAction<number | null>>;
  setPurchaseOrders: React.Dispatch<React.SetStateAction<any[]>>;
  setPurchasingSuggestions: React.Dispatch<React.SetStateAction<any[]>>;
  setShiftLogs: React.Dispatch<React.SetStateAction<any[]>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;

  refetchInventory: () => void;
  refetchSettings: () => void;

  fetchData: () => Promise<void>;
  fetchTabData: (tab: string) => Promise<void>;
  fetchLiveRates: () => Promise<void>;
  applyInventory: (invData: any) => void;
  applySettings: (settData: any) => void;
}

const ServerDataContext = createContext<ServerDataContextValue | null>(null);

export const useServerData = (): ServerDataContextValue => {
  const ctx = useContext(ServerDataContext);
  if (!ctx) throw new Error('useServerData must be used inside <ServerDataProvider>');
  return ctx;
};

interface ServerDataProviderProps {
  user: any;
  activeTab: string;
  onDataChange?: () => void;
  children: React.ReactNode;
}

export const ServerDataProvider: React.FC<ServerDataProviderProps> = ({
  user, activeTab, onDataChange, children
}) => {
  const queryClient = useQueryClient();

  const {
    data: inventoryData,
    error: inventoryError,
    refetch: refetchInventory,
  } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => api.get('/inventory'),
    enabled: !!user,
    staleTime: 30_000,
  });

  const {
    data: settingsData,
    error: settingsError,
    refetch: refetchSettings,
  } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings'),
    enabled: !!user,
    staleTime: 120_000,
  });

  const [inventory, setInventory] = useState<any>({ materials: {}, products: [] });
  const [history, setHistory] = useState<any[]>([]);
  const [stockMovements, setStockMovements] = useState<any[]>([]);
  const [stockLocations, setStockLocations] = useState<any[]>([]);
  const [stockLotBalances, setStockLotBalances] = useState<any[]>([]);
  const [semiFinishedItems, setSemiFinishedItems] = useState<any[]>([]);
  const [kitchenBatches, setKitchenBatches] = useState<any[]>([]);
  const [planner, setPlanner] = useState<PlanItem[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({ currency: 'MAD' });
  const [liveRates, setLiveRates] = useState<Record<string, number>>({
    MAD: 1.0, EUR: 0.0916, USD: 0.0998, GBP: 0.0787,
  });
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [wasteRecords, setWasteRecords] = useState<WasteRecord[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [purchasingSuggestions, setPurchasingSuggestions] = useState<any[]>([]);
  const [shiftLogs, setShiftLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [analytics, setAnalytics] = useState<any>({
    revenue: 0, cost: 0, today_revenue: 0, today_cost: 0, currency: 'MAD',
    chartData: [], hourlySales: [], topProducts: [],
    intelligence: { total_portfolio_cost: 0, average_margin: '0%', products_count: 0 },
  });
  const [profitReport, setProfitReport] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);

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
  }, []);

  const applySettings = useCallback((settData: any) => {
    if (!settData) return;
    setSettings(settData);
  }, []);

  useEffect(() => { if (inventoryData) applyInventory(inventoryData); }, [inventoryData]);
  useEffect(() => { if (settingsData) applySettings(settingsData); }, [settingsData]);

  useEffect(() => {
    if (onDataChange) onDataChange();
  }, [inventory, history, stockMovements, stockLocations, stockLotBalances,
      semiFinishedItems, kitchenBatches, planner, orders, settings, liveRates,
      customers, expenses, wasteRecords, staff, suppliers, selectedSupplierId,
      purchaseOrders, purchasingSuggestions, shiftLogs, onDataChange]);

  const fetchLiveRates = useCallback(async () => {
    try {
      const data = await api.get('/currency/rates');
      if (data?.rates && typeof data.rates === 'object') setLiveRates(data.rates);
    } catch { console.warn('Could not fetch live exchange rates — using fallback rates.'); }
  }, []);

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
          if (posData) setPurchaseOrders([...posData].sort(
            (a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()
          ));
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
  }, [user, safeGet]);

  const fetchData = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['inventory'] });
    await queryClient.invalidateQueries({ queryKey: ['settings'] });
    return fetchTabData(activeTab);
  }, [fetchTabData, activeTab, queryClient]);

  useEffect(() => {
    if (user) {
      fetchLiveRates();
      fetchTabData(activeTab);
    }
  }, [user]);

  useEffect(() => {
    const handleOnline = () => { processSyncQueue().then(() => fetchTabData(activeTab)); };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [activeTab, fetchTabData]);

  useEffect(() => { if (user) fetchTabData(activeTab); }, [activeTab]);

  return (
    <ServerDataContext.Provider value={{
      inventory, setInventory,
      analytics, setAnalytics,
      profitReport, setProfitReport,
      alerts, setAlerts,
      history, setHistory,
      stockMovements, setStockMovements,
      stockLocations, setStockLocations,
      stockLotBalances, setStockLotBalances,
      semiFinishedItems, setSemiFinishedItems,
      kitchenBatches, setKitchenBatches,
      planner, setPlanner,
      orders, setOrders,
      settings, setSettings,
      liveRates, setLiveRates,
      customers, setCustomers,
      expenses, setExpenses,
      wasteRecords, setWasteRecords,
      staff, setStaff,
      suppliers, setSuppliers,
      selectedSupplierId, setSelectedSupplierId,
      purchaseOrders, setPurchaseOrders,
      purchasingSuggestions, setPurchasingSuggestions,
      shiftLogs, setShiftLogs,
      loading, setLoading,
      fetchError: (settingsError || inventoryError) as Error | null,
      refetchInventory,
      refetchSettings,
      fetchData,
      fetchTabData,
      fetchLiveRates,
      applyInventory,
      applySettings,
    }}>
      {children}
    </ServerDataContext.Provider>
  );
};