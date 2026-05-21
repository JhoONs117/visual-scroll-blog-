'use strict';

require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { hashQuery } = require('./video-utils');

const CACHE_DIR = path.resolve(__dirname, '../cache/video-clips');

function loadVideoCache(query) {
  const file = path.join(CACHE_DIR, `${hashQuery(query)}.json`);
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function saveVideoCache(query, results) {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, `${hashQuery(query)}.json`);
  fs.writeFileSync(file, JSON.stringify(results, null, 2));
}

async function searchPexels(query, { orientation = 'portrait', minDuration = 3 } = {}) {
  const res = await axios.get('https://api.pexels.com/videos/search', {
    headers: { Authorization: process.env.PEXELS_API_KEY },
    params: { query, orientation, per_page: 10, size: 'medium' },
  });

  const videos = (res.data.videos || []).filter(v => {
    const file = v.video_files?.find(f => f.quality === 'hd' || f.quality === 'sd');
    return file && v.duration >= minDuration;
  });

  return videos.map(v => ({
    id: v.id,
    duration: v.duration,
    url: (v.video_files.find(f => f.quality === 'hd') || v.video_files[0]).link,
  }));
}

async function fetchPexelsVideo(query, options = {}) {
  const {
    sceneIndex = 0,
    usedClipIds = new Set(),
    minDuration = 3,
    orientation = 'portrait',
  } = options;

  const cached = loadVideoCache(query);
  const results = cached || await searchPexels(query, { orientation, minDuration });
  if (!cached && results.length > 0) saveVideoCache(query, results);

  if (results.length === 0) return { type: 'black', duration: minDuration };

  let clip = null;
  for (let i = 0; i < results.length; i++) {
    const candidate = results[(sceneIndex + i) % results.length];
    if (!usedClipIds.has(candidate.id)) {
      clip = candidate;
      usedClipIds.add(candidate.id);
      break;
    }
  }

  if (!clip) return { type: 'black', duration: minDuration };
  return { type: 'video', id: clip.id, url: clip.url, duration: clip.duration };
}

module.exports = { fetchPexelsVideo };
