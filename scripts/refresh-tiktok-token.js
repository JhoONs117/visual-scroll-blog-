'use strict';

// Rinnova il TIKTOK_ACCESS_TOKEN usando il TIKTOK_REFRESH_TOKEN
// Il refresh token dura ~365 giorni, l'access token ~24h
//
// Uso: node scripts/refresh-tiktok-token.js
// Aggiunge automaticamente il nuovo token al .env locale

require('dotenv').config();
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const CLIENT_KEY      = process.env.TIKTOK_CLIENT_KEY;
const CLIENT_SECRET   = process.env.TIKTOK_CLIENT_SECRET;
const REFRESH_TOKEN   = process.env.TIKTOK_REFRESH_TOKEN;
const ENV_PATH        = path.resolve(__dirname, '..', '.env');

if (!CLIENT_KEY || !CLIENT_SECRET || !REFRESH_TOKEN) {
  console.error('❌ Mancano in .env: TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_REFRESH_TOKEN');
  process.exit(1);
}

const params = new URLSearchParams({
  client_key:     CLIENT_KEY,
  client_secret:  CLIENT_SECRET,
  grant_type:     'refresh_token',
  refresh_token:  REFRESH_TOKEN,
});

const body = params.toString();

console.log('🔄 Rinnovo access token TikTok...');

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
      let data;
      try { data = JSON.parse(raw); } catch { console.error('❌ Risposta non valida:', raw); process.exit(1); }

      if (data.error) {
        console.error(`❌ Errore: ${data.error} — ${data.error_description}`);
        console.error('   Il refresh token potrebbe essere scaduto. Rigenera con: node scripts/get-tiktok-token.js');
        process.exit(1);
      }

      const newAccessToken  = data.access_token;
      const newRefreshToken = data.refresh_token || REFRESH_TOKEN;

      // aggiorna .env in-place
      let envContent = fs.readFileSync(ENV_PATH, 'utf8');
      envContent = envContent
        .replace(/^TIKTOK_ACCESS_TOKEN=.*/m,  `TIKTOK_ACCESS_TOKEN=${newAccessToken}`)
        .replace(/^TIKTOK_REFRESH_TOKEN=.*/m, `TIKTOK_REFRESH_TOKEN=${newRefreshToken}`);
      fs.writeFileSync(ENV_PATH, envContent);

      console.log('✅ Token rinnovato e .env aggiornato');
      console.log(`   TIKTOK_ACCESS_TOKEN=${newAccessToken.slice(0, 20)}...`);
      console.log(`   Scade tra: ${Math.round(data.expires_in / 3600)}h`);
    });
  }
);

req.on('error', err => { console.error('❌', err.message); process.exit(1); });
req.write(body);
req.end();
