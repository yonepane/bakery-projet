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

  const { execute: handleProduce } = useMutation(
    async (productId: string, qty: number) => api.post('/produce', { product_id: productId, quantity: qty }),
    { refetch: fetchData, addToast, successMessage: (res: any, productId: string, qty: number) => `Produced ${qty} units`, errorMessage: (err: any) => err instanceof Error ? err.message : (err?.response?.data?.detail || 'Production failed') }
  );

  const { execute: handleCompletePlan } = useMutation(
    async (planId: string) => api.patch(`/planner/${planId}/complete`, {}),
    { refetch: fetchData, addToast, errorMessage: 'Failed to complete plan' }
  );

  return {
    savePlan,
    handleProduce,
    handleCompletePlan,
  };
}
