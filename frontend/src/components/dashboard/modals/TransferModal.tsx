import React, { useState } from 'react';
import { StockLocation, Ingredient, Product } from '../types';
import { Modal, ModalHeader } from '../../ui/Modal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  locations: StockLocation[];
  inventory: { materials: Record<string, Ingredient>, products: Product[] };
  onTransfer: (payload: { item_type: string, item_id: string, from_location_id: number, to_location_id: number, quantity: number, lot_id?: number }) => void;
  isDarkMode: boolean;
}

export const TransferModal: React.FC<Props> = ({ isOpen, onClose, locations, inventory, onTransfer, isDarkMode }) => {
  const [itemType, setItemType] = useState('ingredient');
  const [itemId, setItemId] = useState('');
  const [fromLoc, setFromLoc] = useState('');
  const [toLoc, setToLoc] = useState('');
  const [qty, setQty] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemId || !fromLoc || !toLoc || !qty) return;
    
    if (fromLoc === toLoc) {
      alert("Source and destination locations cannot be the same.");
      return;
    }

    onTransfer({
      item_type: itemType,
      item_id: itemId,
      from_location_id: parseInt(fromLoc),
      to_location_id: parseInt(toLoc),
      quantity: parseFloat(qty)
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} isDarkMode={isDarkMode} maxWidth="max-w-md" className="p-6">
      <ModalHeader title="Transfer Stock" onClose={onClose} isDarkMode={isDarkMode} />
      <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold mb-2">Item Type</label>
            <select 
              value={itemType} 
              onChange={e => { setItemType(e.target.value); setItemId(''); }}
              className={`w-full p-3 rounded-xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}
            >
              <option value="ingredient">Raw Material</option>
              <option value="product">Finished Good</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-bold mb-2">Item</label>
            <select 
              value={itemId} 
              onChange={e => setItemId(e.target.value)}
              className={`w-full p-3 rounded-xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}
              required
            >
              <option value="">Select Item...</option>
              {itemType === 'ingredient' && Object.keys(inventory.materials).map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
              {itemType === 'product' && inventory.products.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold mb-2">From</label>
              <select 
                value={fromLoc} 
                onChange={e => setFromLoc(e.target.value)}
                className={`w-full p-3 rounded-xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}
                required
              >
                <option value="">Select...</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold mb-2">To</label>
              <select 
                value={toLoc} 
                onChange={e => setToLoc(e.target.value)}
                className={`w-full p-3 rounded-xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}
                required
              >
                <option value="">Select...</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">Quantity</label>
            <input 
              type="number" 
              step="0.001" 
              min="0"
              value={qty} 
              onChange={e => setQty(e.target.value)}
              className={`w-full p-3 rounded-xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}
              required
            />
          </div>
          
          <button type="submit" className="w-full py-3 bg-gold text-black font-bold rounded-xl mt-6">Transfer</button>
      </form>
    </Modal>
  );
};
