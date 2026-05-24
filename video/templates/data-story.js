'use strict';

require('dotenv').config();
const fs                      = require('fs');
const path                    = require('path');
const { spawnSync, execSync } = require('child_process');
const axios                   = require('axios');
const { buildBlackClip, FONT_PATH } = require('../../core/video-utils');

const ROOT    = path.join(__dirname, '..', '..', '..');
const SVG_FPS = 5; // unique SVG frames per second — balances quality vs render time

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
  return parseFloat(JSON.parse(raw).format?.duration || '4');
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toFfmpegColor(hex) {
  return '0x' + (hex || '#ffffff').replace('#', '');
}

function numVal(dp) {
  if (typeof dp.value === 'number') return dp.value;
  const m = String(dp.value).match(/[\d.]+/);
  return m ? parseFloat(m[0]) : 0;
}

function extractUnit(highlight) {
  if (!highlight) return '';
  const m = String(highlight).match(/^[\d.,\s]+(.*)/);
  return m ? m[1].trim() : '';
}

function svgWrap(inner, bg) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><rect width="1080" height="1920" fill="${bg}"/>${inner}</svg>`;
}

function esc(t) {
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function cleanFramesDir(dir) {
  try {
    for (const f of fs.readdirSync(dir)) try { fs.unlinkSync(path.join(dir, f)); } catch {}
    fs.rmdirSync(dir);
  } catch {}
}

// ─── SVG frame writer helper ──────────────────────────────────────────────────
function writeFrame(svgContent, framesDir, frameIdx) {
  const svgPath = path.join(framesDir, `tmp_${frameIdx}.svg`);
  const pngPath = path.join(framesDir, `frame_${String(frameIdx).padStart(4, '0')}.png`);
  fs.writeFileSync(svgPath, svgContent);
  svgToPng(svgPath, pngPath);
  try { fs.unlinkSync(svgPath); } catch {}
}

// ─── Bar chart frames ─────────────────────────────────────────────────────────
function renderBarFrames(scene, palette, framesDir, nFrames) {
  const bg     = palette.bg     || '#0f172a';
  const txt    = palette.text   || '#f8fafc';
  const accent = palette.accent || '#3b82f6';
  const dps    = (scene.data_points || []).slice(0, 5);
  if (!dps.length) { renderFallbackFrames(scene, palette, framesDir, nFrames); return; }

  const values  = dps.map(numVal);
  const maxVal  = Math.max(...values, 1);
  const spacing = Math.floor(1080 / (dps.length + 1));
  const barW    = Math.min(160, spacing - 30);
  const maxH    = 1100;
  const baseY   = 1760;

  for (let f = 0; f < nFrames; f++) {
    const p = nFrames > 1 ? f / (nFrames - 1) : 1;
    let inner = `<text x="540" y="140" fill="${txt}" font-size="56" text-anchor="middle" font-family="sans-serif">${esc(scene.on_screen_text || '')}</text>`;
    dps.forEach((dp, i) => {
      const x   = spacing * (i + 1);
      const val = values[i];
      const h   = Math.max(4, Math.round(maxH * (val / maxVal) * p));
      const y   = baseY - h;
      const col = String(dp.label) === String(scene.highlight) ? accent : (dp.color || '#334155');
      inner += `<rect x="${x - barW / 2}" y="${y}" width="${barW}" height="${h}" fill="${col}" rx="6"/>`;
      inner += `<text x="${x}" y="${baseY + 64}" fill="${txt}" font-size="40" text-anchor="middle" font-family="sans-serif">${esc(dp.label)}</text>`;
      if (p > 0.88)
        inner += `<text x="${x}" y="${y - 16}" fill="${accent}" font-size="40" text-anchor="middle" font-family="sans-serif">${val}</text>`;
    });
    writeFrame(svgWrap(inner, bg), framesDir, f);
  }
}

// ─── Line chart frames ────────────────────────────────────────────────────────
function renderLineFrames(scene, palette, framesDir, nFrames) {
  const bg     = palette.bg     || '#0f172a';
  const txt    = palette.text   || '#f8fafc';
  const accent = palette.accent || '#3b82f6';
  const dps    = (scene.data_points || []).slice(0, 6);
  if (dps.length < 2) { renderBarFrames(scene, palette, framesDir, nFrames); return; }

  const values = dps.map(numVal);
  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values, 0);
  const cX = 80, cY = 280, cW = 920, cH = 1320, padB = 80;
  const baseY = cY + cH - padB;

  const pts = dps.map((dp, i) => ({
    x: Math.round(cX + (i / (dps.length - 1)) * cW),
    y: Math.round(cY + cH - padB - ((values[i] - minVal) / (maxVal - minVal || 1)) * (cH - padB)),
    label: dp.label,
  }));

  for (let f = 0; f < nFrames; f++) {
    const p   = nFrames > 1 ? f / (nFrames - 1) : 1;
    const vis = Math.max(1, Math.ceil(p * dps.length));
    const vpts = pts.slice(0, vis);
    let inner = `<text x="540" y="140" fill="${txt}" font-size="56" text-anchor="middle" font-family="sans-serif">${esc(scene.on_screen_text || '')}</text>`;
    inner += `<line x1="${cX}" y1="${baseY}" x2="${cX + cW}" y2="${baseY}" stroke="#334155" stroke-width="3"/>`;
    if (vpts.length >= 2) {
      inner += `<polyline points="${vpts.map(q => `${q.x},${q.y}`).join(' ')}" fill="none" stroke="${accent}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    vpts.forEach(q => {
      inner += `<circle cx="${q.x}" cy="${q.y}" r="14" fill="${accent}"/>`;
      inner += `<text x="${q.x}" y="${baseY + 58}" fill="${txt}" font-size="36" text-anchor="middle" font-family="sans-serif">${esc(q.label)}</text>`;
    });
    writeFrame(svgWrap(inner, bg), framesDir, f);
  }
}

// ─── Comparison chart frames (2 columns) ─────────────────────────────────────
function renderComparisonFrames(scene, palette, framesDir, nFrames) {
  const bg     = palette.bg     || '#0f172a';
  const txt    = palette.text   || '#f8fafc';
  const accent = palette.accent || '#3b82f6';
  const dps    = (scene.data_points || []).slice(0, 2);
  if (!dps.length) { renderFallbackFrames(scene, palette, framesDir, nFrames); return; }

  const values = dps.map(numVal);
  const maxVal = Math.max(...values, 1);
  const maxH   = 1100;
  const baseY  = 1700;
  const cols   = [accent, '#475569'];
  const xs     = dps.length === 1 ? [540] : [270, 810];

  for (let f = 0; f < nFrames; f++) {
    const p = nFrames > 1 ? f / (nFrames - 1) : 1;
    let inner = `<text x="540" y="140" fill="${txt}" font-size="56" text-anchor="middle" font-family="sans-serif">${esc(scene.on_screen_text || '')}</text>`;
    dps.forEach((dp, i) => {
      const x   = xs[i];
      const h   = Math.max(4, Math.round(maxH * (values[i] / maxVal) * p));
      const y   = baseY - h;
      inner += `<rect x="${x - 100}" y="${y}" width="200" height="${h}" fill="${cols[i]}" rx="8"/>`;
      inner += `<text x="${x}" y="${baseY + 64}" fill="${txt}" font-size="44" text-anchor="middle" font-family="sans-serif">${esc(dp.label)}</text>`;
      if (p > 0.80)
        inner += `<text x="${x}" y="${y - 16}" fill="${txt}" font-size="44" text-anchor="middle" font-family="sans-serif">${values[i]}</text>`;
    });
    writeFrame(svgWrap(inner, bg), framesDir, f);
  }
}

// ─── Fallback frames: title text on colored background ───────────────────────
function renderFallbackFrames(scene, palette, framesDir, nFrames) {
  const bg  = palette.bg   || '#0f172a';
  const txt = palette.text || '#f8fafc';
  const title = scene.on_screen_text || scene.highlight || '';
  for (let f = 0; f < nFrames; f++) {
    const inner = `<text x="540" y="960" fill="${txt}" font-size="72" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif">${esc(title)}</text>`;
    writeFrame(svgWrap(inner, bg), framesDir, f);
  }
}

// ─── number_counter: single FFmpeg call (no SVG frames needed) ────────────────
function renderNumberCounter(scene, palette, audioPath, clipPath, dur) {
  const bg      = toFfmpegColor(palette.bg     || '#0f172a');
  const textCol = toFfmpegColor(palette.text   || '#f8fafc');
  const accent  = toFfmpegColor(palette.accent || '#3b82f6');

  const dp      = (scene.data_points || [])[0] || {};
  const value   = numVal(dp);
  const unit    = extractUnit(scene.highlight || '');
  const label   = String(dp.label || scene.on_screen_text || '');
  const total   = Math.max(1, Math.ceil(dur * 25));
  const fade    = 0.5;

  const fadeExpr = `if(lt(t,${fade}),t/${fade},if(lt(t,${dur - fade}),1,(${dur}-t)/${fade}))`;

  // %{eif\:expr\:d\:0} format (single-quoted, \: are FFmpeg escapes for : within quotes)
  const counterExpr = `'%{eif\\:min(n*${value}/${total}\\,${value})\\:d\\:0}${unit}'`;

  const titleFile = clipPath.replace('.mp4', '_dstitle.txt');
  const unitFile  = clipPath.replace('.mp4', '_dsunit.txt');
  fs.writeFileSync(titleFile, scene.on_screen_text || '');
  fs.writeFileSync(unitFile, label);

  const vf = [
    `drawtext=fontfile='${FONT_PATH}':fontsize=180:fontcolor=${textCol}:x=(w-text_w)/2:y=(h-text_h)/2:alpha='${fadeExpr}':text=${counterExpr}`,
    `drawtext=fontfile='${FONT_PATH}':textfile='${titleFile}':fontsize=58:fontcolor=${accent}:x=(w-text_w)/2:y=220:alpha='${fadeExpr}'`,
  ].join(',');

  const tmpVideo = clipPath.replace('.mp4', '_v.mp4');
  const r1 = spawnSync('ffmpeg', [
    '-y', '-f', 'lavfi', '-i', `color=c=${bg}:size=1080x1920:rate=25`,
    '-vf', vf,
    '-t', String(dur),
    '-an', '-c:v', 'libx264', '-preset', 'fast', '-pix_fmt', 'yuv420p',
    tmpVideo,
  ], { stdio: 'pipe' });

  if (r1.status !== 0)
    throw new Error('counter-video: ' + (r1.stderr?.toString()?.split('\n').slice(-3).join(' ') || 'error'));

  const r2 = spawnSync('ffmpeg', [
    '-y', '-i', tmpVideo, '-i', audioPath,
    '-map', '0:v', '-map', '1:a',
    '-c:v', 'copy', '-c:a', 'aac', '-shortest',
    clipPath,
  ], { stdio: 'pipe' });

  try { fs.unlinkSync(tmpVideo); } catch {}
  try { fs.unlinkSync(titleFile); } catch {}
  try { fs.unlinkSync(unitFile); } catch {}

  if (r2.status !== 0)
    throw new Error('counter-merge: ' + (r2.stderr?.toString()?.split('\n').slice(-3).join(' ') || 'error'));
}

// ─── Render one scene → clip ──────────────────────────────────────────────────
async function renderScene(i, scene, palette, audioPath, clipPath, framesBaseDir) {
  await generateTTS(scene.voiceover, audioPath);
  const dur = getAudioDuration(audioPath);

  const chartType = (scene.chart_type || 'bar').toLowerCase();

  if (chartType === 'number_counter') {
    renderNumberCounter(scene, palette, audioPath, clipPath, dur);
    return;
  }

  const nFrames    = Math.max(2, Math.ceil(dur * SVG_FPS));
  const framesDir  = path.join(framesBaseDir, `s${i}`);
  fs.mkdirSync(framesDir, { recursive: true });

  try {
    switch (chartType) {
      case 'bar':        renderBarFrames(scene, palette, framesDir, nFrames);        break;
      case 'line':       renderLineFrames(scene, palette, framesDir, nFrames);       break;
      case 'comparison': renderComparisonFrames(scene, palette, framesDir, nFrames); break;
      default:           renderBarFrames(scene, palette, framesDir, nFrames);        break;
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

Genera 5 scene per un video data-story in verticale 9:16.
Per ogni scena restituisci JSON con:
  - voiceover: (stringa, max 22 parole, narrazione TTS)
  - on_screen_text: (stringa, max 8 parole, titolo della scena)
  - duration_sec: (intero 4-8)
  - chart_type: ("bar" | "line" | "number_counter" | "pie" | "comparison")
  - data_points: (array di oggetti { label: string, value: number, color?: string } — max 5)
  - highlight: (stringa — il dato più importante da enfatizzare)
  - trend: ("up" | "down" | "neutral")

Se l'articolo non contiene dati numerici espliciti, usa dati simbolici coerenti col contenuto.

Rispondi SOLO con un oggetto JSON valido, senza markdown, senza backtick:
${JSON.stringify({
  scenes: [{
    scene: 1,
    duration_sec: 5,
    voiceover: '...',
    on_screen_text: '...',
    chart_type: 'bar',
    data_points: [{ label: '...', value: 0 }],
    highlight: '...',
    trend: 'up',
  }],
  cta: '...',
  quality_score: 0,
}, null, 2)}

Regole:
- esattamente 5 scene
- durata totale tra 18 e 35 secondi
- ogni voiceover: max 22 parole
- ogni on_screen_text: max 8 parole
- quality_score: intero 0-100
- cta: max 10 parole
`.trim();

// ─── Entry point ──────────────────────────────────────────────────────────────
async function render(article, scenes, agentConfig, outputPath) {
  try {
    outputPath = path.resolve(outputPath);
    const slug      = article.slug || 'data-story';
    const rendDir   = path.dirname(outputPath);
    const clipsDir  = path.join(rendDir, 'clips');
    const audioDir  = path.join(rendDir, 'audio');
    const framesDir = path.join(rendDir, 'ds-frames');

    fs.mkdirSync(rendDir,   { recursive: true });
    fs.mkdirSync(clipsDir,  { recursive: true });
    fs.mkdirSync(audioDir,  { recursive: true });
    fs.mkdirSync(framesDir, { recursive: true });

    const palette   = agentConfig.videoPalette || {};
    const clipPaths = [];

    for (let i = 0; i < scenes.length; i++) {
      const scene     = scenes[i];
      const audioPath = path.join(audioDir, `${slug}_ds${i}.mp3`);
      const clipPath  = path.join(clipsDir, `${slug}_ds${i}.mp4`);

      console.log(`  scena ${i + 1}/${scenes.length} [${scene.chart_type || 'bar'}]...`);

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

    console.log('  [data-story] concatenazione...');
    concatClips(clipPaths, outputPath);

    // Cleanup
    for (const cp of clipPaths) try { fs.unlinkSync(cp); } catch {}
    try { fs.rmdirSync(clipsDir); } catch {}
    try { fs.rmdirSync(framesDir); } catch {}

    console.log(`✅ data-story → ${path.relative(ROOT, outputPath)}`);
  } catch (e) {
    return Promise.reject(new Error(`data-story render fallito: ${e.message}`));
  }
}

module.exports = {
  id:                  'data_story',
  label:               'Data Story',
  requiresCarouselPng: false,
  generatePlanPrompt,
  render,
};
