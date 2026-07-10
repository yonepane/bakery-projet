import React, { useState } from 'react';
import { X, ChefHat } from 'lucide-react';
import { SemiFinishedItem } from '../types';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`w-full max-w-sm rounded-2xl p-6 ${isDarkMode ? 'bg-[#1a1a1c] text-white' : 'bg-white text-slate-900'}`}>
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ChefHat size={20} className="text-emerald-500" />
            Produce Batch
          </h2>
          <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}>
            <X size={18} />
          </button>
        </div>
        <p className={`text-sm mb-6 ${isDarkMode ? 'text-white/50' : 'text-slate-400'}`}>{item.name}</p>

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
      </div>
    </div>
  );
};
