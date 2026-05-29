const http    = require('http');
const https   = require('https');
const fs      = require('fs');
const path    = require('path');
const axios   = require('axios');
const { spawn } = require('child_process');

const PORT     = process.env.PORT || 3000;
const FRONTEND = path.join(__dirname, 'frontend');

const OUTPUT_DIRS = {
  'ai-news': path.join(__dirname, 'output'),
  'food':    path.join(__dirname, 'output', 'food'),
  'fitness': path.join(__dirname, 'output', 'fitness'),
};

const GITHUB_OWNER = 'JhoONs117';
const GITHUB_REPO  = 'visual-scroll-blog-';
const GITHUB_DIR   = { 'ai-news': 'output', 'food': 'output/food', 'fitness': 'output/fitness' };

function ghRequest(method, apiPath, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}${apiPath}`,
      method,
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent':    'visual-scroll-blog',
        'Accept':        'application/vnd.github.v3+json',
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };
    const req = https.request(opts, r => {
      let data = '';
      r.on('data', c => { data += c; });
      r.on('end', () => {
        try { resolve({ status: r.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: r.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function githubUpdateArticle(agent, slug, updateFn, token, commitMsg) {
  const dir = GITHUB_DIR[agent];
  if (!dir) throw new Error('Unknown agent');

  const listRes = await ghRequest('GET', `/contents/${dir}`, null, token);
  if (listRes.status !== 200) throw new Error(`List dir failed: ${listRes.status}`);

  const jsonFiles = Array.isArray(listRes.body)
    ? listRes.body.filter(f => f.type === 'file' && f.name.endsWith('.json'))
    : [];

  let bestFile = null;
  for (const f of jsonFiles) {
    const base  = f.name.replace('.json', '');
    const idx   = base.indexOf('_');
    const fSlug = idx !== -1 ? base.slice(idx + 1) : base;
    if (fSlug !== slug) continue;
    if (!bestFile || f.name > bestFile.name) bestFile = f;
  }
  if (!bestFile) throw new Error('Article not found');

  const fileRes = await ghRequest('GET', `/contents/${dir}/${bestFile.name}`, null, token);
  if (fileRes.status !== 200) throw new Error(`Get file failed: ${fileRes.status}`);

  const sha     = fileRes.body.sha;
  const article = JSON.parse(Buffer.from(fileRes.body.content.replace(/\n/g, ''), 'base64').toString('utf8'));

  updateFn(article);

  const newContent = Buffer.from(JSON.stringify(article, null, 2) + '\n').toString('base64');
  const putRes = await ghRequest('PUT', `/contents/${dir}/${bestFile.name}`, { message: commitMsg, content: newContent, sha }, token);
  if (putRes.status !== 200 && putRes.status !== 201) {
    throw new Error(`PUT failed: ${putRes.status} — ${JSON.stringify(putRes.body?.message || '')}`);
  }
  return article;
}

// Aggiorna un articolo in data-agents.js su GitHub via updateFn
// Usa Git Blobs API per leggere il file (>1MB, non leggibile via Contents API)
async function githubUpdateDataAgentsArticle(agent, slug, updateFn, token, commitMsg) {
  const metaRes = await ghRequest('GET', '/contents/frontend/data-agents.js', null, token);
  if (metaRes.status !== 200) throw new Error(`data-agents.js meta failed: ${metaRes.status}`);
  const fileSha = metaRes.body.sha;

  const blobRes = await ghRequest('GET', `/git/blobs/${fileSha}`, null, token);
  if (blobRes.status !== 200) throw new Error(`blob read failed: ${blobRes.status}`);
  const raw = Buffer.from(blobRes.body.content.replace(/\n/g, ''), 'base64').toString('utf8');

  const prefix = 'window.AGENTS = ';
  const prefixIdx = raw.indexOf(prefix);
  if (prefixIdx === -1) throw new Error('data-agents.js format unexpected');
  const jsonStart = prefixIdx + prefix.length;
  const endMarker = raw.indexOf(';\nwindow.', jsonStart);
  const jsonStr = endMarker !== -1 ? raw.slice(jsonStart, endMarker) : raw.slice(jsonStart).replace(/;\s*$/, '');
  const suffix  = endMarker !== -1 ? raw.slice(endMarker) : ';';

  const agents = JSON.parse(jsonStr);
  const list = agents[agent];
  if (list) {
    const art = list.find(a => a.slug === slug);
    if (art) updateFn(art);
  }

  const newRaw = `${prefix}${JSON.stringify(agents, null, 2)}${suffix}`;
  const newContent = Buffer.from(newRaw).toString('base64');
  const putRes = await ghRequest('PUT', '/contents/frontend/data-agents.js', {
    message: commitMsg || `auto: data-agents update ${slug}`,
    content: newContent,
    sha: fileSha,
  }, token);
  if (putRes.status !== 200 && putRes.status !== 201) {
    throw new Error(`data-agents PUT failed: ${putRes.status}`);
  }
}

function githubUpdateDataAgents(agent, slug, status, token) {
  return githubUpdateDataAgentsArticle(agent, slug, art => { art.status = status; }, token, `auto: data-agents status ${status} ${slug}`);
}

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
    req.on('end', async () => {
      try {
        const { agent, slug, status } = JSON.parse(body);
        if (!VALID_STATUSES.includes(status)) { res.writeHead(400); res.end('Invalid status'); return; }
        if (!GITHUB_DIR[agent]) { res.writeHead(400); res.end('Unknown agent'); return; }
        const token = process.env.GIT_TOKEN;
        if (!token) { res.writeHead(500); res.end('GIT_TOKEN not set'); return; }
        // Commit atomico direttamente su GitHub — niente spawn, niente race condition
        await githubUpdateArticle(agent, slug, a => { a.status = status; }, token, `auto: ${status} ${slug}`);
        // Aggiorna anche data-agents.js subito, così dopo il redeploy lo status è già corretto
        githubUpdateDataAgents(agent, slug, status, token).catch(e => console.error('[data-agents update]', e.message));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, slug, status }));
      } catch (e) {
        const code = e.message.includes('not found') ? 404 : 500;
        res.writeHead(code); res.end('Error: ' + e.message);
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

  /* ── Set render template: POST /api/set-render-template ── */
  if (req.method === 'POST' && urlPath === '/api/set-render-template') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { agent, slug, template } = JSON.parse(body);
        const dir = OUTPUT_DIRS[agent];
        if (!dir) { res.writeHead(400); res.end('Unknown agent'); return; }

        const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
        let best = null;
        for (const f of files) {
          const base  = f.replace('.json', '');
          const idx   = base.indexOf('_');
          const fSlug = idx !== -1 ? base.slice(idx + 1) : base;
          if (fSlug !== slug) continue;
          if (!best || f > best) best = f;
        }
        if (!best) { res.writeHead(404); res.end('Article not found'); return; }

        const fpath   = path.join(dir, best);
        const article = JSON.parse(fs.readFileSync(fpath, 'utf8'));
        article.render_template = template;
        article.render_quality  = 'low';
        if (article.render_status) article.render_status[template] = null;
        fs.writeFileSync(fpath, JSON.stringify(article, null, 2) + '\n');

        const token = process.env.GIT_TOKEN;
        const pushCmd = token
          ? `git remote set-url origin "https://${token}@github.com/JhoONs117/visual-scroll-blog-.git" && ` +
            `git add output/ output/food/ output/fitness/ frontend/data-agents.js && ` +
            `git diff --cached --quiet || (git commit -m "auto: template ${template} ${slug}" && git pull --rebase --autostash origin main && git push)`
          : 'true';

        spawn('sh', ['-c',
          `cd "${__dirname}" && node scripts/build-data-agents.js && ${pushCmd}`
        ], { detached: true, stdio: 'ignore' }).unref();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, slug, template }));
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

  /* ── Save video plan JSON: POST /api/save-video-plan ── */
  if (req.method === 'POST' && urlPath === '/api/save-video-plan') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { plan } = JSON.parse(body);
        if (!plan?.slug) { res.writeHead(400); res.end('Missing slug'); return; }
        const dir = path.join(__dirname, 'output', 'video-plans');
        fs.mkdirSync(dir, { recursive: true });
        const filePath = path.join(dir, `video-plan-${plan.slug}.json`);
        fs.writeFileSync(filePath, JSON.stringify(plan, null, 2));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, path: `output/video-plans/video-plan-${plan.slug}.json` }));
      } catch (e) {
        res.writeHead(500); res.end('Error: ' + e.message);
      }
    });
    return;
  }

  /* ── Genera piano video on-demand: POST /api/generate-video-plan ── */
  function extractScenesFromPlan(parsed) {
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.scenes)) return parsed.scenes;
    if (parsed && parsed.plan && Array.isArray(parsed.plan.scenes)) return parsed.plan.scenes;
    throw new Error('Piano video non valido: impossibile trovare scenes[]');
  }
  if (req.method === 'POST' && urlPath === '/api/generate-video-plan') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { agent, slug } = JSON.parse(body);
        if (!GITHUB_DIR[agent]) { res.writeHead(400); res.end('Unknown agent'); return; }
        const token = process.env.GIT_TOKEN;
        if (!token) { res.writeHead(500); res.end('GIT_TOKEN not set'); return; }
        const openaiKey = process.env.OPENAI_API_KEY;
        if (!openaiKey) { res.writeHead(500); res.end('OPENAI_API_KEY not set'); return; }

        // 1. Leggi articolo da GitHub
        const dir = GITHUB_DIR[agent];
        const listRes = await ghRequest('GET', `/contents/${dir}`, null, token);
        if (listRes.status !== 200) throw new Error(`List dir failed: ${listRes.status}`);
        const jsonFiles = Array.isArray(listRes.body)
          ? listRes.body.filter(f => f.type === 'file' && f.name.endsWith('.json'))
          : [];
        let bestFile = null;
        for (const f of jsonFiles) {
          const base  = f.name.replace('.json', '');
          const idx   = base.indexOf('_');
          const fSlug = idx !== -1 ? base.slice(idx + 1) : base;
          if (fSlug !== slug) continue;
          if (!bestFile || f.name > bestFile.name) bestFile = f;
        }
        if (!bestFile) { res.writeHead(404); res.end('Article not found'); return; }
        const fileRes = await ghRequest('GET', `/contents/${dir}/${bestFile.name}`, null, token);
        if (fileRes.status !== 200) throw new Error(`Get file failed: ${fileRes.status}`);
        const sha     = fileRes.body.sha;
        const article = JSON.parse(Buffer.from(fileRes.body.content.replace(/\n/g, ''), 'base64').toString('utf8'));

        // 2. Carica generatePlanPrompt del template (try/catch: template Blender non presenti su Railway)
        const renderTemplate = article.render_template || 'slide_deck';
        const templateFile   = renderTemplate.replace(/_/g, '-');
        let customPrompt = null;
        try { customPrompt = require(`./video/templates/${templateFile}`)?.generatePlanPrompt || null; } catch {}

        // 3. Costruisci prompt
        const userPrompt = customPrompt
          ? customPrompt
              .replace('{{title}}', article.title || '')
              .replace('{{video_script}}', (article.video_script || []).join('\n'))
          : [
              'Genera un piano video di 5 scene per questo articolo.',
              `Titolo: ${article.title}`, `Template: ${renderTemplate}`,
              `Slides: ${(article.slides || []).join(' | ')}`,
              'Rispondi SOLO con JSON valido:',
              JSON.stringify({ scenes: [{ scene: 1, duration_sec: 4, hook: '...', voiceover: '...', on_screen_text: '...', visual_direction: '...', caption: '...' }], cta: '...', quality_score: 0 }, null, 2),
              'Regole: 5 scene, durata totale 18-35s, voiceover max 22 parole, on_screen_text max 9 parole.',
            ].join('\n');

        // 4. Chiama OpenAI
        const openaiRes = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          { model: 'gpt-4o-mini', temperature: 0.7,
            messages: [
              { role: 'system', content: 'Sei un video producer per social verticali. Rispondi SOLO con JSON valido, senza markdown.' },
              { role: 'user',   content: userPrompt },
            ] },
          { headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' }, timeout: 60000 }
        );
        let planData;
        try {
          const raw = openaiRes.data.choices[0].message.content.trim().replace(/```[a-z]*\n?/g, '').trim();
          planData = JSON.parse(raw);
        } catch { throw new Error('OpenAI response not valid JSON'); }
        const scenes = extractScenesFromPlan(planData);
        if (!scenes.length) throw new Error('No scenes in response');

        // 5. Aggiorna scenes nel JSON articolo (sovrascrive quelle precedenti)
        if (!article.formats)       article.formats = {};
        if (!article.formats.video) article.formats.video = {};
        article.formats.video.scenes        = scenes;
        article.formats.video.cta           = planData.cta || '';
        article.formats.video.quality_score = planData.quality_score || 0;
        article.formats.video.template      = renderTemplate;

        // 6. PUT su GitHub
        const newContent = Buffer.from(JSON.stringify(article, null, 2) + '\n').toString('base64');
        const putRes = await ghRequest('PUT', `/contents/${dir}/${bestFile.name}`, {
          message: `auto: video-plan ${renderTemplate} ${slug}`, content: newContent, sha,
        }, token);
        if (putRes.status !== 200 && putRes.status !== 201) throw new Error(`PUT failed: ${putRes.status}`);

        // 7. Aggiorna data-agents.js in background
        githubUpdateDataAgentsArticle(agent, slug, art => {
          if (!art.formats)       art.formats = {};
          if (!art.formats.video) art.formats.video = {};
          art.formats.video.scenes        = scenes;
          art.formats.video.template      = renderTemplate;
        }, token, `auto: data-agents video-plan ${slug}`).catch(e => console.error('[data-agents video-plan]', e.message));

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, slug, template: renderTemplate, scenes }));
      } catch (e) {
        const code = e.message.includes('not found') ? 404 : 500;
        res.writeHead(code); res.end('Error: ' + e.message);
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
