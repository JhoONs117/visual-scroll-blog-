'use strict';

const FITNESS_WHITELIST = [
  'allenamento', 'workout', 'esercizio', 'fitness', 'palestra',
  'corsa', 'running', 'yoga', 'pilates', 'stretching', 'muscoli', 'dimagrire',
  'cardio', 'forza', 'resistenza',
];

function looksLikeFitnessContent(article) {
  const t = (article.title || '').toLowerCase();
  return FITNESS_WHITELIST.some(w => t.includes(w));
}

module.exports = { looksLikeFitnessContent, FITNESS_WHITELIST };
