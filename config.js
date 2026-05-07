const dotenv = require('dotenv');
dotenv.config();

const pairingNumber = process.env.PAIRING_NUMBER || "";
const ownerPhone = process.env.OWNER_PHONE || pairingNumber;

const CONFIG = {
    PAIRING_NUMBER: pairingNumber, 
    OWNER_PHONE: ownerPhone,
    OWNER_NUMBER: ownerPhone,

    // 💾 Database & Session 
    MONGO_URL: process.env.MONGO_URL, 
    SESSION_ID: process.env.SESSION_ID || 'mysession'
};

let SETTINGS = { 
    system: true,       
    public_mode: false,  // 🔒 Public Mode (False = Owner only)
    ai_chat: true,       // 🤖 AI Chat Reply
    anticall: true,      // 📞 Anti-Call
    autostatus: true,    // 👀 Auto Status View
    autoreact: true,     // ✨ Auto React
    auto_emoji: '❤️',    // React Emoji
    master_code: process.env.MASTER_CODE || "sha2008@" // Admin Code
};

module.exports = { CONFIG, SETTINGS };
