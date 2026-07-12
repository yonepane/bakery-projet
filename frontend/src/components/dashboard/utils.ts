import type {
  AccountingFeedItem,
  AccountingRange,
  DashboardLanguage,
  Transaction,
} from './types';

export const getInitialLanguage = (saved: string | null): DashboardLanguage =>
  saved === 'en' || saved === 'fr' || saved === 'ar' ? saved : 'en';

export const getDefaultBookingDate = () =>
  new Date(Date.now() + 86400000).toISOString().slice(0, 16).replace('T', ' ');

export const createToastId = () => Math.random().toString(36).substr(2, 9);

export const formatPrice = (
  amount: number,
  activeCurrency: string,
  conversions?: Record<string, number>,
) => {
  const rate = conversions?.[activeCurrency] || 1;
  return (
    (amount * rate).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) +
    ' ' +
    activeCurrency
  );
};

export const displayUnit = (value: number, unit: string) => {
  if (unit === 'g' && value >= 1000) return (value / 1000).toFixed(2) + ' kg';
  if (unit === 'ml' && value >= 1000) return (value / 1000).toFixed(2) + ' L';
  return value.toFixed(0) + ' ' + unit;
};

const isWithinAccountingRange = (value: string | undefined, accountingRange: AccountingRange) => {
  if (!value) return false;
  // Replace space with T for Safari compatibility
  const safeValue = value.replace(' ', 'T');
  const date = new Date(safeValue);
  const start = new Date(`${accountingRange.start}T00:00:00`);
  const end = new Date(`${accountingRange.end}T23:59:59`);
  return date >= start && date <= end;
};

export const deriveAccountingMetrics = ({
  history,
  expenses,
  purchaseOrders,
  wasteRecords,
  suppliers,
  accountingRange,
}: {
  history: Transaction[];
  expenses: any[];
  purchaseOrders: any[];
  wasteRecords: any[];
  suppliers: any[];
  accountingRange: AccountingRange;
}) => {
  const filteredSales = history.filter(
    (tx) => tx.type === 'sale' && tx.status !== 'refunded' && isWithinAccountingRange(tx.timestamp, accountingRange),
  );
  const filteredExpenses = expenses.filter((exp: any) => isWithinAccountingRange(exp.date, accountingRange));
  const filteredPurchaseOrders = purchaseOrders.filter((po: any) =>
    isWithinAccountingRange(po.date, accountingRange),
  );
  const filteredWaste = wasteRecords.filter((record: any) =>
    isWithinAccountingRange(record.date, accountingRange),
  );

  const monthlySales = filteredSales.reduce((sum, tx) => sum + (tx.revenue || 0), 0);
  const monthlyExpensesTotal = filteredExpenses.reduce(
    (sum: number, exp: any) => sum + (Number(exp.amount) || 0),
    0,
  );
  const draftPurchaseCommitment = filteredPurchaseOrders
    .filter((po: any) => po.status !== 'received')
    .reduce(
      (sum: number, po: any) =>
        sum +
        po.items.reduce(
          (poSum: number, item: any) => poSum + (Number(item.qty) || 0) * (Number(item.price) || 0),
          0,
        ),
      0,
    );
  const monthlyNetAfterExpenses = monthlySales - monthlyExpensesTotal;
  const expenseBreakdown = Object.entries(
    filteredExpenses.reduce((acc: Record<string, number>, exp: any) => {
      const key = exp.category || 'other';
      acc[key] = (acc[key] || 0) + (Number(exp.amount) || 0);
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const accountingFeed: any[] = [
    ...filteredExpenses.map((exp: any) => ({
      id: `expense-${exp.id}`,
      type: 'expense',
      date: exp.date,
      label: exp.description || exp.category,
      meta: exp.category,
      amount: Number(exp.amount) || 0,
    })),
    ...filteredPurchaseOrders.map((po: any) => ({
      id: `po-${po.id}`,
      type: 'purchase_order',
      date: po.date,
      label: suppliers.find((supp) => supp.id === po.supplier_id)?.name || `Supplier #${po.supplier_id}`,
      meta: `${po.items.length} lines${po.archived ? ' (ARCHIVED)' : ''}`,
      amount: po.items.reduce(
        (sum: number, item: any) => sum + (Number(item.qty) || 0) * (Number(item.price) || 0),
        0,
      ),
      status: po.status,
      archived: po.archived,
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);
  const productProfitability: any[] = Object.values(
    filteredSales.reduce((acc: Record<string, any>, tx) => {
      let items = tx.items || [];
      if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch(e) { items = []; }
      }
      items.forEach((item: any) => {
        const key = item.name || 'Unknown';
        if (!acc[key]) {
          acc[key] = { name: key, qty: 0, revenue: 0, cost: 0, profit: 0 };
        }
        const qty = Number(item.qty) || 0;
        const price = Number(item.price) || 0;
        const unitCost = Number(item.cost) || 0;
        acc[key].qty = (acc[key].qty || 0) + qty;
        acc[key].revenue = (acc[key].revenue || 0) + qty * price;
        acc[key].cost = (acc[key].cost || 0) + qty * unitCost;
        acc[key].profit = (acc[key].revenue || 0) - (acc[key].cost || 0);
      });
      return acc;
    }, {}),
  )
    .sort((a, b) => (b.profit || 0) - (a.profit || 0))
    .slice(0, 6);
  const wasteByProduct: any[] = Object.values(
    filteredWaste.reduce((acc: Record<string, any>, record: any) => {
      const key = record.product_name || 'Unknown';
      if (!acc[key]) {
        acc[key] = { name: key, qty: 0, loss: 0 };
      }
      acc[key].qty = (acc[key].qty || 0) + (Number(record.quantity) || 0);
      acc[key].loss = (acc[key].loss || 0) + (Number(record.loss_cost) || 0);
      return acc;
    }, {}),
  )
    .sort((a, b) => (b.loss || 0) - (a.loss || 0))
    .slice(0, 6);

  return {
    accountingFeed,
    draftPurchaseCommitment,
    expenseBreakdown,
    filteredExpenses,
    filteredPurchaseOrders,
    filteredSales,
    filteredWaste,
    monthlyExpensesTotal,
    monthlyNetAfterExpenses,
    monthlySales,
    productProfitability,
    wasteByProduct,
  };
};

export const parseQtyString = (input: string, baseUnit: string): number => {
  const cleaned = input.trim().toLowerCase();
  const val = parseFloat(cleaned);
  if (isNaN(val)) return 0;
  
  const suffix = cleaned.replace(val.toString(), '').trim();
  if (!suffix) return val;

  if (baseUnit === 'g') {
    if (suffix === 'kg') return val * 1000;
    if (suffix === 'g') return val;
  }
  if (baseUnit === 'ml') {
    if (suffix === 'l') return val * 1000;
    if (suffix === 'ml') return val;
  }
  if (baseUnit === 'L' || baseUnit === 'l') {
    if (suffix === 'ml') return val / 1000;
    if (suffix === 'l') return val;
  }
  if (baseUnit === 'kg') {
    if (suffix === 'g') return val / 1000;
    if (suffix === 'kg') return val;
  }
  return val;
};
