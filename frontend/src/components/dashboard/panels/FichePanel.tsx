import { useTranslation } from 'react-i18next';
import React, { useMemo } from 'react';
import { Edit2, Plus, Trash2, X, Copy } from 'lucide-react';
import { DashboardSharedProps } from '../types';
import { parseQtyString } from '../utils';

type Props = Pick<DashboardSharedProps,
  'isDarkMode' | 'inventory' | 'editMode' | 'formatPrice' |
  'handleOpenEditProduct' | 'handleDeleteProduct' | 'handleCleanupProducts' |
  'setShowAddProduct' | 'setSelectedProduct' | 'handleUpdateProductField' |
  'simulatedInflations' | 'simPrices' | 'addToast' | 'settings' | 'handleDuplicateProduct'>;

const FichePanel: React.FC<Props> = ({
  isDarkMode, inventory, editMode, formatPrice,
  handleOpenEditProduct, handleDeleteProduct, handleCleanupProducts,
  setShowAddProduct, setSelectedProduct, handleUpdateProductField,
  simulatedInflations, simPrices, addToast, settings, handleDuplicateProduct
}) => {
  const { t } = useTranslation();


  // Extract all unique ingredients across all products to populate the quick-add dropdown
  const allIngredients = useMemo(() => {
    const ingredients = new Set<string>();
    inventory.products.forEach(p => p.ingredients.forEach(ing => ingredients.add(ing.name)));
    // Also add any raw materials from inventory that might not be in any product yet
    Object.keys(inventory.materials).forEach(m => ingredients.add(m));
    return Array.from(ingredients).sort();
  }, [inventory]);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {inventory.products.map(p => {
          // Real-time Margin Logic with Labor Cost Engine
          const materialCost = p.ingredients.reduce((sum, ing) => {
            const mat = inventory.materials[ing.name];
            const factor = mat && ['kg', 'L', 'l'].includes(mat.unit) ? 1000 : 1;
            const basePrice = mat ? mat.price : 0;
            const inflationMult = 1 + ((simulatedInflations[ing.name] || 0) / 100);
            return sum + ((ing.quantity / factor) * basePrice * inflationMult);
          }, 0) || p.live_cost || 0;

          // Labor cost: (prep_time + cook_time) / 60 * hourly_wage / yield_qty
          const hourlyWage = settings?.hourly_wage || 0;
          const totalMinutes = (p.prep_time || 0) + (p.cook_time || 0);
          const laborCostPerBatch = (totalMinutes / 60) * hourlyWage;
          const laborCostPerUnit = p.yield_qty > 0 ? laborCostPerBatch / p.yield_qty : 0;
          const realCost = materialCost + laborCostPerUnit;

          const currentSimPrice = simPrices[p.id] ?? p.price;
          const margin = currentSimPrice > 0 ? (((currentSimPrice - realCost) / currentSimPrice) * 100).toFixed(1) : 0;
          const isLowMargin = Number(margin) < 65;

          return (
            <div key={p.id} className={`p-8 rounded-[2.5rem] border transition-colors ${isDarkMode ? 'glass-panel' : 'bg-white border-slate-200 shadow-xl'} ${isLowMargin ? 'border-rose-500/50 shadow-[0_0_30px_rgba(244,63,94,0.15)]' : ''}`}>
              <div className="flex justify-between items-start mb-8">
                <div>
                  <span className="text-4xl mb-2 block">{p.icon}</span>
                  <h3 className={`text-xl font-bold luxury-font ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{p.name}</h3>
                  <div>
                    {isLowMargin && <span className="text-[8px] uppercase tracking-widest font-black text-rose-500 bg-rose-500/10 px-2 py-1 rounded-md mt-2 inline-block">{t('low_margin_warning')}</span>}
                    {isLowMargin && editMode && (
                      <button onClick={() => {
                        const sorted = [...p.ingredients].sort((a,b) => {
                          const matA = inventory.materials[a.name];
                          const factorA = matA && ['kg', 'L', 'l'].includes(matA.unit) ? 1000 : 1;
                          const costA = (matA?.price || 0) * (a.quantity/factorA) * (1 + ((simulatedInflations[a.name] || 0) / 100));
                          
                          const matB = inventory.materials[b.name];
                          const factorB = matB && ['kg', 'L', 'l'].includes(matB.unit) ? 1000 : 1;
                          const costB = (matB?.price || 0) * (b.quantity/factorB) * (1 + ((simulatedInflations[b.name] || 0) / 100));
                          return costB - costA;
                        });
                        if (sorted.length > 0) {
                          const exp = sorted[0];
                          addToast(`AI Suggests: Substitute ${exp.name} to recover margin!`, 'success');
                        }
                      }} className="ml-2 text-[8px] uppercase tracking-widest font-black text-gold bg-gold/10 px-2 py-1 rounded-md mt-2 inline-block hover:bg-gold hover:text-black transition-all">
                        {t('ai_optimize')}
                      </button>
                    )}
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-2">
                  {editMode && (
                    <div className="flex gap-2">
                      <button onClick={() => handleDuplicateProduct(p.id)} className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-all" title="Duplicate Recipe">
                        <Copy size={16} />
                      </button>
                      <button onClick={() => handleOpenEditProduct(p)} className="p-2 rounded-lg bg-gold/10 text-gold hover:bg-gold/20 transition-all" title={t('edit_product')}>
                        <Edit2 size={16} />
                      </button>
                    </div>
                  )}
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gold' : 'text-slate-400'}`}>{t('unit_cost')}</p>
                    <p className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{formatPrice(materialCost)}</p>
                    {hourlyWage > 0 && (
                      <p className={`text-[9px] font-bold mt-1 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>
                        +{formatPrice(laborCostPerUnit)} labor
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-8 p-3 rounded-2xl bg-white/5 border border-white/5">
                <div className="text-center"><p className="text-[8px] uppercase font-black opacity-40 mb-1">{t('prep')}</p><p className="text-xs font-bold">{p.prep_time}m</p></div>
                <div className="text-center border-x border-white/5"><p className="text-[8px] uppercase font-black opacity-40 mb-1">{t('cook')}</p><p className="text-xs font-bold">{p.cook_time}m</p></div>
                <div className="text-center"><p className="text-[8px] uppercase font-black opacity-40 mb-1">{t('yield')}</p><p className="text-xs font-bold">{p.yield_qty}</p></div>
              </div>

              <div className="space-y-2 mb-4">
                {p.ingredients.map((ing, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs group">
                    <span className={`${isDarkMode ? 'text-cream/40' : 'text-slate-500'}`}>
                      {ing.name}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="font-bold opacity-60">{ing.quantity}{inventory.materials[ing.name] && ['kg', 'g'].includes(inventory.materials[ing.name].unit) ? 'g' : (inventory.materials[ing.name] && ['L', 'l', 'ml'].includes(inventory.materials[ing.name].unit) ? 'ml' : ' units')}</span>
                      {editMode && (
                        <button onClick={() => {
                          const newIngredients = p.ingredients.filter((_, i) => i !== idx);
                          handleUpdateProductField(p.id, 'ingredients', newIngredients);
                        }} className="opacity-0 group-hover:opacity-100 text-rose-500/50 hover:text-rose-500 transition-all">
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {editMode && (
                <div className="mb-8">
                  <select 
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const mat = inventory.materials[e.target.value];
                      const promptUnit = mat && ['kg', 'g'].includes(mat.unit) ? 'grams' : (mat && ['L', 'l', 'ml'].includes(mat.unit) ? 'ml' : 'units');
                      const qty = prompt(`Enter quantity for ${e.target.value} in ${promptUnit}:`, "100");
                      if (qty) {
                        const parsed = parseQtyString(qty, mat ? mat.unit : 'g');
                        if (parsed > 0) {
                          const newIngredients = [...p.ingredients, { name: e.target.value, quantity: parsed }];
                          handleUpdateProductField(p.id, 'ingredients', newIngredients);
                        }
                      }
                      e.target.value = '';
                    }}
                    className={`w-full appearance-none cursor-pointer px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl border transition-all outline-none ${isDarkMode ? 'bg-black/40 border-gold/20 text-gold/50 hover:text-gold hover:border-gold/40' : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-900'}`}
                    defaultValue=""
                  >
                    <option value="" disabled className={isDarkMode ? 'bg-[#0a0a0b] text-gold/50' : ''}>{t('add_ingredient')}</option>
                    {allIngredients.filter(ing => !p.ingredients.some(pi => pi.name === ing)).map(ing => (
                      <option key={ing} value={ing} className={isDarkMode ? 'bg-[#0a0a0b] text-gold' : ''}>{ing}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className={`pt-6 border-t ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-widest ${isLowMargin ? 'text-rose-500' : (isDarkMode ? 'text-emerald-500/50' : 'text-emerald-600')}`}>{t('true_net_margin')}</p>
                    <p className={`text-xl font-bold ${isLowMargin ? 'text-rose-500' : 'text-emerald-500'}`}>{margin}%</p>
                    {hourlyWage > 0 && (
                      <p className={`text-[9px] font-black uppercase tracking-widest mt-1 ${isDarkMode ? 'text-cream/30' : 'text-slate-400'}`}>
                        incl. {formatPrice(laborCostPerUnit)} / unit labor
                      </p>
                    )}
                  </div>
                  {editMode && <button onClick={() => handleDeleteProduct(p.id)} className="text-rose-500/20 hover:text-rose-500 transition-colors"><Trash2 size={16} /></button>}
                </div>
              </div>

              <button onClick={() => setSelectedProduct(p)} className={`w-full mt-4 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border transition-all ${isDarkMode ? 'border-gold/20 text-gold hover:bg-gold hover:text-charcoal' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                {t('view_executive_protocol')}
              </button>
            </div>
          );
        })}

        {editMode && (
          <>
            <div onClick={handleCleanupProducts} className={`p-8 rounded-[2.5rem] border border-dashed flex flex-col items-center justify-center cursor-pointer border-rose-500/20 hover:border-rose-500 group transition-all min-h-[300px] ${isDarkMode ? 'bg-rose-500/5' : 'bg-rose-50'}`}>
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-rose-500/20 flex items-center justify-center group-hover:border-rose-500 group-hover:scale-110 transition-all mb-4 text-rose-500"><Trash2 size={24} /></div>
              <p className="font-black text-[10px] uppercase tracking-[0.2em] text-rose-500 opacity-40 group-hover:opacity-100 transition-all text-center">{t('cleanup_broken_data')}<br /><span className="text-[8px] opacity-60">{t('removes_empty_ids')}</span></p>
            </div>
            <div onClick={() => setShowAddProduct(true)} className={`p-8 rounded-[2.5rem] border border-dashed flex flex-col items-center justify-center cursor-pointer hover:border-gold/40 group transition-all min-h-[300px] ${isDarkMode ? 'border-white/10 bg-black/5' : 'border-slate-300 bg-slate-50'}`}>
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-white/10 flex items-center justify-center group-hover:border-gold/40 group-hover:scale-110 transition-all mb-4">
                <Plus className="opacity-20 group-hover:opacity-100 group-hover:text-gold transition-all" />
              </div>
              <p className="font-black text-[10px] uppercase tracking-[0.2em] opacity-20 group-hover:opacity-100 group-hover:text-gold transition-all">{t('new_entity')}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FichePanel;
