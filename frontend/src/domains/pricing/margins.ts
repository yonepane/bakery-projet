export const calculateProfit = (price: number, cost: number): number => {
  return price - cost;
};

export const calculateMarginPercent = (price: number, cost: number): number => {
  return price > 0 ? (calculateProfit(price, cost) / price) * 100 : 0;
};

export const calculateMarkupPercent = (price: number, cost: number): number => {
  return cost > 0 ? (calculateProfit(price, cost) / cost) * 100 : 0;
};
