'use strict';

require('dotenv').config();
const { callDeepSeek } = require('../deepseek');

async function generateVideoScenes(article) {
  const slides = (article.carousel_slides || []).slice(0, 5);
  const script = article.formats?.tiktok?.script || article.video_script || [];

  // language viene dall'articolo (scritto da run-agent al momento della generazione)
  // default: english — italian solo se l'agente lo specifica esplicitamente
  const language = article.language || 'english';
  const langInstruction = language === 'italian'
    ? 'voice e subtitle DEVONO essere in italiano. Usa il testo voice fornito senza modificarlo.'
    : 'voice and subtitle MUST be in English. If the provided voice text is in another language, translate it to English before using it.';

  const slidesContext = slides.map((s, i) => {
    const hint = s.visual_hint || s.image_query || '';
    const voice = script[i] || s.text || s.title || '';
    return `Scene ${i + 1}: voice="${voice}" | visual_hint="${hint}"`;
  }).join('\n');

  const prompt = `You are a TikTok video editor. Generate exactly 5 video scenes for this article.

Title: ${article.title}

Scenes (voice + visual_hint):
${slidesContext}

Language rule: ${langInstruction}
Query rule: query field MUST always be in English (Pexels works best with English queries). Describe a real B-roll scene. Never use abstract words like "technology", "innovation", "concept", "abstract".

For each scene return a JSON object with:
- scene: number (1-5)
- voice: spoken text — apply the language rule above (translate if needed)
- subtitle: abbreviated version max 5 words, same language as voice
- query: semantic Pexels query in ENGLISH (e.g. "chef slicing vegetables kitchen")
- motion: one of "zoom-in" | "zoom-out" | "pan-right" | "pan-left" | "static"
- transition: one of "fade" | "cut" | "slide"
- duration: estimated seconds (integer 3-5)

Reply ONLY with a valid JSON array of 5 objects. No text before or after.`;

  const raw = await callDeepSeek(prompt);
  const cleaned = raw.replace(/```json|```/g, '').trim();
  const scenes = JSON.parse(cleaned);

  if (!Array.isArray(scenes) || scenes.length !== 5) {
    throw new Error(`generateVideoScenes: attese 5 scene, ricevute ${Array.isArray(scenes) ? scenes.length : 'non-array'}`);
  }

  const validMotions = ['zoom-in', 'zoom-out', 'pan-right', 'pan-left', 'static'];
  const validTransitions = ['fade', 'cut', 'slide'];

  return scenes.map((s, i) => ({
    scene: i + 1,
    voice: String(s.voice || ''),
    subtitle: String(s.subtitle || '').split(' ').slice(0, 5).join(' '),
    query: String(s.query || ''),
    motion: validMotions.includes(s.motion) ? s.motion : 'zoom-in',
    transition: validTransitions.includes(s.transition) ? s.transition : 'fade',
    duration: Math.max(3, Math.min(5, parseInt(s.duration) || 4)),
  }));
}

module.exports = { generateVideoScenes };
