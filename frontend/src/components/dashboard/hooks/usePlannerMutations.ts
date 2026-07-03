/**
 * usePlannerMutations — async handlers for production planning and kitchen operations.
 */
import { useCallback } from 'react';
import { api } from '../../../lib/api';
import type { MutationDeps } from '../types';

export function usePlannerMutations({ fetchData, addToast }: MutationDeps) {
  const handleProduce = useCallback(
    async (productId: string, qty: number) => {
      try {
        await api.post('/produce', { product_id: productId, quantity: qty });
        fetchData();
        addToast(`Produced ${qty} units`, 'success');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Production failed';
        addToast(msg, 'error');
      }
    },
    [fetchData, addToast]
  );

  const handlePlanBatch = useCallback(
    async (productId: string, qty: number, date: string) => {
      try {
        await api.post('/planner', { product_id: productId, quantity: qty, date });
        fetchData();
        addToast('Batch planned', 'success');
      } catch {
        addToast('Failed to plan batch', 'error');
      }
    },
    [fetchData, addToast]
  );

  const handleCompletePlan = useCallback(
    async (planId: string) => {
      try {
        await api.patch(`/planner/${planId}/complete`, {});
        fetchData();
      } catch {
        addToast('Failed to complete plan', 'error');
      }
    },
    [fetchData, addToast]
  );

  return { handleProduce, handlePlanBatch, handleCompletePlan };
}
