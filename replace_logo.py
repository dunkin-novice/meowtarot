import os

with open('js/components/navbar.js', 'r') as f:
    content = f.read()

old_str = '<a href="${homeHref}" class="logo-text nav-logo" data-logo aria-label="Go to home">✦</a>'
new_str = '<a href="${homeHref}" class="nav-logo" aria-label="Go to home" style="text-decoration:none;"><img src="https://cdn.meowtarot.com/assets/logo.jpg" alt="MeowTarot Logo" style="height: 40px; width: 40px; border-radius: 8px; vertical-align: middle;"></a>'

content = content.replace(old_str, new_str)

with open('js/components/navbar.js', 'w') as f:
    f.write(content)
