# 1. පදනම විදියට Node.js ලේටස්ට් වර්ෂන් එකක් ගමු
FROM node:20-slim

# 2. අත්‍යවශ්‍ය ටූල්ස් ටික ඉන්ස්ටෝල් කරමු 
# මෙතනට 'git' එකතු කළා, මොකද npm install වලට ඒක ඕනේ
RUN apt-get update && apt-get install -y \
    git \
    ffmpeg \
    imagemagick \
    webp \
    && rm -rf /var/lib/apt/lists/*

# 3. ප්‍රොජෙක්ට් එක තියෙන්න ඕන ඩිරෙක්ටරිය හදමු
WORKDIR /usr/src/app

# 4. Package files ටික කොපි කරලා Dependencies ඉන්ස්ටෝල් කරමු
COPY package*.json ./
RUN npm install --production

# 5. ඉතුරු ඔක්කොම කෝඩ් ටික කොපි කරමු
COPY . .

# 6. සර්වර් පෝර්ට් එක (Koyeb වලට 8000)
EXPOSE 8000

# 7. බොට්ව ස්ටාර්ට් කරන කමාන්ඩ් එක
CMD ["node", "index.js"]
