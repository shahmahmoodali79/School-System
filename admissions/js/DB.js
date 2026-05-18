// Database wrapper for Admissions module

const DB = {
    getApplicants: () => {
        try {
            return JSON.parse(localStorage.getItem('edu_applicants')) || [];
        } catch (e) {
            return [];
        }
    },
    
    saveApplicants: (applicants) => {
        localStorage.setItem('edu_applicants', JSON.stringify(applicants));
    },
    
    addApplicant: (data) => {
        const applicants = DB.getApplicants();
        let nextNumber = 1;
        if (applicants.length > 0) {
            let maxNum = 0;
            applicants.forEach(a => {
                if (a.id && a.id.startsWith('GBHSS-')) {
                    const numPart = parseInt(a.id.split('-')[1], 10);
                    if (!isNaN(numPart) && numPart > maxNum) {
                        maxNum = numPart;
                    }
                }
            });
            nextNumber = maxNum + 1;
        }
        
        const regId = `GBHSS-${String(nextNumber).padStart(3, '0')}`;
        
        applicants.push({
            id: regId,
            name: data.name,
            fatherName: data.fatherName,
            cls: data.cls,
            phone: data.phone,
            prevSchool: data.prevSchool || '',
            testDate: data.testDate,
            status: data.status || 'Pending',
            marks: data.marks || '',
            retestMarks: data.retestMarks || '',
            createdAt: new Date().toISOString()
        });
        DB.saveApplicants(applicants);
    },
    
    updateApplicant: (data) => {
        const applicants = DB.getApplicants();
        const index = applicants.findIndex(a => a.id === data.id);
        if (index !== -1) {
            applicants[index] = { ...applicants[index], ...data };
            DB.saveApplicants(applicants);
        }
    },
    
    deleteApplicant: (id) => {
        const applicants = DB.getApplicants();
        const filtered = applicants.filter(a => a.id !== id);
        DB.saveApplicants(filtered);
    },

    admitToMainSystem: (applicant) => {
        // This pushes the applicant into the main books-attendance database
        try {
            const students = JSON.parse(localStorage.getItem('edu_students')) || [];
            
            // Check if already exists to prevent duplicate admissions
            const exists = students.find(s => s.phone === applicant.phone && s.name === applicant.name);
            if(exists) {
                alert("This student is already in the main system!");
                return false;
            }

            students.push({
                id: Date.now().toString(),
                name: applicant.name,
                fatherName: applicant.fatherName,
                cls: applicant.cls,
                grno: '', // Can be updated later
                rollno: '',
                phone: applicant.phone,
                dob: '',
                cnic: '',
                guardianCnic: '',
                religion: 'ISLAM',
                photo: null
            });
            
            localStorage.setItem('edu_students', JSON.stringify(students));
            return true;
        } catch(e) {
            console.error("Error admitting student", e);
            return false;
        }
    }
};
