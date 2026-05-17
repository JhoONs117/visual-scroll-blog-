#!/usr/bin/env node
'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let allOk = true;

function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.log(`❌ ${msg}`); allOk = false; }

// 1. ffmpeg
try {
  const v = execSync('ffmpeg -version', { stdio: 'pipe' }).toString().split('\n')[0];
  ok(`ffmpeg: ${v}`);
} catch {
  fail('ffmpeg non trovato — installa con: sudo apt-get install -y ffmpeg');
}

// 2. drawtext filter
try {
  const filters = execSync('ffmpeg -filters 2>&1', { stdio: 'pipe' }).toString();
  if (filters.includes('drawtext')) ok('ffmpeg drawtext (libfreetype) disponibile');
  else fail('drawtext non presente — reinstalla ffmpeg con libfreetype');
} catch {
  fail('impossibile leggere i filtri ffmpeg');
}

// 3. ffprobe
try {
  const v = execSync('ffprobe -version', { stdio: 'pipe' }).toString().split('\n')[0];
  ok(`ffprobe: ${v}`);
} catch {
  fail('ffprobe non trovato — installa con: sudo apt-get install -y ffmpeg');
}

// 4. font
const fontPath = path.join(ROOT, 'assets/fonts/Inter-Bold.ttf');
if (fs.existsSync(fontPath)) ok(`font: ${fontPath}`);
else fail(`Inter-Bold.ttf mancante in assets/fonts/`);

// 5. .gitignore contiene output/*/renders/
const gitignore = fs.existsSync(path.join(ROOT, '.gitignore'))
  ? fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8') : '';
if (gitignore.includes('output/*/renders/')) ok('.gitignore contiene output/*/renders/');
else fail('.gitignore non contiene output/*/renders/ — i mp4 potrebbero essere committati');

// 6. .railwayignore contiene output/*/renders/
const railwayignore = fs.existsSync(path.join(ROOT, '.railwayignore'))
  ? fs.readFileSync(path.join(ROOT, '.railwayignore'), 'utf8') : '';
if (railwayignore.includes('output/*/renders/')) ok('.railwayignore contiene output/*/renders/');
else fail('.railwayignore non contiene output/*/renders/');

// 7. PEXELS_API_KEY
require('dotenv').config({ path: path.join(ROOT, '.env') });
if (process.env.PEXELS_API_KEY) ok('PEXELS_API_KEY presente');
else fail('PEXELS_API_KEY mancante in .env');

// 8. TTS key
if (process.env.OPENAI_API_KEY) ok('OPENAI_API_KEY presente');
else if (process.env.ELEVENLABS_API_KEY) ok('ELEVENLABS_API_KEY presente');
else fail('nessuna TTS key trovata — aggiungi OPENAI_API_KEY o ELEVENLABS_API_KEY in .env');

console.log('');
if (allOk) {
  console.log('✅ Tutti i prerequisiti soddisfatti — puoi procedere con TEST 1.');
} else {
  console.log('❌ Alcuni prerequisiti mancano. Risolvi i ❌ prima di procedere.');
  process.exit(1);
}
