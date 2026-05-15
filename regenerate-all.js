require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { generateSlides, generateFormats } = require('./generate');

const OUTPUT_DIR = path.join(__dirname, 'output');

function slug(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
}

function buildDataJs(articles) {
  fs.writeFileSync(
    path.join(__dirname, 'frontend', 'data.js'),
    `window.ARTICLES = ${JSON.stringify(articles, null, 2)};`
  );
}

(async () => {
  const allFiles = fs.readdirSync(OUTPUT_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => ({ file: f, full: path.join(OUTPUT_DIR, f) }))
    .sort((a, b) => b.file.localeCompare(a.file)); // più recenti prima

  /* Un file per slug — il più recente */
  const seen = new Map();
  for (const { file, full } of allFiles) {
    const d = JSON.parse(fs.readFileSync(full, 'utf8'));
    const k = slug(d.title || '');
    if (!seen.has(k)) seen.set(k, { file, full, data: d });
  }

  const unique = [...seen.values()];
  console.log(`Articoli unici da rigenerare: ${unique.length}\n`);

  let ok = 0, fail = 0;

  for (const { file, full, data } of unique) {
    if (data.schema_version === 2) {
      process.stderr.write(`⚠️  SKIP ${file} — schema v2 (usa migrate-schema.js o il nuovo runner)\n`);
      continue;
    }
    process.stdout.write(`[${ok + fail + 1}/${unique.length}] ${(data.title || '').slice(0, 60)}... `);

    const slides = await generateSlides(data.title);
    if (!slides) {
      console.log('SLIDE FALLITE');
      fail++;
      continue;
    }

    const formats = await generateFormats(data.title, slides.slides);

    data.slides = slides.slides;
    if (formats) {
      data.thread_text = formats.thread_text;
      data.video_script = formats.video_script;
    }

    fs.writeFileSync(full, JSON.stringify(data, null, 2));
    console.log('OK');
    ok++;
  }

  /* Ricostruisce data.js con gli articoli aggiornati, ordinati per data */
  const final = unique
    .map(({ data }) => data)
    .sort((a, b) => new Date(b.savedAt || b.pubDate || 0) - new Date(a.savedAt || a.pubDate || 0));

  buildDataJs(final);

  console.log(`\n=== Fine ===`);
  console.log(`OK:      ${ok}`);
  console.log(`Falliti: ${fail}`);
  console.log(`data.js aggiornato con ${final.length} articoli.`);
})();
