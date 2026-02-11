const dotenv = require('dotenv');
dotenv.config();

const CONFIG = {
    
    PAIRING_NUMBER: process.env.PAIRING_NUMBER, 
    OWNER_PHONE: process.env.OWNER_PHONE,
    OWNER_NUMBER: "207588872446040",
    

    // 💾 Database & Session 
    MONGO_URL: process.env.MONGO_URL, 
    SESSION_ID: process.env.SESSION_ID || 'mysession'
};

let SETTINGS = { 
    system: true,       
    public_mode: false,  // 🔒 Public Mode (False = Owner only)
    anticall: true,      // 📞 Anti-Call
    autostatus: true,    // 👀 Auto Status View
    autoreact: true,     // ✨ Auto React
    auto_emoji: '❤️',    // React Emoji
    master_code: process.env.MASTER_CODE || "sha2008@" // Admin Code
};

module.exports = { CONFIG, SETTINGS };
