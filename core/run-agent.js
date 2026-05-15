'use strict';

const fs   = require('fs');
const path = require('path');
const md5  = require('md5');

// --- helpers ---

function loadCache(cacheFile) {
  try { return JSON.parse(fs.readFileSync(cacheFile, 'utf8')); }
  catch { return {}; }
}

function saveCache(cacheFile, cache) {
  fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
}

// Inlined from validate.js to avoid triggering its test IIFE on require
function isValidSlides(slides) {
  return Array.isArray(slides) && slides.length === 5 &&
    slides.every(s => typeof s === 'string' && s.trim().split(/\s+/).length <= 12);
}

// Inlined from filter.js to avoid triggering its test IIFE on require
const HARD_WHITELIST = ['ai', 'gpt', 'agent', 'llm', 'model', 'openai'];
const HARD_BLACKLIST = ['funding', 'politics', 'lawsuit', 'acquisition'];
function hardFilterLocal(articles) {
  return articles.filter(a => {
    const t = a.title.toLowerCase();
    return HARD_WHITELIST.some(w => t.includes(w)) && !HARD_BLACKLIST.some(b => t.includes(b));
  });
}

// --- runner ---

async function runAgent(config) {
  const maxNew = parseInt(process.env[config.maxNewEnv] || '3', 10);
  const has    = s => Array.isArray(config.steps) && config.steps.includes(s);
  const log    = msg => process.stdout.write(msg + '\n');
  const warn   = msg => process.stderr.write('⚠️  ' + msg + '\n');

  const cache = loadCache(config.cacheFile);
  let articles = [];

  // --- fetch (batch) ---
  if (has('fetch')) {
    log(`→ [${config.id}] step: fetch`);
    if (!config.fetchFn) {
      warn(`[${config.id}] fetchFn non definita nella config`);
    } else {
      try {
        articles = await config.fetchFn();
        log(`[${config.id}] ${articles.length} articoli recuperati`);
      } catch (err) {
        warn(`[${config.id}] fetch fallito: ${err.message}`);
      }
    }
  }

  // --- hardFilter (batch) ---
  if (has('hardFilter')) {
    log(`→ [${config.id}] step: hardFilter`);
    const before = articles.length;
    articles = hardFilterLocal(articles);
    log(`[${config.id}] hardFilter: ${before} → ${articles.length}`);
  }

  // --- aiFilter (batch) ---
  if (has('aiFilter') && config.aiFilter) {
    log(`→ [${config.id}] step: aiFilter`);
    try {
      const before = articles.length;
      articles = await config.aiFilter(articles);
      log(`[${config.id}] aiFilter: ${before} → ${articles.length}`);
    } catch (err) {
      warn(`[${config.id}] aiFilter fallito: ${err.message}`);
    }
  }

  // --- per-article pipeline ---
  let newCount     = 0;
  let cacheCount   = 0;
  let discardCount = 0;

  fs.mkdirSync(config.outputDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  for (const rawArticle of articles) {
    if (newCount >= maxNew) break;

    let article = { ...rawArticle };

    // cache dedup
    const slug     = article.slug || md5(article.link || article.title || '');
    const cacheKey = `${config.id === 'ai-news' ? 'ainews' : config.id}:${slug}`;
    if (cache[cacheKey]) {
      cacheCount++;
      continue;
    }

    // enrich
    if (has('enrich') && config.enrichFn) {
      try {
        const enriched = await config.enrichFn(article);
        if (enriched) article = enriched;
      } catch (err) {
        warn(`[${config.id}] enrich [${article.title}]: ${err.message}`);
        discardCount++;
        continue;
      }
    }

    // gate
    if (has('gate') && config.gate) {
      try {
        if (!config.gate(article)) {
          log(`SKIP [${article.title}]: gate`);
          discardCount++;
          continue;
        }
      } catch (err) {
        warn(`[${config.id}] gate [${article.title}]: ${err.message}`);
        discardCount++;
        continue;
      }
    }

    // generateSlides
    if (has('generateSlides')) {
      try {
        const result = await config.prompts.slides(article, cache);
        if (!result) {
          log(`SKIP [${article.title}]: slides null`);
          discardCount++;
          continue;
        }
        article.slides = result.slides;
        if (result.title) article.title = result.title;
      } catch (err) {
        warn(`[${config.id}] generateSlides [${article.title}]: ${err.message}`);
        discardCount++;
        continue;
      }
    }

    // generateFormats
    if (has('generateFormats') && config.prompts && config.prompts.formats) {
      try {
        const result = await config.prompts.formats(article, cache);
        if (result) {
          article.thread_text  = result.thread_text;
          article.video_script = result.video_script;
          article.formats = article.formats || {};
          article.formats.x      = { ...(article.formats.x      || {}), thread: result.thread_text   };
          article.formats.tiktok = { ...(article.formats.tiktok || {}), script: result.video_script  };
        }
      } catch (err) {
        warn(`[${config.id}] generateFormats [${article.title}]: ${err.message}`);
        discardCount++;
        continue;
      }
    }

    // generateCaption
    if (has('generateCaption') && config.prompts && config.prompts.caption) {
      try {
        const result = await config.prompts.caption(article, cache);
        if (result) {
          article.instagram_caption = result;
          article.formats = article.formats || {};
          article.formats.instagram = { ...(article.formats.instagram || {}), caption: result };
        }
      } catch (err) {
        warn(`[${config.id}] generateCaption [${article.title}]: ${err.message}`);
        discardCount++;
        continue;
      }
    }

    // generateVideoScript
    if (has('generateVideoScript') && config.prompts && config.prompts.videoScript) {
      try {
        const result = await config.prompts.videoScript(article, cache);
        if (result) {
          article.video_script = result;
          article.formats = article.formats || {};
          article.formats.tiktok = { ...(article.formats.tiktok || {}), script: result };
        }
      } catch (err) {
        warn(`[${config.id}] generateVideoScript [${article.title}]: ${err.message}`);
        discardCount++;
        continue;
      }
    }

    // generateThread
    if (has('generateThread') && config.prompts && config.prompts.thread) {
      try {
        const result = await config.prompts.thread(article, cache);
        if (result) {
          article.thread_text = result;
          article.formats = article.formats || {};
          article.formats.x = { ...(article.formats.x || {}), thread: result };
        }
      } catch (err) {
        warn(`[${config.id}] generateThread [${article.title}]: ${err.message}`);
        discardCount++;
        continue;
      }
    }

    // generateCarousel
    if (has('generateCarousel') && config.prompts && config.prompts.carousel) {
      try {
        const result = await config.prompts.carousel(article, cache);
        if (!result || !Array.isArray(result.carousel_slides) || result.carousel_slides.length !== 5) {
          log(`SKIP [${article.title}]: carousel incompleto`);
          discardCount++;
          continue;
        }
        article.carousel_slides = result.carousel_slides;
        if (result.dish_type)             article.dish_type             = result.dish_type;
        if (result.signature_ingredients) article.signature_ingredients = result.signature_ingredients;
      } catch (err) {
        warn(`[${config.id}] generateCarousel [${article.title}]: ${err.message}`);
        discardCount++;
        continue;
      }
    }

    // fetchImages — lazy require to avoid triggering fetch.js test IIFE at load time
    if (has('fetchImages')) {
      try {
        const { fetchPexelsImage, fetchArticleImage } = require('../fetch');
        const slides = Array.isArray(article.carousel_slides) ? article.carousel_slides : [];
        let image = null;
        if (article.link) {
          const og = await fetchArticleImage(article.link);
          if (og && !/(logo|placeholder|default|avatar)/i.test(og)) image = og;
        }
        if (!image && slides[0]?.image_query) {
          image = await fetchPexelsImage(slides[0].image_query);
        }
        article.image = image;
        for (let i = 1; i <= 4; i++) {
          const cs = slides[i];
          if (cs?.image_query) {
            const img = await fetchPexelsImage(cs.image_query);
            if (img) cs.image = img;
          }
        }
      } catch (err) {
        warn(`[${config.id}] fetchImages [${article.title}]: ${err.message}`);
        // non scartiamo per mancanza di immagini
      }
    }

    // validate — mirrors validateWithFallback without requiring validate.js (IIFE side-effect)
    if (has('validate')) {
      if (!isValidSlides(article.slides)) {
        // One retry via prompts.slides (matches validateWithFallback retry logic)
        let recovered = false;
        if (config.prompts && config.prompts.slides) {
          try {
            const retry = await config.prompts.slides(article, cache);
            if (retry && isValidSlides(retry.slides)) {
              article.slides = retry.slides;
              recovered = true;
            }
          } catch {}
        }
        if (!recovered) {
          // Write to reviewQueueFile (same as validateWithFallback fallback)
          if (config.reviewQueueFile) {
            try {
              const q = JSON.parse(fs.readFileSync(config.reviewQueueFile, 'utf8'));
              q.push({ title: article.title, result: null, timestamp: new Date().toISOString() });
              fs.writeFileSync(config.reviewQueueFile, JSON.stringify(q, null, 2));
            } catch {}
          }
          warn(`[${config.id}] validate fallback [${article.title}]`);
          discardCount++;
          continue;
        }
      }
    }

    // save
    if (has('save')) {
      try {
        const savedAt = new Date().toISOString();
        const saved = {
          schema_version: 2,
          agent:          config.id,
          slug,
          prompt_version: config.promptVersion || '1.0.0',
          status:         'published',
          ...article,
          savedAt,
        };
        // sourceId from link hash (mirrors run-food.js / run.js convention)
        if (!saved.sourceId && article.link) saved.sourceId = md5(article.link);
        // ensure legacy aliases
        if (!saved.thread_text        && saved.formats?.x?.thread)           saved.thread_text        = saved.formats.x.thread;
        if (!saved.instagram_caption  && saved.formats?.instagram?.caption)  saved.instagram_caption  = saved.formats.instagram.caption;
        if (!saved.video_script       && saved.formats?.tiktok?.script)      saved.video_script       = saved.formats.tiktok.script;

        const filename = `${timestamp}_${slug}.json`;
        fs.writeFileSync(path.join(config.outputDir, filename), JSON.stringify(saved, null, 2));
        newCount++;
        log(`Salvato: ${article.title}`);

        // Merge with current file state (generate functions may have written new entries)
        const fileCache = loadCache(config.cacheFile);
        fileCache[cacheKey] = { title: article.title, savedAt };
        saveCache(config.cacheFile, fileCache);
        cache[cacheKey] = fileCache[cacheKey];
      } catch (err) {
        warn(`[${config.id}] save [${article.title}]: ${err.message}`);
        discardCount++;
        continue;
      }
    }
  }

  // buildData
  if (has('buildData') && config.dataFile) {
    log(`→ [${config.id}] step: buildData`);
    try {
      const seen = new Set();
      const allArticles = fs.readdirSync(config.outputDir)
        .filter(f => f.endsWith('.json'))
        .sort()
        .reverse()
        .map(f => {
          try { return JSON.parse(fs.readFileSync(path.join(config.outputDir, f), 'utf8')); }
          catch { return null; }
        })
        .filter(a => {
          if (!a) return false;
          const key = (a.slug || '').toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .sort((a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0));

      const varName = config.dataVarName ||
        `${config.id.replace(/-/g, '_').toUpperCase()}_ARTICLES`;
      fs.writeFileSync(config.dataFile, `window.${varName} = ${JSON.stringify(allArticles, null, 2)};`);
      log(`[${config.id}] buildData: ${allArticles.length} articoli`);
    } catch (err) {
      warn(`[${config.id}] buildData: ${err.message}`);
    }
  }

  log(`[${config.id}] completato: ${newCount} nuovi | ${cacheCount} da cache | ${discardCount} scartati`);
  return { newCount, cacheCount, discardCount };
}

// CLI entry point
if (require.main === module) {
  const agentId = process.argv[2];
  if (!agentId || agentId === '--help') {
    process.stderr.write('Uso: node core/run-agent.js <agentId>\n');
    process.exit(1);
  }
  let config;
  try {
    config = require(`../agents/${agentId}/config`);
  } catch {
    process.stderr.write(`Agente non trovato: ${agentId}\n`);
    process.exit(1);
  }
  runAgent(config).catch(err => {
    process.stderr.write(`Errore fatale: ${err.message}\n`);
    process.exit(1);
  });
}

module.exports = { runAgent };
