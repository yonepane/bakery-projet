const fs = require('fs');

function replace(file, search, replaceStr) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(search, replaceStr);
  fs.writeFileSync(file, content);
}

// 1. ForecastPanel.types.ts
let fpTypes = fs.readFileSync('src/components/dashboard/panels/ForecastPanel.types.ts', 'utf8');
fpTypes = fpTypes.replace(/import\('react-i18next'\)\.TFunction/g, "import('i18next').TFunction");
fs.writeFileSync('src/components/dashboard/panels/ForecastPanel.types.ts', fpTypes);

// 2. ForecastPanel.tsx
let fp = fs.readFileSync('src/components/dashboard/panels/ForecastPanel.tsx', 'utf8');
fp = fp.replace(/lu\.can_produce/g, 's.can_produce');
fp = fp.replace(/<Icon className="absolute top-1\/2 right-4 -translate-y-1\/2 w-16 h-16" \/>/, '{Icon && <Icon className="absolute top-1/2 right-4 -translate-y-1/2 w-16 h-16" />}');
// add proper typing to reduces if needed, but it should be inferred now.
fs.writeFileSync('src/components/dashboard/panels/ForecastPanel.tsx', fp);

// 3. http.ts
let http = fs.readFileSync('src/lib/http.ts', 'utf8');
if (!http.includes('/// <reference types="vite/client" />')) {
  http = '/// <reference types="vite/client" />\n' + http;
  fs.writeFileSync('src/lib/http.ts', http);
}

// 4. main.tsx
let main = fs.readFileSync('src/main.tsx', 'utf8');
if (!main.includes('/// <reference types="vite-plugin-pwa/client" />')) {
  main = '/// <reference types="vite-plugin-pwa/client" />\n' + main;
  fs.writeFileSync('src/main.tsx', main);
}

console.log("Applied final fixes.");
