import { useMutation } from './useMutation';
import { useDashboard } from '../components/dashboard/DashboardContext';

export function useCustomerMutations() {
  const { api, fetchData, addToast } = useDashboard();

  const saveCustomer = useMutation(
    async ({
      editingCustomer,
      formData,
    }: {
      editingCustomer: any;
      formData: { name: string; email: string; phone: string };
    }) => {
      if (editingCustomer) {
        await api.patch(`/customers/${editingCustomer.id}`, formData);
      } else {
        await api.post('/customers', formData);
      }
    },
    {
      onSuccess: () => {
        fetchData();
      },
      successMessage: 'Member saved successfully!',
      errorMessage: 'Failed to save member',
      addToast,
    }
  );

  const deleteCustomer = useMutation(
    async (customerId: string) => {
      await api.delete(`/customers/${customerId}`);
    },
    {
      onSuccess: () => {
        fetchData();
      },
      successMessage: 'Member removed',
      errorMessage: 'Failed to remove member',
      addToast,
    }
  );

  return {
    saveCustomer,
    deleteCustomer,
  };
}
