import React from 'react';
import { useDashboard } from '../DashboardContext';
import { useTranslation } from 'react-i18next';
import { TrendingUp, Package, Truck, AlertTriangle, Clock, Zap, Loader2 } from 'lucide-react';
import type {
  ForecastItem,
  ProductionSuggestion,
  PurchaseSuggestion,
  ExpiringStockSuggestion,
  ForecastTabProps,
  SummaryCardProps,
  InsightCardProps,
  ProductionTabProps,
  PurchasingTabProps,
  ExpiringTabProps,
} from './ForecastPanel.types';

import { ForecastTab } from './ForecastTab';
import { ProductionTab } from './ProductionTab';
import { PurchasingTab } from './PurchasingTab';
import { ExpiringTab } from './ExpiringTab';

const ForecastPanel: React.FC = () => {
  const { isDarkMode,
  formatPrice,
  api,
  addToast,
  fetchTabData, } = useDashboard();
  const { t } = useTranslation();
  const [targetDate, setTargetDate] = React.useState(
    new Date().toISOString().split('T')[0]
  );
  const [horizonDays, setHorizonDays] = React.useState(7);
  const [loading, setLoading] = React.useState(false);
  const [forecasts, setForecasts] = React.useState<any[]>([]);
  const [productionSuggestions, setProductionSuggestions] = React.useState<ProductionSuggestion[]>([]);
  const [purchaseSuggestions, setPurchaseSuggestions] = React.useState<PurchaseSuggestion[]>([]);
  const [expiringSuggestions, setExpiringSuggestions] = React.useState<any[]>([]);
  const [activeTab, setActiveTab] = React.useState<'forecast' | 'production' | 'purchasing' | 'expiring'>('forecast');

  const loadForecast = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/forecast/enhanced?target_date=${targetDate}&horizon_days=${horizonDays}`);
      setForecasts(res.forecasts || []);
    } catch (err) {
      addToast(t('forecast_load_failed'), 'error');
    } finally {
      setLoading(false);
    }
  }, [targetDate, horizonDays, api, addToast]);

  const loadProductionSuggestions = React.useCallback(async () => {
    try {
      const res = await api.get(`/forecast/production-suggestions?target_date=${targetDate}`);
      setProductionSuggestions(res.suggestions || []);
    } catch (err) {
      addToast(t('production_suggestions_failed'), 'error');
    }
  }, [targetDate, api, addToast]);

  const loadPurchaseSuggestions = React.useCallback(async () => {
    try {
      const res = await api.get(`/forecast/purchase-suggestions?target_date=${targetDate}`);
      setPurchaseSuggestions(res.suggestions || []);
    } catch (err) {
      addToast(t('purchase_suggestions_failed'), 'error');
    }
  }, [targetDate, api, addToast]);

  const loadExpiringSuggestions = React.useCallback(async () => {
    try {
      const res = await api.get(`/forecast/expiring-usage?target_date=${targetDate}`);
      setExpiringSuggestions(res.suggestions || []);
    } catch (err) {
      addToast(t('expiring_suggestions_failed'), 'error');
    }
  }, [targetDate, api, addToast]);

  React.useEffect(() => {
    loadForecast();
    if (activeTab === 'production') loadProductionSuggestions();
    if (activeTab === 'purchasing') loadPurchaseSuggestions();
    if (activeTab === 'expiring') loadExpiringSuggestions();
  }, [targetDate, horizonDays, activeTab, loadForecast, loadProductionSuggestions, loadPurchaseSuggestions]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTargetDate(e.target.value);
  };

  const confidenceColor = (conf: string) => {
    switch (conf) {
      case 'high': return isDarkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700';
      case 'medium': return isDarkMode ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700';
      default: return isDarkMode ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-100 text-rose-700';
    }
  };

  const confidenceLabel = (conf: string) => {
    switch (conf) {
      case 'high': return t('confidence_high');
      case 'medium': return t('confidence_medium');
      default: return t('confidence_low');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
        <div>
          <h2 className={`text-3xl font-bold luxury-font uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            {t('smart_planning', { defaultValue: 'Smart Planning' })}
          </h2>
          <p className={`text-sm mt-1 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>
            {t('forecast_subtitle', { defaultValue: 'AI-powered demand forecasting and smart production planning' })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className={`text-sm font-medium ${isDarkMode ? 'text-cream/60' : 'text-slate-500'}`}>
              {t('target_date', { defaultValue: 'Target Date' })}
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={handleDateChange}
              className={`px-4 py-3 rounded-xl border font-mono text-sm ${isDarkMode ? 'bg-white/5 border-white/10 text-cream' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className={`text-sm font-medium ${isDarkMode ? 'text-cream/60' : 'text-slate-500'}`}>
              {t('horizon_days', { defaultValue: 'Horizon (days)' })}
            </label>
            <select
              value={horizonDays}
              onChange={(e) => setHorizonDays(Number(e.target.value))}
              className={`px-4 py-3 rounded-xl border font-mono text-sm ${isDarkMode ? 'bg-white/5 border-white/10 text-cream' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
            >
              {[1, 3, 7, 14, 30].map(d => (
                <option key={d} value={d}>{d} {t('days', { defaultValue: 'days' })}</option>
              ))}
            </select>
          </div>
          {loading && (
            <div className="flex items-center gap-2 text-sm text-gold">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{t('loading_forecast')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className={`flex gap-1 rounded-xl border p-1 ${isDarkMode ? 'bg-[#1a1a1c] border-white/5' : 'bg-slate-50 border-slate-200'}`}>
        {[
          { id: 'forecast', label: t('demand_forecast'), icon: TrendingUp },
          { id: 'production', label: t('production_plan'), icon: Package },
          { id: 'purchasing', label: t('purchase_orders'), icon: Truck },
          { id: 'expiring', label: t('expiring_stock_usage'), icon: AlertTriangle },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-bold uppercase tracking-widest transition-all ${
              activeTab === tab.id
                ? (isDarkMode ? 'bg-gold text-charcoal shadow-gold-glow' : 'bg-gold text-charcoal shadow-lg')
                : (isDarkMode ? 'text-cream/60 hover:text-white' : 'text-slate-500 hover:text-slate-900')
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className={`rounded-2xl border overflow-hidden transition-colors ${isDarkMode ? 'bg-[#0a0a0b] border-white/5 shadow-glass backdrop-blur-xl' : 'bg-white border-slate-200 shadow-xl'}`}>
        {activeTab === 'forecast' && (
          <ForecastTab
            forecasts={forecasts}
            loading={loading}
            isDarkMode={isDarkMode}
            t={t}
            targetDate={targetDate}
            confidenceColor={confidenceColor}
            confidenceLabel={confidenceLabel}
          />
        )}
        {activeTab === 'production' && (
          <ProductionTab
            suggestions={productionSuggestions}
            loading={loading}
            isDarkMode={isDarkMode}
            t={t}
            formatPrice={formatPrice}
          />
        )}
        {activeTab === 'purchasing' && (
          <PurchasingTab
            suggestions={purchaseSuggestions}
            loading={loading}
            isDarkMode={isDarkMode}
            t={t}
            formatPrice={formatPrice}
          />
        )}
        {activeTab === 'expiring' && (
          <ExpiringTab
            suggestions={expiringSuggestions}
            loading={loading}
            isDarkMode={isDarkMode}
            t={t}
            formatPrice={formatPrice}
          />
        )}
      </div>
    </div>
  );
};

// Sub-components



export default ForecastPanel;