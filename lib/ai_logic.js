
const fs = require('fs');
const path = require('path');
const Groq = require("groq-sdk");
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { CONFIG } = require('../config');
const { SYSTEM_PROMPT } = require('./system_prompt');
dotenv.config();


let Product;
try {
    Product = mongoose.model('Products');
} catch (error) {

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

                keywords = keywords.flatMap(k => {
                    if (typeof k === 'object' && k !== null) {
                        return Object.values(k);
                    }
                    return k;
                });

                console.log("✅ Keywords Fixed:", keywords.slice(0, 5));

                if (keywords.length > 0) {

                    let Product;
                    try { Product = mongoose.model('Products'); } catch { Product = mongoose.models.Products; }

                    const products = await Product.find({
                        keywords: { $in: keywords.map(k => new RegExp(k, "i")) }
                    }).limit(3);

                    if (products.length > 0) {

                        await sock.sendMessage(from, { text: `🔍  ${products.length}  found it !*` });

                        for (const item of products) {

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

                        return "✅ Here I sent the items. If there's one you like, let me know, man!";
                    }
                }

                return "Sorry man, the type of item you're looking for seems to be out of stock right now. 😕";

            } catch (err) {
                console.log("Search Error:", err.message);
                return "I had a little trouble while searching, man.";
            }
        }

        if (aiReply.includes("ADMIN_ALERT_TRIGGER|")) {


            const parts = aiReply.split("ADMIN_ALERT_TRIGGER|");
            const alertReason = parts[1].split("\n")[0];
            const cleanReply = parts[0] + (parts[1].split("\n")[1] || "");

            const ownerJid = CONFIG.OWNER_PHONE + "@s.whatsapp.net";
            const alertMsg = `⚠️ *ASSISTANT ALERT*\n👤 From: ${senderNum}\n📝 Reason: ${alertReason.trim()}`;


            console.log(`🚨 Triggering Admin Alert: ${alertReason}`);
            await sock.sendMessage(ownerJid, { text: alertMsg });


            aiReply = cleanReply.trim() || "Okay, man, I told sh4lu_z.";

        }
        history.push({ role: "assistant", content: aiReply });
        if (history.length > 4) history = history.slice(-4);
        fs.writeFileSync(filePath, JSON.stringify({ messages: history }));

        if (timers.has(senderNum)) clearTimeout(timers.get(senderNum));

        const timer = setTimeout(async () => {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                await sock.sendMessage(`${senderNum}@s.whatsapp.net`, { text: " Good day to you! 🥂" });
                timers.delete(senderNum);
                console.log(`🧹 History cleared for ${senderNum}`);
            }
        }, 30 * 60 * 1000);

        timers.set(senderNum, timer);

        return aiReply;

    } catch (error) {
        console.error("AI Logic Error:", error.message);
        return "There was a slight problem, let's try again in a minute.";
    }
}

module.exports = { getMachanResponse };
