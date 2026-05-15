'use strict';

const fs   = require('fs');
const path = require('path');
const md5  = require('md5');
const { callDeepSeek } = require('../../deepseek');
const { normalize }    = require('../../filter');

const CACHE_PATH = path.join(__dirname, '../../cache/fitness.json');

const cache = fs.existsSync(CACHE_PATH)
  ? JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'))
  : {};

const CAROUSEL_LAYOUTS = ['hero', 'right-focus', 'sensor-zoom', 'human-hand', 'cta-final'];
const CAROUSEL_ICONS   = new Set(['tag', 'waves', 'heart', 'vibration', 'check']);

function saveCache() {
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

async function generateFitnessSlides(article) {
  const { title } = article;
  const hash     = md5(normalize(title));
  const cacheKey = `fitness:slides:${hash}`;

  if (cache[cacheKey]) {
    console.log(`[cache hit fitness:slides] ${title}`);
    return cache[cacheKey];
  }

  const prompt = `Sei un coach fitness italiano. Dato questo titolo di un articolo su allenamento o benessere, crea 5 slide motivazionali e pratiche.

Titolo: ${title}

Rispondi SOLO JSON valido, niente altro:
{ "slides": ["...", "...", "...", "...", "..."] }

Struttura delle 5 slide — segui l'ordine esatto:
1. HOOK — frase motivazionale d'impatto sul beneficio principale (max 8 parole)
2. CONTESTO — perché questo allenamento/esercizio vale il tuo tempo (max 8 parole)
3. TECNICA — il gesto chiave da eseguire correttamente (max 8 parole)
4. ERRORE — l'errore più comune da evitare (max 8 parole)
5. CTA — azione concreta da fare oggi (max 8 parole)

LIMITE ASSOLUTO: ogni slide deve avere AL MASSIMO 10 parole. Conta le parole prima di rispondere.
Tono: diretto, pratico, da coach. Niente testo fuori dal JSON.`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw  = await callDeepSeek(prompt);
      const json = raw.match(/\{[\s\S]*\}/)?.[0];
      const { slides } = JSON.parse(json);
      if (
        Array.isArray(slides) && slides.length === 5 &&
        slides.every(s => typeof s === 'string' && s.trim().split(/\s+/).length <= 10)
      ) {
        const result = { title, slides };
        cache[cacheKey] = result;
        saveCache();
        return result;
      }
    } catch (_) {}
  }

  console.warn(`generateFitnessSlides fallito dopo 2 tentativi: ${title}`);
  return null;
}

async function generateFitnessCarouselSlides(article) {
  const { title, slides } = article;
  const hash     = md5(normalize(title));
  const cacheKey = `fitness:carousel:${hash}`;

  if (cache[cacheKey]) {
    console.log(`[cache hit fitness:carousel] ${title}`);
    return cache[cacheKey];
  }

  const slidesText = (Array.isArray(slides) ? slides : [])
    .map((s, i) => `${i + 1}. ${s}`)
    .join('\n');

  const prompt = `Sei un coach fitness italiano e social media manager. Dato questo titolo e queste 5 slide su un allenamento, genera i metadati per un carousel Instagram fitness.

Titolo: ${title}
Slide:
${slidesText}

Rispondi SOLO JSON valido nel formato:
{
  "carousel_slides": [
    { "hook": "max 8 parole", "description": "beneficio pratico max 25 parole", "visual_hint": "max 6 parole", "layout_type": "hero",        "icon": "tag",       "image_query": "2-3 parole inglesi" },
    { "hook": "...",           "description": "...",                              "visual_hint": "...",          "layout_type": "right-focus", "icon": "waves",     "image_query": "..." },
    { "hook": "...",           "description": "...",                              "visual_hint": "...",          "layout_type": "sensor-zoom", "icon": "heart",     "image_query": "..." },
    { "hook": "...",           "description": "...",                              "visual_hint": "...",          "layout_type": "human-hand",  "icon": "vibration", "image_query": "..." },
    { "hook": "...",           "description": "...",                              "visual_hint": "...",          "layout_type": "cta-final",   "icon": "check",     "image_query": "..." }
  ]
}

Regole carousel_slides:
- Slide 1 (hero): hook = promessa principale dell'allenamento
- Slide 2 (right-focus): hook e description sul contesto/beneficio
- Slide 3 (sensor-zoom): tecnica chiave da eseguire
- Slide 4 (human-hand): errore comune e come correggerlo
- Slide 5 (cta-final): call to action pratica

Regole image_query:
- 2-3 parole inglesi che descrivono la scena fitness come fotografia
- Esempi: "gym workout man", "yoga pose woman", "running park morning", "home exercise mat", "strength training barbell"
- Deve descrivere persone che si allenano, attrezzatura o ambienti fitness reali

layout_type fisso in ordine: hero → right-focus → sensor-zoom → human-hand → cta-final
icon: scegli il più pertinente tra tag, waves, heart, vibration, check
Niente testo fuori dal JSON.`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw  = await callDeepSeek(prompt);
      const json = raw.match(/\{[\s\S]*\}/)?.[0];
      const { carousel_slides } = JSON.parse(json);
      if (
        Array.isArray(carousel_slides) && carousel_slides.length === 5 &&
        carousel_slides.every(s => s.hook && s.description && s.visual_hint && s.image_query && s.layout_type && s.icon) &&
        carousel_slides.every((s, i) => s.layout_type === CAROUSEL_LAYOUTS[i]) &&
        carousel_slides.every(s => CAROUSEL_ICONS.has(s.icon))
      ) {
        const result = { carousel_slides };
        cache[cacheKey] = result;
        saveCache();
        return result;
      }
    } catch (_) {}
  }

  console.warn(`generateFitnessCarouselSlides fallito dopo 2 tentativi: ${title}`);
  return null;
}

async function generateFitnessCaption(article) {
  const { title, slides } = article;
  const hash     = md5(normalize(title));
  const cacheKey = `fitness:caption:${hash}`;

  if (cache[cacheKey]) {
    console.log(`[cache hit fitness:caption] ${title}`);
    return cache[cacheKey];
  }

  const slidesText = (slides || []).map((s, i) => `${i + 1}. ${s}`).join('\n');

  const prompt = `Sei un fitness coach italiano su Instagram. Scrivi una caption pronta da pubblicare per questo contenuto fitness.

Titolo: ${title}
Punti chiave:
${slidesText}

Rispondi SOLO con la caption in italiano, nessun altro testo.

Regole:
- 4-6 righe di testo motivazionale e pratico
- Prima riga: frase d'impatto sul beneficio principale (non iniziare con "Oggi")
- Seconda/terza riga: spiega brevemente la tecnica o il contesto in modo accessibile
- Ultima riga: call to action concreto (es. "Prova questo esercizio domani mattina 💪")
- 3-5 emoji pertinenti, non esagerare
- Tono: da coach, motivazionale ma pratico
- Niente hashtag — li aggiungerà l'utente
- Max 120 parole totali`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw     = await callDeepSeek(prompt);
      const caption = raw.trim();
      if (caption && caption.length > 20) {
        cache[cacheKey] = caption;
        saveCache();
        return caption;
      }
    } catch (_) {}
  }

  console.warn(`generateFitnessCaption fallito dopo 2 tentativi: ${title}`);
  return null;
}

async function generateFitnessVideoScript(article) {
  const { title, slides } = article;
  const hash     = md5(normalize(title));
  const cacheKey = `fitness:video:${hash}`;

  if (cache[cacheKey]) {
    console.log(`[cache hit fitness:video] ${title}`);
    return cache[cacheKey];
  }

  const slidesText = (slides || []).map((s, i) => `${i + 1}. ${s}`).join('\n');

  const prompt = `Sei un fitness creator italiano su TikTok e Instagram Reels. Scrivi uno script video per questo contenuto fitness.

Titolo: ${title}
Punti chiave:
${slidesText}

Rispondi SOLO JSON valido, nessun altro testo:
{ "video_script": ["riga 1", "riga 2", "riga 3", "riga 4", "riga 5"] }

Regole:
- Esattamente 5 righe, una per punto chiave
- Linguaggio parlato, come se stessi allenando davanti alla telecamera
- Max 10 parole per riga
- Tono diretto e carico: "Parti così..." "Il segreto è..." "Evita questo errore..."
- Niente sigle o termini tecnici complessi
- Niente testo fuori dal JSON`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw    = await callDeepSeek(prompt);
      const json   = raw.match(/\{[\s\S]*\}/)?.[0];
      const { video_script } = JSON.parse(json);
      if (Array.isArray(video_script) && video_script.length === 5 && video_script.every(s => typeof s === 'string')) {
        cache[cacheKey] = video_script;
        saveCache();
        return video_script;
      }
    } catch (_) {}
  }

  console.warn(`generateFitnessVideoScript fallito dopo 2 tentativi: ${title}`);
  return null;
}

async function generateFitnessThread(article) {
  const { title, slides } = article;
  const hash     = md5(normalize(title));
  const cacheKey = `fitness:thread:${hash}`;

  if (cache[cacheKey]) {
    console.log(`[cache hit fitness:thread] ${title}`);
    return cache[cacheKey];
  }

  const slidesText = (slides || []).map((s, i) => `${i + 1}. ${s}`).join('\n');

  const prompt = `Sei un fitness coach italiano su X (Twitter). Scrivi un thread di 5 tweet su questo allenamento.

Titolo: ${title}
Punti chiave:
${slidesText}

Rispondi SOLO JSON valido, nessun altro testo:
{ "thread_text": ["tweet 1", "tweet 2", "tweet 3", "tweet 4", "tweet 5"] }

Regole:
- Esattamente 5 tweet
- Max 240 caratteri per tweet
- Tweet 1: aggancio forte sul beneficio principale — crea curiosità o motivazione, non iniziare con "Oggi"
- Tweet 2-4: spiega tecnica, contesto e errore da evitare con ritmo
- Tweet 5: call to action concreto (es. "Prova domani e dimmi com'è andata 👇")
- Ogni tweet funziona da solo, ma il thread ha progressione
- Tono: da coach, diretto e pratico
- Niente hashtag, max 1-2 emoji dove ci stanno
- Niente testo fuori dal JSON`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw    = await callDeepSeek(prompt);
      const json   = raw.match(/\{[\s\S]*\}/)?.[0];
      const { thread_text } = JSON.parse(json);
      if (Array.isArray(thread_text) && thread_text.length === 5 && thread_text.every(t => typeof t === 'string')) {
        cache[cacheKey] = thread_text;
        saveCache();
        return thread_text;
      }
    } catch (_) {}
  }

  console.warn(`generateFitnessThread fallito dopo 2 tentativi: ${title}`);
  return null;
}

module.exports = {
  generateFitnessSlides,
  generateFitnessCarouselSlides,
  generateFitnessCaption,
  generateFitnessVideoScript,
  generateFitnessThread,
};
