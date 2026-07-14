/**
 * NotificationContext — Toasts, confirm dialog, alerts popover.
 * High churn, isolated from data/UI contexts.
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import type { Toast, ConfirmConfig } from './types';

interface NotificationContextValue {
  toasts: Toast[];
  addToast: (message: string, type?: Toast['type']) => void;
  confirmConfig: ConfirmConfig;
  showConfirm: (config: Omit<ConfirmConfig, 'isOpen'>) => void;
  setConfirmConfig: React.Dispatch<React.SetStateAction<ConfirmConfig>>;
  showAlertsPopover: boolean;
  setShowAlertsPopover: React.Dispatch<React.SetStateAction<boolean>>;
  notificationRef: React.RefObject<HTMLDivElement | null>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export const useNotification = (): NotificationContextValue => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be used inside <NotificationProvider>');
  return ctx;
};

interface NotificationProviderProps {
  children: React.ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);

  const [confirmConfig, setConfirmConfig] = useState<ConfirmConfig>({
    isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'info', confirmText: 'Confirm'
  });
  const showConfirm = useCallback((config: Omit<ConfirmConfig, 'isOpen'>) => {
    setConfirmConfig({ ...config, isOpen: true });
  }, []);

  const [showAlertsPopover, setShowAlertsPopover] = useState(false);
  const notificationRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowAlertsPopover(false);
      }
    };
    if (showAlertsPopover) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAlertsPopover]);

  return (
    <NotificationContext.Provider value={{
      toasts, addToast,
      confirmConfig, showConfirm, setConfirmConfig,
      showAlertsPopover, setShowAlertsPopover,
      notificationRef,
    }}>
      {children}
    </NotificationContext.Provider>
  );
};