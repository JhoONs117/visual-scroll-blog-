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

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

function typeColor(type, accent) {
  switch (type) {
    case 'milestone': return accent;
    case 'problem':   return '#ef4444';
    case 'solution':  return '#22c55e';
    case 'now':       return accent;
    default:          return accent;
  }
}

// ─── Timeline frames ──────────────────────────────────────────────────────────
function renderTimelineFrames(scene, palette, framesDir, nFrames) {
  const bg     = palette.bg     || '#0f172a';
  const txt    = palette.text   || '#f8fafc';
  const accent = palette.accent || '#3b82f6';

  const events = (scene.events || []).slice(0, 3);
  const camMot = scene.camera_motion || 'static';
  const title  = scene.scene_title   || '';

  // Vertical y positions for each event on the 1080×1920 canvas
  const startY = 300;
  const endY   = 1700;
  const eventY = events.length === 1
    ? [(startY + endY) / 2]
    : events.map((_, i) => startY + i * ((endY - startY) / Math.max(1, events.length - 1)));

  // Each event reveals progressively (top-to-bottom)
  const revealStartFrame = Math.max(1, Math.floor(nFrames * 0.12));
  const revealInterval   = events.length > 1
    ? Math.floor((nFrames * 0.55) / (events.length - 1))
    : 0;
  const fadeInFrames = Math.max(2, Math.floor(nFrames * 0.18));

  for (let f = 0; f < nFrames; f++) {
    const progress = nFrames > 1 ? f / (nFrames - 1) : 1;

    // Camera motion → SVG viewBox
    let vbX = 0, vbY = 0, vbW = 1080, vbH = 1920;
    if (camMot === 'pan_down') {
      vbY = Math.round(progress * 180);
    } else if (camMot === 'zoom_in') {
      const scale = 1 + progress * 0.18;
      vbW = Math.round(1080 / scale);
      vbH = Math.round(1920 / scale);
      vbX = Math.round((1080 - vbW) / 2);
      vbY = Math.round((1920 - vbH) / 2);
    }

    // Title Y tracks the top of the visible area so it stays on screen during pan
    const titleY = vbY + 120;

    let inner = '';

    // Oversized background rect to cover viewBox under any camera motion
    inner += `<rect x="${vbX - 20}" y="${vbY - 20}" width="${vbW + 40}" height="${vbH + 40}" fill="${bg}"/>`;

    // Scene title
    inner += `<text x="540" y="${titleY}" fill="${txt}" font-size="52" text-anchor="middle" font-family="sans-serif">${esc(title)}</text>`;

    // Vertical timeline spine
    inner += `<line x1="540" y1="180" x2="540" y2="1840" stroke="#334155" stroke-width="4"/>`;

    // Events revealed top-to-bottom
    events.forEach((ev, i) => {
      const evRevealFrame = revealStartFrame + i * revealInterval;
      if (f < evRevealFrame) return;

      const rawProg = (f - evRevealFrame) / Math.max(1, fadeInFrames);
      let   opacity = Math.min(1, rawProg);

      // "now" type pulses (oscillating opacity) once fully revealed
      if (ev.type === 'now' && opacity >= 1) {
        opacity = 0.65 + 0.35 * Math.abs(Math.sin(f * 0.55));
      }

      const op  = opacity.toFixed(2);
      const y   = Math.round(eventY[i]);
      const col = typeColor(ev.type, accent);

      inner += `<circle cx="540" cy="${y}" r="18" fill="${col}" opacity="${op}"/>`;
      inner += `<text x="580" y="${y + 6}" fill="${txt}" font-size="38" font-family="sans-serif" opacity="${op}">${esc(ev.label || '')}</text>`;
      inner += `<text x="460" y="${y + 6}" fill="${accent}" font-size="30" text-anchor="end" font-family="sans-serif" opacity="${op}">${esc(ev.date || '')}</text>`;
    });

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="${vbX} ${vbY} ${vbW} ${vbH}">${inner}</svg>`;
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
    renderTimelineFrames(scene, palette, framesDir, nFrames);
    assemblePngClip(framesDir, audioPath, clipPath, dur);
  } finally {
    cleanFramesDir(framesDir);
  }
}

// ─── generatePlanPrompt ───────────────────────────────────────────────────────
const generatePlanPrompt = `
Articolo: {{title}}
Testo: {{video_script}}

Genera 5 scene per un video timeline in verticale 9:16.
Per ogni scena restituisci JSON con:
  - voiceover: (stringa, max 22 parole)
  - duration_sec: (intero 4-7)
  - events: (array di 1-3 oggetti { date: string, label: string, type: "milestone"|"problem"|"solution"|"now" })
  - camera_motion: ("pan_down" | "zoom_in" | "static")
  - scene_title: (stringa, max 6 parole, titolo della scena)

Rispondi SOLO con un oggetto JSON valido, senza markdown, senza backtick:
${JSON.stringify({
  scenes: [{
    scene: 1,
    duration_sec: 5,
    voiceover: '...',
    events: [{ date: '...', label: '...', type: 'milestone' }],
    camera_motion: 'static',
    scene_title: '...',
  }],
  cta: '...',
  quality_score: 0,
}, null, 2)}

Regole:
- esattamente 5 scene
- durata totale tra 18 e 35 secondi
- ogni voiceover: max 22 parole
- ogni events[]: 1-3 eventi per scena
- quality_score: intero 0-100
- cta: max 10 parole
`.trim();

// ─── Entry point ──────────────────────────────────────────────────────────────
async function render(article, scenes, agentConfig, outputPath) {
  const ROOT = path.join(__dirname, '..', '..', '..');
  try {
    outputPath = path.resolve(outputPath);
    const slug      = article.slug || 'timeline';
    const rendDir   = path.dirname(outputPath);
    const clipsDir  = path.join(rendDir, 'clips');
    const audioDir  = path.join(rendDir, 'audio');
    const framesDir = path.join(rendDir, 'tm-frames');

    fs.mkdirSync(rendDir,   { recursive: true });
    fs.mkdirSync(clipsDir,  { recursive: true });
    fs.mkdirSync(audioDir,  { recursive: true });
    fs.mkdirSync(framesDir, { recursive: true });

    const palette   = agentConfig.videoPalette || {};
    const clipPaths = [];

    for (let i = 0; i < scenes.length; i++) {
      const scene     = scenes[i];
      const audioPath = path.join(audioDir, `${slug}_tm${i}.mp3`);
      const clipPath  = path.join(clipsDir, `${slug}_tm${i}.mp4`);
      const evCount   = (scene.events || []).length;

      console.log(`  scena ${i + 1}/${scenes.length} [${evCount} eventi, ${scene.camera_motion || 'static'}]...`);

      try {
        await renderScene(i, scene, palette, audioPath, clipPath, framesDir);
        clipPaths.push(clipPath);
      } catch (e) {
        console.warn(`  ⚠️  scena ${i + 1} fallita: ${e.message.slice(0, 100)}`);
        console.warn('      → black clip fallback');
        try {
          await buildBlackClip(clipPath, scene.duration_sec || 5);
          clipPaths.push(clipPath);
        } catch (fe) {
          console.warn(`  ⚠️  black clip fallita: ${fe.message.slice(0, 80)}`);
        }
      }
    }

    if (clipPaths.length === 0) throw new Error('nessuna clip generata');

    console.log('  [timeline-motion] concatenazione...');
    concatClips(clipPaths, outputPath);

    for (const cp of clipPaths) try { fs.unlinkSync(cp); } catch {}
    try { fs.rmdirSync(clipsDir); } catch {}
    try { fs.rmdirSync(framesDir); } catch {}

    console.log(`✅ timeline-motion → ${path.relative(ROOT, outputPath)}`);
  } catch (e) {
    return Promise.reject(new Error(`timeline-motion render fallito: ${e.message}`));
  }
}

module.exports = {
  id:                  'timeline_motion',
  label:               'Timeline',
  requiresCarouselPng: false,
  generatePlanPrompt,
  render,
};
