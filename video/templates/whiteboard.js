'use strict';

require('dotenv').config();
const fs                      = require('fs');
const path                    = require('path');
const { spawnSync, execSync } = require('child_process');
const axios                   = require('axios');
const { buildBlackClip }      = require('../../core/video-utils');

const ROOT    = path.join(__dirname, '..', '..', '..');
const SVG_FPS = 8; // unique SVG frames/sec — smooth stroke animation

const SIZE_PX = { small: 130, medium: 210, large: 300 };

const SUPPORTED_TYPES         = new Set(['circle', 'rect', 'arrow', 'check', 'persona', 'icon']);
const ACTIVE_STROKE_WIDTH     = 7;
const PERSISTENT_STROKE_WIDTH = 5;
const PERSISTENT_OPACITY      = 0.55;
const ERASE_DURATION          = 1.2;  // seconds
const ERASE_FPS               = 25;   // fps for erase frames (no audio sync needed)

// ─── Scene normalizer (safety net for legacy JSON plans) ─────────────────────
function normalizeWhiteboardScene(scene, index = 0) {
  const hasUsableElements =
    Array.isArray(scene.elements) &&
    scene.elements.length > 0 &&
    scene.elements.every(el =>
      el &&
      SUPPORTED_TYPES.has(el.type) &&
      el.position &&
      typeof el.position.x === 'number' &&
      typeof el.position.y === 'number'
    );

  const headline =
    scene.headline      ||
    scene.on_screen_text ||
    scene.hook          ||
    scene.caption       ||
    `Scena ${index + 1}`;

  const voiceover = scene.voiceover || scene.caption || headline;

  if (hasUsableElements) {
    return { ...scene, headline, voiceover, layout: scene.layout || 'centered' };
  }

  console.warn(`  ⚠️  [whiteboard] scena ${index + 1}: schema legacy, applico fallback automatico`);

  return {
    ...scene,
    headline,
    voiceover,
    layout: 'top_down',
    elements: [
      { type: 'rect',   label: headline.slice(0, 28),                          position: { x: 50, y: 24 }, size: 'large',  reveal_order: 0 },
      { type: 'arrow',  label: '',                                              position: { x: 50, y: 42 }, size: 'small',  reveal_order: 1 },
      { type: 'circle', label: (scene.emphasis_word || 'Idea').slice(0, 18),   position: { x: 50, y: 56 }, size: 'medium', reveal_order: 2 },
      { type: 'arrow',  label: '',                                              position: { x: 50, y: 68 }, size: 'small',  reveal_order: 3 },
      { type: 'check',  label: (scene.caption || 'Da ricordare').slice(0, 24), position: { x: 50, y: 80 }, size: 'medium', reveal_order: 4 },
    ],
  };
}

// ─── Asset path generators (from spec) ───────────────────────────────────────
const ASSETS = {
  arrow:   (x1, y1, x2, y2) => `M${x1},${y1} L${x2},${y2}`,
  circle:  (cx, cy, r)       => `M${cx - r},${cy} a${r},${r} 0 1,0 ${r * 2},0 a${r},${r} 0 1,0 -${r * 2},0`,
  check:   (x, y, size)      => `M${x},${y + size * 0.5} l${size * 0.4},${size * 0.5} l${size * 0.8},-${size * 0.9}`,
  persona: (cx, cy, size)    => `M${cx},${cy - size * 0.3} m0,${-size * 0.25} a${size * 0.25},${size * 0.25} 0 1,0 0.001,0 M${cx},${cy - size * 0.05} l0,${size * 0.6}`,
};

// Content area: x [80, 1000], y [230, 1820] — leaves room for headline above
const AREA = { x0: 80, x1: 1000, y0: 230, y1: 1820 };

function toX(pct) { return AREA.x0 + (pct / 100) * (AREA.x1 - AREA.x0); }
function toY(pct) { return AREA.y0 + (pct / 100) * (AREA.y1 - AREA.y0); }

function esc(t) {
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Approximate "reach" of a shape — used to shorten arrow endpoints
function shapeReach(el) {
  const s = SIZE_PX[el.size || 'medium'];
  switch (el.type) {
    case 'circle':  return s * 0.42;
    case 'rect':    return s * 0.32;
    default:        return s * 0.30;
  }
}

// ─── Shape path builder ───────────────────────────────────────────────────────
function buildShapePath(el) {
  const s  = SIZE_PX[el.size || 'medium'];
  const cx = toX(el.position.x);
  const cy = toY(el.position.y);
  switch (el.type) {
    case 'circle': {
      const r = s * 0.4;
      return { d: ASSETS.circle(cx, cy, r), len: 2 * Math.PI * r, cx, cy, s };
    }
    case 'rect': {
      const w = s * 0.8, h = s * 0.55;
      const d = `M${cx - w / 2},${cy - h / 2} L${cx + w / 2},${cy - h / 2} L${cx + w / 2},${cy + h / 2} L${cx - w / 2},${cy + h / 2} Z`;
      return { d, len: 2 * (w + h), cx, cy, s, w, h };
    }
    case 'check': {
      // Offset so the check is centered on (cx, cy)
      const ox = cx - s * 0.6, oy = cy - s * 0.55;
      return { d: ASSETS.check(ox, oy, s), len: s * 1.84, cx, cy, s };
    }
    case 'persona':
    case 'icon':
    default: {
      return { d: ASSETS.persona(cx, cy, s), len: s * 2.2, cx, cy, s };
    }
  }
}

// ─── Arrow path builder (connects prev non-arrow → next non-arrow) ────────────
function buildArrowPath(el, elements) {
  const s     = SIZE_PX[el.size || 'small'];
  const order = el.reveal_order ?? 0;

  // Filter to same scene only — prevents cross-scene reveal_order collisions
  const sameScene = elements.filter(e =>
    e.type !== 'arrow' &&
    (e._sceneIdx ?? null) === (el._sceneIdx ?? null)
  );

  const prevEl = sameScene.find(e => (e.reveal_order ?? 0) === order - 1);
  const nextEl = sameScene.find(e => (e.reveal_order ?? 0) === order + 1);

  let x1, y1, x2, y2;

  if (prevEl && nextEl) {
    const px = toX(prevEl.position.x), py = toY(prevEl.position.y);
    const nx = toX(nextEl.position.x), ny = toY(nextEl.position.y);
    const ddx = nx - px, ddy = ny - py;
    const dist = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
    const ux = ddx / dist, uy = ddy / dist;
    const g1 = shapeReach(prevEl) + 10;
    const g2 = shapeReach(nextEl) + 10;
    x1 = px + ux * g1;  y1 = py + uy * g1;
    x2 = nx - ux * g2;  y2 = ny - uy * g2;
  } else {
    // Fallback: short vertical arrow at element position
    const cx = toX(el.position.x), cy = toY(el.position.y);
    x1 = cx;  y1 = cy - s * 0.4;
    x2 = cx;  y2 = cy + s * 0.4;
  }

  const adx = x2 - x1, ady = y2 - y1;
  const len = Math.sqrt(adx * adx + ady * ady) || s;
  return { d: ASSETS.arrow(x1, y1, x2, y2), len, x2, y2, adx, ady, s };
}

// Arrowhead polygon at tip, pointing in direction (adx, ady)
function buildArrowHead(info, progress) {
  if (progress < 0.80) return '';
  const opacity = Math.min((progress - 0.80) / 0.20, 1).toFixed(2);
  const { x2, y2, adx, ady, s } = info;
  const dist = Math.sqrt(adx * adx + ady * ady) || 1;
  const ux = adx / dist, uy = ady / dist;
  const px = -uy, py = ux; // perpendicular
  const hw = Math.min(s * 0.10, 18);
  const h  = Math.min(s * 0.16, 28);
  const bx = x2 - h * ux, by = y2 - h * uy;
  const pts = [
    `${x2.toFixed(1)},${y2.toFixed(1)}`,
    `${(bx + hw * px).toFixed(1)},${(by + hw * py).toFixed(1)}`,
    `${(bx - hw * px).toFixed(1)},${(by - hw * py).toFixed(1)}`,
  ].join(' ');
  return `<polygon points="${pts}" fill="#1a1a1a" opacity="${opacity}"/>`;
}

// Label for element, fades in at progress 0.65→1.0
function buildLabel(el, info, progress) {
  if (!el.label || progress < 0.65) return '';
  const opacity = Math.min((progress - 0.65) / 0.35, 1).toFixed(2);
  const { cx, cy, s } = info;
  const fontSize = Math.max(30, Math.min(54, Math.round(s * 0.22)));

  switch (el.type) {
    case 'rect':
    case 'circle':
      // Label inside the shape — no overlap with connecting arrows
      return `<text x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" font-family="Humor Sans,cursive" font-size="${fontSize}" fill="#1a1a1a" text-anchor="middle" dominant-baseline="middle" opacity="${opacity}">${esc(el.label)}</text>`;
    case 'check':
      return `<text x="${(cx + s * 0.6).toFixed(1)}" y="${(cy + s * 0.1).toFixed(1)}" font-family="Humor Sans,cursive" font-size="${fontSize}" fill="#1a1a1a" text-anchor="start" opacity="${opacity}">${esc(el.label)}</text>`;
    case 'persona':
    case 'icon':
    default:
      return `<text x="${cx.toFixed(1)}" y="${(cy + s * 0.50 + 58).toFixed(1)}" font-family="Humor Sans,cursive" font-size="${fontSize}" fill="#1a1a1a" text-anchor="middle" opacity="${opacity}">${esc(el.label)}</text>`;
  }
}

// ─── SVG frame builder ────────────────────────────────────────────────────────
function buildSvg(scene, frameIdx, totalFrames) {
  const { headline = '', elements = [], persistent_elements = [] } = scene;
  const fp = totalFrames > 1 ? frameIdx / (totalFrames - 1) : 1; // 0 → 1

  // First 20%: headline typewriter
  const HEAD_FRAC = 0.20;
  const headP     = Math.min(fp / HEAD_FRAC, 1);
  const headTxt   = headline.slice(0, Math.round(headP * headline.length));

  // Remaining 80%: elements in reveal_order, each slot gets equal share
  const orders  = [...new Set(elements.map(e => e.reveal_order ?? 0))].sort((a, b) => a - b);
  const nSlots  = Math.max(orders.length, 1);
  const slotDur = (1 - HEAD_FRAC) / nSlots;

  // Full context for arrow resolution (persistent + current)
  const allElementsForArrows = [...persistent_elements, ...elements];

  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920">`,
    `<rect width="1080" height="1920" fill="#ffffff"/>`,
    `<text x="540" y="158" font-family="Humor Sans, cursive" font-size="58" fill="#1a1a1a" text-anchor="middle">${esc(headTxt)}</text>`,
  ];

  // Separator grows with headline
  if (headP > 0.05) {
    const lw = Math.round(headP * 820);
    parts.push(`<line x1="${540 - lw / 2}" y1="188" x2="${540 + lw / 2}" y2="190" stroke="#1a1a1a" stroke-width="3" stroke-linecap="round" opacity="0.25"/>`);
  }

  // ── Persistent elements (from previous scenes) ────────────────────────────
  if (persistent_elements.length > 0) {
    // White fills first (fully opaque — properly block anything behind)
    for (const el of persistent_elements) {
      if (el.type === 'rect') {
        const { cx, cy, w, h } = buildShapePath(el);
        parts.push(`<rect x="${(cx - w / 2).toFixed(1)}" y="${(cy - h / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="white" stroke="none"/>`);
      } else if (el.type === 'circle') {
        const { cx, cy, s } = buildShapePath(el);
        parts.push(`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(s * 0.4).toFixed(1)}" fill="white" stroke="none"/>`);
      }
    }
    // Strokes at reduced opacity (past context, not distraction)
    parts.push(`<g opacity="${PERSISTENT_OPACITY}">`);
    for (const el of persistent_elements) {
      const isArrow = el.type === 'arrow';
      const info    = isArrow ? buildArrowPath(el, allElementsForArrows) : buildShapePath(el);
      parts.push(`<path d="${info.d}" stroke="#1a1a1a" stroke-width="${PERSISTENT_STROKE_WIDTH}" fill="none" stroke-linecap="round"/>`);
      if (isArrow) parts.push(buildArrowHead(info, 1));
    }
    parts.push(`</g>`);
  }

  // ── Current scene Pass 1: white fills + animated strokes + arrowheads ────
  for (const el of elements) {
    const slot    = orders.indexOf(el.reveal_order ?? 0);
    const elStart = HEAD_FRAC + slot * slotDur;
    const elProg  = Math.max(0, Math.min(1, (fp - elStart) / slotDur));
    if (elProg <= 0) continue;

    const isArrow = el.type === 'arrow';
    const info    = isArrow ? buildArrowPath(el, allElementsForArrows) : buildShapePath(el);

    if (el.type === 'rect') {
      const { cx, cy, w, h } = info;
      parts.push(`<rect x="${(cx - w / 2).toFixed(1)}" y="${(cy - h / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="white" stroke="none"/>`);
    } else if (el.type === 'circle') {
      parts.push(`<circle cx="${info.cx.toFixed(1)}" cy="${info.cy.toFixed(1)}" r="${(info.s * 0.4).toFixed(1)}" fill="white" stroke="none"/>`);
    }

    const dOffset = (info.len * (1 - elProg)).toFixed(1);
    parts.push(`<path d="${info.d}" stroke="#1a1a1a" stroke-width="${ACTIVE_STROKE_WIDTH}" fill="none" stroke-dasharray="${info.len.toFixed(1)}" stroke-dashoffset="${dOffset}" stroke-linecap="round"/>`);
    if (isArrow) parts.push(buildArrowHead(info, elProg));
  }

  // ── Labels: persistent (faded) then current (full opacity) ───────────────
  if (persistent_elements.length > 0) {
    parts.push(`<g opacity="${PERSISTENT_OPACITY}">`);
    for (const el of persistent_elements) {
      if (el.type === 'arrow') continue;
      parts.push(buildLabel(el, buildShapePath(el), 1));
    }
    parts.push(`</g>`);
  }

  for (const el of elements) {
    if (el.type === 'arrow') continue;
    const slot    = orders.indexOf(el.reveal_order ?? 0);
    const elStart = HEAD_FRAC + slot * slotDur;
    const elProg  = Math.max(0, Math.min(1, (fp - elStart) / slotDur));
    if (elProg <= 0) continue;
    parts.push(buildLabel(el, buildShapePath(el), elProg));
  }

  parts.push('</svg>');
  return parts.join('\n');
}

// ─── TTS via OpenAI ───────────────────────────────────────────────────────────
async function generateTTS(text, outputPath) {
  const res = await axios.post(
    'https://api.openai.com/v1/audio/speech',
    { model: 'tts-1', voice: 'alloy', input: text },
    {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
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

// ─── SVG → PNG via FFmpeg ─────────────────────────────────────────────────────
function svgToPng(svgPath, pngPath) {
  const r = spawnSync('ffmpeg', ['-y', '-i', svgPath, '-f', 'image2pipe', '-vcodec', 'png', '-'], { stdio: 'pipe' });
  if (r.status !== 0 || !r.stdout?.length)
    throw new Error('SVG→PNG: ' + (r.stderr?.toString()?.slice(-150) || 'error'));
  fs.writeFileSync(pngPath, r.stdout);
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

// ─── Concat clips → final MP4 ─────────────────────────────────────────────────
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

// ─── Render single scene ──────────────────────────────────────────────────────
async function renderScene(i, scene, audioPath, clipPath, framesDir) {
  await generateTTS(scene.voiceover, audioPath);
  const dur     = getAudioDuration(audioPath);
  const nFrames = Math.max(Math.ceil(dur * SVG_FPS), 1);

  fs.mkdirSync(framesDir, { recursive: true });
  for (let f = 0; f < nFrames; f++) {
    writeFrame(buildSvg(scene, f, nFrames), framesDir, f);
  }

  assemblePngClip(framesDir, audioPath, clipPath, dur);
  cleanFramesDir(framesDir);
}

// ─── Erase transition between scenes ─────────────────────────────────────────
function buildEraseSvg(scene, eraseProgress) {
  // Fully-drawn scene (fp=1), then a diagonal white polygon sweeps left→right
  const base   = buildSvg({ ...scene, persistent_elements: [] }, 1, 1);
  const w      = Math.round(eraseProgress * 1080);
  const skew   = Math.round(eraseProgress * 140); // diagonal leading edge
  const pts    = `0,0 ${w + skew},0 ${w},1920 0,1920`;
  return base.replace('</svg>', `<polygon points="${pts}" fill="white"/>\n</svg>`);
}

async function renderEraseClip(scene, eraseClipPath) {
  const framesDir = eraseClipPath.replace('.mp4', '_ef');
  const nFrames   = Math.ceil(ERASE_DURATION * ERASE_FPS);
  fs.mkdirSync(framesDir, { recursive: true });

  for (let f = 0; f < nFrames; f++) {
    const progress = nFrames > 1 ? f / (nFrames - 1) : 1;
    writeFrame(buildEraseSvg(scene, progress), framesDir, f);
  }

  // Silent clip — anullsrc provides empty audio so concat mixes cleanly
  const r = spawnSync('ffmpeg', [
    '-y',
    '-framerate', String(ERASE_FPS),
    '-i', path.join(framesDir, 'frame_%04d.png'),
    '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-c:v', 'libx264', '-preset', 'fast', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-t', String(ERASE_DURATION),
    '-shortest',
    eraseClipPath,
  ], { stdio: 'pipe' });

  cleanFramesDir(framesDir);
  if (r.status !== 0)
    throw new Error('erase clip: ' + (r.stderr?.toString()?.split('\n').slice(-3).join(' ') || 'error'));
}

// ─── Entry point ──────────────────────────────────────────────────────────────
async function render(article, scenes, agentConfig, outputPath) {
  try {
    outputPath     = path.resolve(outputPath);
    const slug     = article.slug || 'whiteboard';
    const rendDir  = path.dirname(outputPath);
    const clipsDir = path.join(rendDir, 'clips');
    const audioDir = path.join(rendDir, 'audio');

    fs.mkdirSync(rendDir,  { recursive: true });
    fs.mkdirSync(clipsDir, { recursive: true });
    fs.mkdirSync(audioDir, { recursive: true });

    const clipPaths = [];

    for (let i = 0; i < scenes.length; i++) {
      const scene = normalizeWhiteboardScene(scenes[i], i);
      scene.elements = scene.elements.map(el => ({ ...el, _sceneIdx: i }));
      scene.persistent_elements = []; // erase handles transitions — no accumulation

      const audioPath = path.join(audioDir, `${slug}_wb${i}.mp3`);
      const clipPath  = path.join(clipsDir, `${slug}_wb${i}.mp4`);
      const framesDir = path.join(rendDir, `wb-frames-${i}`);

      console.log(`  scena ${i + 1}/${scenes.length}...`);

      try {
        await renderScene(i, scene, audioPath, clipPath, framesDir);
        clipPaths.push(clipPath);

        // Erase transition after every scene except the last
        if (i < scenes.length - 1) {
          console.log(`  erase ${i + 1}→${i + 2}...`);
          const eraseClipPath = path.join(clipsDir, `${slug}_wb${i}_erase.mp4`);
          await renderEraseClip(scene, eraseClipPath);
          clipPaths.push(eraseClipPath);
        }
      } catch (e) {
        console.warn(`  ⚠️  scena ${i + 1} fallita: ${e.message.slice(0, 100)}`);
        try {
          await buildBlackClip(clipPath, scene.duration_sec || 6);
          clipPaths.push(clipPath);
        } catch {}
      }
    }

    if (clipPaths.length === 0) throw new Error('nessuna clip generata');

    console.log('  [whiteboard] concatenazione...');
    concatClips(clipPaths, outputPath);

    for (const cp of clipPaths) try { fs.unlinkSync(cp); } catch {}
    try { fs.rmdirSync(clipsDir); } catch {}

    console.log(`✅ whiteboard → ${path.relative(ROOT, outputPath)}`);
  } catch (e) {
    return Promise.reject(new Error(`whiteboard render fallito: ${e.message}`));
  }
}

// ─── generatePlanPrompt ───────────────────────────────────────────────────────
const generatePlanPrompt = `
Article: {{title}}
Text: {{video_script}}

Generate ONLY valid JSON. No markdown, no explanations, no extra text.

Generate exactly 5 scenes for a vertical 9:16 whiteboard video.

DO NOT use these fields:
- hook
- on_screen_text
- visual_direction
- caption
- tone
- emphasis_word

Every scene MUST have exactly these fields:
- scene: progressive number 1 to 5
- voiceover: string in English, maximum 22 words
- duration_sec: integer between 6 and 9
- headline: string in English, maximum 7 words
- layout: one of "top_down", "flow_left_right", "centered", "comparison"
- elements: array of 3 to 5 elements

Every element in elements MUST have:
- type: one of "circle", "rect", "arrow", "check", "persona"
- label: string maximum 3 words, empty string if type is "arrow"
- position: { "x": number 0-100, "y": number 0-100 }
- size: one of "small", "medium", "large"
- reveal_order: progressive integer starting from 0

Rules:
- At least one arrow per scene
- Arrows must have reveal_order between two non-arrow elements
- For layout "top_down": use x=50, y increasing (e.g. 18, 33, 50, 67, 82)
- For layout "flow_left_right": use y=50, x increasing
- Labels go inside the shape — keep them short (1-3 words)
- Voiceover must be written in English

Expected format:
{
  "scenes": [
    {
      "scene": 1,
      "voiceover": "...",
      "duration_sec": 7,
      "headline": "...",
      "layout": "top_down",
      "elements": [
        { "type": "rect",   "label": "...", "position": { "x": 50, "y": 18 }, "size": "medium", "reveal_order": 0 },
        { "type": "arrow",  "label": "",    "position": { "x": 50, "y": 33 }, "size": "small",  "reveal_order": 1 },
        { "type": "circle", "label": "...", "position": { "x": 50, "y": 50 }, "size": "large",  "reveal_order": 2 }
      ]
    }
  ]
}
`.trim();

module.exports = {
  id:                  'whiteboard',
  label:               'Whiteboard',
  requiresCarouselPng: false,
  generatePlanPrompt,
  render,
};
