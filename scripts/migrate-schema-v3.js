'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIRS = [
  path.join(ROOT, 'output'),
  path.join(ROOT, 'output', 'food'),
  path.join(ROOT, 'output', 'fitness'),
];

const isDryRun = !process.argv.includes('--apply');

let migrated = 0;
let skipped  = 0;
let errors   = 0;

for (const dir of DIRS) {
  let files;
  try {
    files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  } catch {
    continue;
  }

  for (const filename of files) {
    const filepath = path.join(dir, filename);
    let article;
    try {
      article = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    } catch (e) {
      console.log(`ERROR ${filename}: JSON non valido — ${e.message}`);
      errors++;
      continue;
    }

    if (article.schema_version === 3) {
      console.log(`già v3: ${filename}`);
      skipped++;
      continue;
    }

    if (article.schema_version !== 2) {
      console.log(`SKIP ${filename}: schema_version=${article.schema_version} non gestita`);
      skipped++;
      continue;
    }

    const changes = [];

    if (article.render_quality === undefined) {
      article.render_quality = null;
      changes.push('render_quality: null');
    }
    if (article.render_template === undefined) {
      article.render_template = null;
      changes.push('render_template: null');
    }
    if (article.render_status === undefined || typeof article.render_status !== 'object' || Array.isArray(article.render_status)) {
      // non toccare se già esiste un oggetto legacy a root
    } else if (article.render_status === undefined) {
      article.render_status = { low: null, medium: null, high: null };
      changes.push('render_status: {low,medium,high}');
    }
    // render_status: aggiungi solo se assente completamente
    if (!Object.prototype.hasOwnProperty.call(article, 'render_status')) {
      article.render_status = { low: null, medium: null, high: null };
      changes.push('render_status: {low,medium,high}');
    }
    if (article.render_path === undefined) {
      article.render_path = null;
      changes.push('render_path: null');
    }
    if (article.render_error === undefined) {
      article.render_error = null;
      changes.push('render_error: null');
    }
    if (article.render_version === undefined) {
      article.render_version = null;
      changes.push('render_version: null');
    }

    if (!article.formats) article.formats = {};
    if (!article.formats.video) {
      article.formats.video = {
        scenes:       [],
        duration_sec: 0,
        aspect_ratio: '9:16',
        cta:          '',
        quality_score: 0,
      };
      changes.push('formats.video: {scenes:[],duration_sec:0,...}');
    }

    article.schema_version = 3;
    changes.push('schema_version: 3');

    if (isDryRun) {
      console.log(`[dry-run] ${filename}`);
      changes.forEach(c => console.log(`  + ${c}`));
    } else {
      try {
        fs.writeFileSync(filepath, JSON.stringify(article, null, 2) + '\n');
        console.log(`migrato: ${filename} (${changes.length} campi)`);
      } catch (e) {
        console.log(`ERROR ${filename}: scrittura fallita — ${e.message}`);
        errors++;
        continue;
      }
    }
    migrated++;
  }
}

console.log('');
console.log(`=== Migrazione schema v3 ${isDryRun ? '(DRY-RUN)' : '(APPLY)'} ===`);
console.log(`Migrati: ${migrated} | Già v3: ${skipped} | Errori: ${errors}`);
if (isDryRun && migrated > 0) {
  console.log('');
  console.log('Esegui con --apply per applicare le modifiche.');
}
