'use strict';

require('dotenv').config();
const fs            = require('fs');
const path          = require('path');
const { execSync }  = require('child_process');
const { verifyMp4 } = require('../core/video-utils');

const ROOT = path.join(__dirname, '..');

// ─── CLI args ────────────────────────────────────────────────────────────────
const args    = process.argv.slice(2);
const getArg  = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };
const agentArg = getArg('--agent');   // opzionale: limita a un agente

const AGENTS = {
  'ai-news': path.join(ROOT, 'output'),
  'food':    path.join(ROOT, 'output', 'food'),
  'fitness': path.join(ROOT, 'output', 'fitness'),
};

// ─── Controlla se le carousel PNG esistono ───────────────────────────────────
function hasCarouselPngs(agentId, slug) {
  const dir  = path.join(ROOT, 'output', agentId, 'slides-png', slug);
  const file = path.join(dir, 'slide0.png');
  if (fs.existsSync(file)) return true;
  return fs.existsSync(path.join(dir, 'slide0.jpg'));
}

// ─── Trova articolo canonico per slug ────────────────────────────────────────
function findCanonical(outputDir, slug) {
  const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.json'));
  let best = null;
  for (const f of files) {
    const base  = f.replace('.json', '');
    const idx   = base.indexOf('_');
    const fSlug = idx !== -1 ? base.slice(idx + 1) : base;
    if (fSlug !== slug) continue;
    if (!best || f > best) best = f;
  }
  return best ? path.join(outputDir, best) : null;
}

// ─── Carica candidati da un agente ───────────────────────────────────────────
function loadCandidates(agentId, outputDir) {
  const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.json'));

  const best = {};
  for (const f of files) {
    const base  = f.replace('.json', '');
    const idx   = base.indexOf('_');
    const slug  = idx !== -1 ? base.slice(idx + 1) : base;
    if (!best[slug] || f > best[slug]) best[slug] = f;
  }

  const candidates = [];
  for (const [slug, filename] of Object.entries(best)) {
    let article;
    try {
      article = JSON.parse(fs.readFileSync(path.join(outputDir, filename), 'utf8'));
    } catch { continue; }

    if (article.status !== 'approved') continue;
    if (!article.render_quality) continue;
    if (!article.formats?.video?.scenes?.length) continue;
    if (article.render_status?.[article.render_quality] === 'done') continue;
    if (!hasCarouselPngs(agentId, slug)) continue;

    candidates.push({ article, filepath: path.join(outputDir, filename), agentId, slug });
  }

  return candidates;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  const agentIds = agentArg ? [agentArg] : Object.keys(AGENTS);

  let allCandidates = [];
  for (const agentId of agentIds) {
    const outputDir = AGENTS[agentId];
    if (!fs.existsSync(outputDir)) continue;
    const found = loadCandidates(agentId, outputDir);
    allCandidates = allCandidates.concat(found);
  }

  if (allCandidates.length === 0) {
    console.log('ℹ️  Nessun articolo pronto per il render.');
    console.log('   Controlla: approved + render_quality + scenes generate + PNG salvate');
    process.exit(0);
  }

  console.log(`🎬 ${allCandidates.length} articolo/i da renderizzare\n`);

  const rendersDir = path.join(ROOT, 'output', 'renders');
  fs.mkdirSync(rendersDir, { recursive: true });

  let success = 0;
  let failed  = 0;

  for (const { article, filepath, agentId, slug } of allCandidates) {
    const quality      = article.render_quality;
    const templateName = article.render_template || require('../agents')[agentId]?.video?.[quality] || 'slide_deck';
    const outputPath   = path.join(rendersDir, `${slug}.mp4`);

    console.log(`▶ [${agentId}] ${article.title}`);
    console.log(`  quality=${quality} | template=${templateName}`);

    let template;
    try {
      template = require('./templates')[templateName];
      if (!template) throw new Error(`template "${templateName}" non registrato`);
    } catch (e) {
      console.log(`  ❌ ${e.message}\n`);
      failed++;
      continue;
    }

    const agentConfig = require('../agents')[agentId];
    const scenes      = article.formats.video.scenes;
    const startMs     = Date.now();

    try {
      await template.render(article, scenes, agentConfig, outputPath);
    } catch (e) {
      article.render_status[quality] = 'error';
      article.render_error           = e.message.slice(0, 200);
      fs.writeFileSync(filepath, JSON.stringify(article, null, 2) + '\n');
      console.log(`  ❌ Render fallito: ${e.message.slice(0, 100)}\n`);
      failed++;
      continue;
    }

    let info;
    try { info = verifyMp4(outputPath); } catch { info = null; }

    const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
    const sizeMB  = info ? (info.sizeBytes / 1024 / 1024).toFixed(1) : '?';

    article.render_path            = path.relative(ROOT, outputPath);
    article.render_status[quality] = 'done';
    article.render_error           = null;
    fs.writeFileSync(filepath, JSON.stringify(article, null, 2) + '\n');

    console.log(`  ✅ ${elapsed}s — ${sizeMB}MB — ${info?.duration?.toFixed(1) || '?'}s\n`);
    success++;
  }

  console.log(`=== Fine ===`);
  console.log(`Successi: ${success} | Falliti: ${failed}`);

  if (success > 0) {
    console.log('\n📦 Build + push in corso...');
    try {
      execSync('node scripts/build-data-agents.js', { cwd: ROOT, stdio: 'inherit' });
      execSync('git add output/ frontend/data-agents.js', { cwd: ROOT, stdio: 'inherit' });
      execSync(`git commit -m "feat: video renderizzati (${success} ok)"`, { cwd: ROOT, stdio: 'inherit' });
      execSync('git push', { cwd: ROOT, stdio: 'inherit' });
      console.log('✅ Push completato — Railway rideploya in ~1 min');
    } catch (e) {
      console.log('⚠️  Push fallito:', e.message.slice(0, 100));
    }
  }
})();
