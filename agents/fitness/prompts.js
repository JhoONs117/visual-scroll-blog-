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

  const prompt = `You are a fitness coach. Given this workout or wellness article title, create 5 motivational and practical slides.

CRITICAL: Write ALL slides in English, regardless of the title's language.

Title: ${title}

Reply with ONLY valid JSON, nothing else:
{ "slides": ["...", "...", "...", "...", "..."] }

Structure — follow this exact order:
1. HOOK — high-impact statement on the main benefit. Must be a question or sharp statement, never a bare fact (max 8 words)
2. CONTEXT — one reason why this exercise/approach is worth your time (max 8 words)
3. TECHNIQUE — the key movement or method to execute correctly (max 8 words)
4. MISTAKE — the most common error and why it matters (max 8 words)
5. CTA — one specific action to do today or tomorrow (max 8 words)

HARD LIMIT: each slide max 10 words. Count before answering.
ANTI-REPETITION: each slide covers one concept not already covered.
Tone: direct, practical, coach voice. No text outside the JSON.`;

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

  const prompt = `You are a fitness coach and social media manager. Given this title and 5 slides about a workout, generate metadata for an Instagram fitness carousel.

CRITICAL: Write ALL text (hook, description, visual_hint) in English, regardless of the input language.

Title: ${title}
Slides:
${slidesText}

Reply with ONLY valid JSON in this format:
{
  "carousel_slides": [
    { "hook": "max 8 words", "description": "practical benefit max 25 words", "visual_hint": "max 6 words", "layout_type": "hero",        "icon": "tag",       "image_query": "2-3 English words" },
    { "hook": "...",          "description": "...",                             "visual_hint": "...",         "layout_type": "right-focus", "icon": "waves",     "image_query": "..." },
    { "hook": "...",          "description": "...",                             "visual_hint": "...",         "layout_type": "sensor-zoom", "icon": "heart",     "image_query": "..." },
    { "hook": "...",          "description": "...",                             "visual_hint": "...",         "layout_type": "human-hand",  "icon": "vibration", "image_query": "..." },
    { "hook": "...",          "description": "...",                             "visual_hint": "...",         "layout_type": "cta-final",   "icon": "check",     "image_query": "..." }
  ]
}

Carousel rules:
- Slide 1 (hero): hook = the strongest benefit or most surprising claim — scroll-stopping question or sharp statement
- Slide 2 (right-focus): hook and description on context/benefit
- Slide 3 (sensor-zoom): key technique to execute correctly
- Slide 4 (human-hand): most common mistake and how to fix it
- Slide 5 (cta-final): specific action the reader can do today. Hook must push to save or comment.

image_query rules:
- 2-3 English words describing the fitness scene as a photograph
- Examples: "gym workout man", "yoga pose woman", "running park morning", "home exercise mat", "strength training barbell"
- Must depict people training, equipment, or real fitness environments

layout_type fixed in order: hero → right-focus → sensor-zoom → human-hand → cta-final
icon: choose most relevant among tag, waves, heart, vibration, check
No text outside the JSON.`;

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

  const prompt = `You are a fitness coach on Instagram. Write a ready-to-publish caption for this fitness content.

CRITICAL: Write the caption in English, regardless of the input language.

Title: ${title}
Key points:
${slidesText}

Reply with ONLY the caption, no other text.

Structure — separate each block with a blank line:

[First line]
One sharp statement on the main benefit or the most common mistake — written like you'd say it to someone at the gym. Do NOT start with "Today" or the exercise name alone.

[Body — 2-3 lines, each separated by a blank line]
Explain the technique or context simply. One piece of information per line.

[Closing]
A specific action the reader can do today or tomorrow — with enough detail to actually do it. OR a direct question that implicates them personally.

FORBIDDEN: "Change your life", "You won't regret it", "Start today", generic motivational phrases that fit any post.
DO: specific reps/sets/timing if relevant, concrete consequences, direct questions.

3-5 relevant emoji in the text (not all at the end).
No hashtags.
Max 120 words total.`;

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

  const prompt = `You are a fitness creator on TikTok and Instagram Reels. Write a video script for this fitness content.

CRITICAL: Write the script in English, regardless of the input language.

Title: ${title}
Key points:
${slidesText}

Reply with ONLY valid JSON, no other text:
{ "video_script": ["line 1", "line 2", "line 3", "line 4", "line 5"] }

Rules:
- Exactly 5 lines, one per key point
- Spoken language, as if coaching in front of a camera
- Max 10 words per line
- Direct and energetic tone: "Start like this..." "The secret is..." "Avoid this mistake..."
- No unexplained acronyms or complex technical terms
- No text outside the JSON`;

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

  const prompt = `You are an Italian fitness coach on X (Twitter). Write a 5-tweet thread about this workout or fitness topic.

Title: ${title}
Key points:
${slidesText}

Reply with ONLY valid JSON, no other text:
{ "thread_text": ["tweet 1", "tweet 2", "tweet 3", "tweet 4", "tweet 5"] }

FORMAT: each tweet = "N. Title\\n\\nBody"
- Title: 3–5 words max. Sharp statement, question, or imperative. Creates tension or curiosity — does NOT summarize the body.
- Body: 1–3 short sentences. Adds NEW information not already in the title. Never paraphrases the title.
- Total tweet length: max 240 characters (title + body combined).
- Language: English. Tone: direct coach, not a journalist.

TWEET 1 — hook:
Lead with the most surprising benefit or the most common mistake — whichever creates more tension.
Body must open the story with one concrete fact or consequence, not a rephrasing of the title.

TWEETS 2–4 — escalation:
Each tweet = ONE new angle (technique / context / mistake / fix). Never dedicate two tweets to the same concept.
Arc: promise → method → obstacle → solution.

TWEET 5 — close:
Must give a specific action the reader can do today or tomorrow — with enough detail to actually do it.
FORBIDDEN: "Start today", "Give it a try", "You won't regret it", generic motivational phrases.
GOOD: "Tomorrow morning: 3 sets of [X], rest 90s. Track your reps. Post the result 👇" / "Test this: [specific exercise] before your next session. Tell me if you felt the difference."

ANTI-REPETITION: each tweet covers a different concept. No concept appears twice.
No hashtags. Max 1–2 emoji only where they add meaning.`;

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
