'use strict';

// Helper per generare l'access token TikTok via OAuth 2.0
// Uso: node scripts/get-tiktok-token.js
// Prerequisito: TIKTOK_CLIENT_KEY e TIKTOK_CLIENT_SECRET in .env
//               redirect URI http://localhost:3000/tiktok-callback configurato nel portale

require('dotenv').config();
const http   = require('http');
const https  = require('https');
const crypto = require('crypto');
const { execSync } = require('child_process');

const CLIENT_KEY    = process.env.TIKTOK_CLIENT_KEY;
const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
const REDIRECT_URI  = 'http://localhost:3000/tiktok-callback';
const SCOPES        = 'user.info.basic,video.upload';

if (!CLIENT_KEY || !CLIENT_SECRET) {
  console.error('❌ Aggiungi in .env:\n  TIKTOK_CLIENT_KEY=...\n  TIKTOK_CLIENT_SECRET=...');
  process.exit(1);
}

const state = crypto.randomBytes(8).toString('hex');

const authUrl =
  `https://www.tiktok.com/v2/auth/authorize/` +
  `?client_key=${CLIENT_KEY}` +
  `&scope=${SCOPES}` +
  `&response_type=code` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&state=${state}`;

console.log('\n📋 Apro il browser per autorizzare TikTok...');
console.log('   Se il browser non si apre, vai su:\n  ', authUrl, '\n');

// apri browser (WSL → cmd.exe)
try {
  execSync(`cmd.exe /c start "" "${authUrl}"`, { stdio: 'ignore' });
} catch {
  try { execSync(`xdg-open "${authUrl}"`, { stdio: 'ignore' }); } catch { /* manuale */ }
}

// server locale per catturare il callback
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:3000');
  if (url.pathname !== '/tiktok-callback') {
    res.end('not found'); return;
  }

  const code          = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  const error         = url.searchParams.get('error');

  if (error) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<h2>❌ Errore: ${error}</h2>`);
    console.error(`\n❌ Errore OAuth: ${error}`);
    server.close();
    return;
  }

  if (returnedState !== state) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h2>❌ State mismatch — riprova</h2>');
    server.close();
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end('<h2>✅ Autorizzato! Puoi chiudere questa finestra.</h2><p>Torna al terminale per il token.</p>');

  // scambia code per access token
  console.log('\n🔄 Scambio code per access token...');
  const tokenData = await exchangeCode(code);

  console.log('\n✅ ACCESS TOKEN OTTENUTO\n');
  console.log('Aggiungi in .env:');
  console.log(`  TIKTOK_ACCESS_TOKEN=${tokenData.access_token}`);
  if (tokenData.refresh_token) {
    console.log(`  TIKTOK_REFRESH_TOKEN=${tokenData.refresh_token}`);
  }
  console.log(`\nScade tra: ${tokenData.expires_in}s (${Math.round(tokenData.expires_in / 3600)}h)`);
  console.log(`Open ID: ${tokenData.open_id}`);

  server.close();
});

server.listen(3000, () => {
  console.log('⏳ In attesa di autorizzazione su http://localhost:3000/tiktok-callback ...');
});

function exchangeCode(code) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      client_key:    CLIENT_KEY,
      client_secret: CLIENT_SECRET,
      code,
      grant_type:    'authorization_code',
      redirect_uri:  REDIRECT_URI,
    });

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
          try {
            const parsed = JSON.parse(raw);
            if (parsed.error) return reject(new Error(`${parsed.error}: ${parsed.error_description}`));
            resolve(parsed);
          } catch (e) { reject(e); }
        });
      }
    );
    req.on('error', reject);

    // token endpoint usa form encoding, non JSON
    const params = new URLSearchParams({
      client_key: CLIENT_KEY,
      client_secret: CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
    });
    req.write(params.toString());
    req.end();
  });
}
