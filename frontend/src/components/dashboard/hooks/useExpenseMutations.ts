/**
 * useExpenseMutations — async handlers for expense and shift-close operations.
 */
import { useCallback } from 'react';
import { api } from '../../../lib/api';
import type { MutationDeps } from '../types';

export function useExpenseMutations({ fetchData, addToast }: MutationDeps) {
  const handleAddExpense = useCallback(
    async (expenseData: Record<string, unknown>) => {
      try {
        await api.post('/expenses', expenseData);
        fetchData();
        addToast('Expense added', 'success');
      } catch {
        addToast('Failed to add expense', 'error');
      }
    },
    [fetchData, addToast]
  );

  const handleUpdateExpense = useCallback(
    async (id: number, expenseData: Record<string, unknown>) => {
      try {
        await api.put(`/expenses/${id}`, expenseData);
        fetchData();
        addToast('Expense updated', 'success');
      } catch {
        addToast('Failed to update expense', 'error');
      }
    },
    [fetchData, addToast]
  );

  const handleDeleteExpense = useCallback(
    async (id: number) => {
      try {
        await api.delete(`/expenses/${id}`);
        fetchData();
        addToast('Expense deleted', 'success');
      } catch {
        addToast('Failed to delete expense', 'error');
      }
    },
    [fetchData, addToast]
  );

  return { handleAddExpense, handleUpdateExpense, handleDeleteExpense };
}
