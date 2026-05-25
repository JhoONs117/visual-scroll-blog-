'use strict';

require('dotenv').config();
const fs                      = require('fs');
const path                    = require('path');
const { spawnSync, execSync } = require('child_process');
const axios                   = require('axios');
const { buildBlackClip }      = require('../../core/video-utils');

const ROOT         = path.join(__dirname, '..', '..', '..');
const ASSETS_DIR   = path.join(__dirname, '..', 'assets');
const GEOJSON_PATH = path.join(ASSETS_DIR, 'world-110m.geojson');
const SVG_FPS      = 5;

// ─── TTS via OpenAI ───────────────────────────────────────────────────────────
async function generateTTS(text, outputPath) {
  const res = await axios.post(
    'https://api.openai.com/v1/audio/speech',
    { model: 'tts-1', voice: 'alloy', input: text },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      responseType: 'arraybuffer',
      timeout: 30000,
    }
  );
  fs.writeFileSync(outputPath, Buffer.from(res.data));
}

// ─── Audio duration via ffprobe ───────────────────────────────────────────────
function getAudioDuration(audioPath) {
  const raw = execSync(
    `ffprobe -v quiet -print_format json -show_format "${audioPath}"`,
    { stdio: 'pipe' }
  ).toString();
  return parseFloat(JSON.parse(raw).format?.duration || '5');
}

// ─── Concat clips ─────────────────────────────────────────────────────────────
function concatClips(clipPaths, outputPath) {
  const listFile = outputPath.replace('.mp4', '_list.txt');
  fs.writeFileSync(listFile, clipPaths.map(p => `file '${p}'`).join('\n'));
  const r = spawnSync('ffmpeg', [
    '-f', 'concat', '-safe', '0',
    '-i', listFile,
    '-c:v', 'libx264', '-preset', 'fast',
    '-c:a', 'aac', '-ar', '44100',
    '-y', outputPath,
  ], { stdio: 'pipe' });
  try { fs.unlinkSync(listFile); } catch {}
  if (r.status !== 0)
    throw new Error('concat: ' + (r.stderr?.toString()?.split('\n').slice(-3).join(' ') || 'ffmpeg error'));
}

// ─── SVG → PNG via ImageMagick ────────────────────────────────────────────────
function svgToPng(svgPath, pngPath) {
  const r = spawnSync('convert', [
    '-limit', 'time', '120',
    '-size', '1080x1920', `svg:${svgPath}`, pngPath,
  ], { stdio: 'pipe' });
  if (r.status !== 0)
    throw new Error('SVG→PNG: ' + (r.stderr?.toString()?.slice(-150) || 'error'));
}

// ─── PNG sequence + audio → clip ─────────────────────────────────────────────
function assemblePngClip(framesDir, audioPath, clipPath, dur) {
  const tmpVideo = clipPath.replace('.mp4', '_v.mp4');
  const r1 = spawnSync('ffmpeg', [
    '-y',
    '-framerate', String(SVG_FPS),
    '-i', path.join(framesDir, 'frame_%04d.png'),
    '-t', String(dur + 0.2),
    '-r', '25',
    '-c:v', 'libx264', '-preset', 'fast', '-pix_fmt', 'yuv420p',
    tmpVideo,
  ], { stdio: 'pipe' });
  if (r1.status !== 0)
    throw new Error('png→video: ' + (r1.stderr?.toString()?.split('\n').slice(-3).join(' ') || 'error'));

  const r2 = spawnSync('ffmpeg', [
    '-y', '-i', tmpVideo, '-i', audioPath,
    '-map', '0:v', '-map', '1:a',
    '-c:v', 'copy', '-c:a', 'aac', '-shortest',
    clipPath,
  ], { stdio: 'pipe' });
  try { fs.unlinkSync(tmpVideo); } catch {}
  if (r2.status !== 0)
    throw new Error('merge: ' + (r2.stderr?.toString()?.split('\n').slice(-3).join(' ') || 'error'));
}

// ─── SVG helpers ──────────────────────────────────────────────────────────────
function esc(t) {
  return String(t)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function svgWrap(inner, bg, viewBox) {
  const vb = viewBox || '0 0 1080 1920';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="${vb}"><rect width="1080" height="1920" fill="${bg}"/>${inner}</svg>`;
}

function cleanFramesDir(dir) {
  try {
    for (const f of fs.readdirSync(dir)) try { fs.unlinkSync(path.join(dir, f)); } catch {}
    fs.rmdirSync(dir);
  } catch {}
}

function writeFrame(svgContent, framesDir, frameIdx) {
  const svgPath = path.join(framesDir, `tmp_${frameIdx}.svg`);
  const pngPath = path.join(framesDir, `frame_${String(frameIdx).padStart(4, '0')}.png`);
  fs.writeFileSync(svgPath, svgContent);
  svgToPng(svgPath, pngPath);
  try { fs.unlinkSync(svgPath); } catch {}
}

// ─── GeoJSON + projection ─────────────────────────────────────────────────────
let _geoLoaded = false;
const _pathCache  = {}; // ISO2 → SVG path string
const _centroids  = {}; // ISO2 → [lon, lat]

// Natural Earth 110m has ISO_A2="-99" for a few countries — map via ADM0_A3
const ADM0_TO_ISO2 = { FRA: 'FR', NOR: 'NO', KOS: 'XK' };

// Micro-states absent from 110m scale — injected as small squares [lon, lat]
const MICRO_STATE_COORDS = {
  SG: [103.82, 1.35], HK: [114.17, 22.32],
  LU: [6.13,  49.82], MT: [14.38, 35.90],
  BH: [50.55, 26.02], QA: [51.18, 25.35],
  MO: [113.55, 22.20], BN: [114.73, 4.94],
};

async function ensureGeoJSON() {
  if (_geoLoaded) return;
  if (!fs.existsSync(GEOJSON_PATH)) {
    console.log('  [map-explainer] downloading GeoJSON (~400KB)...');
    fs.mkdirSync(path.dirname(GEOJSON_PATH), { recursive: true });
    const res = await axios.get(
      'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson',
      { timeout: 30000 }
    );
    fs.writeFileSync(GEOJSON_PATH, JSON.stringify(res.data));
    console.log('  [map-explainer] GeoJSON saved.');
  }
  const raw = JSON.parse(fs.readFileSync(GEOJSON_PATH, 'utf8'));
  for (const feat of raw.features) {
    let code = (feat.properties.ISO_A2 || '').toUpperCase();
    if (!code || code.startsWith('-')) {
      const adm = (feat.properties.ADM0_A3 || '').toUpperCase();
      code = ADM0_TO_ISO2[adm] || '';
    }
    if (!code) continue;
    try {
      _pathCache[code] = geometryToPath(feat.geometry);
      _centroids[code] = computeCentroid(feat.geometry);
    } catch {}
  }
  // Inject synthetic square paths for micro-states absent from 110m GeoJSON
  const R = 8;
  for (const [code, [lon, lat]] of Object.entries(MICRO_STATE_COORDS)) {
    if (_pathCache[code]) continue;
    const [cx, cy] = project(lon, lat);
    _pathCache[code] = `M${(cx-R).toFixed(1)},${(cy-R).toFixed(1)}L${(cx+R).toFixed(1)},${(cy-R).toFixed(1)}L${(cx+R).toFixed(1)},${(cy+R).toFixed(1)}L${(cx-R).toFixed(1)},${(cy+R).toFixed(1)}Z`;
    _centroids[code] = [lon, lat];
  }
  _geoLoaded = true;
}

function project(lon, lat) {
  const W      = 1080, H = 1920;
  const x      = (lon + 180) / 360 * W;
  const latC   = Math.max(-85, Math.min(85, lat));
  const latRad = latC * Math.PI / 180;
  const mercN  = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
  const y      = H / 2 - (mercN * H / (2 * Math.PI)) * (H / W);
  return [x, y];
}

function geometryToPath(geom) {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  let d = '';
  for (const poly of polys) {
    for (const ring of poly) {
      if (ring.length < 3) continue;
      let started = false;
      for (const [lon, lat] of ring) {
        const [x, y] = project(lon, lat);
        if (!isFinite(x) || !isFinite(y)) continue;
        d += started ? `L${x.toFixed(1)},${y.toFixed(1)}` : `M${x.toFixed(1)},${y.toFixed(1)}`;
        started = true;
      }
      if (started) d += 'Z';
    }
  }
  return d;
}

function computeCentroid(geom) {
  // Use largest polygon (by vertex count) to handle countries with overseas territories
  // e.g. France: Natural Earth puts French Guiana first but metro France has more vertices
  let ring;
  if (geom.type === 'Polygon') {
    ring = geom.coordinates[0];
  } else {
    ring = null;
    for (const poly of geom.coordinates) {
      if (!ring || poly[0].length > ring.length) ring = poly[0];
    }
  }
  if (!ring || ring.length === 0) return [0, 0];
  let lonSum = 0, latSum = 0;
  for (const [lon, lat] of ring) { lonSum += lon; latSum += lat; }
  return [lonSum / ring.length, latSum / ring.length];
}

// ─── ViewBox proximity check (filters out-of-frame countries) ────────────────
function isNearViewBox(code, vx, vy, vw, vh) {
  if (vx === 0 && vy === 0 && vw >= 1080) return true; // world: include all
  const cen = _centroids[code];
  if (!cen) return false;
  const [cx, cy] = project(cen[0], cen[1]);
  const mx = vw * 0.25;
  const my = vh * 0.25;
  return cx >= vx - mx && cx <= vx + vw + mx &&
         cy >= vy - my && cy <= vy + vh + my;
}

// ─── ViewBox regions ──────────────────────────────────────────────────────────
// All zoom viewBoxes use exact 9:16 aspect ratio (vw * 16/9 = vh)
const VIEWBOXES = {
  world:          '0 0 1080 1920',
  europe:         '452 205 220 391',   // lon -29°W→44°E, lat 37°N→62°N
  east_asia:      '774 530 252 448',   // lon 78°E→158°E, lat -2°N→45°N (includes SG)
  north_america:  '0 150 500 889',     // lon -180°W→-13°W, lat -8°N→68°N
  asia:           '550 150 500 889',   // lon 3°E→169°E, lat -8°N→68°N
};

// ─── Country type colors ──────────────────────────────────────────────────────
const TYPE_COLORS = {
  highlight:   null,      // → accent
  origin:      '#22c55e',
  destination: '#ef4444',
};

// ─── Route colors ─────────────────────────────────────────────────────────────
const ROUTE_COLORS = {
  data:    '#3b82f6',
  product: '#f97316',
  money:   '#22c55e',
};

// ─── Map frame generator ──────────────────────────────────────────────────────
function renderMapFrames(scene, palette, framesDir, nFrames) {
  const bg     = '#0f172a';
  const txt    = palette.text   || '#f8fafc';
  const accent = palette.accent || '#3b82f6';

  const countries  = scene.countries  || [];
  const routes     = scene.routes     || [];
  const sceneTitle = scene.scene_title || '';
  const viewBox    = VIEWBOXES[scene.zoom_region] || '0 0 1080 1920';

  const [vx, vy, vw, vh] = viewBox.split(' ').map(Number);
  const titleFS  = Math.max(18, Math.round(52  * vw / 1080));
  const labelFS  = Math.max(10, Math.round(28  * vw / 1080));
  const strokeW  = Math.max(0.5, (vw / 1080));

  // Build highlighted codes map
  const hlMap = {};
  for (const c of countries) hlMap[c.code.toUpperCase()] = c;

  // Pre-build base map — skip countries whose centroid is far outside the viewBox
  let basePaths = '';
  for (const [code, d] of Object.entries(_pathCache)) {
    if (!hlMap[code] && isNearViewBox(code, vx, vy, vw, vh)) {
      basePaths += `<path d="${d}" fill="#1e293b" stroke="#0f172a" stroke-width="${strokeW.toFixed(2)}"/>`;
    }
  }

  const nC        = countries.length;
  const fadeF     = Math.max(1, Math.round(SVG_FPS * 0.4));
  const revEnd    = Math.floor(nFrames * 0.60);
  const routeAt   = Math.floor(nFrames * 0.50);
  const nR        = routes.length;

  for (let f = 0; f < nFrames; f++) {
    let inner = basePaths;

    // Highlighted countries
    for (let ci = 0; ci < nC; ci++) {
      const c    = countries[ci];
      const code = c.code.toUpperCase();
      const d    = _pathCache[code];
      if (!d) continue;

      const revAt = nC > 1 ? Math.floor(ci * revEnd / nC) : 0;
      const op    = Math.min(1, Math.max(0, (f - revAt) / fadeF));
      if (op <= 0) continue;

      const fill = c.type === 'highlight' ? accent : (TYPE_COLORS[c.type] || accent);
      inner += `<path d="${d}" fill="${fill}" opacity="${op.toFixed(2)}" stroke="${fill}" stroke-width="${strokeW.toFixed(2)}"/>`;
    }

    // Country labels
    for (let ci = 0; ci < nC; ci++) {
      const c    = countries[ci];
      const code = c.code.toUpperCase();
      const cen  = _centroids[code];
      if (!cen) continue;

      const revAt = nC > 1 ? Math.floor(ci * revEnd / nC) : 0;
      const op    = Math.min(1, Math.max(0, (f - revAt) / fadeF));
      if (op <= 0.05) continue;

      const [cx, cy]  = project(cen[0], cen[1]);
      const fill = c.type === 'highlight' ? accent : (TYPE_COLORS[c.type] || accent);
      inner += `<text x="${cx.toFixed(1)}" y="${(cy - 12).toFixed(1)}" text-anchor="middle" fill="white" font-size="${labelFS}" font-family="sans-serif" font-weight="bold" opacity="${op.toFixed(2)}">${esc(c.label || code)}</text>`;
    }

    // Routes
    for (let ri = 0; ri < nR; ri++) {
      const route = routes[ri];
      const fromCen = _centroids[route.from.toUpperCase()];
      const toCen   = _centroids[route.to.toUpperCase()];
      if (!fromCen || !toCen) continue;

      const revAt = routeAt + (nR > 1 ? Math.floor(ri * (nFrames - routeAt) / nR) : 0);
      const op    = Math.min(1, Math.max(0, (f - revAt) / (fadeF * 2)));
      if (op <= 0) continue;

      const [x1, y1] = project(fromCen[0], fromCen[1]);
      const [x2, y2] = project(toCen[0],   toCen[1]);
      const color    = ROUTE_COLORS[route.type] || accent;
      const dash     = route.type === 'product' ? '' : ` stroke-dasharray="16,8"`;

      inner += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="5"${dash} opacity="${op.toFixed(2)}"/>`;

      // Arrowhead at destination
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 10) {
        const ux = dx / len, uy = dy / len, sz = 22;
        const ax = x2 - ux * sz, ay = y2 - uy * sz;
        const px = -uy * sz * 0.45, py = ux * sz * 0.45;
        inner += `<polygon points="${x2.toFixed(1)},${y2.toFixed(1)} ${(ax + px).toFixed(1)},${(ay + py).toFixed(1)} ${(ax - px).toFixed(1)},${(ay - py).toFixed(1)}" fill="${color}" opacity="${op.toFixed(2)}"/>`;
      }
    }

    // Scene title (inside viewBox)
    const tx = (vx + vw / 2).toFixed(1);
    const ty = (vy + vh * 0.07 + titleFS).toFixed(1);
    inner += `<text x="${tx}" y="${ty}" text-anchor="middle" fill="${txt}" font-size="${titleFS}" font-weight="bold" font-family="sans-serif">${esc(sceneTitle)}</text>`;

    writeFrame(svgWrap(inner, bg, viewBox), framesDir, f);
  }
}

// ─── Fallback frames ──────────────────────────────────────────────────────────
function renderFallbackFrames(scene, palette, framesDir, nFrames) {
  const bg  = '#0f172a';
  const txt = palette.text || '#f8fafc';
  for (let f = 0; f < nFrames; f++) {
    const inner = `<text x="540" y="960" fill="${txt}" font-size="60" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif">${esc(scene.scene_title || 'Map')}</text>`;
    writeFrame(svgWrap(inner, bg), framesDir, f);
  }
}

// ─── Render one scene → clip ──────────────────────────────────────────────────
async function renderScene(i, scene, palette, audioPath, clipPath, framesBaseDir) {
  await generateTTS(scene.voiceover, audioPath);
  const dur = getAudioDuration(audioPath);

  const nFrames   = Math.max(2, Math.ceil(dur * SVG_FPS));
  const framesDir = path.join(framesBaseDir, `me${i}`);
  fs.mkdirSync(framesDir, { recursive: true });

  try {
    if (_geoLoaded && Object.keys(_pathCache).length > 0) {
      renderMapFrames(scene, palette, framesDir, nFrames);
    } else {
      renderFallbackFrames(scene, palette, framesDir, nFrames);
    }
    assemblePngClip(framesDir, audioPath, clipPath, dur);
  } finally {
    cleanFramesDir(framesDir);
  }
}

// ─── generatePlanPrompt ───────────────────────────────────────────────────────
const generatePlanPrompt = `
Articolo: {{title}}
Testo: {{video_script}}

Genera 5 scene per un video map-explainer in verticale 9:16.
Per ogni scena restituisci JSON con:
  - voiceover: (stringa, max 22 parole, narrazione TTS)
  - duration_sec: (intero 5-8)
  - countries: (array di { code: string ISO2, label: string, type: "highlight"|"origin"|"destination" })
  - routes: (array di { from: string ISO2, to: string ISO2, type: "data"|"product"|"money" })
  - zoom_region: ("world" | "europe" | "asia" | "north_america" | "east_asia")
  - scene_title: (stringa, max 5 parole)

Usa paesi/regioni reali relativi al contenuto dell'articolo.
Codici ISO2 comuni: US=USA, CN=China, DE=Germany, FR=France, GB=UK, JP=Japan,
KR=South Korea, IN=India, RU=Russia, BR=Brazil, SG=Singapore, CA=Canada,
AU=Australia, NL=Netherlands, SE=Sweden, IT=Italy.

Rispondi SOLO con un oggetto JSON valido, senza markdown, senza backtick:
${JSON.stringify({
  scenes: [{
    scene: 1,
    duration_sec: 6,
    voiceover: '...',
    countries: [
      { code: 'US', label: 'USA', type: 'highlight' },
      { code: 'CN', label: 'Cina', type: 'destination' },
    ],
    routes: [
      { from: 'US', to: 'CN', type: 'data' },
    ],
    zoom_region: 'world',
    scene_title: 'Titolo scena',
  }],
  cta: '...',
  quality_score: 0,
}, null, 2)}

Regole:
- esattamente 5 scene
- durata totale tra 25 e 40 secondi
- ogni voiceover: max 22 parole
- quality_score: intero 0-100
`.trim();

// ─── Entry point ──────────────────────────────────────────────────────────────
async function render(article, scenes, agentConfig, outputPath) {
  try {
    outputPath = path.resolve(outputPath);
    const slug      = article.slug || 'map-explainer';
    const rendDir   = path.dirname(outputPath);
    const clipsDir  = path.join(rendDir, 'clips');
    const audioDir  = path.join(rendDir, 'audio');
    const framesDir = path.join(rendDir, 'me-frames');

    fs.mkdirSync(rendDir,   { recursive: true });
    fs.mkdirSync(clipsDir,  { recursive: true });
    fs.mkdirSync(audioDir,  { recursive: true });
    fs.mkdirSync(framesDir, { recursive: true });

    await ensureGeoJSON();

    const palette   = agentConfig.videoPalette || {};
    const clipPaths = [];

    for (let i = 0; i < scenes.length; i++) {
      const scene     = scenes[i];
      const audioPath = path.join(audioDir, `${slug}_me${i}.mp3`);
      const clipPath  = path.join(clipsDir, `${slug}_me${i}.mp4`);

      console.log(`  scena ${i + 1}/${scenes.length}...`);

      try {
        await renderScene(i, scene, palette, audioPath, clipPath, framesDir);
        clipPaths.push(clipPath);
      } catch (e) {
        console.warn(`  ⚠️  scena ${i + 1} fallita: ${e.message.slice(0, 100)}`);
        console.warn('      → black clip fallback');
        try {
          await buildBlackClip(clipPath, scene.duration_sec || 6);
          clipPaths.push(clipPath);
        } catch (fe) {
          console.warn(`  ⚠️  black clip fallita: ${fe.message.slice(0, 80)}`);
        }
      }
    }

    if (clipPaths.length === 0) throw new Error('nessuna clip generata');

    console.log('  [map-explainer] concatenazione...');
    concatClips(clipPaths, outputPath);

    // Cleanup
    for (const cp of clipPaths) try { fs.unlinkSync(cp); } catch {}
    try { fs.rmdirSync(clipsDir); } catch {}
    try { fs.rmdirSync(framesDir); } catch {}

    console.log(`✅ map-explainer → ${path.relative(ROOT, outputPath)}`);
  } catch (e) {
    return Promise.reject(new Error(`map-explainer render fallito: ${e.message}`));
  }
}

module.exports = {
  id:                  'map_explainer',
  label:               'Map',
  requiresCarouselPng: false,
  generatePlanPrompt,
  render,
};
