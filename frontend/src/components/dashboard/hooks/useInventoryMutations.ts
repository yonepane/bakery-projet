/**
 * useInventoryMutations — async handlers for raw material operations.
 * Extracted from Dashboard.tsx to keep Dashboard focused on layout.
 */
import { useCallback } from 'react';
import { api } from '../../../lib/api';
import type { MutationDeps } from '../types';

export function useInventoryMutations({ fetchData, addToast }: MutationDeps) {
  const handleAdjustStock = useCallback(
    async (item_type: 'product' | 'material', id: string, amount: number) => {
      try {
        await api.post('/inventory/adjust', { item_type, id, amount });
        fetchData();
      } catch {
        addToast('Failed to adjust stock', 'error');
      }
    },
    [fetchData, addToast]
  );

  const handleAddMaterial = useCallback(
    async (name: string, unit: string, price: number, min_threshold: number) => {
      try {
        await api.post('/materials', { name, unit, price, min_threshold });
        fetchData();
        addToast('Material added', 'success');
      } catch {
        addToast('Failed to add material', 'error');
      }
    },
    [fetchData, addToast]
  );

  const handleDeleteMaterial = useCallback(
    async (name: string) => {
      try {
        await api.delete(`/materials/${encodeURIComponent(name)}`);
        fetchData();
        addToast('Material deleted', 'success');
      } catch {
        addToast('Failed to delete material', 'error');
      }
    },
    [fetchData, addToast]
  );

  const handleTransferStock = useCallback(
    async (payload: { item_type: string; item_id: string; from_location_id: number; to_location_id: number; quantity: number; lot_id?: number | null }) => {
      try {
        await api.post('/stock-locations/transfer', payload);
        fetchData();
        addToast('Stock transferred successfully', 'success');
      } catch (e: any) {
        addToast(e.response?.data?.detail || 'Failed to transfer stock', 'error');
      }
    },
    [fetchData, addToast]
  );

  return { handleAdjustStock, handleAddMaterial, handleDeleteMaterial, handleTransferStock };
}
