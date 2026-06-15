import fs from 'fs';
import path from 'path';

const missing = JSON.parse(fs.readFileSync('missing_strings.json', 'utf8'));

// Load existing keys
const translationsFile = fs.readFileSync('src/lib/translations.ts', 'utf8');
const enBlockMatch = translationsFile.match(/en:\s*\{([\s\S]*?)\},\s*fr:/);
let existingValToKey = {};
if (enBlockMatch) {
    const lines = enBlockMatch[1].split('\n');
    for (const line of lines) {
        const match = line.match(/^\s*([a-zA-Z0-9_]+)\s*:\s*"(.*)"\s*,?/);
        if (match) {
            existingValToKey[match[2]] = match[1];
        }
    }
}

let newTranslations = {};
const generateKey = (text) => {
    if (existingValToKey[text]) return existingValToKey[text];
    let key = text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (key.length > 30) key = key.substring(0, 30).replace(/_+$/, '');
    if (!key) key = 'str_' + Math.random().toString(36).substr(2, 5);
    
    let finalKey = key;
    let counter = 1;
    while (Object.values(existingValToKey).includes(finalKey)) {
        finalKey = `${key}_${counter}`;
        counter++;
    }
    
    existingValToKey[text] = finalKey;
    newTranslations[finalKey] = text;
    return finalKey;
};

// Map of string -> key
const stringToKey = {};
for (const s of missing) {
    stringToKey[s] = generateKey(s);
}
for (const [val, key] of Object.entries(existingValToKey)) {
    stringToKey[val] = key;
}

const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

const processFile = (filePath) => {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    // We sort strings by length descending to replace longest first
    const sortedStrings = Object.keys(stringToKey).sort((a, b) => b.length - a.length);

    for (const s of sortedStrings) {
        if (s.length < 3) continue; // too risky
        const key = stringToKey[s];
        
        // 1. >String<
        const jsxRegex = new RegExp(`>(\\s*)${escapeRegExp(s)}(\\s*)<`, 'g');
        if (jsxRegex.test(content)) {
            content = content.replace(jsxRegex, `>$1{t('${key}')}$2<`);
            changed = true;
        }

        // 2. "String" in props (e.g. placeholder="String" -> placeholder={t('key')})
        const propRegex = new RegExp(`="\\s*${escapeRegExp(s)}\\s*"`, 'g');
        if (propRegex.test(content)) {
            content = content.replace(propRegex, `={t('${key}')}`);
            changed = true;
        }

        // 3. 'String' in addToast('String', ...)
        const toastRegex = new RegExp(`addToast\\(\\s*["']${escapeRegExp(s)}["']`, 'g');
        if (toastRegex.test(content)) {
            content = content.replace(toastRegex, `addToast(t('${key}')`);
            changed = true;
        }
    }

    if (changed) {
        // Ensure useTranslation is imported
        if (!content.includes("useTranslation")) {
            content = "import { useTranslation } from 'react-i18next';\n" + content;
        }

        // Inject const { t } = useTranslation(); into the component if missing
        if (!content.includes("const { t } = useTranslation();") && !content.includes("t: Record") && !content.includes("t = translations")) {
            // Find the main component declaration
            const compRegex = /const\s+[A-Z][a-zA-Z0-9_]*\s*:\s*React\.FC[^=]*=\s*\([^)]*\)\s*=>\s*\{/;
            if (compRegex.test(content)) {
                content = content.replace(compRegex, (match) => match + "\n  const { t } = useTranslation();\n");
            } else {
                // Try implicit return component
                const compRegexImp = /const\s+[A-Z][a-zA-Z0-9_]*\s*:\s*React\.FC[^=]*=\s*\([^)]*\)\s*=>\s*\(/;
                if (compRegexImp.test(content)) {
                    content = content.replace(compRegexImp, (match) => {
                        const replaced = match.replace(/=>\s*\(/, "=> {\n  const { t } = useTranslation();\n  return (");
                        // We also need to close the block at the end, which is very hard with regex.
                        // So let's skip implicit returns or just warn
                        console.log(`WARNING: Implicit return in ${filePath}, manually add 'const { t } = useTranslation();'`);
                        return match; // don't replace
                    });
                }
            }
        }
        
        fs.writeFileSync(filePath, content);
        console.log(`Updated ${filePath}`);
    }
};

const walkDir = (dir) => {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkDir(fullPath);
        } else if (fullPath.endsWith('.tsx')) {
            processFile(fullPath);
        }
    }
};

walkDir('src/components/dashboard/panels');
processFile('src/components/Dashboard.tsx');

// Output new translations to append
fs.writeFileSync('new_translations.json', JSON.stringify(newTranslations, null, 2));
console.log("Wrote new_translations.json with " + Object.keys(newTranslations).length + " new keys.");
