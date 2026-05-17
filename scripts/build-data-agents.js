'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const DIRS = {
  'ai-news': path.join(ROOT, 'output'),
  'food':    path.join(ROOT, 'output', 'food'),
  'fitness': path.join(ROOT, 'output', 'fitness'),
};

// Status priority: approved > published > scheduled > failed > draft
const STATUS_PRIORITY = { approved: 5, published: 4, scheduled: 3, failed: 2, draft: 1 };

function readCanonical(dir) {
  let files;
  try { files = fs.readdirSync(dir).filter(f => f.endsWith('.json')); }
  catch { return []; }

  // Group all files by slug
  const bySlug = {};
  for (const f of files) {
    const slug = f.replace(/^[^_]+_/, '').replace('.json', '');
    if (!bySlug[slug]) bySlug[slug] = [];
    bySlug[slug].push(f);
  }

  const seen = new Set();
  return Object.values(bySlug)
    .map(group => {
      // Pick most recent file as content base
      const canonical = group.sort().reverse()[0];
      let article;
      try { article = JSON.parse(fs.readFileSync(path.join(dir, canonical), 'utf8')); }
      catch { return null; }

      // Merge user-controlled fields from all files in the group:
      // take the highest-priority status, and preserve render/publish state
      for (const f of group) {
        if (f === canonical) continue;
        try {
          const other = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
          const otherPriority = STATUS_PRIORITY[other.status] || 0;
          const currentPriority = STATUS_PRIORITY[article.status] || 0;
          if (otherPriority > currentPriority) article.status = other.status;
          if (other.render_status && !article.render_status) article.render_status = other.render_status;
          if (other.render_version && !article.render_version) article.render_version = other.render_version;
          if (other.publish_status && !article.publish_status) article.publish_status = other.publish_status;
        } catch { /* skip corrupt */ }
      }

      return article;
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
