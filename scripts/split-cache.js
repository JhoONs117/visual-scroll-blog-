'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const mode = process.argv[2] || '--dry-run';

if (mode !== '--dry-run' && mode !== '--apply') {
  console.error('Uso: node scripts/split-cache.js [--dry-run|--apply]');
  process.exit(1);
}

const cacheRaw = fs.readFileSync(path.join(ROOT, 'cache.json'), 'utf8');
const cache = JSON.parse(cacheRaw);
const keys = Object.keys(cache);

const foodKeys    = keys.filter(k => k.startsWith('food:'));
const ainewsKeys  = keys.filter(k => k.startsWith('ainews:'));
const md5Keys     = keys.filter(k => /^[a-f0-9]{32}$/.test(k));
const unknownKeys = keys.filter(k =>
  !k.startsWith('food:') &&
  !k.startsWith('ainews:') &&
  !/^[a-f0-9]{32}$/.test(k)
);

if (unknownKeys.length > 0) {
  console.error('Chiavi unknown trovate — ispeziona manualmente prima di procedere:');
  unknownKeys.forEach(k => console.error('  ' + k));
  process.exit(1);
}

const aiNewsCache = {};
[...ainewsKeys, ...md5Keys].forEach(k => { aiNewsCache[k] = cache[k]; });

const foodCache = {};
foodKeys.forEach(k => { foodCache[k] = cache[k]; });

console.log(`Piano di split:`);
console.log(`  cache/ai-news.json : ${Object.keys(aiNewsCache).length} chiavi (${ainewsKeys.length} ainews: + ${md5Keys.length} md5 puri)`);
console.log(`  cache/food.json    : ${Object.keys(foodCache).length} chiavi (${foodKeys.length} food:)`);

if (mode === '--dry-run') {
  console.log('\n[dry-run] Nessun file scritto.');
  process.exit(0);
}

const cacheDir = path.join(ROOT, 'cache');
fs.mkdirSync(cacheDir, { recursive: true });

fs.writeFileSync(path.join(cacheDir, 'ai-news.json'), JSON.stringify(aiNewsCache, null, 2));
console.log(`cache/ai-news.json: ${Object.keys(aiNewsCache).length} chiavi`);

fs.writeFileSync(path.join(cacheDir, 'food.json'), JSON.stringify(foodCache, null, 2));
console.log(`cache/food.json: ${Object.keys(foodCache).length} chiavi`);

console.log('\ncache.json originale NON eliminato — backup disponibile per verifica manuale.');
