export const getTvaRate = (productName: string): number => {
  const name = (productName || '').toLowerCase();
  const isBread = name.includes('pain') || name.includes('bread') || name.includes('baguette');
  return isBread ? 0 : 0.10;
};

export const calculateHt = (ttcAmount: number, rate: number): number => {
  return ttcAmount / (1 + rate);
};

export const calculateTvaAmount = (ttcAmount: number, rate: number): number => {
  const ht = calculateHt(ttcAmount, rate);
  return ttcAmount - ht;
};
