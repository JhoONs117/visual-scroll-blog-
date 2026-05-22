'use strict';

require('dotenv').config();
const fs                      = require('fs');
const path                    = require('path');
const { spawnSync, execSync } = require('child_process');
const axios                   = require('axios');
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

// ─── Helpers testo ────────────────────────────────────────────────────────────
function wrapText(text, maxChars = 16) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? current + ' ' + word : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.join('\n');
}

function toFfmpegColor(hex) {
  return '0x' + (hex || '#ffffff').replace('#', '');
}

// ─── Render scena singola ─────────────────────────────────────────────────────
async function renderScene(i, scene, palette, audioPath, clipPath, tmpDir) {
  const tone        = scene.tone         || 'informative';
  const emphWord    = (scene.emphasis_word || '').trim();
  const layout      = scene.layout       || 'single';
  const fade        = tone === 'urgent' ? 0.4 : 0.6;
  const fontSize    = tone === 'urgent' ? 80  : 70;
  const bgColor     = toFfmpegColor(palette.bg     || '#0f172a');
  const textColor   = toFfmpegColor(palette.text   || '#f8fafc');
  const accentColor = toFfmpegColor(palette.accent || '#3b82f6');

  // 1. TTS
  await generateTTS(scene.voiceover, audioPath);
  const dur = getAudioDuration(audioPath);

  const fadeExpr = `if(lt(t,${fade}),t/${fade},if(lt(t,${dur}-${fade}),1,(${dur}-t)/${fade}))`;

  const rawText = (scene.on_screen_text || '').trim();
  const parts = [];

  if (layout === 'split') {
    const words  = rawText.split(' ');
    const mid    = Math.ceil(words.length / 2);
    const line1  = wrapText(words.slice(0, mid).join(' '));
    const line2  = wrapText(words.slice(mid).join(' '));
    const file1  = path.join(tmpDir, `kt_l1_${i}.txt`);
    const file2  = path.join(tmpDir, `kt_l2_${i}.txt`);
    fs.writeFileSync(file1, line1);
    fs.writeFileSync(file2, line2);

    const appear2 = dur / 3;
    const alpha2  = `if(lt(t,${appear2}),0,if(lt(t,${appear2}+${fade}),(t-${appear2})/${fade},if(lt(t,${dur}-${fade}),1,(${dur}-t)/${fade})))`;

    parts.push(`drawtext=fontfile='${FONT_PATH}':textfile='${file1}':fontsize=${fontSize}:fontcolor=${textColor}:x=(w-text_w)/2:y=(h/2-text_h-16):alpha='${fadeExpr}'`);
    parts.push(`drawtext=fontfile='${FONT_PATH}':textfile='${file2}':fontsize=${fontSize}:fontcolor=${textColor}:x=(w-text_w)/2:y=(h/2+16):enable='gte(t,${appear2})':alpha='${alpha2}'`);
  } else {
    const mainFile = path.join(tmpDir, `kt_main_${i}.txt`);
    fs.writeFileSync(mainFile, wrapText(rawText));
    parts.push(`drawtext=fontfile='${FONT_PATH}':textfile='${mainFile}':fontsize=${fontSize}:fontcolor=${textColor}:x=(w-text_w)/2:y=(h-text_h)/2:alpha='${fadeExpr}'`);
  }

  if (emphWord) {
    const emphFile = path.join(tmpDir, `kt_emph_${i}.txt`);
    fs.writeFileSync(emphFile, emphWord);
    const emphSize = Math.round(fontSize * 0.85);
    parts.push(`drawtext=fontfile='${FONT_PATH}':textfile='${emphFile}':fontsize=${emphSize}:fontcolor=${accentColor}:x=(w-text_w)/2:y=h*0.72:alpha='${fadeExpr}'`);
  }

  const vf = parts.join(',');

  // 2. Video senza audio
  const tmpVideo = clipPath.replace('.mp4', '_v.mp4');
  const r1 = spawnSync('ffmpeg', [
    '-f', 'lavfi', '-i', `color=c=${bgColor}:size=1080x1920:rate=30`,
    '-vf', vf,
    '-t', String(dur),
    '-an',
    '-c:v', 'libx264', '-preset', 'fast', '-pix_fmt', 'yuv420p',
    '-y', tmpVideo,
  ], { stdio: 'pipe' });

  if (r1.status !== 0)
    throw new Error('video: ' + (r1.stderr?.toString()?.split('\n').slice(-3).join(' ') || 'ffmpeg error'));

  // 3. Merge video + audio
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
    throw new Error('merge: ' + (r2.stderr?.toString()?.split('\n').slice(-3).join(' ') || 'ffmpeg error'));
}

// ─── Entry point ──────────────────────────────────────────────────────────────
async function render(article, scenes, agentConfig, outputPath) {
  try {
    outputPath = path.resolve(outputPath);
    const slug     = article.slug;
    const rendDir  = path.dirname(outputPath);
    const clipsDir = path.join(rendDir, 'clips');
    const audioDir = path.join(rendDir, 'audio');
    const tmpDir   = path.join(rendDir, 'kt-tmp');

    fs.mkdirSync(rendDir,  { recursive: true });
    fs.mkdirSync(clipsDir, { recursive: true });
    fs.mkdirSync(audioDir, { recursive: true });
    fs.mkdirSync(tmpDir,   { recursive: true });

    const palette = agentConfig.videoPalette || {};

    const clipPaths = [];
    for (let i = 0; i < scenes.length; i++) {
      const scene     = scenes[i];
      const audioPath = path.join(audioDir, `${slug}_kt${i}.mp3`);
      const clipPath  = path.join(clipsDir, `${slug}_kt${i}.mp4`);

      console.log(`  scena ${i + 1}/${scenes.length}...`);

      try {
        await renderScene(i, scene, palette, audioPath, clipPath, tmpDir);
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
      }
    }

    if (clipPaths.length === 0)
      throw new Error('nessuna clip generata');

    console.log('  [kinetic-typography] concatenazione...');
    concatClips(clipPaths, outputPath);

    // Cleanup
    for (const cp of clipPaths) try { fs.unlinkSync(cp); } catch {}
    try { fs.rmdirSync(clipsDir); } catch {}
    try {
      for (const f of fs.readdirSync(tmpDir)) try { fs.unlinkSync(path.join(tmpDir, f)); } catch {}
      fs.rmdirSync(tmpDir);
    } catch {}

    console.log(`✅ kinetic-typography → ${path.relative(ROOT, outputPath)}`);
  } catch (e) {
    return Promise.reject(new Error(`kinetic-typography render fallito: ${e.message}`));
  }
}

// ─── generatePlanPrompt ───────────────────────────────────────────────────────
const generatePlanPrompt = `
Genera un piano video di 5 scene per un video kinetic typography verticale (9:16).

Titolo: {{title}}
Script: {{video_script}}

Rispondi SOLO con un oggetto JSON valido, senza markdown, senza backtick:
${JSON.stringify({
  scenes: [{
    scene: 1,
    duration_sec: 4,
    hook: '...',
    voiceover: '...',
    on_screen_text: '...',
    visual_direction: '...',
    caption: '...',
    tone: 'informative',
    emphasis_word: '...',
    layout: 'single',
  }],
  cta: '...',
  quality_score: 0,
}, null, 2)}

Regole:
- esattamente 5 scene
- durata totale tra 18 e 35 secondi
- ogni voiceover: max 22 parole
- ogni on_screen_text: max 9 parole (testo grande su schermo)
- tone: "urgent" | "informative" | "inspiring"
- emphasis_word: una parola chiave da on_screen_text da colorare in accent (stringa vuota se non serve)
- layout: "single" (testo centrato in un blocco) | "split" (due frasi in sequenza)
- quality_score: intero 0-100
- cta: max 10 parole
`.trim();

module.exports = {
  id:                  'kinetic_typography',
  label:               'Kinetic Text',
  requiresCarouselPng: false,
  generatePlanPrompt,
  render,
};
