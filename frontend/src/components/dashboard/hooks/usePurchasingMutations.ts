/**
 * usePurchasingMutations — async handlers for suppliers and purchase orders.
 */
import { useCallback } from 'react';
import { api } from '../../../lib/api';
import type { MutationDeps } from '../types';

export function usePurchasingMutations({ fetchData, addToast }: MutationDeps) {
  const handleAddSupplier = useCallback(
    async (supplierData: Record<string, unknown>) => {
      try {
        await api.post('/suppliers', supplierData);
        fetchData();
        addToast('Supplier added', 'success');
      } catch {
        addToast('Failed to add supplier', 'error');
      }
    },
    [fetchData, addToast]
  );

  const handleDeleteSupplier = useCallback(
    async (id: number) => {
      try {
        await api.delete(`/suppliers/${id}`);
        fetchData();
        addToast('Supplier deleted', 'success');
      } catch {
        addToast('Failed to delete supplier', 'error');
      }
    },
    [fetchData, addToast]
  );

  const handleCreatePO = useCallback(
    async (data: { supplier_id: number; items: unknown[] }) => {
      try {
        await api.post('/purchase-orders', data);
        fetchData();
        addToast('Purchase order created', 'success');
      } catch {
        addToast('Failed to create PO', 'error');
      }
    },
    [fetchData, addToast]
  );

  const handleReceivePO = useCallback(
    async (id: string, payload?: { items: unknown[] }) => {
      try {
        await api.post(`/purchase-orders/${id}/receive`, payload ?? {});
        fetchData();
        addToast('PO received', 'success');
      } catch {
        addToast('Failed to receive PO', 'error');
      }
    },
    [fetchData, addToast]
  );

  const handleDeletePO = useCallback(
    async (id: string) => {
      try {
        await api.delete(`/purchase-orders/${id}`);
        fetchData();
        addToast('PO deleted', 'success');
      } catch {
        addToast('Failed to delete PO', 'error');
      }
    },
    [fetchData, addToast]
  );

  return { handleAddSupplier, handleDeleteSupplier, handleCreatePO, handleReceivePO, handleDeletePO };
}
