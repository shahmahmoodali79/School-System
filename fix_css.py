html_path = r'c:\xampp\htdocs\Result sheet\index.html'
with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

html = html.replace('transform-origin: bottom center;', 'transform-origin: bottom center; mix-blend-mode: multiply;')

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(html)
print('mix-blend-mode applied perfectly to signature img tags.')
