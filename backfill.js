require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { generateFormats, generateAINewsCaption } = require('./generate');

const OUTPUT_DIR = path.join(__dirname, 'output');

function slug(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
}

(async () => {
  const files = fs.readdirSync(OUTPUT_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => ({ file: f, full: path.join(OUTPUT_DIR, f) }));

  /* Mappa slug → formati già disponibili (da file che hanno thread_text) */
  const formatCache = new Map();
  for (const { full } of files) {
    const d = JSON.parse(fs.readFileSync(full, 'utf8'));
    if (d.thread_text) {
      const key = slug(d.title || '');
      if (!formatCache.has(key)) {
        formatCache.set(key, { thread_text: d.thread_text, video_script: d.video_script });
      }
    }
  }

  const todo = files.filter(({ full }) => {
    const d = JSON.parse(fs.readFileSync(full, 'utf8'));
    return !d.thread_text;
  });

  console.log(`File senza formati: ${todo.length} / ${files.length}`);
  console.log(`Formati già in cache (da duplicati): ${formatCache.size} slug unici\n`);

  let fromCache = 0, fromApi = 0, fail = 0;

  for (const { file, full } of todo) {
    const article = JSON.parse(fs.readFileSync(full, 'utf8'));
    const key = slug(article.title || '');
    process.stdout.write(`[${fromCache + fromApi + fail + 1}/${todo.length}] ${article.title.slice(0, 55)}... `);

    /* Usa i formati già generati per lo stesso articolo se disponibili */
    if (formatCache.has(key)) {
      const cached = formatCache.get(key);
      article.thread_text = cached.thread_text;
      article.video_script = cached.video_script;
      fs.writeFileSync(full, JSON.stringify(article, null, 2));
      console.log('OK (cache)');
      fromCache++;
      continue;
    }

    /* Altrimenti chiama DeepSeek */
    const formats = await generateFormats(article.title, article.slides);
    if (formats) {
      article.thread_text = formats.thread_text;
      article.video_script = formats.video_script;
      fs.writeFileSync(full, JSON.stringify(article, null, 2));
      formatCache.set(key, formats);
      console.log('OK (API)');
      fromApi++;
    } else {
      console.log('FALLITO');
      fail++;
    }
  }

  /* Backfill instagram_caption per articoli che ne sono privi */
  const todoCaption = files.filter(({ full }) => {
    const d = JSON.parse(fs.readFileSync(full, 'utf8'));
    return d.thread_text && !d.instagram_caption;
  });

  console.log(`\nArticoli senza instagram_caption: ${todoCaption.length}`);
  let captionOk = 0, captionFail = 0;

  for (const { full } of todoCaption) {
    const article = JSON.parse(fs.readFileSync(full, 'utf8'));
    process.stdout.write(`[caption] ${article.title.slice(0, 55)}... `);
    const caption = await generateAINewsCaption(article.title, article.slides, article.thread_text);
    if (caption) {
      article.instagram_caption = caption;
      fs.writeFileSync(full, JSON.stringify(article, null, 2));
      console.log('OK');
      captionOk++;
    } else {
      console.log('FALLITO');
      captionFail++;
    }
  }

  /* Ricostruisce data.js deduplicato per slug */
  const seen = new Set();
  const unique = files
    .map(({ full }) => JSON.parse(fs.readFileSync(full, 'utf8')))
    .filter(a => {
      const k = slug(a.title || '');
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => new Date(b.savedAt || b.pubDate || 0) - new Date(a.savedAt || a.pubDate || 0));

  fs.writeFileSync(
    path.join(__dirname, 'frontend', 'data.js'),
    `window.ARTICLES = ${JSON.stringify(unique, null, 2)};`
  );

  console.log(`\nfrontend/data.js aggiornato con ${unique.length} articoli unici (era ${files.length} con duplicati).`);
  console.log(`\n=== Fine ===`);
  console.log(`Formati da cache:     ${fromCache}`);
  console.log(`Formati da API:       ${fromApi}`);
  console.log(`Formati falliti:      ${fail}`);
  console.log(`Caption generate:     ${captionOk}`);
  console.log(`Caption fallite:      ${captionFail}`);
})();
