const fs = require('fs');

let content = fs.readFileSync('services/operations.py', 'utf8');

// Find all function definitions
content = content.replace(/def ([a-zA-Z0-9_]+)\(([\s\S]*?)\):/g, (match, funcName, paramsStr) => {
    // If it's a multiline parameter list
    let lines = paramsStr.split('\n');
    let noDefaults = [];
    let withDefaults = [];
    
    let currentParam = '';
    
    // Quick and dirty parser for parameters since they are line-by-line usually
    for (let line of lines) {
        if (!line.trim() && !currentParam) continue;
        
        currentParam += line + '\n';
        
        // If the line ends with a comma or it's the last line
        if (line.trim().endsWith(',') || line === lines[lines.length - 1]) {
            let str = currentParam;
            if (str.includes('=') && !str.includes('Depends')) {
                // simple check for default
                withDefaults.push(str);
            } else {
                noDefaults.push(str);
            }
            currentParam = '';
        }
    }
    
    let sortedParams = noDefaults.join('') + withDefaults.join('');
    return `def ${funcName}(${sortedParams}):`;
});

// Remove any lingering FastAPI imports if they are unused, but for now just fix syntax.
fs.writeFileSync('services/operations.py', content);
console.log('Fixed parameter order in services/operations.py');
