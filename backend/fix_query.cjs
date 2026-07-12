const fs = require('fs');
let text = fs.readFileSync('services/intelligence.py', 'utf8');

text = text.replace(/days_ahead: int = Query\(default=(\d+), .*?\)/g, 'days_ahead: int = $1');

fs.writeFileSync('services/intelligence.py', text);
console.log('Fixed Query syntax in services/intelligence.py');
