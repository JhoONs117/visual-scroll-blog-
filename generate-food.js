const fs = require('fs');
const path = require('path');
const md5 = require('md5');
const { callDeepSeek } = require('./deepseek');
const { normalize } = require('./filter');

const cacheDir = path.join(__dirname, 'cache');
fs.mkdirSync(cacheDir, { recursive: true });
const CACHE_PATH = path.join(cacheDir, 'food.json');

const cache = fs.existsSync(CACHE_PATH)
  ? JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'))
  : {};

const VALID_DISH_TYPES = ['pasta', 'meat', 'fish', 'soup', 'dessert', 'salad', 'vegetable', 'generic'];
const CAROUSEL_LAYOUTS = ['hero', 'right-focus', 'sensor-zoom', 'human-hand', 'cta-final'];
const CAROUSEL_ICONS   = new Set(['tag', 'waves', 'heart', 'vibration', 'check']);

function looksLikeRecipe(content = '') {
  const t = content.toLowerCase();
  const hasIngredients =
    /ingredienti|dosi per|per \d+ persone|persone|grammi|\d+\s?g\b|\d+\s?ml|cucchiai|qb|q\.b\.|farina|zucchero|olio|sale|burro|uova/i.test(t);
  const hasProcedure =
    /preparazione|procedimento|preparate|cuocete|cuoci|tagliate|mescolate|versate|aggiungete|unite|infornate|servite/i.test(t);
  return content.length >= 800 && hasIngredients && hasProcedure;
}

function saveCache() {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

async function generateRecipeSlides(title, content) {
  if (!looksLikeRecipe(content)) {
    console.log(`SKIP [${title}]: non sembra una ricetta (length: ${content.length})`);
    return null;
  }

  const hash = md5(normalize(title));
  const cacheKey = `food:slides:${hash}`;

  if (cache[cacheKey]) {
    console.log(`[cache hit food:slides] ${title}`);
    return cache[cacheKey];
  }

  const prompt = `Sei un esperto di cucina italiana. Hai ricevuto il testo estratto da una pagina web di una ricetta reale.
Estrai e riformatta la ricetta in 5 slide. NON inventare ingredienti, dosi o passaggi non presenti nel testo.

Testo ricetta:
${content.slice(0, 8000)}

Rispondi SOLO JSON valido, niente altro:
{ "slides": ["...", "...", "...", "...", "..."] }

Struttura delle 5 slide — segui l'ordine esatto:
1. PIATTO — promessa visiva del risultato finale. Es: "Una pasta cremosa senza panna" (max 8 parole)
2. INGREDIENTI — se gli ingredienti sono molti, scegli solo i 4-5 essenziali. Es: "Limone, burro, parmigiano e acqua di cottura" (max 8 parole totali)
3. PREPARAZIONE — il gesto chiave della preparazione. Es: "Cuoci la pasta molto al dente" (max 8 parole)
4. COTTURA — assemblaggio o cottura finale. Es: "Manteca a fuoco spento con acqua di cottura" (max 8 parole)
5. TRUCCO — trucco finale o impiattamento. Es: "Scorza di limone e pepe nero: non omettere" (max 8 parole)

LIMITE ASSOLUTO: ogni slide deve avere AL MASSIMO 10 parole. Conta le parole prima di rispondere.
NON usare termini tecnici informatici. Parla solo di cucina.
Niente testo fuori dal JSON.`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await callDeepSeek(prompt);
      const json = raw.match(/\{[\s\S]*\}/)?.[0];
      const parsed = JSON.parse(json);
      const slides = parsed.slides;
      if (
        Array.isArray(slides) &&
        slides.length === 5 &&
        slides.every(s => typeof s === 'string' && s.trim().split(/\s+/).length <= 10)
      ) {
        const result = { title, slides };
        cache[cacheKey] = result;
        saveCache();
        return result;
      }
    } catch (_) {}
  }

  console.warn(`generateRecipeSlides fallito dopo 2 tentativi: ${title}`);
  return null;
}

async function generateRecipeCarouselSlides(title, slides) {
  const hash = md5(normalize(title));
  const cacheKey = `food:carousel:${hash}`;

  if (cache[cacheKey]) {
    console.log(`[cache hit food:carousel] ${title}`);
    return cache[cacheKey];
  }

  const slidesText = (Array.isArray(slides) ? slides : slides.slides)
    .map((s, i) => `${i + 1}. ${s}`)
    .join('\n');

  const prompt = `Sei un esperto di cucina italiana e social media. Dato questo titolo e queste 5 slide di una ricetta, genera i metadati per un carousel Instagram food.

Titolo: ${title}
Slide:
${slidesText}

Rispondi SOLO JSON valido nel formato:
{
  "dish_type": "pasta",
  "signature_ingredients": ["ingrediente1", "ingrediente2", "ingrediente3"],
  "carousel_slides": [
    { "hook": "max 8 parole", "description": "micro-promessa del piatto max 25 parole", "visual_hint": "max 6 parole", "layout_type": "hero",        "icon": "tag",       "image_query": "2-3 parole inglesi" },
    { "hook": "...",           "description": "...",                                     "visual_hint": "...",          "layout_type": "right-focus", "icon": "waves",     "image_query": "..." },
    { "hook": "...",           "description": "...",                                     "visual_hint": "...",          "layout_type": "sensor-zoom", "icon": "heart",     "image_query": "..." },
    { "hook": "...",           "description": "...",                                     "visual_hint": "...",          "layout_type": "human-hand",  "icon": "vibration", "image_query": "..." },
    { "hook": "...",           "description": "...",                                     "visual_hint": "...",          "layout_type": "cta-final",   "icon": "check",     "image_query": "..." }
  ]
}

Regole dish_type — scegli UNO tra: pasta, meat, fish, soup, dessert, salad, vegetable, generic
NON forzare "pasta" se il piatto non è pasta.

Regole signature_ingredients:
- Array di MASSIMO 3 ingredienti realmente presenti nella ricetta
- Solo ingredienti reali, nessuna invenzione

Regole carousel_slides:
- Slide 1 (hero): hook = titolo grande + promessa visiva. description = micro-promessa DEL PIATTO (NON la lista degli ingredienti firma — quelli stanno in signature_ingredients)
- Slide 2 (right-focus): hook e description sugli ingredienti essenziali
- Slide 3 (sensor-zoom): gesto chiave della preparazione
- Slide 4 (human-hand): cottura o assemblaggio
- Slide 5 (cta-final): trucco finale, impiattamento, servizio

Regole image_query:
- 2-3 parole inglesi che descrivono il piatto reale come fotografia
- Esempi: "lemon pasta", "lemon veal scallopini", "roasted chicken herbs", "pumpkin soup bowl", "chocolate cake slice", "greek salad bowl"
- Deve corrispondere al piatto reale, non al template
- REGOLA CRITICA: se dish_type NON è "dessert", aggiungi SEMPRE il qualificatore "savory"
  per evitare che Pexels restituisca dolci. Esempi:
  torta salata vegana → "savory vegetable tart"
  quiche lorraine     → "savory quiche slice"
  pizza rustica       → "savory rustic pie"

layout_type fisso in ordine: hero → right-focus → sensor-zoom → human-hand → cta-final
icon: scegli il più pertinente tra tag, waves, heart, vibration, check

Niente testo fuori dal JSON.`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await callDeepSeek(prompt);
      const json = raw.match(/\{[\s\S]*\}/)?.[0];
      const parsed = JSON.parse(json);

      const { dish_type, signature_ingredients, carousel_slides } = parsed;

      if (
        VALID_DISH_TYPES.includes(dish_type) &&
        Array.isArray(signature_ingredients) && signature_ingredients.length <= 3 &&
        Array.isArray(carousel_slides) && carousel_slides.length === 5 &&
        carousel_slides.every(s => s.hook && s.description && s.visual_hint && s.image_query && s.layout_type && s.icon) &&
        carousel_slides.every((s, i) => s.layout_type === CAROUSEL_LAYOUTS[i]) &&
        carousel_slides.every(s => CAROUSEL_ICONS.has(s.icon))
      ) {
        const result = { dish_type, signature_ingredients, carousel_slides };
        cache[cacheKey] = result;
        saveCache();
        return result;
      }
    } catch (_) {}
  }

  console.warn(`generateRecipeCarouselSlides fallito dopo 2 tentativi: ${title}`);
  return null;
}

async function generateFoodCaption(title, slides, signatureIngredients) {
  const hash = md5(normalize(title));
  const cacheKey = `food:caption:${hash}`;

  if (cache[cacheKey]) {
    console.log(`[cache hit food:caption] ${title}`);
    return cache[cacheKey];
  }

  const slidesText = slides.map((s, i) => `${i + 1}. ${s}`).join('\n');
  const ingText = Array.isArray(signatureIngredients) && signatureIngredients.length
    ? signatureIngredients.join(', ')
    : '';

  const prompt = `Sei un food creator italiano su Instagram. Scrivi una caption pronta da pubblicare per questo piatto.

Titolo: ${title}
${ingText ? `Ingredienti firma: ${ingText}` : ''}
Passaggi ricetta:
${slidesText}

Rispondi SOLO con la caption in italiano, nessun altro testo.

Regole:
- 4-6 righe di testo narrativo, naturale, come parlerebbe un food blogger
- Prima riga: frase d'impatto sul piatto (non iniziare con "Oggi")
- Seconda/terza riga: racconta brevemente la ricetta in modo appetitoso
- Ultima riga: call to action breve (es. "Provala questo weekend 🌿")
- 3-5 emoji pertinenti, non esagerare
- Niente hashtag — li aggiungerà l'utente
- Max 120 parole totali`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await callDeepSeek(prompt);
      const caption = raw.trim();
      if (caption && caption.length > 20) {
        cache[cacheKey] = caption;
        saveCache();
        return caption;
      }
    } catch (_) {}
  }

  console.warn(`generateFoodCaption fallito dopo 2 tentativi: ${title}`);
  return null;
}

async function generateFoodVideoScript(title, slides, signatureIngredients) {
  const hash = md5(normalize(title));
  const cacheKey = `food:video:${hash}`;

  if (cache[cacheKey]) {
    console.log(`[cache hit food:video] ${title}`);
    return cache[cacheKey];
  }

  const slidesText = slides.map((s, i) => `${i + 1}. ${s}`).join('\n');
  const ingText = Array.isArray(signatureIngredients) && signatureIngredients.length
    ? signatureIngredients.join(', ')
    : '';

  const prompt = `Sei un food creator italiano su TikTok e Instagram Reels. Scrivi uno script video per questa ricetta.

Titolo: ${title}
${ingText ? `Ingredienti firma: ${ingText}` : ''}
Passaggi ricetta:
${slidesText}

Rispondi SOLO JSON valido, nessun altro testo:
{ "video_script": ["riga 1", "riga 2", "riga 3", "riga 4", "riga 5"] }

Regole:
- Esattamente 5 righe, una per passaggio della ricetta
- Linguaggio parlato, come se stessi cucinando davanti alla telecamera
- Max 10 parole per riga
- Tono diretto e vivace: "Prendo gli asparagi..." "Li taglio così..." "Verso tutto in teglia..."
- Niente sigle o termini tecnici
- Niente testo fuori dal JSON`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await callDeepSeek(prompt);
      const json = raw.match(/\{[\s\S]*\}/)?.[0];
      const parsed = JSON.parse(json);
      const script = parsed.video_script;
      if (Array.isArray(script) && script.length === 5 && script.every(s => typeof s === 'string')) {
        cache[cacheKey] = script;
        saveCache();
        return script;
      }
    } catch (_) {}
  }

  console.warn(`generateFoodVideoScript fallito dopo 2 tentativi: ${title}`);
  return null;
}

async function generateFoodThread(title, slides, signatureIngredients) {
  const hash = md5(normalize(title));
  const cacheKey = `food:thread:${hash}`;

  if (cache[cacheKey]) {
    console.log(`[cache hit food:thread] ${title}`);
    return cache[cacheKey];
  }

  const slidesText = slides.map((s, i) => `${i + 1}. ${s}`).join('\n');
  const ingText = Array.isArray(signatureIngredients) && signatureIngredients.length
    ? signatureIngredients.join(', ')
    : '';

  const prompt = `Sei un food creator italiano su X (Twitter). Scrivi un thread di 5 tweet su questa ricetta.

Titolo: ${title}
${ingText ? `Ingredienti firma: ${ingText}` : ''}
Passaggi ricetta:
${slidesText}

Rispondi SOLO JSON valido, nessun altro testo:
{ "thread_text": ["tweet 1", "tweet 2", "tweet 3", "tweet 4", "tweet 5"] }

Regole:
- Esattamente 5 tweet
- Max 240 caratteri per tweet
- Tweet 1: aggancio forte sul piatto — crea curiosità o fame, non iniziare con "Oggi"
- Tweet 2-4: racconta la ricetta con ritmo — ingredienti, gesto chiave, cottura
- Tweet 5: trucco finale o call to action concreto (es. "Provala e dimmi com'è andata 👇")
- Ogni tweet deve funzionare da solo, ma il thread deve avere progressione
- Tono: diretto, appetitoso, non giornalistico
- Niente hashtag, niente emoji forzate (1-2 max dove davvero ci stanno)
- Niente testo fuori dal JSON`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await callDeepSeek(prompt);
      const json = raw.match(/\{[\s\S]*\}/)?.[0];
      const parsed = JSON.parse(json);
      const thread = parsed.thread_text;
      if (Array.isArray(thread) && thread.length === 5 && thread.every(t => typeof t === 'string')) {
        cache[cacheKey] = thread;
        saveCache();
        return thread;
      }
    } catch (_) {}
  }

  console.warn(`generateFoodThread fallito dopo 2 tentativi: ${title}`);
  return null;
}

module.exports = { generateRecipeSlides, generateRecipeCarouselSlides, generateFoodCaption, generateFoodVideoScript, generateFoodThread, looksLikeRecipe };
