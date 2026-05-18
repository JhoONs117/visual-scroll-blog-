'use strict';

require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TT_API = 'https://open.tiktokapis.com/v2';

// TikTok Content Posting API — richiede:
//   TIKTOK_ACCESS_TOKEN — OAuth 2.0 access token con scope video.upload
//
// Modalità inbox (draft): il video appare come bozza nel profilo TikTok,
// il creator lo pubblica manualmente dall'app. Sandbox usa sempre questa modalità.
// video.publish (post diretto) richiede approvazione produzione separata.
//
// Setup: developers.tiktok.com → crea App → Content Posting API →
//        scope video.upload + user.info.basic → sandbox → genera token

// ── inizializza upload video come bozza (inbox) ───────────────────────────
async function initUpload(token, videoSize) {
  const res = await axios.post(
    `${TT_API}/post/publish/inbox/video/init/`,
    {
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: videoSize,
        chunk_size: videoSize,
        total_chunk_count: 1,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      timeout: 30000,
    }
  );
  return res.data.data;
}

// ── upload singolo chunk ─────────────────────────────────────────────────
async function uploadChunk(uploadUrl, videoBuffer, videoSize) {
  await axios.put(uploadUrl, videoBuffer, {
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Range': `bytes 0-${videoSize - 1}/${videoSize}`,
      'Content-Length': videoSize,
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    timeout: 300000,
  });
}

// ── verifica status publish (polling) ────────────────────────────────────
async function waitForPublish(token, publishId, maxWaitMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const res = await axios.post(
      `${TT_API}/post/publish/status/fetch/`,
      { publish_id: publishId },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        timeout: 15000,
      }
    );
    const s = res.data.data;
    if (s.status === 'PUBLISH_COMPLETE') return s;
    if (s.status === 'FAILED') throw new Error(`TikTok publish fallito: ${JSON.stringify(s)}`);
    console.log(`  status: ${s.status} — attesa 5s...`);
    await new Promise(r => setTimeout(r, 5000));
  }
  throw new Error('timeout attesa publish TikTok (2 min)');
}

// ── retry con backoff esponenziale ────────────────────────────────────────
async function withRetry(fn, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isLast = attempt === maxAttempts;
      const status = err.response?.status;
      if (isLast || (status && status < 500 && status !== 429)) throw err;
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`  retry ${attempt}/${maxAttempts} tra ${delay / 1000}s...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// ── aggiorna publish_status nel JSON ─────────────────────────────────────
function updateArticle(filePath, channel, status, error = null) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!data.publish_status) data.publish_status = {};
  if (!data.publish_error)  data.publish_error  = {};
  data.publish_status[channel] = status;
  data.publish_error[channel]  = error;
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ── trova file JSON più recente per slug ─────────────────────────────────
function findArticleFile(agentId, slug) {
  const dir = agentId === 'ai-news'
    ? path.join(ROOT, 'output')
    : path.join(ROOT, 'output', agentId);

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
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

// ── trova mp4 render per slug ─────────────────────────────────────────────
function findVideoFile(agentId, slug) {
  const rendersDir = agentId === 'ai-news'
    ? path.join(ROOT, 'output', 'renders')
    : path.join(ROOT, 'output', agentId, 'renders');

  const videoPath = path.join(rendersDir, `${slug}.mp4`);
  if (!fs.existsSync(videoPath)) {
    throw new Error(
      `video non trovato: ${videoPath}\n` +
      `Esegui prima: node render/render-video.js --agent ${agentId} --slug ${slug}`
    );
  }
  return videoPath;
}

// ── pubblica video su TikTok ──────────────────────────────────────────────
async function publishToTikTok(article, videoPath) {
  const token  = process.env.TIKTOK_ACCESS_TOKEN;
  // usa script TikTok come caption, fallback su titolo
  const script = article.formats?.tiktok?.script || [];
  const caption = (Array.isArray(script) ? script.filter(Boolean).join(' ') : '')
    || article.instagram_caption
    || article.title
    || '';

  const videoBuffer = fs.readFileSync(videoPath);
  const videoSize   = videoBuffer.length;
  const sizeMB      = (videoSize / 1024 / 1024).toFixed(1);

  console.log(`  video: ${path.basename(videoPath)} (${sizeMB}MB)`);
  if (videoSize > 4 * 1024 * 1024 * 1024) {
    throw new Error('video troppo grande (max 4GB TikTok)');
  }

  // 1. inizializza
  console.log('  inizializzazione upload...');
  const { publish_id, upload_url } = await withRetry(() =>
    initUpload(token, videoSize)
  );
  console.log(`  publish_id: ${publish_id}`);

  // 2. upload
  console.log('  upload video...');
  await uploadChunk(upload_url, videoBuffer, videoSize);
  console.log('  upload completato');

  // 3. attendi
  console.log('  attesa processamento TikTok...');
  const result = await waitForPublish(token, publish_id);
  console.log(`  status finale: ${result.status}`);

  return publish_id;
}

// ── entry point ───────────────────────────────────────────────────────────
async function publish(agentId, slug) {
  if (!process.env.TIKTOK_ACCESS_TOKEN) {
    throw new Error(
      'credenziali TikTok mancanti in .env:\n' +
      '  TIKTOK_ACCESS_TOKEN=<OAuth2 access token con scope video.upload>\n' +
      'Setup: developers.tiktok.com → app sandbox → aggiungi account test → genera token'
    );
  }

  const articleFile = findArticleFile(agentId, slug);
  const article     = JSON.parse(fs.readFileSync(articleFile, 'utf8'));
  const videoPath   = findVideoFile(agentId, slug);

  console.log(`\n▶ TikTok publish: ${slug}`);

  try {
    const publishId = await publishToTikTok(article, videoPath);
    updateArticle(articleFile, 'tiktok', 'published');
    console.log(`✅ pubblicato su TikTok (publish_id: ${publishId})`);
  } catch (err) {
    const msg = err.response?.data
      ? JSON.stringify(err.response.data)
      : err.message;
    updateArticle(articleFile, 'tiktok', 'failed', msg);
    console.error(`❌ TikTok publish fallito: ${msg}`);
    throw err;
  }
}

module.exports = { publish };

// ── CLI: node publish/publisher-tiktok.js --agent ai-news --slug SLUG ─────
if (require.main === module) {
  function arg(name) {
    const i = process.argv.indexOf(name);
    return i !== -1 ? process.argv[i + 1] : null;
  }
  const agentId = arg('--agent');
  const slug    = arg('--slug');

  if (!agentId || !slug) {
    console.error('Uso: node publish/publisher-tiktok.js --agent ai-news --slug SLUG');
    process.exit(1);
  }

  publish(agentId, slug).catch(() => process.exit(1));
}
