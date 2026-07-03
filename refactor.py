import re
import sys

def main():
    file_path = 'frontend/src/components/Dashboard.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # We want to remove the specific handlers.
    # To do this safely, we will find the start of the handler, and count braces to find the end.
    handlers_to_remove = [
        'handleAddStaff', 'handleAddSupplier', 'handleDeleteSupplier', 'handleSaveGeneralNote',
        'handleDeleteShiftLog', 'handleDeleteStaff', 'handleProduce', 'handleAddMaterial',
        'handleAddExpense', 'handleUpdateExpense', 'handleDeleteExpense', 'handleAdjustStock',
        'handleDeleteMaterial', 'handleAddProduct', 'handleDeleteProduct', 'handleCleanupProducts',
        'handleUpdateProductIngredients', 'handleUpdateProductPrice', 'handleUpdateProductField',
        'handleCreatePO', 'handleReceivePO', 'handleDeletePO', 'handlePlanBatch', 'handleCompletePlan'
    ]

    new_content = content
    for handler in handlers_to_remove:
        # Regex to find: const handleName = async (...) => {
        pattern = re.compile(r'^[ \t]*const\s+' + handler + r'\s*=\s*(?:async\s*)?(?:\([^)]*\)|[^=]*)\s*=>\s*\{', re.MULTILINE)
        match = pattern.search(new_content)
        if not match:
            print(f"Could not find {handler}")
            continue
        
        start_index = match.start()
        # Find the matching closing brace
        brace_count = 0
        end_index = -1
        in_string = False
        string_char = ''
        for i in range(match.end() - 1, len(new_content)):
            char = new_content[i]
            
            # Very basic string handling (ignores escaped quotes, but usually fine for this code)
            if char in ("'", '"', '`'):
                if not in_string:
                    in_string = True
                    string_char = char
                elif string_char == char and new_content[i-1] != '\\':
                    in_string = False
                    
            if not in_string:
                if char == '{':
                    brace_count += 1
                elif char == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        # Find the semicolon if it exists
                        end_index = i + 1
                        while end_index < len(new_content) and new_content[end_index] in (' ', '\t', '\n', ';'):
                            if new_content[end_index] == '\n':
                                end_index += 1
                                break
                            end_index += 1
                        break
        
        if end_index != -1:
            new_content = new_content[:start_index] + new_content[end_index:]
        else:
            print(f"Could not find end of {handler}")

    # Now we need to insert the hook imports and usages.
    # Find where to put the imports:
    import_index = new_content.find("import { DashboardSharedProps }")
    imports_to_add = """import {
  useInventoryMutations,
  useProductMutations,
  useExpenseMutations,
  usePurchasingMutations,
  useStaffMutations,
  usePlannerMutations,
} from './dashboard/hooks';\n"""
    new_content = new_content[:import_index] + imports_to_add + new_content[import_index:]

    # Find where to put the hook initializations. 
    # Let's put them right after: const { t, i18n } = useTranslation();
    hook_index = new_content.find("const { t, i18n } = useTranslation();")
    if hook_index != -1:
        hook_index = new_content.find('\n', hook_index) + 1
        hooks_to_add = """
  const mutationDeps = { fetchData, addToast, showConfirm };

  const { handleAdjustStock, handleAddMaterial, handleDeleteMaterial } =
    useInventoryMutations(mutationDeps);

  const {
    handleAddProduct, handleDeleteProduct, handleUpdateProductPrice,
    handleUpdateProductField, handleUpdateProductIngredients, handleCleanupProducts,
  } = useProductMutations(mutationDeps);

  const { handleAddExpense, handleUpdateExpense, handleDeleteExpense } =
    useExpenseMutations(mutationDeps);

  const {
    handleAddSupplier, handleDeleteSupplier, handleCreatePO,
    handleReceivePO, handleDeletePO,
  } = usePurchasingMutations(mutationDeps);

  const { handleAddStaff, handleDeleteStaff, handleDeleteShiftLog, handleSaveGeneralNote } =
    useStaffMutations(mutationDeps);

  const { handleProduce, handlePlanBatch, handleCompletePlan } =
    usePlannerMutations(mutationDeps);
"""
        new_content = new_content[:hook_index] + hooks_to_add + new_content[hook_index:]

    with open(file_path, 'w') as f:
        f.write(new_content)
    print("Done refactoring handlers.")

if __name__ == '__main__':
    main()
