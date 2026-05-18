'use strict';

// Scambia il codice TikTok OAuth con un access token
// Uso: node scripts/exchange-tiktok-code.js <CODE>

require('dotenv').config();
const https = require('https');

const code = process.argv[2];
if (!code) {
  console.error('Uso: node scripts/exchange-tiktok-code.js <CODE>');
  process.exit(1);
}

const CLIENT_KEY    = process.env.TIKTOK_CLIENT_KEY;
const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
const REDIRECT_URI  = 'https://visual-scroll-blog-production.up.railway.app/tiktok-callback';

if (!CLIENT_KEY || !CLIENT_SECRET) {
  console.error('❌ TIKTOK_CLIENT_KEY e TIKTOK_CLIENT_SECRET mancanti in .env');
  process.exit(1);
}

const params = new URLSearchParams({
  client_key:    CLIENT_KEY,
  client_secret: CLIENT_SECRET,
  code,
  grant_type:    'authorization_code',
  redirect_uri:  REDIRECT_URI,
});

const body = params.toString();

const req = https.request(
  {
    hostname: 'open.tiktokapis.com',
    path:     '/v2/oauth/token/',
    method:   'POST',
    headers: {
      'Content-Type':   'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
    },
  },
  (res) => {
    let raw = '';
    res.on('data', d => { raw += d; });
    res.on('end', () => {
      const data = JSON.parse(raw);
      if (data.error) {
        console.error(`❌ Errore: ${data.error} — ${data.error_description}`);
        process.exit(1);
      }
      console.log('\n✅ Token ottenuto! Aggiungi in .env:\n');
      console.log(`TIKTOK_ACCESS_TOKEN=${data.access_token}`);
      if (data.refresh_token) console.log(`TIKTOK_REFRESH_TOKEN=${data.refresh_token}`);
      console.log(`\nOpen ID: ${data.open_id}`);
      console.log(`Scade tra: ${Math.round(data.expires_in / 3600)}h`);
    });
  }
);
req.on('error', err => { console.error('❌', err.message); process.exit(1); });
req.write(body);
req.end();
