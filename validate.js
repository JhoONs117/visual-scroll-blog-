const fs = require('fs');
const path = require('path');

const QUEUE_PATH = path.join(__dirname, 'review_queue.json');

function isValid(slides) {
  if (!Array.isArray(slides) || slides.length !== 5) return false;
  return slides.every(s => s.trim().split(/\s+/).length <= 12);
}

async function validateWithFallback(title, generateFn) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await generateFn(title);
    if (result && isValid(result.slides)) return result;
  }

  console.warn('FALLBACK TRIGGERED:', title);

  const queue = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf8'));
  queue.push({ title, result: null, timestamp: new Date().toISOString() });
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2));

  return null;
}

module.exports = { isValid, validateWithFallback };

// Test
(async () => {
  const { generateSlides } = require('./generate');

  // Test 1: titolo normale — deve passare
  console.log('-- Test 1: titolo valido --');
  const r1 = await validateWithFallback('GPT-5 can now reason step by step', generateSlides);
  console.log(r1 ? 'Valido: ' + r1.slides.join(' | ') : 'null');

  // Test 2: generateFn che restituisce sempre slides non valide
  console.log('\n-- Test 2: output sempre non valido --');
  const badGen = async () => ({ title: 'test', slides: ['solo una slide'] });
  const r2 = await validateWithFallback('Titolo non valido di test', badGen);
  console.log('Risultato:', r2);

  console.log('\nreview_queue.json:');
  console.log(fs.readFileSync('./review_queue.json', 'utf8'));
})();
