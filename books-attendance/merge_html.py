import re

adm_html_path = r'c:\xampp\htdocs\GBHSS YOUNUSABAD SCHOOL SYSTEM\admissions\index.html'
with open(adm_html_path, 'r', encoding='utf-8') as f:
    adm_html = f.read()

# Extract sections
applicants_match = re.search(r'(<section id="applicants" class="screen">.*?</section>)', adm_html, re.DOTALL)
print_forms_match = re.search(r'(<section id="print-forms" class="screen">.*?</section>)', adm_html, re.DOTALL)

# Extract modals
add_applicant_modal_match = re.search(r'(<div id="add-applicant-modal" class="modal">.*?</div>\s*</div>\s*</div>)', adm_html, re.DOTALL)
scanner_modal_match = re.search(r'(<div id="scanner-modal" class="modal">.*?</div>\s*</div>\s*</div>)', adm_html, re.DOTALL)

applicants_section = applicants_match.group(1) if applicants_match else ''
print_forms_section = print_forms_match.group(1) if print_forms_match else ''
add_applicant_modal = add_applicant_modal_match.group(1) if add_applicant_modal_match else ''
scanner_modal = scanner_modal_match.group(1) if scanner_modal_match else ''

main_html_path = r'c:\xampp\htdocs\GBHSS YOUNUSABAD SCHOOL SYSTEM\books-attendance\index.html'
with open(main_html_path, 'r', encoding='utf-8') as f:
    main_html = f.read()

# 1. Insert sections into content-wrapper
main_parts = main_html.split('</div>\n        </main>')
if len(main_parts) >= 2:
    main_html = main_parts[0] + '\n' + applicants_section + '\n\n' + print_forms_section + '\n            </div>\n        </main>' + main_parts[1]

# 2. Insert modals before scripts
# find closing tag of the last modal or just insert before <script src=
script_part = '<script src="js/DB.js"></script>'
if script_part not in main_html:
    script_part = '<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>'
if script_part in main_html:
    main_html = main_html.replace(script_part, add_applicant_modal + '\n\n' + scanner_modal + '\n\n    ' + script_part)
else:
    main_html = main_html.replace('</body>', add_applicant_modal + '\n\n' + scanner_modal + '\n</body>')

# 3. Insert nav links
reports_link = '<li data-target="reports">'
new_links = '<li data-target="applicants"><i class="fa-solid fa-users-viewfinder"></i> Admissions List</li>\n                    <li data-target="print-forms"><i class="fa-solid fa-file-pdf"></i> Print Admission Form</li>\n                    '
if reports_link in main_html:
    main_html = main_html.replace(reports_link, new_links + reports_link)

with open(main_html_path, 'w', encoding='utf-8') as f:
    f.write(main_html)
print('Written to books-attendance/index.html')
