'use strict';

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { verifyMp4 } = require('../core/video-utils');

const ROOT = path.join(__dirname, '..');

// ─── CLI args ────────────────────────────────────────────────────────────────
const args   = process.argv.slice(2);
const getArg = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };

const agentId    = getArg('--agent');
const slugArg    = getArg('--slug');
const qualityArg = getArg('--quality');   // override render_quality dell'articolo

if (!agentId || !slugArg) {
  console.error('Uso: node video/render-video-v2.js --agent <id> --slug <slug> [--quality low|medium|high]');
  process.exit(1);
}

// ─── Carica config agente ────────────────────────────────────────────────────
let agentConfig;
try {
  agentConfig = require('../agents')[agentId];
  if (!agentConfig) throw new Error(`agente "${agentId}" non trovato`);
} catch (e) {
  console.error(`❌ agente "${agentId}" non trovato: ${e.message}`);
  process.exit(1);
}

// ─── Trova l'articolo canonico per slug ──────────────────────────────────────
const OUTPUT_DIR = agentId === 'ai-news'
  ? path.join(ROOT, 'output')
  : path.join(ROOT, 'output', agentId);

function findCanonical(slug) {
  const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.json'));
  let best = null;
  for (const f of files) {
    const base   = f.replace('.json', '');
    const idx    = base.indexOf('_');
    const fSlug  = idx !== -1 ? base.slice(idx + 1) : base;
    if (fSlug !== slug) continue;
    if (!best || f > best) best = f;
  }
  return best ? path.join(OUTPUT_DIR, best) : null;
}

const articlePath = findCanonical(slugArg);
if (!articlePath) {
  console.error(`❌ Articolo non trovato per slug: ${slugArg}`);
  process.exit(1);
}

let article;
try {
  article = JSON.parse(fs.readFileSync(articlePath, 'utf8'));
} catch (e) {
  console.error(`❌ Errore lettura articolo: ${e.message}`);
  process.exit(1);
}

// ─── Valida prerequisiti ─────────────────────────────────────────────────────
const quality = qualityArg || article.render_quality;
if (!quality) {
  console.error('❌ render_quality non impostato sull\'articolo e --quality non passato');
  process.exit(1);
}

const scenes = article.formats?.video?.scenes;
if (!scenes || scenes.length === 0) {
  console.error('❌ formats.video.scenes vuoto — esegui prima generate-video-plan.js');
  process.exit(1);
}

const templateName = article.render_template || agentConfig.video?.[quality] || 'slide_deck';

let template;
try {
  const registry = require('./templates');
  template = registry[templateName];
  if (!template) throw new Error(`template "${templateName}" non registrato`);
} catch (e) {
  console.error(`❌ template "${templateName}" non caricabile: ${e.message}`);
  process.exit(1);
}

// ─── Output path ─────────────────────────────────────────────────────────────
const rendersDir = path.join(ROOT, 'output', 'renders');
fs.mkdirSync(rendersDir, { recursive: true });
const outputPath = path.join(rendersDir, `${article.slug}.mp4`);

// ─── Render ───────────────────────────────────────────────────────────────────
console.log(`🎬 Render "${article.title}"`);
console.log(`   agent=${agentId} | quality=${quality} | template=${templateName}`);
console.log(`   scenes=${scenes.length} | output=${path.relative(ROOT, outputPath)}`);
console.log('');

(async () => {
  const startMs = Date.now();

  try {
    await template.render(article, scenes, agentConfig, outputPath);
  } catch (e) {
    // Aggiorna stato di errore nel JSON
    article.render_status[quality] = 'error';
    article.render_error           = e.message.slice(0, 200);
    fs.writeFileSync(articlePath, JSON.stringify(article, null, 2) + '\n');
    console.error(`❌ Render fallito: ${e.message}`);
    process.exit(1);
  }

  // Verifica MP4 finale
  let info;
  try {
    info = verifyMp4(outputPath);
  } catch (e) {
    console.warn(`⚠️  Verifica MP4 fallita: ${e.message}`);
    info = null;
  }

  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
  const sizeMB  = info ? (info.sizeBytes / 1024 / 1024).toFixed(1) : '?';

  // Salva render_path + render_status nel JSON
  article.render_path          = path.relative(ROOT, outputPath);
  article.render_status[quality] = 'done';
  article.render_error           = null;
  fs.writeFileSync(articlePath, JSON.stringify(article, null, 2) + '\n');

  console.log('');
  console.log(`✅ Completato in ${elapsed}s — ${sizeMB}MB`);
  if (info) console.log(`   ${info.width}x${info.height} | ${info.duration.toFixed(1)}s | ${info.codec}`);
  console.log(`   → ${path.relative(ROOT, outputPath)}`);
})();
