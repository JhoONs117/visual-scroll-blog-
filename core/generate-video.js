'use strict';

require('dotenv').config();
const { callDeepSeek } = require('../deepseek');

async function generateVideoScenes(article) {
  const slides = (article.carousel_slides || []).slice(0, 5);
  const script = article.formats?.tiktok?.script || article.video_script || [];

  const slidesContext = slides.map((s, i) => {
    const hint = s.visual_hint || s.image_query || '';
    const voice = script[i] || s.text || s.title || '';
    return `Scena ${i + 1}: voice="${voice}" | visual_hint="${hint}"`;
  }).join('\n');

  const prompt = `Sei un editor video TikTok. Devi generare esattamente 5 scene video per questo articolo.

Titolo: ${article.title}

Scene (voice + visual_hint):
${slidesContext}

Per ogni scena restituisci un oggetto JSON con questi campi:
- scene: numero (1-5)
- voice: testo parlato (uguale al voice fornito, non modificare)
- subtitle: versione abbreviata max 5 parole del voice
- query: query semantica per Pexels stock video (es. "chef slicing vegetables kitchen"). DEVE descrivere una scena reale ripresa in B-roll. NON usare parole astratte come "technology", "innovation", "concept", "abstract".
- motion: uno tra "zoom-in" | "zoom-out" | "pan-right" | "pan-left" | "static"
- transition: uno tra "fade" | "cut" | "slide"
- duration: stima secondi (numero intero 3-5)

Rispondi SOLO con un array JSON valido di 5 oggetti. Nessun testo prima o dopo.`;

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
