/**
 * CartContext — POS cart state + related handlers.
 * Extracted from the old monolithic DashboardContext to restore POS functionality.
 */
import React, { createContext, useContext, useState, useCallback } from 'react';
import { api } from '../../lib/api';
import type { CartItem, Product, Transaction, UserSession } from './types';

type AnyRecord = Record<string, any>;

interface CartContextValue {
  // Cart state
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  addToCart: (product: Product) => void;
  finalizeSale: (customerId: string | null) => Promise<void>;
  lastTransaction: Transaction | null;
  setLastTransaction: React.Dispatch<React.SetStateAction<Transaction | null>>;

  // API
  api: typeof import('../../lib/api').api;

  // API helpers
  getDownloadToken: () => Promise<string>;
  openDocument: (url: string, filename: string) => void;
  handleResetSession: () => void;

  // Forecast/Planner
  handleSmartForecast: (date: string) => void;
  displayUnit: (v: number, unit: string) => string;

  // Purchase Orders
  openPOModal: (po: any) => void;

  // Booking
  bookingForm: { name: string; phone: string; date: string; source: 'pos' | 'ledger'; notes?: string };
  setBookingForm: React.Dispatch<React.SetStateAction<any>>;
  setShowBookingModal: (v: boolean) => void;
  setShowReceiptModal: (v: boolean) => void;

  // API base URL
  API_BASE: string;
}

const CartContext = createContext<CartContextValue | null>(null);

export const useCart = (): CartContextValue => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
};

interface CartProviderProps {
  children: React.ReactNode;
}

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);
  const [bookingForm, setBookingForm] = useState({
    name: '', phone: '', date: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
    source: 'pos' as 'pos' | 'ledger', notes: ''
  });

  const API_BASE = import.meta.env.VITE_API_URL || '/api';

  const addToCart = useCallback((product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) {
        return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { id: product.id, name: product.name, price: product.price, qty: 1 }];
    });
  }, []);

  const finalizeSale = useCallback(async (customerId: string | null) => {
    if (cart.length === 0) return;

    try {
      const items = cart.map(item => ({
        product_id: item.id,
        quantity: item.qty,
        unit_price: item.price,
      }));

      const response = await api.post('/orders', {
        items,
        customer_id: customerId,
      });

      const transaction = response.data;
      setLastTransaction(transaction);
      setCart([]);
    } catch (error) {
      console.error('Failed to finalize sale:', error);
      throw error;
    }
  }, [cart]);

  const getDownloadToken = useCallback(async () => {
    const response = await api.get('/auth/download-token');
    return response.data.token;
  }, []);

  const openDocument = useCallback((url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const handleResetSession = useCallback(() => {
    localStorage.removeItem('bakery_token');
    localStorage.removeItem('bakery_refresh_token');
    localStorage.removeItem('bakery_user');
    window.location.reload();
  }, []);

  const handleSmartForecast = useCallback((date: string) => {
    console.log('Smart forecast for:', date);
  }, []);

  const displayUnit = useCallback((v: number, unit: string) => {
    return `${v} ${unit}`;
  }, []);

  const openPOModal = useCallback((po: any) => {
    console.log('Open PO modal:', po);
  }, []);

  const setShowBookingModal = useCallback((v: boolean) => {
    console.log('Set show booking modal:', v);
  }, []);

  const setShowReceiptModal = useCallback((v: boolean) => {
    console.log('Set show receipt modal:', v);
  }, []);

  return (
    <CartContext.Provider value={{
      cart, setCart, addToCart, finalizeSale,
      lastTransaction, setLastTransaction,
      api,
      getDownloadToken, openDocument, handleResetSession,
      handleSmartForecast, displayUnit, openPOModal,
      bookingForm, setBookingForm, setShowBookingModal, setShowReceiptModal,
      API_BASE,
    }}>
      {children}
    </CartContext.Provider>
  );
};