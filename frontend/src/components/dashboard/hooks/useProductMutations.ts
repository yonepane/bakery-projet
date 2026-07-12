/**
 * useProductMutations — async handlers for catalog/product operations.
 */
import { useCallback } from 'react';
import { api } from '../../../lib/api';
import type { MutationDeps } from '../types';

export function useProductMutations({ fetchData, addToast }: MutationDeps) {
  const handleAddProduct = useCallback(
    async (productData: Record<string, unknown>) => {
      try {
        await api.post('/products', productData);
        fetchData();
        addToast('Product added', 'success');
      } catch {
        addToast('Failed to add product', 'error');
      }
    },
    [fetchData, addToast]
  );

  const handleDeleteProduct = useCallback(
    async (id: string) => {
      try {
        await api.delete(`/products/${id}`);
        fetchData();
        addToast('Product deleted', 'success');
      } catch {
        addToast('Failed to delete product', 'error');
      }
    },
    [fetchData, addToast]
  );

  const handleDuplicateProduct = useCallback(
    async (id: string) => {
      try {
        const res = await api.post(`/products/${id}/duplicate`, {});
        if (res.data.success) {
          addToast('Recipe duplicated successfully', 'success');
          fetchData();
        }
      } catch {
        addToast('Failed to duplicate recipe', 'error');
      }
    },
    [fetchData, addToast]
  );

  const handleUpdateProductPrice = useCallback(
    async (productId: string, newPrice: number) => {
      try {
        await api.put(`/products/${productId}`, { price: newPrice });
        fetchData();
      } catch {
        addToast('Failed to update price', 'error');
      }
    },
    [fetchData, addToast]
  );

  const handleUpdateProductField = useCallback(
    async (productId: string, field: string, value: unknown) => {
      try {
        await api.put(`/products/${productId}`, { [field]: value });
        fetchData();
      } catch {
        addToast('Failed to update product', 'error');
      }
    },
    [fetchData, addToast]
  );

  const handleUpdateProductIngredients = useCallback(
    async (productId: string, ingredients: unknown[]) => {
      try {
        await api.put(`/products/${productId}`, { ingredients });
        fetchData();
      } catch {
        addToast('Failed to update ingredients', 'error');
      }
    },
    [fetchData, addToast]
  );

  const handleCleanupProducts = useCallback(async () => {
    try {
      await api.post('/maintenance/cleanup-products', {});
      fetchData();
      addToast('Cleanup complete', 'success');
    } catch {
      addToast('Cleanup failed', 'error');
    }
  }, [fetchData, addToast]);

  return {
    handleAddProduct,
    handleDeleteProduct,
    handleDuplicateProduct,
    handleUpdateProductPrice,
    handleUpdateProductField,
    handleUpdateProductIngredients,
    handleCleanupProducts,
  };
}
