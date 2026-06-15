/**
 * useBakeryData — server data layer for BakeryOS Dashboard.
 *
 * This hook owns ALL server-fetched state (inventory, analytics, history,
 * orders, etc.) and the tab-aware lazy fetch strategy.  Extracted from
 * Dashboard.tsx so that component stays focused on layout and UI state.
 *
 * Usage:
 *   const bakery = useBakeryData(user, activeTab);
 *   const { inventory, analytics, fetchData } = bakery;
 */

import { useState, useEffect, useCallback } from 'react';
import { api, processSyncQueue } from '../../lib/api';
import { calcAlerts, calcProfitReport } from '../../lib/calculations';
import type {
  DashboardAlert,
  Ingredient,
  PlanItem,
  Product,
  Transaction,
  UserSession,
  Customer,
} from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BakeryInventory {
  materials: Record<string, Ingredient>;
  products: Product[];
}

export interface BakeryAnalytics {
  revenue: number;
  cost: number;
  today_revenue: number;
  today_cost: number;
  currency: string;
  chartData: any[];
  hourlySales: any[];
  topProducts: any[];
  intelligence: {
    total_portfolio_cost: number;
    average_margin: string;
    products_count: number;
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBakeryData(user: UserSession | null, activeTab: string) {
  // ── Core data state ────────────────────────────────────────────────────────
  const [inventory, setInventory] = useState<BakeryInventory>({ materials: {}, products: [] });
  const [analytics, setAnalytics] = useState<BakeryAnalytics>({
    revenue: 0, cost: 0, today_revenue: 0, today_cost: 0, currency: 'MAD',
    chartData: [], hourlySales: [], topProducts: [],
    intelligence: { total_portfolio_cost: 0, average_margin: '0%', products_count: 0 },
  });
  const [profitReport, setProfitReport] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  const [history, setHistory] = useState<Transaction[]>([]);
  const [planner, setPlanner] = useState<PlanItem[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({ currency: 'MAD' });
  const [liveRates, setLiveRates] = useState<Record<string, number>>({
    MAD: 1.0, EUR: 0.0916, USD: 0.0998, GBP: 0.0787,
  });
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [wasteRecords, setWasteRecords] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [purchasingSuggestions, setPurchasingSuggestions] = useState<any[]>([]);
  const [shiftLogs, setShiftLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const safeGet = useCallback(async (url: string, fallback: any = null) => {
    try { return await api.get(url); }
    catch (e) { console.warn(`Failed to fetch ${url}:`, e); return fallback; }
  }, []);

  /** Parse an /inventory response, derive client-side alerts + profit report. */
  const applyInventory = useCallback((invData: any) => {
    if (!invData) return;
    if (invData.products) {
      invData.products.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
    }
    setInventory(invData);
    setAlerts(calcAlerts(invData.products || [], invData.materials || {}));
    setProfitReport(calcProfitReport(invData.products || []));
  }, []);

  const applySettings = useCallback((settData: any) => {
    if (!settData) return;
    setSettings(settData);
  }, []);

  // ── Exchange rates ─────────────────────────────────────────────────────────

  const fetchLiveRates = useCallback(async () => {
    try {
      const data = await api.get('/currency/rates');
      if (data?.rates && typeof data.rates === 'object') setLiveRates(data.rates);
    } catch {
      console.warn('Could not fetch live exchange rates — using fallback rates.');
    }
  }, []);

  // ── Tab-aware lazy fetch ───────────────────────────────────────────────────

  const fetchTabData = useCallback(async (tab: string) => {
    if (!user) return;
    const isOwner = user.role === 'owner' || user.role === 'chef_executif';

    try {
      switch (tab) {
        case 'dashboard': {
          const [invData, anaData, settData, logData] = await Promise.all([
            safeGet('/inventory'),
            isOwner ? safeGet('/analytics') : Promise.resolve(null),
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
          const invData = await safeGet('/inventory');
          applyInventory(invData);
          break;
        }

        case 'history': {
          const histData = await safeGet('/history', []);
          if (histData) setHistory(histData);
          break;
        }

        case 'intelligence': {
          const [invData, anaData] = await Promise.all([
            safeGet('/inventory'),
            isOwner ? safeGet('/analytics') : Promise.resolve(null),
          ]);
          applyInventory(invData);
          if (anaData) setAnalytics(anaData);
          break;
        }

        case 'comptabilite':
        case 'finance': {
          const [histData, expData, wasteData, ordData, suppData] = await Promise.all([
            safeGet('/history', []),
            isOwner ? safeGet('/expenses', []) : Promise.resolve([]),
            isOwner ? safeGet('/waste', []) : Promise.resolve([]),
            safeGet('/orders', []),
            isOwner ? safeGet('/suppliers', []) : Promise.resolve([]),
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
            isOwner ? safeGet('/purchasing/suggest', []) : Promise.resolve([]),
            isOwner ? safeGet('/suppliers', []) : Promise.resolve([]),
            isOwner ? safeGet('/purchase-orders', []) : Promise.resolve([]),
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
            setPurchaseOrders([...posData].sort(
              (a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()
            ));
          }
          applyInventory(invData);
          break;
        }

        case 'planner': {
          const [planData, invData] = await Promise.all([
            isOwner ? safeGet('/planner', []) : Promise.resolve([]),
            safeGet('/inventory'),
          ]);
          if (planData) setPlanner(planData);
          applyInventory(invData);
          break;
        }

        case 'staff': {
          const [staffData, logData] = await Promise.all([
            isOwner ? safeGet('/staff', []) : Promise.resolve([]),
            safeGet('/shift-logs', []),
          ]);
          if (staffData) setStaff(staffData);
          if (logData) setShiftLogs(logData);
          break;
        }

        case 'kitchen': {
          const [invData, planData] = await Promise.all([
            safeGet('/inventory'),
            safeGet('/planner', []),
          ]);
          applyInventory(invData);
          if (planData) setPlanner(planData);
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
  }, [user, safeGet, applyInventory, applySettings]);

  /**
   * fetchData — re-fetches only the currently active tab.
   * Call this after any mutation (produce, sale, PO receive, etc.).
   */
  const fetchData = useCallback(() => fetchTabData(activeTab), [fetchTabData, activeTab]);

  // ── Effects ────────────────────────────────────────────────────────────────

  // Online/offline: replay sync queue and refresh tab data when connectivity returns.
  useEffect(() => {
    const handleOnline = () => {
      processSyncQueue().then(() => fetchTabData(activeTab));
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [activeTab, fetchTabData]);

  // On first login, fetch rates + initial tab data.
  useEffect(() => {
    if (user) {
      fetchLiveRates();
      fetchTabData(activeTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Re-fetch on tab change (lazy loading).
  useEffect(() => {
    if (user) fetchTabData(activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // ── Return ─────────────────────────────────────────────────────────────────

  return {
    // State
    inventory, analytics, profitReport, alerts, history, planner, setPlanner,
    orders, settings, liveRates, customers, expenses, wasteRecords,
    staff, suppliers, selectedSupplierId, setSelectedSupplierId,
    purchaseOrders, purchasingSuggestions, shiftLogs, loading, setLoading,
    // Internal setters needed by mutation handlers in Dashboard.tsx
    setInventory, setAnalytics, setProfitReport, setAlerts, setHistory,
    setOrders, setSettings, setCustomers, setExpenses, setWasteRecords,
    setStaff, setSuppliers, setPurchaseOrders, setPurchasingSuggestions, setShiftLogs,
    // Functions
    fetchData, fetchTabData, applyInventory, applySettings,
  };
}
