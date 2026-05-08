require('dotenv').config();

const fs   = require('fs');
const path = require('path');
const { generateCarouselSlides } = require('./generate');

const OUTPUT_DIR = path.join(__dirname, 'output');

function slug(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
}

/* Fetch image from Wikimedia Commons by keyword query */
async function fetchWikimediaImage(query) {
  try {
    const q = encodeURIComponent(query);
    const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${q}&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url&iiurlwidth=800&format=json`;
    const res = await fetch(apiUrl, {
      headers: { 'User-Agent': 'FlashAI-Bot/1.0 (michelangelol1999@gmail.com)' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const pages = Object.values(data.query?.pages || {})
      .sort((a, b) => (a.index || 0) - (b.index || 0));
    for (const page of pages) {
      const title = (page.title || '').toLowerCase();
      /* salta PDF, SVG, loghi e file non rilevanti */
      if (/\.(pdf|svg)$/i.test(title)) continue;
      if (/logo|icon|flag|coat_of_arms|emblem/i.test(title)) continue;
      /* almeno una parola della query deve essere nel titolo */
      if (!queryWords.some(w => title.includes(w))) continue;
      const imgUrl = page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url;
      if (imgUrl && imgUrl.startsWith('http')) return imgUrl;
    }
    return null;
  } catch {
    return null;
  }
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

  const stats = { csUpdated: 0, csPresent: 0, csFailed: 0, imgFound: 0, imgMissing: 0, wikiFound: 0, wikiMissing: 0 };

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

    /* b) immagini Wikimedia per slide 2-5 */
    if (art.carousel_slides) {
      for (let si = 1; si <= 4; si++) {
        const cs = art.carousel_slides[si];
        if (!cs) continue;
        if (!cs.image && cs.image_query) {
          process.stdout.write(`[wiki s${si + 1}]  ${art.title.slice(0, 50)}... `);
          const wUrl = await fetchWikimediaImage(cs.image_query);
          if (wUrl) {
            cs.image = wUrl;
            changed = true;
            stats.wikiFound++;
            process.stdout.write('OK → ' + wUrl.slice(0, 70) + '\n');
          } else {
            stats.wikiMissing++;
            process.stdout.write('not found\n');
          }
        }
      }
    }

    /* c) article.image (og:image per slide 1) */
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
  console.log(`article.image  — Trovate: ${stats.imgFound} | Non trovate: ${stats.imgMissing}`);
  console.log(`wikimedia s2-5 — Trovate: ${stats.wikiFound} | Non trovate: ${stats.wikiMissing}`);
})();
