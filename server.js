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
            `git diff --cached --quiet || (git commit -m "auto: ${status} ${slug}" && git pull --rebase --autostash origin main && git push)`
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

  /* ── TikTok OAuth callback (temporaneo per generare token) ── */
  if (urlPath === '/tiktok-callback') {
    const qs = new URL('http://x' + req.url).searchParams;
    const code  = qs.get('code') || '';
    const error = qs.get('error') || '';
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    if (error) {
      res.end(`<h2>❌ Errore TikTok: ${error}</h2>`);
    } else {
      res.end(
        `<h2>✅ Codice ottenuto</h2>` +
        `<p>Copia questo codice e usalo nel terminale:</p>` +
        `<pre style="background:#111;color:#0f0;padding:16px;font-size:18px">${code}</pre>` +
        `<p>Poi esegui: <code>node scripts/exchange-tiktok-code.js ${code}</code></p>`
      );
    }
    return;
  }

  /* ── Set render quality: POST /api/set-render-quality ── */
  if (req.method === 'POST' && urlPath === '/api/set-render-quality') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { agent, slug, quality } = JSON.parse(body);
        const validQualities = [null, 'low', 'medium', 'high'];
        if (!validQualities.includes(quality)) { res.writeHead(400); res.end('Invalid quality'); return; }
        const dir = OUTPUT_DIRS[agent];
        if (!dir) { res.writeHead(400); res.end('Unknown agent'); return; }

        const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
        let updated = null;
        let best = null;
        for (const f of files) {
          const base = f.replace('.json', '');
          const idx  = base.indexOf('_');
          const fSlug = idx !== -1 ? base.slice(idx + 1) : base;
          if (fSlug !== slug) continue;
          if (!best || f > best) best = f;
        }
        if (!best) { res.writeHead(404); res.end('Article not found'); return; }

        const fpath   = path.join(dir, best);
        const article = JSON.parse(fs.readFileSync(fpath, 'utf8'));
        article.render_quality = quality;
        // Reset render_status for this quality if quality changed
        if (quality && article.render_status) {
          article.render_status[quality] = null;
          article.render_error = null;
        }
        fs.writeFileSync(fpath, JSON.stringify(article, null, 2) + '\n');

        // Rebuild data-agents.js + git push (same pattern as set-status)
        const token = process.env.GIT_TOKEN;
        const pushCmd = token
          ? `git remote set-url origin "https://${token}@github.com/JhoONs117/visual-scroll-blog-.git" && ` +
            `git add output/ output/food/ output/fitness/ frontend/data-agents.js && ` +
            `git diff --cached --quiet || (git commit -m "auto: quality ${quality} ${slug}" && git pull --rebase --autostash origin main && git push)`
          : 'true';

        spawn('sh', ['-c',
          `cd "${__dirname}" && node scripts/build-data-agents.js && ${pushCmd}`
        ], { detached: true, stdio: 'ignore' }).unref();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, slug, quality }));
      } catch (e) {
        res.writeHead(500); res.end('Error: ' + e.message);
      }
    });
    return;
  }

  /* ── Save carousel PNG to disk: POST /api/save-carousel-png ── */
  if (req.method === 'POST' && urlPath === '/api/save-carousel-png') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { agentId, slug, index, dataUrl } = JSON.parse(body);
        const dir = OUTPUT_DIRS[agentId];
        if (!dir) { res.writeHead(400); res.end('Unknown agent'); return; }
        if (!slug || index === undefined || !dataUrl) { res.writeHead(400); res.end('Missing fields'); return; }

        const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
        const slidesPngDir = path.join(__dirname, 'output', agentId, 'slides-png', slug);
        fs.mkdirSync(slidesPngDir, { recursive: true });
        const filePath = path.join(slidesPngDir, `slide${index}.png`);
        fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));

        // Quando tutte le slide 0-4 sono presenti su disco, pusha su git
        const allPresent = [0,1,2,3,4].every(i =>
          fs.existsSync(path.join(slidesPngDir, `slide${i}.png`))
        );
        if (allPresent) {
          const token = process.env.GIT_TOKEN;
          const pushCmd = token
            ? `git remote set-url origin "https://${token}@github.com/JhoONs117/visual-scroll-blog-.git" && ` +
              `git add output/${agentId}/slides-png/${slug}/ && ` +
              `git diff --cached --quiet || (git commit -m "auto: slide PNG ${slug}" && git pull --rebase --autostash origin main && git push)`
            : 'true';
          spawn('sh', ['-c', `cd "${__dirname}" && ${pushCmd}`],
            { detached: true, stdio: 'ignore' }).unref();
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, path: path.relative(__dirname, filePath) }));
      } catch (e) {
        res.writeHead(500); res.end('Error: ' + e.message);
      }
    });
    return;
  }

  /* ── Serve rendered MP4 videos: GET /renders/:filename ── */
  if (req.method === 'GET' && urlPath.startsWith('/renders/')) {
    const filename = path.basename(urlPath);
    if (!filename.endsWith('.mp4')) { res.writeHead(400); res.end('Only .mp4 allowed'); return; }
    const filePath = path.join(__dirname, 'output', 'renders', filename);
    fs.stat(filePath, (err, stat) => {
      if (err) { res.writeHead(404); res.end('Video not found'); return; }
      const range = req.headers.range;
      if (range) {
        const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
        const start = parseInt(startStr, 10);
        const end   = endStr ? parseInt(endStr, 10) : stat.size - 1;
        res.writeHead(206, {
          'Content-Range':  `bytes ${start}-${end}/${stat.size}`,
          'Accept-Ranges':  'bytes',
          'Content-Length': end - start + 1,
          'Content-Type':   'video/mp4',
        });
        fs.createReadStream(filePath, { start, end }).pipe(res);
      } else {
        res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': stat.size, 'Accept-Ranges': 'bytes' });
        fs.createReadStream(filePath).pipe(res);
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
