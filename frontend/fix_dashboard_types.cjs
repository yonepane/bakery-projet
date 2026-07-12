const fs = require('fs');

const path = 'src/components/Dashboard.tsx';
let content = fs.readFileSync(path, 'utf8');

const replacements = [
  ['const [simulationResult, setSimulationResult] = useState<any[]>([]);', 'const [simulationResult, setSimulationResult] = useState<import("./dashboard/types").SimulationResult[]>([]);'],
  ['const [editingExpense, setEditingExpense] = useState<any>(null);', 'const [editingExpense, setEditingExpense] = useState<import("./dashboard/types").Expense | null>(null);'],
  ['const [editingSupplier, setEditingSupplier] = useState<any>(null);', 'const [editingSupplier, setEditingSupplier] = useState<import("./dashboard/types").Supplier | null>(null);'],
  ['const [selectedPO, setSelectedPO] = useState<any>(null);', 'const [selectedPO, setSelectedPO] = useState<import("./dashboard/types").PurchaseOrder | null>(null);'],
  ['const [lastTransaction, setLastTransaction] = useState<any>(null);', 'const [lastTransaction, setLastTransaction] = useState<import("./dashboard/types").Transaction | null>(null);'],
  ['const [newProduct, setNewProduct] = useState<any>({', 'const [newProduct, setNewProduct] = useState<Partial<import("./dashboard/types").Product>>({'],
  ["const [newMaterial, setNewMaterial] = useState<any>({ name: '', price: 0, unit: 'g', min_threshold: 1000 });", "const [newMaterial, setNewMaterial] = useState<Partial<import('./dashboard/types').Ingredient>>({ name: '', price: 0, unit: 'g', min_threshold: 1000 });"],
  ['const [recipeSearchResults, setRecipeSearchResults] = useState<any[]>([]);', 'const [recipeSearchResults, setRecipeSearchResults] = useState<Record<string, unknown>[]>([]);'],
  ['const newPlans = data.map((item: any) => ({', 'const newPlans = data.map((item: Record<string, unknown>) => ({'],
  ['} catch (err: any) {', '} catch (err: unknown) {'],
  ['const handleGoogleSuccess = async (response: any) => {', 'const handleGoogleSuccess = async (response: unknown) => {'],
  ['} catch (error: any) {', '} catch (error: unknown) {'],
  ['} catch (e: any) {', '} catch (e: unknown) {']
];

let replacedCount = 0;
for (const [search, replace] of replacements) {
  if (content.includes(search)) {
    content = content.replace(search, replace);
    replacedCount++;
  }
}

fs.writeFileSync(path, content);
console.log(`Done. Replaced ${replacedCount} types.`);
