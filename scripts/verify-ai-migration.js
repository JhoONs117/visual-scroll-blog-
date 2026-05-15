'use strict';

const { spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const ROOT       = path.join(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'output');

// Mirrors checkArticle from contract-test.js
function checkArticle(article) {
  const errors = [];
  const VALID_STATUSES = new Set(['draft', 'approved', 'scheduled', 'published', 'failed']);

  if (article.schema_version !== 2)
    errors.push(`schema_version: atteso 2, trovato ${JSON.stringify(article.schema_version)}`);
  if (!article.agent || typeof article.agent !== 'string')
    errors.push('agent: stringa non vuota richiesta');
  if (!article.slug || typeof article.slug !== 'string')
    errors.push('slug: stringa non vuota richiesta');
  if (!article.title || typeof article.title !== 'string')
    errors.push('title: stringa non vuota richiesta');
  if (!VALID_STATUSES.has(article.status))
    errors.push(`status: valore non valido "${article.status}"`);

  if (!Array.isArray(article.slides) || article.slides.length !== 5)
    errors.push(`slides: array di 5 richiesto (trovato ${Array.isArray(article.slides) ? article.slides.length : typeof article.slides})`);
  else if (article.slides.some(s => typeof s !== 'string' || s.trim() === ''))
    errors.push('slides: tutti e 5 devono essere stringhe non vuote');

  if (!Array.isArray(article.carousel_slides) || article.carousel_slides.length !== 5)
    errors.push(`carousel_slides: array di 5 richiesto (trovato ${Array.isArray(article.carousel_slides) ? article.carousel_slides.length : typeof article.carousel_slides})`);
  else {
    article.carousel_slides.forEach((cs, i) => {
      if (!cs?.hook)        errors.push(`carousel_slides[${i}].hook: richiesto`);
      if (!cs?.description) errors.push(`carousel_slides[${i}].description: richiesto`);
    });
  }

  const thread = article.formats?.x?.thread;
  if (!Array.isArray(thread) || thread.length !== 5)
    errors.push('formats.x.thread: array di 5 richiesto');
  else if (thread.some(s => typeof s !== 'string' || s.trim() === ''))
    errors.push('formats.x.thread: tutti e 5 devono essere stringhe non vuote');

  const caption = article.formats?.instagram?.caption;
  if (!caption || typeof caption !== 'string')
    errors.push('formats.instagram.caption: stringa non vuota richiesta');

  const script = article.formats?.tiktok?.script;
  if (!Array.isArray(script) || script.length !== 5)
    errors.push('formats.tiktok.script: array di 5 richiesto');
  else if (script.some(s => typeof s !== 'string' || s.trim() === ''))
    errors.push('formats.tiktok.script: tutti e 5 devono essere stringhe non vuote');

  if (article.thread_text !== undefined &&
      JSON.stringify(article.thread_text) !== JSON.stringify(article.formats?.x?.thread))
    errors.push('thread_text (alias): non è identico a formats.x.thread');
  if (article.instagram_caption !== undefined &&
      article.instagram_caption !== article.formats?.instagram?.caption)
    errors.push('instagram_caption (alias): non è identico a formats.instagram.caption');
  if (article.video_script !== undefined &&
      JSON.stringify(article.video_script) !== JSON.stringify(article.formats?.tiktok?.script))
    errors.push('video_script (alias): non è identico a formats.tiktok.script');

  return errors;
}

function compareStructure(newArticle, oldArticle) {
  const diffs = [];
  // Only flag regressions: fields in OLD article missing from NEW (not extra fields in new)
  const KEY_FIELDS = [
    'schema_version', 'agent', 'slug', 'status', 'prompt_version',
    'title', 'slides', 'carousel_slides',
    'instagram_caption', 'video_script', 'thread_text',
    'formats',
  ];
  for (const f of KEY_FIELDS) {
    if ((f in oldArticle) && !(f in newArticle))
      diffs.push(`campo "${f}" presente nel vecchio ma mancante nel nuovo`);
  }
  for (const ch of ['x', 'instagram', 'tiktok']) {
    if (oldArticle.formats?.[ch] && !newArticle.formats?.[ch])
      diffs.push(`formats.${ch}: presente nel vecchio ma mancante nel nuovo`);
  }
  return diffs;
}

async function main() {
  console.log('=== verify-ai-migration.js ===\n');

  // 1. Snapshot prima
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const beforeSet = new Set(fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.json')));

  // 2. Esegui il runner (timeout 10min — il caricamento trigger IIFEs generate/filter)
  console.log('→ MAX_NEW_ARTICLES=1 node core/run-agent.js ai-news\n');
  const run = spawnSync('node', ['core/run-agent.js', 'ai-news'], {
    env:      { ...process.env, MAX_NEW_ARTICLES: '1' },
    cwd:      ROOT,
    timeout:  600000,
    encoding: 'utf8',
  });
  if (run.error || run.signal) {
    console.error(`FAIL: runner interrotto (${run.signal || run.error?.message})`);
    process.exit(1);
  }
  if (run.status !== 0) {
    console.error(`FAIL: runner uscito con codice ${run.status}\n${run.stderr}`);
    process.exit(1);
  }
  process.stdout.write((run.stdout || '') + '\n');

  // 3. Trova il nuovo file
  const afterFiles = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.json'));
  const newFiles   = afterFiles.filter(f => !beforeSet.has(f));

  let articleErrors = [];
  if (newFiles.length === 0) {
    console.log('Nessun nuovo articolo generato (feed senza novità o tutti già presenti).');
    console.log('Verifica solo il contract sugli articoli esistenti.\n');
  } else {
    const newFile    = path.join(OUTPUT_DIR, newFiles[0]);
    const newArticle = JSON.parse(fs.readFileSync(newFile, 'utf8'));
    console.log(`Articolo generato: ${newArticle.title}`);
    console.log(`File: ${newFiles[0]}\n`);

    // Contract check
    articleErrors = checkArticle(newArticle);
    if (articleErrors.length > 0) {
      console.log('--- Contract check: FAIL ---');
      articleErrors.forEach(e => console.log(`  ✗ ${e}`));
    } else {
      console.log('--- Contract check: PASS ---');
    }

    // Confronto strutturale con articolo AI news esistente
    const existingFiles = afterFiles
      .filter(f => beforeSet.has(f))
      .sort()
      .reverse();
    if (existingFiles.length > 0) {
      const oldArticle = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, existingFiles[0]), 'utf8'));
      // Solo confronta con articoli ai-news (non food)
      const aiNewsExisting = existingFiles.find(f => {
        try {
          return JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, f), 'utf8')).agent === 'ai-news';
        } catch { return false; }
      });
      const refArticle = aiNewsExisting
        ? JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, aiNewsExisting), 'utf8'))
        : oldArticle;

      const diffs = compareStructure(newArticle, refArticle);
      if (diffs.length > 0) {
        console.log('\n--- Confronto strutturale: DIFF ---');
        diffs.forEach(d => console.log(`  ! ${d}`));
        articleErrors.push(...diffs);
      } else {
        console.log('--- Confronto strutturale: identico ---');
      }
    }
    console.log('');
  }

  // 4. Contract test completo
  console.log('--- Contract test su tutti i file ---');
  const contractRun = spawnSync('node', ['scripts/contract-test.js'], {
    cwd: ROOT, encoding: 'utf8', timeout: 30000,
  });
  process.stdout.write(contractRun.stdout || '');
  const contractPassed = contractRun.status === 0;

  // 5. Risultato finale
  console.log('');
  if (contractPassed && articleErrors.length === 0) {
    console.log('PASS');
  } else {
    console.log('FAIL');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Errore:', err.message);
  process.exit(1);
});
