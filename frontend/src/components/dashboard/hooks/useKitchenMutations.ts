import { useState, useCallback } from 'react';
import { api } from '../../../lib/api';
import type { MutationDeps } from '../types';

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

import { useMutation } from '../../../hooks/useMutation';

export function useKitchenMutations(deps: MutationDeps & { fetchTabData?: (tab: string) => Promise<void> }) {
  const { fetchData, addToast, fetchTabData } = deps;

  const { execute: handleAdvanceStage, isLoading: isUpdating } = useMutation(
    async (batchId: string, newStage: KitchenBatch['stage']) => api.put(`/api/kitchen/batches/${batchId}/stage`, { stage: newStage }),
    { 
      refetch: () => fetchTabData ? fetchTabData('kitchen_board') : fetchData(), 
      addToast, 
      successMessage: (res: any, batchId: string, newStage: string) => `Batch moved to ${newStage}`, 
      errorMessage: (err: any) => err.response?.data?.detail || 'Failed to update stage' 
    }
  );

  return {
    handleAdvanceStage,
    isUpdating,
  };
}
