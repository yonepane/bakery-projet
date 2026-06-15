import os
import re
import json

base_dir = "/home/dane/bakery-os/frontend/src/components/dashboard"
files_to_check = []
for root, _, files in os.walk(base_dir):
    for f in files:
        if f.endswith(".tsx"):
            files_to_check.append(os.path.join(root, f))

strings = set()
for fpath in files_to_check:
    with open(fpath, "r") as f:
        content = f.read()
        # Find text between > and <
        matches = re.findall(r'>([^<{}]+)<', content)
        for m in matches:
            text = m.strip()
            if len(text) > 2 and not re.match(r'^[\W\d_]+$', text):
                strings.add(text)

print(json.dumps(list(strings), indent=2))
