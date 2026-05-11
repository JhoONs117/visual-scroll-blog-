require('dotenv').config();

const fs   = require('fs');
const path = require('path');
const { generateCarouselSlides }              = require('./generate');
const { fetchPexelsImage, fetchArticleImage } = require('./fetch');

const OUTPUT_DIR = path.join(__dirname, 'output');

// --force: sovrascrive le immagini Pexels già presenti (usare per la migrazione da Wikimedia)
const FORCE  = process.argv.includes('--force');
// Rate limit Pexels free tier: 200 req/ora → 18s di sicurezza tra ogni chiamata
const PEXELS_DELAY_MS = 18000;

function slug(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
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
  const FILTER = process.argv.slice(2).filter(a => !a.startsWith('--'));

  if (FORCE) console.log('Modalità --force: sovrascrive immagini Pexels esistenti (migrazione da Wikimedia)\n');

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

  /* Conta le chiamate Pexels previste per stimare il tempo */
  let expectedPexelsCalls = 0;
  for (const { art } of toProcess) {
    if (art.carousel_slides) {
      for (let si = 1; si <= 4; si++) {
        const cs = art.carousel_slides[si];
        if (cs?.image_query && (FORCE || !cs.image)) expectedPexelsCalls++;
      }
    }
  }
  const estimatedMin = Math.ceil((expectedPexelsCalls * PEXELS_DELAY_MS) / 60000);
  console.log(`Articoli unici: ${uniqueEntries.length} | Da processare: ${toProcess.length}`);
  console.log(`Chiamate Pexels previste: ${expectedPexelsCalls} | Tempo stimato: ~${estimatedMin} min\n`);

  const stats = {
    csUpdated: 0, csPresent: 0, csFailed: 0,
    imgFound: 0, imgMissing: 0,
    pexelsFound: 0, pexelsMissing: 0,
  };

  for (const { full, art } of toProcess) {
    const label = art.title.slice(0, 60);
    let changed = false;

    /* a) carousel_slides — genera solo se mancanti */
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

    /* b) immagini Pexels per slide 2-5 */
    if (art.carousel_slides) {
      for (let si = 1; si <= 4; si++) {
        const cs = art.carousel_slides[si];
        if (!cs) continue;
        if (!cs.image_query) continue;
        if (!FORCE && cs.image) continue;   // salta se già presente (a meno di --force)

        process.stdout.write(`[pexels s${si + 1}] ${art.title.slice(0, 50)}... `);
        const pUrl = await fetchPexelsImage(cs.image_query);
        if (pUrl) {
          cs.image = pUrl;
          changed = true;
          stats.pexelsFound++;
          process.stdout.write('OK → ' + pUrl.slice(0, 70) + '\n');
        } else {
          stats.pexelsMissing++;
          process.stdout.write('not found\n');
        }
        // Rate limit: aspetta prima della prossima chiamata Pexels
        await sleep(PEXELS_DELAY_MS);
      }
    }

    /* c) article.image (og:image per slide 1) — solo se mancante */
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
    .sort()
    .reverse()
    .map(f => path.join(OUTPUT_DIR, f));
  const count = buildDataJs(allFullPaths);

  console.log(`\nfrontend/data.js aggiornato con ${count} articoli unici.`);
  console.log(`\ncarousel_slides — Aggiornati: ${stats.csUpdated} | Già presenti: ${stats.csPresent} | Falliti: ${stats.csFailed}`);
  console.log(`article.image  — Trovate: ${stats.imgFound} | Non trovate: ${stats.imgMissing}`);
  console.log(`pexels s2-5    — Trovate: ${stats.pexelsFound} | Non trovate: ${stats.pexelsMissing}`);
})();
