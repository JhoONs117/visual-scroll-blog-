'use strict';

require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// ── OAuth 1.0a helper ─────────────────────────────────────────────────────────
function oauthHeader(method, url, params = {}) {
  const creds = {
    oauth_consumer_key:     process.env.X_API_KEY,
    oauth_token:            process.env.X_ACCESS_TOKEN,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp:        String(Math.floor(Date.now() / 1000)),
    oauth_nonce:            crypto.randomBytes(16).toString('hex'),
    oauth_version:          '1.0',
  };

  const allParams = { ...params, ...creds };
  const base = Object.keys(allParams).sort()
    .map(k => `${pct(k)}=${pct(allParams[k])}`)
    .join('&');

  const sigBase = [method.toUpperCase(), pct(url), pct(base)].join('&');
  const sigKey  = `${pct(process.env.X_API_SECRET)}&${pct(process.env.X_ACCESS_TOKEN_SECRET)}`;
  const sig     = crypto.createHmac('sha1', sigKey).update(sigBase).digest('base64');

  const header  = { ...creds, oauth_signature: sig };
  return 'OAuth ' + Object.keys(header).sort()
    .map(k => `${pct(k)}="${pct(header[k])}"`)
    .join(', ');
}

function pct(s) { return encodeURIComponent(String(s)); }

// ── post singolo tweet ────────────────────────────────────────────────────────
async function postTweet(text, replyToId = null) {
  const url  = 'https://api.twitter.com/2/tweets';
  const body = replyToId
    ? { text, reply: { in_reply_to_tweet_id: replyToId } }
    : { text };

  const res = await axios.post(url, body, {
    headers: {
      Authorization:  oauthHeader('POST', url),
      'Content-Type': 'application/json',
    },
  });
  return res.data.data.id;
}

// ── retry con backoff esponenziale ────────────────────────────────────────────
async function withRetry(fn, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isLast = attempt === maxAttempts;
      const status = err.response?.status;
      // 429 rate limit o 5xx → riprova; 4xx altri → errore definitivo
      if (isLast || (status && status < 500 && status !== 429)) throw err;
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`  retry ${attempt}/${maxAttempts} tra ${delay / 1000}s...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// ── aggiorna publish_status nel JSON ─────────────────────────────────────────
function updateArticle(filePath, channel, status, error = null) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!data.publish_status) data.publish_status = {};
  if (!data.publish_error)  data.publish_error  = {};
  data.publish_status[channel] = status;
  data.publish_error[channel]  = error;
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ── trova file JSON per slug ──────────────────────────────────────────────────
function findArticleFile(agentId, slug) {
  const dir = agentId === 'ai-news'
    ? path.join(ROOT, 'output')
    : path.join(ROOT, 'output', agentId);

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  // cerca il file più recente con quel slug
  const matches = files
    .filter(f => {
      try {
        return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).slug === slug;
      } catch { return false; }
    })
    .sort()
    .reverse();

  if (!matches.length) throw new Error(`articolo non trovato: ${slug}`);
  return path.join(dir, matches[0]);
}

// ── pubblica thread su X ──────────────────────────────────────────────────────
async function publishToX(article, articleFile) {
  const thread = article.formats?.x?.thread;
  if (!Array.isArray(thread) || thread.length === 0) {
    throw new Error('formats.x.thread mancante o vuoto');
  }

  const tweets = thread.filter(t => t && t.trim());
  if (!tweets.length) throw new Error('thread vuoto dopo il filtro');

  console.log(`  thread: ${tweets.length} tweet`);

  let lastId = null;
  for (let i = 0; i < tweets.length; i++) {
    const id = await withRetry(() => postTweet(tweets[i], lastId));
    console.log(`  tweet ${i + 1}/${tweets.length} pubblicato (id: ${id})`);
    lastId = id;
    // pausa tra tweet per evitare rate limit
    if (i < tweets.length - 1) await new Promise(r => setTimeout(r, 1000));
  }

  return lastId;
}

// ── entry point ───────────────────────────────────────────────────────────────
async function publish(agentId, slug) {
  if (!process.env.X_API_KEY || !process.env.X_API_SECRET ||
      !process.env.X_ACCESS_TOKEN || !process.env.X_ACCESS_TOKEN_SECRET) {
    throw new Error('credenziali X mancanti — aggiungi X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET in .env');
  }

  const articleFile = findArticleFile(agentId, slug);
  const article = JSON.parse(fs.readFileSync(articleFile, 'utf8'));

  console.log(`\n▶ X publish: ${slug}`);

  try {
    await publishToX(article, articleFile);
    updateArticle(articleFile, 'x', 'published');
    console.log(`✅ pubblicato su X`);
  } catch (err) {
    const msg = err.response?.data
      ? JSON.stringify(err.response.data)
      : err.message;
    updateArticle(articleFile, 'x', 'failed', msg);
    console.error(`❌ X publish fallito: ${msg}`);
    throw err;
  }
}

module.exports = { publish };

// ── CLI: node publish/publisher-x.js --agent ai-news --slug SLUG ─────────────
if (require.main === module) {
  function arg(name) {
    const i = process.argv.indexOf(name);
    return i !== -1 ? process.argv[i + 1] : null;
  }
  const agentId = arg('--agent');
  const slug    = arg('--slug');

  if (!agentId || !slug) {
    console.error('Uso: node publish/publisher-x.js --agent ai-news --slug SLUG');
    process.exit(1);
  }

  publish(agentId, slug).catch(() => process.exit(1));
}
