require('dotenv').config();
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

/* Foto Pexels per slide 2-5 del carousel (portrait, qualità large2x) */
async function fetchPexelsImage(query) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return null;
  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5&orientation=portrait&size=large`;
    const res = await fetch(url, {
      headers: { Authorization: key },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const photo = data.photos?.[0];
    return photo?.src?.large2x || photo?.src?.large || null;
  } catch {
    return null;
  }
}

/* og:image / twitter:image dalla pagina dell'articolo (slide 1) */
async function fetchArticleImage(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bot/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const m =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
    const imgUrl = m ? m[1].trim() : null;
    if (imgUrl && (imgUrl.startsWith('http') || imgUrl.startsWith('//'))) return imgUrl;
    return null;
  } catch {
    return null;
  }
}

module.exports = { fetchArticles, fetchPexelsImage, fetchArticleImage };

if (require.main === module) {
  (async () => {
    const articles = await fetchArticles();
    console.log(`Articoli trovati: ${articles.length}`);
    articles.slice(0, 3).forEach((a, i) => console.log(`${i + 1}. ${a.title}`));
  })();
}
