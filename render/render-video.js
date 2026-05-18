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

// ── language da config agente ─────────────────────────────────────────────────
let agentLanguage = 'english';
try {
  const cfg = require(`../agents/${agentId}/config`);
  agentLanguage = cfg.language || 'english';
} catch { /* agente non ha config — usa default */ }

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

// ── wrappa voice in max 2 righe per il subtitle ──────────────────────────────
function wrapVoiceText(text, maxChars = 32) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 2).join('\n');
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

  // subtitle = testo voice completo (max 2 righe), scritto in textfile per evitare escape
  const subtitleText = wrapVoiceText(scene.voice);
  const subtitleFile = path.join(tmpDir, `sub_${sceneIndex}.txt`);
  fs.writeFileSync(subtitleFile, subtitleText);
  const drawtext = `drawtext=fontfile='${FONT_PATH}':textfile='${subtitleFile}':fontsize=44:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=h*0.80:line_spacing=8`;

  if (clip.type === 'black') {
    console.log(`  scena ${sceneIndex + 1}: black clip (fallback)`);
    const blackRaw = path.join(tmpDir, `black_raw_${sceneIndex}.mp4`);
    await buildBlackClip(blackRaw, dur);
    execSync(
      `ffmpeg -y -i "${blackRaw}" -vf "${drawtext}" -t ${dur} -an -c:v libx264 -preset fast "${outPath}"`,
      { stdio: 'pipe' }
    );
    fs.unlinkSync(blackRaw);
  } else {
    console.log(`  scena ${sceneIndex + 1}: clip Pexels id=${clip.id}`);
    const rawPath = path.join(tmpDir, `raw_${sceneIndex}.mp4`);
    await downloadClip(clip.url, rawPath);

    const motion = motionFilter(scene.motion, dur);
    const cropScale = `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30`;
    const vf = motion ? `${cropScale},${motion},${drawtext}` : `${cropScale},${drawtext}`;

    execSync(
      `ffmpeg -y -i "${rawPath}" -vf "${vf}" -t ${dur} -an -c:v libx264 -preset fast "${outPath}"`,
      { stdio: 'pipe' }
    );
    fs.unlinkSync(rawPath);
  }

  return outPath;
}

// ── TTS per-scena + merge video+audio → scena finale ─────────────────────────
async function buildSceneWithAudio(videoPath, voiceText, sceneIndex, tmpDir) {
  const audioPath = path.join(tmpDir, `tts_${sceneIndex}.mp3`);
  await generateTTS(voiceText, audioPath);

  const outPath = path.join(tmpDir, `scene_final_${sceneIndex}.mp4`);
  execSync(
    `ffmpeg -y -i "${videoPath}" -i "${audioPath}" ` +
    `-map 0:v -map 1:a -c:v copy -c:a aac -shortest "${outPath}"`,
    { stdio: 'pipe' }
  );
  return outPath;
}

// ── concatena scene con audio ─────────────────────────────────────────────────
function concatScenes(scenePaths, tmpDir) {
  const listFile = path.join(tmpDir, 'concat.txt');
  fs.writeFileSync(listFile, scenePaths.map(p => `file '${p}'`).join('\n'));

  const concatPath = path.join(tmpDir, 'concat_final.mp4');
  execSync(
    `ffmpeg -y -f concat -safe 0 -i "${listFile}" -c:v libx264 -preset fast -c:a aac "${concatPath}"`,
    { stdio: 'pipe' }
  );
  return concatPath;
}

// ── aggiorna render_status nel JSON ─────────────────────────────────────────
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

    // 1. genera scene — inietta language dalla config agente
    const scenes = await generateVideoScenes({ ...articleData, language: agentLanguage });

    // 2. scegli le scene da processare
    const targetScenes = sceneArg !== null ? [scenes[sceneArg]] : scenes;
    global._usedClipIds = new Set();

    // 3+4. per ogni scena: video + TTS per-scena → scena con audio sincronizzato
    const finalScenePaths = [];
    for (let i = 0; i < targetScenes.length; i++) {
      const scene = targetScenes[i];
      const sceneIdx = sceneArg !== null ? sceneArg : i;
      const dur = estimateDuration(scene.voice);

      const videoPath = await processScene(scene, sceneIdx, dur, tmpDir);

      if (sceneArg !== null) {
        // test singola scena: niente TTS né concat
        fs.copyFileSync(videoPath, finalPath);
        console.log(`✅ scena ${sceneArg} → ${finalPath}`);
        break;
      }

      console.log(`  TTS scena ${i + 1}...`);
      const sceneWithAudio = await buildSceneWithAudio(videoPath, scene.voice, sceneIdx, tmpDir);
      finalScenePaths.push(sceneWithAudio);
    }

    if (sceneArg === null) {
      // 5. concatena scene (già con audio per-scena)
      console.log('  concatenazione scene...');
      const concatPath = concatScenes(finalScenePaths, tmpDir);
      fs.copyFileSync(concatPath, finalPath);

      // 6. verifica
      const info = verifyMp4(finalPath);
      console.log(`✅ ${slug} → ${finalPath}`);
      console.log(`   ${info.width}x${info.height} | ${info.duration.toFixed(1)}s | ${(info.sizeBytes / 1024 / 1024).toFixed(1)}MB | ${info.codec}`);

      // 7. aggiorna render_status
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
