const fs = require('fs');
const path = require('path');
const md5 = require('md5');
const { callDeepSeek } = require('./deepseek');
const { normalize } = require('./filter');

const cacheDir = path.join(__dirname, 'cache');
fs.mkdirSync(cacheDir, { recursive: true });
const CACHE_PATH = path.join(cacheDir, 'ai-news.json');
const QUEUE_PATH = path.join(__dirname, 'review_queue.json');

const cache = fs.existsSync(CACHE_PATH)
  ? JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'))
  : {};

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

  const prompt = `Reply with ONLY valid JSON, nothing else.
Format: { "slides": ["...", "...", "...", "...", "..."] }

CRITICAL: Write ALL slides in English, regardless of the title's language.

HARD LIMIT: each slide must have AT MOST 12 words. Count before answering. If 13 or more, cut.

Structure — follow this exact order:
1. HOOK — open with the company/protagonist name as anchor if useful, but always add tension or an open question. Never a bare fact. Must be a question or a statement with unresolved tension.
2. CONTEXT — one single new piece of information.
3. SURPRISING — the thing the reader does not expect.
4. PRACTICAL — what concretely changes for the reader.
5. TAKEAWAY — sharp closing line: a specific action or reflection.

CRITICAL RULE — unresolved tension:
Each slide must contain an unresolved tension or incomplete information that closes only in the next slide. The reader must not be able to stop after any slide.
Internal test: "does this slide leave an open question or make me want to read the next?" — if no, rewrite it.

ANTI-REPETITION: each slide covers one concept not already covered. Never two slides on the same idea.

BAD example (slides that close every piece of info, zero tension):
{ "slides": ["OpenAI launches GPT-5", "More powerful than GPT-4", "Reasons in multiple steps", "Costs less than previous models", "Available on ChatGPT today"] }

GOOD example (each slide leaves something open):
{ "slides": ["Can GPT-5 replace your analyst?", "It reasons through complex problems step by step", "But beats humans only on specific task types", "Teams not testing it now are falling behind", "One real task today: compare results yourself"] }

No fluff. No generic adjectives.

Title: ${title}`;

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

  const prompt = `You have these 5 slides about an AI news article:
${slidesText}

CRITICAL: Write ALL output in ENGLISH. The slides may be in Italian — ignore their language and write the thread and script entirely in English.

Generate two formats. Reply with ONLY valid JSON, no other text:

{
  "thread_text": [
    "1. Short title\\n\\nBody sentence or two.",
    "2. Short title\\n\\nBody sentence or two.",
    "3. Short title\\n\\nBody sentence or two.",
    "4. Short title\\n\\nBody sentence or two.",
    "5. Short title\\n\\nBody sentence or two."
  ],
  "video_script": [
    "line 1",
    "line 2",
    "line 3",
    "line 4",
    "line 5"
  ]
}

The video_script array MUST have exactly 5 strings. Each string max 10 words, spoken language.

THREAD RULES — read carefully:

FORMAT: each tweet = "N. Title\\n\\nBody"
- Title: 3–5 words max. Can be a question, a sharp statement, or an imperative. It must create curiosity or tension — NOT summarize the body. The title is the hook visible in the feed.
- Body: 1–3 short sentences. Must add NEW information that was not already in the title. Never paraphrase the title with different words.
- Total tweet length: max 240 characters (title + body combined).
- Language: English. Tone: direct, not journalistic.

TWEET 1 — hook:
Pick the angle with the most narrative tension across all 5 slides, regardless of position. Rebuild the thread arc around that angle.
The body of tweet 1 must open the story with one concrete fact or consequence — not a rephrasing of the title.

TWEETS 2–4 — escalation:
Each tweet must introduce ONE new angle not yet mentioned. Never dedicate two tweets to the same concept.
Arc: context → twist → consequence. Each tweet should make the reader need the next one.

TWEET 5 — close:
Must contain either: a specific action the reader can take today, OR a direct question that implicates the reader personally.
FORBIDDEN: generic analogies ("less than a cup of coffee"), vague calls to action ("start today"), editorial opinions ("this changes everything").
GOOD: "Take a prompt on ChatGPT and simulate [X]. If you haven't done it, start there." / "Does it make sense to save 20 minutes if you then have to edit twice? Test it on a real post this week."

ANTI-REPETITION CHECK before writing:
- Is any concept used in more than one tweet? If yes, cut or merge.
- Does tweet 1's body say the same thing as the title? If yes, rewrite the body.

No hashtags. No forced emojis.

VIDEO SCRIPT RULES:
- Spoken language, not written
- No unexplained acronyms`;

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

  const prompt = `Given this title and these 5 slides, generate 5 carousel_slides for Instagram.

CRITICAL: Write ALL text (hook, description, visual_hint) in English, regardless of the input language.

Title: ${title}
Slides:
${slidesText}
${threadSection}
Reply with ONLY valid JSON in this format:
{
  "carousel_slides": [
    { "hook": "max 8 parole", "description": "max 25 parole", "visual_hint": "max 6 parole", "layout_type": "hero",        "icon": "tag",       "image_query": "3-4 parole inglesi concrete" },
    { "hook": "...",           "description": "...",          "visual_hint": "...",          "layout_type": "right-focus", "icon": "waves",     "image_query": "..." },
    { "hook": "...",           "description": "...",          "visual_hint": "...",          "layout_type": "sensor-zoom", "icon": "heart",     "image_query": "..." },
    { "hook": "...",           "description": "...",          "visual_hint": "...",          "layout_type": "human-hand",  "icon": "vibration", "image_query": "..." },
    { "hook": "...",           "description": "...",          "visual_hint": "...",          "layout_type": "cta-final",   "icon": "tag",       "image_query": "..." }
  ]
}

Text rules:
- hook: max 8 words. Must be a question OR a sharp statement that creates scroll-stopping tension. Never a newspaper headline. Slide 1 hook = the strongest tension angle from all 5 slides (can come from slide 3 or 5).
- description: max 25 words. One specific fact + its consequence. Derive from the slides content; do NOT copy the thread verbatim and do NOT invent facts not in the slides.
- visual_hint: max 6 words — concrete visual element consistent with the slide layout.
- image_query: 2-3 parole inglesi semplici, soggetti che esistono come fotografie su Wikipedia. PREFERISCI oggetti, luoghi, tecnologia, infrastrutture (es. "server room", "wind turbine", "power plant", "stock market chart", "factory robot", "solar panels"). Usa persone SOLO se sono figure molto note (es. "Elon Musk", "Bill Gates") oppure scene generiche senza individui riconoscibili (es. "people walking street", "crowd market", "office workers"). EVITA ritratti di individui specifici non famosi, interviste, relatori sconosciuti.
- slide 5 (cta-final): hook must push to save, comment, or visit link in bio. Description = one specific action the reader can take now.
- each slide hook covers a different concept — no two hooks on the same idea.

layout_type rules — always assign in this fixed order:
- slide 1: always "hero"
- slide 2: always "right-focus"
- slide 3: always "sensor-zoom"
- slide 4: always "human-hand"
- slide 5: always "cta-final"

icon rules — choose the most relevant among: tag, waves, heart, vibration, check

No text outside the JSON.`;

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

async function generateAINewsCaption(title, slides, thread_text) {
  const hash = md5(normalize(title));
  const cacheKey = `ainews:caption:${hash}`;

  if (cache[cacheKey]) {
    console.log(`[cache hit ainews:caption] ${title}`);
    return cache[cacheKey];
  }

  const slidesText = slides.map((s, i) => `${i + 1}. ${s}`).join('\n');
  const threadSection = Array.isArray(thread_text) && thread_text.length
    ? `\nThread X già scritto (usalo come riferimento per i fatti, non copiare):\n${thread_text.map((t, i) => `T${i + 1}: ${t}`).join('\n')}`
    : '';

  const prompt = `Scrivi una caption Instagram per questa notizia AI.

Titolo originale (EN): ${title}
Slide:
${slidesText}${threadSection}

CRITICAL RULE: respect the meaning of the original title. If the title says someone "denies" or "won't admit", do not write that they "admitted". Never invert the facts.

CRITICAL: Write the caption in English, regardless of the input language.

Reply with ONLY the caption, no other text.

Structure — separate each block with a blank line:

[First line]
One specific concrete fact from the news — written like you'd say it out loud to someone. Do NOT start with "Today", "AI", the company name, or the title. Start from the fact that directly affects the reader.

[Body — 2-3 lines, each separated by a blank line]
Explain what happened and why it matters. Simple language. One piece of information per line. No unexplained acronyms.

[Consequence line]
What concretely changes for someone who creates or publishes content (work, tools, daily life).

[Closing]
An open question that directly implicates the reader OR a specific action with a concrete step. NEVER a generic opinion.

FORBIDDEN: "The future is here" / "AI is changing everything" / "We're just getting started" / "incredible" / "extraordinary" / phrases that could apply to any news story.
DO: specific facts, direct consequences, questions that concern the reader personally.

3-5 emoji in the text (not all at the end, not all in a row).
No hashtags.
Max 120 words total.`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await callDeepSeek(prompt);
      const caption = raw.trim();
      if (caption && caption.length > 20) {
        cache[cacheKey] = caption;
        fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
        return caption;
      }
    } catch (_) {}
  }

  console.warn(`generateAINewsCaption fallito dopo 2 tentativi: ${title}`);
  return null;
}

module.exports = { generateSlides, generateFormats, generateCarouselSlides, generateAINewsCaption };

if (require.main === module) {
  (async () => {
    const title = 'OpenAI releases GPT-5 with reasoning capabilities';

    console.log('-- Prima chiamata (genera e mette in cache) --');
    const r1 = await generateSlides(title);
    r1.slides.forEach((s, i) => console.log(`  Slide ${i + 1}: ${s}`));

    console.log('\n-- Seconda chiamata (deve usare la cache) --');
    const r2 = await generateSlides(title);
    r2.slides.forEach((s, i) => console.log(`  Slide ${i + 1}: ${s}`));
  })();
}
