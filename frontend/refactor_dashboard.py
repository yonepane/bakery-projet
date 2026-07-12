import re

with open('src/components/Dashboard.tsx', 'r') as f:
    content = f.read()

# Remove {...panelProps} from panel tags
content = re.sub(r'\{([^}]+)\s*&&\s*<([A-Za-z]+Panel)\s*\{...panelProps\}\s*([^>]*)/>\}', r'{\1 && <\2 \3/>}', content)

# Clean up empty spaces in empty tags like <SettingsPanel  />
content = re.sub(r'<([A-Za-z]+Panel)\s+/>', r'<\1 />', content)

with open('src/components/Dashboard.tsx', 'w') as f:
    f.write(content)
