import fs from 'fs';

const newTranslations = JSON.parse(fs.readFileSync('new_translations.json', 'utf8'));
const filePath = 'src/lib/translations.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Build the new dictionary entries
let newEntries = "";
for (const [key, val] of Object.entries(newTranslations)) {
    const safeVal = val.replace(/"/g, '\\"');
    newEntries += `    ${key}: "${safeVal}",\n`;
}

// We can replace the end of each language block
content = content.replace(/(\s*)(},?\s*fr:\s*\{)/, `$1\n    // ── Auto-Extracted Strings ──\n${newEntries}$2`);
content = content.replace(/(\s*)(},?\s*ar:\s*\{)/, `$1\n    // ── Auto-Extracted Strings ──\n${newEntries}$2`);
content = content.replace(/(\s*)(\}\s*\};\s*)$/, `$1\n    // ── Auto-Extracted Strings ──\n${newEntries}$2`);

fs.writeFileSync(filePath, content);
console.log('Appended ' + Object.keys(newTranslations).length + ' keys to translations.ts in en, fr, and ar blocks.');
