const { fetchArticles } = require('./fetch');

function normalize(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .slice(0, 5)
    .join(' ');
}

function deduplicate(articles) {
  const seen = new Set();
  return articles.filter(a => {
    const key = normalize(a.title);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const WHITELIST = ['ai', 'gpt', 'agent', 'llm', 'model', 'openai'];
const BLACKLIST = ['funding', 'politics', 'lawsuit', 'acquisition'];

function hardFilter(articles) {
  return articles.filter(a => {
    const t = a.title.toLowerCase();
    return WHITELIST.some(w => t.includes(w)) && !BLACKLIST.some(b => t.includes(b));
  });
}

async function batchAIFilter(articles) {
  const { callDeepSeek } = require('./deepseek');
  const results = [];

  for (let i = 0; i < articles.length; i += 10) {
    const batch = articles.slice(i, i + 10);
    const titlesLine = batch.map((a, j) => `${j}: ${a.title}`).join('\n');

    const prompt = `Rispondi SOLO JSON valido.
Formato:
[
  {"index": 0, "useful": true, "score": 8},
  {"index": 1, "useful": false, "score": 3}
]
Titoli:
${titlesLine}`;

    let parsed;
    try {
      const raw = await callDeepSeek(prompt);
      const json = raw.match(/\[[\s\S]*\]/)?.[0];
      parsed = JSON.parse(json);
    } catch (e) {
      console.error('Errore parsing risposta AI:', e.message);
      continue;
    }

    const byIndex = Object.fromEntries(parsed.map(r => [r.index, r]));

    batch.forEach((article, j) => {
      if (!byIndex[j]) {
        console.warn('Indice mancante:', j);
        return;
      }
      if (byIndex[j].useful && byIndex[j].score >= 7) {
        results.push(article);
      }
    });
  }

  return results;
}

module.exports = { normalize, deduplicate, hardFilter, batchAIFilter };

if (require.main === module) {
  (async () => {
    const hardcoded = [
      { title: 'OpenAI releases GPT-5 with reasoning capabilities', link: '', pubDate: '' },
      { title: 'New LLM agent framework outperforms AutoGPT benchmarks', link: '', pubDate: '' },
      { title: 'Local sports team wins championship game last night', link: '', pubDate: '' },
    ];

    console.log('Test batchAIFilter con 3 titoli hardcoded:');
    const aiFiltered = await batchAIFilter(hardcoded);
    console.log(`Articoli passati: ${aiFiltered.length}`);
    aiFiltered.forEach(a => console.log(' -', a.title));
  })();
}
