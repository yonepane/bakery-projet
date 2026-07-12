import re

with open("frontend/src/components/Dashboard.tsx", "r") as f:
    content = f.read()

# Fix Google login onSuccess type
content = re.sub(r'onSuccess=\{async \(response\) =>', r'onSuccess={async (response: any) =>', content)
content = re.sub(r'onSuccess=\{\(response\) =>', r'onSuccess={(response: any) =>', content)

# Fix displayUnit (v, u) implicitly any
content = re.sub(r'displayUnit: \(v, u\) => `\$\{v\}\$\{u\}`', r'displayUnit: (v: any, u: any) => `${v}${u}`', content)

# Fix AnimatePresence mode
content = re.sub(r'mode="sync"', r'mode="wait"', content)

# Fix handleAddExpense
# The error says Type '((expenseData: Record<string, unknown>) => Promise<void>) | ((id: number, expenseData: Record<string, unknown>) => Promise<void>)' is not assignable to type 'MouseEventHandler...
content = re.sub(
    r'onClick=\{\(\) => editingExpense \? handleAddExpense\(editingExpense\.id, newExpense\) : handleAddExpense\(newExpense\)\}',
    r'onClick={() => editingExpense ? (handleAddExpense as any)(editingExpense.id, newExpense) : (handleAddExpense as any)(newExpense)}',
    content
)

# Fix instructions error TS2554: Expected 1 arguments, but got 2.
# filter((_, idx) => idx !== i) is 2 arguments.
# Maybe newProduct.instructions is defined as `string[]` in type? Wait, `instructions.filter` takes a callback with 3 arguments.
# Wait! In the script I did `(newProduct.instructions || []).filter((_, idx) => idx !== i)` but the previous code was:
# `newProduct.instructions.filter((_:any,idx:any)=>idx!==i)`
# And if it is typed as `[...(newProduct.instructions || [])]`.
content = re.sub(r'\.filter\(\(_, idx\) =>', r'.filter((_: any, idx: any) =>', content)

# Fix Object.keys/entries types
content = re.sub(r'Object\.entries\(simPrices\)\.map\(\(\[id, price\]\) =>', r'Object.entries(simPrices).map(([id, price]: [string, any]) =>', content)
content = re.sub(r'Object\.entries\(simulatedInflations\)\.map\(\(\[name, infl\]\) =>', r'Object.entries(simulatedInflations).map(([name, infl]: [string, any]) =>', content)
content = re.sub(r'Object\.keys\(productProfitability\)\.map\(\(prod\) =>', r'Object.keys(productProfitability).map((prod: string) =>', content)

# Fix whatsapp_text error
content = re.sub(r'lastTransaction\.whatsapp_text', r'(lastTransaction as any).whatsapp_text', content)

with open("frontend/src/components/Dashboard.tsx", "w") as f:
    f.write(content)
