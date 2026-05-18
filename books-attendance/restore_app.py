import re

app_js_path = r'c:\xampp\htdocs\GBHSS YOUNUSABAD SCHOOL SYSTEM\books-attendance\js\app.js'
with open(app_js_path, 'r', encoding='utf-8') as f:
    app_js = f.read()

funcs_to_remove = ['openAddApplicantModal', 'openScannerModal', 'handleImageUpload', 'processScannedForm', 'editApplicant', 'handleApplicantSubmit', 'deleteApplicant', 'admitApplicant', 'printAdmitCard', 'printMultipleAdmitCards', 'printAdmissionForm', 'loadApplicantsTable', 'filterApplicants']

for func in funcs_to_remove:
    # Need to match the function up to the next key or end of object
    pattern = r'(?m)^\s+' + func + r'\s*:\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{.*?(?=^\s+\w+\s*:|^\};)'
    app_js = re.sub(pattern, '', app_js, flags=re.DOTALL)

# Also remove any stray commas left before };
app_js = re.sub(r',\s*\n};', '\n};', app_js)

# Restore switchScreen modifications
old_titles = """        const titles = {
            'dashboard': 'Dashboard',
            'students': 'Manage Students',
            'books': 'Library Management',
            'attendance': 'Mark Attendance',
            'reports': 'Attendance Reports',
            'applicants': 'Manage Applicants',
            'print-forms': 'Print Admission Forms'
        };"""
new_titles = """        const titles = {
            'dashboard': 'Dashboard',
            'students': 'Manage Students',
            'books': 'Library Management',
            'attendance': 'Mark Attendance',
            'reports': 'Attendance Reports'
        };"""
app_js = app_js.replace(old_titles, new_titles)

old_routes = """        // Route specifics
        if (screenId === 'dashboard') app.updateDashboardStats();
        if (screenId === 'students') app.loadStudentsTable();
        if (screenId === 'books') app.loadBooksTable();
        if (screenId === 'attendance') { app.startScanner(); app.populateManualDropdown(); }
        if (screenId === 'reports') app.loadAttendanceReport();
        if (screenId === 'notifications') app.loadNotificationLogs();
        if (screenId === 'applicants') app.loadApplicantsTable();"""
new_routes = """        // Route specifics
        if (screenId === 'dashboard') app.updateDashboardStats();
        if (screenId === 'students') app.loadStudentsTable();
        if (screenId === 'books') app.loadBooksTable();
        if (screenId === 'attendance') { app.startScanner(); app.populateManualDropdown(); }
        if (screenId === 'reports') app.loadAttendanceReport();
        if (screenId === 'notifications') app.loadNotificationLogs();"""
app_js = app_js.replace(old_routes, new_routes)

with open(app_js_path, 'w', encoding='utf-8') as f:
    f.write(app_js)
print('Restored app.js')
