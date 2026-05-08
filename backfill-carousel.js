require('dotenv').config();

const fs   = require('fs');
const path = require('path');
const { generateCarouselSlides } = require('./generate');

const OUTPUT_DIR = path.join(__dirname, 'output');

function slug(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
}

/* Fetch og:image / twitter:image from article URL */
async function fetchArticleImage(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bot/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const m =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
    const imgUrl = m ? m[1].trim() : null;
    if (imgUrl && (imgUrl.startsWith('http') || imgUrl.startsWith('//'))) return imgUrl;
    return null;
  } catch {
    return null;
  }
}

function buildDataJs(allFiles) {
  const seen = new Set();
  const unique = allFiles
    .map(f => JSON.parse(fs.readFileSync(f, 'utf8')))
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
  return unique.length;
}

(async () => {
  /* Filtri slug opzionali: node backfill-carousel.js airbnb the-biggest */
  const FILTER = process.argv.slice(2).filter(a => !a.startsWith('--'));

  /* Carica tutti i file, prende il più recente per slug */
  const allFiles = fs.readdirSync(OUTPUT_DIR)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse();

  const seenSlugs = new Set();
  const uniqueEntries = [];
  for (const f of allFiles) {
    const art = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, f), 'utf8'));
    const k = slug(art.title || '');
    if (!seenSlugs.has(k)) {
      seenSlugs.add(k);
      uniqueEntries.push({ full: path.join(OUTPUT_DIR, f), art, key: k });
    }
  }

  const toProcess = FILTER.length
    ? uniqueEntries.filter(({ key }) => FILTER.some(q => key.includes(q)))
    : uniqueEntries;

  console.log(`Articoli unici: ${uniqueEntries.length} | Da processare: ${toProcess.length}\n`);

  const stats = { csUpdated: 0, csPresent: 0, csFailed: 0, imgFound: 0, imgMissing: 0 };

  for (const { full, art } of toProcess) {
    const label = art.title.slice(0, 60);
    let changed = false;

    /* a) carousel_slides */
    if (!art.carousel_slides) {
      process.stdout.write(`[carousel] ${label}... `);
      const r = await generateCarouselSlides(art.title, art.slides, art.thread_text);
      if (r) {
        art.carousel_slides = r.carousel_slides;
        changed = true;
        stats.csUpdated++;
        process.stdout.write('OK\n');
      } else {
        process.stdout.write(`SKIP carousel: ${art.title}\n`);
        stats.csFailed++;
      }
    } else {
      stats.csPresent++;
    }

    /* b) image */
    if (!art.image && art.link) {
      process.stdout.write(`[image]    ${label}... `);
      const imgUrl = await fetchArticleImage(art.link);
      if (imgUrl) {
        art.image = imgUrl;
        changed = true;
        stats.imgFound++;
        process.stdout.write('OK → ' + imgUrl.slice(0, 70) + '\n');
      } else {
        stats.imgMissing++;
        process.stdout.write('not found\n');
      }
    }

    if (changed) fs.writeFileSync(full, JSON.stringify(art, null, 2));
  }

  /* Ricostruisce data.js */
  const allFullPaths = fs.readdirSync(OUTPUT_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => path.join(OUTPUT_DIR, f));
  const count = buildDataJs(allFullPaths);

  console.log(`\nfrontend/data.js aggiornato con ${count} articoli unici.`);
  console.log(`\ncarousel_slides — Aggiornati: ${stats.csUpdated} | Già presenti: ${stats.csPresent} | Falliti: ${stats.csFailed}`);
  console.log(`image          — Trovate: ${stats.imgFound} | Non trovate: ${stats.imgMissing}`);
})();
