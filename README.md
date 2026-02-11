# 🚀 BizMate-WhatsApp-MD
### The Ultimate AI-Powered WhatsApp Business Assistant

<div align="center">

![BizMate Banner](https://img.shields.io/badge/BizMate-WhatsApp_Business_Bot-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)
[![Fork](https://img.shields.io/github/forks/sh4lu-z/BizMate-WhatsApp-MD?style=for-the-badge&label=FORK%20THIS%20REPO&color=blue)](https://github.com/sh4lu-z/BizMate-WhatsApp-MD/fork)

</div>

---

> **BizMate** is a next-generation AI-driven E-commerce assistant designed for WhatsApp. Powered by **Baileys**, **Llama 3 (Groq)**, and **MongoDB**, it intelligently understands customer intent, manages inventory, and streamlines sales across **English, Sinhala, and Singlish**.

---

## 🏗️ Deployment (Docker Method)
This is the most efficient way to deploy BizMate on a VPS or local machine, ensuring a stable and isolated environment.

### Prerequisites
* [Docker](https://www.docker.com/) and Docker Compose installed.
* A `.env` file configured with your API Keys and MongoDB URL.

### Step 1: Clone & Configure
First, clone the repository and navigate into the project directory:

```bash
git clone [https://github.com/sh4lu-z/BizMate-WhatsApp-MD.git](https://github.com/sh4lu-z/BizMate-WhatsApp-MD.git)
```
cd BizMate-WhatsApp-MD
Open the .env file to add your credentials:
```bash
nano .env
```
Step 2: Build & Run with Docker
With Docker, you don't need to worry about manual dependency installation. Simply run:
```bash
docker compose up -d --build
```
<!DOCTYPE html>
<html lang="en">
<head>
<style>
    body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        line-height: 1.6;
        color: #333;
    }
    .container {
        max-width: 900px;
        margin: 20px auto;
    }
    h2 {
        color: #128C7E;
        border-bottom: 2px solid #25D366;
        padding-bottom: 10px;
        margin-top: 30px;
    }
    table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    }
    th, td {
        padding: 15px;
        text-align: left;
        border: 1px solid #ddd;
    }
    th {
        background-color: #25D366;
        color: white;
        text-transform: uppercase;
        letter-spacing: 1px;
    }
    tr:nth-child(even) {
        background-color: #f9f9f9;
    }
    tr:hover {
        background-color: #f1f1f1;
    }
    .icon-cell {
        font-size: 1.2em;
        width: 50px;
        text-align: center;
    }
    .feature-name {
        font-weight: bold;
        color: #075E54;
    }
    .step-number {
        background-color: #128C7E;
        color: white;
        border-radius: 50%;
        width: 25px;
        height: 25px;
        display: inline-block;
        text-align: center;
        line-height: 25px;
        font-weight: bold;
        margin-right: 10px;
    }
</style>
</head>
<body>

<div class="container">
    <h2>🌟 Key Features</h2>
    <table>
        <thead>
            <tr>
                <th colspan="2">Feature</th>
                <th>Description</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td class="icon-cell">🧠</td>
                <td class="feature-name">Smart Intent Detection</td>
                <td>Uses advanced AI to distinguish between casual inquiries and serious purchase intent, providing appropriate responses automatically.</td>
            </tr>
            <tr>
                <td class="icon-cell">🏷️</td>
                <td class="feature-name">AI Keyword Generation</td>
                <td>When a product is added, the AI automatically generates 25+ relevant keywords to optimize search and organization.</td>
            </tr>
            <tr>
                <td class="icon-cell">☁️</td>
                <td class="feature-name">Cloud Inventory Management</td>
                <td>Integrated with Catbox, ensuring all product images and videos are stored safely in the cloud.</td>
            </tr>
            <tr>
                <td class="icon-cell">🚫</td>
                <td class="feature-name">Anti-Call System</td>
                <td>Automatically manages and rejects unsolicited WhatsApp calls to ensure uninterrupted business operations.</td>
            </tr>
            <tr>
                <td class="icon-cell">🌍</td>
                <td class="feature-name">Multilingual Support</td>
                <td>Seamlessly communicates in English, Sinhala, and Singlish to cater to a diverse customer base.</td>
            </tr>
        </tbody>
    </table>
    <h2>🤝 Contributing</h2>
    <p>We welcome contributions to make BizMate even better! Here is the workflow:</p>
    <table>
        <thead>
            <tr>
                <th>Step</th>
                <th>Action to Take</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td><span class="step-number">1</span></td>
                <td><strong>Fork</strong> the project to your own GitHub account.</td>
            </tr>
            <tr>
                <td><span class="step-number">2</span></td>
                <td><strong>Create</strong> your feature branch with a descriptive name.</td>
            </tr>
            <tr>
                <td><span class="step-number">3</span></td>
                <td><strong>Commit</strong> your changes with clear and concise messages.</td>
            </tr>
            <tr>
                <td><span class="step-number">4</span></td>
                <td><strong>Push</strong> the changes to your branch.</td>
            </tr>
            <tr>
                <td><span class="step-number">5</span></td>
                <td><strong>Open</strong> a Pull Request for review.</td>
            </tr>
        </tbody>
    </table>

</div>

</body>
</html>

<div align="center">

Developed with by sh4lu_z

Connecting Business with AI

</div>
