import re

db_js_path = r'c:\xampp\htdocs\GBHSS YOUNUSABAD SCHOOL SYSTEM\books-attendance\js\DB.js'
with open(db_js_path, 'r', encoding='utf-8') as f:
    db_js = f.read()

funcs_to_remove = ['getApplicants', 'saveApplicants', 'addApplicant', 'updateApplicant', 'deleteApplicant', 'admitToMainSystem']

for func in funcs_to_remove:
    pattern = r'(?m)^\s+' + func + r'\s*:\s*(?:\([^)]*\))?\s*=>\s*\{.*?(?=^\s+\w+\s*:|^\};)'
    db_js = re.sub(pattern, '', db_js, flags=re.DOTALL)

db_js = re.sub(r',\s*\n};', '\n};', db_js)

with open(db_js_path, 'w', encoding='utf-8') as f:
    f.write(db_js)
print('Restored DB.js')
