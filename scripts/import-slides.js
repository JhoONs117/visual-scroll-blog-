'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const args    = process.argv.slice(2);
const getArg  = f => { const i = args.indexOf(f); return i !== -1 ? args[i + 1] : null; };

const agent = getArg('--agent') || 'ai-news';
const slug  = getArg('--slug');

if (!slug) {
  console.error('Uso: node scripts/import-slides.js --slug <slug> [--agent ai-news]');
  process.exit(1);
}

const downloadsDir = path.join(os.homedir(), 'Downloads');
const destDir      = path.join(__dirname, '..', 'output', agent, 'slides-png', slug);

fs.mkdirSync(destDir, { recursive: true });

let copied = 0;
for (let i = 0; i < 5; i++) {
  const src = path.join(downloadsDir, `slide${i}.png`);
  const dst = path.join(destDir, `slide${i}.png`);
  if (!fs.existsSync(src)) {
    console.log(`⚠️  Non trovato: ${src}`);
    continue;
  }
  fs.copyFileSync(src, dst);
  fs.unlinkSync(src); // rimuove da Downloads
  console.log(`✅ slide${i}.png → ${path.relative(process.cwd(), dst)}`);
  copied++;
}

if (copied === 5) {
  console.log(`\n✅ Tutte le slide importate in output/${agent}/slides-png/${slug}/`);
  console.log('Puoi ora eseguire: node video/render-pending.js');
} else {
  console.log(`\n⚠️  ${copied}/5 slide importate — verifica i file in ~/Downloads`);
}
