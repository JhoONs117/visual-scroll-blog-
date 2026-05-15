'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const DIRS = {
  'ai-news': path.join(ROOT, 'output'),
  'food':    path.join(ROOT, 'output', 'food'),
  'fitness': path.join(ROOT, 'output', 'fitness'),
};

function readCanonical(dir) {
  let files;
  try { files = fs.readdirSync(dir).filter(f => f.endsWith('.json')); }
  catch { return []; }

  // Most recent file per slug (filename sort descending → first wins)
  const best = {};
  for (const f of files) {
    const slug = f.replace(/^[^_]+_/, '').replace('.json', '');
    if (!best[slug] || f > best[slug]) best[slug] = f;
  }

  const seen = new Set();
  return Object.values(best)
    .sort().reverse()
    .map(f => {
      try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); }
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
}

const agents = {};
const counts = [];

for (const [agentId, dir] of Object.entries(DIRS)) {
  const articles = readCanonical(dir);
  agents[agentId] = articles;
  counts.push(`${articles.length} ${agentId}`);
}

fs.writeFileSync(
  path.join(ROOT, 'frontend', 'data-agents.js'),
  `window.AGENTS = ${JSON.stringify(agents, null, 2)};`
);

console.log(`data-agents.js aggiornato: ${counts.join(' | ')}`);
