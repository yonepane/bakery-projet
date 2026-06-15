import fs from 'fs';

const filePath = 'src/lib/translations.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Find all lines that start with spaces, then a digit, and wrap the key in quotes
content = content.replace(/^(\s*)([0-9][a-zA-Z0-9_]*)\s*:/gm, '$1"$2":');

fs.writeFileSync(filePath, content);
console.log('Fixed numeric keys in translations.ts');
