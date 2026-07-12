import React from 'react';
import { useDashboard } from '../DashboardContext';
import { Plus, FlaskConical, ChefHat } from 'lucide-react';

interface Props {
  isDarkMode: boolean;
  semiFinishedItems: any[];
  editMode: boolean;
  onAddItem: () => void;
  onEditRecipe: (item: any) => void;
  onProduceBatch: (item: any) => void;
}

const SemiFinishedPanel: React.FC<Props> = ({
  isDarkMode, semiFinishedItems, editMode, onAddItem, onEditRecipe, onProduceBatch
}) => {
  return (
  <div className={`rounded-[2rem] border overflow-hidden transition-colors ${isDarkMode ? 'bg-[#0a0a0b] border-white/5 shadow-glass backdrop-blur-xl' : 'bg-white border-slate-200 shadow-xl'}`}>
    <div className="p-8 border-b border-white/5 flex justify-between items-center">
      <h3 className={`text-xl font-bold luxury-font uppercase ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
        Semi-Finished Goods
      </h3>
      <button
        onClick={onAddItem}
        className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'bg-gold/10 text-gold hover:bg-gold/20' : 'bg-slate-100 text-slate-900 hover:bg-slate-200'}`}
        title="Add semi-finished item"
      >
        <Plus size={16} />
      </button>
    </div>
    <table className="w-full text-left">
      <thead>
        <tr className={`border-b text-[10px] font-black uppercase tracking-[0.2em] ${isDarkMode ? 'border-white/5 text-cream/40' : 'border-slate-100 text-slate-400'}`}>
          <th className="px-8 py-6">Item</th>
          <th className="px-8 py-6">Stock</th>
          <th className="px-8 py-6">Min Threshold</th>
          <th className="px-8 py-6 text-right">Actions</th>
        </tr>
      </thead>
      <tbody className={`divide-y ${isDarkMode ? 'divide-white/5' : 'divide-slate-100'}`}>
        {semiFinishedItems.length === 0 && (
          <tr>
            <td colSpan={4} className={`px-8 py-12 text-center text-sm ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>
              No semi-finished items yet. Add your first one.
            </td>
          </tr>
        )}
        {semiFinishedItems.map(item => {
          const isLow = item.stock < item.min_threshold;
          return (
            <tr key={item.id} className="group hover:bg-white/[0.02] transition-colors">
              <td className="px-8 py-6">
                <div className="flex items-center gap-3">
                  <span className={`${isDarkMode ? 'text-gold/60' : 'text-amber-500'}`}>
                    <FlaskConical size={20} />
                  </span>
                  <div>
                    <p className={`font-bold ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>{item.name}</p>
                    <p className={`text-[10px] uppercase tracking-widest ${isDarkMode ? 'text-gold/50' : 'text-slate-400'}`}>{item.unit}</p>
                    {item.allergens && item.allergens.length > 0 && (
                      <div className="allergen-badges">
                        {item.allergens.map((a: string) => <span key={a} className="allergen-badge">{a}</span>)}
                      </div>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-8 py-6">
                <span className={`font-bold text-sm ${isLow ? 'text-amber-500' : (isDarkMode ? 'text-gold' : 'text-slate-900')}`}>
                  {item.stock} {item.unit}
                </span>
                {isLow && (
                  <span className="ml-2 text-[9px] font-black uppercase tracking-widest text-amber-500">Low</span>
                )}
              </td>
              <td className="px-8 py-6">
                <span className={`text-sm ${isDarkMode ? 'text-cream/60' : 'text-slate-600'}`}>
                  {item.min_threshold} {item.unit}
                </span>
              </td>
              <td className="px-8 py-6 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => onEditRecipe(item)}
                    className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${
                      isDarkMode
                        ? 'bg-white/5 text-cream/60 hover:text-gold hover:bg-gold/10'
                        : 'bg-slate-50 text-slate-500 hover:bg-amber-50 hover:text-amber-700'
                    }`}
                  >
                    Recipe
                  </button>
                  <button
                    onClick={() => onProduceBatch(item)}
                    className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-1 ${
                      isDarkMode
                        ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    <ChefHat size={10} />
                    Produce
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
  );
};

export default SemiFinishedPanel;
