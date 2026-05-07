require('dotenv').config(); // ⬅️ Must be FIRST — loads .env before everything else

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

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY_1 }); // ✅ env is loaded now
const { useMongoDBAuthState } = require('./lib/mongoAuth');
const { CONFIG, SETTINGS } = require('./config');
const { getMachanResponse } = require('./lib/ai_logic');

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


async function generateSmartKeywords(name, category, desc) {
    try {
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

// 🚀 MAIN BOT FUNCTION
async function startBot() {

    if (sock) {
        sock.ev.removeAllListeners('messages.upsert');
        sock.ev.removeAllListeners('connection.update');
        sock.ev.removeAllListeners('creds.update');
        sock.ev.removeAllListeners('call');
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
    } catch (e) { }

    // 3. Auth Strategy
    const { state, saveCreds } = await useMongoDBAuthState(CONFIG.SESSION_ID);
    const { version } = await fetchLatestBaileysVersion();

    // 4. Create Socket
    sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        markOnlineOnConnect: false,
        generateHighQualityLinkPreview: false,
        syncFullHistory: false,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 10000,
        retryRequestDelayMs: 5000
    });

    // 📞 ANTI-CALL SYSTEM
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
                setTimeout(() => startBot(), 5000);
            }
        } else if (connection === 'open') {
            console.log('✅ Bot Connected successfully!');
        }
    });

    // 📩 MESSAGE HANDLER (FIXED BRACKETS)
    const saveSettings = async () => {
        try {
            await GlobalData.findByIdAndUpdate("bot_master_data", { settings: SETTINGS }, { upsert: true });
        } catch (err) {
            console.log("❌ DB Save Error:", err.message);
        }
    };

    sock.ev.removeAllListeners('messages.upsert');

    sock.ev.on('messages.upsert', async (upsert) => {
        try {
            const { messages, type: eventType } = upsert;
            console.log(`\n📥 [EVENT RECEIVED] Type: ${eventType} | ID: ${messages[0]?.key?.id}`);

            if (eventType !== 'notify' && eventType !== 'append') return;

            let msg = messages[0];
            if (!msg.message) return;

            const from = msg.key.remoteJid;
            const msgId = msg.key.id;

            // 🚫 Immediately ignore Channel / Newsletter messages
            if (from.includes('@newsletter')) return;

            if (processedMsgIds.has(msgId)) {
                console.log(`⚠️ [DEDUPLICATED] Ignoring Message ID: ${msgId}`);
                return;
            }

            const now = Date.now();
            if (lastMsgTime[from] && (now - lastMsgTime[from] < 2000)) {
                console.log(`🚫 [COOLDOWN] Ignoring fast duplicate from: ${from}`);
                return;
            }
            lastMsgTime[from] = now;

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

            // Better text extraction (handles Baileys metadata keys)
            let text = '';
            if (msg.message?.conversation) {
                text = msg.message.conversation;
            } else if (msg.message?.extendedTextMessage?.text) {
                text = msg.message.extendedTextMessage.text;
            } else if (msg.message?.imageMessage?.caption) {
                text = msg.message.imageMessage.caption;
            } else if (msg.message?.videoMessage?.caption) {
                text = msg.message.videoMessage.caption;
            }

            if (!text || text.trim().length === 0) {
                // Not logging empty messages to avoid console spam
                return;
            }

            // Allow the bot owner to send commands from their own number (fromMe), 
            // but ignore the bot's own normal messages to prevent infinite loops.
            if (msg.key.fromMe && !text.startsWith('#')) return;

            if (msg.key.remoteJid === 'status@broadcast') {
                if (SETTINGS.autostatus) {
                    await new Promise(r => setTimeout(r, 2000));
                    await sock.readMessages([msg.key]);
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

            let rawSender = (msg.key.participant || from).split(':')[0] +
                ((msg.key.participant || from).includes('@g.us') ? '@g.us' : '@s.whatsapp.net');
            let realNumber = msg.key.participantAlt || msg.key.remoteJidAlt || rawSender;
            let senderNum = realNumber.split('@')[0].split(':')[0];

            if (msg.key.fromMe) {
                senderNum = CONFIG.OWNER_PHONE;
            }

            console.log(`💬 [MESSAGE] From: ${senderNum} ${msg.key.fromMe ? '(Owner/fromMe)' : ''} | Text: "${text}"`);

            const isGroup = from.endsWith('@g.us');
            if (isGroup) return;

            if (SETTINGS.autoreact && !text.startsWith('#')) {
                try {
                    await sock.sendMessage(from, { react: { text: SETTINGS.auto_emoji, key: msg.key } });
                } catch (err) {
                    console.log("⚠️ Reaction error:", err.message);
                }
            }

            const isOwner = senderNum === CONFIG.OWNER_PHONE || senderNum === CONFIG.OWNER_NUMBER;

            if (text.startsWith('#cmd')) {
                const parts = text.trim().split(/\s+/);

                if (isOwner || parts[1] === SETTINGS.master_code) {
                    let cmd = isOwner ? parts[1] : parts[2];
                    let arg = isOwner ? parts[2] : parts[3];

                    if (!cmd) {
                        const menuText = `
🎛️ *CONTROL PANEL*
------------------
(#cmd <option> <on/off>)

🔹 system : ${SETTINGS.system ? '✅' : '🔴'}
🔹 mode : ${SETTINGS.public_mode ? '🌍' : '🔒'}
🔹 ai : ${SETTINGS.ai_chat ? '✅' : '🔴'}
🔹 anticall : ${SETTINGS.anticall ? '✅' : '🔴'}
🔹 autostatus : ${SETTINGS.autostatus ? '✅' : '🔴'}
🔹 react : ${SETTINGS.autoreact ? '✅' : '🔴'}
                        `;
                        console.log(`📤 [BOT REPLIED] To: ${senderNum} | Reply: "🎛️ Control Panel Sent"`);
                        return await sock.sendMessage(from, { text: menuText });
                    }

                    if (cmd === 'system') SETTINGS.system = arg === 'on';
                    if (cmd === 'mode') SETTINGS.public_mode = arg === 'public';
                    if (cmd === 'ai') SETTINGS.ai_chat = arg === 'on';
                    if (cmd === 'anticall') SETTINGS.anticall = arg === 'on';
                    if (cmd === 'autostatus') SETTINGS.autostatus = arg === 'on';
                    if (cmd === 'react') SETTINGS.autoreact = arg === 'on';
                    if (cmd === 'setemoji' && arg) SETTINGS.auto_emoji = arg;

                    await saveSettings();
                    const replyText = `✅ Setting Updated: ${cmd} -> ${arg}`;
                    console.log(`📤 [BOT REPLIED] To: ${senderNum} | Reply: "${replyText}"`);
                    return await sock.sendMessage(from, { text: replyText });
                }
            }

            if (text.toLowerCase() === '#system') {
                const usedRAM = process.memoryUsage().rss / 1024 / 1024;
                return await sock.sendMessage(from, { text: `💻 RAM: ${usedRAM.toFixed(2)} MB\n🤖 Public Mode: ${SETTINGS.public_mode}` });
            }

            const isMedia = msg.message.imageMessage || msg.message.videoMessage;
            const caption = (msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || "").trim();

            if (isMedia && caption.startsWith('#add')) {
                if (isOwner) {
                    await sock.sendMessage(from, { text: "⏳ Media Uploading... පොඩ්ඩක් ඉන්න..." });

                    try {
                        const stream = await downloadContentFromMessage(
                            msg.message.imageMessage || msg.message.videoMessage,
                            msg.message.imageMessage ? 'image' : 'video'
                        );
                        let buffer = Buffer.from([]);
                        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

                        const mediaUrl = await uploadToCloud(buffer, msg.message.imageMessage ? 'image' : 'video');

                        if (mediaUrl) {
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

                    await sock.sendMessage(from, { text: "🤖 විස්තරේ හරි! AI එකෙන් Keywords Generate කරනකම් පොඩ්ඩක් ඉන්න..." });

                    const aiKeywords = await generateSmartKeywords(
                        session.data.name,
                        session.data.category,
                        session.data.desc
                    );

                    console.log("Generated Keywords:", aiKeywords);

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

                    delete productSession[senderNum];

                    return await sock.sendMessage(from, {
                        text: `✅ *Item Saved Successfully!* \n\n🔑 *AI Keywords Added:* ${aiKeywords.length}\nදැන් සිංහලෙන් ගැහුවත්, ඉංග්‍රීසියෙන් ගැහුවත් මේක හොයාගන්න පුළුවන්!`,
                        image: { url: session.data.mediaUrl },
                        caption: `📦 ${session.data.name}\n💰 ${session.data.price}`
                    });
                }
            }

            if (text.startsWith('#')) return;

            if (!SETTINGS.system && !isOwner) return;
            if (!SETTINGS.public_mode && !isOwner) return;
            if (!SETTINGS.ai_chat && !isOwner) return;

            try {
                await sock.sendPresenceUpdate('composing', from);
                console.log(`🤖 [AI CALL] Asking AI for text: "${text.substring(0, 20)}..."`);
                const aiReply = await getMachanResponse(senderNum, from, text, isGroup, sock);
                
                if (aiReply) {
                    console.log(`📤 [BOT REPLIED] To: ${senderNum} | Reply: "${aiReply.substring(0, 50).replace(/\n/g, ' ')}..."`);
                    await sock.sendMessage(from, { text: aiReply }, { quoted: msg });
                }
                await sock.sendPresenceUpdate('paused', from);
            } catch (err) {
                console.log("AI Error:", err.message);
            }

        } catch (e) {
            console.log("Upsert Error:", e);
        }
    }); // <-- මෙම Bracket එක තමයි කලින් අවුල් වෙලා තිබ්බේ
}

startBot();

// Keep Alive Server
const http = require('http');
http.createServer((req, res) => res.end('Bot Running')).listen(process.env.PORT || 8000);