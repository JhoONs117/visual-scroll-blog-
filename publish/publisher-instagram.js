'use strict';

require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// Instagram Graph API (Business) — richiede Instagram Business account collegato a Facebook Page
// Credenziali necessarie in .env:
//   INSTAGRAM_USER_ID       — ID numerico dell'account Instagram Business
//   INSTAGRAM_ACCESS_TOKEN  — token con permessi: instagram_content_publish, instagram_basic
//
// Setup: developers.facebook.com → crea App → aggiungi prodotto "Instagram" →
//        collega Instagram Business account → genera token con i permessi sopra

const IG_BASE = 'https://graph.facebook.com/v21.0';

// ── fetch Pexels photo URL per image_query (fallback slides senza immagine) ─
async function fetchPexelsImageUrl(query) {
  if (!process.env.PEXELS_API_KEY) return null;
  try {
    const res = await axios.get('https://api.pexels.com/v1/search', {
      headers: { Authorization: process.env.PEXELS_API_KEY },
      params: { query, per_page: 5, orientation: 'portrait' },
      timeout: 10000,
    });
    const photos = res.data.photos || [];
    if (!photos.length) return null;
    // url .large è JPEG ~940×1400 — formato accettato da Instagram
    return photos[0].src.large;
  } catch {
    return null;
  }
}

// ── risolvi URL immagini per tutti i carousel slides ──────────────────────
async function resolveCarouselImages(carousel) {
  const urls = [];
  for (const slide of carousel) {
    if (slide.image && slide.image.startsWith('http')) {
      urls.push(slide.image);
    } else if (slide.image_query) {
      console.log(`  Pexels fetch: "${slide.image_query}"...`);
      const url = await fetchPexelsImageUrl(slide.image_query);
      if (url) urls.push(url);
      else console.warn(`  ⚠ nessuna immagine trovata per "${slide.image_query}", slide saltato`);
    }
  }
  return urls;
}

// ── crea container per singola immagine carousel ──────────────────────────
async function createCarouselItem(userId, token, imageUrl) {
  const res = await axios.post(`${IG_BASE}/${userId}/media`, null, {
    params: {
      image_url: imageUrl,
      is_carousel_item: true,
      access_token: token,
    },
    timeout: 30000,
  });
  return res.data.id;
}

// ── crea container carousel (aggrega tutti i figli) ───────────────────────
async function createCarouselContainer(userId, token, childIds, caption) {
  const res = await axios.post(`${IG_BASE}/${userId}/media`, null, {
    params: {
      media_type: 'CAROUSEL',
      children: childIds.join(','),
      caption: caption.slice(0, 2200),
      access_token: token,
    },
    timeout: 30000,
  });
  return res.data.id;
}

// ── pubblica il container già creato ─────────────────────────────────────
async function publishContainer(userId, token, creationId) {
  const res = await axios.post(`${IG_BASE}/${userId}/media_publish`, null, {
    params: {
      creation_id: creationId,
      access_token: token,
    },
    timeout: 30000,
  });
  return res.data.id;
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

// ── pubblica carousel su Instagram ────────────────────────────────────────
async function publishToInstagram(article) {
  const userId = process.env.INSTAGRAM_USER_ID;
  const token  = process.env.INSTAGRAM_ACCESS_TOKEN;

  const carousel = article.formats?.instagram?.carousel || [];
  const caption  = article.formats?.instagram?.caption || article.instagram_caption || '';

  if (!carousel.length) throw new Error('formats.instagram.carousel mancante o vuoto');
  if (!caption)         throw new Error('formats.instagram.caption mancante');

  console.log('  risoluzione immagini carousel...');
  const imageUrls = await resolveCarouselImages(carousel);

  if (imageUrls.length < 2) {
    throw new Error(`solo ${imageUrls.length} immagini risolte — Instagram richiede almeno 2`);
  }

  console.log(`  ${imageUrls.length} immagini pronte`);

  // 1. container per ogni immagine
  const childIds = [];
  for (let i = 0; i < imageUrls.length; i++) {
    console.log(`  container immagine ${i + 1}/${imageUrls.length}...`);
    const id = await withRetry(() => createCarouselItem(userId, token, imageUrls[i]));
    childIds.push(id);
    if (i < imageUrls.length - 1) await new Promise(r => setTimeout(r, 500));
  }

  // 2. container carousel
  console.log('  container carousel...');
  const creationId = await withRetry(() => createCarouselContainer(userId, token, childIds, caption));

  // 3. pubblica
  console.log('  pubblicazione...');
  const postId = await withRetry(() => publishContainer(userId, token, creationId));
  return postId;
}

// ── entry point ───────────────────────────────────────────────────────────
async function publish(agentId, slug) {
  if (!process.env.INSTAGRAM_USER_ID || !process.env.INSTAGRAM_ACCESS_TOKEN) {
    throw new Error(
      'credenziali Instagram mancanti in .env:\n' +
      '  INSTAGRAM_USER_ID=<id numerico Instagram Business>\n' +
      '  INSTAGRAM_ACCESS_TOKEN=<token con instagram_content_publish>\n' +
      'Setup: developers.facebook.com → crea App → Instagram → Business Login → genera token'
    );
  }

  const articleFile = findArticleFile(agentId, slug);
  const article = JSON.parse(fs.readFileSync(articleFile, 'utf8'));

  console.log(`\n▶ Instagram publish: ${slug}`);

  try {
    const postId = await publishToInstagram(article);
    console.log(`  post id: ${postId}`);
    updateArticle(articleFile, 'instagram', 'published');
    console.log('✅ pubblicato su Instagram');
  } catch (err) {
    const msg = err.response?.data
      ? JSON.stringify(err.response.data)
      : err.message;
    updateArticle(articleFile, 'instagram', 'failed', msg);
    console.error(`❌ Instagram publish fallito: ${msg}`);
    throw err;
  }
}

module.exports = { publish };

// ── CLI: node publish/publisher-instagram.js --agent ai-news --slug SLUG ──
if (require.main === module) {
  function arg(name) {
    const i = process.argv.indexOf(name);
    return i !== -1 ? process.argv[i + 1] : null;
  }
  const agentId = arg('--agent');
  const slug    = arg('--slug');

  if (!agentId || !slug) {
    console.error('Uso: node publish/publisher-instagram.js --agent ai-news --slug SLUG');
    process.exit(1);
  }

  publish(agentId, slug).catch(() => process.exit(1));
}
