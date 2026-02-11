/**
 * ==========================================================
 * Role: Business Assistant Logic Controller (Number 3)
 * Owner: Sh4lu_Z (Number 1)
 * Worker Bot: Cipher_MD (Number 2)
 * ==========================================================
 */
const fs = require('fs');
const path = require('path');
const Groq = require("groq-sdk");
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { CONFIG } = require('./config');
const { SYSTEM_PROMPT } = require('./system_prompt');
dotenv.config();

// 🛒 Product Model එක අරගන්නවා (Index එකේ Register කරලා තියෙන නිසා මෙතන Schema එක ඕන නෑ)
// හැබැයි Error එන එක නවත්තන්න try-catch දානවා
let Product;
try {
    Product = mongoose.model('Products');
} catch (error) {
    // Schema එක තාම හැදිලා නැත්නම් (Index එකේ තියෙන Schema එක මෙතනට Copy කරගන්න වෙනවා, 
    // නැත්නම් Bot එක Start වෙද්දී Index එක මුලින් run වෙන නිසා අවුලක් නෑ)
    Product = mongoose.models.Products; 
}

// --- 🔑 API KEY ROTATION SYSTEM ---
const API_KEYS = [
    process.env.GROQ_API_KEY_1,
    process.env.GROQ_API_KEY_2
].filter(k => k);

// --- 🛠️ HELPER: API ROTATION ---
let currentKeyIndex = 0;
const getGroqInstance = () => {
    const apiKey = API_KEYS[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
    return new Groq({ apiKey });
};


const HISTORY_DIR = path.join(__dirname, 'history');
if (!fs.existsSync(HISTORY_DIR)) fs.mkdirSync(HISTORY_DIR);

const timers = new Map();

async function getMachanResponse(senderNum, from, messageText, isGroup, sock) {
    try {
        const filePath = path.join(HISTORY_DIR, `${senderNum}.json`);
        let history = [];

        if (fs.existsSync(filePath)) {
            const fileData = JSON.parse(fs.readFileSync(filePath));
            history = fileData.messages || [];
        }

        history.push({ role: "user", content: messageText });
        if (history.length > 6) history = history.slice(-6);
        const groq = getGroqInstance();
        const combinedSystemPrompt = `
        [🔴 CRITICAL INSTRUCTION]
        First, analyze the user's message. 
        If the user is asking to BUY, FIND, SEARCH, or CHECK PRICE of a product (e.g., "Do you have bottles?", "Price of shoes?"), 
        your response must be EXACTLY and ONLY this trigger phrase: 
        >>> SEARCH_DATABASE <<<
        
        If it is a normal chat (e.g., "Hi", "How are you?", "Who created you?"), IGNORE the above and reply normally based on the context below.
        
        --- BUSINESS CONTEXT ---
        ${SYSTEM_PROMPT} 
        `;

        const conversationContext = [
            { role: "system", content: combinedSystemPrompt },
            ...history 
        ];

    
        const completion = await groq.chat.completions.create({
            messages: conversationContext,
            model: "openai/gpt-oss-120b", 
            temperature: 0.5, 
            max_tokens: 2000,
        });

        let aiReply = completion.choices[0]?.message?.content || "Shape eke innawa machan.";

        if (aiReply.includes("SEARCH_DATABASE")) {
            
            console.log("🔄 Buying Intent Detected! Searching...");

            try {
                const groqLlama = getGroqInstance();
                
                // 🔥 PROMPT FIX: AI එකට කියනවා Objects එවන්න එපා කියලා
                const keywordPrompt = `
                User Request: "${messageText}"
                
                Task: Generate 5-10 HIGHLY SPECIFIC keywords to find this exact physical item in a database.
                
                ⛔ NEGATIVE CONSTRAINTS (DO NOT INCLUDE):
                - Do NOT use generic words like "advertisement", "ad", "commercial", "best", "sale", "offer", "price", "shop".
                - Do NOT use broad categories unless specific (e.g., don't just say "item", say "bottle").
                - Do NOT include verbs (e.g., "drinking", "using").
                
                ✅ POSITIVE RULES:
                - Focus ONLY on the noun/object name (e.g., if user asks for "water bottle", keywords: "bottle", "flask", "panithale").
                - Include 3 languages: Sinhala, English, Singlish.
                - Synonyms must be for the OBJECT, not the intent.
                
                OUTPUT FORMAT: A simple JSON Array of strings.
                Example: ["bottle", "water bottle", "wathura botale", "flask"]
                `;

                const keywordCompletion = await groqLlama.chat.completions.create({
                    messages: [{ role: "user", content: keywordPrompt }],
                    model: "llama-3.3-70b-versatile",
                    temperature: 0,
                });

                const keywordRaw = keywordCompletion.choices[0]?.message?.content || "[]";
                const jsonMatch = keywordRaw.match(/\[.*\]/s);
                let keywords = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

                // 🛡️ SAFETY FIX: AI එක වැරදිලා හරි Objects එව්වොත්, අපි ඒවා වචන බවට හරවනවා
                keywords = keywords.flatMap(k => {
                    if (typeof k === 'object' && k !== null) {
                        return Object.values(k); // Object එකේ තියෙන වචන ටික එලියට ගන්නවා
                    }
                    return k; // දැනටමත් වචනයක් නම් අවුලක් නෑ
                });

                console.log("✅ Keywords Fixed:", keywords.slice(0, 5)); // මුල් 5 විතරක් පෙන්වන්න

                if (keywords.length > 0) {
                    
                    let Product;
                    try { Product = mongoose.model('Products'); } catch { Product = mongoose.models.Products; }

                    const products = await Product.find({
                        keywords: { $in: keywords.map(k => new RegExp(k, "i")) }
                    }).limit(3); // 🔥 බඩු ගොඩක් එන එක නවත්තන්න Limit එක 3 කට අඩු කලා

                    if (products.length > 0) {
                        // User ට කියනවා
                        await sock.sendMessage(from, { text: `🔍 *මම හෙව්වා... බඩු ${products.length} ක් හම්බුනා!*` });

                        for (const item of products) {
                            // පින්තූරය යවනවා
                            if (item.mediaUrl) {
                                await sock.sendMessage(from, { 
                                    image: { url: item.mediaUrl }, 
                                    caption: `🛍️ *${item.name}*\n💰 ${item.price}\n📝 ${item.desc}` 
                                });
                            } else {
                                await sock.sendMessage(from, { 
                                    text: `🛍️ *${item.name}*\n💰 ${item.price}\n📝 ${item.desc}` 
                                });
                            }
                            await new Promise(r => setTimeout(r, 1000));
                        }
                        
                        return "✅ ඔන්න මම බඩු ටික එව්වා. කැමති එකක් තියෙනවා නම් කියන්න මචන්!";
                    } 
                }
                
                return "සොරි මචන්, ඔයා හොයන ජාතියේ බඩු නම් දැනට ස්ටොක් නෑ වගේ. 😕";

            } catch (err) {
                console.log("Search Error:", err.message);
                return "සර්ච් කරද්දී පොඩි අවුලක් ගියා මචන්.";
            }
        }
        // ============================================================
        // 🚨 INTELLIGENT ALERT SYSTEM (AI එක තීරණය කරන එවා)
        // ============================================================
        
        // AI එකේ උත්තරේ ඇතුලේ "ADMIN_ALERT_TRIGGER" කෑල්ල තියෙනවද බලනවා
        // (උදා: නම්බර් ඉල්ලුවම හෝ එරර් එකක් කිව්වම AI එක මේ ටැග් එක දානවා)
        if (aiReply.includes("ADMIN_ALERT_TRIGGER|")) {
            
            // 1. ටැග් එකෙන් විස්තරේ කඩලා ගන්නවා
            const parts = aiReply.split("ADMIN_ALERT_TRIGGER|");
            const alertReason = parts[1].split("\n")[0]; // Reason එක ගන්නවා
            const cleanReply = parts[0] + (parts[1].split("\n")[1] || ""); // යූසර්ට යවන්න ඕන කොටස සුද්ධ කරනවා

            // 2. Owner ට රහස් මැසේජ් එක යවනවා
            const ownerJid = CONFIG.OWNER_PHONE + "@s.whatsapp.net";
            const alertMsg = `⚠️ *ASSISTANT ALERT*\n👤 From: ${senderNum}\n📝 Reason: ${alertReason.trim()}`;
            
           
            console.log(`🚨 Triggering Admin Alert: ${alertReason}`);
            await sock.sendMessage(ownerJid, { text: alertMsg });

           
            aiReply = cleanReply.trim() || "හරි මචන් මම sh4lu_z ට කිව්වා.";

        }
        history.push({ role: "assistant", content: aiReply });
        if (history.length > 4) history = history.slice(-4);
        fs.writeFileSync(filePath, JSON.stringify({ messages: history }));

        // 5. විනාඩි 30 ඉනැක්ටිව් ටයිමර් එක (Auto-Expiry)
        if (timers.has(senderNum)) clearTimeout(timers.get(senderNum));

        const timer = setTimeout(async () => {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath); // JSON එක මකනවා
                await sock.sendMessage(`${senderNum}@s.whatsapp.net`, { text: " ඔබට සුබ දවසක්! 🥂" });
                timers.delete(senderNum);
                console.log(`🧹 History cleared for ${senderNum}`);
            }
        }, 30 * 60 * 1000); // විනාඩි 30

        timers.set(senderNum, timer);

        return aiReply;

    } catch (error) {
        console.error("AI Logic Error:", error.message);
        return "පොඩි අවුලක් මචන්, විනාඩියකින් ආයේ ට්‍රයි එකක් දෙමු.";
    }
}

module.exports = { getMachanResponse };
