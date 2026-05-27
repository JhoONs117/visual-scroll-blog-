'use strict';
const fs   = require('fs');
const path = require('path');

const [,, dir, slug, status] = process.argv;
if (!dir || !slug || !status) { process.exit(1); }

const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
let updated = 0;
for (const fname of files) {
  const fpath = path.join(dir, fname);
  try {
    const article = JSON.parse(fs.readFileSync(fpath, 'utf8'));
    if (article.slug === slug) {
      article.status = status;
      fs.writeFileSync(fpath, JSON.stringify(article, null, 2));
      updated++;
    }
  } catch {}
}
console.log(`apply-status: ${updated} file aggiornati (${slug} → ${status})`);
