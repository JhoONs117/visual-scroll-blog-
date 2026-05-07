require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { fetchArticles } = require('./fetch');
const { normalize } = require('./filter');

const OUTPUT_DIR = path.join(__dirname, 'output');

function slug(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
}

function buildDataJs() {
  const seen = new Set();
  const articles = fs.readdirSync(OUTPUT_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, f), 'utf8')))
    .filter(a => { const k = slug(a.title || ''); if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => new Date(b.savedAt || b.pubDate || 0) - new Date(a.savedAt || a.pubDate || 0));
  fs.writeFileSync(
    path.join(__dirname, 'frontend', 'data.js'),
    `window.ARTICLES = ${JSON.stringify(articles, null, 2)};`
  );
  return articles.length;
}

(async () => {
  /* 1. Fetch RSS attuali */
  console.log('Fetching RSS...');
  const fetched = await fetchArticles();
  console.log(`${fetched.length} articoli dai feed\n`);

  /* 2. Costruisce mappa normalizedTitle → link */
  const linkMap = new Map();
  for (const a of fetched) {
    if (a.link) linkMap.set(normalize(a.title), a.link);
  }

  /* 3. Aggiorna tutti i JSON senza link */
  const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.json'));
  let found = 0, missing = 0;

  for (const file of files) {
    const full = path.join(OUTPUT_DIR, file);
    const d = JSON.parse(fs.readFileSync(full, 'utf8'));
    if (d.link) continue; // già presente

    const key = normalize(d.title || '');
    if (linkMap.has(key)) {
      d.link = linkMap.get(key);
      fs.writeFileSync(full, JSON.stringify(d, null, 2));
      found++;
    } else {
      missing++;
    }
  }

  console.log(`Link trovati:  ${found}`);
  console.log(`Link mancanti: ${missing} (articoli non più in RSS)`);

  const count = buildDataJs();
  console.log(`\ndata.js aggiornato: ${count} articoli unici`);
})();
