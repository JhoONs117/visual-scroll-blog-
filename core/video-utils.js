'use strict';

const { execSync } = require('child_process');
const crypto = require('crypto');
const path = require('path');

const FONT_PATH = path.resolve(__dirname, '../assets/fonts/Inter-Bold.ttf');

function estimateDuration(text, wpm = 130) {
  const words = text.trim().split(/\s+/).length;
  return Math.max(2.5, Math.min(5, Math.ceil(words * 60 / wpm)));
}

function hashQuery(query) {
  return crypto.createHash('md5').update(query.toLowerCase().trim()).digest('hex');
}

function buildBlackClip(outputPath, duration) {
  return new Promise((resolve, reject) => {
    try {
      execSync(
        `ffmpeg -y -f lavfi -i color=c=black:s=1080x1920:r=30 ` +
        `-f lavfi -i anullsrc=r=44100:cl=stereo ` +
        `-t ${duration} -shortest -c:v libx264 -c:a aac "${outputPath}"`,
        { stdio: 'pipe' }
      );
      resolve();
    } catch (err) {
      reject(new Error(`buildBlackClip failed: ${err.stderr?.toString() || err.message}`));
    }
  });
}

function verifyMp4(filePath) {
  const raw = execSync(
    `ffprobe -v quiet -print_format json -show_streams -show_format "${filePath}"`,
    { stdio: 'pipe' }
  ).toString();
  const data = JSON.parse(raw);
  const video = data.streams.find(s => s.codec_type === 'video');
  const sizeBytes = parseInt(data.format?.size || '0');
  const duration = parseFloat(data.format?.duration || '0');

  if (!video) throw new Error('nessuno stream video trovato');
  if (video.codec_name !== 'h264') throw new Error(`codec ${video.codec_name} — atteso h264`);
  if (sizeBytes > 50 * 1024 * 1024) throw new Error(`file ${(sizeBytes / 1024 / 1024).toFixed(1)}MB supera il limite TikTok di 50MB`);

  return { width: video.width, height: video.height, duration, sizeBytes, codec: video.codec_name };
}

module.exports = { estimateDuration, hashQuery, buildBlackClip, verifyMp4, FONT_PATH };
