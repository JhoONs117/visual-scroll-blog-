'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function countJsonFiles(dir) {
  try {
    return fs.readdirSync(dir).filter(f => f.endsWith('.json')).length;
  } catch {
    return 0;
  }
}

const aiNewsCount = countJsonFiles(path.join(ROOT, 'output'));
const foodCount = countJsonFiles(path.join(ROOT, 'output', 'food'));

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

let lines = [
  '=== BASELINE ===',
  `output/          : ${aiNewsCount} articoli AI news`,
  `output/food/     : ${foodCount} articoli food`,
  `cache.json       : ${keys.length} chiavi totali`,
  `  food:*         : ${foodKeys.length}`,
  `  ainews:*       : ${ainewsKeys.length}`,
  `  md5 puri       : ${md5Keys.length}`,
  `  unknown        : ${unknownKeys.length}`,
];

if (unknownKeys.length > 0) {
  lines.push('');
  lines.push('Chiavi unknown:');
  unknownKeys.forEach(k => lines.push('  ' + k));
}

lines.push('================');

const output = lines.join('\n');
console.log(output);

fs.writeFileSync(path.join(__dirname, 'baseline-snapshot.txt'), output + '\n');
