/**
 * useExpenseMutations — async handlers for expense and shift-close operations.
 */
import { api } from '../../../lib/api';
import type { MutationDeps } from '../types';
import { useMutation } from '../../../hooks/useMutation';

export function useExpenseMutations({ fetchData, addToast }: MutationDeps) {
  const { execute: handleAddExpense } = useMutation(
    async (expenseData: Record<string, unknown>) => api.post('/expenses', expenseData),
    { refetch: fetchData, addToast, successMessage: 'Expense added', errorMessage: 'Failed to add expense' }
  );

  const { execute: handleUpdateExpense } = useMutation(
    async (id: number, expenseData: Record<string, unknown>) => api.put(`/expenses/${id}`, expenseData),
    { refetch: fetchData, addToast, successMessage: 'Expense updated', errorMessage: 'Failed to update expense' }
  );

  const { execute: handleDeleteExpense } = useMutation(
    async (id: number) => api.delete(`/expenses/${id}`),
    { refetch: fetchData, addToast, successMessage: 'Expense deleted', errorMessage: 'Failed to delete expense' }
  );

  return { handleAddExpense, handleUpdateExpense, handleDeleteExpense };
}
