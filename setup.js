const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const questions = [
    { key: 'MONGO_URL', label: '🛢️ MongoDB URL: ', default: '' },
    { key: 'SESSION_ID', label: '🔑 Session ID (from Syntiox Sync): ', default: '' },
    { key: 'GROQ_API_KEY_1', label: '🤖 Groq API Key: ', default: '' },
    { key: 'OWNER_PHONE', label: '👤 Owner Phone (e.g. 947xxx): ', default: '' },
    { key: 'MASTER_CODE', label: '🔐 Master Code (for commands): ', default: 'sha2008@' },
];

const envData = {};

console.log('\n🚀 BizMate - Environment Setup Wizard');
console.log('------------------------------------\n');

const askQuestion = (index) => {
    if (index === questions.length) {
        let content = '';
        for (const key in envData) {
            content += `${key}=${envData[key]}\n`;
        }
        fs.writeFileSync('.env', content);
        console.log('\n✅ .env file created successfully!');
        console.log('You can now run "npm start" to launch your bot.\n');
        rl.close();
        return;
    }

    const q = questions[index];
    rl.question(`${q.label}${q.default ? `[default: ${q.default}] ` : ''}`, (answer) => {
        envData[q.key] = answer.trim() || q.default;
        askQuestion(index + 1);
    });
};

askQuestion(0);
