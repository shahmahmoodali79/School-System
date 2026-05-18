const app = {
    currentScreen: 'dashboard',

    init: () => {
        app.loadApplicantsTable();
        app.updateDashboardStats();
        
        // Navigation listener
        document.querySelectorAll('.nav-link[data-target]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                app.switchScreen(e.currentTarget.getAttribute('data-target'));
                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                e.currentTarget.classList.add('active');
            });
        });

        const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        document.getElementById('current-date-display').textContent = today;
        document.getElementById('app-test-date').value = new Date().toISOString().split('T')[0];

        // Form Submit
        document.getElementById('add-applicant-form').addEventListener('submit', app.handleApplicantSubmit);

        app.updateDashboardStats();
    },

    updateDashboardStats: () => {
        const applicants = DB.getApplicants();
        document.getElementById('stat-total-applicants').textContent = applicants.length;
        document.getElementById('stat-passed').textContent = applicants.filter(a => a.status === 'Passed').length;
        document.getElementById('stat-pending').textContent = applicants.filter(a => a.status === 'Pending').length;
    },

    switchScreen: (screenId) => {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
        
        const titles = {
            'dashboard': 'Admissions Dashboard',
            'applicants': 'Manage Applicants',
            'print-forms': 'Print Admission Forms'
        };
        document.getElementById('page-title').textContent = titles[screenId];
        app.currentScreen = screenId;

        if (screenId === 'dashboard') app.updateDashboardStats();
        if (screenId === 'applicants') app.loadApplicantsTable();
    },

    showModal: (modalId) => {
        document.getElementById(modalId).classList.add('show');
    },

    closeModal: (modalId) => {
        document.getElementById(modalId).classList.remove('show');
    },

    openAddApplicantModal: () => {
        document.getElementById('add-applicant-form').reset();
        document.getElementById('edit-applicant-id').value = '';
        document.getElementById('applicant-modal-title').textContent = "New Entry Test Registration";
        document.getElementById('app-test-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('app-marks').value = '';
        document.getElementById('app-retest-marks').value = '';
        app.showModal('add-applicant-modal');
    },

    openScannerModal: () => {
        document.getElementById('scan-image-upload').value = '';
        document.getElementById('scan-preview-container').style.display = 'none';
        document.getElementById('scan-progress-container').style.display = 'none';
        document.getElementById('scan-progress-bar').style.width = '0%';
        document.getElementById('scan-preview').src = '';
        document.getElementById('btn-process-scan').disabled = true;
        app.showModal('scanner-modal');
    },

    handleImageUpload: (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                document.getElementById('scan-preview').src = e.target.result;
                document.getElementById('scan-preview-container').style.display = 'block';
                document.getElementById('btn-process-scan').disabled = false;
            }
            reader.readAsDataURL(file);
        }
    },

    processScannedForm: async () => {
        const imageSrc = document.getElementById('scan-preview').src;
        if (!imageSrc) return;

        const progressContainer = document.getElementById('scan-progress-container');
        const progressBar = document.getElementById('scan-progress-bar');
        const progressPercentage = document.getElementById('scan-progress-percentage');
        const statusText = document.getElementById('scan-status-text');
        const btn = document.getElementById('btn-process-scan');

        progressContainer.style.display = 'block';
        btn.disabled = true;

        try {
            statusText.textContent = 'Initializing AI Engine...';
            
            const worker = await Tesseract.createWorker({
                logger: m => {
                    if(m.status === 'recognizing text') {
                        statusText.textContent = 'Extracting Text (OCR)...';
                        const pct = Math.round(m.progress * 100);
                        progressBar.style.width = pct + '%';
                        progressPercentage.textContent = pct + '%';
                    }
                }
            });
            
            await worker.loadLanguage('eng');
            await worker.initialize('eng');
            const { data: { text } } = await worker.recognize(imageSrc);
            await worker.terminate();

            statusText.textContent = 'Analyzing Data...';
            
            // Smart Parsing Logic based on the exact form labels
            const extractedData = {
                name: '',
                fatherName: '',
                phone: '',
                cls: ''
            };

            const lines = text.split('\\n');
            lines.forEach(line => {
                const lowerLine = line.toLowerCase();
                if(lowerLine.includes('name of student')) extractedData.name = line.split(/student[:;]/i)[1]?.replace(/[|_-]/g, '').trim();
                else if(lowerLine.includes("father's name") || lowerLine.includes("fathers name")) extractedData.fatherName = line.split(/name[:;]/i)[1]?.replace(/[|_-]/g, '').trim();
                else if(lowerLine.includes('telephone no') || lowerLine.includes('mobile no')) extractedData.phone = line.split(/no[:;.]/i)[1]?.replace(/[|_-]/g, '').trim();
                else if(lowerLine.includes('class in which')) extractedData.cls = line.split(/sought[:;]/i)[1]?.replace(/[|_-]/g, '').trim();
            });

            // Fallbacks for poor OCR (if it finds boxes like [_] and splits incorrectly)
            if(!extractedData.name) {
                const nameMatch = text.match(/Name of Student.*?([A-Z][A-Za-z\\s]+)/i);
                if(nameMatch) extractedData.name = nameMatch[1].trim();
            }

            // Close scanner modal and open manual modal with pre-filled data
            app.closeModal('scanner-modal');
            app.openAddApplicantModal();

            // Populate what we found
            if(extractedData.name) document.getElementById('app-name').value = extractedData.name;
            if(extractedData.fatherName) document.getElementById('app-father').value = extractedData.fatherName;
            if(extractedData.phone) document.getElementById('app-phone').value = extractedData.phone;
            if(extractedData.cls) document.getElementById('app-class').value = extractedData.cls;

            alert('AI Extraction Complete! Please review and correct any mistakes in the manual form.');
            
        } catch (err) {
            console.error(err);
            alert('Failed to process image. Please try entering manually.');
            btn.disabled = false;
        }
    },

    editApplicant: (id) => {
        const applicants = DB.getApplicants();
        const appRecord = applicants.find(a => a.id === id);
        if (!appRecord) return;

        document.getElementById('edit-applicant-id').value = appRecord.id;
        document.getElementById('app-name').value = appRecord.name;
        document.getElementById('app-father').value = appRecord.fatherName;
        document.getElementById('app-class').value = appRecord.cls;
        document.getElementById('app-phone').value = appRecord.phone;
        document.getElementById('app-prev-school').value = appRecord.prevSchool || '';
        document.getElementById('app-test-date').value = appRecord.testDate;
        document.getElementById('app-status').value = appRecord.status;
        document.getElementById('app-marks').value = appRecord.marks || '';
        document.getElementById('app-retest-marks').value = appRecord.retestMarks || '';

        document.getElementById('applicant-modal-title').textContent = "Edit Applicant";
        app.showModal('add-applicant-modal');
    },

    handleApplicantSubmit: (e) => {
        e.preventDefault();
        const editId = document.getElementById('edit-applicant-id').value;
        const data = {
            name: document.getElementById('app-name').value,
            fatherName: document.getElementById('app-father').value,
            cls: document.getElementById('app-class').value,
            phone: document.getElementById('app-phone').value,
            prevSchool: document.getElementById('app-prev-school').value,
            testDate: document.getElementById('app-test-date').value,
            status: document.getElementById('app-status').value,
            marks: document.getElementById('app-marks').value,
            retestMarks: document.getElementById('app-retest-marks').value
        };

        if (editId) {
            data.id = editId;
            DB.updateApplicant(data);
        } else {
            DB.addApplicant(data);
        }

        app.closeModal('add-applicant-modal');
        if (app.currentScreen === 'applicants') {
            app.loadApplicantsTable();
        } else {
            app.updateDashboardStats();
        }
    },

    deleteApplicant: (id) => {
        if(confirm("Are you sure you want to delete this applicant?")) {
            DB.deleteApplicant(id);
            app.loadApplicantsTable();
            app.updateDashboardStats();
        }
    },

    admitApplicant: (id) => {
        const applicants = DB.getApplicants();
        const appRecord = applicants.find(a => a.id === id);
        if(!appRecord) return;

        if (confirm(`Do you want to formally admit ${appRecord.name} into the Main Books & Attendance System as a regular student?`)) {
            const success = DB.admitToMainSystem(appRecord);
            if (success) {
                // Update applicant status
                appRecord.status = 'Admitted';
                DB.updateApplicant(appRecord);
                alert(`${appRecord.name} has been successfully added to the Main Student Database!`);
                app.loadApplicantsTable();
            }
        }
    },

    printAdmitCard: (id) => {
        const applicants = DB.getApplicants();
        const appRecord = applicants.find(a => a.id === id);
        if(!appRecord) return;

        const printArea = document.getElementById('print-area');
        const logoPath = '../books-attendance/logo.png';
        const formattedDate = new Date(appRecord.testDate).toLocaleDateString('en-GB');

        printArea.innerHTML = `
            <div style="width: 100%; height: 100vh; display: flex; align-items: flex-start; justify-content: center; padding-top: 50px; background: white;">
                <div style="width: 500px; border: 2px dashed #2b5c7e; padding: 20px; font-family: 'Plus Jakarta Sans', sans-serif;">
                    <div style="text-align: center; border-bottom: 2px solid #2b5c7e; padding-bottom: 15px; margin-bottom: 20px;">
                        <img src="${logoPath}" style="width: 60px; height: 60px; object-fit: contain; margin-bottom: 10px;" onerror="this.style.display='none'">
                        <h2 style="margin: 0; color: #2b5c7e; font-size: 18px;">GBHSS YOUNUSABAD</h2>
                        <h3 style="margin: 5px 0 0; color: #1e293b; font-size: 16px;">${appRecord.marks ? 'RE-ENTRY TEST ADMIT CARD' : 'ENTRY TEST ADMIT CARD'}</h3>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 14px;">
                        <div><strong>Reg ID:</strong> ${appRecord.id}</div>
                        <div><strong>Test Date:</strong> ${formattedDate}</div>
                    </div>

                    <table style="width: 100%; font-size: 14px; line-height: 2;">
                        <tr><td style="width: 35%; font-weight: bold;">Applicant Name:</td><td style="border-bottom: 1px solid #cbd5e1;">${appRecord.name}</td></tr>
                        <tr><td style="font-weight: bold;">Father's Name:</td><td style="border-bottom: 1px solid #cbd5e1;">${appRecord.fatherName}</td></tr>
                        <tr><td style="font-weight: bold;">Class Applied For:</td><td style="border-bottom: 1px solid #cbd5e1;">${appRecord.cls}</td></tr>
                        <tr><td style="font-weight: bold;">Phone:</td><td style="border-bottom: 1px solid #cbd5e1;">${appRecord.phone}</td></tr>
                    </table>

                    <div style="margin-top: 30px; border-top: 1px dashed #cbd5e1; padding-top: 15px; font-size: 12px; color: #64748b; text-align: center;">
                        <p style="margin: 0;">Please bring this slip on the day of the test.</p>
                        <p style="margin: 5px 0 0;">Reporting Time: 08:30 AM</p>
                    </div>

                    <div style="margin-top: 50px; text-align: right;">
                        <div style="border-bottom: 1px solid #000; width: 150px; display: inline-block; margin-bottom: 5px;"></div>
                        <br><strong style="font-size: 12px; margin-right: 20px;">Authority Signature</strong>
                    </div>
                </div>
            </div>
        `;

        window.print();
    },

    printMultipleAdmitCards: () => {
        const query = document.getElementById('search-applicant') ? document.getElementById('search-applicant').value.toLowerCase() : '';
        const statusFilter = document.getElementById('filter-status') ? document.getElementById('filter-status').value : '';
        let applicants = DB.getApplicants();

        // Apply filters to only print currently visible ones
        applicants = applicants.filter(a => {
            const matchesSearch = a.name.toLowerCase().includes(query) || a.phone.includes(query) || a.id.includes(query);
            const matchesStatus = statusFilter === '' || a.status === statusFilter;
            return matchesSearch && matchesStatus;
        });

        if (applicants.length === 0) {
            alert('No applicants to print. Adjust your search filters.');
            return;
        }

        const printArea = document.getElementById('print-area');
        const logoPath = '../books-attendance/logo.png';
        let html = '';

        for (let i = 0; i < applicants.length; i += 4) {
            const chunk = applicants.slice(i, i + 4);
            
            html += `<div style="width: 210mm; height: 296mm; max-height: 296mm; padding: 5mm; box-sizing: border-box; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 5mm; page-break-after: always; overflow: hidden; background: white;">`;
            
            chunk.forEach(appRecord => {
                const formattedDate = new Date(appRecord.testDate).toLocaleDateString('en-GB');
                html += `
                    <div style="border: 2px dashed #2b5c7e; padding: 12px; font-family: 'Plus Jakarta Sans', sans-serif; display: flex; flex-direction: column;">
                        <div style="text-align: center; border-bottom: 2px solid #2b5c7e; padding-bottom: 8px; margin-bottom: 10px;">
                            <img src="${logoPath}" style="width: 40px; height: 40px; object-fit: contain; margin-bottom: 5px;" onerror="this.style.display='none'">
                            <h2 style="margin: 0; color: #2b5c7e; font-size: 15px;">GBHSS YOUNUSABAD</h2>
                            <h3 style="margin: 5px 0 0; color: #1e293b; font-size: 13px;">${appRecord.marks ? 'RE-ENTRY TEST ADMIT CARD' : 'ENTRY TEST ADMIT CARD'}</h3>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px;">
                            <div><strong>Reg ID:</strong> ${appRecord.id}</div>
                            <div><strong>Date:</strong> ${formattedDate}</div>
                        </div>

                        <table style="width: 100%; font-size: 12px; line-height: 1.5;">
                            <tr><td style="width: 35%; font-weight: bold;">Name:</td><td style="border-bottom: 1px solid #cbd5e1;">${appRecord.name}</td></tr>
                            <tr><td style="font-weight: bold;">Father:</td><td style="border-bottom: 1px solid #cbd5e1;">${appRecord.fatherName}</td></tr>
                            <tr><td style="font-weight: bold;">Class:</td><td style="border-bottom: 1px solid #cbd5e1;">Class ${appRecord.cls}</td></tr>
                            <tr><td style="font-weight: bold;">Phone:</td><td style="border-bottom: 1px solid #cbd5e1;">${appRecord.phone}</td></tr>
                        </table>

                        <div style="margin-top: auto; padding-top: 8px; text-align: center; font-size: 11px; color: #64748b;">
                            <p style="margin: 0;">Reporting Time: 08:30 AM</p>
                            <p style="margin: 2px 0 0;">Please bring this slip on the test day.</p>
                        </div>
                        
                        <div style="margin-top: 15px; text-align: right;">
                            <div style="border-bottom: 1px solid #000; width: 100px; display: inline-block;"></div>
                            <br><strong style="font-size: 10px; margin-right: 15px;">Auth. Sign</strong>
                        </div>
                    </div>
                `;
            });
            
            html += `</div>`;
        }

        printArea.innerHTML = html;
        window.print();
    },

    printAdmissionForm: () => {
        const printArea = document.getElementById('print-area');
        const logoPath = '../books-attendance/logo.png';

        const generateBoxes = (count) => {
            let boxes = '';
            for(let i=0; i<count; i++) {
                boxes += '<div style="width: 14px; height: 14px; border: 1px solid #0f2e53; display: inline-block; margin-right: 2px;"></div>';
            }
            return boxes;
        };

        const longGrid = generateBoxes(22);
        const cnicGrid = generateBoxes(13);

        const formHtml = `
            <div style="width: 210mm; height: 297mm; margin: 0 auto; background: white; padding: 10mm; box-sizing: border-box; font-family: 'Arial', sans-serif;">
                
                <!-- Borders -->
                <div style="border: 6px solid #0f2e53; height: 100%; box-sizing: border-box; position: relative; padding: 3px;">
                    <div style="border: 3px solid #c29b4b; height: 100%; box-sizing: border-box; padding: 10px; position: relative; display: flex; flex-direction: column;">
                        
                        <!-- Header -->
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                            <div style="width: 100px; text-align: center;">
                                <img src="${logoPath}" style="width: 80px; height: 80px; object-fit: contain;" onerror="this.style.display='none'">
                            </div>
                            <div style="flex: 1; text-align: center;">
                                <h1 style="margin: 0; color: #0f2e53; font-size: 24px; font-weight: bold; letter-spacing: 1px;">GOVT BOYS/GIRLS</h1>
                                <h2 style="margin: 3px 0 5px; color: #0f2e53; font-size: 16px; font-weight: bold;">HIGHER SECONDARY SCHOOL YOUNUSABAD</h2>
                                <div style="display: flex; align-items: center; justify-content: center;">
                                    <div style="flex: 1; height: 1px; background: #c29b4b;"></div>
                                    <span style="color: #0f2e53; margin: 0 10px; font-size: 10px;">★</span>
                                    <div style="flex: 1; height: 1px; background: #c29b4b;"></div>
                                </div>
                                <h2 style="margin: 5px 0 0; color: #0f2e53; font-size: 18px; font-weight: bold; letter-spacing: 2px;">ADMISSION FORM</h2>
                            </div>
                        </div>

                        <!-- Office Use Box -->
                        <div style="display: flex; justify-content: space-between; align-items: stretch; margin-bottom: 10px;">
                            <div style="border: 1px solid #0f2e53; padding: 5px 10px; display: flex; align-items: center; gap: 10px; flex: 1; margin-right: 15px;">
                                <span style="font-size: 11px; font-weight: bold; color: #0f2e53;">(Office Use Only)</span>
                                <span style="font-size: 11px; font-weight: bold;">G.R. No.</span>
                                <div>${generateBoxes(6)}</div>
                                <span style="font-size: 11px; font-weight: bold; margin-left: 10px;">Year</span>
                                <div>${generateBoxes(4)}</div>
                            </div>
                            <div style="width: 80px; height: 90px; border: 1px solid #0f2e53; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; color: #0f2e53;">
                                PHOTO
                            </div>
                        </div>

                        <!-- Section 1 -->
                        <div style="background: #0f2e53; color: white; padding: 3px 8px; font-size: 12px; font-weight: bold; display: inline-block; margin-bottom: 8px;">1. STUDENT INFORMATION</div>
                        
                        <div style="font-size: 11px; line-height: 1.6; margin-bottom: 10px;">
                            <div style="display: flex; margin-bottom: 6px;">
                                <span style="width: 140px; font-weight: bold;">Name of Student:</span>
                                <div>${longGrid}</div>
                            </div>
                            <div style="display: flex; margin-bottom: 6px;">
                                <span style="width: 140px; font-weight: bold;">Father's Name:</span>
                                <div>${longGrid}</div>
                            </div>
                            
                            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                                <div style="display: flex; align-items: center;">
                                    <span style="font-weight: bold; margin-right: 10px;">Date of Birth (in Figures):</span>
                                    ${generateBoxes(2)} <span style="margin: 0 3px;">/</span> ${generateBoxes(2)} <span style="margin: 0 3px;">/</span> ${generateBoxes(4)}
                                </div>
                                <div style="display: flex; align-items: center;">
                                    <span style="font-weight: bold; margin-right: 10px;">Gender:</span>
                                    <div style="width:10px; height:10px; border:1px solid #000; margin-right:4px;"></div> Male
                                    <div style="width:10px; height:10px; border:1px solid #000; margin-left:12px; margin-right:4px;"></div> Female
                                </div>
                            </div>
                            
                            <div style="display: flex; margin-bottom: 6px;">
                                <span style="width: 140px; font-weight: bold;">Date of Birth (in Words):</span>
                                <span style="border-bottom: 1px solid #000; flex: 1;"></span>
                            </div>
                            
                            <div style="display: flex; gap: 15px; margin-bottom: 6px;">
                                <div style="flex: 1; display: flex;">
                                    <span style="width: 110px; font-weight: bold;">Place of Birth:</span>
                                    <span style="border-bottom: 1px solid #000; flex: 1;"></span>
                                </div>
                                <div style="flex: 1; display: flex;">
                                    <span style="width: 110px; font-weight: bold;">Mother Tongue:</span>
                                    <span style="border-bottom: 1px solid #000; flex: 1;"></span>
                                </div>
                            </div>

                            <div style="display: flex; gap: 15px; margin-bottom: 6px;">
                                <div style="flex: 1; display: flex;">
                                    <span style="width: 110px; font-weight: bold;">Religion:</span>
                                    <span style="border-bottom: 1px solid #000; flex: 1;"></span>
                                </div>
                                <div style="flex: 1; display: flex;">
                                    <span style="width: 150px; font-weight: bold;">Physically Disabled (if any):</span>
                                    <span style="border-bottom: 1px solid #000; flex: 1;"></span>
                                </div>
                            </div>

                            <div style="display: flex; gap: 15px; margin-bottom: 6px;">
                                <div style="flex: 1; display: flex;">
                                    <span style="width: 110px; font-weight: bold;">Nationality:</span>
                                    <span style="border-bottom: 1px solid #000; flex: 1;"></span>
                                </div>
                                <div style="flex: 1; display: flex; align-items: center;">
                                    <span style="width: 110px; font-weight: bold;">CNIC / B-Form No.:</span>
                                    <div>${cnicGrid}</div>
                                </div>
                            </div>
                        </div>

                        <!-- Section 2 -->
                        <div style="background: #0f2e53; color: white; padding: 3px 8px; font-size: 12px; font-weight: bold; display: inline-block; margin-bottom: 8px;">2. CONTACT & ADDRESS INFORMATION</div>
                        
                        <div style="font-size: 11px; line-height: 1.6; margin-bottom: 10px;">
                            <div style="display: flex; margin-bottom: 6px;">
                                <span style="width: 140px; font-weight: bold;">Residence Address:</span>
                                <span style="border-bottom: 1px solid #000; flex: 1;"></span>
                            </div>
                            
                            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                                <div style="display: flex; align-items: center;">
                                    <span style="width: 110px; font-weight: bold;">Telephone No.:</span>
                                    <div>${generateBoxes(11)}</div>
                                </div>
                                <div style="display: flex; align-items: center;">
                                    <span style="width: 90px; font-weight: bold;">Mobile No.:</span>
                                    <div>${generateBoxes(11)}</div>
                                </div>
                            </div>

                            <div style="display: flex; margin-bottom: 6px;">
                                <span style="width: 110px; font-weight: bold;">Email (if any):</span>
                                <span style="border-bottom: 1px solid #000; flex: 1;"></span>
                            </div>
                        </div>

                        <!-- Section 3 -->
                        <div style="background: #0f2e53; color: white; padding: 3px 8px; font-size: 12px; font-weight: bold; display: inline-block; margin-bottom: 8px;">3. ACADEMIC INFORMATION</div>
                        
                        <div style="font-size: 11px; line-height: 1.6; margin-bottom: 10px;">
                            <div style="display: flex; margin-bottom: 6px;">
                                <span style="width: 150px; font-weight: bold;">Last School Attended:</span>
                                <span style="border-bottom: 1px solid #000; flex: 1;"></span>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                                <div style="display: flex; flex: 1;">
                                    <span style="width: 230px; font-weight: bold;">Class in Which Admission is Sought:</span>
                                    <span style="border-bottom: 1px solid #000; flex: 1; margin-right: 15px;"></span>
                                </div>
                                <div style="display: flex; align-items: center; width: 140px;">
                                    <span style="font-weight: bold; margin-right: 10px;">Orphan:</span>
                                    <div style="width:10px; height:10px; border:1px solid #000; margin-right:4px;"></div> Yes
                                    <div style="width:10px; height:10px; border:1px solid #000; margin-left:8px; margin-right:4px;"></div> No
                                </div>
                            </div>
                        </div>

                        <!-- Section 4 -->
                        <div style="background: #0f2e53; color: white; padding: 3px 8px; font-size: 12px; font-weight: bold; display: inline-block; margin-bottom: 8px;">4. PARENT / GUARDIAN INFORMATION</div>
                        
                        <div style="font-size: 11px; line-height: 1.6; margin-bottom: 10px;">
                            <div style="display: flex; margin-bottom: 6px;">
                                <span style="width: 110px; font-weight: bold;">Guardian Name:</span>
                                <span style="border-bottom: 1px solid #000; flex: 1;"></span>
                            </div>
                            
                            <div style="display: flex; gap: 15px; margin-bottom: 6px;">
                                <div style="flex: 1; display: flex; align-items: center;">
                                    <span style="width: 80px; font-weight: bold;">CNIC No.:</span>
                                    <div>${generateBoxes(5)} <span style="margin: 0 3px;">-</span> ${generateBoxes(7)} <span style="margin: 0 3px;">-</span> ${generateBoxes(1)}</div>
                                </div>
                                <div style="flex: 1; display: flex;">
                                    <span style="width: 80px; font-weight: bold;">Profession:</span>
                                    <span style="border-bottom: 1px solid #000; flex: 1;"></span>
                                </div>
                            </div>

                            <div style="display: flex; margin-bottom: 6px;">
                                <span style="width: 80px; font-weight: bold;">Address:</span>
                                <span style="border-bottom: 1px solid #000; flex: 1;"></span>
                            </div>

                            <div style="display: flex; gap: 15px; margin-bottom: 6px;">
                                <div style="flex: 1; display: flex;">
                                    <span style="width: 110px; font-weight: bold;">Section (if any):</span>
                                    <span style="border-bottom: 1px solid #000; flex: 1;"></span>
                                </div>
                                <div style="flex: 1; display: flex; align-items: center;">
                                    <span style="width: 130px; font-weight: bold;">Date of Admission:</span>
                                    ${generateBoxes(2)} <span style="margin: 0 3px;">/</span> ${generateBoxes(2)} <span style="margin: 0 3px;">/</span> ${generateBoxes(4)}
                                </div>
                            </div>
                        </div>

                        <!-- Section 5 -->
                        <div style="background: #0f2e53; color: white; padding: 3px 8px; font-size: 12px; font-weight: bold; display: inline-block; margin-bottom: 8px;">5. REQUIRED DOCUMENTS (Please Attach)</div>
                        
                        <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; margin-bottom: 15px; padding: 0 5px;">
                            <div style="display: flex; align-items: center;"><div style="width:10px; height:10px; border:1px solid #000; margin-right:6px;"></div> 1. B-Form (CRC)</div>
                            <div style="display: flex; align-items: center;"><div style="width:10px; height:10px; border:1px solid #000; margin-right:6px;"></div> 2. Photographs (2)</div>
                            <div style="display: flex; align-items: center;"><div style="width:10px; height:10px; border:1px solid #000; margin-right:6px;"></div> 3. Father's CNIC Copy</div>
                            <div style="display: flex; align-items: center;"><div style="width:10px; height:10px; border:1px solid #000; margin-right:6px;"></div> 4. School Leaving Certificate</div>
                        </div>

                        <div style="text-align: center; color: #c29b4b; font-size: 16px; margin-bottom: 15px; flex-grow: 1;">
                            - - - - - - - - - - - - - - - - - - - - - - - - - - ★ - - - - - - - - - - - - - - - - - - - - - - - - - -
                        </div>

                        <!-- Signatures -->
                        <div style="display: flex; justify-content: space-between; text-align: center; font-size: 11px; font-weight: bold; margin-bottom: 20px;">
                            <div style="width: 180px;">
                                <div style="border-bottom: 1px solid #000; margin-bottom: 3px; height: 20px;"></div>
                                Parent / Guardian<br>Signature
                            </div>
                            <div style="width: 180px;">
                                <div style="border-bottom: 1px solid #000; margin-bottom: 3px; height: 20px;"></div>
                                Admission Incharge<br>Signature
                            </div>
                            <div style="width: 180px;">
                                <div style="border-bottom: 1px solid #000; margin-bottom: 3px; height: 20px;"></div>
                                Head Teacher / Principal<br>Signature
                            </div>
                        </div>

                        <!-- Office Use Footer -->
                        <div style="margin-top: auto; background: #eef2f6; border-radius: 6px; padding: 15px 10px 10px 10px; display: flex; justify-content: space-between; font-size: 11px; position: relative; border: 1px solid #cbd5e1;">
                            <div style="background: #0f2e53; color: white; padding: 3px 12px; font-weight: bold; border-radius: 15px; position: absolute; top: -10px; left: 50%; transform: translateX(-50%);">FOR OFFICE USE ONLY</div>
                            
                            <div style="flex: 1;">
                                <div style="display: flex; align-items: center; margin-bottom: 6px;">
                                    <span style="width: 120px; font-weight: bold;">Admission No.:</span>
                                    <div>${generateBoxes(6)}</div>
                                </div>
                                <div style="display: flex; align-items: center;">
                                    <span style="width: 120px; font-weight: bold;">Admission Approved:</span>
                                    <div style="width:10px; height:10px; border:1px solid #000; margin-right:4px;"></div> Yes
                                    <div style="width:10px; height:10px; border:1px solid #000; margin-left:12px; margin-right:4px;"></div> No
                                </div>
                            </div>
                            
                            <div style="flex: 1;">
                                <div style="display: flex; align-items: center; margin-bottom: 6px;">
                                    <span style="width: 70px; font-weight: bold;">Date:</span>
                                    ${generateBoxes(2)} <span style="margin: 0 3px;">/</span> ${generateBoxes(2)} <span style="margin: 0 3px;">/</span> ${generateBoxes(4)}
                                </div>
                                <div style="display: flex;">
                                    <span style="width: 70px; font-weight: bold;">Remarks:</span>
                                    <span style="border-bottom: 1px solid #000; flex: 1;"></span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        printArea.innerHTML = formHtml;
        window.print();
    },

    updateDashboardStats: () => {
        const applicants = DB.getApplicants();
        
        document.getElementById('stat-total-applicants').textContent = applicants.length;
        document.getElementById('stat-passed').textContent = applicants.filter(a => a.status === 'Passed' || a.status === 'Admitted').length;
        document.getElementById('stat-pending').textContent = applicants.filter(a => a.status === 'Pending').length;
    },

    loadApplicantsTable: () => {
        const query = document.getElementById('search-applicant') ? document.getElementById('search-applicant').value.toLowerCase() : '';
        const statusFilter = document.getElementById('filter-status') ? document.getElementById('filter-status').value : '';
        const tbody = document.getElementById('applicants-table-body');
        
        let applicants = DB.getApplicants();

        // Apply filters
        applicants = applicants.filter(a => {
            const matchesSearch = a.name.toLowerCase().includes(query) || a.phone.includes(query) || a.id.includes(query);
            const matchesStatus = statusFilter === '' || a.status === statusFilter;
            return matchesSearch && matchesStatus;
        });

        tbody.innerHTML = '';

        if(applicants.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#64748b; padding:20px;">No applicants found matching the criteria.</td></tr>';
            return;
        }

        applicants.forEach(a => {
            const tr = document.createElement('tr');
            
            let statusBadge = '';
            if (a.status === 'Pending') statusBadge = '<span class="status-badge status-pending">Pending</span>';
            else if (a.status === 'Passed') statusBadge = '<span class="status-badge status-passed">Passed</span>';
            else if (a.status === 'Failed') statusBadge = '<span class="status-badge status-failed">Failed</span>';
            else if (a.status === 'Admitted') statusBadge = '<span class="status-badge status-admitted">Admitted</span>';

            let actionsHtml = `
                <button class="action-icon" onclick="app.editApplicant('${a.id}')" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
                <button class="action-icon" onclick="app.printAdmitCard('${a.id}')" title="Print Admit Card"><i class="fa-solid fa-address-card"></i></button>
            `;

            if (a.status === 'Passed') {
                actionsHtml += `<button class="action-icon admit" onclick="app.admitApplicant('${a.id}')" title="Formally Admit"><i class="fa-solid fa-user-check"></i></button>`;
            }

            actionsHtml += `<button class="action-icon delete" onclick="app.deleteApplicant('${a.id}')" title="Delete"><i class="fa-solid fa-trash"></i></button>`;

            let marksDisplay = '--';
            if (a.marks && a.retestMarks) {
                marksDisplay = `${a.marks} <span style="color:#ef4444; font-size:10px;">|</span> <span style="color:#2563eb;">${a.retestMarks}</span>`;
            } else if (a.marks) {
                marksDisplay = a.marks;
            }

            tr.innerHTML = `
                <td><span class="reg-id">${a.id}</span></td>
                <td style="font-weight: 600;">${a.name}</td>
                <td>${a.fatherName}</td>
                <td>Class ${a.cls}</td>
                <td>${a.phone}</td>
                <td>${statusBadge}</td>
                <td style="text-align: center; font-weight: bold; color: ${a.marks ? '#0f172a' : '#cbd5e1'};">${marksDisplay}</td>
                <td style="display:flex; gap:8px;">${actionsHtml}</td>
            `;
            tbody.appendChild(tr);
        });
        
        app.updateDashboardStats();
    },

    filterApplicants: () => {
        app.loadApplicantsTable();
    }
};

window.onload = app.init;
