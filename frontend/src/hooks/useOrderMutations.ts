import { useMutation } from './useMutation';
import { useServerDataSelector, useNotificationSelector } from '../components/dashboard/DashboardContext';
import { useCart } from '../components/dashboard/CartContext';

export function useOrderMutations() {
  const { api } = useCart();
  const { fetchData } = useServerDataSelector();
  const { addToast } = useNotificationSelector();

  const updateOrderStatus = useMutation(
    async ({ orderId, status }: { orderId: string; status: string }) => {
      await api.patch(`/orders/${orderId}/status?status=${status}`, null);
      return status;
    },
    {
      onSuccess: () => {
        fetchData();
      },
      successMessage: (status) => `Order ${status.toUpperCase()}`,
      errorMessage: 'Failed to update order status',
      addToast,
    }
  );

  return {
    updateOrderStatus,
  };
}
