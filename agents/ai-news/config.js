'use strict';

const fs   = require('fs');
const path = require('path');
const { batchAIFilter } = require('../../filter');
const {
  generateSlides,
  generateFormats,
  generateCarouselSlides,
  generateAINewsCaption,
} = require('../../generate');
// fetch.js is already loaded transitively via filter.js → no new IIFE triggered
const { fetchArticles } = require('../../fetch');

const OUTPUT_DIR = path.join(__dirname, '../../output');

// Mirrors run.js slug() — used for filename-based cross-run dedup
const makeSlug = t => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);

// Inlined from filter.js normalize() — avoids re-requiring at runtime
const normalizeTitle = t =>
  t.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).slice(0, 5).join(' ');

module.exports = {
  id:              'ai-news',
  label:           'AI News',
  emoji:           '⚡',
  language:        'english',
  outputDir:       OUTPUT_DIR,
  cacheFile:       path.join(__dirname, '../../cache/ai-news.json'),
  reviewQueueFile: path.join(__dirname, '../../review_queue.json'),
  maxNewEnv:       'MAX_NEW_ARTICLES',
  promptVersion:   '1.0.0',

  dataFile:    path.join(__dirname, '../../frontend/data.js'),
  dataVarName: 'ARTICLES',

  feeds: [
    'https://feeds.feedburner.com/oreilly/radar',
    'https://www.artificialintelligence-news.com/feed/',
    'https://techcrunch.com/feed/',
  ],

  // fetchFn: fetch + deduplicate + slug + cross-run dedup (mirrors run.js)
  fetchFn: async () => {
    const articles = await fetchArticles();

    // Deduplicate within batch (normalize first 5 words of title)
    const seen = new Set();
    const deduped = articles.filter(a => {
      const key = normalizeTitle(a.title);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Load slugs from output/ to skip articles already saved in previous runs
    const existingSlugs = new Set(
      fs.readdirSync(OUTPUT_DIR)
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace(/^[^_]+_/, '').replace('.json', ''))
    );

    return deduped
      .filter(a => !existingSlugs.has(makeSlug(a.title)))
      .map(a => ({ ...a, slug: makeSlug(a.title) }));
  },

  gate:     null,
  aiFilter: batchAIFilter,

  theme: {
    badge:     'AI NEWS',
    className: '',
    handle:    '@FlashAI',
    palette: {
      accent:  '#3b82f6',
      badgeBg: '#2563eb',
    },
  },

  steps: [
    'fetch', 'hardFilter', 'aiFilter', 'generateSlides', 'generateFormats',
    'generateCaption', 'generateCarousel', 'fetchImages', 'validate', 'save', 'buildData',
  ],

  video: {
    low:    'slide_deck',
    medium: 'data_reveal',
    high:   'avatar_presenter',
  },

  channels: ['x', 'instagram', 'tiktok'],

  videoTemplates: ['slide_deck', 'kinetic_typography', 'network_graph', 'data_story'],
  defaultVideoTemplate: 'kinetic_typography',
  videoPalette: { bg: '#0f172a', text: '#f8fafc', accent: '#3b82f6' },

  // All prompts wrapped as (article, cache) — runner calls them with article object
  prompts: {
    slides:   (article, _cache) => generateSlides(article.title),
    formats:  (article, _cache) => generateFormats(article.title, article.slides),
    caption:  (article, _cache) => generateAINewsCaption(article.title, article.slides, article.thread_text),
    carousel: (article, _cache) => generateCarouselSlides(article.title, article.slides, article.thread_text),
  },
};
