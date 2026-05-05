require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { fetchArticles } = require('./fetch');

fs.mkdirSync(path.join(__dirname, 'output'), { recursive: true });
const { deduplicate, hardFilter, batchAIFilter } = require('./filter');
const { generateSlides } = require('./generate');
const { validateWithFallback } = require('./validate');

function slug(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
}

(async () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const stats = { fetched: 0, deduped: 0, hardFiltered: 0, aiFiltered: 0, generated: 0, fallbacks: 0 };

  const fetched = await fetchArticles();
  stats.fetched = fetched.length;

  const deduped = deduplicate(fetched);
  stats.deduped = deduped.length;

  const hardFiltered = hardFilter(deduped);
  stats.hardFiltered = hardFiltered.length;

  const aiFiltered = await batchAIFilter(hardFiltered);
  stats.aiFiltered = aiFiltered.length;

  for (const article of aiFiltered) {
    const result = await validateWithFallback(article.title, generateSlides);
    if (result === null) {
      stats.fallbacks++;
      continue;
    }
    const filename = `${timestamp}_${slug(article.title)}.json`;
    fs.writeFileSync(path.join(__dirname, 'output', filename), JSON.stringify(result, null, 2));
    stats.generated++;
  }

  // Scrivi frontend/data.js leggendo tutti i JSON in output/
  const outputDir = path.join(__dirname, 'output');
  const articles = fs.readdirSync(outputDir)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(outputDir, f), 'utf8')));
  fs.writeFileSync(
    path.join(__dirname, 'frontend', 'data.js'),
    `window.ARTICLES = ${JSON.stringify(articles, null, 2)};`
  );
  console.log(`frontend/data.js aggiornato con ${articles.length} articoli.`);

  console.log('\n=== Riepilogo ===');
  console.log(`Articoli fetched:    ${stats.fetched}`);
  console.log(`Dopo deduplica:      ${stats.deduped}`);
  console.log(`Dopo hard filter:    ${stats.hardFiltered}`);
  console.log(`Dopo AI filter:      ${stats.aiFiltered}`);
  console.log(`Slide generate:      ${stats.generated}`);
  console.log(`Fallback loggati:    ${stats.fallbacks}`);
})();
