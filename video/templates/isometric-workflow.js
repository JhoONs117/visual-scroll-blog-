'use strict';

require('dotenv').config();
const fs                      = require('fs');
const path                    = require('path');
const { spawnSync, execSync } = require('child_process');
const axios                   = require('axios');
const { buildBlackClip }      = require('../../core/video-utils');

const ROOT    = path.join(__dirname, '..', '..', '..');
const SVG_FPS = 5; // unique SVG frames per second

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

// ─── Durata audio via ffprobe ─────────────────────────────────────────────────
function getAudioDuration(audioPath) {
  const raw = execSync(
    `ffprobe -v quiet -print_format json -show_format "${audioPath}"`,
    { stdio: 'pipe' }
  ).toString();
  return parseFloat(JSON.parse(raw).format?.duration || '5');
}

// ─── Concat clip mp4 ──────────────────────────────────────────────────────────
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

// ─── SVG → PNG via ImageMagick ───────────────────────────────────────────────
function svgToPng(svgPath, pngPath) {
  const r = spawnSync('convert', [
    '-size', '1080x1920', `svg:${svgPath}`, pngPath,
  ], { stdio: 'pipe' });
  if (r.status !== 0)
    throw new Error('SVG→PNG: ' + (r.stderr?.toString()?.slice(-150) || 'error'));
}

// ─── Merge PNG sequence + audio → clip ────────────────────────────────────────
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

function svgWrap(inner, bg) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><rect width="1080" height="1920" fill="${bg}"/>${inner}</svg>`;
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

// ─── Isometric projection ─────────────────────────────────────────────────────
function isoToScreen(col, row, tileW = 220, tileH = 110, offsetX = 540, offsetY = 500) {
  return {
    x: offsetX + (col - row) * tileW / 2,
    y: offsetY + (col + row) * tileH / 4,
  };
}

// ─── Block colors by type ─────────────────────────────────────────────────────
const BLOCK_COLORS = {
  input:    { top: '#629bf8', left: '#3b82f6', right: '#1d4ed8' },
  process:  { top: '#8b8ef5', left: '#6366f1', right: '#4338ca' },
  output:   { top: '#4bde7e', left: '#22c55e', right: '#15803d' },
  database: { top: '#fbb843', left: '#f59e0b', right: '#b45309' },
  user:     { top: '#f089be', left: '#ec4899', right: '#9d174d' },
};

function getColors(type, isFocus) {
  const base = BLOCK_COLORS[type] || BLOCK_COLORS['process'];
  if (!isFocus) return base;
  const lighten = hex => {
    const n = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, ((n >> 16) & 0xff) + 60);
    const g = Math.min(255, ((n >> 8)  & 0xff) + 60);
    const b = Math.min(255, ( n        & 0xff)  + 60);
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  };
  return { top: lighten(base.top), left: lighten(base.left), right: lighten(base.right) };
}

// ─── Isometric block SVG ──────────────────────────────────────────────────────
function isoBlock(col, row, colors, label, opacity, isFocus) {
  const { x, y } = isoToScreen(col, row);
  const w = 110, h = 55;  // metà tile
  // top face: parallelogramma
  const topPoints   = `${x},${y - h} ${x + w},${y - h / 2} ${x},${y} ${x - w},${y - h / 2}`;
  // left face
  const leftPoints  = `${x - w},${y - h / 2} ${x},${y} ${x},${y + h} ${x - w},${y + h / 2}`;
  // right face
  const rightPoints = `${x},${y} ${x + w},${y - h / 2} ${x + w},${y + h / 2} ${x},${y + h}`;

  const strokeAttr = isFocus ? ' stroke="white" stroke-width="3"' : '';
  const op = Math.max(0, Math.min(1, opacity)).toFixed(2);

  return `
    <g opacity="${op}">
      <polygon points="${topPoints}" fill="${colors.top}"${strokeAttr}/>
      <polygon points="${leftPoints}" fill="${colors.left}"${strokeAttr}/>
      <polygon points="${rightPoints}" fill="${colors.right}"${strokeAttr}/>
      <text x="${x}" y="${y - h - 15}" text-anchor="middle" fill="white" font-size="36" font-family="sans-serif">${esc(label)}</text>
    </g>`;
}

// ─── Connection arrow SVG ─────────────────────────────────────────────────────
function drawConnection(fromBlock, toBlock, label, opacity, accent) {
  const from = isoToScreen(fromBlock.iso_col, fromBlock.iso_row);
  const to   = isoToScreen(toBlock.iso_col,   toBlock.iso_row);
  const h    = 55;

  // Connect from top apex of source block to top apex of target block
  const x1 = from.x;
  const y1 = from.y - h;
  const x2 = to.x;
  const y2 = to.y - h;

  const dx  = x2 - x1;
  const dy  = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 10) return '';

  const ux = dx / len;
  const uy = dy / len;
  const sz = 22;

  // Arrowhead polygon
  const ax = x2 - ux * sz;
  const ay = y2 - uy * sz;
  const px = -uy * sz * 0.45;
  const py =  ux * sz * 0.45;
  const arrowPts = [
    `${x2.toFixed(1)},${y2.toFixed(1)}`,
    `${(ax + px).toFixed(1)},${(ay + py).toFixed(1)}`,
    `${(ax - px).toFixed(1)},${(ay - py).toFixed(1)}`,
  ].join(' ');

  const op = Math.max(0, Math.min(1, opacity)).toFixed(2);

  let out = `
    <g opacity="${op}">
      <line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${accent}" stroke-width="4" stroke-dasharray="12,6"/>
      <polygon points="${arrowPts}" fill="${accent}"/>`;

  if (label) {
    const mx = ((x1 + x2) / 2).toFixed(1);
    const my = ((y1 + y2) / 2 - 16).toFixed(1);
    out += `\n      <text x="${mx}" y="${my}" text-anchor="middle" fill="${accent}" font-size="28" font-family="sans-serif">${esc(label)}</text>`;
  }

  out += '\n    </g>';
  return out;
}

// ─── Fallback frames ─────────────────────────────────────────────────────────
function renderFallbackFrames(scene, palette, framesDir, nFrames) {
  const bg  = palette.bg   || '#0f172a';
  const txt = palette.text || '#f8fafc';
  const title = scene.scene_title || '';
  for (let f = 0; f < nFrames; f++) {
    const inner = `<text x="540" y="960" fill="${txt}" font-size="72" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif">${esc(title)}</text>`;
    writeFrame(svgWrap(inner, bg), framesDir, f);
  }
}

// ─── Main frame generator ─────────────────────────────────────────────────────
function renderIsoFrames(scene, palette, framesDir, nFrames) {
  const bg     = palette.bg     || '#0f172a';
  const txt    = palette.text   || '#f8fafc';
  const accent = palette.accent || '#3b82f6';

  const blocks      = (scene.blocks || []).slice(0, 5);
  const connections = scene.connections || [];
  const focusId     = scene.focus_block || '';
  const sceneTitle  = scene.scene_title  || '';

  if (blocks.length === 0) {
    renderFallbackFrames(scene, palette, framesDir, nFrames);
    return;
  }

  // Map id → block with index
  const blockMap = {};
  blocks.forEach((b, i) => { blockMap[b.id] = { ...b, _idx: i }; });

  const fadeFrames = Math.max(1, Math.round(SVG_FPS * 0.5));
  const nB = blocks.length;

  for (let f = 0; f < nFrames; f++) {
    let inner = '';

    // Scene title
    inner += `<text x="540" y="160" fill="${txt}" font-size="56" font-weight="bold" text-anchor="middle" font-family="sans-serif">${esc(sceneTitle)}</text>`;

    // Subtle grid lines (floor reference)
    inner += `<line x1="0" y1="580" x2="1080" y2="580" stroke="${txt}" stroke-width="1" opacity="0.06"/>`;

    // Connections (drawn before blocks so they appear behind)
    for (const conn of connections) {
      const fromB = blockMap[conn.from];
      const toB   = blockMap[conn.to];
      if (!fromB || !toB) continue;

      const laterIdx   = Math.max(fromB._idx, toB._idx);
      const revealAt   = Math.floor(laterIdx * nFrames / nB);
      const connOpacity = Math.min(1, Math.max(0, (f - revealAt) / fadeFrames));

      if (connOpacity > 0) {
        inner += drawConnection(fromB, toB, conn.label || '', connOpacity, accent);
      }
    }

    // Blocks (drawn in order; later blocks render on top)
    for (let bi = 0; bi < blocks.length; bi++) {
      const block      = blocks[bi];
      const revealAt   = Math.floor(bi * nFrames / nB);
      const blockOpacity = Math.min(1, Math.max(0, (f - revealAt) / fadeFrames));

      if (blockOpacity <= 0) continue;

      const isFocus = block.id === focusId;
      const colors  = getColors(block.type, isFocus);
      inner += isoBlock(block.iso_col, block.iso_row, colors, block.label, blockOpacity, isFocus);
    }

    // Type legend in bottom-left corner (fade in after all blocks visible)
    const allReveal = Math.floor((nB - 1) * nFrames / nB) + fadeFrames;
    const legendOp  = Math.min(1, Math.max(0, (f - allReveal) / fadeFrames)).toFixed(2);
    if (parseFloat(legendOp) > 0) {
      inner += `<text x="60" y="1820" fill="${txt}" font-size="30" font-family="sans-serif" opacity="${legendOp}">▶ ${esc(sceneTitle)}</text>`;
    }

    writeFrame(svgWrap(inner, bg), framesDir, f);
  }
}

// ─── Render one scene → clip ──────────────────────────────────────────────────
async function renderScene(i, scene, palette, audioPath, clipPath, framesBaseDir) {
  await generateTTS(scene.voiceover, audioPath);
  const dur = getAudioDuration(audioPath);

  const nFrames   = Math.max(2, Math.ceil(dur * SVG_FPS));
  const framesDir = path.join(framesBaseDir, `iw${i}`);
  fs.mkdirSync(framesDir, { recursive: true });

  try {
    renderIsoFrames(scene, palette, framesDir, nFrames);
    assemblePngClip(framesDir, audioPath, clipPath, dur);
  } finally {
    cleanFramesDir(framesDir);
  }
}

// ─── generatePlanPrompt ───────────────────────────────────────────────────────
const generatePlanPrompt = `
Articolo: {{title}}
Testo: {{video_script}}

Genera 5 scene per un video isometric-workflow in verticale 9:16.
Per ogni scena restituisci JSON con:
  - voiceover: (stringa, max 22 parole, narrazione TTS)
  - duration_sec: (intero 6-9)
  - blocks: (array di 2-5 blocchi, ognuno con:
      id: stringa identificativa unica
      label: stringa, max 3 parole
      type: "input" | "process" | "output" | "database" | "user"
      iso_col: intero 0-3
      iso_row: intero 0-3
    )
  - connections: (array di { from: id, to: id, label?: stringa max 2 parole })
  - scene_title: (stringa, max 5 parole)
  - focus_block: (id del blocco principale della scena)

Usa blocchi che si distribuiscono su tutta la griglia iso (evita posizioni troppo vicine).
Ogni scena deve mostrare un passo distinto del workflow dell'articolo.

Rispondi SOLO con un oggetto JSON valido, senza markdown, senza backtick:
${JSON.stringify({
  scenes: [{
    scene: 1,
    duration_sec: 6,
    voiceover: '...',
    blocks: [
      { id: 'input', label: 'Input', type: 'input', iso_col: 2, iso_row: 0 },
      { id: 'proc',  label: 'Processo', type: 'process', iso_col: 0, iso_row: 2 },
    ],
    connections: [{ from: 'input', to: 'proc', label: 'elabora' }],
    scene_title: 'Titolo scena',
    focus_block: 'proc',
  }],
  cta: '...',
  quality_score: 0,
}, null, 2)}

Regole:
- esattamente 5 scene
- durata totale tra 25 e 40 secondi
- ogni voiceover: max 22 parole
- iso_col e iso_row: interi tra 0 e 3 (non usare valori fuori range)
- quality_score: intero 0-100
`.trim();

// ─── Entry point ──────────────────────────────────────────────────────────────
async function render(article, scenes, agentConfig, outputPath) {
  try {
    outputPath = path.resolve(outputPath);
    const slug      = article.slug || 'isometric-workflow';
    const rendDir   = path.dirname(outputPath);
    const clipsDir  = path.join(rendDir, 'clips');
    const audioDir  = path.join(rendDir, 'audio');
    const framesDir = path.join(rendDir, 'iw-frames');

    fs.mkdirSync(rendDir,   { recursive: true });
    fs.mkdirSync(clipsDir,  { recursive: true });
    fs.mkdirSync(audioDir,  { recursive: true });
    fs.mkdirSync(framesDir, { recursive: true });

    const palette   = agentConfig.videoPalette || {};
    const clipPaths = [];

    for (let i = 0; i < scenes.length; i++) {
      const scene     = scenes[i];
      const audioPath = path.join(audioDir, `${slug}_iw${i}.mp3`);
      const clipPath  = path.join(clipsDir, `${slug}_iw${i}.mp4`);

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

    console.log('  [isometric-workflow] concatenazione...');
    concatClips(clipPaths, outputPath);

    // Cleanup
    for (const cp of clipPaths) try { fs.unlinkSync(cp); } catch {}
    try { fs.rmdirSync(clipsDir); } catch {}
    try { fs.rmdirSync(framesDir); } catch {}

    console.log(`✅ isometric-workflow → ${path.relative(ROOT, outputPath)}`);
  } catch (e) {
    return Promise.reject(new Error(`isometric-workflow render fallito: ${e.message}`));
  }
}

module.exports = {
  id:                  'isometric_workflow',
  label:               'Isometric',
  requiresCarouselPng: false,
  generatePlanPrompt,
  render,
};
