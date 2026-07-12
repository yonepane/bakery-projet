import glob
import re

for filepath in glob.glob('src/components/dashboard/panels/*.tsx'):
    with open(filepath, 'r') as f:
        content = f.read()

    # Find where 'type Props = ' starts
    props_start = content.find('type Props =')
    if props_start != -1:
        # Find the next component declaration or another known anchor,
        # but since 'const PanelName: React.FC = () => {' is already replaced by the first script,
        # let's find 'const ' or 'export ' that follows 'type Props =' and has 'React.FC'
        
        # A safer way: use regex to match 'type Props = ...;' across lines.
        # It typically ends with ';' before 'const ComponentName'
        content = re.sub(r'type\s+Props\s*=\s*(?:Pick<[^>]+>|.*?)(?:\s*&\s*\{[^}]*\})?\s*;\s*', '', content, flags=re.DOTALL)
        
    # Also remove `DashboardSharedProps` from import `{ ... } from '../types'`
    content = re.sub(r'DashboardSharedProps\s*,?\s*', '', content)
    # If import {} from '../types'; becomes empty, remove it
    content = re.sub(r'import\s*\{\s*\}\s*from\s*[\'"]\.\./types[\'"];\n', '', content)

    with open(filepath, 'w') as f:
        f.write(content)

print("Props definitions removed.")
