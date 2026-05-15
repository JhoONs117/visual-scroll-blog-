'use strict';

function adapt(article) {
  const formats = { ...(article.formats || {}) };
  const x = { ...(formats.x || {}) };

  let thread = x.thread ?? article.thread_text ?? [];
  if (!Array.isArray(thread)) thread = [];

  // Normalize to exactly 5 strings
  const normalized = Array.from({ length: 5 }, (_, i) =>
    (typeof thread[i] === 'string' ? thread[i] : '')
  );

  x.thread = normalized;
  formats.x = x;
  return { ...article, formats };
}

module.exports = { adapt };
