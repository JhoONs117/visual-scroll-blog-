require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { generateFormats } = require('./generate');

const OUTPUT_DIR = path.join(__dirname, 'output');

(async () => {
  const files = fs.readdirSync(OUTPUT_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => ({ file: f, full: path.join(OUTPUT_DIR, f) }));

  const todo = files.filter(({ full }) => {
    const d = JSON.parse(fs.readFileSync(full, 'utf8'));
    return !d.thread_text;
  });

  console.log(`Articoli da aggiornare: ${todo.length} / ${files.length}`);

  let ok = 0, fail = 0;

  for (const { file, full } of todo) {
    const article = JSON.parse(fs.readFileSync(full, 'utf8'));
    process.stdout.write(`[${ok + fail + 1}/${todo.length}] ${article.title.slice(0, 60)}... `);

    const formats = await generateFormats(article.title, article.slides);

    if (formats) {
      article.thread_text = formats.thread_text;
      article.video_script = formats.video_script;
      fs.writeFileSync(full, JSON.stringify(article, null, 2));
      console.log('OK');
      ok++;
    } else {
      console.log('FALLITO');
      fail++;
    }
  }

  // Ricostruisce data.js con tutti gli articoli aggiornati
  const all = fs.readdirSync(OUTPUT_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, f), 'utf8')));

  fs.writeFileSync(
    path.join(__dirname, 'frontend', 'data.js'),
    `window.ARTICLES = ${JSON.stringify(all, null, 2)};`
  );

  console.log(`\nfrontend/data.js aggiornato con ${all.length} articoli.`);
  console.log(`\n=== Fine ===`);
  console.log(`Aggiornati: ${ok}`);
  console.log(`Falliti:    ${fail}`);
})();
