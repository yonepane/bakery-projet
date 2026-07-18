import { api } from '../../../lib/api';
import type { MutationDeps } from '../types';
import { useMutation } from '../../../hooks/useMutation';

export function useSemiFinishedMutations({ fetchTabData, addToast }: MutationDeps) {
  const { execute: handleCreateSemiFinished } = useMutation(
    async (payload: { name: string; unit: string; min_threshold: number; shelf_life_hours?: number | null; allergens?: string[] | null; }) => api.post('/semi-finished', payload),
    { refetch: () => fetchTabData?.('inventory'), addToast, successMessage: 'Semi-finished item created', errorMessage: 'Failed to create item' }
  );

  const { execute: handleSaveRecipe } = useMutation(
    async (itemId: number, items: Array<{ ingredient_id: number; quantity: number }>) => api.put(`/semi-finished/${itemId}/recipe`, { items }),
    { addToast, successMessage: 'Recipe saved', errorMessage: 'Failed to save recipe' }
  );

  const { execute: handleProduceBatch } = useMutation(
    async (payload: { semi_finished_id: number; quantity: number; }) => {
      const res = await api.post('/semi-finished/produce', payload);
      return res?.data?.new_stock ?? res?.new_stock ?? '?';
    },
    { refetch: () => fetchTabData?.('inventory'), addToast, successMessage: (newStock: any) => `Produced! New stock: ${newStock}`, errorMessage: 'Production failed — check recipe and ingredient stock' }
  );

  const { execute: handleDeleteSemiFinished } = useMutation(
    async (itemId: number) => api.delete(`/semi-finished/${itemId}`),
    { refetch: () => fetchTabData?.('inventory'), addToast, successMessage: 'Item deactivated', errorMessage: 'Failed to deactivate item' }
  );

  return {
    handleCreateSemiFinished,
    handleSaveRecipe,
    handleProduceBatch,
    handleDeleteSemiFinished,
  };
}