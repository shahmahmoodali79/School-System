const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { sendWhatsApp } = require('./utils/whatsapp');
const { sendSMS } = require('./utils/sms');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const LOGS_FILE = path.join(__dirname, 'data', 'logs.json');
const SETTINGS_FILE = path.join(__dirname, 'data', 'settings.json');

// --- Helper Functions ---
const readJSON = (file, defaultVal) => {
    try {
        if (!fs.existsSync(file)) return defaultVal;
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch { return defaultVal; }
};

const writeJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

const getSettings = () => {
    return readJSON(SETTINGS_FILE, {
        enableWhatsApp: false,
        enableSMS: false,
        sendPresentMessage: false,
        schoolName: "GBHSS Younusabad",
        language: "Urdu"
    });
};

const logNotification = (studentName, guardianPhone, className, status, channel, message, success, errorMsg = null) => {
    const logs = readJSON(LOGS_FILE, []);
    logs.unshift({
        studentName, guardianPhone, className, status, channel, message,
        sentAt: new Date().toISOString(),
        success, error: errorMsg
    });
    if (logs.length > 200) logs.length = 200; // Limit logs size
    writeJSON(LOGS_FILE, logs);
};

// --- API Endpoints ---

// 1. GET Settings
app.get('/api/settings', (req, res) => {
    res.json(getSettings());
});

// 2. POST Settings
app.post('/api/settings', (req, res) => {
    const newSettings = { ...getSettings(), ...req.body };
    writeJSON(SETTINGS_FILE, newSettings);
    res.json({ success: true, settings: newSettings });
});

// 3. GET Notification Logs
app.get('/api/notification-logs', (req, res) => {
    res.json(readJSON(LOGS_FILE, []));
});

// 4. POST Send Attendance Alert
app.post('/api/send-attendance-alert', async (req, res) => {
    const { studentName, fatherName, className, guardianPhone, status, date } = req.body;
    const settings = getSettings();

    if (!guardianPhone) {
        return res.status(400).json({ success: false, message: "Guardian phone missing." });
    }

    if (status === 'Present' && !settings.sendPresentMessage) {
        return res.json({ success: true, message: "Present messages are disabled in settings. Skipped." });
    }

    // Check duplicate logic
    const logs = readJSON(LOGS_FILE, []);
    const isDuplicate = logs.some(log => 
        log.studentName === studentName && 
        log.status === status && 
        log.sentAt.startsWith(date) &&
        log.success
    );

    if (isDuplicate) {
        return res.json({ success: true, message: "Duplicate message conceptually prevented for today." });
    }

    // Message Construction
    let message = "";
    if (settings.language === "English") {
        if (status === 'Absent') message = `Dear Parent, your child ${studentName} (${className}) is absent today. School: ${settings.schoolName}`;
        else if (status === 'Present') message = `Dear Parent, your child ${studentName} (${className}) is present today. School: ${settings.schoolName}`;
        else if (status === 'Late') message = `Dear Parent, your child ${studentName} (${className}) arrived late today. School: ${settings.schoolName}`;
    } else {
        if (status === 'Absent') message = `Assalam-o-Alaikum. Aaj aap ke bachey ${studentName} class ${className} school nahi aye. School: ${settings.schoolName}`;
        else if (status === 'Present') message = `Assalam-o-Alaikum. Aaj aap ke bachey ${studentName} class ${className} school me mojood hain. School: ${settings.schoolName}`;
        else if (status === 'Late') message = `Assalam-o-Alaikum. Aaj aap ke bachey ${studentName} class ${className} school der se aye. School: ${settings.schoolName}`;
    }

    const results = { whatsapp: null, sms: null };

    // Trigger WhatsApp
    if (settings.enableWhatsApp) {
        const waRes = await sendWhatsApp(guardianPhone, message);
        results.whatsapp = waRes.success ? "Success" : "Failed";
        logNotification(studentName, guardianPhone, className, status, "WhatsApp", message, waRes.success, waRes.error);
    }

    // Trigger SMS
    if (settings.enableSMS) {
        const smsRes = await sendSMS(guardianPhone, message);
        results.sms = smsRes.success ? "Success" : "Failed";
        logNotification(studentName, guardianPhone, className, status, "SMS", message, smsRes.success, smsRes.error);
    }

    res.json({ success: true, results, loggedMessage: message });
});

// 5. POST Test Notification
app.post('/api/test-notification', async (req, res) => {
    res.json({ success: true, message: "Backend API is reachable and responding successfully." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`Backend Server running on port ${PORT}`);
    console.log(`=========================================`);
});
