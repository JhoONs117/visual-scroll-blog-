'use strict';

function validateVideoPlan(plan) {
  const errors = [];

  // 1. scenes è array di esattamente 5 elementi
  if (!plan || !Array.isArray(plan.scenes) || plan.scenes.length !== 5) {
    errors.push(`scenes: array di esattamente 5 elementi richiesto (trovato ${Array.isArray(plan?.scenes) ? plan.scenes.length : typeof plan?.scenes})`);
    return { valid: false, errors };
  }

  // 2. durata totale tra 18 e 35 (calcolata dalle scene)
  const totalDuration = plan.scenes.reduce((s, sc) => s + (Number(sc.duration_sec) || 0), 0);
  if (totalDuration < 18 || totalDuration > 35)
    errors.push(`duration_sec totale: ${totalDuration}s — deve essere tra 18 e 35`);

  // 3. scenes[0].hook non vuoto
  if (!plan.scenes[0].hook || typeof plan.scenes[0].hook !== 'string' || plan.scenes[0].hook.trim() === '')
    errors.push('scenes[0].hook: stringa non vuota richiesta');

  // 4-7. Controlli per ogni scena
  plan.scenes.forEach((sc, i) => {
    // 4. voiceover non vuoto
    if (!sc.voiceover || typeof sc.voiceover !== 'string' || sc.voiceover.trim() === '') {
      errors.push(`scenes[${i}].voiceover: stringa non vuota richiesta`);
    } else {
      // 5. voiceover max 22 parole
      const words = sc.voiceover.trim().split(/\s+/).length;
      if (words > 22)
        errors.push(`scenes[${i}].voiceover: ${words} parole — massimo 22`);
    }

    // 6. on_screen_text non vuoto
    if (!sc.on_screen_text || typeof sc.on_screen_text !== 'string' || sc.on_screen_text.trim() === '') {
      errors.push(`scenes[${i}].on_screen_text: stringa non vuota richiesta`);
    } else {
      // 7. on_screen_text max 9 parole
      const words = sc.on_screen_text.trim().split(/\s+/).length;
      if (words > 9)
        errors.push(`scenes[${i}].on_screen_text: ${words} parole — massimo 9`);
    }
  });

  // 8. cta non vuota
  if (!plan.cta || typeof plan.cta !== 'string' || plan.cta.trim() === '')
    errors.push('cta: stringa non vuota richiesta');

  // 9. quality_score >= 75
  if (typeof plan.quality_score !== 'number' || plan.quality_score < 75)
    errors.push(`quality_score: ${plan.quality_score} — deve essere numero >= 75`);

  return { valid: errors.length === 0, errors };
}

module.exports = { validateVideoPlan };
