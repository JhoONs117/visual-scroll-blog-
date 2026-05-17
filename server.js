const http    = require('http');
const https   = require('https');
const fs      = require('fs');
const path    = require('path');
const { spawn } = require('child_process');

const PORT     = process.env.PORT || 3000;
const FRONTEND = path.join(__dirname, 'frontend');

const OUTPUT_DIRS = {
  'ai-news': path.join(__dirname, 'output'),
  'food':    path.join(__dirname, 'output', 'food'),
  'fitness': path.join(__dirname, 'output', 'fitness'),
};

const VALID_STATUSES = ['draft', 'approved', 'scheduled', 'published', 'failed'];

const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.css':  'text/css',
};

http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];

  /* ── Status setter: POST /api/set-status ── */
  if (req.method === 'POST' && urlPath === '/api/set-status') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { agent, slug, status } = JSON.parse(body);
        if (!VALID_STATUSES.includes(status)) {
          res.writeHead(400); res.end('Invalid status'); return;
        }
        const dir = OUTPUT_DIRS[agent];
        if (!dir) { res.writeHead(400); res.end('Unknown agent'); return; }

        // Find ALL files with this slug and update status in each
        const allFiles = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
        let updatedCount = 0;
        for (const fname of allFiles) {
          const fpath = path.join(dir, fname);
          try {
            const article = JSON.parse(fs.readFileSync(fpath, 'utf8'));
            if (article.slug === slug) {
              article.status = status;
              fs.writeFileSync(fpath, JSON.stringify(article, null, 2));
              updatedCount++;
            }
          } catch { /* skip corrupt */ }
        }
        if (updatedCount === 0) { res.writeHead(404); res.end('Article not found'); return; }

        // Rebuild + git push in background (chained so push happens after rebuild)
        const token = process.env.GIT_TOKEN;
        const pushCmd = token
          ? `git remote set-url origin "https://${token}@github.com/JhoONs117/visual-scroll-blog-.git" && ` +
            `git add output/ output/food/ output/fitness/ frontend/data-agents.js && ` +
            `git diff --cached --quiet || git commit -m "auto: ${status} ${slug}" && ` +
            `git push`
          : 'true';

        spawn('sh', ['-c',
          `cd "${__dirname}" && node scripts/build-data-agents.js && ${pushCmd}`
        ], { detached: true, stdio: 'ignore' }).unref();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, slug, status, updatedFiles: updatedCount }));
      } catch (e) {
        res.writeHead(500); res.end('Error: ' + e.message);
      }
    });
    return;
  }

  /* ── Image proxy for carousel download (bypasses CORS on upstream images) ── */
  if (urlPath === '/proxy-image') {
    let target;
    try {
      target = new URL('http://x' + req.url).searchParams.get('url');
      if (!target) throw new Error('missing url');
      new URL(target); // validate
    } catch {
      res.writeHead(400);
      res.end('Bad request');
      return;
    }
    const mod = target.startsWith('https') ? https : http;
    mod.get(target, { headers: { 'User-Agent': 'Mozilla/5.0' } }, upstream => {
      res.writeHead(upstream.statusCode, {
        'Content-Type':  upstream.headers['content-type'] || 'image/jpeg',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      });
      upstream.pipe(res);
    }).on('error', () => { res.writeHead(502); res.end('Upstream error'); });
    return;
  }

  const filePath = path.join(FRONTEND, urlPath === '/' ? 'index.html' : urlPath);
  const ext = path.extname(filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log(`Server in ascolto su porta ${PORT}`);
});
