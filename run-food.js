require('dotenv').config();

const fs = require('fs');
const path = require('path');
const md5 = require('md5');
const { fetchFoodArticles } = require('./fetch-food');
const { generateRecipeSlides, generateRecipeCarouselSlides, generateFoodCaption, generateFoodVideoScript, generateFoodThread } = require('./generate-food');
const { fetchPexelsImage, fetchArticleImage } = require('./fetch');

const FOOD_OUTPUT_DIR = path.join(__dirname, 'output', 'food');
const DATA_FOOD_PATH  = path.join(__dirname, 'frontend', 'data-food.js');

const MAX_NEW = Number(process.env.MAX_NEW_FOOD_ARTICLES || 1);

function buildDataFoodJs() {
  const seen = new Set();
  const articles = fs.readdirSync(FOOD_OUTPUT_DIR)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse()
    .map(f => {
      try { return JSON.parse(fs.readFileSync(path.join(FOOD_OUTPUT_DIR, f), 'utf8')); }
      catch { return null; }
    })
    .filter(a => {
      if (!a) return false;
      const key = (a.slug || '').toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0));

  fs.writeFileSync(DATA_FOOD_PATH, `window.FOOD_ARTICLES = ${JSON.stringify(articles, null, 2)};`);
  return articles.length;
}

(async () => {
  let newCount = 0;

  try {
    fs.mkdirSync(FOOD_OUTPUT_DIR, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fetched = await fetchFoodArticles();
    const toProcess = fetched.slice(0, MAX_NEW);

    console.log(`Food agent: ${fetched.length} articoli nuovi disponibili, processo i primi ${toProcess.length}.`);

    for (const article of toProcess) {
      try {
        const slidesResult = await generateRecipeSlides(article.title, article.content);
        if (!slidesResult) {
          console.log(`SKIP [${article.title}]: non è una ricetta`);
          continue;
        }

        const carouselResult = await generateRecipeCarouselSlides(article.title, slidesResult.slides);
        const { dish_type, signature_ingredients, carousel_slides } = carouselResult || {};

        if (!carousel_slides || carousel_slides.length !== 5) {
          console.log(`SKIP [${article.title}]: carousel incompleto`);
          continue;
        }

        // Slide 1: og:image dalla pagina, filtro URL generici, fallback Pexels
        let image = null;
        if (article.link) {
          const ogImage = await fetchArticleImage(article.link);
          if (ogImage && !/(logo|placeholder|default|avatar)/i.test(ogImage)) {
            image = ogImage;
          }
        }
        if (!image && carousel_slides[0]?.image_query) {
          image = await fetchPexelsImage(carousel_slides[0].image_query);
        }

        // Slide 2-5: immagini Pexels
        for (let i = 1; i <= 4; i++) {
          const cs = carousel_slides[i];
          if (cs?.image_query) {
            const img = await fetchPexelsImage(cs.image_query);
            if (img) cs.image = img;
          }
        }

        const caption     = await generateFoodCaption(article.title, slidesResult.slides, signature_ingredients);
        const videoScript = await generateFoodVideoScript(article.title, slidesResult.slides, signature_ingredients);
        const thread      = await generateFoodThread(article.title, slidesResult.slides, signature_ingredients);

        const articleObj = {
          agent: 'food',
          slug: article.slug,
          sourceId: md5(article.link),
          dish_type,
          signature_ingredients,
          title: article.title,
          slides: slidesResult.slides,
          carousel_slides,
          instagram_caption: caption || null,
          video_script: videoScript || null,
          thread_text: thread || null,
          link: article.link,
          pubDate: article.pubDate || null,
          savedAt: new Date().toISOString(),
          image,
        };

        const filename = `${timestamp}_${article.slug}.json`;
        fs.writeFileSync(path.join(FOOD_OUTPUT_DIR, filename), JSON.stringify(articleObj, null, 2));
        newCount++;
        console.log(`Salvato: ${article.title}`);

      } catch (err) {
        console.warn(`Errore articolo [${article.title}]:`, err.message);
      }
    }

  } catch (err) {
    console.warn('Errore strutturale food agent:', err.message);
  }

  const total = buildDataFoodJs();
  console.log(`\nFood agent completato. Nuovi articoli: ${newCount}. Totale: ${total}.`);
})();
