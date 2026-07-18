import { useMutation } from './useMutation';
import { useDashboard } from '../components/dashboard/DashboardContext';

export function useSettingsMutations() {
  const { api, fetchData, addToast } = useDashboard();

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
