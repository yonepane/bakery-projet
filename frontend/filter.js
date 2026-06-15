import fs from 'fs';

const rawStrings = JSON.parse(fs.readFileSync('extracted_strings.json', 'utf8'));

// Extract existing english strings
const translationsFile = fs.readFileSync('src/lib/translations.ts', 'utf8');
const enBlockMatch = translationsFile.match(/en:\s*\{([\s\S]*?)\},\s*fr:/);
let existingKeys = {};
let existingValues = new Set();
if (enBlockMatch) {
    const lines = enBlockMatch[1].split('\n');
    for (const line of lines) {
        const match = line.match(/^\s*([a-zA-Z0-9_]+)\s*:\s*"(.*)"\s*,?/);
        if (match) {
            existingKeys[match[1]] = match[2];
            existingValues.add(match[2]);
        }
    }
}

const isNoise = (s) => {
    if (s.startsWith('#')) return true;
    if (s.startsWith('/')) return true;
    if (s === 'true' || s === 'false' || s === 'async' || s === 'lazy' || s === 'blur' || s === 'rectangular' || s === 'round') return true;
    if (s.includes('url(')) return true;
    if (s.length <= 2) return true;
    return false;
};

const missing = [];
for (const s of rawStrings) {
    if (isNoise(s)) continue;
    if (existingValues.has(s)) continue;
    missing.push(s);
}

fs.writeFileSync('missing_strings.json', JSON.stringify(missing, null, 2));
console.log(`Found ${missing.length} missing strings.`);
