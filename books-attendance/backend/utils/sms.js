// Mock Twilio / SMS Provider API Integration

const sendSMS = async (phone, message) => {
    console.log(`[SMS API] Trying to send to ${phone}...`);
    
    // Example of actual implementation using Twilio:
    /*
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const client = require('twilio')(accountSid, authToken);
    
    try {
        await client.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: phone
        });
        return { success: true };
    } catch(err) {
        return { success: false, error: err.message };
    }
    */
   
    // Simulating success
    return { success: true };
};

module.exports = { sendSMS };
