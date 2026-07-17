/**
 * useProductMutations — async handlers for catalog/product operations.
 */
import { api } from '../../../lib/api';
import type { MutationDeps } from '../types';
import { useMutation } from '../../../hooks/useMutation';

export function useProductMutations({ fetchData, addToast }: MutationDeps) {
  const { execute: handleAddProduct } = useMutation(
    async (productData: Record<string, unknown>) => api.post('/products', productData),
    { refetch: fetchData, addToast, successMessage: 'Product added', errorMessage: 'Failed to add product' }
  );

  const { execute: handleDeleteProduct } = useMutation(
    async (id: string) => api.delete(`/products/${id}`),
    { refetch: fetchData, addToast, successMessage: 'Product deleted', errorMessage: 'Failed to delete product' }
  );

  const { execute: handleDuplicateProduct } = useMutation(
    async (id: string) => {
      const res = await api.post(`/products/${id}/duplicate`, {});
      if (!res.data.success) throw new Error('Duplicate failed');
      return res;
    },
    { refetch: fetchData, addToast, successMessage: 'Recipe duplicated successfully', errorMessage: 'Failed to duplicate recipe' }
  );

  const { execute: handleUpdateProductPrice } = useMutation(
    async (productId: string, newPrice: number) => api.put(`/products/${productId}`, { price: newPrice }),
    { refetch: fetchData, addToast, errorMessage: 'Failed to update price' }
  );

  const { execute: handleUpdateProductField } = useMutation(
    async (productId: string, field: string, value: unknown) => api.put(`/products/${productId}`, { [field]: value }),
    { refetch: fetchData, addToast, errorMessage: 'Failed to update product' }
  );

  const { execute: handleUpdateProductIngredients } = useMutation(
    async (productId: string, ingredients: unknown[]) => api.put(`/products/${productId}`, { ingredients }),
    { refetch: fetchData, addToast, errorMessage: 'Failed to update ingredients' }
  );

  const { execute: handleCleanupProducts } = useMutation(
    async () => api.post('/maintenance/cleanup-products', {}),
    { refetch: fetchData, addToast, successMessage: 'Cleanup complete', errorMessage: 'Cleanup failed' }
  );

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
