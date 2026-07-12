const fs = require('fs');
let text = fs.readFileSync('services/intelligence.py', 'utf8');

// Replace Query(...) defaults
text = text.replace(/horizon_days: int = Query\(default=(\d+), .*?\)/g, 'horizon_days: int = $1');

// Remove any remaining fastapi dependencies
text = text.replace(/from fastapi import .*/g, 'from fastapi import HTTPException');

// Fix the simulate_price parameters which might still have Depends
text = text.replace(/materials_update: dict\[str, float\] = Body\(\.\.\.\)/g, 'materials_update: dict[str, float]');

fs.writeFileSync('services/intelligence.py', text);
console.log('Fixed syntax in services/intelligence.py');
