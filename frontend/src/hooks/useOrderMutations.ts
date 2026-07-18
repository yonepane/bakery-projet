import { useMutation } from './useMutation';
import { useDashboard } from '../components/dashboard/DashboardContext';

export function useOrderMutations() {
  const { api, fetchData, addToast } = useDashboard();

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
