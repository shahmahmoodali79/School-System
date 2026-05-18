// Simple LocalStorage Wrapper for Data Persistence

const DB_KEYS = {
    STUDENTS: 'edu_students',
    BOOKS: 'edu_books',
    ASSIGNMENTS: 'edu_assignments',
    ATTENDANCE: 'edu_attendance',
    MONTHLY_REMARKS: 'edu_monthly_remarks',
    LESSON_PROGRESS: 'edu_lesson_progress'
};

const DB = {
    // Generate simple unique ID
    generateId: () => Math.random().toString(36).substr(2, 9),

    // Generic get method
    get: (key) => {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : [];
    },

    // Generic save method
    save: (key, data) => {
        localStorage.setItem(key, JSON.stringify(data));
    },

    // Generate GBHSS-PHR ID for students
    generateStudentId: () => {
        const students = DB.getStudents();
        let maxStrId = 1000;
        students.forEach(s => {
            if (s.id && s.id.startsWith('GBHSS-PHR-')) {
                const num = parseInt(s.id.replace('GBHSS-PHR-', ''));
                if (!isNaN(num) && num > maxStrId) {
                    maxStrId = num;
                }
            }
        });
        return `GBHSS-PHR-${maxStrId + 1}`;
    },

    // Students
    getStudents: () => DB.get(DB_KEYS.STUDENTS),
    
    addStudent: (student) => {
        const students = DB.getStudents();
        const newStudent = { ...student, id: DB.generateStudentId() };
        if (!newStudent.serialNo) {
            newStudent.serialNo = students.length + 1;
        }
        students.push(newStudent);
        DB.save(DB_KEYS.STUDENTS, students);
        return newStudent;
    },

    updateStudent: (updatedStudent) => {
        const students = DB.getStudents();
        const index = students.findIndex(s => s.id === updatedStudent.id);
        if (index !== -1) {
            students[index] = { ...students[index], ...updatedStudent };
            DB.save(DB_KEYS.STUDENTS, students);
            return students[index];
        }
        return false;
    },

    deleteStudent: (id) => {
        const students = DB.getStudents();
        const filtered = students.filter(s => s.id !== id);
        DB.save(DB_KEYS.STUDENTS, filtered);
    },

    // Books
    getBooks: () => DB.get(DB_KEYS.BOOKS),

    addBook: (book) => {
        const books = DB.getBooks();
        const newBook = { ...book, id: DB.generateId() };
        books.push(newBook);
        DB.save(DB_KEYS.BOOKS, books);
        return newBook;
    },

    updateBook: (updatedBook) => {
        const books = DB.getBooks();
        const index = books.findIndex(b => b.id === updatedBook.id);
        if (index !== -1) {
            books[index] = { ...books[index], ...updatedBook };
            DB.save(DB_KEYS.BOOKS, books);
            return books[index];
        }
        return false;
    },

    // Assignments
    getAssignments: () => DB.get(DB_KEYS.ASSIGNMENTS),

    assignBook: (bookId, studentId) => {
        const assignments = DB.getAssignments();
        // Remove old assignment if book is already assigned
        const filtered = assignments.filter(a => a.bookId !== bookId);
        filtered.push({ bookId, studentId, date: new Date().toISOString() });
        DB.save(DB_KEYS.ASSIGNMENTS, filtered);
    },

    returnBook: (bookId) => {
        const assignments = DB.getAssignments();
        const filtered = assignments.filter(a => a.bookId !== bookId);
        DB.save(DB_KEYS.ASSIGNMENTS, filtered);
    },

    // Attendance
    getAttendance: () => DB.get(DB_KEYS.ATTENDANCE),

    markAttendance: (studentId, status = 'Present') => {
        const attendance = DB.getAttendance();
        const todayStr = new Date().toISOString().split('T')[0];
        
        // Check if already marked today
        const alreadyMarkedIndex = attendance.findIndex(a => a.studentId === studentId && a.date.startsWith(todayStr));
        
        if (alreadyMarkedIndex !== -1) {
            // Prevent duplicate message conceptually but allow overriding for correction if needed.
            return { success: false, message: `Attendance already marked as ${attendance[alreadyMarkedIndex].status} for today.` };
        }

        attendance.push({
            studentId,
            date: new Date().toISOString(),
            status: status
        });
        
        DB.save(DB_KEYS.ATTENDANCE, attendance);
        return { success: true, message: `Attendance marked successfully as ${status}.` };
    },

    updateAttendanceDate: (studentId, dateStr, status) => {
        const attendance = DB.getAttendance();
        const index = attendance.findIndex(a => a.studentId === studentId && a.date.startsWith(dateStr));
        
        if (status === '' || status === null) {
            if (index !== -1) {
                attendance.splice(index, 1);
                DB.save(DB_KEYS.ATTENDANCE, attendance);
            }
        } else {
            if (index !== -1) {
                attendance[index].status = status;
            } else {
                attendance.push({
                    studentId,
                    date: dateStr + 'T12:00:00.000Z',
                    status: status
                });
            }
            DB.save(DB_KEYS.ATTENDANCE, attendance);
        }
    },

    getAttendanceByDate: (dateStr) => {
        const attendance = DB.getAttendance();
        return attendance.filter(a => a.date.startsWith(dateStr));
    },

    // Lesson (Sabaq) Progress
    getLessonProgress: () => DB.get(DB_KEYS.LESSON_PROGRESS),

    updateLessonProgress: (studentId, dateStr, status) => {
        const progress = DB.getLessonProgress();
        const index = progress.findIndex(p => p.studentId === studentId && p.date.startsWith(dateStr));
        
        if (status === '' || status === null) {
            if (index !== -1) {
                progress.splice(index, 1);
                DB.save(DB_KEYS.LESSON_PROGRESS, progress);
            }
        } else {
            if (index !== -1) {
                progress[index].status = status;
            } else {
                progress.push({
                    studentId,
                    date: dateStr + 'T12:00:00.000Z',
                    status: status
                });
            }
            DB.save(DB_KEYS.LESSON_PROGRESS, progress);
        }
    },

    getMonthlyRemarks: () => {
        const stored = localStorage.getItem(DB_KEYS.MONTHLY_REMARKS);
        return stored ? JSON.parse(stored) : {};
    },

    saveMonthlyRemark: (studentId, yearMonth, remark) => {
        const remarks = DB.getMonthlyRemarks();
        const key = `${studentId}_${yearMonth}`;
        if (!remark || remark.trim() === '') {
            delete remarks[key];
        } else {
            remarks[key] = remark;
        }
        localStorage.setItem(DB_KEYS.MONTHLY_REMARKS, JSON.stringify(remarks));
    }
};

// Initialize empty DB and Govt Syllabus if not present
const initDB = () => {
    Object.values(DB_KEYS).forEach(key => {
        if (!localStorage.getItem(key)) {
            // handle plain object for remarks, array for others
            if (key === DB_KEYS.MONTHLY_REMARKS) {
                localStorage.setItem(key, JSON.stringify({}));
            } else {
                localStorage.setItem(key, JSON.stringify([]));
            }
        }
    });

    const books = DB.getBooks();
    if (books.length === 0) {
        const predefined = [
            { class: '1', subjects: ['English', 'Urdu', 'Math'] },
            { class: '2', subjects: ['English', 'Urdu', 'Math', 'Islamiat'] },
            { class: '3', subjects: ['English', 'Urdu', 'Math', 'Islamiat', 'Science'] },
            { class: '4', subjects: ['English', 'Urdu', 'Math', 'Islamiat', 'Science', 'Social Studies'] },
            { class: '5', subjects: ['English', 'Urdu', 'Math', 'Islamiat', 'Science', 'Social Studies'] },
            { class: '6', subjects: ['English', 'Urdu', 'Math', 'Islamiat', 'Science', 'Social Studies', 'Computer'] },
            { class: '7', subjects: ['English', 'Urdu', 'Math', 'Islamiat', 'Science', 'Social Studies', 'Computer'] },
            { class: '8', subjects: ['English', 'Urdu', 'Math', 'Islamiat', 'Science', 'Social Studies', 'Computer'] },
        ];

        const initialBooks = [];
        predefined.forEach(p => {
            p.subjects.forEach(subject => {
                initialBooks.push({
                    id: DB.generateId() + Math.random().toString(36).substr(2, 5),
                    title: `${subject} Book ${p.class}`,
                    class: p.class,
                    subject: subject,
                    totalQty: 0,
                    availableQty: 0,
                    assignedQty: 0,
                    returnedQty: 0,
                    isGovt: true
                });
            });
        });
        DB.save(DB_KEYS.BOOKS, initialBooks);
    }
    const students = DB.getStudents();
    let studentsMigrated = false;
    students.forEach((s, index) => {
        if (!s.serialNo) {
            s.serialNo = index + 1;
            studentsMigrated = true;
        }
    });
    if (studentsMigrated) {
        DB.save(DB_KEYS.STUDENTS, students);
    }

};
initDB();
