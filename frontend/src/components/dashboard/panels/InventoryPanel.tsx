import { useTranslation } from 'react-i18next';
import React from 'react';
import { useDashboard } from '../DashboardContext';
import type { Product } from '../types';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import { parseQtyString } from '../utils';
import SemiFinishedPanel from './SemiFinishedPanel';

const InventoryPanel: React.FC = () => {
  const { isDarkMode, inventory, editMode, formatPrice,
  handleAdjustStock, openSelector, startEditingMaterial, handleDeleteMaterial,
  setShowAddProduct, setShowAddMaterial, setEditingMaterialName, setNewMaterial,
  handleUpdateProductPrice, stockLocations, stockLotBalances, semiFinishedItems,
  setShowTransferModal, addToast, setActiveSFItem, setShowRecipeModal, setShowProduceModal, setActiveCostProduct, setShowCostModal } = useDashboard();
  
  const sortedMaterialEntries = React.useMemo(() => 
    Object.entries(inventory?.materials || {}).sort(([a], [b]) => a.localeCompare(b))
  , [inventory?.materials]);
  const { t } = useTranslation();
  const [lotStatusFilter, setLotStatusFilter] = React.useState<'all' | 'active' | 'quarantined' | 'recalled'>('all');

  const statusColors: Record<string, string> = {
    active: 'bg-emerald-500/15 text-emerald-400',
    quarantined: 'bg-amber-500/15 text-amber-400',
    recalled: 'bg-rose-700/15 text-rose-400',
    expired: 'bg-red-700/15 text-red-400',
  };

  return (
  <div className="space-y-8 animate-in fade-in duration-500">
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Finished Goods */}
      <div className={`rounded-[2rem] border overflow-hidden transition-colors ${isDarkMode ? 'bg-[#0a0a0b] border-white/5 shadow-glass backdrop-blur-xl' : 'bg-white border-slate-200 shadow-xl'}`}>
        <div className="p-8 border-b border-white/5 flex justify-between items-center">
          <h3 className={`text-xl font-bold luxury-font uppercase ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t('finished_goods')}</h3>
          {editMode && <button onClick={() => setShowAddProduct(true)} className={`p-2 rounded-lg ${isDarkMode ? 'bg-gold/10 text-gold' : 'bg-slate-100 text-slate-900'}`}><Plus size={16} /></button>}
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className={`border-b text-[10px] font-black uppercase tracking-[0.2em] ${isDarkMode ? 'border-white/5 text-cream/40' : 'border-slate-100 text-slate-400'}`}>
              <th className="px-8 py-6">{t('entity')}</th>
              <th className="px-8 py-6">{t('stock')}</th>
              <th className="px-8 py-6 text-right">{t('price_value')}</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDarkMode ? 'divide-white/5' : 'divide-slate-100'}`}>
            {inventory.products.map((p: Product) => {
              const totalValue = p.stock * p.price;
              return (
                <tr key={p.id} className="group hover:bg-white/[0.02] transition-colors">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <span className="text-3xl">{p.icon}</span>
                      <div>
                        <p className={`font-bold ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>{p.name}</p>
                        {p.allergens && p.allergens.length > 0 && (
                          <div className="allergen-badges">
                            {p.allergens.map((a: string) => (
                              <span key={a} className="allergen-badge">{a}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <button onClick={() => handleAdjustStock('product', p.id, -1)} className={`w-6 h-6 rounded-md flex items-center justify-center text-xs ${isDarkMode ? 'bg-white/5 hover:bg-rose-500/20 text-rose-500' : 'bg-slate-100 hover:bg-rose-100 text-rose-600'}`}>-</button>
                      <span className={`font-bold text-sm min-w-[3ch] text-center ${p.stock < 10 ? 'text-rose-500' : ''}`}>{p.stock}</span>
                      <button
                        onClick={() => openSelector({
                          title: 'Quick Stock',
                          label: 'Add Quantity',
                          value: '50',
                          type: 'text',
                          onConfirm: (val) => {
                            const parsed = parseInt(val);
                            if (!isNaN(parsed)) handleAdjustStock('product', p.id, parsed);
                          }
                        })}
                        className={`w-6 h-6 rounded-md flex items-center justify-center text-xs ${isDarkMode ? 'bg-white/5 hover:bg-emerald-500/20 text-emerald-500' : 'bg-slate-100 hover:bg-emerald-100 text-emerald-600'}`}>+</button>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-bold ${isDarkMode ? 'text-gold' : 'text-slate-900'}`}>{formatPrice(p.price)}</span>
                        {editMode && (
                          <button
                            onClick={() => openSelector({
                              title: 'Update Price',
                              label: 'New Selling Price',
                              value: p.price.toString(),
                              type: 'text',
                              onConfirm: (val) => {
                                const parsed = parseFloat(val);
                                if (!isNaN(parsed)) handleUpdateProductPrice(p.id, parsed);
                              }
                            })}
                            className="text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded bg-gold/10 text-gold hover:bg-gold hover:text-black transition-all"
                          >
                            {t('edit')}
                          </button>
                        )}
                        <button
                          onClick={() => { setActiveCostProduct(p); setShowCostModal(true); }}
                          className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded transition-all ${isDarkMode ? 'bg-white/5 text-white/40 hover:text-gold hover:bg-gold/10' : 'bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200'}`}
                        >
                          Cost
                        </button>
                      </div>
                      <span className={`text-[9px] uppercase tracking-widest font-bold ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>{t('total_value')} <span className={isDarkMode ? 'text-cream' : 'text-slate-900'}>{formatPrice(totalValue)}</span></span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Raw Materials */}
      <div className={`rounded-[2rem] border overflow-hidden transition-colors ${isDarkMode ? 'bg-[#0a0a0b] border-white/5 shadow-glass backdrop-blur-xl' : 'bg-white border-slate-200 shadow-xl'}`}>
        <div className="p-8 border-b border-white/5 flex justify-between items-center">
          <h3 className={`text-xl font-bold luxury-font uppercase ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t('raw_materials')}</h3>
          {editMode && (
            <button onClick={() => { setEditingMaterialName(null); setNewMaterial({ name: '', unit: 'g', price: 0, min_threshold: 0 }); setShowAddMaterial(true); }} className={`p-2 rounded-lg ${isDarkMode ? 'bg-gold/10 text-gold' : 'bg-slate-100 text-slate-900'}`}>
              <Plus size={16} />
            </button>
          )}
        </div>
        <table className="w-full text-left table-fixed">
          <colgroup>
            <col className="w-[35%]" />
            <col className="w-[30%]" />
            <col className="w-[20%]" />
            {editMode && <col className="w-[15%]" />}
          </colgroup>
          <thead>
            <tr className={`border-b text-[10px] font-black uppercase tracking-[0.2em] ${isDarkMode ? 'border-white/5 text-cream/40' : 'border-slate-100 text-slate-400'}`}>
              <th className="px-4 py-5 pl-8">{t('ingredient')}</th>
              <th className="px-4 py-5">{t('stock_level')}</th>
              <th className="px-4 py-5">{t('supplier')}</th>
              {editMode && <th className="px-4 py-5 pr-6 text-right">{t('actions')}</th>}
            </tr>
          </thead>
          <tbody className={`divide-y ${isDarkMode ? 'divide-white/5' : 'divide-slate-100'}`}>
            {sortedMaterialEntries.map(([name, data]: [string, any]) => (
              <tr key={name} className="group hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-5 pl-8">
                  <p className={`font-bold truncate ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>{name}</p>
                  <p className={`text-[10px] uppercase font-bold tracking-widest ${isDarkMode ? 'text-gold/60' : 'text-slate-400'}`}>{formatPrice(data.price)}/{data.unit}</p>
                  {(data.is_organic || (data.allergens && data.allergens.length > 0)) && (
                    <div className="allergen-badges">
                      {data.is_organic && <span className="allergen-badge organic">🌿 Organic</span>}
                      {data.allergens && data.allergens.map((a: string) => (
                        <span key={a} className="allergen-badge">{a}</span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-5 font-bold">
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleAdjustStock('material', name, -100)} className={`w-6 h-6 rounded-md flex items-center justify-center text-xs shrink-0 ${isDarkMode ? 'bg-white/5 hover:bg-rose-500/20 text-rose-500' : 'bg-slate-100 hover:bg-rose-100 text-rose-600'}`}>-</button>
                    <span className={`font-bold text-sm min-w-[4ch] text-center ${data.stock < data.min_threshold ? 'text-rose-500' : (isDarkMode ? 'text-gold' : 'text-slate-900')}`}>{data.stock}</span>
                    <button
                      onClick={() => openSelector({
                        title: 'Quick Stock',
                        label: `Add Quantity (${data.unit})`,
                        value: '1000',
                        type: 'text',
                        onConfirm: (val) => {
                          const parsed = parseQtyString(val, data.unit);
                          if (parsed !== 0) handleAdjustStock('material', name, parsed);
                        }
                      })}
                      className={`w-6 h-6 rounded-md flex items-center justify-center text-xs shrink-0 ${isDarkMode ? 'bg-white/5 hover:bg-emerald-500/20 text-emerald-500' : 'bg-slate-100 hover:bg-emerald-100 text-emerald-600'}`}
                    >+</button>
                    <span className="text-[10px] opacity-40 shrink-0">{data.unit}</span>
                  </div>
                </td>
                <td className="px-4 py-5">
                  <span className={`text-[10px] font-black uppercase tracking-widest truncate block ${isDarkMode ? 'text-cream/20' : 'text-slate-300'}`}>{(data as any).supplier || 'Standard'}</span>
                </td>
                {editMode && (
                  <td className="px-4 py-5 pr-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => startEditingMaterial(name, data)}
                        className={`p-2 rounded-lg transition-all ${isDarkMode ? 'bg-white/5 text-cream/40 hover:text-gold hover:bg-gold/10' : 'bg-slate-50 text-slate-400 hover:text-slate-900 hover:bg-slate-100'}`}
                        title={t('edit')}
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDeleteMaterial(name)}
                        className={`p-2 rounded-lg transition-all ${isDarkMode ? 'bg-white/5 text-cream/40 hover:text-rose-400 hover:bg-rose-500/10' : 'bg-slate-50 text-slate-400 hover:text-rose-600 hover:bg-rose-50'}`}
                        title={t('delete')}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Location Board */}
      <div className={`rounded-[2rem] border overflow-hidden transition-colors ${isDarkMode ? 'bg-[#0a0a0b] border-white/5 shadow-glass backdrop-blur-xl' : 'bg-white border-slate-200 shadow-xl'}`}>
        <div className="p-8 border-b border-white/5 flex justify-between items-center">
          <h3 className={`text-xl font-bold luxury-font uppercase ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t('location_board') || 'Location Board'}</h3>
          <div className="flex items-center gap-3">
            <select
              value={lotStatusFilter}
              onChange={(e) => setLotStatusFilter(e.target.value as any)}
              className={`text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg border ${
                isDarkMode ? 'bg-white/5 border-white/10 text-cream/60' : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="quarantined">Quarantined</option>
              <option value="recalled">Recalled</option>
            </select>
            <button onClick={() => setShowTransferModal(true)} className={`px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-colors ${isDarkMode ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-900'}`}>
              Transfer Stock
            </button>
          </div>
        </div>
        <div className="p-8 space-y-8">
          {stockLocations && stockLocations.length > 0 ? stockLocations.map(loc => {
            const balances = (stockLotBalances?.filter(b => b.location?.id === loc.id) || [])
              .filter(b => lotStatusFilter === 'all' || b.lot?.status === lotStatusFilter);
            return (
              <div key={loc.id} className="space-y-4">
                <h4 className={`text-sm font-bold uppercase tracking-widest ${isDarkMode ? 'text-gold' : 'text-slate-900'}`}>{loc.name} {loc.branch_name ? `(${loc.branch_name})` : ''}</h4>
                {balances.length > 0 ? (
                  <table className="w-full text-left table-fixed">
                    <thead>
                      <tr className={`border-b text-[10px] font-black uppercase tracking-[0.2em] ${isDarkMode ? 'border-white/5 text-cream/40' : 'border-slate-100 text-slate-400'}`}>
                        <th className="py-2">Item</th>
                        <th className="py-2">Lot</th>
                        <th className="py-2">Status</th>
                        <th className="py-2 text-right">Quantity</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDarkMode ? 'divide-white/5' : 'divide-slate-100'}`}>
                      {balances.map(b => (
                        <tr key={b.id} className="group hover:bg-white/[0.02] transition-colors">
                          <td className="py-3">
                            <p className={`font-bold text-sm ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>{b.lot?.item_name}</p>
                            <p className={`text-[10px] uppercase font-bold tracking-widest ${isDarkMode ? 'text-gold/60' : 'text-slate-400'}`}>{b.lot?.item_type}</p>
                          </td>
                          <td className="py-3">
                            {b.lot?.lot_code ? (
                              <span className={`text-[10px] font-mono p-1 rounded ${isDarkMode ? 'bg-white/5 text-cream/60' : 'bg-slate-100 text-slate-600'}`}>{b.lot.lot_code}</span>
                            ) : (
                              <span className={`text-[10px] text-slate-400`}>N/A</span>
                            )}
                          </td>
                          <td className="py-3">
                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${statusColors[b.lot?.status || 'active'] || statusColors.active}`}>
                              {b.lot?.status || 'active'}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <span className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{b.quantity}</span>
                            {b.lot?.unit && <span className={`text-[10px] ml-1 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>{b.lot.unit}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className={`text-sm ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>No stock in this location.</p>
                )}
              </div>
            );
          }) : (
             <p className={`text-sm ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>No locations defined.</p>
          )}
        </div>
      </div>
    </div>

    {/* Semi-Finished Goods */}
    <SemiFinishedPanel
      isDarkMode={isDarkMode}
      semiFinishedItems={semiFinishedItems}
      editMode={editMode}
      onAddItem={() => addToast(t('use_recipe_to_setup_new_item'), 'info')}
      onEditRecipe={(item) => { setActiveSFItem(item); setShowRecipeModal(true); }}
      onProduceBatch={(item) => { setActiveSFItem(item); setShowProduceModal(true); }}
    />
  </div>
  );
};

export default InventoryPanel;
