const RSSParser = require('rss-parser');

const parser = new RSSParser();

const FEEDS = [
  'https://feeds.feedburner.com/oreilly/radar',
  'https://www.artificialintelligence-news.com/feed/',
  'https://techcrunch.com/feed/',
];

async function fetchArticles() {
  const results = await Promise.allSettled(FEEDS.map(url => parser.parseURL(url)));

  const articles = [];
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      result.value.items.forEach(item => {
        articles.push({ title: item.title, link: item.link, pubDate: item.pubDate });
      });
    } else {
      console.error(`Feed ${FEEDS[i]} fallito:`, result.reason.message);
    }
  });

  return articles;
}

module.exports = { fetchArticles };

// Test
(async () => {
  const articles = await fetchArticles();
  console.log(`Articoli trovati: ${articles.length}`);
  articles.slice(0, 3).forEach((a, i) => console.log(`${i + 1}. ${a.title}`));
})();
