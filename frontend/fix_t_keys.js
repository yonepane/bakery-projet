import fs from 'fs';

let content = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

const keys = [
  'dashboard', 'pos', 'kitchen', 'inventory', 'fiche', 'purchasing', 'simulator', 
  'history', 'planner', 'orders', 'comptabilite', 'staff', 'add_staff', 'add_material', 
  'logout', 'online', 'offline', 'sync_active', 'offline_mode', 'profit', 'username', 'password'
];

for (const key of keys) {
  const regex = new RegExp(`\\bt\\.${key}\\b`, 'g');
  content = content.replace(regex, `t('${key}')`);
}

fs.writeFileSync('src/components/Dashboard.tsx', content);
console.log('Fixed t.key in Dashboard.tsx');
