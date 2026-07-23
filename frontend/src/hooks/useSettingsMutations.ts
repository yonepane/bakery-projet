import { useMutation } from './useMutation';
import { useServerDataSelector, useNotificationSelector } from '../components/dashboard/DashboardContext';
import { useCart } from '../components/dashboard/CartContext';

export function useSettingsMutations() {
  const { api } = useCart();
  const { fetchData } = useServerDataSelector();
  const { addToast } = useNotificationSelector();

  const saveSettings = useMutation(
    async (payload: any) => {
      await api.put('/settings', payload);
    },
    {
      onSuccess: () => {
        fetchData();
      },
      successMessage: 'Settings saved',
      errorMessage: 'Failed to save settings',
      addToast,
    }
  );

  return {
    saveSettings,
  };
}
