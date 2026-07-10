import { api } from '../../../lib/api';

interface MutationDeps {
  fetchTabData: (tab: string) => void;
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export function useSemiFinishedMutations({ fetchTabData, addToast }: MutationDeps) {
  const handleCreateSemiFinished = async (payload: {
    name: string;
    unit: string;
    min_threshold: number;
    shelf_life_hours?: number | null;
    allergens?: string[] | null;
  }) => {
    try {
      await api.post('/api/semi-finished', payload);
      addToast('Semi-finished item created', 'success');
      fetchTabData('inventory');
    } catch {
      addToast('Failed to create item', 'error');
    }
  };

  const handleSaveRecipe = async (
    itemId: number,
    items: Array<{ ingredient_id: number; quantity: number }>
  ) => {
    try {
      await api.put(`/api/semi-finished/${itemId}/recipe`, { items });
      addToast('Recipe saved', 'success');
    } catch {
      addToast('Failed to save recipe', 'error');
    }
  };

  const handleProduceBatch = async (payload: {
    semi_finished_id: number;
    quantity: number;
  }) => {
    try {
      const res = await api.post('/api/semi-finished/produce', payload);
      const newStock = res?.data?.new_stock ?? res?.new_stock ?? '?';
      addToast(`Produced! New stock: ${newStock}`, 'success');
      fetchTabData('inventory');
    } catch {
      addToast('Production failed — check recipe and ingredient stock', 'error');
    }
  };

  const handleDeleteSemiFinished = async (itemId: number) => {
    try {
      await api.delete(`/api/semi-finished/${itemId}`);
      addToast('Item deactivated', 'success');
      fetchTabData('inventory');
    } catch {
      addToast('Failed to deactivate item', 'error');
    }
  };

  return {
    handleCreateSemiFinished,
    handleSaveRecipe,
    handleProduceBatch,
    handleDeleteSemiFinished,
  };
}
