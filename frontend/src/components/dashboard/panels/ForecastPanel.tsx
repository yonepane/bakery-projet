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

const ForecastTab = (props: ForecastTabProps) => {
  const { forecasts, loading, isDarkMode, t, targetDate, confidenceColor, confidenceLabel } = props;
  const targetWeekday = new Date(targetDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' });

  if (loading) {
    return (
      <div className="h-[400px] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-gold" />
        <p className={`text-sm ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>
          {t('calculating_forecast', { defaultValue: 'Calculating demand forecast...' })}
        </p>
      </div>
    );
  }

  if (!forecasts.length) {
    return (
      <div className="p-12 text-center">
        <TrendingUp className={`w-16 h-16 mx-auto mb-4 ${isDarkMode ? 'text-white/10' : 'text-slate-200'}`} />
        <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
          {t('no_forecast_data', { defaultValue: 'No forecast data available' })}
        </h3>
        <p className={`mt-2 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>
          {t('no_forecast_data_desc', { defaultValue: 'Add sales history to generate forecasts' })}
        </p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={TrendingUp}
          label={t('total_demand', { defaultValue: 'Total Demand' })}
          value={forecasts.reduce((sum, f) => sum + f.horizon_qty, 0)}
          isDarkMode={isDarkMode}
          color="gold"
        />
        <SummaryCard
          icon={TrendingUp}
          label={t('high_confidence', { defaultValue: 'High Confidence' })}
          value={forecasts.filter(f => f.confidence === 'high').length}
          isDarkMode={isDarkMode}
          color="emerald"
        />
        <SummaryCard
          icon={TrendingUp}
          label={t('this_weekday_demand') || `Demand on ${new Date().toLocaleDateString('en-US', { weekday: 'long' })}`}
          value={Math.round(
            forecasts.reduce((sum, f) => {
              const wd = new Date().toLocaleDateString('en-US', { weekday: 'short' });
              return sum + (f.weekday_forecast[wd] || 0);
            }, 0)
          )}
          isDarkMode={isDarkMode}
          color="blue"
        />
        <SummaryCard
          icon={TrendingUp}
          label={t('products_with_data', { defaultValue: 'Products with Data' })}
          value={forecasts.filter(f => f.data_points > 0).length}
          isDarkMode={isDarkMode}
          color="violet"
        />
      </div>

      {/* Forecast Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className={`border-b text-[10px] font-black uppercase tracking-[0.2em] ${isDarkMode ? 'border-white/5 text-cream/40' : 'border-slate-100 text-slate-400'}`}>
              <th className="px-6 py-4">{t('product')}</th>
              <th className="px-6 py-4 text-center">{t('confidence')}</th>
              <th className="px-6 py-4 text-center">{t('data_points')}</th>
              <th className="px-6 py-4">{t('weekday_breakdown')}</th>
              <th className="px-6 py-4 text-right">{t('horizon_qty')}</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDarkMode ? 'divide-white/5' : 'divide-slate-100'}`}>
            {forecasts.map(f => (
              <tr key={f.product_id} className={`group hover:bg-white/[0.02] transition-colors ${isDarkMode ? '' : 'hover:bg-slate-50'}`}>
                <td className="px-6 py-4">
                  <p className={`font-bold text-sm ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>{f.product_name}</p>
                  <p className={`text-[10px] uppercase tracking-widest ${isDarkMode ? 'text-gold/60' : 'text-slate-400'}`}>
                    ID: {f.product_id}
                  </p>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${confidenceColor(f.confidence)}`}>
                    {confidenceLabel(f.confidence)}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`text-sm font-mono ${isDarkMode ? 'text-cream/60' : 'text-slate-500'}`}>
                    {f.data_points}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(f.weekday_forecast).map(([day, qty]) => (
                      <span
                        key={day}
                        className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-widest ${
                          day === new Date().toLocaleDateString('en-US', { weekday: 'short' })
                            ? (isDarkMode ? 'bg-gold/20 text-gold' : 'bg-gold/10 text-gold/90')
                            : (isDarkMode ? 'bg-white/5 text-cream/60' : 'bg-slate-100 text-slate-600')
                        }`}
                      >
                        {day}: {qty}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className={`text-xl font-bold ${isDarkMode ? 'text-gold' : 'text-slate-900'}`}>
                    {f.horizon_qty}
                  </span>
                  <span className={`ml-2 text-[10px] uppercase tracking-widest ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>
                    {t('units')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Insights */}
      <div className={`rounded-xl p-6 ${isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-slate-50 border border-slate-200'}`}>
        <h3 className={`text-lg font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
          {t('forecast_insights', { defaultValue: 'Key Insights' })}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InsightCard
            title={t('growth_products', { defaultValue: 'Growth Products' })}
            items={forecasts
              .filter(f => {
                const wd = new Date().toLocaleDateString('en-US', { weekday: 'short' });
                return f.weekday_forecast[wd] > 10;
              })
              .slice(0, 3)
              .map(f => f.product_name)}
            isDarkMode={isDarkMode}
          />
          <InsightCard
            title={t('declining_demand', { defaultValue: 'Declining Demand' })}
            items={forecasts
              .filter(f => {
                const wd = new Date().toLocaleDateString('en-US', { weekday: 'short' });
                return f.weekday_forecast[wd] > 0 && f.weekday_forecast[wd] < 3;
              })
              .slice(0, 3)
              .map(f => f.product_name)}
            isDarkMode={isDarkMode}
          />
          <InsightCard
            title={t('low_confidence', { defaultValue: 'Low Confidence' })}
            items={forecasts
              .filter(f => f.confidence === 'low')
              .slice(0, 3)
              .map(f => f.product_name)}
            isDarkMode={isDarkMode}
          />
        </div>
      </div>
    </div>
  );
};

const SummaryCard = (props: SummaryCardProps & { t?: any }) => {
  const { t } = props;
  const { icon: Icon, label, value, isDarkMode, color } = props;
  const colorMap: Record<string, string> = {
    gold: isDarkMode ? 'bg-gold/20 text-gold' : 'bg-gold/10 text-gold',
    emerald: isDarkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700',
    blue: isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700',
    violet: isDarkMode ? 'bg-violet-500/20 text-violet-400' : 'bg-violet-100 text-violet-700',
  };
  return (
    <div className={`p-6 rounded-xl border ${isDarkMode ? 'bg-[#1a1a1c] border-white/5' : 'bg-white border-slate-200'} relative overflow-hidden`}>
      <div className="absolute top-0 right-0 h-full w-1/2 opacity-5">
        {Icon && <Icon className="absolute top-1/2 right-4 -translate-y-1/2 w-16 h-16" />}
      </div>
      <div className="relative z-10">
        <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>
          {label}
        </p>
        <p className={`text-3xl font-bold mt-2 ${colorMap[color] || colorMap.gold}`}>
          {value}
        </p>
      </div>
    </div>
  );
};

const InsightCard = (props: InsightCardProps) => {
  const { title, items, isDarkMode } = props;
  return (
  <div className={`p-5 rounded-xl ${isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-white border-slate-50 border border-slate-200'}`}>
    <h4 className={`text-sm font-bold uppercase tracking-widest mb-3 ${isDarkMode ? 'text-gold' : 'text-slate-900'}`}>
      {title}
    </h4>
    {items.length > 0 ? (
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className={`flex items-center gap-2 text-sm ${isDarkMode ? 'text-cream/60' : 'text-slate-600'}`}>
            <span className="w-2 h-2 rounded-full bg-gold/50" />
            {item}
          </li>
        ))}
      </ul>
    ) : (
      <p className={`text-sm ${isDarkMode ? 'text-cream/30' : 'text-slate-400'}`}>
        {'—'}
      </p>
    )}
  </div>
  );
};

const ProductionTab = (props: ProductionTabProps) => {
  const { suggestions, loading, isDarkMode, t, formatPrice } = props;
  if (loading) return <div className="h-[400px] flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-gold" /></div>;

  if (!suggestions.length) {
    return (
      <div className="p-12 text-center">
        <Package className={`w-16 h-16 mx-auto mb-4 ${isDarkMode ? 'text-white/10' : 'text-slate-200'}`} />
        <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t('no_production_needed')}</h3>
        <p className={`mt-2 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>{t('stock_covers_demand')}</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <h2 className={`text-2xl font-bold luxury-font uppercase ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
        {t('production_plan_for', { defaultValue: 'Production Plan for' })} {new Date().toLocaleDateString()}
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className={`border-b text-[10px] font-black uppercase tracking-[0.2em] ${isDarkMode ? 'border-white/5 text-cream/40' : 'border-slate-100 text-slate-400'}`}>
              <th className="px-6 py-4">{t('product')}</th>
              <th className="px-6 py-4 text-center">{t('demand')}</th>
              <th className="px-6 py-4 text-center">{t('current_stock')}</th>
              <th className="px-6 py-4 text-center">{t('to_produce')}</th>
              <th className="px-6 py-4">{t('ingredient_readiness')}</th>
              <th className="px-6 py-4 text-right">{t('estimated_cost')}</th>
            </tr>
          </thead>
          <tbody className={`${isDarkMode ? 'divide-white/5' : 'divide-slate-100'}`}>
            {suggestions.map(s => (
              <tr key={s.product_id} className="group hover:bg-white/[0.02] transition-colors">
                <td className="px-6 py-4">
                  <p className={`font-bold text-sm ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>{s.product_name}</p>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{s.demand}</span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`text-sm ${isDarkMode ? 'text-cream/60' : 'text-slate-500'}`}>{s.current_stock}</span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`font-bold text-lg ${s.net_production > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {s.net_production > 0 ? '+' : ''}{s.net_production}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1.5">
                    {s.lot_usage.slice(0, 3).map(lu => (
                      <span
                        key={lu.ingredient_id}
                        className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest ${
                          s.can_produce
                            ? (isDarkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-700')
                            : (isDarkMode ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-50 text-rose-700')
                        }`}
                      >
                        {lu.ingredient_name}: {lu.required_qty}/{lu.available_lots.reduce((a, b) => a + b.quantity, 0)}
                      </span>
                    ))}
                    {s.lot_usage.length > 3 && (
                      <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'bg-white/5 text-cream/40' : 'bg-slate-100 text-slate-500'}`}>
                        +{s.lot_usage.length - 3} more
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className={`text-lg font-bold ${isDarkMode ? 'text-gold' : 'text-slate-900'}`}>
                    {formatPrice(s.lot_usage.reduce((sum, lu) => sum + lu.required_qty * 0.5, 0))}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const PurchasingTab = (props: PurchasingTabProps) => {
  const { suggestions, loading, isDarkMode, t, formatPrice } = props;
  if (loading) return <div className="h-[400px] flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-gold" /></div>;

  if (!suggestions.length) {
    return (
      <div className="p-12 text-center">
        <Truck className={`w-16 h-16 mx-auto mb-4 ${isDarkMode ? 'text-white/10' : 'text-slate-200'}`} />
        <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t('no_purchase_needed')}</h3>
        <p className={`mt-2 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>{t('stock_covers_demand')}</p>
      </div>
    );
  }

  const highPriority = suggestions.filter(s => s.priority === 'high');
  const totalCost = suggestions.reduce((sum, s) => sum + s.estimated_cost, 0);

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
        <div>
          <h2 className={`text-2xl font-bold luxury-font uppercase ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            {t('purchase_suggestions', { defaultValue: 'Purchase Suggestions' })}
          </h2>
          <p className={`text-sm mt-1 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>
            {t('based_on_forecast_and_expiring', { defaultValue: 'Based on demand forecast and expiring stock' })}
          </p>
        </div>
        <div className="flex items-center gap-6">
          <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-slate-50 border border-slate-200'}`}>
            <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>
              {t('total_estimated_cost')}
            </p>
            <p className={`text-3xl font-bold mt-1 ${isDarkMode ? 'text-gold' : 'text-slate-900'}`}>
              {formatPrice(totalCost)}
            </p>
          </div>
          <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-rose-500/20 border border-rose-500/30' : 'bg-rose-50 border-rose-200'}`}>
            <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-rose-300' : 'text-rose-700'}`}>
              {t('high_priority_items')}
            </p>
            <p className={`text-3xl font-bold mt-1 ${isDarkMode ? 'text-rose-300' : 'text-rose-600'}`}>
              {highPriority.length}
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className={`border-b text-[10px] font-black uppercase tracking-[0.2em] ${isDarkMode ? 'border-white/5 text-cream/40' : 'border-slate-100 text-slate-400'}`}>
              <th className="px-6 py-4">{t('ingredient')}</th>
              <th className="px-6 py-4 text-center">{t('current_stock')}</th>
              <th className="px-6 py-4 text-center">{t('expiring_soon')}</th>
              <th className="px-6 py-4 text-center">{t('total_needed')}</th>
              <th className="px-6 py-4 text-center">{t('suggested_order')}</th>
              <th className="px-6 py-4 text-center">{t('priority')}</th>
              <th className="px-6 py-4 text-right">{t('est_cost')}</th>
            </tr>
          </thead>
          <tbody className={`${isDarkMode ? 'divide-white/5' : 'divide-slate-100'}`}>
            {suggestions.map(s => (
              <tr key={s.ingredient_id} className="group hover:bg-white/[0.02] transition-colors">
                <td className="px-6 py-4">
                  <p className={`font-bold text-sm ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>{s.ingredient_name}</p>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`text-sm ${isDarkMode ? 'text-cream/60' : 'text-slate-500'}`}>{s.current_stock} {s.unit}</span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${s.expiring_soon_qty > 0 ? (isDarkMode ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-50 text-amber-700') : (isDarkMode ? 'bg-white/5 text-cream/40' : 'bg-slate-100 text-slate-400')}`}>
                    {s.expiring_soon_qty} {s.unit}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{s.total_needed} {s.unit}</span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`font-bold text-lg ${isDarkMode ? 'text-gold' : 'text-slate-900'}`}>{s.suggested_order_qty} {s.unit}</span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                    s.priority === 'high' ? (isDarkMode ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-100 text-rose-700')
                    : s.priority === 'medium' ? (isDarkMode ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700')
                    : (isDarkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700')
                  }`}>
                    {t(s.priority)}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className={`font-bold ${isDarkMode ? 'text-gold' : 'text-slate-900'}`}>
                    {formatPrice(s.estimated_cost)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ExpiringTab = (props: ExpiringTabProps) => {
  const { suggestions, loading, isDarkMode, t, formatPrice } = props;
  if (loading) return <div className="h-[400px] flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-gold" /></div>;

  if (!suggestions.length) {
    return (
      <div className="p-12 text-center">
        <AlertTriangle className={`w-16 h-16 mx-auto mb-4 ${isDarkMode ? 'text-white/10' : 'text-slate-200'}`} />
        <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t('no_expiring_stock')}</h3>
        <p className={`mt-2 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>{t('all_stock_fresh')}</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <h2 className={`text-2xl font-bold luxury-font uppercase ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
        {t('expiring_stock_usage_ideas', { defaultValue: 'Expiring Stock Usage Ideas' })}
      </h2>
      <div className="space-y-6">
        {suggestions.map(s => (
          <div key={s.product_id} className={`p-6 rounded-xl border ${isDarkMode ? 'bg-[#1a1a1c] border-white/5' : 'bg-white border-slate-200'}`}>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
              <div>
                <h3 className={`text-xl font-bold luxury-font uppercase ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {s.product_name}
                </h3>
                <p className={`text-sm mt-1 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>
                  {t('use_expiring_ingredients', { defaultValue: 'Use these expiring ingredients in' })} {s.product_name}
                </p>
              </div>
              <span className={`px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-widest ${isDarkMode ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-50 text-amber-700'}`}>
                {t('expiring_soon', { defaultValue: 'Expiring Soon' })}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {s.expiring_ingredients.map((ing: any, i: number) => (
                <div key={i} className={`p-4 rounded-lg ${isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-slate-50 border border-slate-200'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`font-bold ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>{ing.ingredient_name}</span>
                    <span className={`px-2 py-1 rounded text-[10px] font-bold ${isDarkMode ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-100 text-rose-700'}`}>
                      {ing.qty} {'units'}
                    </span>
                  </div>
                  <p className={`text-sm ${isDarkMode ? 'text-cream/60' : 'text-slate-500'}`}>
                    {t('expires', { defaultValue: 'Expires' })}: {ing.expires_at ? new Date(ing.expires_at).toLocaleDateString() : 'Unknown'}
                  </p>
                  {ing.suggested_products && ing.suggested_products.length > 0 && (
                    <p className={`text-[10px] font-bold uppercase tracking-widest mt-2 ${isDarkMode ? 'text-gold/60' : 'text-gold/80'}`}>
                      {t('also_good_for')}: {ing.suggested_products.join(', ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ForecastPanel;