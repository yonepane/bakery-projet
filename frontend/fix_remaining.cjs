const fs = require('fs');

function replace(file, search, replace) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(search, replace);
  fs.writeFileSync(file, content);
}

// 1. types.ts
replace('src/components/dashboard/types.ts', 
  /showConfirm: \(config: ConfirmConfig\) => void;/, 
  "showConfirm: (config: Omit<ConfirmConfig, 'isOpen'>) => void;"
);

let typesTs = fs.readFileSync('src/components/dashboard/types.ts', 'utf8');
if (!typesTs.includes('transaction_id?: string;')) {
  typesTs = typesTs.replace(
    /export interface Transaction {\n\s*id: string;/,
    "export interface Transaction {\n  id: string;\n  transaction_id?: string;"
  );
  fs.writeFileSync('src/components/dashboard/types.ts', typesTs);
}

// 2. PurchasingPanel.tsx
replace('src/components/dashboard/panels/PurchasingPanel.tsx',
  /handleDeleteSupplier\(supp\)/,
  'handleDeleteSupplier(supp.id)'
);

// 3. POSPanel.tsx
replace('src/components/dashboard/panels/POSPanel.tsx',
  /lastTransaction\.transaction_id/g,
  'lastTransaction.transaction_id || lastTransaction.id'
);

console.log("Remaining fixes applied.");
