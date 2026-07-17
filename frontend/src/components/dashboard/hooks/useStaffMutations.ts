/**
 * useStaffMutations — async handlers for staff and shift log operations.
 */
import { api } from '../../../lib/api';
import type { MutationDeps } from '../types';
import { useMutation } from '../../../hooks/useMutation';

export function useStaffMutations({ fetchData, addToast }: MutationDeps) {
  const { execute: handleAddStaff } = useMutation(
    async (staffData: Record<string, unknown>) => api.post('/staff', staffData),
    { refetch: fetchData, addToast, successMessage: 'Staff member added', errorMessage: 'Failed to add staff' }
  );

  const { execute: handleDeleteStaff } = useMutation(
    async (username: string) => api.delete(`/staff/${encodeURIComponent(username)}`),
    { refetch: fetchData, addToast, successMessage: 'Staff member removed', errorMessage: 'Failed to delete staff' }
  );

  const { execute: handleDeleteShiftLog } = useMutation(
    async (id: number) => api.delete(`/shift-logs/${id}`),
    { refetch: fetchData, addToast, errorMessage: 'Failed to delete log' }
  );

  const { execute: handleSaveGeneralNote } = useMutation(
    async (content: string) => api.post('/shift-logs', { content }),
    { refetch: fetchData, addToast, successMessage: 'Note saved', errorMessage: 'Failed to save note' }
  );

  return { handleAddStaff, handleDeleteStaff, handleDeleteShiftLog, handleSaveGeneralNote };
}
