import React, { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { 
  X, LayoutDashboard, Brain, ShoppingCart, ChefHat, 
  ClipboardList, Package, FileText, Truck, Calculator, 
  History as HistoryIcon 
} from 'lucide-react';
import { useDashboard } from '../DashboardContext';
import { formatPrice as formatMoney } from '../utils';

// Import modal components
import { TransferModal } from '../modals/TransferModal';
import { RecipeBuilderModal } from '../modals/RecipeBuilderModal';
import { ProduceBatchModal } from '../modals/ProduceBatchModal';
import { CostBreakdownModal } from '../modals/CostBreakdownModal';
import { CommandPalette } from '../../CommandPalette';
import { Product } from '../types';

export const DashboardModals: React.FC = () => {
  const { t } = useTranslation();
  const {
    isDarkMode, activeCurrency, liveRates,
    inventory, stockLocations, activeSFItem, activeCostProduct, lastTransaction,
    user, setActiveTab, setSelectedProduct,
    showWasteModal, setShowWasteModal, showTransferModal, setShowTransferModal,
    showRecipeModal, setShowRecipeModal, showProduceModal, setShowProduceModal,
    showCostModal, setShowCostModal, showReceiptModal, setShowReceiptModal,
    showCommandPalette, setShowCommandPalette,
    handleTransferStock, handleSaveRecipe, handleProduceBatch,
    api, API_BASE, getDownloadToken, openDocument, addToast, fetchData
  } = useDashboard();

  const [wasteForm, setWasteForm] = useState({ product_id: '', quantity: 1 });
  
  // Note: showAddStaff logic is included here to preserve the existing code,
  // although it appears to be currently unreachable from the UI.
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [newStaff, setNewStaff] = useState({ username: '', password: '' });

  const formatPrice = useCallback((amount: number) => formatMoney(amount, activeCurrency, liveRates), [activeCurrency, liveRates]);

  // Command palette actions
  const commandActions = useMemo(() => [
    ...[
      { id: 'dashboard', icon: LayoutDashboard, label: t('dashboard') },
      { id: 'intelligence', icon: Brain, label: 'Intelligence' },
      { id: 'pos', icon: ShoppingCart, label: t('pos') },
      { id: 'kitchen', icon: ChefHat, label: t('kitchen') },
      { id: 'kitchen_board', icon: ClipboardList, label: 'Kitchen Board' },
      { id: 'inventory', icon: Package, label: t('inventory') },
      { id: 'fiche', icon: FileText, label: t('fiche') },
      { id: 'purchasing', icon: Truck, label: t('purchasing') },
      { id: 'simulator', icon: Calculator, label: t('simulator') },
      { id: 'history', icon: HistoryIcon, label: t('history') },
    ].filter(item => {
      if (user?.role === 'cashier' && ['simulator', 'inventory', 'purchasing', 'intelligence'].includes(item.id)) return false;
      return true;
    }).map(item => ({
      name: item.label,
      category: 'Navigation',
      onSelect: () => setActiveTab(item.id)
    })),
    ...(inventory?.products || []).map((p: Product) => ({
      name: `Recipe: ${p.name}`,
      category: 'Products',
      onSelect: () => setSelectedProduct(p)
    }))
  ], [user, inventory, t, setActiveTab, setSelectedProduct]);

  return (
    <>
      {/* Waste Logging Modal */}
      {showWasteModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
            <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-full max-w-md p-10 luxury-panel"
            >
                <div className="flex justify-between items-center mb-10">
                    <h3 className={`text-2xl font-bold luxury-font uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t('waste_log')}</h3>
                    <button onClick={() => setShowWasteModal(false)} className="text-white/20 hover:text-white"><X size={24}/></button>
                </div>

                <div className="space-y-8">
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-gold mb-3 block">{t('product_entity')}</label>
                        <select 
                            value={wasteForm.product_id}
                            onChange={(e) => setWasteForm({...wasteForm, product_id: e.target.value})}
                            className={`w-full p-5 rounded-2xl border outline-none font-bold text-sm ${isDarkMode ? 'bg-white/5 border-white/10 text-cream focus:border-gold/40' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                        >
                            <option value="" className={isDarkMode ? 'bg-[#0a0a0b] text-gold' : ''}>{t('select_product')}</option>
                            {inventory.products.map((p: Product) => <option key={p.id} value={p.id} className={isDarkMode ? 'bg-[#0a0a0b] text-gold' : ''}>{p.name}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-gold mb-3 block">{t('unsold_quantity')}</label>
                        <div className="flex items-center gap-4">
                            <input 
                                type="number" 
                                value={wasteForm.quantity}
                                onChange={(e) => setWasteForm({...wasteForm, quantity: parseInt(e.target.value)})}
                                className={`flex-1 p-5 rounded-2xl border outline-none font-bold text-2xl ${isDarkMode ? 'bg-white/5 border-white/10 text-cream focus:border-gold/40' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                            />
                            <span className="font-bold opacity-40">{t('units')}</span>
                        </div>
                    </div>

                    <button
                        onClick={async () => {
                            if (!wasteForm.product_id) return;
                            try {
                                await api.post('/waste', wasteForm);
                                setShowWasteModal(false);
                                fetchData();
                                addToast(t('waste_logged'), "success");
                            } catch (e: any) { addToast(t('log_failed'), "error"); }
                        }}
                        className={`w-full py-6 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${isDarkMode ? 'bg-rose-500 text-white shadow-lg' : 'bg-slate-900 text-white'}`}
                    >
                        {t('confirm_loss')}
                    </button>
                    <p className="text-[10px] text-center opacity-40 font-bold uppercase tracking-widest">{t('waste_deduct_notice')}</p>
                </div>
            </motion.div>
        </div>
      )}

      {/* Add Staff Modal */}
      {showAddStaff && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
            <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="w-full max-w-md p-10 luxury-panel"
            >
                <div className="flex justify-between items-start mb-10">
                    <h3 className={`text-2xl font-bold luxury-font uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t('add_staff')}</h3>
                    <button onClick={() => setShowAddStaff(false)} className="p-4 rounded-full bg-white/5 hover:bg-white/10 transition-colors"><X size={24}/></button>
                </div>

                <div className="space-y-8">
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">{t('username')}</label>
                        <input 
                            type="text" 
                            value={newStaff.username}
                            onChange={(e) => setNewStaff({...newStaff, username: e.target.value})}
                            className={`w-full p-4 rounded-2xl border outline-none font-bold ${isDarkMode ? 'bg-white/5 border-white/10 text-cream focus:border-gold/40' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                            placeholder={t('username')}
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">{t('password')}</label>
                        <input 
                            type="password" 
                            value={newStaff.password}
                            onChange={(e) => setNewStaff({...newStaff, password: e.target.value})}
                            className={`w-full p-4 rounded-2xl border outline-none font-bold ${isDarkMode ? 'bg-white/5 border-white/10 text-cream focus:border-gold/40' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                            placeholder={t('password')}
                        />
                    </div>
                    <button
                        onClick={async () => {
                            if (!newStaff.username || !newStaff.password) return;
                            try {
                                await api.post('/staff', newStaff);
                                setShowAddStaff(false);
                                fetchData();
                                addToast(t('staff_added'), "success");
                            } catch (e: any) { addToast(e.response?.data?.detail || t('failed_to_add_staff'), "error"); }
                        }}
                        className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${isDarkMode ? 'bg-gold text-charcoal shadow-gold-glow' : 'bg-slate-900 text-white shadow-xl'}`}
                    >
                        {t('save')}
                    </button>
                </div>
            </motion.div>
        </div>
      )}

      {/* Imported Modals */}
      {showTransferModal && <TransferModal 
        isOpen={showTransferModal} 
        onClose={() => setShowTransferModal(false)} 
        locations={stockLocations} 
        inventory={inventory} 
        onTransfer={handleTransferStock} 
        isDarkMode={isDarkMode} 
      />}
      
      {showRecipeModal && <RecipeBuilderModal 
        isOpen={showRecipeModal} 
        onClose={() => setShowRecipeModal(false)} 
        item={activeSFItem} 
        rawMaterials={inventory.materials} 
        onSave={(itemId, lines) => handleSaveRecipe(itemId, lines)} 
        isDarkMode={isDarkMode} 
      />}
      
      {showProduceModal && <ProduceBatchModal 
        isOpen={showProduceModal} 
        onClose={() => setShowProduceModal(false)} 
        item={activeSFItem} 
        onProduce={handleProduceBatch} 
        isDarkMode={isDarkMode} 
      />}
      
      {showCostModal && <CostBreakdownModal 
        isOpen={showCostModal} 
        onClose={() => setShowCostModal(false)} 
        product={activeCostProduct} 
        isDarkMode={isDarkMode} 
        formatPrice={formatPrice} 
      />}

      {showReceiptModal && lastTransaction && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
            <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-full max-w-md p-10 luxury-panel"
            >
                <div className="flex justify-between items-center mb-6">
                    <h3 className={`text-xl font-bold luxury-font uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t('receipt')}</h3>
                    <button onClick={() => setShowReceiptModal(false)} className="text-white/20 hover:text-white"><X size={24}/></button>
                </div>
                <div className="space-y-4 text-center">
                    <p className={`font-bold ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>Transaction #{lastTransaction.transaction_id || lastTransaction.id}</p>
                    <p className={`text-sm ${isDarkMode ? 'text-cream/60' : 'text-slate-600'}`}>{new Date(lastTransaction.timestamp).toLocaleString()}</p>
                    <div className={`flex gap-4 ${isDarkMode ? 'text-cream/60' : 'text-slate-600'}`}>
                        <span>Total: {formatPrice(lastTransaction.revenue || 0)}</span>
                        <span>Items: {lastTransaction.items?.length || 0}</span>
                    </div>
                    <button
                        onClick={async () => {
                            try {
                                const dlToken = await getDownloadToken();
                                openDocument(`${API_BASE}/transactions/${lastTransaction.transaction_id}/receipt?format=pdf&paper=80mm&token=${dlToken}`, `receipt-${lastTransaction.transaction_id}.pdf`);
                            } catch (err) {
                                addToast(t('failed_to_download_file'), 'error');
                            }
                        }}
                        className={`w-full py-3 rounded-xl font-bold text-sm ${isDarkMode ? 'bg-gold text-charcoal shadow-gold-glow' : 'bg-slate-900 text-white'}`}
                    >
                        {t('download_receipt')}
                    </button>
                </div>
            </motion.div>
        </div>
      )}
      
      {showCommandPalette && (
        <CommandPalette 
          isOpen={showCommandPalette} 
          actions={commandActions} 
          onClose={() => setShowCommandPalette(false)} 
          isDarkMode={isDarkMode} 
        />
      )}
    </>
  );
};
