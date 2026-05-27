'use strict';

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const axios = require('axios');
const { validateVideoPlan } = require('./validate-video-plan');

// ─── Vincolo di test — NON rimuovere senza commit esplicito ─────────────────
const MAX_TEST_LIMIT = 2;

// ─── CLI args ────────────────────────────────────────────────────────────────
const args   = process.argv.slice(2);
const getArg = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };

const agentId   = getArg('--agent');
const slugArg   = getArg('--slug');
const limitArg  = getArg('--limit');
const ciMode    = args.includes('--ci');   // disabilita MAX_TEST_LIMIT in CI

if (!agentId) {
  console.error('❌ --agent richiesto (es. ai-news, food, fitness)');
  process.exit(1);
}

const limit = limitArg !== null ? parseInt(limitArg, 10) : (slugArg ? 1 : (ciMode ? 999 : MAX_TEST_LIMIT));

if (!ciMode && !slugArg && limit > MAX_TEST_LIMIT) {
  console.error(`❌ --limit ${limit} non permesso (max ${MAX_TEST_LIMIT} in fase test). Usa --ci per CI.`);
  process.exit(1);
}

// ─── Status priority (stesso criterio di build-data-agents.js) ───────────────
const STATUS_PRIORITY = { approved: 5, published: 4, scheduled: 3, failed: 2, draft: 1 };

// ─── Percorsi agente ─────────────────────────────────────────────────────────
const ROOT       = path.join(__dirname, '..');
const OUTPUT_DIR = agentId === 'ai-news'
  ? path.join(ROOT, 'output')
  : path.join(ROOT, 'output', agentId);

if (!fs.existsSync(OUTPUT_DIR)) {
  console.error(`❌ Directory output non trovata: ${OUTPUT_DIR}`);
  process.exit(1);
}

// ─── Carica e filtra articoli ─────────────────────────────────────────────────
function loadCandidates() {
  const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.json'));

  // Raggruppa tutti i file per slug
  const bySlug = {};
  for (const f of files) {
    const base = f.replace('.json', '');
    const idx  = base.indexOf('_');
    const slug = idx !== -1 ? base.slice(idx + 1) : base;
    if (!bySlug[slug]) bySlug[slug] = [];
    bySlug[slug].push(f);
  }

  const candidates = [];
  const agentCfg = require('../agents')[agentId];

  for (const [slug, slugFiles] of Object.entries(bySlug)) {
    if (slugArg && slug !== slugArg) continue;

    // File più recente come base del contenuto
    const canonical = slugFiles.slice().sort().reverse()[0];
    let article;
    try {
      article = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, canonical), 'utf8'));
    } catch {
      continue;
    }

    // Status effettivo: priorità più alta tra tutti i file dello slug
    // (stesso criterio di build-data-agents.js — approved batte published, ecc.)
    let effectiveStatus = article.status;
    for (const f of slugFiles) {
      if (f === canonical) continue;
      try {
        const other = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, f), 'utf8'));
        if ((STATUS_PRIORITY[other.status] || 0) > (STATUS_PRIORITY[effectiveStatus] || 0)) {
          effectiveStatus = other.status;
        }
      } catch {}
    }

    // Filtro: status effettivo approved/published + scenes non ancora generate
    if (!['approved', 'published'].includes(effectiveStatus)) continue;
    if (article.formats?.video?.scenes?.length > 0) continue;

    // Normalizza lo status nel file più recente
    article.status = effectiveStatus;

    if (!article.render_template) {
      article.render_template = agentCfg?.defaultVideoTemplate || 'slide_deck';
    }
    if (!article.render_quality) article.render_quality = 'low';
    const templateModule = require('./templates')[article.render_template];
    const customPrompt = templateModule?.generatePlanPrompt || null;

    candidates.push({ article, filepath: path.join(OUTPUT_DIR, canonical), customPrompt });
    if (candidates.length >= limit) break;
  }

  return candidates;
}

// ─── Chiamata OpenAI ──────────────────────────────────────────────────────────
async function callOpenAI(agentId, article, customPrompt = null) {
  const userPrompt = customPrompt !== null
    ? customPrompt
        .replace('{{title}}', article.title)
        .replace('{{video_script}}', (article.video_script || []).join('\n'))
    : [
        'Genera un piano video di 5 scene per questo articolo.',
        '',
        `Agente: ${agentId}`,
        `Titolo: ${article.title}`,
        `Slides: ${(article.slides || []).join(' | ')}`,
        `Template: ${article.render_template}`,
        '',
        'Rispondi con questo schema esatto:',
        JSON.stringify({
          scenes: [
            {
              scene: 1,
              duration_sec: 4,
              hook: '...',
              voiceover: '...',
              on_screen_text: '...',
              visual_direction: '...',
              caption: '...',
            },
          ],
          cta: '...',
          quality_score: 0,
        }, null, 2),
        '',
        'Regole:',
        '- esattamente 5 scene',
        '- durata totale tra 18 e 35 secondi',
        '- scena 1: hook forte, max 8 parole on_screen_text',
        '- ogni voiceover: max 22 parole',
        '- ogni on_screen_text: max 9 parole',
        '- quality_score: intero 0-100 che stimi tu in base alla forza dell\'hook e chiarezza del messaggio',
        '- cta: frase finale invito all\'azione, max 10 parole',
      ].join('\n');

  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Sei un video producer per contenuti social verticali (TikTok, Reels, Shorts). Rispondi SOLO con un oggetto JSON valido, senza markdown, senza backtick.',
        },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );

  return response.data.choices[0].message.content;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  const candidates = loadCandidates();

  if (candidates.length === 0) {
    console.log(`ℹ️  Nessun articolo candidato per --agent ${agentId}.`);
    console.log('   Controlla: status=approved, render_quality!=null, formats.video.scenes=[]');
    process.exit(0);
  }

  console.log(`Trovati ${candidates.length} articoli da processare (agent: ${agentId})`);
  console.log('');

  let success = 0;
  let failed  = 0;

  for (const { article, filepath, customPrompt } of candidates) {
    console.log(`📋 ${article.title}`);

    let raw;
    try {
      raw = await callOpenAI(agentId, article, customPrompt);
    } catch (e) {
      console.log(`❌ chiamata OpenAI fallita: ${e.message}`);
      failed++;
      continue;
    }

    let plan;
    try {
      plan = JSON.parse(raw);
    } catch {
      console.log('❌ risposta AI non parsabile');
      console.log('   Raw:', raw.slice(0, 200));
      failed++;
      continue;
    }

    const { valid, errors } = validateVideoPlan(plan);
    if (!valid) {
      console.log('⚠️  Piano non valido:');
      errors.forEach(e => console.log(`   - ${e}`));
      failed++;
      continue;
    }

    // Aggiorna l'articolo
    if (!article.formats) article.formats = {};
    if (!article.formats.video) article.formats.video = {};
    const totalDuration = plan.scenes.reduce((s, sc) => s + (sc.duration_sec || 0), 0);
    article.formats.video.scenes        = plan.scenes;
    article.formats.video.quality_score = plan.quality_score;
    article.formats.video.duration_sec  = totalDuration;
    article.formats.video.cta           = plan.cta || '';

    try {
      fs.writeFileSync(filepath, JSON.stringify(article, null, 2) + '\n');
      console.log(`✅ Piano salvato — ${plan.scenes.length} scene, ${totalDuration}s, quality ${plan.quality_score}`);
      success++;
    } catch (e) {
      console.log(`❌ scrittura fallita: ${e.message}`);
      failed++;
    }

    console.log('');
  }

  console.log(`=== Fine ===`);
  console.log(`Successi: ${success} | Falliti: ${failed}`);
})();
