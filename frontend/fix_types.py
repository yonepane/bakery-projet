with open('src/components/dashboard/panels/ForecastPanel.tsx', 'r') as f:
    content = f.read()

import re

# Fix ProductionTab
old = """const ProductionTab: React.FC<{
    suggestions: ProductionSuggestion[];
    loading: boolean;
    isDarkMode: boolean;
    t: any;
    formatPrice: (v: number) => string;
}> = ({ suggestions, loading, isDarkMode, t, formatPrice }) => {"""

new = """/** @typedef {Object} ProductionTabProps
 * @property {ProductionSuggestion[]} suggestions
 * @property {boolean} loading
 * @property {boolean} isDarkMode
 * @property {any} t
 * @property {(v: number) => string} formatPrice
 */
const ProductionTab = ({ suggestions, loading, isDarkMode, t, formatPrice }) => {"""

content = content.replace(old, new)

# Fix ForecastTab
old = """const ForecastTab: React.FC<{
    forecasts: any[];
    loading: boolean;
    isDarkMode: boolean;
    t: any;
    targetDate: string;
    confidenceColor: (conf: string) => string;
    confidenceLabel: (conf: string) => string;
}> = ({ forecasts, loading, isDarkMode, t, targetDate, confidenceColor, confidenceLabel }) => {"""

new = """/** @typedef {Object} ForecastTabProps
 * @property {any[]} forecasts
 * @property {boolean} loading
 * @property {boolean} isDarkMode
 * @property {any} t
 * @property {string} targetDate
 * @property {(conf: string) => string} confidenceColor
 * @property {(conf: string) => string} confidenceLabel
 */
const ForecastTab = ({ forecasts, loading, isDarkMode, t, targetDate, confidenceColor, confidenceLabel }) => {"""

content = content.replace(old, new)

# Fix SummaryCard
old = """const SummaryCard: React.FC<{
    icon: React.ReactNode;
    label: string;
    value: number;
    isDarkMode: boolean;
    color: string;
}> = ({ icon: Icon, label, value, isDarkMode, color }) => {"""

new = """/** @typedef {Object} SummaryCardProps
 * @property {React.ReactNode} icon
 * @property {string} label
 * @property {number} value
 * @property {boolean} isDarkMode
 * @property {string} color
 */
const SummaryCard = ({ icon: Icon, label, value, isDarkMode, color }) => {"""

content = content.replace(old, new)

# Fix InsightCard
old = """const InsightCard: React.FC<{
    title: string;
    items: string[];
    isDarkMode: boolean;
}> = ({ title, items, isDarkMode }) => ("""

new = """/** @typedef {Object} InsightCardProps
 * @property {string} title
 * @property {string[]} items
 * @property {boolean} isDarkMode
 */
const InsightCard = ({ title, items, isDarkMode }) => ("""

content = content.replace(old, new)

# Fix PurchasingTab
old = """const PurchasingTab: React.FC<{
    suggestions: PurchaseSuggestion[];
    loading: boolean;
    isDarkMode: boolean;
    t: any;
    formatPrice: (v: number) => string;
}> = ({ suggestions, loading, isDarkMode, t, formatPrice }) => {"""

new = """/** @typedef {Object} PurchasingTabProps
 * @property {PurchaseSuggestion[]} suggestions
 * @property {boolean} loading
 * @property {boolean} isDarkMode
 * @property {any} t
 * @property {(v: number) => string} formatPrice
 */
const PurchasingTab = ({ suggestions, loading, isDarkMode, t, formatPrice }) => {"""

content = content.replace(old, new)

# Fix ExpiringTab
old = """const ExpiringTab: React.FC<{
    suggestions: any[];
    loading: boolean;
    isDarkMode: boolean;
    t: any;
    formatPrice: (v: number) => string;
}> = ({ suggestions, loading, isDarkMode, t, formatPrice }) => {"""

new = """/** @typedef {Object} ExpiringTabProps
 * @property {any[]} suggestions
 * @property {boolean} loading
 * @property {boolean} isDarkMode
 * @property {any} t
 * @property {(v: number) => string} formatPrice
 */
const ExpiringTab = ({ suggestions, loading, isDarkMode, t, formatPrice }) => {"""

content = content.replace(old, new)

with open('src/components/dashboard/panels/ForecastPanel.tsx', 'w') as f:
    f.write(content)

print('Fixed all inline types')