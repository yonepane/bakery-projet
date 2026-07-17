/**
 * useInventoryMutations — async handlers for raw material operations.
 * Extracted from Dashboard.tsx to keep Dashboard focused on layout.
 */
import { api } from '../../../lib/api';
import type { MutationDeps } from '../types';
import { useMutation } from '../../../hooks/useMutation';

export function useInventoryMutations({ fetchData, addToast }: MutationDeps) {
  const { execute: handleAdjustStock } = useMutation(
    async (item_type: 'product' | 'material', id: string, amount: number) => api.post('/inventory/adjust', { item_type, id, amount }),
    { refetch: fetchData, addToast, errorMessage: 'Failed to adjust stock' }
  );

  const { execute: handleAddMaterial } = useMutation(
    async (name: string, unit: string, price: number, min_threshold: number) => api.post('/materials', { name, unit, price, min_threshold }),
    { refetch: fetchData, addToast, successMessage: 'Material added', errorMessage: 'Failed to add material' }
  );

  const { execute: handleDeleteMaterial } = useMutation(
    async (name: string) => api.delete(`/materials/${encodeURIComponent(name)}`),
    { refetch: fetchData, addToast, successMessage: 'Material deleted', errorMessage: 'Failed to delete material' }
  );

  const { execute: handleTransferStock } = useMutation(
    async (payload: { item_type: string; item_id: string; from_location_id: number; to_location_id: number; quantity: number; lot_id?: number | null }) => api.post('/stock-locations/transfer', payload),
    { refetch: fetchData, addToast, successMessage: 'Stock transferred successfully', errorMessage: (e: any) => e.response?.data?.detail || 'Failed to transfer stock' }
  );

  return { handleAdjustStock, handleAddMaterial, handleDeleteMaterial, handleTransferStock };
}
