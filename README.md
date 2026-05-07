# 🚀 BizMate-WhatsApp-MD
### The Ultimate AI-Powered WhatsApp Business Assistant

<div align="center">

![BizMate Banner](./assets/banner.png)

[![WhatsApp](https://img.shields.io/badge/BizMate-WhatsApp_Business_Bot-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://wa.me/94740798233)
[![Session](https://img.shields.io/badge/Get_Session-Syntiox_Sync-blue?style=for-the-badge&logo=vercel)](https://syntiox-sync.vercel.app/)
[![License](https://img.shields.io/github/license/sh4lu-z/BizMate-WhatsApp-MD?style=for-the-badge&color=orange)](./LICENSE)

</div>

---

## 🌟 Overview
**BizMate** is a professional-grade AI assistant for WhatsApp, specifically engineered for e-commerce and business automation. Built on top of the robust **Baileys** library and powered by **Llama 3 (Groq)**, it brings human-like interaction and smart search capabilities to your customer service.

---

## ⚡ Quick Start

### 1️⃣ Get Your Session ID
Before deploying, you need a WhatsApp session. Use our secure bridge to generate one:
👉 **[Syntiox Sync - Generate Session](https://syntiox-sync.vercel.app/)**

### 2️⃣ Deployment Methods

#### 🏠 Local / VPS Deployment (Interactive)
For Windows, Linux, or VPS with terminal access, use our automated setup script:
```bash
npm install
npm run setup
npm start
```

#### ☁️ Cloud Deployment (Koyeb, Heroku, Railway)
For cloud platforms, you don't need a `.env` file. Instead, add the following **Environment Variables** in your platform's dashboard:

| Key | Value Description |
| :--- | :--- |
| `MONGO_URL` | Your MongoDB Atlas connection string. |
| `SESSION_ID` | The session ID from Syntiox Sync. |
| `GROQ_API_KEY_1` | Your API key from Groq Console. |
| `OWNER_PHONE` | Your phone number (e.g. 94740798233). |
| `MASTER_CODE` | Secret code for admin commands. |

---

## 💎 Features at a Glance

| Feature | Description |
| :--- | :--- |
| **🧠 AI Intent Analyzer** | Automatically detects if a customer wants to buy, search, or just chat. |
| **🛍️ Inventory Search** | Smart keyword-based product search across your entire catalog. |
| **🗣️ Multilingual** | Fluent in English, Sinhala, and Singlish for local market dominance. |
| **📦 Media Hosting** | Seamless integration with Catbox for high-speed product media hosting. |
| **📞 Anti-Call** | Protects your bot from unsolicited calls with automated rejections. |
| **🎛️ Command Panel** | Real-time control over bot modes (Public/Private) and settings via chat. |

---

## 🛠️ Detailed Configuration

| Variable | Required | Description |
| :--- | :--- | :--- |
| `MONGO_URL` | Yes | MongoDB connection string. |
| `SESSION_ID` | Yes | WhatsApp session ID. |
| `GROQ_API_KEY_1` | Yes | Groq AI API Key. |
| `OWNER_PHONE` | Yes | Allowed controller number. |
| `PAIRING_NUMBER` | No | Alternative pairing method. |
| `PORT` | No | Default is 8000. |

---

## 🤝 Contributing
We love community contributions! Help us make BizMate even better.

1.  **Fork** this repository.
2.  **Clone** your fork.
3.  **Create** a branch: `git checkout -b feature/cool-new-feature`.
4.  **Commit** your changes.
5.  **Push** to your branch.
6.  **Open** a Pull Request.

---

<div align="center">

Built with ❤️ by [**sh4lu_z**](https://www.google.com/search?q=shaluka+gimhan) and the **BizMate Community**.
*Connecting Business with AI Excellence.*

</div>
