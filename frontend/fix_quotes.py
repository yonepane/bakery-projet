import glob

for filepath in glob.glob('src/components/dashboard/panels/*.tsx'):
    with open(filepath, 'r') as f:
        content = f.read()

    # Replace \' with '
    content = content.replace(r"\'", "'")
    
    with open(filepath, 'w') as f:
        f.write(content)
