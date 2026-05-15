'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIRS = [
  { dir: path.join(ROOT, 'output'),       agent: 'ai-news' },
  { dir: path.join(ROOT, 'output', 'food'), agent: 'food' },
];

const mode = process.argv[2] || '--dry-run';
if (mode !== '--dry-run' && mode !== '--apply') {
  console.error('Uso: node scripts/migrate-schema.js [--dry-run|--apply]');
  process.exit(1);
}
const dryRun = mode === '--dry-run';

function slugFromFilename(filename) {
  // formato: 2026-05-12T13-58-49-611Z_slug-here.json
  const base = path.basename(filename, '.json');
  const idx = base.indexOf('_');
  return idx !== -1 ? base.slice(idx + 1) : base;
}

function migrateArticle(article, filename, agent) {
  const slug = article.slug || slugFromFilename(filename);

  const formats = {
    x: {
      thread: article.thread_text || [],
    },
    instagram: {
      caption: article.instagram_caption || '',
      carousel: article.carousel_slides || [],
    },
    tiktok: {
      script: article.video_script || [],
    },
  };

  return Object.assign({}, article, {
    schema_version: 2,
    agent: article.agent || agent,
    slug,
    prompt_version: article.prompt_version || '1.0.0',
    status: article.status || 'draft',
    formats,
    metrics: article.metrics || { x: {}, instagram: {}, tiktok: {} },
  });
}

function diffFields(original, migrated) {
  const added = [];
  const changed = [];

  const newFields = ['schema_version', 'agent', 'slug', 'prompt_version', 'status', 'formats', 'metrics'];
  for (const field of newFields) {
    if (!(field in original)) {
      added.push(`  + ${field}: ${JSON.stringify(migrated[field]).slice(0, 80)}`);
    } else if (JSON.stringify(original[field]) !== JSON.stringify(migrated[field])) {
      changed.push(`  ~ ${field}: ${JSON.stringify(original[field]).slice(0, 40)} → ${JSON.stringify(migrated[field]).slice(0, 40)}`);
    }
  }
  return [...added, ...changed];
}

let countSkipped = 0;
let countMigrated = 0;
let countErrors = 0;

for (const { dir, agent } of DIRS) {
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
    } catch {
      console.error(`errore JSON: ${filename}`);
      countErrors++;
      continue;
    }

    if (article.schema_version === 2) {
      console.log(`già v2: ${filename}`);
      countSkipped++;
      continue;
    }

    const migrated = migrateArticle(article, filename, agent);

    if (dryRun) {
      const diff = diffFields(article, migrated);
      console.log(`da migrare: ${filename}`);
      diff.forEach(l => console.log(l));
    } else {
      fs.writeFileSync(filepath, JSON.stringify(migrated, null, 2));
      console.log(`migrato: ${filename}`);
    }
    countMigrated++;
  }
}

console.log('');
console.log(`già v2 (saltati): ${countSkipped}`);
console.log(`${dryRun ? 'da migrare' : 'migrati'}: ${countMigrated}`);
console.log(`errori: ${countErrors}`);
