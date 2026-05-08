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

  const prompt = `Rispondi SOLO JSON valido, niente altro.
Formato: { "slides": ["...", "...", "...", "...", "..."] }

LIMITE ASSOLUTO: ogni slide deve avere AL MASSIMO 12 parole. Conta le parole prima di rispondere. Se ne hai 13 o più, taglia.

Struttura delle 5 slide — segui l'ordine esatto:
1. HOOK — puoi aprire con il nome dell'azienda o protagonista come ancoraggio, ma la slide deve sempre aggiungere tensione o una domanda aperta, non solo il fatto nudo. Se esiste un hook più forte tra le 5 posizioni, usalo al posto di questo e riordina la struttura di conseguenza.
2. CONTESTO — una sola informazione nuova.
3. SORPRENDENTE — la cosa che il lettore non si aspetta.
4. PRATICO — cosa cambia concretamente per chi legge.
5. TAKEAWAY — frase finale netta: azione o riflessione.

REGOLA CRITICA — tensione irrisolta:
Ogni slide deve contenere una tensione non risolta o un'informazione incompleta che si chiude solo nella slide successiva. Il lettore non deve poter smettere di leggere dopo ogni slide.
Test interno: "questa slide mi lascia una domanda aperta o vuole che legga la prossima?" — se la risposta è no, è sbagliata.

Esempio DA NON FARE (slide che chiudono ogni informazione, zero tensione):
{ "slides": ["OpenAI lancia GPT-5", "È più potente di GPT-4", "Ragiona in più passaggi", "Costa meno dei modelli precedenti", "Disponibile su ChatGPT da oggi"] }

Esempio DA FARE (ogni slide lascia qualcosa in sospeso):
{ "slides": ["GPT-5 può sostituire il tuo analista?", "Ragiona su problemi complessi in più passaggi", "Ma sbaglia meno degli umani solo su certi task", "Chi non lo testa ora rischia di perdere terreno", "Un task reale oggi: confronta i risultati tu stesso"] }

Niente fluff, niente aggettivi generici.

Titolo: ${title}`;

  const raw = await callDeepSeek(prompt);
  const json = raw.match(/\{[\s\S]*\}/)?.[0];
  const parsed = JSON.parse(json);
  const result = { title, slides: parsed.slides };

  cache[hash] = result;
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));

  return result;
}

async function generateFormats(title, slides) {
  const slidesText = slides.map((s, i) => `${i + 1}. ${s}`).join('\n');

  const prompt = `Hai queste 5 slide su un articolo AI:
${slidesText}

Genera due formati. Rispondi SOLO JSON valido:

{
  "thread_text": [
    "tweet 1 — max 240 caratteri, tono diretto, funziona da solo senza contesto",
    "tweet 2",
    "tweet 3",
    "tweet 4",
    "tweet 5"
  ],
  "video_script": [
    "riga 1 — max 10 parole, come se stessi parlando a voce a un amico",
    "riga 2",
    "riga 3",
    "riga 4",
    "riga 5"
  ]
}

Regole thread:
- TWEET 1: scegli la slide con più tensione narrativa tra le 5 — indipendentemente dalla sua posizione. Può essere la slide 3 o la 5. Usala come apertura. L'arco del thread si ricostruisce intorno a quella slide, non all'ordine originale.
- tweet 2–4 sviluppano con progressione di beat narrativi (contesto → svolta → conseguenza), NON ripetono le slide
- TWEET 5: chiudi con un fatto netto, una conseguenza concreta o una domanda aperta. MAI con una valutazione editoriale generica.
  DA NON FARE: "L'AI non è più solo un sogno" / "Ed è appena diventato realtà" / "Il futuro è già qui"
  DA FARE: "Costa meno di un abbonamento Spotify. Testalo questa settimana." / "Se non l'hai già fatto, inizia da questo task: [X]"
- ogni tweet deve essere comprensibile da solo, ma il thread deve avere ritmo e progressione
- niente hashtag, niente emoji forzate
- tono: diretto, non giornalistico

Regole script:
- linguaggio parlato, non scritto
- niente sigle tecniche senza spiegazione`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await callDeepSeek(prompt);
      const json = raw.match(/\{[\s\S]*\}/)?.[0];
      const parsed = JSON.parse(json);
      if (
        Array.isArray(parsed.thread_text) && parsed.thread_text.length > 0 &&
        Array.isArray(parsed.video_script) && parsed.video_script.length > 0
      ) {
        return { thread_text: parsed.thread_text, video_script: parsed.video_script };
      }
    } catch (_) {}
  }

  console.warn('generateFormats fallito:', title);
  return null;
}

const CAROUSEL_LAYOUTS = ['hero', 'right-focus', 'sensor-zoom', 'human-hand', 'cta-final'];
const CAROUSEL_ICONS   = new Set(['tag', 'waves', 'heart', 'vibration', 'check']);

async function generateCarouselSlides(title, slides, thread_text) {
  const slidesText = slides.map((s, i) => `${i + 1}. ${s}`).join('\n');
  const threadSection = (Array.isArray(thread_text) && thread_text.length)
    ? `\nThread X già scritto (usa il contenuto di questi tweet come base per le description — non copiare verbatim, condensa a max 25 parole per slide):\n${thread_text.map((t, i) => `T${i + 1}: ${t}`).join('\n')}\n`
    : '';

  const prompt = `Dato questo titolo e queste 5 slide, genera 5 carousel_slides per Instagram.

Titolo: ${title}
Slide:
${slidesText}
${threadSection}
Rispondi SOLO JSON valido nel formato:
{
  "carousel_slides": [
    { "hook": "max 8 parole", "description": "max 25 parole", "visual_hint": "max 6 parole", "layout_type": "hero",        "icon": "tag",       "image_query": "3-4 parole inglesi concrete" },
    { "hook": "...",           "description": "...",          "visual_hint": "...",          "layout_type": "right-focus", "icon": "waves",     "image_query": "..." },
    { "hook": "...",           "description": "...",          "visual_hint": "...",          "layout_type": "sensor-zoom", "icon": "heart",     "image_query": "..." },
    { "hook": "...",           "description": "...",          "visual_hint": "...",          "layout_type": "human-hand",  "icon": "vibration", "image_query": "..." },
    { "hook": "...",           "description": "...",          "visual_hint": "...",          "layout_type": "cta-final",   "icon": "tag",       "image_query": "..." }
  ]
}

Regole testo:
- hook: max 8 parole, tensione irrisolta, non titolo di giornale
- description: max 25 parole — se hai il thread X, condensa il tweet più pertinente per quella slide; non inventare info non presenti nelle slide o nei tweet
- visual_hint: max 6 parole — elemento visivo concreto coerente con il layout della slide
- image_query: 2-3 parole inglesi semplici, soggetti che esistono come fotografie su Wikipedia. PREFERISCI oggetti, luoghi, tecnologia, infrastrutture (es. "server room", "wind turbine", "power plant", "stock market chart", "factory robot", "solar panels"). Usa persone SOLO se sono figure molto note (es. "Elon Musk", "Bill Gates") oppure scene generiche senza individui riconoscibili (es. "people walking street", "crowd market", "office workers"). EVITA ritratti di individui specifici non famosi, interviste, relatori sconosciuti.
- slide 1 deve avere l'hook con più tensione (può venire dalla slide 3 o 5 originale)

Regole layout_type — assegna sempre in questo ordine fisso:
- slide 1: layout_type sempre "hero"
- slide 2: layout_type sempre "right-focus"
- slide 3: layout_type sempre "sensor-zoom"
- slide 4: layout_type sempre "human-hand"
- slide 5: layout_type sempre "cta-final"

Regole icon — scegli il più pertinente al contenuto della slide tra:
tag, waves, heart, vibration, check

Nessun testo fuori dal JSON.`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await callDeepSeek(prompt);
      const json = raw.match(/\{[\s\S]*\}/)?.[0];
      const parsed = JSON.parse(json);
      const cs = parsed.carousel_slides;
      if (
        Array.isArray(cs) && cs.length === 5 &&
        cs.every(s => s.hook && s.description && s.visual_hint && s.layout_type && s.icon && s.image_query) &&
        cs.every((s, i) => s.layout_type === CAROUSEL_LAYOUTS[i]) &&
        cs.every(s => CAROUSEL_ICONS.has(s.icon))
      ) {
        return { carousel_slides: cs };
      }
    } catch (_) {}
  }

  console.warn('generateCarouselSlides fallito:', title);
  return null;
}

module.exports = { generateSlides, generateFormats, generateCarouselSlides };

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
