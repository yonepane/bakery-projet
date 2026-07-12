const fs = require('fs');
const text = fs.readFileSync('tsc_errors.log', 'utf8');

const errors = text.split('\n\n').filter(chunk => chunk.includes('error TS'));
const fileMap = {};

for (const err of errors) {
  const lines = err.split('\n');
  const firstLine = lines.find(l => l.includes('error TS'));
  if (!firstLine) continue;
  
  const match = firstLine.match(/^(.+?):(\d+):(\d+) - error TS\d+: (.+)$/);
  if (match) {
    const [_, file, line, col, msg] = match;
    if (!fileMap[file]) fileMap[file] = [];
    fileMap[file].push(msg);
  }
}

for (const [file, msgs] of Object.entries(fileMap)) {
  console.log(`\n--- ${file} ---`);
  // Print unique messages
  [...new Set(msgs)].forEach(m => console.log('  ' + m));
}
