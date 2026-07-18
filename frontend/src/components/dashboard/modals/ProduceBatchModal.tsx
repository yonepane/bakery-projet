import React, { useState } from 'react';
import { ChefHat } from 'lucide-react';
import { SemiFinishedItem } from '../types';
import { Modal, ModalHeader } from '../../ui/Modal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  item: SemiFinishedItem | null;
  onProduce: (payload: { semi_finished_id: number; quantity: number }) => void;
  isDarkMode: boolean;
}

export const ProduceBatchModal: React.FC<Props> = ({ isOpen, onClose, item, onProduce, isDarkMode }) => {
  const [qty, setQty] = useState('1');

  if (!isOpen || !item) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(qty);
    if (isNaN(parsed) || parsed <= 0) return;
    onProduce({ semi_finished_id: item.id, quantity: parsed });
    onClose();
    setQty('1');
  };

  return (
    <Modal isOpen={isOpen} isDarkMode={isDarkMode} maxWidth="max-w-sm" className="p-6">
      <ModalHeader 
        title={
          <span className="flex items-center gap-2">
            <ChefHat size={20} className="text-emerald-500" />
            Produce Batch
          </span>
        }
        subtitle={item.name}
        onClose={onClose} 
        isDarkMode={isDarkMode} 
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-bold mb-2">
            Quantity to Produce ({item.unit})
          </label>
          <input
            type="number"
            step="0.001"
            min="0.001"
            value={qty}
            onChange={e => setQty(e.target.value)}
            className={`w-full p-3 rounded-xl border text-lg font-bold ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
            required
            autoFocus
          />
        </div>

        <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>
          This will consume raw ingredients according to the recipe and add{' '}
          <strong className={isDarkMode ? 'text-white/70' : 'text-slate-700'}>
            {qty || '0'} {item.unit}
          </strong>{' '}
          to stock. Make sure the recipe is defined and ingredients are available.
        </p>

        <button
          type="submit"
          className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-colors"
        >
          Confirm Production
        </button>
      </form>
    </Modal>
  );
};
