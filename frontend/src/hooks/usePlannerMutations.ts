import { useMutation } from './useMutation';
import { useDashboard } from '../components/dashboard/DashboardContext';
import { useTranslation } from 'react-i18next';

export function usePlannerMutations() {
  const { api, fetchData, addToast } = useDashboard();
  const { t } = useTranslation();

  const savePlan = useMutation(
    async (planner: any) => {
      await api.post('/planner', planner);
    },
    {
      onSuccess: () => {
        fetchData();
      },
      successMessage: () => t('plan_saved_to_cloud') || 'Plan saved to cloud',
      errorMessage: () => t('failed_to_save_plan') || 'Failed to save plan',
      addToast,
    }
  );

  return {
    savePlan,
  };
}
