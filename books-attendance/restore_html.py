import re

main_html_path = r'c:\xampp\htdocs\GBHSS YOUNUSABAD SCHOOL SYSTEM\books-attendance\index.html'
with open(main_html_path, 'r', encoding='utf-8') as f:
    main_html = f.read()

# 1. Remove sections
main_html = re.sub(r'<section id="applicants" class="screen">.*?</section>\s*', '', main_html, flags=re.DOTALL)
main_html = re.sub(r'<section id="print-forms" class="screen">.*?</section>\s*', '', main_html, flags=re.DOTALL)

# 2. Remove modals
main_html = re.sub(r'<div id="add-applicant-modal" class="modal">.*?</div>\s*</div>\s*</div>\s*', '', main_html, flags=re.DOTALL)
main_html = re.sub(r'<div id="scanner-modal" class="modal">.*?</div>\s*</div>\s*</div>\s*', '', main_html, flags=re.DOTALL)

# 3. Remove nav links
links_to_remove = r'<li data-target="applicants"><i class="fa-solid fa-users-viewfinder"></i> Admissions List</li>\n                    <li data-target="print-forms"><i class="fa-solid fa-file-pdf"></i> Print Admission Form</li>\n                    '
main_html = main_html.replace(links_to_remove, '')

with open(main_html_path, 'w', encoding='utf-8') as f:
    f.write(main_html)
print('Restored index.html')
