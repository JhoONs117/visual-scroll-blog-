require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { fetchArticles } = require('./fetch');

fs.mkdirSync(path.join(__dirname, 'output'), { recursive: true });
const { deduplicate, hardFilter, batchAIFilter } = require('./filter');
const { generateSlides, generateFormats, generateCarouselSlides } = require('./generate');
const { validateWithFallback } = require('./validate');

function slug(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
}

function buildDataJs(outputDir) {
  const seen = new Set();
  const articles = fs.readdirSync(outputDir)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(outputDir, f), 'utf8')))
    .filter(a => {
      const key = slug(a.title || '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => new Date(b.savedAt || b.pubDate || 0) - new Date(a.savedAt || a.pubDate || 0));
  fs.writeFileSync(
    path.join(__dirname, 'frontend', 'data.js'),
    `window.ARTICLES = ${JSON.stringify(articles, null, 2)};`
  );
  return articles.length;
}

(async () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const stats = { fetched: 0, deduped: 0, hardFiltered: 0, aiFiltered: 0, generated: 0, skipped: 0, fallbacks: 0 };

  const outputDir = path.join(__dirname, 'output');

  /* Carica gli slug già presenti in output/ per evitare duplicati cross-run */
  const existingSlugs = new Set(
    fs.readdirSync(outputDir)
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace(/^[^_]+_/, '').replace('.json', ''))
  );

  const fetched = await fetchArticles();
  stats.fetched = fetched.length;

  const deduped = deduplicate(fetched);
  stats.deduped = deduped.length;

  const hardFiltered = hardFilter(deduped);
  stats.hardFiltered = hardFiltered.length;

  const aiFiltered = await batchAIFilter(hardFiltered);
  stats.aiFiltered = aiFiltered.length;

  for (const article of aiFiltered) {
    /* Salta articoli già salvati in run precedenti */
    if (existingSlugs.has(slug(article.title))) {
      stats.skipped++;
      continue;
    }

    const result = await validateWithFallback(article.title, generateSlides);
    if (result === null) {
      stats.fallbacks++;
      continue;
    }

    if (process.env.GENERATE_FORMATS === 'true') {
      const formats = await generateFormats(result.title, result.slides);
      if (formats) {
        result.thread_text = formats.thread_text;
        result.video_script = formats.video_script;
      }
      const carousel = await generateCarouselSlides(result.title, result.slides);
      if (carousel) {
        result.carousel_slides = carousel.carousel_slides;
      }
    }

    result.pubDate   = article.pubDate || null;
    result.savedAt   = new Date().toISOString();
    result.link      = article.link || null;

    const filename = `${timestamp}_${slug(article.title)}.json`;
    fs.writeFileSync(path.join(outputDir, filename), JSON.stringify(result, null, 2));
    existingSlugs.add(slug(article.title));
    stats.generated++;
  }

  const count = buildDataJs(outputDir);
  console.log(`frontend/data.js aggiornato con ${count} articoli unici.`);

  console.log('\n=== Riepilogo ===');
  console.log(`Articoli fetched:    ${stats.fetched}`);
  console.log(`Dopo deduplica:      ${stats.deduped}`);
  console.log(`Dopo hard filter:    ${stats.hardFiltered}`);
  console.log(`Dopo AI filter:      ${stats.aiFiltered}`);
  console.log(`Già presenti (skip): ${stats.skipped}`);
  console.log(`Slide generate:      ${stats.generated}`);
  console.log(`Fallback loggati:    ${stats.fallbacks}`);
})();
