const fs = require('fs');

function replace(file, search, replaceStr) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(search, replaceStr);
  fs.writeFileSync(file, content);
}

// 1. useProductMutations.ts
replace('src/components/dashboard/hooks/useProductMutations.ts', 
  /api\.post\(\`\/products\/\$\{id\}\/duplicate\`\)/, 
  "api.post(`/products/${id}/duplicate`, {})"
);

// 2. DashboardPanel.tsx
let dp = fs.readFileSync('src/components/dashboard/panels/DashboardPanel.tsx', 'utf8');
dp = dp.replace(/'handleSaveGeneralNote'/g, "'handleUpdateGeneralNote'");
dp = dp.replace(/log\.author/g, 'log.username');
dp = dp.replace(/log\.content/g, 'log.details || log.action');
dp = dp.replace(/handleSaveGeneralNote\(\)/g, "handleUpdateGeneralNote(generalNote)");
dp = dp.replace(/onClick={handleSaveGeneralNote}/g, "onClick={() => handleUpdateGeneralNote(generalNote)}");
dp = dp.replace(/const rev = payload\[0\]\.payload\.revenue;/g, "const rev = payload[0].payload.revenue as number;");
dp = dp.replace(/const cost = payload\[0\]\.payload\.cost;/g, "const cost = payload[0].payload.cost as number;");
dp = dp.replace(/formatPrice\(rev\)/g, "formatPrice(Number(rev))");
dp = dp.replace(/formatPrice\(cost\)/g, "formatPrice(Number(cost))");
fs.writeFileSync('src/components/dashboard/panels/DashboardPanel.tsx', dp);

// 3. FichePanel.tsx
let fp = fs.readFileSync('src/components/dashboard/panels/FichePanel.tsx', 'utf8');
fp = fp.replace(/hourlyWage/g, "Number(hourlyWage)");
fs.writeFileSync('src/components/dashboard/panels/FichePanel.tsx', fp);

// 4. ForecastPanel.tsx
let fcp = fs.readFileSync('src/components/dashboard/panels/ForecastPanel.tsx', 'utf8');
fcp = fcp.replace(/setActiveTab\(tab\.id\)/g, "setActiveTab(tab.id as any)");
fcp = fcp.replace(/s\.unit \|\| 'units'/g, "'units'");
fcp = fcp.replace(/const SummaryCard = \(props: SummaryCardProps\) => {/g, "const SummaryCard = (props: SummaryCardProps & { t?: any }) => {\n  const { t } = props;");
fcp = fcp.replace(/t\('no_data'/g, "(t ? t('no_data', { defaultValue: '—' }) : '—')");
fs.writeFileSync('src/components/dashboard/panels/ForecastPanel.tsx', fcp);

// 5. Dashboard.tsx
let d = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');
d = d.replace(/selectedPO\.date/g, "selectedPO.date || ''");
fs.writeFileSync('src/components/Dashboard.tsx', d);

console.log("Fixed.");
