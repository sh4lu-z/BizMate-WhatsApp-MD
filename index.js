const { 
    makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion,
    downloadContentFromMessage
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const mongoose = require('mongoose'); 
const fs = require('fs');
const path = require('path'); 
const axios = require('axios');
const os = require('os'); 
const process = require('process');
const { performance } = require('perf_hooks');
const FormData = require('form-data');
const { Readable } = require('stream');
const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY_1 });
const { useMongoDBAuthState } = require('./mongoAuth');
const { CONFIG, SETTINGS } = require('./config');
const { getMachanResponse } = require('./ai_logic');


// ============================================
// 📦 BUSINESS PRODUCT SCHEMA (UPDATED)
// ============================================
const productSchema = new mongoose.Schema({
    category: { type: String, index: true },
    name: String,
    price: String,
    desc: String,
    mediaUrl: String,   
    mediaType: String,  
    addedBy: String,
    
   
    keywords: { type: [String], index: true } 
});
const Product = mongoose.model('Products', productSchema);

// 🛒 2. Session Management 
let productSession = {}; // { '947xxx': { step: 'CATEGORY', data: {...} } }

// Database Schema
const globalDataSchema = new mongoose.Schema({
    _id: String,
    settings: Object
});
const GlobalData = mongoose.model('GlobalData', globalDataSchema);
const lastMsgTime = {};
const processedMsgIds = new Set();
let sock; 
const msgRetryCounter = new Set();


// ============================================
// ☁️ CLOUD UPLOADER (CATBOX - 200MB & PERMANENT)
// ============================================
async function uploadToCloud(buffer, type) {
    try {
        const form = new FormData();
        // Catbox API Requirements
        form.append('reqtype', 'fileupload');
        form.append('fileToUpload', buffer, type === 'image' ? 'image.jpg' : 'video.mp4');

        const response = await axios.post('https://catbox.moe/user/api.php', form, {
            headers: { 
                ...form.getHeaders(),
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        // Catbox returns the direct URL as a string
        if (response.data && response.data.toString().startsWith('http')) {
            console.log("✅ Uploaded to Catbox:", response.data);
            return response.data.trim();
        }
        
        console.log("❌ Upload Failed (Response):", response.data);
        return null;

    } catch (e) {
        console.error("Upload Error:", e.message);
        return null;
    }
}

// ============================================
// 🧠 AI KEYWORD GENERATOR (GROQ - LLAMA 3)
// ============================================
async function generateSmartKeywords(name, category, desc) {
    try {
        // 🔥 PROMPT UPDATE: REMOVE GENERIC WORDS (PRICE, SALE, ETC.)
        const prompt = `
        Act as a Product Categorization AI for a Sri Lankan WhatsApp bot.
        Product: ${name}
        Category: ${category}
        Description: ${desc}

        Task: Generate 20-25 specific search keywords to identify THIS ITEM only.

        ⛔ STRICTLY FORBIDDEN WORDS (DO NOT INCLUDE):
        - Do NOT include: "price", "mila", "ganana", "how much", "cost".
        - Do NOT include: "buy", "sell", "sale", "offer", "discount", "best", "new".
        - Do NOT include: "shop", "store", "online", "delivery".
        - Do NOT include generic adjectives like "good", "quality".

        ✅ RULES:
        1. Focus ONLY on the Product Name, Category, and Synonyms (Object Nouns).
        2. Mix 3 Languages: English, Sinhala (Sinhala letters), and Singlish.
        3. Include common typos (e.g., "bottle" -> "botale", "flask", "panithale").
        4. OUTPUT MUST BE A RAW JSON ARRAY ONLY. NO EXTRA TEXT.

        Example Output: ["bottle", "water bottle", "වතුර බෝතල්", "wathura botale", "flask", "atlas bottle"]
        `;

        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.3-70b-versatile', 
            temperature: 0, 
        });

        const content = chatCompletion.choices[0]?.message?.content || "[]";
        const jsonMatch = content.match(/\[.*\]/s);
        const keywords = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

        return keywords;

    } catch (error) {
        console.error("AI Keyword Error:", error.message);
        return [name.toLowerCase(), category.toLowerCase()];
    }
}

// ============================================================
// 🚀 MAIN BOT FUNCTION
// ============================================================
async function startBot() {
    console.log("🚀 Bot Starting...");

    // 🔴 FIX: පරණ Listeners අයින් කිරීම (මේක අලුත් Socket එක හදන්න කලින් කරන්න ඕනේ)
    if (sock) {
        sock.ev.removeAllListeners('messages.upsert');
        sock.ev.removeAllListeners('connection.update');
        sock.ev.removeAllListeners('creds.update');
        sock.ev.removeAllListeners('call'); // Anti-call listener එකත් අයින් කරන්න ඕනේ
    }

    // 1. Connect MongoDB
    if (mongoose.connection.readyState !== 1) {
        try {
            await mongoose.connect(CONFIG.MONGO_URL);
            console.log("🛢️ MongoDB Connected!");
        } catch (err) {
            console.log("⚠︎ MongoDB Error:", err.message);
        }
    }
    // 2. Load Settings
    try {
        const dbData = await GlobalData.findById("bot_master_data");
        if (dbData && dbData.settings) {
            SETTINGS = { ...SETTINGS, ...dbData.settings };
            console.log("✅ Settings Loaded!");
        }
    } catch (e) {}

    // 3. Auth Strategy
    const { state, saveCreds } = await useMongoDBAuthState(CONFIG.SESSION_ID);
    const { version } = await fetchLatestBaileysVersion();

    // 4. Create Socket
    // 4. Create Socket
    sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        markOnlineOnConnect: false, 
        generateHighQualityLinkPreview: false,
        syncFullHistory: false,        // Start එක වේගවත් කරයි
        connectTimeoutMs: 60000,       // Connection එකට තත්පර 60ක් දෙයි
        defaultQueryTimeoutMs: 0,  // Query වලට කාලය දෙයි
        keepAliveIntervalMs: 10000,    // Disconnect නොවී තියාගනී
        retryRequestDelayMs: 5000      // Error ආවොත් හිමින් ට්‍රයි කරයි
    });

    // ============================================================
    // 🔢 PAIRING CODE LOGIC (මෙන්න ඔයා ඉල්ලපු කෑල්ල)
    // ============================================================
    if (!sock.authState.creds.registered) {
        const phoneNumber = CONFIG.PAIRING_NUMBER;
        if (!phoneNumber || phoneNumber === "947XXXXXXXX") {
            console.log("⚠︎ Pairing Number එක හරියට දාලා නෑ! Config එකේ නම්බර් එක හදන්න.");
        } else {
            setTimeout(async () => {
                try {
                    console.log(`⏳ Pairing Code ගන්න ට්‍රයි කරනවා: ${phoneNumber}`);
                    let code = await sock.requestPairingCode(phoneNumber);
                    code = code?.match(/.{1,4}/g)?.join("-") || code;
                    console.log("\n==================================================");
                    console.log("🔐 YOUR PAIRING CODE:  " + code);
                    console.log("==================================================\n");
                } catch (err) {
                    console.log("❌ Pairing Code Error: ", err);
                }
            }, 3000);
        }
    }

    // ============================================================
    // 📞 ANTI-CALL SYSTEM
    // ============================================================
    sock.ev.on('call', async (node) => {
        if (!SETTINGS.anticall) return;
        const { id, from, status } = node[0];
        if (status === 'offer') {
            await sock.rejectCall(id, from);
            console.log(`📞 Rejected Call from ${from.split('@')[0]}`);
               await sock.sendMessage(from, { text: "📵 No Calls Allowed!" });
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    
    if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        
        console.log(`Connection closed. Status: ${statusCode}. Reconnecting: ${shouldReconnect}`);
        
        if (shouldReconnect) {
            // තත්පර 5ක් ඉඳලා එක පාරක් විතරක් Restart කරන්න
            setTimeout(() => startBot(), 5000);
        }
    } else if (connection === 'open') {
        console.log('✅ Bot Connected successfully!');
    }
});

    // ============================================================
    // 📩 MESSAGE HANDLER (FIXED)
    // ============================================================
    const saveSettings = async () => {
        try {
            await GlobalData.findByIdAndUpdate("bot_master_data", { settings: SETTINGS }, { upsert: true });
            // console.log("💾 Settings Saved to DB");
        } catch (err) {
            console.log("❌ DB Save Error:", err.message);
        }
    };

    sock.ev.removeAllListeners('messages.upsert');
        
    sock.ev.on('messages.upsert', async (upsert) => {
    try {
        const { messages, type: eventType } = upsert;
        console.log(`\n📥 [EVENT RECEIVED] Type: ${eventType} | ID: ${messages[0]?.key?.id}`);
        
        if (eventType !== 'notify') return;

        let msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const msgId = msg.key.id;

        // 🛡️ 1. ID එකෙන් චෙක් කිරීම (Original Deduplication)
        if (processedMsgIds.has(msgId)) {
            console.log(`⚠️ [DEDUPLICATED] Ignoring Message ID: ${msgId}`);
            return; 
        }
        
        // 🛡️ 2. TIME-BASED GUARD (LID හොල්මන පන්නන්න)
        // එකම කෙනාගෙන් තත්පර 2ක් ඇතුළත මැසේජ් එකක් ආවොත් ඒක ignore කරනවා (ID එක වෙනස් වුණත්)
        const now = Date.now();
        if (lastMsgTime[from] && (now - lastMsgTime[from] < 2000)) {
            console.log(`🚫 [COOLDOWN] Ignoring fast duplicate from: ${from}`);
            return;
        }
        lastMsgTime[from] = now; // අන්තිමට මැසේජ් එකක් ආපු වෙලාව සටහන් කරගන්නවා

        console.log(`✅ [NEW MESSAGE] Processing ID: ${msgId}`);
        processedMsgIds.add(msgId);

        if (processedMsgIds.size > 100) {
            const firstEntry = processedMsgIds.values().next().value;
            processedMsgIds.delete(firstEntry);
        }

        // 🛠️ FIX: Disappearing Messages 
        if (msg.message.ephemeralMessage) {
            msg.message = msg.message.ephemeralMessage.message;
        }

        // --- මෙතනදී ටෙක්ස්ට් එක කලින්ම ගමු 'Empty' ද බලන්න ---
        const type = Object.keys(msg.message)[0];
        const text = (type === 'conversation' ? msg.message.conversation :
                     type === 'extendedTextMessage' ? msg.message.extendedTextMessage.text :
                     type === 'imageMessage' ? msg.message.imageMessage.caption : '') || '';

        // 🛡️ 3. EMPTY TEXT GUARD (ලොග් එකේ තිබ්බ හිස් මැසේජ් එක නවත්තන්න)
        if (!text || text.trim().length === 0) {
            console.log(`🚫 [EMPTY IGNORED] Message body is empty.`);
            return;
        }
        // ============================================================
        // 🟢 1. AUTO STATUS VIEW & REACT (Status ආවොත් මෙතනින් ඉවරයි)
        // ============================================================
        if (msg.key.remoteJid === 'status@broadcast') {
            if (SETTINGS.autostatus) {
                // Human වගේ පේන්න තත්පර 2ක් ඉන්නවා
                await new Promise(r => setTimeout(r, 2000));
                
                // Status එක Seen කරනවා
                await sock.readMessages([msg.key]);

                // React කරනවා
                if (SETTINGS.autoreact) {
                    await sock.sendMessage(
                        msg.key.remoteJid, 
                        { react: { text: SETTINGS.auto_emoji, key: msg.key } }, 
                        { statusJidList: [msg.key.participant] }
                    );
                }
            }
            return; 
        }

        // ============================================================
        // 🕵️‍♂️ REAL NUMBER EXTRACTOR (SAFE - NO KEY MODIFICATION)
        // ============================================================
        
      
        const from = msg.key.remoteJid;
        
  
        let rawSender = (msg.key.participant || from).split(':')[0] + 
                       ((msg.key.participant || from).includes('@g.us') ? '@g.us' : '@s.whatsapp.net');
        let realNumber = msg.key.participantAlt || msg.key.remoteJidAlt || rawSender;
        const senderNum = realNumber.split('@')[0].split(':')[0];
        // ============================================================
        // 🛑 LOOP PROTECTION (බොට් තමන්ටම reply කරගැනීම වැළැක්වීම)
        // ============================================================
        if (msg.key.fromMe) return; 

        // Message Type & Text ගැනීම
        const type = Object.keys(msg.message)[0];
        const text = type === 'conversation' ? msg.message.conversation :
                     type === 'extendedTextMessage' ? msg.message.extendedTextMessage.text :
                     type === 'imageMessage' ? msg.message.imageMessage.caption : '';

        const isGroup = from.endsWith('@g.us');
        if (isGroup || from.includes('@newsletter')) return;

        // 2. AUTO REACT (මෙතන msg.key එක original එකම පාවිච්චි වෙනවා)
        if (SETTINGS.autoreact && !text.startsWith('#')) {
             try {
                 await sock.sendMessage(from, { react: { text: SETTINGS.auto_emoji, key: msg.key } });
             } catch (err) {
                 console.log("⚠️ Reaction error:", err.message);
             }
        }
        if (msg.key.fromMe) return;

        // ============================================================
        // 🎛️ OWNER PANEL (#cmd) - SWITCHES
        // ============================================================
            if (text.startsWith('#cmd')) {
                const parts = text.trim().split(/\s+/);
                const isOwner = senderNum === CONFIG.OWNER_PHONE || senderNum === CONFIG.OWNER_NUMBER;
                
                // Owner හෝ Password එක හරි නම් විතරයි
                if (isOwner || parts[1] === SETTINGS.master_code) {
                    let cmd = isOwner ? parts[1] : parts[2];
                    let arg = isOwner ? parts[2] : parts[3];

                    if (!cmd) {
                        return await sock.sendMessage(from, { text: `
🎛️ *CONTROL PANEL*
------------------
(#cmd <option> <on/off>)

🔹 system : ${SETTINGS.system ? '✅' : '🔴'}
🔹 mode : ${SETTINGS.public_mode ? '🌍' : '🔒'}
🔹 anticall : ${SETTINGS.anticall ? '✅' : '🔴'}
🔹 autostatus : ${SETTINGS.autostatus ? '✅' : '🔴'}
🔹 react : ${SETTINGS.autoreact ? '✅' : '🔴'}
                        ` });
                    }

                    if (cmd === 'system') SETTINGS.system = arg === 'on';
                    if (cmd === 'mode') SETTINGS.public_mode = arg === 'public';
                    if (cmd === 'anticall') SETTINGS.anticall = arg === 'on';
                    if (cmd === 'autostatus') SETTINGS.autostatus = arg === 'on';
                    if (cmd === 'react') SETTINGS.autoreact = arg === 'on';
                    
                    if (cmd === 'setemoji' && arg) SETTINGS.auto_emoji = arg;

                    await saveSettings();
                    return await sock.sendMessage(from, { text: `✅ Setting Updated: ${cmd} -> ${arg}` });
                }
            }

            // ============================================================
            // 💻 SYSTEM INFO (#system)
            // ============================================================
            if (text.toLowerCase() === '#system') {
                const usedRAM = process.memoryUsage().rss / 1024 / 1024;
                return await sock.sendMessage(from, { text: `💻 RAM: ${usedRAM.toFixed(2)} MB\n🤖 Public Mode: ${SETTINGS.public_mode}` });
            }
            // ============================================================
// 🛍️ BUSINESS PRODUCT ADDING SYSTEM (INTERACTIVE)
// ============================================================

// 1️⃣ Admin අලුත් බාණ්ඩයක් දාන්න හදනවද? (#add with Image/Video)
const isMedia = msg.message.imageMessage || msg.message.videoMessage;
const caption = (msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || "").trim();

if (isMedia && caption.startsWith('#add')) {
    // Owner Check (ඔයාගේ ක්‍රමේට)
    const isOwner = senderNum === CONFIG.OWNER_PHONE || senderNum === CONFIG.OWNER_NUMBER;
    
    if (isOwner) {
        await sock.sendMessage(from, { text: "⏳ Media Uploading... පොඩ්ඩක් ඉන්න..." });

        try {
            // Download Media
            const stream = await downloadContentFromMessage(
                msg.message.imageMessage || msg.message.videoMessage,
                msg.message.imageMessage ? 'image' : 'video'
            );
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

            // Upload to Cloud
            const mediaUrl = await uploadToCloud(buffer, msg.message.imageMessage ? 'image' : 'video');

            if (mediaUrl) {
                // Start Session
                productSession[senderNum] = {
                    step: 'ASK_CATEGORY',
                    data: {
                        mediaUrl: mediaUrl,
                        mediaType: msg.message.imageMessage ? 'image' : 'video',
                        addedBy: senderNum
                    }
                };
                return await sock.sendMessage(from, { text: "✅ *Upload Done!*\n\nදැන් මේකේ **Category** එක එවන්න.\n(උදා: bottle, phone, shoe)" });
            } else {
                return await sock.sendMessage(from, { text: "❌ Upload Fail වුනා මචන්." });
            }
        } catch (e) {
            console.log(e);
            return await sock.sendMessage(from, { text: "❌ Error එකක්!" });
        }
    }
}

// 2️⃣ Admin ප්‍රශ්න වලට උත්තර දෙනවද? (Session Handling)
if (productSession[senderNum]) {
    const session = productSession[senderNum];
    const userText = text.trim();

    if (session.step === 'ASK_CATEGORY') {
        session.data.category = userText.toLowerCase();
        session.step = 'ASK_NAME';
        return await sock.sendMessage(from, { text: "එළ! 📦 දැන් මේ අයිටම් එකේ **නම (Name)** මොකක්ද?" });
    }

    if (session.step === 'ASK_NAME') {
        session.data.name = userText;
        session.step = 'ASK_PRICE';
        return await sock.sendMessage(from, { text: "හරි, 💰 මේකේ **මිල (Price)** කීයද?" });
    }

    if (session.step === 'ASK_PRICE') {
        session.data.price = userText;
        session.step = 'ASK_DESC';
        return await sock.sendMessage(from, { text: "අන්තිම එක! 📝 මේක ගැන පොඩි **විස්තරයක් (Description)** එවන්න." });
    }

    if (session.step === 'ASK_DESC') {
        session.data.desc = userText;

        // ⏳ 1. User ට කියනවා AI එක වැඩ පටන් ගත්තා කියලා
        await sock.sendMessage(from, { text: "🤖 විස්තරේ හරි! AI එකෙන් Keywords Generate කරනකම් පොඩ්ඩක් ඉන්න..." });

        // 🧠 2. AI එකෙන් Keywords ජෙනරේට් කරගන්නවා
        const aiKeywords = await generateSmartKeywords(
            session.data.name, 
            session.data.category, 
            session.data.desc
        );

        // Keywords ටික console එකේ බලන්න (Testing වලට)
        console.log("Generated Keywords:", aiKeywords);

        // 💾 3. Database එකට Save කරනවා (Keywords එක්කම)
        const newProduct = new Product({
            category: session.data.category,
            name: session.data.name,
            price: session.data.price,
            desc: session.data.desc,
            mediaUrl: session.data.mediaUrl,
            mediaType: session.data.mediaType,
            addedBy: session.data.addedBy,
            keywords: aiKeywords 
       });         

        await newProduct.save();
        
        // Session එක Clear කරනවා
        delete productSession[senderNum];

        // ✅ 4. Success Message එක
        return await sock.sendMessage(from, { 
            text: `✅ *Item Saved Successfully!* \n\n🔑 *AI Keywords Added:* ${aiKeywords.length}\nදැන් සිංහලෙන් ගැහුවත්, ඉංග්‍රීසියෙන් ගැහුවත් මේක හොයාගන්න පුළුවන්!`,
            image: { url: session.data.mediaUrl },
            caption: `📦 ${session.data.name}\n💰 ${session.data.price}`
        });
    }
}   
            // ============================================================
            // 🤖 AI LOGIC (IF NOT #)
            // ============================================================
            if (text.startsWith('#')) return; // # ගැහුවොත් AI එකට යන්නේ නෑ

            // System Off නම් හෝ Private Mode එකේදී පිට අයට වැඩ නෑ
            const isOwner = senderNum === CONFIG.OWNER_PHONE || senderNum === CONFIG.OWNER_NUMBER;
            if (!SETTINGS.system && !isOwner) return;
            if (!SETTINGS.public_mode && !isOwner) return;

            try {
                
                await sock.sendPresenceUpdate('composing', from);
                console.log(`🤖 [AI CALL] Asking AI for text: "${text.substring(0, 20)}..."`);
                const aiReply = await getMachanResponse(senderNum, from, text, isGroup, sock);
                console.log(`🤖 [AI RESPONSE] Received reply: "${aiReply?.substring(0, 20)}..."`);
                if (aiReply) {
                    console.log(`📤 [SENDING] Sending Message to ${from} (ID: ${msgId})`);
                    await sock.sendMessage(from, { text: aiReply }, { quoted: msg });
                }
                await sock.sendPresenceUpdate('paused', from);
            } catch (err) {
                console.log("AI Error:", err.message);
            }

        } catch (e) {
            console.log("Upsert Error:", e);
        }
    });
}

startBot();

// Keep Alive Server
const http = require('http');
http.createServer((req, res) => res.end('Bot Running')).listen(process.env.PORT || 8000);
