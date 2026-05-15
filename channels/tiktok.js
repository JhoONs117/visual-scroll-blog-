'use strict';

function adapt(article) {
  const formats = { ...(article.formats || {}) };
  const tiktok = { ...(formats.tiktok || {}) };

  let script = tiktok.script ?? article.video_script ?? [];
  if (!Array.isArray(script)) script = [];

  // Normalize to exactly 5 strings
  const normalized = Array.from({ length: 5 }, (_, i) =>
    (typeof script[i] === 'string' ? script[i] : '')
  );

  tiktok.script = normalized;
  formats.tiktok = tiktok;
  return { ...article, formats };
}

module.exports = { adapt };
