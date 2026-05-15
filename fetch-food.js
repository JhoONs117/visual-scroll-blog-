const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');
const axios = require('axios');

const FEEDS = [
  'https://www.giallozafferano.it/feed',
  // 'https://www.foodmakers.it/feed', // riattivare dopo 10 articoli corretti
];

const WHITELIST = [
  'ricetta', 'ingredienti', 'preparazione', 'pasta', 'risotto',
  'dolce', 'torta', 'zuppa', 'insalata', 'pollo', 'pesce', 'carne', 'verdura',
  'antipasto', 'primo', 'secondo', 'dessert',
];

const FOOD_OUTPUT_DIR = path.join(__dirname, 'output', 'food');

function slug(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
}

async function fetchArticleContent(url) {
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept-Language': 'it-IT,it;q=0.9',
      },
      timeout: 8000,
    });
    if (res.status !== 200) return '';
    return res.data
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 12000);
  } catch {
    return '';
  }
}

async function fetchFoodArticles() {
  fs.mkdirSync(FOOD_OUTPUT_DIR, { recursive: true });

  const existingSlugs = new Set(
    fs.readdirSync(FOOD_OUTPUT_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(FOOD_OUTPUT_DIR, f), 'utf8'));
          return data.slug || '';
        } catch {
          return '';
        }
      })
      .filter(Boolean)
  );

  const parser = new Parser();
  const results = await Promise.allSettled(FEEDS.map(url => parser.parseURL(url)));

  const items = [];
  results.forEach((res, i) => {
    if (res.status === 'rejected') {
      console.warn(`Feed food ${FEEDS[i]} fallito:`, res.reason?.message || res.reason);
      return;
    }
    for (const item of res.value.items || []) {
      items.push({ title: item.title || '', link: item.link || '', pubDate: item.pubDate || '' });
    }
  });

  const filtered = items.filter(item => {
    const t = item.title.toLowerCase();
    return WHITELIST.some(w => t.includes(w));
  });

  const articles = [];
  for (const item of filtered) {
    const s = slug(item.title);
    if (existingSlugs.has(s)) continue;

    const content = await fetchArticleContent(item.link);
    articles.push({ title: item.title, slug: s, link: item.link, pubDate: item.pubDate, content });
  }

  return articles;
}

async function fetchFoodArticlesRaw() {
  fs.mkdirSync(FOOD_OUTPUT_DIR, { recursive: true });

  const existingSlugs = new Set(
    fs.readdirSync(FOOD_OUTPUT_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(FOOD_OUTPUT_DIR, f), 'utf8'));
          return data.slug || '';
        } catch {
          return '';
        }
      })
      .filter(Boolean)
  );

  const parser = new Parser();
  const results = await Promise.allSettled(FEEDS.map(url => parser.parseURL(url)));

  const items = [];
  results.forEach((res, i) => {
    if (res.status === 'rejected') {
      console.warn(`Feed food ${FEEDS[i]} fallito:`, res.reason?.message || res.reason);
      return;
    }
    for (const item of res.value.items || []) {
      items.push({ title: item.title || '', link: item.link || '', pubDate: item.pubDate || '' });
    }
  });

  return items
    .filter(item => WHITELIST.some(w => item.title.toLowerCase().includes(w)))
    .filter(item => !existingSlugs.has(slug(item.title)))
    .map(item => ({ title: item.title, slug: slug(item.title), link: item.link, pubDate: item.pubDate }));
}

module.exports = { fetchFoodArticles, fetchFoodArticlesRaw, fetchArticleContent };
