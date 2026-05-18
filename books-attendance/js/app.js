// Main Application Logic

const app = {
    currentScreen: 'dashboard',
    qrCodeObj: null,
    html5QrcodeScanner: null,
    chartInstance: null,

    init: () => {
        // Set Date Header
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        document.getElementById('current-date-display').textContent = new Date().toLocaleDateString('en-US', options);

        // Populate logo with base64 to avoid html2canvas tainting
        if (typeof schoolLogoBase64 !== 'undefined') {
            document.querySelectorAll('img').forEach(img => {
                const src = img.getAttribute('src');
                if(src && src.includes('logo.png')) img.src = schoolLogoBase64;
            });
        }

        // Navigation
        document.querySelectorAll('.nav-links li').forEach(link => {
            link.addEventListener('click', (e) => {
                document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
                const target = e.currentTarget;
                target.classList.add('active');
                app.switchScreen(target.getAttribute('data-target'));
            });
        });

        // Set Today's Date in Reports
        const todayStr = new Date().toISOString().split('T')[0];
        document.getElementById('report-date').value = todayStr;

        const currentMonthStr = todayStr.substring(0, 7);
        const monthFilterEl = document.getElementById('monthly-month-filter');
        if (monthFilterEl) monthFilterEl.value = currentMonthStr;

        const lessonMonthFilterEl = document.getElementById('lesson-month-filter');
        if (lessonMonthFilterEl) lessonMonthFilterEl.value = currentMonthStr;

        const diaryDateEl = document.getElementById('diary-date');
        if (diaryDateEl) diaryDateEl.value = todayStr;

        // Forms
        document.getElementById('add-student-form').addEventListener('submit', app.handleStudentSubmit);
        const fastEntryForm = document.getElementById('fast-entry-form');
        if (fastEntryForm) fastEntryForm.addEventListener('submit', app.handleFastEntrySubmit);
        const warningForm = document.getElementById('warning-letter-form');
        if (warningForm) warningForm.addEventListener('submit', app.handleWarningSubmit);
        document.getElementById('add-book-form').addEventListener('submit', app.handleBookSubmit);
        
        const updateStockForm = document.getElementById('update-stock-form');
        if (updateStockForm) updateStockForm.addEventListener('submit', app.handleUpdateStockSubmit);
        
        const removeStockForm = document.getElementById('remove-stock-form');
        if (removeStockForm) removeStockForm.addEventListener('submit', app.handleRemoveStockSubmit);

        const bulkStockForm = document.getElementById('bulk-stock-form');
        if (bulkStockForm) bulkStockForm.addEventListener('submit', app.handleBulkStockSubmit);
        
        const assignSpecificBookForm = document.getElementById('assign-specific-book-form');
        if (assignSpecificBookForm) assignSpecificBookForm.addEventListener('submit', app.handleAssignSpecificBookSubmit);

        // Initial Load
        app.updateDashboardStats();
        
        // Show Last Backup Info
        const lastBackupStr = localStorage.getItem('edu_last_backup');
        if(lastBackupStr) {
            const dateStr = new Date(lastBackupStr).toLocaleString();
            document.getElementById('last-backup-date').textContent = dateStr;
        }
        
        // Load Notification settings
        app.loadNotificationSettings();
        // Restore UI after printing
        window.addEventListener('afterprint', () => {
            document.body.classList.remove('single-print', 'bulk-print', 'print-roster');
        });
    },

    switchScreen: (screenId) => {
        // Stop scanner if leaving attendance screen
        if (app.currentScreen === 'attendance' && screenId !== 'attendance') {
            app.stopScanner();
        }

        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
        
        // Update Page Title
        const titles = {
            'dashboard': 'Dashboard',
            'students': 'Manage Students',
            'books': 'Library Management',
            'attendance': 'Mark Attendance',
            'daily-diary': 'Daily Diary',
            'monthly-attendance': 'Monthly Register',
            'lesson-progress': 'Sabaq Progress',
            'reports': 'Attendance Reports'
        };
        document.getElementById('page-title').textContent = titles[screenId];
        app.currentScreen = screenId;

        // Route specifics
        if (screenId === 'dashboard') app.updateDashboardStats();
        if (screenId === 'students') app.loadStudentsTable();
        if (screenId === 'books') app.loadBooksTable();
        if (screenId === 'attendance') { app.startScanner(); app.populateManualDropdown(); }
        if (screenId === 'daily-diary') app.loadDailyDiary();
        if (screenId === 'monthly-attendance') app.loadMonthlyAttendance();
        if (screenId === 'lesson-progress') {
            app.populateLessonClassSelect();
            if (!document.getElementById('lesson-month-filter').value) {
                const now = new Date();
                document.getElementById('lesson-month-filter').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            }
            app.loadLessonProgress();
        }
        if (screenId === 'reports') app.loadAttendanceReport();
        if (screenId === 'notifications') app.loadNotificationLogs();
    },

    // Modals
    showModal: (modalId) => {
        const modal = document.getElementById(modalId);
        modal.classList.add('show');
        if (modalId === 'assign-book-modal') {
            app.populateAssignSelects();
        }
    },

    closeModal: (modalId) => {
        document.getElementById(modalId).classList.remove('show');
    },

    cameraStream: null,
    selfieSegmentation: null,
    capturedImageBlob: null,

    openCameraModal: async () => {
        app.showModal('camera-modal');
        document.getElementById('camera-preview-container').style.display = 'none';
        document.getElementById('camera-container').style.display = 'block';
        document.getElementById('btn-capture-photo').style.display = 'block';
        document.getElementById('btn-retake-photo').style.display = 'none';
        document.getElementById('btn-use-photo').style.display = 'none';
        
        try {
            app.cameraStream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: "user",
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                } 
            });
            const video = document.getElementById('camera-video');
            video.srcObject = app.cameraStream;
            
            if (!app.selfieSegmentation) {
                document.getElementById('camera-loading').style.display = 'flex';
                document.getElementById('camera-loading-text').textContent = "Loading HD AI Model...";
                
                app.selfieSegmentation = new SelfieSegmentation({locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
                }});
                
                app.selfieSegmentation.setOptions({
                    modelSelection: 1, // 1 for landscape (better for portraits)
                    selfieMode: false,
                });
                
                app.selfieSegmentation.onResults(() => {});
                await app.selfieSegmentation.send({image: video});
                
                document.getElementById('camera-loading').style.display = 'none';
            }
        } catch (err) {
            console.error("Error accessing camera:", err);
            alert("Could not access camera. Please allow camera permissions.");
        }
    },

    closeCameraModal: () => {
        app.closeModal('camera-modal');
        if (app.cameraStream) {
            app.cameraStream.getTracks().forEach(track => track.stop());
            app.cameraStream = null;
        }
    },

    captureAndProcessPhoto: async () => {
        if (!app.selfieSegmentation) return;
        
        document.getElementById('camera-loading').style.display = 'flex';
        document.getElementById('camera-loading-text').textContent = "Processing HD Image...";
        
        const video = document.getElementById('camera-video');
        
        app.selfieSegmentation.onResults(async (results) => {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            
            // 1. Prepare Sharpened Mask to remove "shades"
            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = canvas.width;
            maskCanvas.height = canvas.height;
            const maskCtx = maskCanvas.getContext('2d');
            // High contrast removes semi-transparent "shades" at the edges
            maskCtx.filter = 'contrast(250%) brightness(100%)'; 
            maskCtx.drawImage(results.segmentationMask, 0, 0, canvas.width, canvas.height);
            
            // 2. Draw the person onto the main canvas
            ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
            
            // 3. Use 'destination-in' to keep only the person (clip by sharpened mask)
            ctx.globalCompositeOperation = 'destination-in';
            ctx.drawImage(maskCanvas, 0, 0, canvas.width, canvas.height);
            
            // 4. Create final canvas for background + person
            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = canvas.width;
            finalCanvas.height = canvas.height;
            const finalCtx = finalCanvas.getContext('2d');
            
            // 5. Fill background with a very clean Professional Blue
            finalCtx.fillStyle = '#0284c7'; // Solid Professional Blue
            finalCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
            
            // 6. Draw the clipped person on top with professional lighting
            finalCtx.filter = 'brightness(1.15) contrast(1.1) saturate(1.1)';
            finalCtx.drawImage(canvas, 0, 0);
            finalCtx.filter = 'none';
            
            const dataUrl = finalCanvas.toDataURL('image/jpeg', 0.98);
            document.getElementById('camera-preview-img').src = dataUrl;
            
            if (app.cameraStream) {
                app.cameraStream.getTracks().forEach(track => track.stop());
                app.cameraStream = null;
            }
            
            document.getElementById('camera-container').style.display = 'none';
            document.getElementById('camera-preview-container').style.display = 'block';
            
            document.getElementById('btn-capture-photo').style.display = 'none';
            document.getElementById('btn-retake-photo').style.display = 'block';
            document.getElementById('btn-use-photo').style.display = 'block';
            
            const res = await fetch(dataUrl);
            app.capturedImageBlob = await res.blob();
            document.getElementById('camera-loading').style.display = 'none';
        });

        await app.selfieSegmentation.send({image: video});
    },

    retakePhoto: () => {
        app.openCameraModal();
    },

    useCapturedPhoto: () => {
        if (!app.capturedImageBlob) return;
        const file = new File([app.capturedImageBlob], "student_photo.jpg", { type: "image/jpeg" });
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        document.getElementById('student-photo').files = dataTransfer.files;
        app.closeCameraModal();
    },

    // Students
    openAddStudentModal: () => {
        document.getElementById('add-student-form').reset();
        document.getElementById('edit-student-id').value = '';
        document.getElementById('student-modal-title').textContent = "Add New Student";
        
        // Re-enable fields for new student
        document.getElementById('student-class').removeAttribute('readonly');
        document.getElementById('student-grno').removeAttribute('readonly');
        document.getElementById('student-rollno').removeAttribute('readonly');
        
        const btnSaveNext = document.getElementById('btn-save-next');
        if(btnSaveNext) btnSaveNext.style.display = 'none';
        
        app.showModal('add-student-modal');
    },

    openFastEntryModal: () => {
        document.getElementById('fast-entry-form').reset();
        const filterClass = document.getElementById('filter-class').value;
        if(filterClass) document.getElementById('fast-class').value = filterClass;
        app.showModal('fast-entry-modal');
        setTimeout(() => document.getElementById('fast-grno').focus(), 100);
    },

    handleFastEntrySubmit: (e) => {
        e.preventDefault();
        const cls = document.getElementById('fast-class').value;
        const grno = document.getElementById('fast-grno').value;
        const rollno = document.getElementById('fast-rollno').value;
        const serialNo = document.getElementById('fast-serialno').value;
        const name = document.getElementById('fast-name').value;
        const fatherName = document.getElementById('fast-father').value;
        const phone = document.getElementById('fast-phone').value;
        const dob = document.getElementById('fast-dob').value;
        const cnic = document.getElementById('fast-cnic').value;
        const guardianCnic = document.getElementById('fast-guardian-cnic').value;
        const religion = document.getElementById('fast-religion').value;
        const status = document.getElementById('fast-status').value;
        DB.addStudent({ name, fatherName, cls, grno, rollno, serialNo, phone, dob, cnic, guardianCnic, religion, status, photo: null });
        
        app.loadStudentsTable();
        app.updateDashboardStats();
        
        document.getElementById('fast-entry-form').reset();
        document.getElementById('fast-class').value = cls;
        
        if (rollno) {
            document.getElementById('fast-rollno').value = parseInt(rollno) + 1;
        }
        if (serialNo) {
            document.getElementById('fast-serialno').value = parseInt(serialNo) + 1;
        }
        
        document.getElementById('fast-grno').focus();
    },

    exportToResultSystem: () => {
        const cls = prompt("Enter the Class/Grade to export to Result System (e.g., 4):");
        if(!cls) return;
        
        const allStudents = DB.getStudents();
        const classStudents = allStudents.filter(s => String(s.cls).toLowerCase() === String(cls).toLowerCase());
        
        if(classStudents.length === 0) {
            alert(`No students found for class ${cls}.`);
            return;
        }
        
        let examConfig = { sessionName: '2025-2026', sectionName: '' };
        try {
            const storedConfig = localStorage.getItem('examConfig');
            if(storedConfig) {
                examConfig = JSON.parse(storedConfig);
            }
        } catch(e) {}
        
        const sessionName = examConfig.sessionName || '2025-2026';
        const sectionName = prompt(`Enter Section for Class ${cls} (Leave empty if none, or matching your Result System):`, examConfig.sectionName || '');
        if(sectionName === null) return; 
        
        const targetKey = `studentsData_${cls}_${sectionName}_${sessionName}`.replace(/[^a-zA-Z0-9_-]/g, '_');
        
        let resultStudents = [];
        try {
            const existing = localStorage.getItem(targetKey);
            if(existing) resultStudents = JSON.parse(existing);
        } catch(e) {}
        
        let importedCount = 0;
        
        classStudents.forEach(bs => {
            const exists = resultStudents.find(rs => 
                (rs.grno && bs.grno && String(rs.grno) === String(bs.grno)) || 
                (String(rs.name).toLowerCase() === String(bs.name).toLowerCase())
            );
            
            if(!exists) {
                resultStudents.push({
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                    grno: bs.grno || '',
                    roll: bs.rollno || '',
                    name: bs.name || '',
                    fatherName: bs.fatherName || '',
                    photo: bs.photo || null,
                    status: 'Present',
                    marks: {},
                    grace: {}
                });
                importedCount++;
            }
        });
        
        if(importedCount > 0) {
            localStorage.setItem(targetKey, JSON.stringify(resultStudents));
            alert(`Successfully exported ${importedCount} new students to the Result System (Class: ${cls}, Section: ${sectionName}, Session: ${sessionName}).`);
        } else {
            alert(`No new students to export. All ${classStudents.length} students already exist in the Result System for this class.`);
        }
    },

    editStudent: (id) => {
        const student = DB.getStudents().find(s => s.id === id);
        if(!student) return;
        
        document.getElementById('edit-student-id').value = student.id;
        document.getElementById('student-name').value = student.name || '';
        document.getElementById('student-father').value = student.fatherName || '';
        document.getElementById('student-class').value = student.cls || '';
        document.getElementById('student-grno').value = student.grno || '';
        document.getElementById('student-rollno').value = student.rollno || '';
        document.getElementById('student-serialno').value = student.serialNo || '';
        document.getElementById('student-phone').value = student.phone || '';
        document.getElementById('student-dob').value = student.dob || '';
        document.getElementById('student-cnic').value = student.cnic || '';
        document.getElementById('student-guardian-cnic').value = student.guardianCnic || '';
        document.getElementById('student-religion').value = student.religion || 'ISLAM';
        document.getElementById('student-status').value = student.status || 'Active';
        document.getElementById('student-photo').value = ""; // Clear file input
        
        // Make non-editable fields readonly
        document.getElementById('student-class').setAttribute('readonly', 'true');
        
        document.getElementById('student-modal-title').textContent = "Edit Student";
        
        const btnSaveNext = document.getElementById('btn-save-next');
        if(btnSaveNext) btnSaveNext.style.display = 'block';
        
        app.showModal('add-student-modal');
    },

    openProfileModal: (studentId) => {
        const student = DB.getStudents().find(s => s.id === studentId);
        if(!student) return;
        document.getElementById('profile-student-id').value = student.id;
        document.getElementById('profile-student-name').textContent = student.name;
        document.getElementById('profile-student-class').textContent = student.cls ? `Class: ${student.cls}` : '';
        
        let status = student.status || 'Active';
        const statusBadge = document.getElementById('profile-student-status');
        statusBadge.textContent = status;
        statusBadge.className = status === 'Transferred' || status === 'T.C' || status === 'Long Absent' ? 'badge' : 'badge success';
        if(status === 'Transferred' || status === 'T.C' || status === 'Long Absent') {
            statusBadge.style.background = '#e11d48';
            statusBadge.style.color = 'white';
        } else if(status === 'Repeater' || status === 'Unpunctual') {
            statusBadge.style.background = '#f59e0b';
            statusBadge.style.color = 'white';
        } else if (status === 'New Admission') {
            statusBadge.style.background = '#0ea5e9';
            statusBadge.style.color = 'white';
        } else {
            statusBadge.style.background = '#10b981';
            statusBadge.style.color = 'white';
        }
        
        const photoContainer = document.getElementById('profile-student-photo');
        if (student.photo) {
            photoContainer.innerHTML = `<img src="${student.photo}" style="width: 100%; height: 100%; object-fit: cover;">`;
        } else {
            photoContainer.innerHTML = `<i class="fa-solid fa-user" style="font-size: 40px; color: #94a3b8;"></i>`;
        }
        app.showModal('student-profile-modal');
    },

    generateTC: () => {
        const studentId = document.getElementById('profile-student-id').value;
        const student = DB.getStudents().find(s => s.id === studentId);
        if(!student) return;

        app.closeModal('student-profile-modal');
        
        const printArea = document.getElementById('print-area');
        printArea.innerHTML = '';
        
        const logoPath = (typeof schoolLogoBase64 !== 'undefined') ? schoolLogoBase64 : 'logo.png';
        const dateStr = new Date().toLocaleDateString('en-GB'); 
        
        const letterHtml = `
            <div class="tc-page certificate-container" style="position: relative; padding: 40px; max-width: 800px; margin: 0 auto; background: white; color: black; line-height: 1.6; border: 6px double #2b5c7e; box-sizing: border-box; height: 100%; overflow: hidden;">
                <!-- Watermark -->
                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: 0.05; z-index: 0; width: 400px; height: 400px; background-image: url('${logoPath}'); background-size: contain; background-repeat: no-repeat; background-position: center;"></div>
                
                <!-- Corner Ornaments -->
                <div style="position: absolute; top: 5px; left: 5px; color: #2b5c7e; font-size: 24px; line-height: 1;">✥</div>
                <div style="position: absolute; top: 5px; right: 5px; color: #2b5c7e; font-size: 24px; line-height: 1;">✥</div>
                <div style="position: absolute; bottom: 5px; left: 5px; color: #2b5c7e; font-size: 24px; line-height: 1;">✥</div>
                <div style="position: absolute; bottom: 5px; right: 5px; color: #2b5c7e; font-size: 24px; line-height: 1;">✥</div>

                <div style="position: relative; z-index: 1;">
                    <div style="display: flex; align-items: center; border-bottom: 2px solid #2b5c7e; padding-bottom: 20px; margin-bottom: 30px;">
                        <img src="${logoPath}" style="width: 90px; height: 90px; object-fit: contain; margin-right: 20px;" onerror="this.style.display='none'">
                        <div style="flex: 1; text-align: center;">
                            <h1 style="margin: 0; font-size: 28px; font-weight: 800; text-transform: uppercase; color: #2b5c7e; font-family: 'Plus Jakarta Sans', sans-serif;">GBHSS YOUNUSABAD</h1>
                            <p style="margin: 5px 0 0; font-size: 15px; font-family: 'Plus Jakarta Sans', sans-serif; letter-spacing: 1px;">TRANSFER CERTIFICATE</p>
                        </div>
                        <div style="width: 90px;"></div>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; font-size: 15px; font-family: 'Times New Roman', serif; margin-bottom: 30px;">
                        <div><strong>Ref No:</strong> TC-${new Date().getFullYear()}-${Math.floor(Math.random()*10000)}</div>
                        <div><strong>Date:</strong> ${dateStr}</div>
                    </div>
                    
                    <div style="font-size: 16px; font-family: 'Times New Roman', serif; margin-bottom: 30px;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tbody>
                                <tr>
                                    <td style="padding: 10px 0; width: 30%; font-weight: bold;">Admission / GR No:</td>
                                    <td style="padding: 10px 0; border-bottom: 1px dashed #000;">${student.grno || '-'}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px 0; font-weight: bold;">Student's Name:</td>
                                    <td style="padding: 10px 0; border-bottom: 1px dashed #000; text-transform: uppercase;">${student.name}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px 0; font-weight: bold;">Student CNIC/B-Form:</td>
                                    <td style="padding: 10px 0; border-bottom: 1px dashed #000;">${student.cnic || '-'}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px 0; font-weight: bold;">Father's Name:</td>
                                    <td style="padding: 10px 0; border-bottom: 1px dashed #000; text-transform: uppercase;">${student.fatherName || '-'}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px 0; font-weight: bold;">Father/Guardian CNIC:</td>
                                    <td style="padding: 10px 0; border-bottom: 1px dashed #000;">${student.guardianCnic || '-'}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px 0; font-weight: bold;">Date of Birth:</td>
                                    <td style="padding: 10px 0; border-bottom: 1px dashed #000;">${student.dob ? new Date(student.dob).toLocaleDateString('en-GB') : '____________________'}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px 0; font-weight: bold;">Religion:</td>
                                    <td style="padding: 10px 0; border-bottom: 1px dashed #000;">${student.religion || 'ISLAM'}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px 0; font-weight: bold;">Class Left:</td>
                                    <td style="padding: 10px 0; border-bottom: 1px dashed #000;">${student.cls || '-'}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px 0; font-weight: bold;">Reason for Leaving:</td>
                                    <td style="padding: 10px 0; border-bottom: 1px dashed #000;">________________________________________</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    
                    <div style="font-size: 16px; font-family: 'Times New Roman', serif; text-align: justify; margin-bottom: 50px; line-height: 1.8;">
                        <p>This is to certify that the above mentioned student was a bona fide student of this institution. He/She has paid all school dues up to the date of leaving. His/Her character and conduct during the stay at this school have been satisfactory.</p>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 60px; font-family: 'Plus Jakarta Sans', sans-serif;">
                        <div style="text-align: center;">
                            <div style="border-bottom: 1px solid #000; width: 160px; margin-bottom: 10px;"></div>
                            <strong style="font-size: 14px;">Class Teacher</strong>
                        </div>
                        
                        <!-- Gold Seal Placeholder -->
                        <div class="seal"></div>

                        <div style="text-align: center;">
                            <div style="border-bottom: 1px solid #000; width: 160px; margin-bottom: 10px;"></div>
                            <strong style="font-size: 14px;">Office Clerk</strong>
                        </div>
                        <div style="text-align: center;">
                            <div style="border-bottom: 1px solid #000; width: 160px; margin-bottom: 10px;"></div>
                            <strong style="font-size: 14px;">Principal</strong>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        printArea.innerHTML = letterHtml;
        
        student.status = 'Transferred';
        DB.updateStudent(student);
        app.loadStudentsTable();

        document.body.classList.remove('single-print');
        document.body.classList.add('bulk-print');
        
        setTimeout(() => {
            window.print();
        }, 500);
    },

    generateProvisional: () => {
        const studentId = document.getElementById('profile-student-id').value;
        const student = DB.getStudents().find(s => s.id === studentId);
        if(!student) return;

        app.closeModal('student-profile-modal');
        
        const printArea = document.getElementById('print-area');
        printArea.innerHTML = '';
        
        const logoPath = (typeof schoolLogoBase64 !== 'undefined') ? schoolLogoBase64 : 'logo.png';
        const dateStr = new Date().toLocaleDateString('en-GB'); 
        
        const letterHtml = `
            <div class="provisional-page certificate-container" style="position: relative; padding: 50px; max-width: 800px; margin: 0 auto; background-color: #fdfbf7; color: #1a202c; line-height: 1.8; border: 15px solid transparent; border-image: repeating-linear-gradient(45deg, #2b5c7e, #2b5c7e 10px, #d4af37 10px, #d4af37 20px) 15; box-sizing: border-box; height: 100%; overflow: hidden;">
                
                <!-- Inner Gold Border -->
                <div style="position: absolute; top: 15px; left: 15px; right: 15px; bottom: 15px; border: 2px solid #d4af37; pointer-events: none; z-index: 1;"></div>

                <!-- Watermark -->
                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: 0.04; z-index: 0; width: 450px; height: 450px; background-image: url('${logoPath}'); background-size: contain; background-repeat: no-repeat; background-position: center;"></div>
                
                <div style="position: relative; z-index: 2; text-align: center;">
                    <img src="${logoPath}" style="width: 100px; height: 100px; object-fit: contain; margin-bottom: 15px;" onerror="this.style.display='none'">
                    
                    <h1 style="margin: 0; font-size: 26px; font-weight: 800; text-transform: uppercase; color: #2b5c7e; font-family: 'Plus Jakarta Sans', sans-serif; letter-spacing: 2px;">GBHSS YOUNUSABAD</h1>
                    
                    <div style="margin: 30px 0;">
                        <h2 style="display: inline-block; padding: 10px 30px; border-top: 2px solid #d4af37; border-bottom: 2px solid #d4af37; font-size: 24px; font-family: 'Times New Roman', serif; color: #2b5c7e; letter-spacing: 3px; font-weight: bold; margin: 0;">PROVISIONAL CERTIFICATE</h2>
                    </div>
                    
                    <div style="text-align: right; font-size: 14px; font-family: 'Times New Roman', serif; margin-bottom: 40px; padding-right: 20px;">
                        <strong>Date:</strong> ${dateStr}
                    </div>
                    
                    <div style="font-size: 18px; font-family: 'Georgia', serif; text-align: center; margin-bottom: 50px; padding: 0 40px;">
                        <p style="margin-bottom: 20px;">This is to proudly certify that</p>
                        <div style="font-family: 'Brush Script MT', 'Great Vibes', 'Edwardian Script ITC', cursive; font-size: 42px; color: #2b5c7e; margin: 20px 0; border-bottom: 1px solid #d4af37; display: inline-block; padding: 0 20px;">${student.name}</div>
                        <p style="margin-bottom: 20px;">son/daughter of <strong>${student.fatherName || '-'}</strong></p>
                        <p>is a bona fide student of this esteemed institution, bearing GR Number <strong>${student.grno || '-'}</strong>. He/She has been successfully enrolled in Class <strong>${student.cls || '-'}</strong>.</p>
                        <p style="margin-top: 20px;">This provisional certificate is being issued upon the request of the parent/guardian for reference purposes. His/Her character and conduct during their academic tenure are highly satisfactory.</p>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; margin-top: 100px; padding: 0 40px; font-family: 'Plus Jakarta Sans', sans-serif;">
                        <div style="text-align: center;">
                            <div style="border-bottom: 1px solid #2b5c7e; width: 220px; margin-bottom: 10px;"></div>
                            <strong style="color: #2b5c7e; font-size: 15px;">Class Teacher</strong>
                        </div>
                        <div style="text-align: center;">
                            <div style="border-bottom: 1px solid #2b5c7e; width: 220px; margin-bottom: 10px;"></div>
                            <strong style="color: #2b5c7e; font-size: 15px;">Principal Signature</strong>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        printArea.innerHTML = letterHtml;
        
        document.body.classList.remove('single-print');
        document.body.classList.add('bulk-print');
        
        setTimeout(() => {
            window.print();
        }, 500);
    },

    openWarningModal: (studentId) => {
        const student = DB.getStudents().find(s => s.id === studentId);
        if(!student) return;
        document.getElementById('warning-student-id').value = student.id;
        document.getElementById('warning-student-name').value = student.name;
        document.getElementById('warning-reason').value = '';
        app.showModal('warning-letter-modal');
    },

    handleWarningSubmit: (e) => {
        e.preventDefault();
        const studentId = document.getElementById('warning-student-id').value;
        const reason = document.getElementById('warning-reason').value;
        
        const student = DB.getStudents().find(s => s.id === studentId);
        if(!student) return;
        
        app.closeModal('warning-letter-modal');
        
        const printArea = document.getElementById('print-area');
        printArea.innerHTML = '';
        
        const logoPath = (typeof schoolLogoBase64 !== 'undefined') ? schoolLogoBase64 : 'logo.png';
        const dateStr = new Date().toLocaleDateString('en-GB'); 
        
        const letterHtml = `
            <div class="warning-letter-page certificate-container" style="padding: 50px 60px; font-family: 'Plus Jakarta Sans', sans-serif; max-width: 800px; margin: 0 auto; background: white; color: #1e293b; line-height: 1.6; box-sizing: border-box; height: 100%; border-left: 6px solid #ef4444; box-shadow: 0 0 20px rgba(0,0,0,0.05);">
                <div style="display: flex; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 40px;">
                    <img src="${logoPath}" style="width: 70px; height: 70px; object-fit: contain; margin-right: 20px;" onerror="this.style.display='none'">
                    <div style="flex: 1;">
                        <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #2b5c7e; letter-spacing: -0.5px;">GBHSS YOUNUSABAD</h1>
                        <p style="margin: 2px 0 0; font-size: 13px; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">School Management & Disciplinary Committee</p>
                    </div>
                </div>
                
                <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 40px; color: #475569;">
                    <div><strong>Ref No:</strong> WL-${new Date().getFullYear()}-${Math.floor(Math.random()*10000)}</div>
                    <div><strong>Date:</strong> ${dateStr}</div>
                </div>
                
                <div style="font-size: 16px; margin-bottom: 30px;">
                    <p style="margin: 0 0 5px 0;"><strong>To:</strong> Mr. ${student.fatherName || 'Parent/Guardian'}</p>
                    <p style="margin: 0 0 5px 0;"><strong>Father/Guardian of:</strong> ${student.name}</p>
                    <p style="margin: 0 0 5px 0;"><strong>Class:</strong> ${student.cls || '-'}</p>
                    <p style="margin: 0 0 20px 0;"><strong>GR No:</strong> ${student.grno || '-'}</p>
                </div>
                
                <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 25px; text-decoration: underline;">Subject: Formal Warning Notice</h2>
                
                <div style="font-size: 15px; text-align: left; margin-bottom: 40px; min-height: 200px; color: #334155;">
                    <p style="margin-bottom: 15px;">Dear Parent/Guardian,</p>
                    <p style="margin-bottom: 20px;">This correspondence serves as a formal warning notice from the school administration regarding your child, <strong>${student.name}</strong>, enrolled in Class <strong>${student.cls || '-'}</strong>. This action is being taken due to the following noted reason(s):</p>
                    
                    <div style="background: #f8fafc; padding: 20px 25px; border-radius: 8px; border-left: 4px solid #ef4444; margin: 25px 0; color: #0f172a; font-weight: 500;">
                        ${reason.replace(/\n/g, '<br>')}
                    </div>
                    
                    <p style="margin-bottom: 15px;">We uphold strict disciplinary and academic standards to ensure a conducive learning environment for all students. We urge you to treat this matter with the utmost urgency and request your presence at the administration office to discuss this issue.</p>
                    <p>Failure to rectify the situation may result in further disciplinary measures in accordance with institutional policy.</p>
                </div>
                
                <div style="display: flex; justify-content: space-between; margin-top: 80px;">
                    <div style="text-align: left;">
                        <div style="border-bottom: 1px solid #cbd5e1; width: 220px; margin-bottom: 8px;"></div>
                        <strong style="color: #0f172a; font-size: 14px;">Authorized Signature</strong><br>
                        <span style="color: #64748b; font-size: 12px;">Class Teacher / Coordinator</span>
                    </div>
                    <div style="text-align: left;">
                        <div style="border-bottom: 1px solid #cbd5e1; width: 220px; margin-bottom: 8px;"></div>
                        <strong style="color: #0f172a; font-size: 14px;">Principal Signature</strong><br>
                        <span style="color: #64748b; font-size: 12px;">GBHSS YOUNUSABAD</span>
                    </div>
                </div>
            </div>
        `;
        
        printArea.innerHTML = letterHtml;
        
        document.body.classList.remove('single-print');
        document.body.classList.add('bulk-print');
        
        setTimeout(() => {
            window.print();
        }, 500);
    },

    deleteStudent: (id) => {
        if(confirm('Are you sure you want to delete this student data?')) {
            DB.deleteStudent(id);
            app.loadStudentsTable();
            app.updateDashboardStats();
        }
    },

    filterStudents: () => {
        const query = document.getElementById('search-student').value.toLowerCase();
        const selectedClass = document.getElementById('filter-class').value.toLowerCase();
        const rows = document.querySelectorAll('#students-table-body tr');
        rows.forEach(row => {
            const textContent = row.textContent.toLowerCase();
            const classText = row.getAttribute('data-class') ? row.getAttribute('data-class').toLowerCase() : '';
            
            const matchesSearch = textContent.includes(query);
            const matchesClass = selectedClass === '' || classText === selectedClass;
            
            if (matchesSearch && matchesClass) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    },

    createBackup: () => {
        const data = {
            students: DB.getStudents(),
            attendance: DB.getAttendance(),
            books: DB.getBooks(),
            assignments: DB.getAssignments()
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const mins = String(now.getMinutes()).padStart(2, '0');
        const fileName = `school_backup_${yyyy}-${mm}-${dd}_${hh}-${mins}.json`;
        
        a.href = url;
        a.download = fileName;
        a.click();
        
        // Save backup date
        const isoString = now.toISOString();
        localStorage.setItem('edu_last_backup', isoString);
        document.getElementById('last-backup-date').textContent = new Date(isoString).toLocaleString();
        
        alert("✅ Backup generated successfully! File has been downloaded.");
    },

    handleRestoreFile: (e) => {
        const file = e.target.files[0];
        if(!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                
                // Validate required keys
                if(!data.students || !data.attendance || !data.books) {
                    throw new Error("Invalid backup file format. Missing required data blocks.");
                }
                
                if(confirm("⚠️ WARNING: Restoring will overwrite all current system data! Are you absolutely sure you want to proceed?")) {
                    localStorage.setItem('edu_students', JSON.stringify(data.students));
                    localStorage.setItem('edu_attendance', JSON.stringify(data.attendance));
                    localStorage.setItem('edu_books', JSON.stringify(data.books));
                    if(data.assignments) {
                        localStorage.setItem('edu_assignments', JSON.stringify(data.assignments));
                    }
                    
                    alert("✅ System data has been fully restored from backup. The page will now reload to apply changes.");
                    window.location.reload();
                }
            } catch(error) {
                alert("❌ Error restoring backup: " + error.message);
            }
            e.target.value = ''; // Reset input
        };
        reader.readAsText(file);
    },

    buildStudentListHTML: () => {
        const students = DB.getStudents();
        students.sort((a, b) => {
            const sA = parseInt(a.serialNo) || 999999;
            const sB = parseInt(b.serialNo) || 999999;
            return sA - sB;
        });
        const selectedClass = document.getElementById('filter-class').value;
        const query = document.getElementById('search-student').value.toLowerCase();
        
        let filteredStudents = students.filter(student => {
            const matchesClass = selectedClass === '' || student.cls === selectedClass;
            const matchesSearch = student.name.toLowerCase().includes(query) || 
                                  (student.grno && student.grno.toLowerCase().includes(query)) ||
                                  (student.id && student.id.toLowerCase().includes(query));
            return matchesClass && matchesSearch;
        });
        
        if(filteredStudents.length === 0) {
            alert('No students to print/download based on current filters.');
            return null;
        }
        
        const logoPath = (typeof schoolLogoBase64 !== 'undefined') ? schoolLogoBase64 : 'logo.png';
        const dateStr = new Date().toLocaleDateString('en-GB');
        
        let classStr = selectedClass ? selectedClass : 'All Classes';
        // Auto-detect if all filtered students belong to the same class
        if (!selectedClass && filteredStudents.length > 0) {
            const firstClass = filteredStudents[0].cls;
            const allSameClass = filteredStudents.every(s => s.cls === firstClass);
            if (allSameClass && firstClass) {
                classStr = firstClass;
            }
        }
        
        let tableRows = filteredStudents.map((s, index) => {
            let status = s.status || 'Active';
            const issuedBooks = (s.books || []).filter(b => b.status === 'Assigned');
            const booksList = issuedBooks.map(b => b.title).join(', ');
            const booksQty = issuedBooks.length;

            return `
                <tr>
                    <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${s.serialNo || index + 1}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${s.rollno || '-'}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${s.grno || '-'}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px;">${s.name}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px;">${s.fatherName || '-'}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px; font-size: 10px;">${booksList || '<span style="color:#94a3b8;">None</span>'} ${booksQty > 0 ? `<strong>(${booksQty})</strong>` : ''}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${s.phone || '-'}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold;">${status}</td>
                </tr>
            `;
        }).join('');

        return `
            <div id="student-list-container" style="background: white; padding: 40px; color: black; font-family: 'Inter', sans-serif;">
                <div style="display: flex; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 20px;">
                    <img src="${logoPath}" style="width: 80px; height: 80px; object-fit: contain; margin-right: 20px;" onerror="this.style.display='none'">
                    <div style="flex: 1; text-align: center;">
                        <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #1e293b; text-transform: uppercase;">GBHSS YOUNUSABAD</h1>
                        <p style="margin: 5px 0 0; font-size: 16px; font-weight: 600;">Student Roster & Status Report</p>
                    </div>
                    <div style="width: 80px;"></div>
                </div>
                
                <div style="display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 14px; color: #475569;">
                    <div style="font-size: 18px; color: #1e293b;"><strong>Class:</strong> ${classStr}</div>
                    <div><strong>Date:</strong> ${dateStr}</div>
                    <div><strong>Total Students:</strong> ${filteredStudents.length}</div>
                </div>
                
                <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                    <thead>
                        <tr style="background-color: #f8fafc;">
                            <th style="border: 1px solid #cbd5e1; padding: 8px; width: 4%;">S.No</th>
                            <th style="border: 1px solid #cbd5e1; padding: 8px; width: 6%;">Roll</th>
                            <th style="border: 1px solid #cbd5e1; padding: 8px; width: 8%;">GR No</th>
                            <th style="border: 1px solid #cbd5e1; padding: 8px; width: 18%; text-align: left;">Student Name</th>
                            <th style="border: 1px solid #cbd5e1; padding: 8px; width: 14%; text-align: left;">Father Name</th>
                            <th style="border: 1px solid #cbd5e1; padding: 8px; width: 22%; text-align: left;">Books Issued (Qty)</th>
                            <th style="border: 1px solid #cbd5e1; padding: 8px; width: 12%;">Mobile No</th>
                            <th style="border: 1px solid #cbd5e1; padding: 8px; width: 8%;">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </div>
        `;
    },

    printStudentList: () => {
        const html = app.buildStudentListHTML();
        if(!html) return;
        
        const printArea = document.getElementById('print-area');
        printArea.innerHTML = html;
        
        document.body.classList.remove('single-print');
        document.body.classList.add('print-roster');
        
        setTimeout(() => {
            window.print();
        }, 200);
    },

    downloadStudentListImage: () => {
        const html = app.buildStudentListHTML();
        if(!html) return;
        
        // We need to render it to DOM temporarily so html2canvas can capture it
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.top = '-9999px';
        tempContainer.style.left = '0';
        tempContainer.style.width = '1000px'; // fixed width for good image quality
        tempContainer.innerHTML = html;
        document.body.appendChild(tempContainer);
        
        const targetElement = tempContainer.querySelector('#student-list-container');
        
        setTimeout(() => {
            html2canvas(targetElement, { scale: 2, useCORS: true }).then(canvas => {
                const link = document.createElement('a');
                link.download = `Student_List_${new Date().toISOString().split('T')[0]}.jpeg`;
                link.href = canvas.toDataURL('image/jpeg', 0.9);
                link.click();
                
                document.body.removeChild(tempContainer);
            }).catch(err => {
                console.error('Error generating image:', err);
                alert('Could not generate image. Please try again.');
                document.body.removeChild(tempContainer);
            });
        }, 500);
    },

    resetSystem: () => {
        if(confirm("🛑 EXTREME WARNING: You are about to DELETE ALL DATA. Students, books, and attendance will be lost forever. \n\nType 'RESET' in the next prompt if you want to proceed.")) {
            const code = prompt("Type 'RESET' to confirm formatting the entire database:");
            if(code === 'RESET') {
                localStorage.removeItem('edu_students');
                localStorage.removeItem('edu_attendance');
                localStorage.removeItem('edu_books');
                localStorage.removeItem('edu_assignments');
                localStorage.removeItem('edu_last_backup');
                
                alert("🗑️ Database formatted successfully. Reloading...");
                window.location.reload();
            } else {
                alert("Format cancelled.");
            }
        }
    },

    toggleDark: () => {
        document.body.classList.toggle('dark-mode');
    },

    handleStudentSubmit: (e) => {
        e.preventDefault();
        app.saveStudentData();
    },

    submitAndNextStudent: () => {
        const form = document.getElementById('add-student-form');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }
        
        app.saveStudentData(() => {
            const currentId = document.getElementById('edit-student-id').value;
            if (!currentId) return;
            
            const rows = Array.from(document.querySelectorAll('#students-table-body tr'));
            let foundCurrent = false;
            let nextStudentId = null;
            
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                if (row.style.display !== 'none') {
                    const badgeCell = row.querySelector('td:nth-child(2) span');
                    if(badgeCell) {
                        const idStr = badgeCell.textContent.trim();
                        if (foundCurrent) {
                            nextStudentId = idStr;
                            break;
                        }
                        if (idStr === currentId) {
                            foundCurrent = true;
                        }
                    }
                }
            }
            
            if (nextStudentId) {
                app.editStudent(nextStudentId);
            } else {
                app.closeModal('add-student-modal');
                alert("Reached the end of the filtered list.");
            }
        });
    },

    saveStudentData: (callback) => {
        const name = document.getElementById('student-name').value;
        const fatherName = document.getElementById('student-father').value;
        const cls = document.getElementById('student-class').value;
        const grno = document.getElementById('student-grno').value;
        const rollno = document.getElementById('student-rollno').value;
        const serialNo = document.getElementById('student-serialno').value;
        const phone = document.getElementById('student-phone').value;
        const dob = document.getElementById('student-dob').value;
        const cnic = document.getElementById('student-cnic').value;
        const guardianCnic = document.getElementById('student-guardian-cnic').value;
        const religion = document.getElementById('student-religion').value;
        const status = document.getElementById('student-status').value;
        const photoInput = document.getElementById('student-photo');
        const editId = document.getElementById('edit-student-id').value;
        
        const saveStudent = (photoData) => {
            if (editId) {
                let updatedData = { id: editId, name, fatherName, cls, grno, rollno, serialNo, phone, dob, cnic, guardianCnic, religion, status };
                if (photoData) updatedData.photo = photoData;
                DB.updateStudent(updatedData);
            } else {
                DB.addStudent({ name, fatherName, cls, grno, rollno, serialNo, phone, dob, cnic, guardianCnic, religion, status, photo: photoData });
            }
            
            if(!callback) {
                document.getElementById('add-student-form').reset();
                document.getElementById('edit-student-id').value = '';
                document.getElementById('student-modal-title').textContent = "Add New Student";
                app.closeModal('add-student-modal');
            }
            
            app.loadStudentsTable();
            app.updateDashboardStats();
            
            if(callback) callback();
        };

        if (photoInput.files && photoInput.files[0]) {
            const file = photoInput.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // Resize to max 150x150 to keep localStorage size extremely low
                    const maxSize = 150;
                    let width = img.width;
                    let height = img.height;
                    
                    if (width > height) {
                        if (width > maxSize) {
                            height *= maxSize / width;
                            width = maxSize;
                        }
                    } else {
                        if (height > maxSize) {
                            width *= maxSize / height;
                            height = maxSize;
                        }
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // Compress to JPEG format with 0.8 quality
                    const photoBase64 = canvas.toDataURL('image/jpeg', 0.8);
                    saveStudent(photoBase64);
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        } else {
            saveStudent(null);
        }
    },

    loadStudentsTable: () => {
        const students = DB.getStudents();
        students.sort((a, b) => {
            const sA = parseInt(a.serialNo) || 999999;
            const sB = parseInt(b.serialNo) || 999999;
            return sA - sB;
        });
        const tbody = document.getElementById('students-table-body');
        tbody.innerHTML = '';
        
        // Update Class Filter dropdown
        const classFilter = document.getElementById('filter-class');
        const currentSelection = classFilter.value;
        const uniqueClasses = [...new Set(students.map(s => s.cls).filter(c => c))].sort();
        classFilter.innerHTML = '<option value="">All Classes</option>';
        uniqueClasses.forEach(c => {
            const option = document.createElement('option');
            option.value = c;
            option.textContent = c;
            classFilter.appendChild(option);
        });
        classFilter.value = currentSelection;

        if (students.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="center-text text-muted">No students found.</td></tr>';
            return;
        }

        students.forEach(student => {
            const studentBooks = student.books || [];
            let booksHtml = '';
            if (studentBooks.length === 0) {
                booksHtml = '<span class="text-muted" style="font-size: 12px;">No books</span>';
            } else {
                const assignedBooks = studentBooks.filter(b => b.status !== 'Returned');
                if(assignedBooks.length === 0) {
                     booksHtml = '<span class="badge success" style="font-size: 11px;">All Returned</span>';
                } else {
                    booksHtml = assignedBooks.map(b => `<span class="badge" style="background: var(--primary-light); color: white; margin: 2px;">${b.title}</span>`).join(' ');
                }
            }

            const tr = document.createElement('tr');
            tr.setAttribute('data-class', student.cls);
            tr.innerHTML = `
                <td><input type="number" class="form-control" style="width: 70px; padding: 4px; text-align: center;" value="${student.serialNo || ''}" onchange="app.updateStudentSerial('${student.id}', this.value)" placeholder="-"></td>
                <td><span class="badge success">${student.id}</span></td>
                <td><strong>${student.name}</strong></td>
                <td>${student.cls}</td>
                <td style="max-width: 250px;">${booksHtml}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="app.openManageBooksModal('${student.id}')" title="Assign Books">
                        <i class="fa-solid fa-book-open"></i> Assign Books
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="app.showCustomQR('${student.id}')" style="margin-left: 8px;">
                        <i class="fa-solid fa-id-card"></i> ID
                    </button>
                    <button class="btn btn-sm" style="background:#0ea5e9; color:white; margin-left: 8px;" onclick="app.openProfileModal('${student.id}')" title="Profile & Docs">
                        <i class="fa-solid fa-user"></i> Docs
                    </button>
                    <button class="btn btn-sm btn-secondary ml-2" onclick="app.editStudent('${student.id}')" style="margin-left: 8px;">
                        <i class="fa-solid fa-pen"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-danger ml-2" onclick="app.deleteStudent('${student.id}')" style="margin-left: 8px;">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    updateStudentSerial: (id, newSerial) => {
        const student = DB.getStudents().find(s => s.id === id);
        if(student) {
            student.serialNo = newSerial;
            DB.updateStudent(student);
            app.loadStudentsTable();
        }
    },

    // Syllabus Management
    getSyllabusForClass: (clsName) => {
        if (!clsName) return [];
        const match = clsName.match(/\d+/);
        if (!match) return [];
        const grade = match[0];
        
        // Define common syllabus books depending on the class grade digit
        return [
            `English Book ${grade}`,
            `Urdu Book ${grade}`,
            `Math Book ${grade}`,
            `Science Book ${grade}`,
            `Islamiat Book ${grade}`
        ];
    },

    openManageBooksModal: (studentId) => {
        const student = DB.getStudents().find(s => s.id === studentId);
        if (!student) return;

        document.getElementById('manage-books-student-id').value = student.id;
        document.getElementById('manage-books-student-name').textContent = student.name;
        
        app.renderSyllabusBooks(student);
        app.renderStudentBooksList(student);

        app.showModal('manage-student-books-modal');
    },

    renderSyllabusBooks: (student) => {
        const container = document.getElementById('syllabus-books-container');
        container.innerHTML = '';
        
        const match = student.cls ? student.cls.match(/\d+/) : null;
        const grade = match ? match[0] : '';
        
        const books = DB.getBooks().filter(b => b.class == grade);
        const existingBooks = student.books || [];

        if (books.length === 0) {
            container.innerHTML = '<span class="text-muted">No syllabus in inventory for this class. Please add stock.</span>';
            return;
        }

        books.forEach(book => {
            const isAssigned = existingBooks.some(b => b.bookId === book.id && b.status !== 'Returned');
            const noStock = book.availableQty <= 0;
            
            const btn = document.createElement('button');
            btn.className = isAssigned ? 'btn btn-sm btn-secondary' : (noStock ? 'btn btn-sm btn-danger' : 'btn btn-sm btn-primary');
            btn.style.opacity = (isAssigned || noStock) ? '0.6' : '1';
            btn.style.cursor = (isAssigned || noStock) ? 'default' : 'pointer';
            
            let statusText = isAssigned ? 'Assigned' : (noStock ? 'Out of Stock' : `Available: ${book.availableQty}`);
            btn.innerHTML = `<i class="fa-solid ${isAssigned ? 'fa-check' : 'fa-plus'}"></i> ${book.title} <small>(${statusText})</small>`;
            
            if (!isAssigned && !noStock) {
                btn.onclick = () => {
                    app.addBookToStudent(student.id, book.id);
                };
            }
            container.appendChild(btn);
        });
    },

    renderStudentBooksList: (student) => {
        const tbody = document.getElementById('student-books-table-body');
        tbody.innerHTML = '';
        const books = student.books || [];

        if (books.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="center-text text-muted">No books assigned yet.</td></tr>';
            return;
        }

        books.forEach((book, index) => {
            const isAssigned = book.status === 'Assigned';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding: 10px;"><strong>${book.title}</strong></td>
                <td style="padding: 10px;">
                    <span class="badge ${isAssigned ? 'warning' : 'success'}" style="font-size: 11px;">
                        ${book.status}
                    </span>
                </td>
                <td style="padding: 10px; text-align: right;">
                    ${isAssigned ? `<button class="btn btn-sm btn-success" onclick="app.receiveStudentBook('${student.id}', ${index})" title="Mark as Received" style="padding: 4px 8px;"><i class="fa-solid fa-check"></i></button>` : ''}
                    <button class="btn btn-sm btn-danger" onclick="app.removeStudentBook('${student.id}', ${index})" title="Remove completely (Undo)" style="padding: 4px 8px; margin-left: 4px;"><i class="fa-solid fa-xmark"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    addBookToStudent: (studentId, bookId) => {
        const student = DB.getStudents().find(s => s.id === studentId);
        const book = DB.getBooks().find(b => b.id === bookId);
        if(!student || !book || book.availableQty <= 0) return;
        
        if(!student.books) student.books = [];
        student.books.push({ bookId: book.id, title: book.title, status: 'Assigned', date: new Date().toISOString() });
        DB.updateStudent(student);
        
        book.availableQty -= 1;
        book.assignedQty = (book.assignedQty || 0) + 1;
        
        if(!book.stockHistory) book.stockHistory = [];
        book.stockHistory.push({
            date: new Date().toISOString(),
            action: 'assign',
            qty: 1,
            studentName: student.name
        });
        DB.updateBook(book);
        
        app.renderSyllabusBooks(student);
        app.renderStudentBooksList(student);
        app.loadStudentsTable();
        app.updateDashboardStats();
    },

    removeStudentBook: (studentId, index) => {
        const student = DB.getStudents().find(s => s.id === studentId);
        if(!student || !student.books) return;
        
        const b = student.books[index];
        const isAssigned = b.status === 'Assigned';
        student.books.splice(index, 1);
        DB.updateStudent(student);
        
        const book = DB.getBooks().find(inventory => inventory.id === b.bookId);
        if (book) {
            if (isAssigned) {
                book.assignedQty = Math.max(0, (book.assignedQty || 0) - 1);
                book.availableQty += 1;
            } else {
                book.returnedQty = Math.max(0, (book.returnedQty || 0) - 1);
            }
            
            if(!book.stockHistory) book.stockHistory = [];
            book.stockHistory.push({
                date: new Date().toISOString(),
                action: 'undo_assign_or_return',
                qty: 1,
                reason: 'Admin completely removed record log',
                studentName: student.name
            });
            DB.updateBook(book);
        }
        
        app.renderSyllabusBooks(student);
        app.renderStudentBooksList(student);
        app.loadStudentsTable();
        app.updateDashboardStats();
    },

    receiveStudentBook: (studentId, index) => {
        const student = DB.getStudents().find(s => s.id === studentId);
        if(!student || !student.books) return;
        
        const b = student.books[index];
        b.status = 'Returned';
        b.returnDate = new Date().toISOString();
        DB.updateStudent(student);
        
        const book = DB.getBooks().find(inventory => inventory.id === b.bookId);
        if (book) {
            book.assignedQty = Math.max(0, (book.assignedQty || 0) - 1);
            book.returnedQty = (book.returnedQty || 0) + 1;
            book.availableQty += 1;
            
            if(!book.stockHistory) book.stockHistory = [];
            book.stockHistory.push({
                date: new Date().toISOString(),
                action: 'return',
                qty: 1,
                studentName: student.name
            });
            DB.updateBook(book);
        }
        
        app.renderSyllabusBooks(student);
        app.renderStudentBooksList(student);
        app.loadStudentsTable();
        app.updateDashboardStats();
    },


    // View QR & ID Card Logic
    showCustomQR: (id) => {
        const student = DB.getStudents().find(s => s.id === id);
        if (!student) return;

        app.showModal('view-qr-modal');
        document.getElementById('qr-student-name').textContent = student.name;
        document.getElementById('qr-student-father').textContent = student.fatherName || '-';
        document.getElementById('qr-student-class').textContent = student.cls;
        document.getElementById('qr-student-grno').textContent = student.grno || student.id;
        document.getElementById('qr-student-rollno').textContent = student.rollno || '-';
        document.getElementById('qr-student-phone').textContent = student.phone;
        
        const photoContainer = document.getElementById('id-card-photo-container');

        // Extract class number for the shield (e.g., "G 4" -> "4", "Class 5" -> "5")
        let shieldClass = "4"; // default
        if (student.cls) {
            const matches = student.cls.match(/\d+/);
            if (matches) {
                shieldClass = matches[0];
            } else if (student.cls.trim().length > 0) {
                shieldClass = student.cls.charAt(0).toUpperCase();
            }
        }
        const shieldEl = document.getElementById('qr-shield-class');
        if (shieldEl) shieldEl.textContent = shieldClass;

        if (student.photo) {
            photoContainer.innerHTML = `<img src="${student.photo}" class="id-student-photo" alt="Student Photo">`;
        } else {
            photoContainer.innerHTML = `<div class="id-student-photo"><i class="fa-solid fa-user"></i></div>`;
        }
        
        const qrContainer = document.getElementById('qrcode-container');
        qrContainer.innerHTML = '';
        
        app.qrCodeObj = new QRCode(qrContainer, {
            text: id, // The student ID is the QR content
            width: 140,
            height: 140,
            colorDark : "#2b2d42",
            colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.H
        });
    },

    printSingleCard: () => {
        document.body.classList.remove('bulk-print');
        document.body.classList.add('single-print');
        window.print();
    },

    generatePrintSheet: () => {
        const query = document.getElementById('search-student').value.toLowerCase();
        const selectedClass = document.getElementById('filter-class').value.toLowerCase();
        const allStudents = DB.getStudents();
        allStudents.sort((a, b) => {
            const sA = parseInt(a.serialNo) || 999999;
            const sB = parseInt(b.serialNo) || 999999;
            return sA - sB;
        });
        let studentsToPrint = allStudents.filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(query) || s.id.toLowerCase().includes(query) || (s.grno || '').toLowerCase().includes(query);
            const classText = (s.cls || '').toLowerCase();
            const matchesClass = selectedClass === '' || classText === selectedClass;
            return matchesSearch && matchesClass;
        });

        if (studentsToPrint.length === 0) {
            alert('No students found to print based on the current filters.');
            return;
        }

        const printArea = document.getElementById('print-area');
        printArea.innerHTML = '';

        studentsToPrint.forEach(student => {
            let shieldClass = "4";
            if (student.cls) {
                const matches = student.cls.match(/\d+/);
                if (matches) shieldClass = matches[0];
                else if (student.cls.trim().length > 0) shieldClass = student.cls.charAt(0).toUpperCase();
            }

            // Using the base64 logo populated in the app init
            const logoPath = (typeof schoolLogoBase64 !== 'undefined') ? schoolLogoBase64 : 'logo.png';
            
            const photoHtml = student.photo 
                ? `<img class="print-photo" src="${student.photo}" alt="Photo">`
                : `<div class="print-photo"><i class="fa-solid fa-user"></i></div>`;

            const qrId = 'print-qr-' + student.id + Math.floor(Math.random()*1000);

            const card = document.createElement('div');
            card.innerHTML = `
                <div class="print-card">
                    <div class="print-top">
                        <img class="print-logo" src="${logoPath}" onerror="this.style.display='none'">
                        <div class="print-badge">
                            <div class="print-badge-top">G</div>
                            <div>${shieldClass}</div>
                        </div>
                        <div class="print-school">GBHSS YOUNUSABAD</div>
                    </div>
                    <div class="print-body">
                        <div class="print-name">${student.name || '-'}</div>
                        <div class="print-main-row">
                            <div class="print-details">
                                <p><strong>Father Name:</strong><br><span style="font-size:2.8mm; line-height:1.15; display:inline-block; margin-top:0.5mm;">${student.fatherName || '-'}</span></p>
                                <p><strong>Class:</strong> ${student.cls || '-'}</p>
                                <p><strong>GR No:</strong> ${student.grno || '-'}</p>
                                <p><strong>Roll No:</strong> ${student.rollno || '-'}</p>
                                <p><strong>Phone:</strong> ${student.phone || '-'}</p>
                            </div>
                            <div class="print-right-col">
                                <div class="print-photo-container">
                                    ${photoHtml}
                                </div>
                                <div class="print-qr-wrap">
                                    <div class="print-qr-box" id="${qrId}"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="print-footer">DEVELOPED BY SHAH MEHMOOD ALI</div>
                </div>
            `;
            printArea.appendChild(card.firstElementChild);

            new QRCode(document.getElementById(qrId), {
                text: student.id,
                width: 80,
                height: 80,
                colorDark : "#2b2d42",
                colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.L
            });
        });

        document.body.classList.remove('single-print');
        document.body.classList.add('bulk-print');

        setTimeout(() => {
            window.print();
        }, 500);
    },

    printBlankSheet: () => {
        const printArea = document.getElementById('print-area');
        printArea.innerHTML = '';

        let tableRows = '';
        for(let i=1; i<=25; i++) {
            tableRows += `
                <tr>
                    <td>${i}</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                </tr>
            `;
        }

        const sheetHtml = `
            <div class="print-page-wrapper">
                <style>
                    .print-page-wrapper {
                        font-family: Arial, sans-serif;
                        color: #001b3a;
                        width: 100%;
                        margin: 0;
                        padding: 0;
                    }
                    .print-page-wrapper h1 {
                        text-align: center;
                        font-size: 28px;
                        margin: 0 0 4px 0;
                    }
                    .print-page-wrapper h2 {
                        text-align: center;
                        font-size: 18px;
                        margin: 0 0 12px 0;
                        font-weight: normal;
                    }
                    .print-page-wrapper table {
                        width: 100% !important;
                        border-collapse: collapse;
                        table-layout: fixed;
                        page-break-inside: avoid;
                    }
                    .print-page-wrapper th, .print-page-wrapper td {
                        border: 2px solid #000;
                        text-align: center;
                        vertical-align: middle;
                        height: 28px;
                        padding: 3px;
                        font-size: 13px;
                        color: #001b3a;
                        word-break: normal;
                        overflow-wrap: break-word;
                    }
                    .print-page-wrapper th {
                        height: 44px;
                        font-weight: bold;
                        line-height: 1.1;
                    }
                    .print-page-wrapper tr {
                        page-break-inside: avoid;
                    }
                    .col-sno { width: 6%; }
                    .col-full { width: 22%; }
                    .col-father { width: 22%; }
                    .col-class { width: 10%; }
                    .col-gr { width: 10%; }
                    .col-roll { width: 10%; }
                    .col-phone { width: 20%; }
                </style>

                <h1>GBHSS YOUNUSABAD</h1>
                <h2>Blank Admission / Data Entry Sheet</h2>

                <table>
                    <thead>
                        <tr>
                            <th class="col-sno">S.No</th>
                            <th class="col-full">Full Name</th>
                            <th class="col-father">Father Name</th>
                            <th class="col-class">Class</th>
                            <th class="col-gr">GR No</th>
                            <th class="col-roll">Roll No</th>
                            <th class="col-phone">Guardian Phone No.</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </div>
        `;

        printArea.innerHTML = sheetHtml;

        document.body.classList.remove('single-print');
        document.body.classList.add('bulk-print');

        const style = document.createElement('style');
        style.id = 'landscape-print-style';
        style.innerHTML = '@page { size: A4 landscape; margin: 8mm; } @media print { html, body { width: 297mm; height: 210mm; margin: 0; padding: 0; } #print-area { padding: 8mm; } }';
        document.head.appendChild(style);

        setTimeout(() => {
            window.print();
            const el = document.getElementById('landscape-print-style');
            if(el) el.remove();
        }, 500);
    },

    uploadBlankSheet: () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if(file) {
                alert("OCR processing requires backend API integration. Please use the Fast Entry button for manual data entry of this sheet.");
            }
        };
        input.click();
    },

    downloadIDCard: () => {
        const studentName = document.getElementById('qr-student-name').textContent;
        const cardArea = document.getElementById('id-card-print-area');
        
        // We use scale to increase resolution of the generated image
        html2canvas(cardArea, { 
            backgroundColor: null, 
            scale: 4,
            useCORS: true
        }).then(canvas => {
            const link = document.createElement('a');
            link.download = `ID_Card_${studentName.replace(/\s+/g, '_')}.png`;
            link.href = canvas.toDataURL("image/png");
            link.click();
        });
    },

    // Books
    handleBookSubmit: (e) => {
        e.preventDefault();
        const title = document.getElementById('book-title').value.trim();
        const cls = document.getElementById('book-class').value.trim();
        const subject = document.getElementById('book-subject').value.trim();
        const qty = parseInt(document.getElementById('book-qty').value) || 0;
        const editId = document.getElementById('edit-book-id').value;

        if (editId) {
            const books = DB.getBooks();
            const existing = books.find(b => b.id === editId);
            if (existing) {
                const oldTitle = existing.title;
                existing.title = title;
                existing.class = cls;
                existing.subject = subject;
                
                DB.updateBook(existing);

                // Synchronize title change in student records
                if (oldTitle !== title) {
                    const students = DB.getStudents();
                    let anyChanged = false;
                    students.forEach(s => {
                        if (s.books && Array.isArray(s.books)) {
                            s.books.forEach(sb => {
                                if (sb.bookId === editId) {
                                    sb.title = title;
                                    anyChanged = true;
                                }
                            });
                        }
                    });
                    if (anyChanged) {
                        localStorage.setItem('edu_students', JSON.stringify(students));
                    }
                }
                alert("✅ Book details updated successfully!");
            }
        } else {
            const books = DB.getBooks();
            // Check if book already exists
            const existing = books.find(b => b.title.toLowerCase() === title.toLowerCase() && b.class === cls);
            if (existing) {
                 existing.totalQty += qty;
                 existing.availableQty += qty;
                 DB.updateBook(existing);
            } else {
                 DB.addBook({ 
                     title, 
                     class: cls, 
                     subject, 
                     totalQty: qty, 
                     availableQty: qty, 
                     assignedQty: 0, 
                     returnedQty: 0,
                     isGovt: true 
                 });
            }
        }
        
        e.target.reset();
        app.closeModal('add-book-modal');
        app.loadBooksTable();
        app.updateDashboardStats();
    },

    openAddBookModal: () => {
        document.getElementById('add-book-form').reset();
        document.getElementById('edit-book-id').value = '';
        
        document.getElementById('book-qty').parentElement.style.display = 'block';
        document.getElementById('book-qty').setAttribute('required', 'true');
        document.getElementById('book-qty').setAttribute('min', '1');
        
        const modal = document.getElementById('add-book-modal');
        modal.querySelector('h2').textContent = "Add Govt Book / Update Stock";
        modal.querySelector('button[type="submit"]').textContent = "Add to Stock";
        
        app.showModal('add-book-modal');
    },

    editBook: (id) => {
        const book = DB.getBooks().find(b => b.id === id);
        if(!book) return;

        document.getElementById('edit-book-id').value = book.id;
        document.getElementById('book-title').value = book.title;
        document.getElementById('book-class').value = book.class;
        document.getElementById('book-subject').value = book.subject;
        document.getElementById('book-qty').value = 0;
        document.getElementById('book-qty').parentElement.style.display = 'none';
        document.getElementById('book-qty').removeAttribute('required');
        document.getElementById('book-qty').removeAttribute('min');

        const modal = document.getElementById('add-book-modal');
        modal.querySelector('h2').textContent = "Edit Book Details";
        modal.querySelector('button[type="submit"]').textContent = "Update Book Details";

        app.showModal('add-book-modal');
    },

    loadBooksTable: () => {
        const books = DB.getBooks();
        // Sort by class then by title
        books.sort((a, b) => parseInt(a.class || 0) - parseInt(b.class || 0) || a.title.localeCompare(b.title));
        
        const tbody = document.getElementById('books-table-body');
        tbody.innerHTML = '';

        if (books.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="center-text text-muted">No books found. Please add stock.</td></tr>';
            return;
        }

        books.forEach(book => {
            const tr = document.createElement('tr');
            const noStock = book.availableQty === 0;
            const lowStock = book.availableQty > 0 && book.availableQty < 5;
            
            let stockHtml = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <button class="btn btn-sm btn-secondary" onclick="app.quickRemoveStock('${book.id}')" style="padding: 2px 6px; border-radius: 4px;" ${book.availableQty <= 0 ? 'disabled' : ''}>-</button>
                    <span>${book.availableQty}</span>
                    <button class="btn btn-sm btn-secondary" onclick="app.quickAddStock('${book.id}')" style="padding: 2px 6px; border-radius: 4px;">+</button>
                </div>`;
            if (noStock) stockHtml += `<span class="badge danger" style="margin-top: 5px; display:inline-block;">Out of Stock</span>`;
            else if (lowStock) stockHtml += `<span class="badge warning" style="margin-top: 5px; display:inline-block;">Low Stock</span>`;

            tr.innerHTML = `
                <td>Class ${book.class || '-'}</td>
                <td><strong>${book.title}</strong></td>
                <td>${book.totalQty || 0}</td>
                <td>${stockHtml}</td>
                <td>${book.assignedQty || 0}</td>
                <td>${book.returnedQty || 0}</td>
                <td style="text-align: right;">
                    <button class="btn btn-sm btn-primary" onclick="app.openSingleStock('${book.id}')" title="Add Stock" style="padding: 4px 8px;"><i class="fa-solid fa-plus"></i></button>
                    <button class="btn btn-sm btn-danger" onclick="app.openRemoveStock('${book.id}')" title="Remove Stock" style="padding: 4px 8px; margin-left: 4px;"><i class="fa-solid fa-minus"></i></button>
                    <button class="btn btn-sm btn-secondary" onclick="app.openAssignSpecificModal('${book.id}')" title="Assign to Student" style="padding: 4px 8px; margin-left: 4px;"><i class="fa-solid fa-user-plus"></i></button>
                    <button class="btn btn-sm" style="background:#0ea5e9; color:white; padding: 4px 8px; margin-left: 4px;" onclick="app.editBook('${book.id}')" title="Edit Book Name/Details">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    ${book.assignedQty > 0 ? `<button class="btn btn-sm btn-success" onclick="app.openReturnSpecificModal('${book.id}')" title="Return Book" style="padding: 4px 8px; margin-left: 4px;"><i class="fa-solid fa-undo"></i></button>` : ''}
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    quickAddStock: (bookId) => {
        const book = DB.getBooks().find(b => b.id === bookId);
        if(!book) return;
        book.totalQty += 1;
        book.availableQty += 1;
        if(!book.stockHistory) book.stockHistory = [];
        book.stockHistory.push({ date: new Date().toISOString(), action: 'add', qty: 1, reason: 'Quick Add' });
        DB.updateBook(book);
        app.loadBooksTable();
        app.updateDashboardStats();
    },

    quickRemoveStock: (bookId) => {
        const book = DB.getBooks().find(b => b.id === bookId);
        if(!book || book.availableQty <= 0) return;
        book.availableQty -= 1;
        if(!book.stockHistory) book.stockHistory = [];
        book.stockHistory.push({ date: new Date().toISOString(), action: 'remove', qty: 1, reason: 'Quick Remove Admin' });
        DB.updateBook(book);
        app.loadBooksTable();
        app.updateDashboardStats();
    },

    openSingleStock: (bookId) => {
        const book = DB.getBooks().find(b => b.id === bookId);
        if(!book) return;
        
        document.getElementById('update-stock-book-id').value = book.id;
        document.getElementById('update-stock-book-name').textContent = book.title;
        document.getElementById('update-stock-qty').value = '';
        
        app.showModal('update-stock-modal');
    },

    openRemoveStock: (bookId) => {
        const book = DB.getBooks().find(b => b.id === bookId);
        if(!book) return;
        
        document.getElementById('remove-stock-book-id').value = book.id;
        document.getElementById('remove-stock-book-name').textContent = `${book.title} (Available: ${book.availableQty})`;
        document.getElementById('remove-stock-qty').value = '';
        document.getElementById('remove-stock-qty').max = book.availableQty;
        document.getElementById('remove-stock-reason').value = '';
        
        app.showModal('remove-stock-modal');
    },

    openBulkStock: () => {
        const books = DB.getBooks();
        const uniqueClasses = [...new Set(books.map(b => b.class).filter(c => c))].sort((a,b)=> parseInt(a)-parseInt(b));
        
        const select = document.getElementById('bulk-stock-class');
        select.innerHTML = '<option value="">-- Select Class --</option>';
        uniqueClasses.forEach(c => {
             const option = document.createElement('option');
             option.value = c;
             option.textContent = `Class ${c}`;
             select.appendChild(option);
        });
        
        document.getElementById('bulk-stock-qty').value = '';
        app.showModal('bulk-stock-modal');
    },

    handleUpdateStockSubmit: (e) => {
        e.preventDefault();
        const bookId = document.getElementById('update-stock-book-id').value;
        const qty = parseInt(document.getElementById('update-stock-qty').value) || 0;
        
        if(!bookId || qty <= 0) return;
        
        const book = DB.getBooks().find(b => b.id === bookId);
        if(book) {
            book.totalQty += qty;
            book.availableQty += qty;
            
            if(!book.stockHistory) book.stockHistory = [];
            book.stockHistory.push({
                date: new Date().toISOString(),
                action: 'add',
                qty: qty
            });
            
            DB.updateBook(book);
            app.closeModal('update-stock-modal');
            app.loadBooksTable();
            app.updateDashboardStats();
            
            alert(`✅ Successfully added ${qty} stock to ${book.title}.`);
        }
    },

    handleRemoveStockSubmit: (e) => {
        e.preventDefault();
        const bookId = document.getElementById('remove-stock-book-id').value;
        const qty = parseInt(document.getElementById('remove-stock-qty').value) || 0;
        const reason = document.getElementById('remove-stock-reason').value;
        
        if(!bookId || qty <= 0 || !reason) return;
        
        const book = DB.getBooks().find(b => b.id === bookId);
        if(book) {
            if (book.availableQty < qty) {
                alert(`Cannot remove ${qty}. Only ${book.availableQty} available.`);
                return;
            }
            
            book.availableQty -= qty;
            
            if(!book.stockHistory) book.stockHistory = [];
            book.stockHistory.push({
                date: new Date().toISOString(),
                action: 'remove',
                qty: qty,
                reason: reason
            });
            
            DB.updateBook(book);
            app.closeModal('remove-stock-modal');
            app.loadBooksTable();
            app.updateDashboardStats();
            alert(`✅ Successfully removed ${qty} stock from ${book.title}.`);
        }
    },

    handleBulkStockSubmit: (e) => {
        e.preventDefault();
        const cls = document.getElementById('bulk-stock-class').value;
        const qty = parseInt(document.getElementById('bulk-stock-qty').value) || 0;
        
        if(!cls || qty <= 0) return;
        
        const books = DB.getBooks().filter(b => b.class === cls);
        if(books.length === 0) {
            alert("No books found for this class.");
            return;
        }
        
        books.forEach(book => {
            book.totalQty += qty;
            book.availableQty += qty;
            if(!book.stockHistory) book.stockHistory = [];
            book.stockHistory.push({
                date: new Date().toISOString(),
                action: 'add',
                qty: qty,
                reason: 'Bulk System Update'
            });
            DB.updateBook(book);
        });
        
        app.closeModal('bulk-stock-modal');
        app.loadBooksTable();
        app.updateDashboardStats();
        alert(`✅ Successfully bulk added ${qty} stock to all Class ${cls} books.`);
    },

    openAssignSpecificModal: (bookId) => {
        const book = DB.getBooks().find(b => b.id === bookId);
        if(!book) return;
        
        if(book.availableQty <= 0) {
            alert(`⚠️ "${book.title}" is out of stock!`);
            return;
        }
        
        document.getElementById('assign-specific-book-id').value = book.id;
        document.getElementById('assign-specific-book-name').textContent = `Class ${book.class} - ${book.title} (Available: ${book.availableQty})`;
        
        const students = DB.getStudents();
        const uniqueClasses = [...new Set(students.map(s => s.cls).filter(c => c))].sort();
        
        const classSelect = document.getElementById('assign-specific-class');
        classSelect.innerHTML = '<option value="">-- All Classes --</option>';
        uniqueClasses.forEach(c => {
            const option = document.createElement('option');
            option.value = c;
            option.textContent = c;
            if(book.class && c.match(new RegExp(book.class))) {
                 option.selected = true; // Automatically preselect matching class
            }
            classSelect.appendChild(option);
        });
        
        app.renderAssignSpecificStudents();
        app.showModal('assign-specific-book-modal');
    },

    renderAssignSpecificStudents: () => {
        const selectedClass = document.getElementById('assign-specific-class').value;
        const bookId = document.getElementById('assign-specific-book-id').value;
        const students = DB.getStudents();
        
        let filtered = students;
        if (selectedClass) {
             filtered = students.filter(s => s.cls === selectedClass);
        }
        
        filtered.sort((a,b) => a.name.localeCompare(b.name));
        
        const studentSelect = document.getElementById('assign-specific-student');
        studentSelect.innerHTML = '<option value="">-- Select Student --</option>';
        
        filtered.forEach(s => {
             // Disable if student already has this book assigned and not returned
             const studentBooks = s.books || [];
             const alreadyAssigned = studentBooks.some(b => b.bookId === bookId && b.status !== 'Returned');
             
             const option = document.createElement('option');
             option.value = s.id;
             option.textContent = `${s.name} (${s.cls}) ${alreadyAssigned ? '- Already Assigned' : ''}`;
             if(alreadyAssigned) option.disabled = true;
             
             studentSelect.appendChild(option);
        });
    },

    handleAssignSpecificBookSubmit: (e) => {
        e.preventDefault();
        const bookId = document.getElementById('assign-specific-book-id').value;
        const studentId = document.getElementById('assign-specific-student').value;
        
        if(!bookId || !studentId) return;
        
        // Use existing function to assign
        app.addBookToStudent(studentId, bookId);
        
        app.closeModal('assign-specific-book-modal');
        alert("✅ Book Successfully Assigned!");
    },

    openReturnSpecificModal: (bookId) => {
        const book = DB.getBooks().find(b => b.id === bookId);
        if(!book) return;
        
        document.getElementById('return-specific-book-id').value = book.id;
        document.getElementById('return-specific-book-name').textContent = `Class ${book.class} - ${book.title}`;
        
        const students = DB.getStudents();
        const tbody = document.getElementById('return-specific-table-body');
        tbody.innerHTML = '';
        
        let found = false;
        students.forEach(s => {
             const studentBooks = s.books || [];
             studentBooks.forEach((b, index) => {
                 if(b.bookId === book.id && b.status !== 'Returned') {
                     found = true;
                     const tr = document.createElement('tr');
                     tr.innerHTML = `
                         <td><strong>${s.name}</strong></td>
                         <td>${s.cls}</td>
                         <td style="text-align: right;">
                              <button class="btn btn-sm btn-success" onclick="app.receiveSpecificStudentBook('${s.id}', ${index}, '${book.id}')">Receive</button>
                         </td>
                     `;
                     tbody.appendChild(tr);
                 }
             });
        });
        
        if(!found) {
             tbody.innerHTML = '<tr><td colspan="3" class="center-text text-muted">No students currently hold this book.</td></tr>';
        }
        
        app.showModal('return-specific-book-modal');
    },

    receiveSpecificStudentBook: (studentId, listIndex, bookId) => {
         app.receiveStudentBook(studentId, listIndex); // Re-use existing logic
         app.openReturnSpecificModal(bookId); // Refresh modal view
         alert("✅ Book Returned to Stock.");
    },

    // Attendance & Scanner
    startScanner: () => {
        if (!app.html5QrcodeScanner) {
            app.html5QrcodeScanner = new Html5Qrcode("qr-reader");
        }
        
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        
        app.html5QrcodeScanner.start(
            { facingMode: "environment" },
            config,
            app.onScanSuccess,
            (errorMessage) => {
                // Parse errors can be ignored
            }
        ).catch(err => {
            console.error("Camera error:", err);
            document.getElementById('qr-reader').innerHTML = '<div style="padding: 20px; color: red;">Error starting camera. Please ensure camera permissions are granted.</div>';
        });
    },

    stopScanner: () => {
        if (app.html5QrcodeScanner && app.html5QrcodeScanner.isScanning) {
            app.html5QrcodeScanner.stop().catch(err => console.error("Error stopping scanner", err));
        }
    },

    onScanSuccess: (decodedText, decodedResult) => {
        // decodedText should be the student ID
        const studentId = decodedText;
        const students = DB.getStudents();
        const student = students.find(s => s.id === studentId);

        const resultDiv = document.getElementById('scan-result');
        resultDiv.classList.remove('hidden');

        if (student) {
            const markObj = DB.markAttendance(studentId, 'Present');
            if (markObj.success) {
                resultDiv.innerHTML = `<i class="fa-solid fa-check-circle" style="font-size:24px; margin-bottom:10px;"></i><br>
                                     Successfully marked present: <strong>${student.name}</strong> (${student.cls})`;
                resultDiv.className = 'scan-result'; // reset to success style
                
                // Fire Notification API
                app.sendNotificationAlert(student, 'Present');
            } else {
                resultDiv.innerHTML = `<i class="fa-solid fa-info-circle" style="font-size:24px; margin-bottom:10px;"></i><br>
                                     <strong>${student.name}</strong>: ${markObj.message}`;
                resultDiv.className = 'scan-result';
                resultDiv.style.background = 'rgba(241, 196, 15, 0.1)';
                resultDiv.style.color = '#d35400';
            }
        } else {
            resultDiv.innerHTML = `<i class="fa-solid fa-times-circle" style="font-size:24px; margin-bottom:10px;"></i><br>
                                 Invalid QR Code. Student not found.`;
            resultDiv.className = 'scan-result';
            resultDiv.style.background = 'rgba(231, 76, 60, 0.1)';
            resultDiv.style.color = 'var(--danger)';
        }

        // Hide message after 3 seconds
        setTimeout(() => {
            resultDiv.classList.add('hidden');
        }, 3000);
    },

    populateManualDropdown: () => {
        const students = DB.getStudents().sort((a,b) => a.name.localeCompare(b.name));
        const select = document.getElementById('manual-att-student');
        if(!select) return;
        select.innerHTML = '<option value="">-- Select Student Manually --</option>';
        students.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = `${s.name} (Class ${s.cls}) - ${s.id}`;
            select.appendChild(opt);
        });
    },

    markManualAttendance: (status) => {
        const studentId = document.getElementById('manual-att-student').value;
        if(!studentId) {
            alert("Please select a student first.");
            return;
        }
        
        const student = DB.getStudents().find(s => s.id === studentId);
        const resultDiv = document.getElementById('scan-result');
        resultDiv.classList.remove('hidden');
        
        const markObj = DB.markAttendance(studentId, status);
        if (markObj.success) {
            resultDiv.innerHTML = `<i class="fa-solid fa-check-circle" style="font-size:24px; margin-bottom:10px;"></i><br>
                                 Manually marked ${status}: <strong>${student.name}</strong> (${student.cls})`;
            resultDiv.className = 'scan-result';
            if(status === 'Absent') {
                resultDiv.style.background = 'rgba(231, 76, 60, 0.1)';
                resultDiv.style.color = 'var(--danger)';
            }
            
            app.sendNotificationAlert(student, status);
        } else {
            resultDiv.innerHTML = `<i class="fa-solid fa-info-circle" style="font-size:24px; margin-bottom:10px;"></i><br>
                                 <strong>${student.name}</strong>: ${markObj.message}`;
            resultDiv.className = 'scan-result';
            resultDiv.style.background = 'rgba(241, 196, 15, 0.1)';
            resultDiv.style.color = '#d35400';
        }
        
        setTimeout(() => {
            resultDiv.classList.add('hidden');
        }, 4000);
    },
    
    // Notifications & API Integrations
    loadNotificationSettings: async () => {
        try {
            const response = await fetch('http://localhost:3000/api/settings');
            if(response.ok) {
                const settings = await response.json();
                const wa = document.getElementById('setting-notify-wa');
                const sms = document.getElementById('setting-notify-sms');
                const pres = document.getElementById('setting-notify-present');
                if(wa) wa.checked = settings.enableWhatsApp;
                if(sms) sms.checked = settings.enableSMS;
                if(pres) pres.checked = settings.sendPresentMessage;
            }
        } catch(e) {
            console.error("Backend not reachable for settings", e);
        }
    },
    
    saveNotificationSettings: async () => {
        const settings = {
            enableWhatsApp: document.getElementById('setting-notify-wa').checked,
            enableSMS: document.getElementById('setting-notify-sms').checked,
            sendPresentMessage: document.getElementById('setting-notify-present').checked
        };
        try {
            const response = await fetch('http://localhost:3000/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            if(response.ok) alert("✅ Notification settings updated on backend.");
        } catch(e) {
            alert("❌ Failed to save settings. Is backend running?");
        }
    },

    sendNotificationAlert: async (student, status) => {
        if (!student.phone || student.phone.trim() === '') {
            console.log("No phone for", student.name);
            return;
        }

        const payload = {
            studentName: student.name,
            fatherName: student.fatherName || '',
            className: student.cls,
            guardianPhone: student.phone,
            status: status,
            date: new Date().toISOString().split('T')[0]
        };

        try {
            // The backend does logic caching/duplicate checks now
            const response = await fetch('http://localhost:3000/api/send-attendance-alert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            // Update logs silently (done in background by backend, we just refresh UI)
            if (app.currentScreen === 'notifications') {
                app.loadNotificationLogs();
            }
        } catch (error) {
            console.error("Notification trigger error:", error);
        }
    },

    loadNotificationLogs: async () => {
        const tbody = document.getElementById('notification-logs-body');
        if(!tbody) return;
        
        try {
            const response = await fetch('http://localhost:3000/api/notification-logs');
            if(response.ok) {
                const logs = await response.json();
                tbody.innerHTML = '';
                if(logs.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" class="center-text text-muted">No communication logs recorded yet.</td></tr>';
                    return;
                }
                logs.forEach(log => {
                    const tr = document.createElement('tr');
                    let resBadge = log.success ? '<span class="badge success">Sent</span>' : `<span class="badge danger" title="${log.error}">Failed</span>`;
                    
                    const d = new Date(log.sentAt);
                    tr.innerHTML = `
                        <td style="font-size:12px;">${d.toLocaleString()}</td>
                        <td><strong>${log.studentName}</strong></td>
                        <td>${log.status === 'Present' ? '<span style="color:var(--success);">Present</span>' : '<span style="color:var(--danger);">' + log.status + '</span>'}</td>
                        <td>${log.channel || 'None'}</td>
                        <td>${resBadge}</td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        } catch(e) {
             tbody.innerHTML = '<tr><td colspan="5" class="center-text text-muted" style="color:red !important;">Backend Offline. Please run node server.js</td></tr>';
        }
    },

    testNotificationAPI: async () => {
        alert("Sending ping to backend configuration...");
        try {
            const response = await fetch('http://localhost:3000/api/test-notification', {
                method: 'POST'
            });
            const result = await response.json();
            if(result.success) {
                alert("✅ Awesome! Backend API Server is Live & Verified.\nMessage: " + result.message);
            } else {
                alert("❌ Server responded with an error.");
            }
        } catch(e) {
            alert("❌ Connection failed! Make sure you run 'node backend/server.js' in the terminal.");
        }
    },

    // Reports
    loadAttendanceReport: () => {
        const dateStr = document.getElementById('report-date').value;
        
        // Render Books Report Stats First
        const books = DB.getBooks();
        const students = DB.getStudents();
        let totalReceived = 0, totalDistributed = 0, totalReturned = 0, totalMissing = 0;
        
        books.forEach(b => {
             totalReceived += (b.totalQty || 0);
             totalDistributed += (b.assignedQty || 0) + (b.returnedQty || 0);
             totalReturned += (b.returnedQty || 0);
             totalMissing += (b.assignedQty || 0); // Assigned but not returned = Missing
        });
        
        document.getElementById('report-total-received').textContent = totalReceived;
        document.getElementById('report-total-distributed').textContent = totalDistributed;
        document.getElementById('report-total-returned').textContent = totalReturned;
        document.getElementById('report-total-missing').textContent = totalMissing;

        const missingTbody = document.getElementById('missing-table-body');
        missingTbody.innerHTML = '';
        
        let hasMissing = false;
        students.forEach(student => {
             const studentBooks = student.books || [];
             studentBooks.forEach(b => {
                 if (b.status === 'Assigned') { // Not returned
                     hasMissing = true;
                     const d = new Date(b.date).toLocaleDateString();
                     const tr = document.createElement('tr');
                     tr.innerHTML = `
                         <td><strong>${student.name}</strong></td>
                         <td>${student.cls}</td>
                         <td><span class="badge warning">${b.title}</span></td>
                         <td>${d}</td>
                     `;
                     missingTbody.appendChild(tr);
                 }
             });
        });
        if(!hasMissing) {
             missingTbody.innerHTML = '<tr><td colspan="4" class="center-text text-muted">No missing books! All returned. <span class="badge success">All Clear</span></td></tr>';
        }
    },

    printDistributionReport: () => {
         const students = DB.getStudents().filter(s => s.books && s.books.length > 0);
         let html = `<html><head><title>Book Distribution Report</title><style>
             body { font-family: Arial; padding: 20px; }
             table { width: 100%; border-collapse: collapse; margin-top: 20px; }
             th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
             th { background: #f4f7fb; }
             .badge { font-size: 11px; padding: 3px 6px; border-radius: 3px; }
             .warning { background: #f39c12; color: #fff; }
             .success { background: #27ae60; color: #fff; }
         </style></head><body>
         <h2>Govt School Book Distribution List</h2>
         <table>
            <thead><tr><th>Class</th><th>Student</th><th>Books Distributed</th><th>Missing Books</th></tr></thead>
            <tbody>
         `;
         if (students.length === 0) {
             html += '<tr><td colspan="4">No books have been distributed yet.</td></tr>';
         } else {
             students.sort((a, b) => parseInt(a.cls||0) - parseInt(b.cls||0));
             students.forEach(s => {
                 const allBooks = (s.books || []).map(b => b.title).join(', ');
                 const missing = (s.books || []).filter(b => b.status === 'Assigned').map(b => `<span class="badge warning">${b.title}</span>`).join(' ');
                 html += `<tr><td>${s.cls}</td><td><strong>${s.name}</strong></td><td>${allBooks}</td><td>${missing || '<span class="badge success">All Returned</span>'}</td></tr>`;
             });
         }
         html += `</tbody></table><p style="margin-top:20px;font-size:12px;">Generated on: ${new Date().toLocaleDateString()}</p></body></html>`;
         
         const win = window.open('', '_blank');
         win.document.write(html);
         win.document.close();
         win.print();
    },
    // Monthly Attendance Logic
    populateMonthlyClassSelect: () => {
        const students = DB.getStudents();
        const select = document.getElementById('monthly-class-filter');
        if(!select) return;
        const uniqueClasses = [...new Set(students.map(s => s.cls).filter(c => c))].sort();
        const currentVal = select.value;
        select.innerHTML = '<option value="">-- Select Class --</option>';
        uniqueClasses.forEach(c => {
            select.innerHTML += `<option value="${c}">Class ${c}</option>`;
        });
        select.value = currentVal;
    },

    loadMonthlyAttendance: () => {
        app.populateMonthlyClassSelect();
        
        const classFilter = document.getElementById('monthly-class-filter').value;
        const monthFilter = document.getElementById('monthly-month-filter').value;
        
        const headers = document.getElementById('monthly-attendance-headers');
        const body = document.getElementById('monthly-attendance-body');
        
        if (!classFilter || !monthFilter) {
            headers.innerHTML = '<th>Please select a class and month</th>';
            body.innerHTML = '';
            return;
        }

        const [year, month] = monthFilter.split('-');
        const daysInMonth = new Date(year, month, 0).getDate();
        
        let students = DB.getStudents().filter(s => String(s.cls) === String(classFilter));
        students.sort((a, b) => (parseInt(a.serialNo) || 9999) - (parseInt(b.serialNo) || 9999));

        let headersHtml = `
            <th style="min-width: 40px; position: sticky; left: 0; background: #f8fafc; z-index: 2;">S.No</th>
            <th style="min-width: 80px; position: sticky; left: 40px; background: #f8fafc; z-index: 2;">GR No</th>
            <th style="min-width: 150px; position: sticky; left: 120px; background: #f8fafc; z-index: 2;">Student Name</th>
        `;
        for (let i = 1; i <= daysInMonth; i++) {
            const dateObj = new Date(year, parseInt(month)-1, i);
            const isSunday = dateObj.getDay() === 0;
            const isSaturday = dateObj.getDay() === 6;
            const isHoliday = isSunday || isSaturday;
            
            const style = isHoliday ? 'background-color: #fca5a5; color: #7f1d1d;' : '';
            headersHtml += `<th style="min-width: 30px; text-align: center; padding: 4px; ${style}">${i}</th>`;
        }
        headersHtml += `
            <th style="min-width: 50px; text-align: center; background-color: #dcfce7; color: #166534; white-space: nowrap;">Total P</th>
            <th style="min-width: 50px; text-align: center; background-color: #fee2e2; color: #991b1b; white-space: nowrap;">Total A</th>
            <th style="min-width: 50px; text-align: center; background-color: #fef08a; color: #854d0e; white-space: nowrap;">Total L</th>
            <th style="min-width: 120px; text-align: center; background-color: #f8fafc;">Remarks</th>
        `;
        headers.innerHTML = headersHtml;
        
        const attendance = DB.getAttendance();
        
        if (students.length === 0) {
            body.innerHTML = `<tr><td colspan="${daysInMonth + 5}" class="center-text">No students found for this class.</td></tr>`;
            return;
        }

        const sundayStr = "SUNDAY";
        const satStr = "SATURDAY HOLIDAY";

        let bodyHtml = '';
        students.forEach((student, index) => {
            const remarksDb = DB.getMonthlyRemarks() || {};
            const remarkKey = `${student.id}_${year}-${month}`;
            const currentRemark = remarksDb[remarkKey] || '';

            let trHtml = `
                <td style="position: sticky; left: 0; background: white; z-index: 3; text-align: center;">${student.serialNo || index + 1}</td>
                <td style="position: sticky; left: 40px; background: white; z-index: 3; text-align: center; color: #1e293b; font-weight: bold;">${student.grno || '-'}</td>
                <td style="position: sticky; left: 120px; background: white; z-index: 3;"><strong>${student.name}</strong></td>
            `;
            
            let totalP = 0, totalA = 0, totalL = 0;
            
            const rollNum = parseInt(student.rollno);
            const isTcRoll = !isNaN(rollNum) && rollNum >= 56 && rollNum <= 67;
            const effectiveRemark = isTcRoll ? 'T.C' : currentRemark;
            
            if (effectiveRemark === 'T.C') {
                trHtml += `
                    <td colspan="${daysInMonth}" style="text-align: center; background: #f1f5f9; color: #dc2626; font-size: 18px; font-weight: 800; letter-spacing: 20px; position: relative; z-index: 2;">T.C</td>
                `;
            } else {
                for (let i = 1; i <= daysInMonth; i++) {
                    const dateStr = `${year}-${month}-${String(i).padStart(2, '0')}`;
                    const record = attendance.find(a => a.studentId === student.id && a.date.startsWith(dateStr));
                    
                    let cellStatus = '';
                    let cellClass = '';
                    
                    if (record) {
                        if (record.status === 'Present') { cellStatus = 'P'; cellClass = 'success'; totalP++; }
                        else if (record.status === 'Absent') { cellStatus = 'A'; cellClass = 'danger'; totalA++; }
                        else if (record.status === 'Leave') { cellStatus = 'L'; cellClass = 'warning'; totalL++; }
                    }
                    
                    const dateObj = new Date(year, parseInt(month)-1, i);
                    const isSunday = dateObj.getDay() === 0;
                    const isSaturday = dateObj.getDay() === 6;
                    const isHoliday = isSunday || isSaturday;
                    const holidayStyle = isHoliday ? 'background-color: #fee2e2;' : '';
                    
                    if (isHoliday) {
                        const char = isSunday 
                            ? (index < sundayStr.length ? sundayStr[index] : '') 
                            : (index < satStr.length ? satStr[index] : '');
                        trHtml += `<td style="padding: 2px; ${holidayStyle}; text-align: center; font-weight: 800; color: #dc2626; font-size: 13px;" class="attendance-cell">${char}</td>`;
                    } else {
                        // Color logic for input
                        let colorStyle = 'color: inherit; background-color: transparent;';
                        if (cellStatus === 'P') colorStyle = 'color: #166534; background-color: #dcfce7;';
                        else if (cellStatus === 'A') colorStyle = 'color: #991b1b; background-color: #fee2e2;';
                        else if (cellStatus === 'L') colorStyle = 'color: #854d0e; background-color: #fef08a;';
                        
                        trHtml += `
                            <td style="text-align: center; padding: 2px; ${holidayStyle}" class="attendance-cell">
                                <div tabindex="0" 
                                    style="width: 100%; height: 25px; line-height: 25px; text-align: center; font-weight: bold; border-radius: 2px; outline: none; cursor: pointer; border: 1px solid transparent; ${colorStyle}" 
                                    data-student-id="${student.id}"
                                    data-date="${dateStr}"
                                    onclick="app.toggleMonthlyAttendanceDiv(this)"
                                    onfocus="this.style.borderColor='#3b82f6'"
                                    onblur="this.style.borderColor='transparent'"
                                    onkeydown="app.handleMonthlyGridKeydown(event, this)">${cellStatus}</div>
                            </td>
                        `;
                    }
                }
            }

            trHtml += `
                <td style="text-align: center; font-weight: bold; color: #166534; background-color: #f0fdf4;">${totalP}</td>
                <td style="text-align: center; font-weight: bold; color: #991b1b; background-color: #fef2f2;">${totalA}</td>
                <td style="text-align: center; font-weight: bold; color: #854d0e; background-color: #fefce8;">${totalL}</td>
                <td style="padding: 2px; position: sticky; right: 0; background: white; z-index: 3;">
                    <input list="remarks-presets" type="text" class="remark-input" value="${effectiveRemark}" data-student-id="${student.id}" data-ym="${year}-${month}" onchange="app.saveMonthlyGridRemark(this)" placeholder="Add remark..." style="width: 100%; height: 25px; border: 1px solid transparent; background: transparent; padding: 0 4px; font-size: 11px; outline: none;" onfocus="this.style.border='1px solid #3b82f6'; this.style.background='white';" onblur="this.style.border='1px solid transparent'; this.style.background='transparent';">
                </td>
            `;
            
            bodyHtml += `<tr>${trHtml}</tr>`;
        });
        
        const datalistHtml = `
            <datalist id="remarks-presets">
                <option value="T.C">
                <option value="Unpunctual">
                <option value="Long Absent">
            </datalist>
        `;
        
        body.innerHTML = datalistHtml + bodyHtml;
    },

    toggleMonthlyAttendanceDiv: (divEl) => {
        let currentStatus = divEl.textContent.trim();
        let val = '';
        if (currentStatus === '') val = 'P';
        else if (currentStatus === 'P') val = 'A';
        else if (currentStatus === 'A') val = 'L';
        else if (currentStatus === 'L') val = 'U';
        else if (currentStatus === 'U') val = '';
        
        app.updateMonthlyAttendanceInput(divEl, val);
    },

    updateMonthlyAttendanceInput: (divEl, val) => {
        const studentId = divEl.getAttribute('data-student-id');
        const dateStr = divEl.getAttribute('data-date');
        
        if (val !== 'P' && val !== 'A' && val !== 'L') {
            val = '';
        }
        divEl.textContent = val;
        
        if (val === 'P') { divEl.style.color = '#166534'; divEl.style.backgroundColor = '#dcfce7'; }
        else if (val === 'A') { divEl.style.color = '#991b1b'; divEl.style.backgroundColor = '#fee2e2'; }
        else if (val === 'L') { divEl.style.color = '#854d0e'; divEl.style.backgroundColor = '#fef08a'; }
        else if (val === 'U') { divEl.style.color = '#ffffff'; divEl.style.backgroundColor = '#f59e0b'; }
        else { divEl.style.color = 'inherit'; divEl.style.backgroundColor = 'transparent'; }
        
        let newStatus = '';
        if (val === 'P') newStatus = 'Present';
        if (val === 'A') newStatus = 'Absent';
        if (val === 'L') newStatus = 'Leave';
        if (val === 'U') newStatus = 'Unpunctual';
        
        DB.updateAttendanceDate(studentId, dateStr, newStatus);
        app.updateRowTotals(divEl.closest('tr'));
    },

    updateRowTotals: (tr) => {
        const divs = tr.querySelectorAll('div[tabindex="0"]');
        let p = 0, a = 0, l = 0;
        divs.forEach(div => {
            const val = div.textContent.trim();
            if(val === 'P') p++;
            else if(val === 'A') a++;
            else if(val === 'L') l++;
        });
        const tds = tr.querySelectorAll('td');
        // Subtract 4 because the last column is now Remarks
        tds[tds.length - 4].textContent = p;
        tds[tds.length - 3].textContent = a;
        tds[tds.length - 2].textContent = l;
    },

    // Lesson Progress Logic
    populateLessonClassSelect: () => {
        const students = DB.getStudents();
        const select = document.getElementById('lesson-class-filter');
        if(!select) return;
        const uniqueClasses = [...new Set(students.map(s => s.cls).filter(c => c))].sort();
        const currentVal = select.value;
        select.innerHTML = '<option value="">-- Select Class --</option>';
        uniqueClasses.forEach(c => {
            select.innerHTML += `<option value="${c}">Class ${c}</option>`;
        });
        select.value = currentVal;
    },

    loadLessonProgress: () => {
        app.populateLessonClassSelect();
        
        const classFilter = document.getElementById('lesson-class-filter').value;
        const monthFilter = document.getElementById('lesson-month-filter').value;
        
        const headers = document.getElementById('lesson-progress-headers');
        const body = document.getElementById('lesson-progress-body');
        
        if (!classFilter || !monthFilter) {
            headers.innerHTML = '<th>Please select a class and month</th>';
            body.innerHTML = '';
            return;
        }

        const [year, month] = monthFilter.split('-');
        const daysInMonth = new Date(year, month, 0).getDate();
        
        let students = DB.getStudents().filter(s => String(s.cls) === String(classFilter));
        students.sort((a, b) => (parseInt(a.serialNo) || 9999) - (parseInt(b.serialNo) || 9999));

        let headersHtml = `
            <th style="min-width: 40px; position: sticky; left: 0; background: #f8fafc; z-index: 2;">S.No</th>
            <th style="min-width: 80px; position: sticky; left: 40px; background: #f8fafc; z-index: 2;">GR No</th>
            <th style="min-width: 150px; position: sticky; left: 120px; background: #f8fafc; z-index: 2;">Student Name</th>
        `;
        for (let i = 1; i <= daysInMonth; i++) {
            const dateObj = new Date(year, parseInt(month)-1, i);
            const isSunday = dateObj.getDay() === 0;
            const isSaturday = dateObj.getDay() === 6;
            const isHoliday = isSunday || isSaturday;
            
            const style = isHoliday ? 'background-color: #fca5a5; color: #7f1d1d;' : '';
            headersHtml += `<th style="min-width: 30px; text-align: center; padding: 4px; ${style}">${i}</th>`;
        }
        headersHtml += `
            <th style="min-width: 50px; text-align: center; background-color: #dcfce7; color: #166534; white-space: nowrap;">Total S</th>
            <th style="min-width: 50px; text-align: center; background-color: #fee2e2; color: #991b1b; white-space: nowrap;">Total X</th>
            <th style="min-width: 50px; text-align: center; background-color: #fef08a; color: #854d0e; white-space: nowrap;">Total H</th>
            <th style="min-width: 50px; text-align: center; background-color: #e2e8f0; color: #475569; white-space: nowrap;">Score %</th>
        `;
        headers.innerHTML = headersHtml;
        
        const progressData = DB.getLessonProgress();
        
        if (students.length === 0) {
            body.innerHTML = `<tr><td colspan="${daysInMonth + 7}" class="center-text">No students found for this class.</td></tr>`;
            return;
        }

        const sundayStr = "SUNDAY";
        const satStr = "SATURDAY HOLIDAY";

        let bodyHtml = '';
        students.forEach((student, index) => {
            const remarksDb = DB.getMonthlyRemarks() || {};
            const remarkKey = `${student.id}_${year}-${month}`;
            const effectiveRemark = remarksDb[remarkKey] || '';

            let trHtml = `
                <td style="position: sticky; left: 0; background: white; z-index: 3; text-align: center;">${student.serialNo || index + 1}</td>
                <td style="position: sticky; left: 40px; background: white; z-index: 3; text-align: center; color: #1e293b; font-weight: bold;">${student.grno || '-'}</td>
                <td style="position: sticky; left: 120px; background: white; z-index: 3;"><strong>${student.name}</strong></td>
            `;
            
            let totalS = 0, totalX = 0, totalH = 0;
            
            const rollNum = parseInt(student.rollno);
            const isTcRoll = !isNaN(rollNum) && rollNum >= 56 && rollNum <= 67;
            const isTC = isTcRoll || effectiveRemark === 'T.C';
            
            if (isTC) {
                trHtml += `
                    <td colspan="${daysInMonth}" style="text-align: center; background: #f1f5f9; color: #dc2626; font-size: 18px; font-weight: 800; letter-spacing: 20px; position: relative; z-index: 2;">T.C</td>
                `;
            } else {
                for (let i = 1; i <= daysInMonth; i++) {
                    const dateStr = `${year}-${month}-${String(i).padStart(2, '0')}`;
                    const record = progressData.find(p => p.studentId === student.id && p.date.startsWith(dateStr));
                    
                    let cellStatus = '';
                    let cellClass = '';
                    
                    if (record) {
                        if (record.status === 'S') { cellStatus = 'S'; cellClass = 'success'; totalS++; }
                        else if (record.status === 'X') { cellStatus = 'X'; cellClass = 'danger'; totalX++; }
                        else if (record.status === 'H') { cellStatus = 'H'; cellClass = 'warning'; totalH++; }
                        else if (record.status === 'A') { cellStatus = 'A'; cellClass = 'secondary'; }
                    }
                    
                    const dateObj = new Date(year, parseInt(month)-1, i);
                    const isSunday = dateObj.getDay() === 0;
                    const isSaturday = dateObj.getDay() === 6;
                    const isHoliday = isSunday || isSaturday;
                    const holidayStyle = isHoliday ? 'background-color: #fee2e2;' : '';
                    
                    if (isHoliday) {
                        const char = isSunday 
                            ? (index < sundayStr.length ? sundayStr[index] : '') 
                            : (index < satStr.length ? satStr[index] : '');
                        trHtml += `<td style="padding: 2px; ${holidayStyle}; text-align: center; font-weight: 800; color: #dc2626; font-size: 13px;" class="attendance-cell">${char}</td>`;
                    } else {
                        let colorStyle = 'color: inherit; background-color: transparent;';
                        if (cellStatus === 'S') colorStyle = 'color: #166534; background-color: #dcfce7;';
                        else if (cellStatus === 'X') colorStyle = 'color: #991b1b; background-color: #fee2e2;';
                        else if (cellStatus === 'H') colorStyle = 'color: #854d0e; background-color: #fef08a;';
                        else if (cellStatus === 'A') colorStyle = 'color: #334155; background-color: #e2e8f0;';
                        
                        trHtml += `
                            <td style="text-align: center; padding: 2px; ${holidayStyle}" class="attendance-cell">
                                <div tabindex="0" 
                                    style="width: 100%; height: 25px; line-height: 25px; text-align: center; font-weight: bold; border-radius: 2px; outline: none; cursor: pointer; border: 1px solid transparent; ${colorStyle}" 
                                    data-student-id="${student.id}"
                                    data-date="${dateStr}"
                                    onclick="app.toggleLessonProgressDiv(this)"
                                    onfocus="this.style.borderColor='#3b82f6'"
                                    onblur="this.style.borderColor='transparent'"
                                    onkeydown="app.handleLessonGridKeydown(event, this)">${cellStatus}</div>
                            </td>
                        `;
                    }
                }
            }

            let percentage = 0;
            const totalAttempted = totalS + totalX + totalH;
            if (totalAttempted > 0) {
                // S = 100%, H = 50%, X = 0%
                percentage = Math.round(((totalS * 1) + (totalH * 0.5)) / totalAttempted * 100);
            }

            let colorPerc = 'color: #475569';
            if(percentage >= 80) colorPerc = 'color: #166534';
            else if(percentage >= 50) colorPerc = 'color: #854d0e';
            else if(percentage > 0) colorPerc = 'color: #991b1b';

            trHtml += `
                <td style="text-align: center; font-weight: bold; color: #166534; background-color: #f0fdf4;">${totalS}</td>
                <td style="text-align: center; font-weight: bold; color: #991b1b; background-color: #fef2f2;">${totalX}</td>
                <td style="text-align: center; font-weight: bold; color: #854d0e; background-color: #fefce8;">${totalH}</td>
                <td style="text-align: center; font-weight: bold; background-color: #f8fafc; ${colorPerc}">${percentage}%</td>
            `;
            
            bodyHtml += `<tr>${trHtml}</tr>`;
        });
        
        body.innerHTML = bodyHtml;
    },

    toggleLessonProgressDiv: (divEl) => {
        let currentStatus = divEl.textContent.trim();
        let val = '';
        if (currentStatus === '') val = 'S';
        else if (currentStatus === 'S') val = 'X';
        else if (currentStatus === 'X') val = 'H';
        else if (currentStatus === 'H') val = 'A';
        else if (currentStatus === 'A') val = '';
        
        app.updateLessonProgressInput(divEl, val);
    },

    updateLessonProgressInput: (divEl, val) => {
        const studentId = divEl.getAttribute('data-student-id');
        const dateStr = divEl.getAttribute('data-date');
        
        if (val !== 'S' && val !== 'X' && val !== 'H' && val !== 'A') {
            val = '';
        }
        divEl.textContent = val;
        
        if (val === 'S') { divEl.style.color = '#166534'; divEl.style.backgroundColor = '#dcfce7'; }
        else if (val === 'X') { divEl.style.color = '#991b1b'; divEl.style.backgroundColor = '#fee2e2'; }
        else if (val === 'H') { divEl.style.color = '#854d0e'; divEl.style.backgroundColor = '#fef08a'; }
        else if (val === 'A') { divEl.style.color = '#334155'; divEl.style.backgroundColor = '#e2e8f0'; }
        else { divEl.style.color = 'inherit'; divEl.style.backgroundColor = 'transparent'; }
        
        DB.updateLessonProgress(studentId, dateStr, val);
        app.updateLessonRowTotals(divEl.closest('tr'));
    },

    updateLessonRowTotals: (tr) => {
        const divs = tr.querySelectorAll('div[tabindex="0"]');
        let s = 0, x = 0, h = 0;
        divs.forEach(div => {
            const val = div.textContent.trim();
            if(val === 'S') s++;
            else if(val === 'X') x++;
            else if(val === 'H') h++;
        });
        const tds = tr.querySelectorAll('td');
        tds[tds.length - 4].textContent = s;
        tds[tds.length - 3].textContent = x;
        tds[tds.length - 2].textContent = h;
        
        let percentage = 0;
        const totalAttempted = s + x + h;
        if (totalAttempted > 0) {
            percentage = Math.round(((s * 1) + (h * 0.5)) / totalAttempted * 100);
        }
        
        const percTd = tds[tds.length - 1];
        percTd.textContent = percentage + '%';
        if(percentage >= 80) percTd.style.color = '#166534';
        else if(percentage >= 50) percTd.style.color = '#854d0e';
        else if(percentage > 0) percTd.style.color = '#991b1b';
        else percTd.style.color = '#475569';
    },

    handleLessonGridKeydown: (e, divEl) => {
        const key = e.key.toUpperCase();
        if (['S', 'X', 'H', 'A'].includes(key)) {
            app.updateLessonProgressInput(divEl, key);
        } else if (e.key === 'Backspace' || e.key === 'Delete') {
            app.updateLessonProgressInput(divEl, '');
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const td = divEl.closest('td');
            const tr = td.closest('tr');
            const cellIndex = Array.from(tr.children).indexOf(td);
            const rowIndex = Array.from(tr.parentElement.children).indexOf(tr);
            
            let targetDiv = null;
            if (e.key === 'ArrowRight' && td.nextElementSibling) {
                targetDiv = td.nextElementSibling.querySelector('div[tabindex="0"]');
            } else if (e.key === 'ArrowLeft' && td.previousElementSibling) {
                targetDiv = td.previousElementSibling.querySelector('div[tabindex="0"]');
            } else if (e.key === 'ArrowDown' && tr.nextElementSibling) {
                targetDiv = tr.nextElementSibling.children[cellIndex].querySelector('div[tabindex="0"]');
            } else if (e.key === 'ArrowUp' && tr.previousElementSibling) {
                targetDiv = tr.previousElementSibling.children[cellIndex].querySelector('div[tabindex="0"]');
            }
            if (targetDiv) targetDiv.focus();
        }
    },

    printLessonProgress: () => {
        const classFilter = document.getElementById('lesson-class-filter').value;
        const monthFilter = document.getElementById('lesson-month-filter').value;
        
        if (!classFilter || !monthFilter) {
            alert('Please select a class and month first.');
            return;
        }

        const [year, month] = monthFilter.split('-');
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const monthName = monthNames[parseInt(month) - 1];

        const originalSection = document.getElementById('lesson-progress');
        const printArea = document.getElementById('print-area');
        
        const logoPath = (typeof schoolLogoBase64 !== 'undefined') ? schoolLogoBase64 : 'logo.png';
        const dateStr = new Date().toLocaleDateString('en-GB');
        
        // Convert input grid to static grid for printing to avoid input boxes
        const tableGrid = originalSection.querySelector('table').outerHTML;
        
        printArea.innerHTML = `
            <div style="background: white; padding: 20px; color: black; font-family: 'Inter', sans-serif;">
                <div style="display: flex; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 20px;">
                    <img src="${logoPath}" style="width: 80px; height: 80px; object-fit: contain; margin-right: 20px;" onerror="this.style.display='none'">
                    <div style="flex: 1; text-align: center;">
                        <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #1e293b; text-transform: uppercase;">GBHSS YOUNUSABAD</h1>
                        <p style="margin: 5px 0 0; font-size: 16px; font-weight: 600;">Monthly Sabaq / Lesson Progress Report</p>
                    </div>
                    <div style="width: 80px;"></div>
                </div>
                
                <div style="display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 14px; color: #475569;">
                    <div style="font-size: 18px; color: #1e293b;"><strong>Class:</strong> ${classFilter}</div>
                    <div><strong>Month:</strong> ${monthName} ${year}</div>
                    <div><strong>Date Printed:</strong> ${dateStr}</div>
                </div>

                <div class="table-container" style="border: 1px solid #e2e8f0;">
                    ${tableGrid}
                </div>
                
                <div style="margin-top: 20px; font-size: 12px; color: #64748b;">
                    <strong>Legend:</strong> S = Sunaya (Good), X = Nahi Sunaya (Fail), H = Half (Average), A = Absent
                </div>
            </div>
        `;
        
        document.body.classList.add('single-print');
        
        setTimeout(() => {
            window.print();
        }, 500);
    },


    populateDailyDiaryClassSelect: () => {
        const students = DB.getStudents();
        const select = document.getElementById('diary-class-filter');
        if(!select) return;
        const uniqueClasses = [...new Set(students.map(s => s.cls).filter(c => c))].sort();
        const currentVal = select.value;
        
        select.innerHTML = ''; // Removed 'All Classes' option
        uniqueClasses.forEach(c => {
            select.innerHTML += `<option value="${c}">Class ${c}</option>`;
        });
        
        if (currentVal && uniqueClasses.includes(currentVal)) {
            select.value = currentVal;
        } else if (uniqueClasses.length > 0) {
            select.value = uniqueClasses[0];
        }
    },

    loadDailyDiary: () => {
        app.populateDailyDiaryClassSelect();
        const dateStr = document.getElementById('diary-date').value;
        if (!dateStr) return;

        const classFilter = document.getElementById('diary-class-filter').value;
        
        const displayDate = new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        document.getElementById('diary-display-date').textContent = displayDate;
        
        // Don't show 'ALL', show the class name or a dash if not selected
        document.getElementById('diary-display-class').textContent = classFilter ? `Class ${classFilter}` : '---';

        let allStudents = DB.getStudents();
        if (classFilter) {
            allStudents = allStudents.filter(s => String(s.cls) === String(classFilter));
        }
        
        const attendance = DB.getAttendanceByDate(dateStr);

        let present = 0, absent = 0, unpunctual = 0;
        const absenteesList = [];
        const unp_56_67 = [];
        const unp_others = [];

        allStudents.forEach(student => {
            const record = attendance.find(a => a.studentId === student.id);
            const roll = parseInt(student.rollno);
            const isRange = !isNaN(roll) && roll >= 56 && roll <= 67;

            if (isRange) {
                unpunctual++;
                unp_56_67.push(student);
            } else {
                if (record) {
                    if (record.status === 'Present') {
                        present++;
                    } else if (record.status === 'Unpunctual') {
                        unpunctual++;
                        unp_others.push(student);
                    } else if (record.status === 'Absent') {
                        absent++;
                        absenteesList.push(student);
                    }
                } else {
                    // No record
                    absent++;
                    absenteesList.push(student);
                }
            }
        });

        document.getElementById('diary-total-enrolled').textContent = allStudents.length;
        document.getElementById('diary-total-present').textContent = present;
        document.getElementById('diary-total-absent').textContent = absent;
        document.getElementById('diary-total-unpunctual').textContent = unpunctual;

        // Populate Absentees Table
        const absBody = document.getElementById('diary-absentees-body');
        absBody.innerHTML = '';
        if (absenteesList.length === 0) {
            absBody.innerHTML = '<tr><td colspan="5" class="center-text text-muted">No absentees today!</td></tr>';
        } else {
            absenteesList.sort((a, b) => (parseInt(a.serialNo) || 999) - (parseInt(b.serialNo) || 999));
            absenteesList.forEach((s, i) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${i + 1}</td>
                    <td>${s.grno || '-'}</td>
                    <td>${s.rollno || '-'}</td>
                    <td><strong>${s.name}</strong></td>
                    <td>${s.fatherName || '-'}</td>
                `;
                absBody.appendChild(tr);
            });
        }

        // Populate Unpunctual 56-67 Table
        const unp5667Body = document.getElementById('diary-unpunctual-56-67-body');
        unp5667Body.innerHTML = '';
        if (unp_56_67.length === 0) {
            unp5667Body.innerHTML = '<tr><td colspan="4" class="center-text text-muted">No students from Roll 56-67 are unpunctual.</td></tr>';
        } else {
            unp_56_67.sort((a, b) => (parseInt(a.rollno) || 999) - (parseInt(b.rollno) || 999));
            unp_56_67.forEach((s, i) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${i + 1}</td>
                    <td>${s.grno || '-'}</td>
                    <td>${s.rollno || '-'}</td>
                    <td><strong>${s.name}</strong></td>
                `;
                unp5667Body.appendChild(tr);
            });
        }

        // Populate Other Unpunctual Table
        const unpOthersBody = document.getElementById('diary-unpunctual-others-body');
        unpOthersBody.innerHTML = '';
        if (unp_others.length === 0) {
            unpOthersBody.innerHTML = '<tr><td colspan="4" class="center-text text-muted">No other unpunctual students.</td></tr>';
        } else {
            unp_others.sort((a, b) => (parseInt(a.serialNo) || 999) - (parseInt(b.serialNo) || 999));
            unp_others.forEach((s, i) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${i + 1}</td>
                    <td>${s.grno || '-'}</td>
                    <td>${s.rollno || '-'}</td>
                    <td><strong>${s.name}</strong></td>
                `;
                unpOthersBody.appendChild(tr);
            });
        }
    },

    downloadAbsenteesList: () => {
        const section = document.getElementById('diary-absentees-section');
        const dateStr = document.getElementById('diary-date').value;
        app.captureDiarySection(section, `Absentees_List_${dateStr}`);
    },

    downloadUnpunctualList: () => {
        const section = document.getElementById('diary-unpunctual-section');
        const dateStr = document.getElementById('diary-date').value;
        app.captureDiarySection(section, `Unpunctual_List_${dateStr}`);
    },

    captureDiarySection: (element, filename) => {
        // Create a temporary container to style the section for capture
        const tempContainer = document.createElement('div');
        tempContainer.className = 'diary-paper';
        tempContainer.style.width = '800px';
        tempContainer.style.padding = '30px';
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px';
        
        // Add Header
        const header = document.querySelector('.diary-header').cloneNode(true);
        tempContainer.appendChild(header);
        
        // Add Section
        const sectionClone = element.cloneNode(true);
        sectionClone.style.marginTop = '20px';
        tempContainer.appendChild(sectionClone);
        
        document.body.appendChild(tempContainer);

        html2canvas(tempContainer, { 
            backgroundColor: '#ffffff', 
            scale: 2,
            useCORS: true
        }).then(canvas => {
            const link = document.createElement('a');
            link.download = filename + '.jpg';
            link.href = canvas.toDataURL("image/jpeg", 0.9);
            link.click();
            document.body.removeChild(tempContainer);
        });
    },

    downloadDailyDiaryImage: () => {
        const diaryContainer = document.getElementById('daily-diary-container');
        const dateStr = document.getElementById('diary-date').value;
        
        html2canvas(diaryContainer, { 
            backgroundColor: '#ffffff', 
            scale: 2,
            useCORS: true
        }).then(canvas => {
            const link = document.createElement('a');
            link.download = `Daily_Diary_${dateStr}.jpg`;
            link.href = canvas.toDataURL("image/jpeg", 0.9);
            link.click();
        });
    },
    
    saveMonthlyGridRemark: (inputEl) => {
        const studentId = inputEl.getAttribute('data-student-id');
        const ym = inputEl.getAttribute('data-ym');
        const val = inputEl.value;
        DB.saveMonthlyRemark(studentId, ym, val);
        
        if (val === 'T.C') {
            app.loadMonthlyAttendance(); 
        } else {
            const tr = inputEl.closest('tr');
            if (tr && tr.querySelector('td[colspan]')) {
                 app.loadMonthlyAttendance();
            }
        }
    },
    
    handleMonthlyGridKeydown: (e, divEl) => {
        const key = e.key.toUpperCase();
        if (key === 'P' || key === 'A' || key === 'L' || key === ' ' || e.key === 'BACKSPACE' || e.key === 'DELETE') {
            e.preventDefault();
            const val = (key === 'P' || key === 'A' || key === 'L') ? key : '';
            app.updateMonthlyAttendanceInput(divEl, val);
            if (val) {
                app.moveGridFocus(divEl, 'down');
            }
        } else if (e.key === 'ArrowDown') {
            app.moveGridFocus(divEl, 'down');
            e.preventDefault();
        } else if (e.key === 'ArrowUp') {
            app.moveGridFocus(divEl, 'up');
            e.preventDefault();
        } else if (e.key === 'ArrowRight') {
            app.moveGridFocus(divEl, 'right');
            e.preventDefault();
        } else if (e.key === 'ArrowLeft') {
            app.moveGridFocus(divEl, 'left');
            e.preventDefault();
        }
    },
    
    moveGridFocus: (divEl, direction) => {
        const td = divEl.closest('td');
        const tr = td.closest('tr');
        const colIndex = Array.from(tr.children).indexOf(td);
        
        let nextTr, nextTd, nextDiv;
        
        if (direction === 'down') {
            nextTr = tr.nextElementSibling;
            if (nextTr) nextTd = nextTr.children[colIndex];
        } else if (direction === 'up') {
            nextTr = tr.previousElementSibling;
            if (nextTr) nextTd = nextTr.children[colIndex];
        } else if (direction === 'right') {
            nextTd = td.nextElementSibling;
        } else if (direction === 'left') {
            nextTd = td.previousElementSibling;
        }
        
        if (nextTd) {
            nextDiv = nextTd.querySelector('div[tabindex="0"]');
            if (nextDiv) {
                nextDiv.focus();
            }
        }
    },

    printMonthlyAttendance: () => {
        const classFilter = document.getElementById('monthly-class-filter').value;
        const monthFilter = document.getElementById('monthly-month-filter').value;
        
        if (!classFilter || !monthFilter) {
            alert('Please select a class and month first.');
            return;
        }

        const [year, month] = monthFilter.split('-');
        const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
        
        const printArea = document.getElementById('print-area');
        const logoPath = (typeof schoolLogoBase64 !== 'undefined') ? schoolLogoBase64 : 'logo.png';
        
        const tableHtml = document.getElementById('monthly-attendance-table').outerHTML;
        
        const html = `
            <div style="padding: 10px; font-family: Arial, sans-serif;">
                <div style="display: flex; align-items: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px;">
                    <img src="${logoPath}" style="width: 80px; height: 80px; object-fit: contain; margin-right: 15px;" onerror="this.style.display='none'">
                    <div style="flex: 1; text-align: center;">
                        <h2 style="margin: 0; font-size: 24px; font-weight: 800;">GBHSS YOUNUSABAD</h2>
                        <h3 style="margin: 5px 0 0; font-size: 16px; font-weight: 600;">Monthly Attendance Register</h3>
                    </div>
                    <div style="width: 95px;"></div>
                </div>
                
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-weight: bold; font-size: 14px;">
                    <div>Class: ${classFilter}</div>
                    <div>Month: ${monthName} ${year}</div>
                </div>
                
                <style>
                    table.data-table { width: 100%; border-collapse: collapse; font-size: 10px; }
                    table.data-table th, table.data-table td { border: 1px solid #000; padding: 3px; text-align: center; }
                    table.data-table th:nth-child(2), table.data-table td:nth-child(2) { text-align: left; }
                    /* Make inputs look like text when printed */
                    table.data-table input { border: none !important; background: transparent !important; color: #000 !important; font-weight: bold; width: 100%; text-align: center; outline: none; }
                </style>
                
                ${tableHtml.replace(/position:\s*sticky;[^"]*/g, '')}
            </div>
        `;
        
        printArea.innerHTML = html;
        
        document.body.classList.remove('single-print');
        document.body.classList.add('bulk-print');
        
        const style = document.createElement('style');
        style.id = 'landscape-print-style';
        style.innerHTML = '@page { size: A4 landscape; margin: 5mm; }';
        document.head.appendChild(style);
        
        setTimeout(() => {
            window.print();
            const el = document.getElementById('landscape-print-style');
            if(el) el.remove();
        }, 500);
    },

    // Dashboard
    updateDashboardStats: () => {
        const students = DB.getStudents();
        const books = DB.getBooks();
        
        let totalMissing = 0;
        let totalDistributedEver = 0;
        let totalReturned = 0;
        
        books.forEach(b => {
             totalMissing += (b.assignedQty || 0); // Currently assigned out
             totalReturned += (b.returnedQty || 0);
             totalDistributedEver += (b.assignedQty || 0) + (b.returnedQty || 0);
        });

        document.getElementById('stat-total-students').textContent = students.length;
        
        // We'll hijack the books and present-today id to show proper metrics or just populate it generically.
        // Wait, the layout has standard IDs, I will map properly:
        const totalBooksP = document.getElementById('stat-total-books');
        if(totalBooksP) totalBooksP.textContent = `${totalDistributedEver} Distr.`;
        
        const pt = document.getElementById('stat-present-today');
        if(pt) pt.innerHTML = `<span style="color:var(--danger);">${totalMissing} Missing</span>`;
        
        // Update reports UI if present
        if (app.currentScreen === 'reports') {
            app.loadAttendanceReport();
        }

        // Render Chart
        if (app.chartInstance) {
            app.chartInstance.destroy();
        }
        const ctx = document.getElementById('attendance-chart');
        
        // Setup proper attendance vars for chart
        const todayStr = new Date().toISOString().split('T')[0];
        const todayAttendance = DB.getAttendanceByDate(todayStr);
        let presentCount = 0;
        let absentCount = 0;
        
        // Optional counting (if manual tracking allows absent records vs unrecorded)
        students.forEach(s => {
            const record = todayAttendance.find(a => a.studentId === s.id);
            if(record && record.status === 'Present') presentCount++;
            else if(record && record.status === 'Absent') absentCount++;
            else absentCount++; // Missing scan defaults to absent conceptually on chart
        });
        
        if (ctx) {
            app.chartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Present Today', 'Absent/Pending'],
                    datasets: [{
                        label: 'Students',
                        data: [presentCount, absentCount],
                        backgroundColor: ['rgba(46, 204, 113, 0.6)', 'rgba(231, 76, 60, 0.6)'],
                        borderColor: ['#2ecc71', '#e74c3c'],
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { beginAtZero: true, ticks: { stepSize: 1 } }
                    }
                }
            });
        }
    }

};

// Start the app when DOM loads
document.addEventListener('DOMContentLoaded', app.init);
