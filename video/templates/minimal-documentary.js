'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { spawnSync, execSync } = require('child_process');
const axios = require('axios');

const { buildBlackClip, FONT_PATH } = require('../../core/video-utils');

const ROOT = path.join(__dirname, '..', '..', '..');

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

// ─── Download immagine da URL ─────────────────────────────────────────────────
async function downloadImage(url, destPath) {
  const response = await axios({ url, responseType: 'arraybuffer', timeout: 20000 });
  fs.writeFileSync(destPath, Buffer.from(response.data));
}

// ─── Sfondo solid color come fallback ────────────────────────────────────────
function makeSolidBg(color, outputPath) {
  const hex = color.replace('#', '0x');
  const r = spawnSync('ffmpeg', [
    '-f', 'lavfi', '-i', `color=c=${hex}:size=1080x1920:rate=1`,
    '-frames:v', '1',
    '-y', outputPath,
  ], { stdio: 'pipe' });
  if (r.status !== 0)
    throw new Error('solid bg: ' + (r.stderr?.toString()?.slice(-200) || 'error'));
}

// ─── Ken Burns / movimento camera ────────────────────────────────────────────
function kenBurnsFilter(kenBurns, dur) {
  const frames = Math.ceil(dur * 30);
  switch (kenBurns) {
    case 'zoom_out':
      // inizia a 1.5x e scende lentamente a ~1.0x
      return `scale=8000:-1,zoompan=z='if(eq(on,0),1.5,max(1.001,zoom-0.0015))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920:fps=30`;
    case 'pan_left':
      // pan lento verso sinistra (camera si sposta a sinistra)
      return `scale=8000:-1,zoompan=z='1.2':x='iw/2-(iw/zoom/2)+on*0.8':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920:fps=30`;
    case 'pan_right':
      // pan lento verso destra
      return `scale=8000:-1,zoompan=z='1.2':x='iw/2-(iw/zoom/2)-on*0.8':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920:fps=30`;
    case 'zoom_in':
    default:
      // zoom in lento — identico a slide-deck case 0
      return `scale=8000:-1,zoompan=z='zoom+0.0015':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920:fps=30`;
  }
}

// ─── Posizione Y del testo ────────────────────────────────────────────────────
function textPositionY(position, lineIndex) {
  if (position === 'top') {
    return lineIndex === 0 ? 140 : 240;
  }
  if (position === 'center') {
    return lineIndex === 0 ? 860 : 980;
  }
  // bottom (default)
  return lineIndex === 0 ? 1640 : 1760;
}

// ─── Render singola scena ─────────────────────────────────────────────────────
async function renderScene(i, scene, imagePath, audioPath, clipPath, headlineFile, subtextFile) {
  // 1. TTS
  await generateTTS(scene.voiceover, audioPath);

  // 2. Durata reale dall'audio
  const actualDur = getAudioDuration(audioPath);

  // 3. Scrivi headline/subtext in file per evitare escaping nel filter
  const headline = (scene.headline || scene.on_screen_text || '').trim();
  const subtext  = (scene.subtext || '').trim();
  fs.writeFileSync(headlineFile, headline);
  fs.writeFileSync(subtextFile,  subtext);

  const position  = scene.text_position || 'bottom';
  const kenBurns  = scene.ken_burns     || 'zoom_in';

  const kbVf = kenBurnsFilter(kenBurns, actualDur);
  const yH   = textPositionY(position, 0);
  const yS   = textPositionY(position, 1);

  const vfParts = [kbVf, 'vignette=PI/5'];

  if (headline) {
    vfParts.push(
      `drawtext=fontfile='${FONT_PATH}':textfile='${headlineFile}':fontsize=72:fontcolor=white:x=(w-text_w)/2:y=${yH}:box=1:boxcolor=black@0.45:boxborderw=14`
    );
  }
  if (subtext) {
    vfParts.push(
      `drawtext=fontfile='${FONT_PATH}':textfile='${subtextFile}':fontsize=40:fontcolor=white@0.88:x=(w-text_w)/2:y=${yS}:box=1:boxcolor=black@0.35:boxborderw=10`
    );
  }

  const vf = vfParts.join(',');

  // 4. Video animato (senza audio)
  const tmpVideo = clipPath.replace('.mp4', '_v.mp4');
  const r1 = spawnSync('ffmpeg', [
    '-loop', '1', '-i', imagePath,
    '-vf', vf,
    '-t', String(actualDur),
    '-an',
    '-c:v', 'libx264', '-preset', 'fast', '-pix_fmt', 'yuv420p',
    '-y', tmpVideo,
  ], { stdio: 'pipe' });

  if (r1.status !== 0)
    throw new Error('animazione: ' + (r1.stderr?.toString()?.split('\n').slice(-3).join(' ') || 'ffmpeg error'));

  // 5. Merge video + audio
  const r2 = spawnSync('ffmpeg', [
    '-i', tmpVideo,
    '-i', audioPath,
    '-map', '0:v', '-map', '1:a',
    '-c:v', 'copy', '-c:a', 'aac',
    '-shortest',
    '-y', clipPath,
  ], { stdio: 'pipe' });

  try { fs.unlinkSync(tmpVideo); } catch {}

  if (r2.status !== 0)
    throw new Error('merge audio: ' + (r2.stderr?.toString()?.split('\n').slice(-3).join(' ') || 'ffmpeg error'));

  return actualDur;
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

// ─── Entry point ──────────────────────────────────────────────────────────────
async function render(article, scenes, agentConfig, outputPath) {
  try {
    outputPath = path.resolve(outputPath);
    const slug     = article.slug;
    const rendDir  = path.dirname(outputPath);
    const clipsDir = path.join(rendDir, 'clips');
    const audioDir = path.join(rendDir, 'audio');
    const imgsDir  = path.join(rendDir, 'mdoc_imgs');

    fs.mkdirSync(rendDir,  { recursive: true });
    fs.mkdirSync(clipsDir, { recursive: true });
    fs.mkdirSync(audioDir, { recursive: true });
    fs.mkdirSync(imgsDir,  { recursive: true });

    const bgColor = agentConfig.videoPalette?.bg || '#0f172a';

    const clipPaths = [];
    for (let i = 0; i < scenes.length; i++) {
      const scene        = scenes[i];
      const slideIdx     = typeof scene.slide_index === 'number' ? scene.slide_index : i;
      const imageUrl     = article.carousel_slides?.[slideIdx]?.image || null;
      const imagePath    = path.join(imgsDir,  `${slug}_img${i}.jpg`);
      const audioPath    = path.join(audioDir, `${slug}_scene${i}.mp3`);
      const clipPath     = path.join(clipsDir, `${slug}_scene${i}.mp4`);
      const headlineFile = path.join(clipsDir, `${slug}_hl${i}.txt`);
      const subtextFile  = path.join(clipsDir, `${slug}_st${i}.txt`);

      try {
        if (imageUrl) {
          console.log(`  scena ${i + 1}/${scenes.length} — download immagine...`);
          await downloadImage(imageUrl, imagePath);
        } else {
          console.log(`  scena ${i + 1}/${scenes.length} — nessuna immagine, uso sfondo solid`);
          makeSolidBg(bgColor, imagePath);
        }

        console.log(`  scena ${i + 1}/${scenes.length} — render...`);
        await renderScene(i, scene, imagePath, audioPath, clipPath, headlineFile, subtextFile);
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
      } finally {
        try { fs.unlinkSync(headlineFile); } catch {}
        try { fs.unlinkSync(subtextFile);  } catch {}
        try { fs.unlinkSync(imagePath);    } catch {}
      }
    }

    if (clipPaths.length === 0)
      throw new Error('nessuna clip generata');

    console.log('  [minimal-documentary] concatenazione...');
    concatClips(clipPaths, outputPath);

    for (const cp of clipPaths) try { fs.unlinkSync(cp); } catch {}
    try { fs.rmdirSync(clipsDir); } catch {}
    try { fs.rmdirSync(imgsDir);  } catch {}

    console.log(`✅ minimal-documentary → ${path.relative(ROOT, outputPath)}`);
  } catch (e) {
    return Promise.reject(new Error(`minimal-documentary render fallito: ${e.message}`));
  }
}

module.exports = {
  id:                 'minimal_documentary',
  label:              'Documentary',
  requiresCarouselPng: false,

  generatePlanPrompt: `Articolo: {{title}}
Testo: {{video_script}}

Genera 5 scene per un video documentary in verticale 9:16.
Per ogni scena restituisci JSON con:
  - voiceover: (stringa, max 22 parole)
  - headline: (stringa, max 7 parole, testo overlay grande)
  - subtext: (stringa, max 12 parole, testo secondario più piccolo)
  - duration_sec: (intero 5-9)
  - text_position: ("top" | "center" | "bottom")
  - ken_burns: ("zoom_in" | "zoom_out" | "pan_left" | "pan_right")
  - slide_index: (intero 0-4 — quale slide del carousel usare come immagine)`,

  render,
};
