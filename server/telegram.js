const https = require('https');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

function sendMessage(chatId, text) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    });

    const url = new URL(`${TELEGRAM_API}/sendMessage`);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const parsed = JSON.parse(data);
        if (parsed.ok) resolve(parsed);
        else reject(new Error(parsed.description));
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = { sendMessage };
