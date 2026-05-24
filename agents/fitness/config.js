'use strict';

const fs   = require('fs');
const path = require('path');
const Parser = require('rss-parser');
const {
  generateFitnessSlides,
  generateFitnessCarouselSlides,
  generateFitnessCaption,
  generateFitnessVideoScript,
  generateFitnessThread,
} = require('./prompts');
const { looksLikeFitnessContent, FITNESS_WHITELIST } = require('./filters');

const OUTPUT_DIR = path.join(__dirname, '../../output/fitness');

const makeSlug = t => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);

module.exports = {
  id:              'fitness',
  label:           'Flash Fitness',
  emoji:           '💪',
  language:        'english',
  outputDir:       OUTPUT_DIR,
  cacheFile:       path.join(__dirname, '../../cache/fitness.json'),
  reviewQueueFile: null,
  maxNewEnv:       'MAX_NEW_FITNESS_ARTICLES',
  promptVersion:   '1.0.0',

  dataFile:    path.join(__dirname, '../../frontend/data-fitness.js'),
  dataVarName: 'FITNESS_ARTICLES',

  feeds: [
    'https://www.gazzetta.it/rss/fitness.xml',
  ],

  fetchFn: async () => {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    // Slug già salvati in output/fitness/
    const existingSlugs = new Set(
      fs.readdirSync(OUTPUT_DIR)
        .filter(f => f.endsWith('.json'))
        .map(f => {
          try { return JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, f), 'utf8')).slug || ''; }
          catch { return ''; }
        })
        .filter(Boolean)
    );

    const parser  = new Parser();
    const results = await Promise.allSettled(
      module.exports.feeds.map(url => parser.parseURL(url))
    );

    const items = [];
    results.forEach((res, i) => {
      if (res.status === 'rejected') {
        process.stderr.write(`⚠️  [fitness] feed ${module.exports.feeds[i]} fallito: ${res.reason?.message}\n`);
        return;
      }
      res.value.items.forEach(item => { if (item.title) items.push(item); });
    });

    return items
      .filter(item => FITNESS_WHITELIST.some(w => item.title.toLowerCase().includes(w)))
      .filter(item => !existingSlugs.has(makeSlug(item.title)))
      .map(item => ({
        title:   item.title,
        slug:    makeSlug(item.title),
        link:    item.link,
        pubDate: item.pubDate,
      }));
  },

  gate:     looksLikeFitnessContent,
  aiFilter: null,

  theme: {
    badge:     'FLASH FITNESS',
    className: 'fitness-story',
    handle:    '@FlashFitness',
    palette: {
      accent:  '#facc15',
      badgeBg: '#1c1c1c',
    },
  },

  steps: [
    'fetch', 'gate', 'generateSlides', 'generateCarousel',
    'generateCaption', 'generateVideoScript', 'generateThread',
    'fetchImages', 'save', 'buildData',
  ],

  video: {
    low:    'slide_deck',
    medium: 'coach_breakdown',
    high:   'avatar_presenter',
  },

  channels: ['x', 'instagram', 'tiktok'],

  videoTemplates: ['slide_deck', 'minimal_documentary', 'anatomy_motion'],
  defaultVideoTemplate: 'slide_deck',
  videoPalette: { bg: '#0a0f0a', text: '#f0fdf4', accent: '#22c55e' },

  prompts: {
    slides:      (article, _cache) => generateFitnessSlides(article),
    carousel:    (article, _cache) => generateFitnessCarouselSlides(article),
    caption:     (article, _cache) => generateFitnessCaption(article),
    videoScript: (article, _cache) => generateFitnessVideoScript(article),
    thread:      (article, _cache) => generateFitnessThread(article),
  },
};
