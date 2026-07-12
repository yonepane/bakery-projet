with open("frontend/src/components/Dashboard.tsx", "r") as f:
    lines = f.readlines()

def replace_in_line(line_num, old, new):
    idx = line_num - 1
    if idx < len(lines):
        lines[idx] = lines[idx].replace(old, new)

replace_in_line(558, "onSuccess={async (response) =>", "onSuccess={async (response: any) =>")
replace_in_line(657, "onSuccess={async (response) =>", "onSuccess={async (response: any) =>")
replace_in_line(841, "onSuccess={async (response) =>", "onSuccess={async (response: any) =>")

replace_in_line(1581, 'mode="sync"', 'mode="wait"')

replace_in_line(1870, 'newProduct.instructions.map((step: string, i: number)', '(newProduct.instructions || []).map((step: string, i: number)')
replace_in_line(1870, 'newProduct.instructions.map((step: any, i: any)', '(newProduct.instructions || []).map((step: any, i: any)')
replace_in_line(1870, 'newProduct.instructions.filter((_:any,idx:any)=>idx!==i)', '(newProduct.instructions || []).filter((_:any,idx:any)=>idx!==i)')
replace_in_line(1873, '[...newProduct.instructions, ""]', '[...(newProduct.instructions || []), ""]')

replace_in_line(1927, 'onClick={handleAddExpense}', 'onClick={() => editingExpense ? (handleAddExpense as any)(editingExpense.id, newExpense) : (handleAddExpense as any)(newExpense)}')

replace_in_line(2075, 'Object.entries(simPrices).map(([id, price])', 'Object.entries(simPrices).map(([id, price]: [string, any])')
replace_in_line(2076, 'Object.entries(simulatedInflations).map(([name, infl])', 'Object.entries(simulatedInflations).map(([name, infl]: [string, any])')
replace_in_line(2078, 'Object.keys(productProfitability).map((prod)', 'Object.keys(productProfitability).map((prod: string)')
replace_in_line(2079, 'Object.keys(productProfitability).map((prod)', 'Object.keys(productProfitability).map((prod: string)')

with open("frontend/src/components/Dashboard.tsx", "w") as f:
    f.writelines(lines)
