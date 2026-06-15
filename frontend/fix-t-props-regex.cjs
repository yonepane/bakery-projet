const fs = require('fs');
const files = [
  'src/components/dashboard/panels/InventoryPanel.tsx',
  'src/components/dashboard/panels/ExpensesPanel.tsx',
  'src/components/dashboard/panels/StaffPanel.tsx',
  'src/components/dashboard/panels/PurchasingPanel.tsx',
  'src/components/dashboard/panels/PlannerPanel.tsx',
  'src/components/dashboard/panels/CustomersPanel.tsx'
];

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  
  // Add 't' to Pick if not present
  if (!content.includes("'t' |") && !content.includes("| 't'")) {
    content = content.replace(/Pick<DashboardSharedProps,(\s*)/, "Pick<DashboardSharedProps,$1't' | ");
  }

  // Add 't' to destructured props
  const regex = /(const [A-Za-z]+Panel: React\.FC<Props> = \({[\s\S]*?)(}\) =>)/;
  const match = content.match(regex);
  if (match) {
    if (!match[1].includes(' t,') && !match[1].includes(', t') && !match[1].includes(' t ')) {
      content = content.replace(regex, "$1 t $2");
    }
  }

  fs.writeFileSync(f, content);
});
console.log('Fixed files string-wise!');
