'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIRS = [
  { dir: path.join(ROOT, 'output') },
  { dir: path.join(ROOT, 'output', 'food') },
];

function canonicalFiles(dir) {
  let files;
  try { files = fs.readdirSync(dir).filter(f => f.endsWith('.json')); }
  catch { return []; }
  const best = {};
  for (const f of files) {
    const base = f.replace('.json', '');
    const idx = base.indexOf('_');
    const slug = idx !== -1 ? base.slice(idx + 1) : base;
    if (!best[slug] || f > best[slug]) best[slug] = f;
  }
  return Object.values(best).map(f => path.join(dir, f));
}

function fixTo5(arr) {
  if (!Array.isArray(arr)) return arr;
  if (arr.length === 5) return arr;
  if (arr.length > 5) return arr.slice(0, 5);
  // < 5: ripeti l'ultimo elemento
  const result = [...arr];
  while (result.length < 5) result.push(result[result.length - 1] || '');
  return result;
}

let fixed = 0;
let ok = 0;

for (const { dir } of DIRS) {
  for (const filepath of canonicalFiles(dir)) {
    const filename = path.basename(filepath);
    const article = JSON.parse(fs.readFileSync(filepath, 'utf8'));

    const vsLen = article.video_script?.length;
    const ttLen = article.thread_text?.length;
    const needsFix = (vsLen !== undefined && vsLen !== 5) || (ttLen !== undefined && ttLen !== 5);

    if (!needsFix) { ok++; continue; }

    if (vsLen !== undefined && vsLen !== 5) {
      article.video_script = fixTo5(article.video_script);
      article.formats.tiktok.script = article.video_script;
      console.log(`fix video_script ${vsLen}→5: ${filename}`);
    }
    if (ttLen !== undefined && ttLen !== 5) {
      article.thread_text = fixTo5(article.thread_text);
      article.formats.x.thread = article.thread_text;
      console.log(`fix thread_text ${ttLen}→5: ${filename}`);
    }

    fs.writeFileSync(filepath, JSON.stringify(article, null, 2));
    fixed++;
  }
}

console.log(`\nfixati: ${fixed} | invariati: ${ok}`);
