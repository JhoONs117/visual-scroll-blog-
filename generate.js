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
1. HOOK — domanda o affermazione che crea curiosità. Non informare: provocare. Se non fa venire voglia di leggere la slide 2, è sbagliata.
2. CONTESTO — una sola informazione nuova.
3. SORPRENDENTE — la cosa che il lettore non si aspetta.
4. PRATICO — cosa cambia concretamente per chi legge.
5. TAKEAWAY — frase finale netta: azione o riflessione.

Esempio DA NON FARE (hook generico + slide troppo lunghe):
{ "slides": ["OpenAI lancia nuovo modello GPT", "Il modello si chiama GPT-5 ed è più potente", "Ha nuove capacità di ragionamento avanzato", "Utile per tutti quelli che lavorano con AI", "Prova GPT-5 oggi stesso per i tuoi progetti"] }

Esempio DA FARE (hook che crea tensione, max 12 parole per slide):
{ "slides": ["GPT-5 può sostituire il tuo analista?", "Ragiona su problemi in più passaggi", "Sbaglia meno degli umani su benchmark legali", "Chi non lo usa perde terreno ora", "Testa un task reale: confronta i risultati"] }

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
- tweet 1 deve essere un hook forte che genera curiosità — non informativo, provocatorio
- tweet 2–4 sviluppano con progressione, NON ripetono le slide
- tweet 5 chiude con takeaway o implicazione concreta
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

module.exports = { generateSlides, generateFormats };

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
