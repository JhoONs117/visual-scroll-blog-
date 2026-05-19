'use strict';

const path = require('path');
const {
  looksLikeRecipe,
  generateRecipeSlides,
  generateRecipeCarouselSlides,
  generateFoodCaption,
  generateFoodVideoScript,
  generateFoodThread,
} = require('../../generate-food');
const { fetchFoodArticlesRaw, fetchArticleContent } = require('../../fetch-food');

module.exports = {
  id:              'food',
  label:           '5 Step Food',
  emoji:           '🍳',
  language:        'italian',
  outputDir:       path.join(__dirname, '../../output/food'),
  cacheFile:       path.join(__dirname, '../../cache/food.json'),
  reviewQueueFile: null,
  maxNewEnv:       'MAX_NEW_FOOD_ARTICLES',
  promptVersion:   '1.0.0',

  dataFile:    path.join(__dirname, '../../frontend/data-food.js'),
  dataVarName: 'FOOD_ARTICLES',

  feeds: [
    'https://www.giallozafferano.it/feed',
  ],

  fetchFn:  fetchFoodArticlesRaw,
  enrichFn: async (article) => ({
    ...article,
    content: await fetchArticleContent(article.link),
  }),

  // Wrapped to receive article object (runner calls config.gate(article))
  gate: (article) => looksLikeRecipe(article.content || ''),

  aiFilter: null,

  theme: {
    badge:     '5 STEP FOOD',
    className: 'food-story',
    handle:    '@FlashKitchen',
    palette: {
      accent:  '#e07b39',
      badgeBg: '#3d5a3e',
    },
  },

  extraFields: ['dish_type', 'signature_ingredients'],

  // Carousel must come before caption/videoScript/thread (they need signature_ingredients)
  steps: [
    'fetch', 'enrich', 'gate', 'generateSlides', 'generateCarousel',
    'generateCaption', 'generateVideoScript', 'generateThread',
    'fetchImages', 'save', 'buildData',
  ],

  video: {
    low:    'slide_deck',
    medium: 'recipe_reveal',
    high:   'avatar_presenter',
  },

  channels: ['x', 'instagram', 'tiktok'],

  // All prompts wrapped as (article, cache) → runner calls them with article object
  prompts: {
    slides:      (article, _cache) => generateRecipeSlides(article.title, article.content),
    carousel:    (article, _cache) => generateRecipeCarouselSlides(article.title, article.slides),
    caption:     (article, _cache) => generateFoodCaption(article.title, article.slides, article.signature_ingredients),
    videoScript: (article, _cache) => generateFoodVideoScript(article.title, article.slides, article.signature_ingredients),
    thread:      (article, _cache) => generateFoodThread(article.title, article.slides, article.signature_ingredients),
  },
};
