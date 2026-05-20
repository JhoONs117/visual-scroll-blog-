'use strict';

require('dotenv').config();
const fs                    = require('fs');
const path                  = require('path');
const { spawnSync, execSync } = require('child_process');
const axios                 = require('axios');

const { generateSlides916 }   = require('../generate-slides-916');
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

// ─── Animation filter ─────────────────────────────────────────────────────────
function animationFilter(index, dur) {
  const frames = Math.ceil(dur * 30);
  switch (index % 3) {
    case 0: // slow zoom
      return `scale=8000:-1,zoompan=z='zoom+0.0015':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920:fps=30`;
    case 1: // pan left
      return `scale=1440:1920,crop=1080:1920:'(iw-1080)*t/${dur}':0`;
    case 2: // ken burns — zoom + pan diagonale
      return `scale=8000:-1,zoompan=z='zoom+0.001':x='iw/2-(iw/zoom/2)+on*0.8':y='ih/2-(ih/zoom/2)+on*0.4':d=${frames}:s=1080x1920:fps=30`;
    default:
      return 'scale=1080:1920';
  }
}

// ─── Render scena: animazione + subtitle + audio → clip.mp4 ──────────────────
async function renderScene(i, scene, slidePath, audioPath, clipPath, captionFile) {
  // 1. TTS
  await generateTTS(scene.voiceover, audioPath);

  // 2. Durata reale dall'audio
  const actualDur = getAudioDuration(audioPath);

  // 3. Caption testfile per evitare escaping nel filter
  const caption = (scene.caption || scene.on_screen_text || '').trim();
  fs.writeFileSync(captionFile, caption);

  const anim     = animationFilter(i, actualDur);
  const drawtext = caption
    ? `drawtext=fontfile='${FONT_PATH}':textfile='${captionFile}':fontsize=38:fontcolor=white:box=1:boxcolor=black@0.5:x=(w-text_w)/2:y=h-120`
    : null;
  const vf = drawtext ? `${anim},${drawtext}` : anim;

  // 4. Video animato (senza audio)
  const tmpVideo = clipPath.replace('.mp4', '_v.mp4');
  const r1 = spawnSync('ffmpeg', [
    '-loop', '1', '-i', slidePath,
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

// ─── Concat clip mp4 con audio ────────────────────────────────────────────────
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
    outputPath = path.resolve(outputPath);  // garantisce path assoluto
    const slug     = article.slug;
    const rendDir  = path.dirname(outputPath);
    const clipsDir = path.join(rendDir, 'clips');
    const audioDir = path.join(rendDir, 'audio');

    fs.mkdirSync(rendDir,  { recursive: true });
    fs.mkdirSync(clipsDir, { recursive: true });
    fs.mkdirSync(audioDir, { recursive: true });

    // 1. Genera slide 9:16
    console.log('  [slide-deck] generazione slide 9:16...');
    const slidePaths = await generateSlides916(article, agentConfig);

    if (slidePaths.length === 0)
      throw new Error('generateSlides916 non ha prodotto nessuna slide');

    // 2. Per ogni scena → clip con audio
    const clipPaths = [];
    for (let i = 0; i < scenes.length; i++) {
      const scene       = scenes[i];
      const slidePath   = slidePaths[i] ?? slidePaths[slidePaths.length - 1];
      const audioPath   = path.join(audioDir, `${slug}_scene${i}.mp3`);
      const clipPath    = path.join(clipsDir, `${slug}_scene${i}.mp4`);
      const captionFile = path.join(clipsDir, `${slug}_cap${i}.txt`);

      try {
        if (!fs.existsSync(slidePath)) {
          console.warn(`  ⚠️  slide ${i} mancante — black clip`);
          await buildBlackClip(clipPath, scene.duration_sec || 4);
        } else {
          console.log(`  scena ${i + 1}/${scenes.length}...`);
          await renderScene(i, scene, slidePath, audioPath, clipPath, captionFile);
        }
        clipPaths.push(clipPath);
      } catch (e) {
        console.warn(`  ⚠️  scena ${i + 1} fallita: ${e.message.slice(0, 100)}`);
        console.warn('      → black clip fallback');
        try {
          await buildBlackClip(clipPath, scene.duration_sec || 4);
          clipPaths.push(clipPath);
        } catch (fe) {
          console.warn(`  ⚠️  black clip fallita: ${fe.message.slice(0, 80)}`);
        }
      } finally {
        try { fs.unlinkSync(captionFile); } catch {}
      }
    }

    if (clipPaths.length === 0)
      throw new Error('nessuna clip generata');

    // 3. Concat
    console.log('  [slide-deck] concatenazione...');
    concatClips(clipPaths, outputPath);

    // 7. Cleanup clip intermedie
    for (const cp of clipPaths) try { fs.unlinkSync(cp); } catch {}
    try { fs.rmdirSync(clipsDir); } catch {}

    console.log(`✅ slide-deck → ${path.relative(ROOT, outputPath)}`);
  } catch (e) {
    return Promise.reject(new Error(`slide-deck render fallito: ${e.message}`));
  }
}

module.exports = { render };
