/**
 * usePlannerMutations — async handlers for production planning and kitchen operations.
 */
import { api } from '../../../lib/api';
import type { MutationDeps } from '../types';
import { useMutation } from '../../../hooks/useMutation';

export function usePlannerMutations({ fetchData, addToast }: MutationDeps) {
  const { execute: handleProduce } = useMutation(
    async (productId: string, qty: number) => api.post('/produce', { product_id: productId, quantity: qty }),
    { refetch: fetchData, addToast, successMessage: (res: any, productId: string, qty: number) => `Produced ${qty} units`, errorMessage: (err: any) => err instanceof Error ? err.message : (err?.response?.data?.detail || 'Production failed') }
  );

  const { execute: handlePlanBatch } = useMutation(
    async (productId: string, qty: number, date: string) => api.post('/planner', { product_id: productId, quantity: qty, date }),
    { refetch: fetchData, addToast, successMessage: 'Batch planned', errorMessage: 'Failed to plan batch' }
  );

  const { execute: handleCompletePlan } = useMutation(
    async (planId: string) => api.patch(`/planner/${planId}/complete`, {}),
    { refetch: fetchData, addToast, errorMessage: 'Failed to complete plan' }
  );

  return { handleProduce, handlePlanBatch, handleCompletePlan };
}
