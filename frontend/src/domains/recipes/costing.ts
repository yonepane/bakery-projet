export const getIngredientFactor = (unit: string): number => {
  return ['kg', 'L', 'l'].includes(unit) ? 1000 : 1;
};

export const calculateIngredientCost = (
  quantity: number,
  basePrice: number,
  unit: string,
  inflationPercent: number = 0
): number => {
  const factor = getIngredientFactor(unit);
  const inflationMult = 1 + (inflationPercent / 100);
  return (quantity / factor) * basePrice * inflationMult;
};

export const calculateRecipeMaterialCost = (
  ingredients: Array<{ name: string; quantity: number }>,
  materialsRecord: Record<string, any>,
  inflationsRecord: Record<string, number> = {}
): number => {
  return ingredients.reduce((sum, ing) => {
    const mat = materialsRecord[ing.name];
    if (!mat) return sum;
    return sum + calculateIngredientCost(
      ing.quantity, 
      mat.price, 
      mat.unit, 
      inflationsRecord[ing.name] || 0
    );
  }, 0);
};

export const calculateRecipeLaborCost = (
  prepTimeMinutes: number,
  cookTimeMinutes: number,
  hourlyWage: number,
  yieldQty: number
): number => {
  const totalMinutes = (prepTimeMinutes || 0) + (cookTimeMinutes || 0);
  const laborCostPerBatch = (totalMinutes / 60) * hourlyWage;
  return yieldQty > 0 ? laborCostPerBatch / yieldQty : 0;
};
