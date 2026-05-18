'use strict';

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { execSync } = require('child_process');
const axios = require('axios');

const { generateVideoScenes } = require('../core/generate-video');
const { fetchPexelsVideo }    = require('../core/fetch-video');
const { estimateDuration, buildBlackClip, verifyMp4, FONT_PATH } = require('../core/video-utils');

const ROOT = path.resolve(__dirname, '..');

// ── guard: --all non esiste mai ──────────────────────────────────────────────
if (process.argv.includes('--all')) {
  console.error('❌ --all non è supportato. Usa --limit 2 per il test.');
  process.exit(1);
}

// ── arg parsing ──────────────────────────────────────────────────────────────
function arg(name) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : null;
}
const agentId   = arg('--agent');
const slugArg   = arg('--slug');
const limitArg  = parseInt(arg('--limit') || '1', 10);
const sceneArg  = arg('--scene') !== null ? parseInt(arg('--scene'), 10) : null;

if (!agentId) { console.error('❌ --agent richiesto (es. ai-news | food | fitness)'); process.exit(1); }

// ── guard: limite massimo in fase di test ────────────────────────────────────
const MAX_TEST_LIMIT = 2;
if (limitArg > MAX_TEST_LIMIT) {
  console.error(`❌ --limit ${limitArg} non permesso in fase di test (max ${MAX_TEST_LIMIT}).`);
  console.error('   Rimuovi questo vincolo esplicitamente nel codice quando V1 è validato.');
  process.exit(1);
}

// ── percorsi ─────────────────────────────────────────────────────────────────
const OUTPUT_DIR   = path.join(ROOT, 'output', agentId === 'ai-news' ? '' : agentId);
const RENDERS_DIR  = path.join(ROOT, 'output', agentId === 'ai-news' ? '' : agentId, 'renders');

// ai-news articles sono in output/ direttamente
function getOutputDir() {
  if (agentId === 'ai-news') return path.join(ROOT, 'output');
  return path.join(ROOT, 'output', agentId);
}

// ── trova articoli ───────────────────────────────────────────────────────────
function findArticles() {
  const dir = getOutputDir();
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  const articles = files.map(f => {
    try { return { file: path.join(dir, f), data: JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) }; }
    catch { return null; }
  }).filter(Boolean);

  if (slugArg) {
    const found = articles.find(a => a.data.slug === slugArg);
    if (!found) { console.error(`❌ articolo con slug "${slugArg}" non trovato in ${dir}`); process.exit(1); }
    return [found];
  }

  return articles
    .filter(a => a.data.status === 'approved' && a.data.render_status !== 'rendered')
    .slice(0, limitArg);
}

// ── TTS via OpenAI ────────────────────────────────────────────────────────────
async function generateTTS(text, outputPath) {
  const res = await axios.post(
    'https://api.openai.com/v1/audio/speech',
    { model: 'tts-1', voice: 'alloy', input: text },
    {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      responseType: 'arraybuffer',
    }
  );
  fs.writeFileSync(outputPath, Buffer.from(res.data));
}

// ── download clip Pexels ──────────────────────────────────────────────────────
async function downloadClip(url, destPath) {
  const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 });
  fs.writeFileSync(destPath, Buffer.from(res.data));
}

// ── escape testo per ffmpeg drawtext ─────────────────────────────────────────
function escapeDrawtext(text) {
  return text.replace(/\\/g, '\\\\').replace(/'/g, "’").replace(/:/g, '\\:').replace(/\[/g, '\\[').replace(/\]/g, '\\]');
}

// ── motion filter stringa ─────────────────────────────────────────────────────
function motionFilter(motion, durationSec) {
  const frames = Math.ceil(durationSec * 30);
  switch (motion) {
    case 'zoom-in':
      return `zoompan=z='min(zoom+0.0015,1.3)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920:fps=30`;
    case 'zoom-out':
      return `zoompan=z='if(eq(on\\,1)\\,1.3\\,max(zoom-0.0015\\,1.0))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920:fps=30`;
    case 'pan-right':
      return `zoompan=z=1.1:x='min(iw/2-(iw/zoom/2)+on*0.5\\,iw-iw/zoom)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920:fps=30`;
    case 'pan-left':
      return `zoompan=z=1.1:x='max(iw/2-(iw/zoom/2)-on*0.5\\,0)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920:fps=30`;
    default:
      return null; // static
  }
}

// ── processa una scena → mp4 senza audio ─────────────────────────────────────
async function processScene(scene, sceneIndex, dur, tmpDir) {
  const clip = await fetchPexelsVideo(scene.query, {
    sceneIndex,
    usedClipIds: global._usedClipIds,
    minDuration: dur + 0.5,
    orientation: 'portrait',
  });

  const outPath = path.join(tmpDir, `scene_${sceneIndex}.mp4`);
  const subtitle = escapeDrawtext(scene.subtitle);
  const drawtext = `drawtext=fontfile='${FONT_PATH}':text='${subtitle}':fontsize=52:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=h*0.82`;

  if (clip.type === 'black') {
    console.log(`  scena ${sceneIndex + 1}: black clip (fallback)`);
    const blackNoSub = path.join(tmpDir, `black_raw_${sceneIndex}.mp4`);
    await buildBlackClip(blackNoSub, dur);
    execSync(
      `ffmpeg -y -i "${blackNoSub}" -vf "${drawtext}" -t ${dur} -an -c:v libx264 -preset fast "${outPath}"`,
      { stdio: 'pipe' }
    );
    fs.unlinkSync(blackNoSub);
  } else {
    console.log(`  scena ${sceneIndex + 1}: clip Pexels id=${clip.id}`);
    const rawPath = path.join(tmpDir, `raw_${sceneIndex}.mp4`);
    await downloadClip(clip.url, rawPath);

    const motion = motionFilter(scene.motion, dur);
    const cropScale = `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30`;
    const vf = motion
      ? `${cropScale},${motion},${drawtext}`
      : `${cropScale},${drawtext}`;

    execSync(
      `ffmpeg -y -i "${rawPath}" -vf "${vf}" -t ${dur} -an -c:v libx264 -preset fast "${outPath}"`,
      { stdio: 'pipe' }
    );
    fs.unlinkSync(rawPath);
  }

  return outPath;
}

// ── concatena scene ───────────────────────────────────────────────────────────
function concatScenes(scenePaths, tmpDir) {
  const listFile = path.join(tmpDir, 'concat.txt');
  const content = scenePaths.map(p => `file '${p}'`).join('\n');
  fs.writeFileSync(listFile, content);

  const concatPath = path.join(tmpDir, 'concat_noaudio.mp4');
  execSync(
    `ffmpeg -y -f concat -safe 0 -i "${listFile}" -c:v libx264 -preset fast "${concatPath}"`,
    { stdio: 'pipe' }
  );
  return concatPath;
}

// ── mix voiceover ─────────────────────────────────────────────────────────────
function mixVoiceover(videoPath, audioPath, outputPath) {
  execSync(
    `ffmpeg -y -i "${videoPath}" -i "${audioPath}" ` +
    `-map 0:v -map 1:a -c:v copy -c:a aac -shortest "${outputPath}"`,
    { stdio: 'pipe' }
  );
}

// ── aggiorna render_status nel JSON ──────────────────────────────────────────
function updateArticle(filePath, fields) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  Object.assign(data, fields);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ── render singolo articolo ───────────────────────────────────────────────────
async function renderArticle(articleFile, articleData) {
  const slug = articleData.slug;
  const tmpDir = path.join(os.tmpdir(), `render-${slug}-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  if (!fs.existsSync(RENDERS_DIR)) fs.mkdirSync(RENDERS_DIR, { recursive: true });

  const finalPath = sceneArg !== null
    ? path.join(RENDERS_DIR, `${slug}_scene${sceneArg}.mp4`)
    : path.join(RENDERS_DIR, `${slug}.mp4`);

  try {
    console.log(`\n▶ render: ${slug}`);

    // 1. genera scene
    const scenes = await generateVideoScenes(articleData);

    // 2. scegli le scene da processare
    const targetScenes = sceneArg !== null ? [scenes[sceneArg]] : scenes;
    global._usedClipIds = new Set();

    // 3. processa ogni scena in sequenza (l'ordine è fisso per design)
    const scenePaths = [];
    for (let i = 0; i < targetScenes.length; i++) {
      const scene = targetScenes[i];
      const dur = estimateDuration(scene.voice);
      const scenePath = await processScene(scene, sceneArg !== null ? sceneArg : i, dur, tmpDir);
      scenePaths.push(scenePath);
    }

    if (sceneArg !== null) {
      // test singola scena: niente TTS né concat
      fs.copyFileSync(scenePaths[0], finalPath);
      console.log(`✅ scena ${sceneArg} → ${finalPath}`);
    } else {
      // 4. TTS singolo per tutto il voiceover
      console.log('  TTS voiceover...');
      const voiceText = scenes.map(s => s.voice).join(' ');
      const voicePath = path.join(tmpDir, 'voiceover.mp3');
      await generateTTS(voiceText, voicePath);

      // 5. concatena
      console.log('  concatenazione scene...');
      const concatPath = concatScenes(scenePaths, tmpDir);

      // 6. mix voiceover
      console.log('  mix voiceover...');
      mixVoiceover(concatPath, voicePath, finalPath);

      // 7. verifica
      const info = verifyMp4(finalPath);
      console.log(`✅ ${slug} → ${finalPath}`);
      console.log(`   ${info.width}x${info.height} | ${info.duration.toFixed(1)}s | ${(info.sizeBytes / 1024 / 1024).toFixed(1)}MB | ${info.codec}`);

      // 8. aggiorna render_status
      updateArticle(articleFile, { render_status: 'rendered', render_version: '1' });
    }
  } catch (err) {
    console.error(`❌ render fallito per ${slug}: ${err.message}`);
    if (sceneArg === null) {
      updateArticle(articleFile, { render_status: 'failed', render_error: err.message });
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ── main ──────────────────────────────────────────────────────────────────────
(async () => {
  const articles = findArticles();
  if (articles.length === 0) {
    console.log('Nessun articolo da renderizzare (status:approved + render_status:!rendered).');
    process.exit(0);
  }
  console.log(`Articoli da renderizzare: ${articles.length}`);
  for (const { file, data } of articles) {
    await renderArticle(file, data);
  }
})();
