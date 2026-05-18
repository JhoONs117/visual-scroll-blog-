'use strict';

// scheduler.js — pubblica articoli approvati + renderizzati su tutti i canali configurati
//
// Prerequisiti:
//   - almeno 30 articoli approvati (status:approved)
//   - canali validati manualmente uno alla volta
//   - credenziali configurate in .env
//
// Uso da CLI (test manuale):
//   node publish/scheduler.js --agent ai-news          # tutti gli approved+rendered
//   node publish/scheduler.js --agent ai-news --dry-run  # mostra cosa verrebbe pubblicato
//
// Uso da CI (GitHub Actions — solo dopo validazione):
//   node publish/scheduler.js --agent ai-news --channels instagram,tiktok

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// ── canali disponibili ────────────────────────────────────────────────────
const PUBLISHERS = {
  instagram: () => require('./publisher-instagram'),
  tiktok:    () => require('./publisher-tiktok'),
  x:         () => require('./publisher-x'),
};

// ── arg parsing ───────────────────────────────────────────────────────────
function arg(name) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : null;
}
const agentId  = arg('--agent');
const dryRun   = process.argv.includes('--dry-run');
const channelsArg = arg('--channels');

if (!agentId) {
  console.error('❌ --agent richiesto (es. ai-news | food | fitness)');
  process.exit(1);
}

// canali da pubblicare — default: tutti
const activeChannels = channelsArg
  ? channelsArg.split(',').map(c => c.trim()).filter(c => PUBLISHERS[c])
  : Object.keys(PUBLISHERS);

// ── trova articoli eligible ───────────────────────────────────────────────
function findEligibleArticles() {
  const dir = agentId === 'ai-news'
    ? path.join(ROOT, 'output')
    : path.join(ROOT, 'output', agentId);

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

  // group by slug, mantieni solo il più recente per slug
  const bySlug = {};
  for (const f of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      const slug = data.slug;
      if (!slug) continue;
      if (!bySlug[slug] || f > bySlug[slug].file) {
        bySlug[slug] = { file: path.join(dir, f), data };
      }
    } catch { /* file corrotto — salta */ }
  }

  return Object.values(bySlug).filter(({ data }) =>
    data.status === 'approved' && data.render_status === 'rendered'
  );
}

// ── controlla se un canale è già pubblicato per questo articolo ───────────
function isAlreadyPublished(article, channel) {
  return article.publish_status?.[channel] === 'published';
}

// ── main ──────────────────────────────────────────────────────────────────
(async () => {
  const articles = findEligibleArticles();

  if (articles.length === 0) {
    console.log('Nessun articolo eligible (status:approved + render_status:rendered).');
    process.exit(0);
  }

  console.log(`\n📋 Scheduler — agent: ${agentId}`);
  console.log(`   canali: ${activeChannels.join(', ')}`);
  console.log(`   articoli eligible: ${articles.length}`);
  if (dryRun) console.log('   ⚠ DRY RUN — nessuna pubblicazione effettiva\n');

  let published = 0;
  let skipped = 0;
  let failed = 0;

  for (const { file, data } of articles) {
    const slug = data.slug;
    console.log(`\n▶ ${slug}`);

    for (const channel of activeChannels) {
      if (isAlreadyPublished(data, channel)) {
        console.log(`  ${channel}: già pubblicato — skip`);
        skipped++;
        continue;
      }

      if (dryRun) {
        console.log(`  ${channel}: [dry-run] verrebbe pubblicato`);
        continue;
      }

      try {
        const publisher = PUBLISHERS[channel]();
        await publisher.publish(agentId, slug);
        // rileggi data aggiornata dopo publish
        Object.assign(data, JSON.parse(fs.readFileSync(file, 'utf8')));
        published++;
      } catch (err) {
        console.error(`  ${channel}: ❌ ${err.message.split('\n')[0]}`);
        failed++;
        // continua con il canale successivo — non bloccare
      }

      // pausa tra canali per evitare burst di richieste
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.log(`\n✅ Completato: ${published} pubblicati | ${skipped} già pubblicati | ${failed} falliti`);
  if (failed > 0) process.exit(1);
})();
