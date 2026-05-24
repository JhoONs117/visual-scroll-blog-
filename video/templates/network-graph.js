'use strict';

require('dotenv').config();
const fs                      = require('fs');
const path                    = require('path');
const { spawnSync, execSync } = require('child_process');
const axios                   = require('axios');
const { buildBlackClip }      = require('../../core/video-utils');

const SVG_FPS = 5;

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

// ─── Duration via ffprobe ─────────────────────────────────────────────────────
function getAudioDuration(audioPath) {
  const raw = execSync(
    `ffprobe -v quiet -print_format json -show_format "${audioPath}"`,
    { stdio: 'pipe' }
  ).toString();
  return parseFloat(JSON.parse(raw).format?.duration || '4');
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

// ─── SVG → PNG via FFmpeg (librsvg) ───────────────────────────────────────────
function svgToPng(svgPath, pngPath) {
  const r = spawnSync('ffmpeg', [
    '-y', '-i', svgPath,
    '-f', 'image2pipe', '-vcodec', 'png', '-',
  ], { stdio: 'pipe' });
  if (r.status !== 0 || !r.stdout?.length)
    throw new Error('SVG→PNG: ' + (r.stderr?.toString()?.slice(-150) || 'error'));
  fs.writeFileSync(pngPath, r.stdout);
}

// ─── PNG sequence + audio → clip ──────────────────────────────────────────────
function assemblePngClip(framesDir, audioPath, clipPath, dur) {
  const tmpVideo = clipPath.replace('.mp4', '_v.mp4');
  const r1 = spawnSync('ffmpeg', [
    '-y', '-framerate', String(SVG_FPS),
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

// ─── Generic helpers ──────────────────────────────────────────────────────────
function esc(t) {
  return String(t)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function writeFrame(svgContent, framesDir, frameIdx) {
  const svgPath = path.join(framesDir, `tmp_${frameIdx}.svg`);
  const pngPath = path.join(framesDir, `frame_${String(frameIdx).padStart(4, '0')}.png`);
  fs.writeFileSync(svgPath, svgContent);
  svgToPng(svgPath, pngPath);
  try { fs.unlinkSync(svgPath); } catch {}
}

function cleanFramesDir(dir) {
  try {
    for (const f of fs.readdirSync(dir)) try { fs.unlinkSync(path.join(dir, f)); } catch {}
    fs.rmdirSync(dir);
  } catch {}
}

// ─── Node geometry & rendering ────────────────────────────────────────────────

// Approximate trim radius per node type (used to stop edge lines at node boundary)
const NODE_TRIM = { input: 44, output: 44, agent: 56, process: 56, tool: 44 };

function hexagonPoints(cx, cy, r) {
  // Pointy-top hexagon: vertices at -30°, 30°, 90°, 150°, 210°, 270°
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
}

function nodeColor(type, accent) {
  switch (type) {
    case 'input':   return accent;
    case 'output':  return '#22c55e';
    case 'agent':   return accent;
    case 'process': return '#334155';
    case 'tool':    return '#475569';
    default:        return accent;
  }
}

function renderNodeSvg(node, opacity, palette) {
  const { x, y, type, label } = node;
  const accent = palette.accent || '#3b82f6';
  const txt    = palette.text   || '#f8fafc';
  const col    = nodeColor(type, accent);
  const op     = opacity.toFixed(2);
  let shape;

  switch (type) {
    case 'agent':
      shape = `<polygon points="${hexagonPoints(x, y, 52)}" fill="${col}" opacity="${op}"/>`;
      break;
    case 'process':
      // Wide rect, rx=12 as specified
      shape = `<rect x="${x - 90}" y="${y - 42}" width="180" height="84" rx="12" ry="12" fill="${col}" opacity="${op}"/>`;
      break;
    case 'tool':
      // Square rect
      shape = `<rect x="${x - 42}" y="${y - 42}" width="84" height="84" rx="8" ry="8" fill="${col}" opacity="${op}"/>`;
      break;
    default: // input, output
      shape = `<circle cx="${x}" cy="${y}" r="42" fill="${col}" opacity="${op}"/>`;
  }

  const labelSvg = `<text x="${x}" y="${y}" fill="${txt}" font-size="32" font-family="sans-serif" text-anchor="middle" dominant-baseline="middle" opacity="${op}">${esc(label || '')}</text>`;
  return shape + labelSvg;
}

// ─── Edge rendering ───────────────────────────────────────────────────────────

function trimLine(x1, y1, x2, y2, r1, r2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < r1 + r2 + 10) return null;
  const ux = dx / len, uy = dy / len;
  return {
    // Start at source node boundary
    x1: x1 + ux * r1, y1: y1 + uy * r1,
    // End 2px inside dest boundary so arrowhead tip lands exactly at boundary
    x2: x2 - ux * (r2 + 2), y2: y2 - uy * (r2 + 2),
  };
}

function renderEdgeSvg(edge, nodesMap, opacity, accent) {
  const src = nodesMap[edge.from];
  const dst = nodesMap[edge.to];
  if (!src || !dst) return '';

  const op  = opacity.toFixed(2);
  const r1  = NODE_TRIM[src.type] || 44;
  const r2  = NODE_TRIM[dst.type] || 44;
  const pts = trimLine(src.x, src.y, dst.x, dst.y, r1, r2);
  if (!pts) return '';

  let svg = `<line x1="${pts.x1.toFixed(1)}" y1="${pts.y1.toFixed(1)}" x2="${pts.x2.toFixed(1)}" y2="${pts.y2.toFixed(1)}" stroke="${accent}" stroke-width="3" marker-end="url(#arrow)" opacity="${op}"/>`;

  if (edge.label) {
    const mx = ((pts.x1 + pts.x2) / 2).toFixed(1);
    const my = ((pts.y1 + pts.y2) / 2).toFixed(1);
    svg += `<text x="${mx}" y="${my}" fill="${accent}" font-size="28" font-family="sans-serif" text-anchor="middle" dominant-baseline="middle" opacity="${op}">${esc(edge.label)}</text>`;
  }

  return svg;
}

// ─── Network graph frames ─────────────────────────────────────────────────────
function renderNetworkFrames(scene, palette, framesDir, nFrames) {
  const bg     = palette.bg     || '#0f172a';
  const txt    = palette.text   || '#f8fafc';
  const accent = palette.accent || '#3b82f6';

  const nodes       = scene.nodes        || [];
  const edges       = scene.edges        || [];
  const revealOrder = scene.reveal_order || nodes.map(n => n.id);
  const title       = scene.scene_title  || '';

  const nodesMap = {};
  nodes.forEach(n => { nodesMap[n.id] = n; });

  // revealFrame[id] = index_in_reveal_order × (totalFrames / nNodes)
  // formula from spec: opacity = clamp((f - revealFrame) / fadeFrames, 0, 1)
  const nNodes     = Math.max(1, revealOrder.length);
  const fadeFrames = Math.max(2, Math.floor(nFrames * 0.22));

  const revealFrames = {};
  revealOrder.forEach((id, i) => {
    revealFrames[id] = Math.floor(i * (nFrames / nNodes));
  });
  // Any node not in reveal_order appears after all listed nodes
  nodes.forEach(n => {
    if (!(n.id in revealFrames)) revealFrames[n.id] = nFrames - fadeFrames;
  });

  // Edge appears after both endpoints are mostly visible (60% of fadeFrames into both reveals)
  const edgeRevealFrames = edges.map(e => {
    const srcF = revealFrames[e.from] ?? 0;
    const dstF = revealFrames[e.to]   ?? 0;
    return Math.max(srcF, dstF) + Math.floor(fadeFrames * 0.6);
  });

  // Frame at which all nodes are fully revealed — pulse starts here
  const allRevealedFrame = Math.max(0, ...Object.values(revealFrames)) + fadeFrames;

  for (let f = 0; f < nFrames; f++) {
    // Arrowhead marker: markerUnits=userSpaceOnUse gives 20×14 px arrowhead
    // refX=18 positions the tip (at x=20) exactly at the line endpoint +2px
    const arrowDef = `<defs><marker id="arrow" markerWidth="20" markerHeight="14" refX="18" refY="7" orient="auto" markerUnits="userSpaceOnUse"><polygon points="0 0, 20 7, 0 14" fill="${accent}"/></marker></defs>`;

    let inner = arrowDef;
    inner += `<text x="540" y="120" fill="${txt}" font-size="52" text-anchor="middle" font-family="sans-serif">${esc(title)}</text>`;

    // Edges first (drawn behind nodes)
    edges.forEach((edge, ei) => {
      const erf = edgeRevealFrames[ei];
      let opacity = Math.min(1, Math.max(0, (f - erf) / fadeFrames));

      // Pulse when all nodes are visible
      if (opacity >= 1 && f >= allRevealedFrame) {
        opacity = 0.5 + 0.5 * Math.abs(Math.sin((f - allRevealedFrame) * 0.4));
      }

      inner += renderEdgeSvg(edge, nodesMap, opacity, accent);
    });

    // Nodes on top
    nodes.forEach(node => {
      const nrf    = revealFrames[node.id] ?? 0;
      const opacity = Math.min(1, Math.max(0, (f - nrf) / fadeFrames));
      inner += renderNodeSvg(node, opacity, palette);
    });

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><rect width="1080" height="1920" fill="${bg}"/>${inner}</svg>`;
    writeFrame(svg, framesDir, f);
  }
}

// ─── Render one scene → clip ──────────────────────────────────────────────────
async function renderScene(i, scene, palette, audioPath, clipPath, framesBaseDir) {
  await generateTTS(scene.voiceover, audioPath);
  const dur = getAudioDuration(audioPath);

  const nFrames   = Math.max(2, Math.ceil(dur * SVG_FPS));
  const framesDir = path.join(framesBaseDir, `s${i}`);
  fs.mkdirSync(framesDir, { recursive: true });

  try {
    renderNetworkFrames(scene, palette, framesDir, nFrames);
    assemblePngClip(framesDir, audioPath, clipPath, dur);
  } finally {
    cleanFramesDir(framesDir);
  }
}

// ─── generatePlanPrompt ───────────────────────────────────────────────────────
const generatePlanPrompt = `
Articolo: {{title}}
Testo: {{video_script}}

Genera 5 scene per un video network-graph in verticale 9:16.
Per ogni scena restituisci JSON con:
  - voiceover: (stringa, max 22 parole)
  - duration_sec: (intero 5-8)
  - nodes: (array di oggetti { id: string, label: string, type: "input"|"process"|"output"|"agent"|"tool", x: number 0-1080, y: number 200-1700 })
  - edges: (array di oggetti { from: string, to: string, label?: string })
  - reveal_order: (array di id nodi nell'ordine in cui appaiono)
  - scene_title: (stringa, max 6 parole)

Usa 3-6 nodi per scena. Le coordinate x/y devono essere distribuite nello spazio verticale 9:16.

Rispondi SOLO con un oggetto JSON valido, senza markdown, senza backtick:
${JSON.stringify({
  scenes: [{
    scene: 1,
    duration_sec: 6,
    voiceover: '...',
    nodes: [
      { id: 'a', label: '...', type: 'agent', x: 540, y: 500 },
      { id: 'b', label: '...', type: 'tool',  x: 300, y: 900 },
    ],
    edges: [{ from: 'a', to: 'b' }],
    reveal_order: ['a', 'b'],
    scene_title: '...',
  }],
  cta: '...',
  quality_score: 0,
}, null, 2)}

Regole:
- esattamente 5 scene
- durata totale tra 22 e 40 secondi
- ogni voiceover: max 22 parole
- 3-6 nodi per scena
- quality_score: intero 0-100
- cta: max 10 parole
`.trim();

// ─── Entry point ──────────────────────────────────────────────────────────────
async function render(article, scenes, agentConfig, outputPath) {
  const ROOT = path.join(__dirname, '..', '..', '..');
  try {
    outputPath = path.resolve(outputPath);
    const slug      = article.slug || 'network-graph';
    const rendDir   = path.dirname(outputPath);
    const clipsDir  = path.join(rendDir, 'clips');
    const audioDir  = path.join(rendDir, 'audio');
    const framesDir = path.join(rendDir, 'ng-frames');

    fs.mkdirSync(rendDir,   { recursive: true });
    fs.mkdirSync(clipsDir,  { recursive: true });
    fs.mkdirSync(audioDir,  { recursive: true });
    fs.mkdirSync(framesDir, { recursive: true });

    const palette   = agentConfig.videoPalette || {};
    const clipPaths = [];

    for (let i = 0; i < scenes.length; i++) {
      const scene     = scenes[i];
      const audioPath = path.join(audioDir, `${slug}_ng${i}.mp3`);
      const clipPath  = path.join(clipsDir, `${slug}_ng${i}.mp4`);
      const nNodes    = (scene.nodes || []).length;

      console.log(`  scena ${i + 1}/${scenes.length} [${nNodes} nodi, ${(scene.edges || []).length} edge]...`);

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

    console.log('  [network-graph] concatenazione...');
    concatClips(clipPaths, outputPath);

    for (const cp of clipPaths) try { fs.unlinkSync(cp); } catch {}
    try { fs.rmdirSync(clipsDir); } catch {}
    try { fs.rmdirSync(framesDir); } catch {}

    console.log(`✅ network-graph → ${path.relative(ROOT, outputPath)}`);
  } catch (e) {
    return Promise.reject(new Error(`network-graph render fallito: ${e.message}`));
  }
}

module.exports = {
  id:                  'network_graph',
  label:               'Network Graph',
  requiresCarouselPng: false,
  generatePlanPrompt,
  render,
};
