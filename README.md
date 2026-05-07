# 🤖 BizMate — WhatsApp Business AI

<div align="center">

<p align="center">
  <img src="./assets/banner.png" alt="BizMate Banner" width="600">
</p>

<br>

[![WhatsApp](https://img.shields.io/badge/BizMate-WhatsApp_Bot-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://wa.me/94740798233)
[![Syntiox Sync](https://img.shields.io/badge/Get_Session-Syntiox_Sync-6366f1?style=for-the-badge&logo=vercel&logoColor=white)](https://syntiox-sync.vercel.app/)
[![License](https://img.shields.io/github/license/sh4lu-z/BizMate-WhatsApp-MD?style=for-the-badge&color=f97316)](./LICENSE)
[![Issues](https://img.shields.io/github/issues/sh4lu-z/BizMate-WhatsApp-MD?style=for-the-badge&color=red)](https://github.com/sh4lu-z/BizMate-WhatsApp-MD/issues)
[![Stars](https://img.shields.io/github/stars/sh4lu-z/BizMate-WhatsApp-MD?style=for-the-badge&color=yellow)](https://github.com/sh4lu-z/BizMate-WhatsApp-MD/stargazers)

<br>

> **BizMate** is a next-generation, AI-powered WhatsApp Business Assistant.
> Built with **Baileys**, **Llama 3 (Groq)**, and **MongoDB** — it understands customer intent,
> searches your inventory, and handles your business — 24/7, automatically.

</div>

---

## ✨ Features

<table>
<tr>
<td>

**🧠 AI Intent Detection**
Detects whether a customer wants to buy, search, or just chat — and responds appropriately.

</td>
<td>

**🔍 Smart Product Search**
Searches inventory using AI-generated keywords across English, Sinhala & Singlish.

</td>
</tr>
<tr>
<td>

**📦 Cloud Media Hosting**
Product images and videos are auto-uploaded to Catbox and stored as URLs.

</td>
<td>

**🎛️ Owner Control Panel**
Change bot modes and settings in real-time via WhatsApp commands (`#cmd`).

</td>
</tr>
<tr>
<td>

**📞 Anti-Call System**
Automatically rejects unsolicited calls and notifies the sender.

</td>
<td>

**🌍 Multilingual Support**
Seamlessly communicates in English, Sinhala, and Singlish.

</td>
</tr>
</table>

---

## 🚀 Deployment Guide

### Step 1 — Generate Your WhatsApp Session

You need a session to connect the bot to your WhatsApp number. Use our free, secure bridge:

<div align="center">

### 👉 [syntiox-sync.vercel.app](https://syntiox-sync.vercel.app/)

</div>

1. Go to the link above and enter your phone number.
2. Approve the pairing request on your WhatsApp.
3. Copy the **Session ID** that appears on screen.

---

### Step 2 — Set Up Environment Variables

Choose the method that matches your hosting platform:

#### 🖥️ Local / Linux VPS (Interactive Wizard)
```bash
git clone https://github.com/sh4lu-z/BizMate-WhatsApp-MD.git
cd BizMate-WhatsApp-MD
npm install
npm run setup   # ← This creates your .env file automatically
npm start
```

#### ☁️ Cloud Platforms (Koyeb / Heroku / Railway)
No terminal needed. In your platform's dashboard, go to **"Environment Variables"** and add these:

| Variable | Required | What to Put |
| :--- | :---: | :--- |
| `SESSION_ID` | ✅ | The Session ID from [Syntiox Sync](https://syntiox-sync.vercel.app/) |
| `PAIRING_NUMBER` | ✅ | Your WhatsApp number used at Syntiox Sync (e.g. `94763929543`) |
| `MONGO_URL` | ✅ | Your MongoDB Atlas connection string |
| `GROQ_API_KEY_1` | ✅ | API key from [console.groq.com](https://console.groq.com) |
| `OWNER_PHONE` | ❌ | Bot owner's number. If empty, uses `PAIRING_NUMBER` |
| `MASTER_CODE` | ✅ | Secret code for admin commands |
| `GROQ_API_KEY_2` | ❌ | Optional 2nd Groq API key for rotation |
| `PORT` | ❌ | Default is `8000` |

> **⚠️ Important:** `SESSION_ID` **and** `PAIRING_NUMBER` are both needed together.
> The bot uses both to download your WhatsApp session from Syntiox Sync on first launch.

---

### Step 3 — Deploy

#### Docker (Recommended for VPS)
```bash
docker compose up -d --build
```

#### Manual (Node.js)
```bash
npm install
npm start
```

---

## 🎛️ Owner Commands

Use these commands on WhatsApp after the bot is running. Prefix is `#cmd`:

| Command | Description |
| :--- | :--- |
| `#cmd` | Show the control panel menu |
| `#cmd system on/off` | Enable or disable the bot |
| `#cmd mode public/private` | Switch between public and owner-only mode |
| `#cmd anticall on/off` | Toggle call blocking |
| `#cmd autostatus on/off` | Auto-view WhatsApp stories |
| `#cmd react on/off` | Auto react to incoming messages |
| `#cmd setemoji ❤️` | Change the auto-react emoji |

---

## 🗂️ Project Structure

```
BizMate-WhatsApp-MD/
├── lib/
│   ├── ai_logic.js        # AI response engine + product search
│   ├── mongoAuth.js       # WhatsApp session stored in MongoDB
│   └── system_prompt.js   # Business identity & AI personality
├── assets/
│   └── banner.png
├── config.js              # App config (loaded from .env)
├── index.js               # Main bot entry point
├── setup.js               # Interactive .env setup wizard
└── .env.example           # Template for environment variables
```

---

## 🤝 Contributing
We love community contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for full details.

---

<div align="center">

Made with ❤️ by [**sh4lu_z**](https://www.google.com/search?q=shaluka+gimhan) and the **BizMate Community**

*Connecting Business with AI — 24/7*

</div>
