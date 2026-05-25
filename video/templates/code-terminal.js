'use strict';

require('dotenv').config();
const fs                      = require('fs');
const path                    = require('path');
const { spawnSync, execSync } = require('child_process');
const axios                   = require('axios');
const { buildBlackClip }      = require('../../core/video-utils');

const ROOT    = path.join(__dirname, '..', '..', '..');
const SVG_FPS = 10; // unique SVG frames/sec — enough for smooth typing

// ─── Palette ─────────────────────────────────────────────────────────────────
const C = {
  bg:          '#0d1117',
  text:        '#c9d1d9',
  prompt:      '#7ee787',
  keyword:     '#ff7b72',
  string:      '#a5d6ff',
  number:      '#ffa657',
  comment:     '#8b949e',
  highlightBg: '#161b22',
  cursor:      '#e6edf3',
  border:      '#30363d',
  red:         '#ff5f57',
  yellow:      '#febc2e',
  green:       '#28c840',
};

const KEYWORDS = [
  'const', 'let', 'var', 'async', 'await', 'function', 'return',
  'import', 'export', 'require', 'if', 'else', 'for', 'while',
  'class', 'new', 'true', 'false', 'null', 'undefined', 'from',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function esc(t) {
  return String(t)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Tokenize the portion after a prompt prefix
function tokenizeRest(text) {
  const tokens = [];
  let rem = text;
  while (rem.length > 0) {
    // Quoted string (single / double / backtick)
    const strM = rem.match(/^(['"`][^'"`\n]*['"`])/);
    if (strM) {
      tokens.push({ t: strM[1], c: C.string });
      rem = rem.slice(strM[1].length);
      continue;
    }
    // Keyword at word boundary
    let hit = false;
    for (const kw of KEYWORDS) {
      if (rem.startsWith(kw) && (rem.length === kw.length || /\W/.test(rem[kw.length]))) {
        tokens.push({ t: kw, c: C.keyword });
        rem = rem.slice(kw.length);
        hit = true;
        break;
      }
    }
    if (hit) continue;
    // Number literal
    const numM = rem.match(/^(\d+\.?\d*)/);
    if (numM) {
      tokens.push({ t: numM[1], c: C.number });
      rem = rem.slice(numM[1].length);
      continue;
    }
    // Plain text — merge with previous plain token when possible
    if (tokens.length > 0 && tokens[tokens.length - 1].c === C.text) {
      tokens[tokens.length - 1].t += rem[0];
    } else {
      tokens.push({ t: rem[0], c: C.text });
    }
    rem = rem.slice(1);
  }
  return tokens;
}

// Tokenize a full terminal line into {t, c} tokens
function tokenizeLine(line) {
  if (!line) return [{ t: '', c: C.text }];

  // Comment
  const cIdx = line.indexOf('//');
  if (cIdx !== -1) {
    const before = line.slice(0, cIdx);
    const rest   = line.slice(cIdx);
    return [...(before ? tokenizeLine(before) : []), { t: rest, c: C.comment }];
  }

  // Prompt prefix: $, →, ✓, node>, >
  const pMatch = line.match(/^([$→✓>]\s+|node>\s*)/u);
  if (pMatch) {
    const prefix = pMatch[1];
    return [{ t: prefix, c: C.prompt }, ...tokenizeRest(line.slice(prefix.length))];
  }

  return tokenizeRest(line);
}

const CHAR_W = 22; // approx px per char at monospace font-size 38
const Y0      = 130; // baseline of first line
const LINE_H  = 62;  // vertical spacing between lines

// ─── SVG builder ─────────────────────────────────────────────────────────────
function buildSvg(scene, frameIdx, totalFrames) {
  const lines        = scene.terminal_lines || [];
  const highlightIdx = scene.highlight_line != null ? scene.highlight_line : -1;
  const title        = scene.scene_title || '';

  // Chars to show at this frame (0 at frame 0, all at last frame)
  const totalChars = lines.reduce((s, l) => s + l.length, 0);
  const progress   = totalFrames > 1 ? frameIdx / (totalFrames - 1) : 1;
  const charsTyped = Math.min(Math.round(progress * totalChars), totalChars);

  // Distribute chars across lines
  let rem = charsTyped;
  const shown = lines.map(l => {
    const n = Math.min(rem, l.length);
    rem = Math.max(0, rem - l.length);
    return n;
  });

  // Current line being typed (last line with content, fallback 0)
  let curLine = 0;
  for (let i = shown.length - 1; i >= 0; i--) {
    if (shown[i] > 0) { curLine = i; break; }
  }

  // Cursor blink: on for first half of each 0.6 s cycle
  const blinkCycle = Math.ceil(SVG_FPS * 0.6);
  const cursorOn   = (frameIdx % blinkCycle) < Math.ceil(blinkCycle / 2);

  // Build line SVG elements
  const lineEls = lines.map((line, i) => {
    if (shown[i] === 0) return '';
    const displayText = line.slice(0, shown[i]);
    const y = Y0 + i * LINE_H;

    const hlRect = (i === highlightIdx && shown[i] > 0)
      ? `<rect x="0" y="${y - LINE_H + 10}" width="1080" height="${LINE_H}" fill="${C.highlightBg}"/>`
      : '';

    const tokens  = tokenizeLine(displayText);
    const tspans  = tokens.map(tk => `<tspan fill="${esc(tk.c)}">${esc(tk.t)}</tspan>`).join('');
    return `${hlRect}<text x="40" y="${y}" font-family="monospace" font-size="38">${tspans}</text>`;
  }).join('');

  // Cursor
  const curLineText = shown[curLine] > 0 ? lines[curLine].slice(0, shown[curLine]) : '';
  const cursorX     = 40 + curLineText.length * CHAR_W;
  const cursorY     = Y0 + curLine * LINE_H;
  const cursorEl    = cursorOn
    ? `<rect x="${cursorX}" y="${cursorY - 40}" width="13" height="44" fill="${C.cursor}" rx="1"/>`
    : '';

  // Header title
  const titleEl = title
    ? `<text x="540" y="60" font-family="monospace" font-size="28" fill="${C.comment}" text-anchor="middle">${esc(title)}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920">
<rect width="1080" height="1920" fill="${C.bg}"/>
<circle cx="58"  cy="52" r="18" fill="${C.red}"/>
<circle cx="106" cy="52" r="18" fill="${C.yellow}"/>
<circle cx="154" cy="52" r="18" fill="${C.green}"/>
${titleEl}
<line x1="0" y1="88" x2="1080" y2="88" stroke="${C.border}" stroke-width="2"/>
${lineEls}
${cursorEl}
</svg>`;
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

// ─── Entry point ──────────────────────────────────────────────────────────────
async function render(article, scenes, agentConfig, outputPath) {
  try {
    outputPath      = path.resolve(outputPath);
    const slug      = article.slug || 'code-terminal';
    const rendDir   = path.dirname(outputPath);
    const clipsDir  = path.join(rendDir, 'clips');
    const audioDir  = path.join(rendDir, 'audio');

    fs.mkdirSync(rendDir,  { recursive: true });
    fs.mkdirSync(clipsDir, { recursive: true });
    fs.mkdirSync(audioDir, { recursive: true });

    const clipPaths = [];

    for (let i = 0; i < scenes.length; i++) {
      const scene     = scenes[i];
      const audioPath = path.join(audioDir, `${slug}_ct${i}.mp3`);
      const clipPath  = path.join(clipsDir, `${slug}_ct${i}.mp4`);
      const framesDir = path.join(rendDir, `ct-frames-${i}`);

      console.log(`  scena ${i + 1}/${scenes.length}...`);

      try {
        await renderScene(i, scene, audioPath, clipPath, framesDir);
        clipPaths.push(clipPath);
      } catch (e) {
        console.warn(`  ⚠️  scena ${i + 1} fallita: ${e.message.slice(0, 100)}`);
        try {
          await buildBlackClip(clipPath, scene.duration_sec || 5);
          clipPaths.push(clipPath);
        } catch {}
      }
    }

    if (clipPaths.length === 0) throw new Error('nessuna clip generata');

    console.log('  [code-terminal] concatenazione...');
    concatClips(clipPaths, outputPath);

    for (const cp of clipPaths) try { fs.unlinkSync(cp); } catch {}
    try { fs.rmdirSync(clipsDir); } catch {}

    console.log(`✅ code-terminal → ${path.relative(ROOT, outputPath)}`);
  } catch (e) {
    return Promise.reject(new Error(`code-terminal render fallito: ${e.message}`));
  }
}

// ─── generatePlanPrompt ───────────────────────────────────────────────────────
const generatePlanPrompt = `
Articolo: {{title}}
Testo: {{video_script}}

Genera 5 scene per un video terminal-style in verticale 9:16.
Per ogni scena restituisci JSON con:
  - voiceover: (stringa, max 22 parole)
  - duration_sec: (intero 5-9)
  - terminal_lines: (array di stringhe — max 8 righe — che appaiono nel terminale)
  - prompt_prefix: (stringa — es. "$ " o "node> " o "→ ")
  - highlight_line: (intero — indice della riga da evidenziare con colore accent)
  - scene_title: (stringa, max 6 parole)

Le righe devono essere codice realistico, comandi bash, output di log,
o pseudo-codice coerente con il contenuto dell'articolo.
`.trim();

module.exports = {
  id:                  'code_terminal',
  label:               'Terminal',
  requiresCarouselPng: false,
  generatePlanPrompt,
  render,
};
