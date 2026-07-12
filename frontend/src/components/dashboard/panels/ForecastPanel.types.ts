export interface ForecastItem {
  product_id: string;
  product_name: string;
  weekday_forecast: Record<string, number>;
  horizon_qty: number;
  confidence: 'high' | 'medium' | 'low';
  data_points: number;
}

export interface ProductionSuggestion {
  product_id: string;
  product_name: string;
  demand: number;
  current_stock: number;
  net_production: number;
  can_produce: boolean;
  lot_usage: Array<{
    ingredient_id: number;
    ingredient_name: string;
    required_qty: number;
    available_lots: Array<{
      lot_id: number;
      quantity: number;
      expires_at: string | null;
    }>;
  }>;
}

export interface PurchaseSuggestion {
  ingredient_id: number;
  ingredient_name: string;
  unit: string;
  total_needed: number;
  current_stock: number;
  expiring_soon_qty: number;
  expiring_soon_value: number;
  suggested_order_qty: number;
  unit_price: number;
  estimated_cost: number;
  priority: 'high' | 'medium' | 'low';
}

export interface ExpiringStockSuggestion {
  product_id: string;
  product_name: string;
  expiring_ingredients: Array<{
    ingredient_id: number;
    ingredient_name: string;
    lot_id: number;
    qty: number;
    expires_at: string;
    suggested_products: string[];
  }>;
}

export interface ForecastTabProps {
  forecasts: ForecastItem[];
  loading: boolean;
  isDarkMode: boolean;
  t: import('i18next').TFunction;
  targetDate: string;
  confidenceColor: (conf: string) => string;
  confidenceLabel: (conf: string) => string;
}

export interface SummaryCardProps {
  icon: React.ElementType;
  label: string;
  value: number | string;
  isDarkMode: boolean;
  color: string;
}

export interface InsightCardProps {
  title: string;
  items: string[];
  isDarkMode: boolean;
}

export interface ProductionTabProps {
  suggestions: ProductionSuggestion[];
  loading: boolean;
  isDarkMode: boolean;
  t: import('i18next').TFunction;
  formatPrice: (v: number) => string;
}

export interface PurchasingTabProps {
  suggestions: PurchaseSuggestion[];
  loading: boolean;
  isDarkMode: boolean;
  t: import('i18next').TFunction;
  formatPrice: (v: number) => string;
}

export interface ExpiringTabProps {
  suggestions: ExpiringStockSuggestion[];
  loading: boolean;
  isDarkMode: boolean;
  t: import('i18next').TFunction;
  formatPrice: (v: number) => string;
}