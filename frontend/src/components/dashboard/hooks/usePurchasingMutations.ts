/**
 * usePurchasingMutations — async handlers for suppliers and purchase orders.
 */
import { api } from '../../../lib/api';
import type { MutationDeps } from '../types';
import { useMutation } from '../../../hooks/useMutation';

export function usePurchasingMutations({ fetchData, addToast }: MutationDeps) {
  const { execute: handleAddSupplier } = useMutation(
    async (supplierData: Record<string, unknown>) => api.post('/suppliers', supplierData),
    { refetch: fetchData, addToast, successMessage: 'Supplier added', errorMessage: 'Failed to add supplier' }
  );

  const { execute: handleDeleteSupplier } = useMutation(
    async (id: number) => api.delete(`/suppliers/${id}`),
    { refetch: fetchData, addToast, successMessage: 'Supplier deleted', errorMessage: 'Failed to delete supplier' }
  );

  const { execute: handleCreatePO } = useMutation(
    async (data: { supplier_id: number; items: unknown[] }) => api.post('/purchase-orders', data),
    { refetch: fetchData, addToast, successMessage: 'Purchase order created', errorMessage: 'Failed to create PO' }
  );

  const { execute: handleReceivePO } = useMutation(
    async (id: string, payload?: { items?: unknown[] }) => api.post(`/purchase-orders/${id}/receive`, payload ?? {}),
    { refetch: fetchData, addToast, successMessage: 'PO received', errorMessage: 'Failed to receive PO' }
  );

  const { execute: handleDeletePO } = useMutation(
    async (id: string) => api.delete(`/purchase-orders/${id}`),
    { refetch: fetchData, addToast, successMessage: 'PO deleted', errorMessage: 'Failed to delete PO' }
  );

  return { handleAddSupplier, handleDeleteSupplier, handleCreatePO, handleReceivePO, handleDeletePO };
}
