import os

def replace_favicon(directory):
    count = 0
    for root, _, files in os.walk(directory):
        if 'node_modules' in root or '.git' in root:
            continue
        for f in files:
            if f.endswith('.html'):
                path = os.path.join(root, f)
                with open(path, 'r', encoding='utf-8') as file:
                    content = file.read()
                
                # Replace the exact string
                old_str1 = '<link rel="icon" type="image/svg+xml" href="/assets/favicon.svg" />'
                old_str2 = '<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">'
                new_str = '<link rel="icon" type="image/jpeg" href="https://cdn.meowtarot.com/assets/favicon.jpg" />'
                
                new_content = content.replace(old_str1, new_str).replace(old_str2, new_str)
                
                if new_content != content:
                    with open(path, 'w', encoding='utf-8') as file:
                        file.write(new_content)
                    count += 1
    print(f"Updated {count} HTML files.")

replace_favicon('.')
