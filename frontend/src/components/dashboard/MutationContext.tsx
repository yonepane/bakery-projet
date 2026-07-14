/**
 * MutationContext — All mutation handlers extracted from Dashboard.tsx.
 * Pure functions that depend on (fetchTabData, addToast, showConfirm) deps.
 */

import React, { createContext, useContext } from 'react';
import { useInventoryMutations } from './hooks/useInventoryMutations';
import { useProductMutations } from './hooks/useProductMutations';
import { useExpenseMutations } from './hooks/useExpenseMutations';
import { usePurchasingMutations } from './hooks/usePurchasingMutations';
import { useStaffMutations } from './hooks/useStaffMutations';
import { usePlannerMutations } from './hooks/usePlannerMutations';
import { useSemiFinishedMutations } from './hooks/useSemiFinishedMutations';
import { useKitchenMutations } from './hooks/useKitchenMutations';
import { useTabFetcher } from './TabFetcherContext';
import { useNotification } from './NotificationContext';
import type { MutationDeps } from './types';

interface MutationContextValue {
  handleAdjustStock: ReturnType<typeof useInventoryMutations>['handleAdjustStock'];
  handleAddMaterial: ReturnType<typeof useInventoryMutations>['handleAddMaterial'];
  handleDeleteMaterial: ReturnType<typeof useInventoryMutations>['handleDeleteMaterial'];
  handleTransferStock: ReturnType<typeof useInventoryMutations>['handleTransferStock'];
  handleAddProduct: ReturnType<typeof useProductMutations>['handleAddProduct'];
  handleDeleteProduct: ReturnType<typeof useProductMutations>['handleDeleteProduct'];
  handleDuplicateProduct: ReturnType<typeof useProductMutations>['handleDuplicateProduct'];
  handleUpdateProductPrice: ReturnType<typeof useProductMutations>['handleUpdateProductPrice'];
  handleUpdateProductField: ReturnType<typeof useProductMutations>['handleUpdateProductField'];
  handleUpdateProductIngredients: ReturnType<typeof useProductMutations>['handleUpdateProductIngredients'];
  handleCleanupProducts: ReturnType<typeof useProductMutations>['handleCleanupProducts'];
  handleAddExpense: ReturnType<typeof useExpenseMutations>['handleAddExpense'];
  handleUpdateExpense: ReturnType<typeof useExpenseMutations>['handleUpdateExpense'];
  handleDeleteExpense: ReturnType<typeof useExpenseMutations>['handleDeleteExpense'];
  handleAddSupplier: ReturnType<typeof usePurchasingMutations>['handleAddSupplier'];
  handleDeleteSupplier: ReturnType<typeof usePurchasingMutations>['handleDeleteSupplier'];
  handleCreatePO: ReturnType<typeof usePurchasingMutations>['handleCreatePO'];
  handleReceivePO: ReturnType<typeof usePurchasingMutations>['handleReceivePO'];
  handleDeletePO: ReturnType<typeof usePurchasingMutations>['handleDeletePO'];
  handleAddStaff: ReturnType<typeof useStaffMutations>['handleAddStaff'];
  handleDeleteStaff: ReturnType<typeof useStaffMutations>['handleDeleteStaff'];
  handleDeleteShiftLog: ReturnType<typeof useStaffMutations>['handleDeleteShiftLog'];
  handleSaveGeneralNote: ReturnType<typeof useStaffMutations>['handleSaveGeneralNote'];
  handleProduce: ReturnType<typeof usePlannerMutations>['handleProduce'];
  handlePlanBatch: ReturnType<typeof usePlannerMutations>['handlePlanBatch'];
  handleCompletePlan: ReturnType<typeof usePlannerMutations>['handleCompletePlan'];
  handleSaveRecipe: ReturnType<typeof useSemiFinishedMutations>['handleSaveRecipe'];
  handleProduceBatch: ReturnType<typeof useSemiFinishedMutations>['handleProduceBatch'];
  handleCreateSemiFinished: ReturnType<typeof useSemiFinishedMutations>['handleCreateSemiFinished'];
  handleAdvanceStage: ReturnType<typeof useKitchenMutations>['handleAdvanceStage'];
  isKitchenUpdating: boolean;
}

const MutationContext = createContext<MutationContextValue | null>(null);

export const useMutation = (): MutationContextValue => {
  const ctx = useContext(MutationContext);
  if (!ctx) throw new Error('useMutation must be used inside <MutationProvider>');
  return ctx;
};

interface MutationProviderProps {
  children: React.ReactNode;
}

export const MutationProvider: React.FC<MutationProviderProps> = ({ children }) => {
  const { fetchData, fetchTabData } = useTabFetcher();
  const { addToast, showConfirm } = useNotification();

  const baseDeps = { fetchData, addToast, showConfirm };
  const semiFinishedDeps = { fetchData, fetchTabData, addToast, showConfirm };
  const kitchenDeps = { fetchData, fetchTabData, addToast, showConfirm };

  const inventoryMutations = useInventoryMutations(baseDeps);
  const productMutations = useProductMutations(baseDeps);
  const expenseMutations = useExpenseMutations(baseDeps);
  const purchasingMutations = usePurchasingMutations(baseDeps);
  const staffMutations = useStaffMutations(baseDeps);
  const plannerMutations = usePlannerMutations(baseDeps);
  const sfMutations = useSemiFinishedMutations(semiFinishedDeps);
  const kitchenMutations = useKitchenMutations(kitchenDeps);

  return (
    <MutationContext.Provider value={{
      ...inventoryMutations,
      ...productMutations,
      ...expenseMutations,
      ...purchasingMutations,
      ...staffMutations,
      ...plannerMutations,
      handleSaveRecipe: () => Promise.resolve(),
      handleProduceBatch: () => Promise.resolve(),
      handleCreateSemiFinished: () => Promise.resolve(),
      handleAdvanceStage: () => Promise.resolve(),
      isKitchenUpdating: false,
    }}>
    {children}
    </MutationContext.Provider>
  );
};