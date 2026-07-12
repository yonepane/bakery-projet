import os
import re
import glob

files = glob.glob('src/components/dashboard/panels/*.tsx')
for f in files:
    with open(f, 'r') as file:
        content = file.read()
    
    # 1. Add import { useDashboard } from '../DashboardContext';
    if "useDashboard" not in content:
        content = re.sub(r'(import React.*?\n)', r'\1import { useDashboard } from \'../DashboardContext\';\n', content, count=1)
    
    # 2. Find the component definition
    comp_match = re.search(r'const\s+([A-Za-z0-9_]+)\s*:\s*React\.FC(?:<[^>]+>)?\s*=\s*\(\s*\{([^}]*)\}\s*\)\s*=>\s*\{', content)
    if comp_match:
        comp_name = comp_match.group(1)
        props_str = comp_match.group(2)
        
        # Rewrite the component declaration
        new_decl = f'const {comp_name}: React.FC = () => {{\n  const {{ {props_str.strip()} }} = useDashboard();'
        content = content[:comp_match.start()] + new_decl + content[comp_match.end():]
        
    # 3. Remove DashboardSharedProps import
    content = re.sub(r'import\s+\{\s*(?:[^}]*,\s*)?DashboardSharedProps(?:,\s*[^}]*)?\s*\}\s*from\s+[\'"][^\'"]+[\'"];\n?', '', content)
    
    # 4. Remove type Props = Pick<...>; or type Props = Pick<...> & { ... };
    # Need to be careful here because the type definition could span multiple lines.
    content = re.sub(r'type\s+Props\s*=\s*Pick<DashboardSharedProps,\s*(?:[^{]+|\{[^}]+\})\s*>;\n?', '', content)
    
    with open(f, 'w') as file:
        file.write(content)
        
