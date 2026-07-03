/**
 * useStaffMutations — async handlers for staff and shift log operations.
 */
import { useCallback } from 'react';
import { api } from '../../../lib/api';
import type { MutationDeps } from '../types';

export function useStaffMutations({ fetchData, addToast }: MutationDeps) {
  const handleAddStaff = useCallback(
    async (staffData: Record<string, unknown>) => {
      try {
        await api.post('/staff', staffData);
        fetchData();
        addToast('Staff member added', 'success');
      } catch {
        addToast('Failed to add staff', 'error');
      }
    },
    [fetchData, addToast]
  );

  const handleDeleteStaff = useCallback(
    async (username: string) => {
      try {
        await api.delete(`/staff/${encodeURIComponent(username)}`);
        fetchData();
        addToast('Staff member removed', 'success');
      } catch {
        addToast('Failed to delete staff', 'error');
      }
    },
    [fetchData, addToast]
  );

  const handleDeleteShiftLog = useCallback(
    async (id: number) => {
      try {
        await api.delete(`/shift-logs/${id}`);
        fetchData();
      } catch {
        addToast('Failed to delete log', 'error');
      }
    },
    [fetchData, addToast]
  );

  const handleSaveGeneralNote = useCallback(
    async (content: string) => {
      try {
        await api.post('/shift-logs', { content });
        fetchData();
        addToast('Note saved', 'success');
      } catch {
        addToast('Failed to save note', 'error');
      }
    },
    [fetchData, addToast]
  );

  return { handleAddStaff, handleDeleteStaff, handleDeleteShiftLog, handleSaveGeneralNote };
}
