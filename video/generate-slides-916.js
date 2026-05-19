'use strict';

const fs               = require('fs');
const path             = require('path');
const os               = require('os');
const { spawnSync }    = require('child_process');
const axios            = require('axios');

const ROOT = path.join(__dirname, '..');

// Cerca PNG carousel locale in output/{agentId}/slides-png/{slug}/slide{i}.png
// Restituisce il path se esiste, null altrimenti.
function findCarouselPng(agentId, slug, index) {
  const dir  = path.join(ROOT, 'output', agentId, 'slides-png', slug);
  const file = path.join(dir, `slide${index}.png`);
  if (fs.existsSync(file)) return file;
  // accetta anche .jpg nel caso il browser salvi in quel formato
  const jpg = path.join(dir, `slide${index}.jpg`);
  if (fs.existsSync(jpg)) return jpg;
  return null;
}

async function downloadToTemp(url) {
  const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 20000 });
  const ext  = /\.png(\?|$)/i.test(url) ? '.png' : '.jpg';
  const tmp  = path.join(os.tmpdir(), `slide916_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  fs.writeFileSync(tmp, Buffer.from(resp.data));
  return tmp;
}

function runFFmpeg(args) {
  const result = spawnSync('ffmpeg', args, { stdio: 'pipe' });
  if (result.status !== 0) {
    const msg = result.stderr?.toString()?.split('\n').slice(-4).join(' ') || 'ffmpeg fallito';
    throw new Error(msg);
  }
}

async function generateSlides916(article, agentConfig) {
  const agentId   = agentConfig.id;
  const slug      = article.slug;
  const accent    = (agentConfig.theme?.palette?.accent || '#000000').replace(/^#/, '');
  const slidesDir = path.join(ROOT, 'output', agentId, 'slides-916');

  // Salta se già generato
  const firstSlide = path.join(slidesDir, `${slug}_slide0.jpg`);
  if (fs.existsSync(firstSlide)) {
    const existing = [];
    for (let i = 0; i < 5; i++) {
      const p = path.join(slidesDir, `${slug}_slide${i}.jpg`);
      if (fs.existsSync(p)) existing.push(p);
    }
    console.log(`[slides-916] già presenti (${existing.length}) — skip`);
    return existing;
  }

  fs.mkdirSync(slidesDir, { recursive: true });

  const slides = (article.carousel_slides || []).slice(0, 5);
  const paths  = [];

  for (let i = 0; i < slides.length; i++) {
    const cs      = slides[i];
    const outPath = path.join(slidesDir, `${slug}_slide${i}.jpg`);

    // ── Priorità 1: PNG carousel locale (1080×1350, design completo) ──────────
    const localPng = findCarouselPng(agentId, slug, i);

    if (localPng) {
      // Carousel PNG: 1080×1350 → pad a 1080×1920 (285px sopra e sotto)
      try {
        runFFmpeg([
          '-i', localPng,
          '-vf', `scale=1080:1350,pad=1080:1920:0:285:color=${accent}`,
          '-y', outPath,
        ]);
        paths.push(outPath);
        console.log(`[slides-916] slide ${i} ← carousel PNG → ${path.relative(ROOT, outPath)}`);
        continue;
      } catch (e) {
        console.warn(`⚠️  [slides-916] FFmpeg carousel slide ${i} fallito: ${e.message.slice(0, 120)}`);
      }
    }

    // ── Priorità 2: URL Pexels / article.image (fallback) ────────────────────
    const imageUrl = cs.image || (i === 0 ? article.image : null);

    let inputPath = null;
    let tmpFile   = null;

    if (imageUrl) {
      try {
        tmpFile   = await downloadToTemp(imageUrl);
        inputPath = tmpFile;
      } catch (e) {
        console.warn(`⚠️  [slides-916] download slide ${i} fallito: ${e.message} — black frame`);
      }
    } else {
      console.warn(`⚠️  [slides-916] slide ${i}: nessuna immagine — black frame`);
    }

    try {
      if (inputPath) {
        // Pexels: scale a 1080×1080 quadrata poi pad
        runFFmpeg([
          '-i', inputPath,
          '-vf', `scale=1080:1080,pad=1080:1920:0:420:color=${accent}`,
          '-y', outPath,
        ]);
      } else {
        runFFmpeg([
          '-f', 'lavfi',
          '-i', `color=c=black:size=1080x1080:rate=1`,
          '-vframes', '1',
          '-vf', `pad=1080:1920:0:420:color=${accent}`,
          '-y', outPath,
        ]);
      }
      paths.push(outPath);
      console.log(`[slides-916] slide ${i} ← Pexels → ${path.relative(ROOT, outPath)}`);
    } catch (e) {
      console.warn(`⚠️  [slides-916] FFmpeg slide ${i} fallito: ${e.message.slice(0, 120)}`);
    } finally {
      if (tmpFile) try { fs.unlinkSync(tmpFile); } catch {}
    }
  }

  return paths;
}

module.exports = { generateSlides916 };
