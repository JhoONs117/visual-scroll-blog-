'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIRS = [
  path.join(ROOT, 'output'),
  path.join(ROOT, 'output', 'food'),
  path.join(ROOT, 'output', 'fitness'),
];
const VALID_STATUSES = new Set(['draft', 'approved', 'scheduled', 'published', 'failed']);

// Restituisce solo il file più recente per ogni slug (stesso criterio di data.js)
function canonicalFiles(dir) {
  let files;
  try { files = fs.readdirSync(dir).filter(f => f.endsWith('.json')); }
  catch { return []; }
  const best = {};
  for (const f of files) {
    const base = f.replace('.json', '');
    const idx = base.indexOf('_');
    const slug = idx !== -1 ? base.slice(idx + 1) : base;
    if (!best[slug] || f > best[slug]) best[slug] = f;
  }
  return Object.values(best).map(f => path.join(dir, f));
}

function checkArticle(article, filename) {
  const errors = [];

  if (article.schema_version !== 2)
    errors.push(`schema_version: atteso 2, trovato ${JSON.stringify(article.schema_version)}`);

  if (!article.agent || typeof article.agent !== 'string')
    errors.push('agent: stringa non vuota richiesta');

  if (!article.slug || typeof article.slug !== 'string')
    errors.push('slug: stringa non vuota richiesta');

  if (!article.title || typeof article.title !== 'string')
    errors.push('title: stringa non vuota richiesta');

  if (!VALID_STATUSES.has(article.status))
    errors.push(`status: valore non valido "${article.status}" (atteso: draft|approved|scheduled|published|failed)`);

  // slides
  if (!Array.isArray(article.slides) || article.slides.length !== 5)
    errors.push(`slides: array di 5 elementi richiesto (trovato ${Array.isArray(article.slides) ? article.slides.length : typeof article.slides})`);
  else if (article.slides.some(s => typeof s !== 'string' || s.trim() === ''))
    errors.push('slides: tutti e 5 gli elementi devono essere stringhe non vuote');

  // carousel_slides
  if (!Array.isArray(article.carousel_slides) || article.carousel_slides.length !== 5)
    errors.push(`carousel_slides: array di 5 elementi richiesto (trovato ${Array.isArray(article.carousel_slides) ? article.carousel_slides.length : typeof article.carousel_slides})`);
  else {
    article.carousel_slides.forEach((cs, i) => {
      if (!cs || typeof cs !== 'object') {
        errors.push(`carousel_slides[${i}]: oggetto richiesto`);
      } else {
        if (!cs.hook || typeof cs.hook !== 'string')
          errors.push(`carousel_slides[${i}].hook: stringa non vuota richiesta`);
        if (!cs.description || typeof cs.description !== 'string')
          errors.push(`carousel_slides[${i}].description: stringa non vuota richiesta`);
      }
    });
  }

  // formats.x.thread
  const thread = article.formats?.x?.thread;
  if (!Array.isArray(thread) || thread.length !== 5)
    errors.push(`formats.x.thread: array di 5 elementi richiesto (trovato ${Array.isArray(thread) ? thread.length : typeof thread})`);
  else if (thread.some(s => typeof s !== 'string' || s.trim() === ''))
    errors.push('formats.x.thread: tutti e 5 gli elementi devono essere stringhe non vuote');

  // formats.instagram.caption
  const caption = article.formats?.instagram?.caption;
  if (!caption || typeof caption !== 'string')
    errors.push('formats.instagram.caption: stringa non vuota richiesta');

  // formats.tiktok.script
  const script = article.formats?.tiktok?.script;
  if (!Array.isArray(script) || script.length !== 5)
    errors.push(`formats.tiktok.script: array di 5 elementi richiesto (trovato ${Array.isArray(script) ? script.length : typeof script})`);
  else if (script.some(s => typeof s !== 'string' || s.trim() === ''))
    errors.push('formats.tiktok.script: tutti e 5 gli elementi devono essere stringhe non vuote');

  // alias legacy consistency
  if (article.thread_text !== undefined) {
    if (JSON.stringify(article.thread_text) !== JSON.stringify(article.formats?.x?.thread))
      errors.push('thread_text (alias): non è identico a formats.x.thread');
  }
  if (article.instagram_caption !== undefined) {
    if (article.instagram_caption !== article.formats?.instagram?.caption)
      errors.push('instagram_caption (alias): non è identico a formats.instagram.caption');
  }
  if (article.video_script !== undefined) {
    if (JSON.stringify(article.video_script) !== JSON.stringify(article.formats?.tiktok?.script))
      errors.push('video_script (alias): non è identico a formats.tiktok.script');
  }

  return errors;
}

let pass = 0;
let fail = 0;

for (const dir of DIRS) {
  const filepaths = canonicalFiles(dir);

  for (const filepath of filepaths) {
    const filename = path.basename(filepath);
    let article;
    try {
      article = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    } catch {
      console.log(`FAIL ${filename}`);
      console.log('  errore: JSON non valido');
      fail++;
      continue;
    }

    const errors = checkArticle(article, filename);
    if (errors.length === 0) {
      console.log(`PASS ${filename}`);
      pass++;
    } else {
      console.log(`FAIL ${filename}`);
      errors.forEach(e => console.log(`  - ${e}`));
      fail++;
    }
  }
}

console.log('');
console.log(`Risultato: ${pass} PASS | ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
