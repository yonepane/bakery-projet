import { useState, useCallback } from 'react';
import { api } from '../../../lib/api';

export interface KitchenBatch {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  stage:
    | 'planned'
    | 'prep'
    | 'mix'
    | 'rest'
    | 'laminate'
    | 'proof'
    | 'bake'
    | 'cool'
    | 'fill'
    | 'decorate'
    | 'pack'
    | 'display'
    | 'ready'
    | 'cancelled';
  planned_for_date: string;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  timer_minutes: number | null;
  batch_notes: string | null;
  assigned_to_id: number | null;
}

export function useKitchenMutations({
  fetchTabData,
  addToast,
}: {
  fetchTabData: () => Promise<void>;
  addToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}) {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleAdvanceStage = useCallback(
    async (batchId: string, newStage: KitchenBatch['stage']) => {
      setIsUpdating(true);
      try {
        await api.put(`/api/kitchen/batches/${batchId}/stage`, { stage: newStage });
        addToast(`Batch moved to ${newStage}`, 'success');
        await fetchTabData(); // Refresh board and inventory
      } catch (err: any) {
        console.error(err);
        addToast(err.response?.data?.detail || 'Failed to update stage', 'error');
      } finally {
        setIsUpdating(false);
      }
    },
    [fetchTabData, addToast]
  );

  return {
    handleAdvanceStage,
    isUpdating,
  };
}
