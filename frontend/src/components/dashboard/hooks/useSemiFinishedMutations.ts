import { useCallback } from 'react';
import { api } from '../../../lib/api';
import type { MutationDeps } from '../types';

export function useSemiFinishedMutations({ fetchTabData, addToast }: MutationDeps) {
  const handleCreateSemiFinished = useCallback(
    async (payload: {
      name: string;
      unit: string;
      min_threshold: number;
      shelf_life_hours?: number | null;
      allergens?: string[] | null;
    }) => {
      try {
        await api.post('/api/semi-finished', payload);
        addToast('Semi-finished item created', 'success');
        fetchTabData?.('inventory');
      } catch {
        addToast('Failed to create item', 'error');
      }
    },
    [fetchTabData, addToast]
  );

  const handleSaveRecipe = useCallback(
    async (
      itemId: number,
      items: Array<{ ingredient_id: number; quantity: number }>
    ) => {
      try {
        await api.put(`/api/semi-finished/${itemId}/recipe`, { items });
        addToast('Recipe saved', 'success');
      } catch {
        addToast('Failed to save recipe', 'error');
      }
    },
    [addToast]
  );

  const handleProduceBatch = useCallback(
    async (payload: {
      semi_finished_id: number;
      quantity: number;
    }) => {
      try {
        const res = await api.post('/api/semi-finished/produce', payload);
        const newStock = res?.data?.new_stock ?? res?.new_stock ?? '?';
        addToast(`Produced! New stock: ${newStock}`, 'success');
        fetchTabData?.('inventory');
      } catch {
        addToast('Production failed — check recipe and ingredient stock', 'error');
      }
    },
    [fetchTabData, addToast]
  );

  const handleDeleteSemiFinished = useCallback(
    async (itemId: number) => {
      try {
        await api.delete(`/api/semi-finished/${itemId}`);
        addToast('Item deactivated', 'success');
        fetchTabData?.('inventory');
      } catch {
        addToast('Failed to deactivate item', 'error');
      }
    },
    [fetchTabData, addToast]
  );

  return {
    handleCreateSemiFinished,
    handleSaveRecipe,
    handleProduceBatch,
    handleDeleteSemiFinished,
  };
}