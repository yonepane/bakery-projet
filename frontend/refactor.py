import glob
import re

for filepath in glob.glob('src/components/dashboard/panels/*.tsx'):
    with open(filepath, 'r') as f:
        content = f.read()

    # Find the start of the Props definition
    if 'type Props =' in content:
        start_idx = content.find('type Props =')
        # Find the next component definition. It will be 'const ' + panel name
        end_idx = content.find('const ', start_idx)
        if end_idx != -1:
            # We cut out the Props definition
            content = content[:start_idx] + content[end_idx:]

    # Add useDashboard import
    if 'useDashboard' not in content:
        content = re.sub(r'(import React.*?\n)', r'\1import { useDashboard } from \'../DashboardContext\';\n', content, count=1)
        
    # Replace the component signature
    # Pattern: const ComponentName: React.FC<Props> = ({ ... }) => {
    pattern = r'const\s+([A-Za-z0-9_]+)\s*:\s*React\.FC(?:<[^>]*>)?\s*=\s*\(\s*\{([\s\S]*?)\}\s*\)\s*=>\s*\{'
    match = re.search(pattern, content)
    if match:
        comp_name = match.group(1)
        props_body = match.group(2)
        new_sig = f'const {comp_name}: React.FC = () => {{\n  const {{ {props_body.strip()} }} = useDashboard();'
        content = content[:match.start()] + new_sig + content[match.end():]
        
    # Pattern 2: const ComponentName = (props: Props) => { const { ... } = props;
    pattern2 = r'const\s+([A-Za-z0-9_]+)\s*=\s*\(\s*props\s*:\s*Props\s*\)\s*=>\s*\{[\s\S]*?const\s*\{([\s\S]*?)\}\s*=\s*props;'
    match2 = re.search(pattern2, content)
    if match2:
        comp_name = match2.group(1)
        props_body = match2.group(2)
        new_sig = f'const {comp_name}: React.FC = () => {{\n  const {{ {props_body.strip()} }} = useDashboard();'
        content = content[:match2.start()] + new_sig + content[match2.end():]
        
    # Remove DashboardSharedProps import
    content = re.sub(r'import\s+\{\s*([^}]*,\s*)?DashboardSharedProps(?:,\s*[^}]*)?\s*\}\s*from\s+[\'\"].*?types[\'\"];\n?', '', content)
    content = re.sub(r'import\s*\{\s*\}\s*from\s*[\'\"].*?types[\'\"];\n?', '', content)
    
    with open(filepath, 'w') as f:
        f.write(content)

print('Updated files successfully.')
