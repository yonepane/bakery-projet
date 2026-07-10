import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { SemiFinishedItem } from '../types';
import { api } from '../../../lib/api';

interface RecipeLine {
  ingredient_id: number;
  ingredient_name: string;
  quantity: number;
  unit: string;
}

// Backend /inventory returns materials keyed by name with an `id` field not
// reflected in the TypeScript `Ingredient` type. We use `any` here intentionally.
interface RawIngredient {
  id: number;
  name: string;
  unit: string;
  [key: string]: any;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  item: SemiFinishedItem | null;
  /** Raw materials from inventory.materials — keyed by name, backend includes `id`. */
  rawMaterials: Record<string, any>;
  onSave: (itemId: number, lines: Array<{ ingredient_id: number; quantity: number }>) => void;
  isDarkMode: boolean;
}

export const RecipeBuilderModal: React.FC<Props> = ({
  isOpen, onClose, item, rawMaterials, onSave, isDarkMode
}) => {
  const [lines, setLines] = useState<RecipeLine[]>([]);
  const [loading, setLoading] = useState(false);

  // Build a sorted list of ingredients with their IDs
  const ingredientList: RawIngredient[] = Object.entries(rawMaterials)
    .filter(([, ing]) => ing && typeof ing.id === 'number')
    .map(([name, ing]) => ({ ...ing, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  useEffect(() => {
    if (isOpen && item) {
      setLoading(true);
      api.get(`/api/semi-finished/${item.id}/recipe`)
        .then(res => setLines(res.data?.items || []))
        .catch(() => setLines([]))
        .finally(() => setLoading(false));
    }
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  const addLine = () => {
    if (ingredientList.length === 0) return;
    const ing = ingredientList[0];
    setLines(prev => [...prev, {
      ingredient_id: ing.id,
      ingredient_name: ing.name,
      quantity: 1,
      unit: ing.unit || '',
    }]);
  };

  const updateIngredient = (idx: number, ingredientId: number) => {
    const ing = ingredientList.find(i => i.id === ingredientId);
    if (!ing) return;
    setLines(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], ingredient_id: ing.id, ingredient_name: ing.name, unit: ing.unit || '' };
      return next;
    });
  };

  const updateQuantity = (idx: number, qty: number) => {
    setLines(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], quantity: qty };
      return next;
    });
  };

  const removeLine = (idx: number) => setLines(prev => prev.filter((_, i) => i !== idx));

  const handleSave = () => {
    onSave(item.id, lines.map(l => ({ ingredient_id: l.ingredient_id, quantity: l.quantity })));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`w-full max-w-lg rounded-2xl flex flex-col max-h-[85vh] ${isDarkMode ? 'bg-[#1a1a1c] text-white' : 'bg-white text-slate-900'}`}>
        {/* Header */}
        <div className={`p-6 border-b flex justify-between items-center shrink-0 ${isDarkMode ? 'border-white/10' : 'border-slate-100'}`}>
          <div>
            <h2 className="text-xl font-bold">Recipe Builder</h2>
            <p className={`text-sm mt-0.5 ${isDarkMode ? 'text-white/50' : 'text-slate-400'}`}>{item.name}</p>
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {loading ? (
            <p className={`text-sm text-center py-8 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Loading recipe…</p>
          ) : lines.length === 0 ? (
            <p className={`text-sm text-center py-8 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>
              No recipe yet. Click "Add Ingredient" to build one.
            </p>
          ) : (
            lines.map((line, idx) => (
              <div key={idx} className={`flex items-center gap-3 p-3 rounded-xl ${isDarkMode ? 'bg-white/5' : 'bg-slate-50'}`}>
                <select
                  value={line.ingredient_id}
                  onChange={e => updateIngredient(idx, parseInt(e.target.value))}
                  className={`flex-1 p-2 rounded-lg text-sm border ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                >
                  {ingredientList.map(ing => (
                    <option key={ing.id} value={ing.id}>{ing.name}</option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={line.quantity}
                  onChange={e => updateQuantity(idx, parseFloat(e.target.value))}
                  className={`w-24 p-2 rounded-lg text-sm border text-right ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                />
                <span className={`text-xs w-8 shrink-0 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>{line.unit}</span>
                <button
                  onClick={() => removeLine(idx)}
                  className="text-rose-400 hover:text-rose-500 transition-colors"
                  title="Remove line"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className={`p-6 border-t flex gap-3 shrink-0 ${isDarkMode ? 'border-white/10' : 'border-slate-100'}`}>
          <button
            onClick={addLine}
            disabled={ingredientList.length === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
              isDarkMode
                ? 'bg-white/5 text-white hover:bg-white/10 disabled:opacity-40'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-40'
            }`}
          >
            <Plus size={14} /> Add Ingredient
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2 bg-gold text-black font-bold rounded-xl text-sm hover:bg-gold/90 transition-colors"
          >
            Save Recipe
          </button>
        </div>
      </div>
    </div>
  );
};
