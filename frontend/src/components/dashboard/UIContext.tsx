/**
 * UIContext — Display preferences, language, sidebar, currency, dark mode.
 * Small, rarely changes. Consumed by: Dashboard.tsx, SettingsPanel, all panels.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { type Language } from '../../i18n';

interface UIContextValue {
  lang: Language;
  setLang: (l: Language) => void;
  isRTL: boolean;
  isDarkMode: boolean;
  setIsDarkMode: React.Dispatch<React.SetStateAction<boolean>>;
  activeCurrency: string;
  setActiveCurrency: React.Dispatch<React.SetStateAction<string>>;
  formatPrice: (amount: number) => string;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  sidebarHoverMode: boolean;
  setSidebarHoverMode: React.Dispatch<React.SetStateAction<boolean>>;
  isSidebarHovered: boolean;
  setIsSidebarHovered: React.Dispatch<React.SetStateAction<boolean>>;
  editMode: boolean;
  setEditMode: React.Dispatch<React.SetStateAction<boolean>>;
  activeTab: string;
  setActiveTab: React.Dispatch<React.SetStateAction<string>>;
}

const UIContext = createContext<UIContextValue | null>(null);

export const useUI = (): UIContextValue => {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used inside <UIProvider>');
  return ctx;
};

interface UIProviderProps {
  children: React.ReactNode;
  liveRates: Record<string, number>;
  initialActiveTab?: string;
  onActiveTabChange?: React.Dispatch<React.SetStateAction<string>>;
}

export const UIProvider: React.FC<UIProviderProps> = ({ children, liveRates, initialActiveTab = 'dashboard', onActiveTabChange }) => {
  const { i18n } = useTranslation();

  const [lang, setLangState] = useState<Language>(() => (i18n.language as Language) || 'en');
  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
    i18n.changeLanguage(newLang);
    localStorage.setItem('bakery_lang', newLang);
  }, [i18n]);

  const isRTL = lang === 'ar';

  const [isDarkMode, setIsDarkMode] = useState(true);
  const [activeCurrency, setActiveCurrency] = useState('MAD');

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [sidebarHoverMode, setSidebarHoverMode] = useState(() => localStorage.getItem('bakery_sidebar_hover') === 'true');
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [editMode, setEditMode] = useState(false);
  
  // Use external activeTab state if provided, otherwise use internal state
  const [internalActiveTab, setInternalActiveTab] = useState(initialActiveTab);
  const activeTab = onActiveTabChange ? undefined : internalActiveTab;
  const setActiveTab = onActiveTabChange || setInternalActiveTab;

  const formatPrice = useCallback((amount: number) => {
    // Simple formatting - actual formatMoney is in utils
    return new Intl.NumberFormat(lang === 'ar' ? 'ar-MA' : 'en-US', {
      style: 'currency',
      currency: activeCurrency,
      minimumFractionDigits: 2,
    }).format(amount);
  }, [lang, activeCurrency]);

  return (
    <UIContext.Provider value={{
      lang, setLang, isRTL,
      isDarkMode, setIsDarkMode,
      activeCurrency, setActiveCurrency,
      formatPrice,
      isSidebarCollapsed, setIsSidebarCollapsed,
      sidebarHoverMode, setSidebarHoverMode,
      isSidebarHovered, setIsSidebarHovered,
      editMode, setEditMode,
      activeTab: activeTab ?? internalActiveTab, setActiveTab,
    }}>
      {children}
    </UIContext.Provider>
  );
};