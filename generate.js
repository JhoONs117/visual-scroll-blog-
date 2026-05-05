const fs = require('fs');
const path = require('path');
const md5 = require('md5');
const { callDeepSeek } = require('./deepseek');
const { normalize } = require('./filter');

const CACHE_PATH = path.join(__dirname, 'cache.json');
const QUEUE_PATH = path.join(__dirname, 'review_queue.json');

const cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));

function checkReviewQueue() {
  const queue = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf8'));
  if (queue.length > 10) {
    console.warn(`Review queue ha ${queue.length} elementi — controllare`);
  }
}

async function generateSlides(title) {
  checkReviewQueue();

  const hash = md5(normalize(title));
  if (cache[hash]) {
    console.log(`[cache hit] ${title}`);
    return cache[hash];
  }

  const prompt = `Rispondi SOLO JSON valido.
Formato:
{
  "slides": [
    "hook breve e forte",
    "spiegazione semplice",
    "perche e utile",
    "azione pratica",
    "esempio reale"
  ]
}
Regole:
- max 8 parole per slide
- linguaggio semplice
- niente fluff
Titolo: ${title}`;

  const raw = await callDeepSeek(prompt);
  const json = raw.match(/\{[\s\S]*\}/)?.[0];
  const parsed = JSON.parse(json);
  const result = { title, slides: parsed.slides };

  cache[hash] = result;
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));

  return result;
}

module.exports = { generateSlides };

// Test
(async () => {
  const title = 'OpenAI releases GPT-5 with reasoning capabilities';

  console.log('-- Prima chiamata (genera e mette in cache) --');
  const r1 = await generateSlides(title);
  r1.slides.forEach((s, i) => console.log(`  Slide ${i + 1}: ${s}`));

  console.log('\n-- Seconda chiamata (deve usare la cache) --');
  const r2 = await generateSlides(title);
  r2.slides.forEach((s, i) => console.log(`  Slide ${i + 1}: ${s}`));
})();
