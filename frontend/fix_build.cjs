const fs = require('fs');

let f = fs.readFileSync('src/components/dashboard/panels/FichePanel.tsx', 'utf8');
f = f.replace(/const Number\(hourlyWage\) = settings\?\.hourly_wage \|\| 0;/, 'const hourlyWage = Number(settings?.hourly_wage) || 0;');
fs.writeFileSync('src/components/dashboard/panels/FichePanel.tsx', f);

let fcp = fs.readFileSync('src/components/dashboard/panels/ForecastPanel.tsx', 'utf8');
fcp = fcp.replace(/\{\(t \? t\('no_data', \{ defaultValue: '—' \}\) : '—'\)\}/, "{(t ? t('no_data', { defaultValue: '—' }) : '—')}");
fcp = fcp.replace(/\{\(t \? t\('no_data', \{ defaultValue: '—' \}\) : '—'\)\)\}/, "{(t ? t('no_data', { defaultValue: '—' }) : '—')}");
fs.writeFileSync('src/components/dashboard/panels/ForecastPanel.tsx', fcp);

console.log('Fixed build errors.');
