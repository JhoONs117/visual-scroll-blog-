'use strict';

function adapt(article) {
  const formats = { ...(article.formats || {}) };
  const instagram = { ...(formats.instagram || {}) };

  if (typeof instagram.caption !== 'string') {
    instagram.caption = typeof article.instagram_caption === 'string'
      ? article.instagram_caption
      : '';
  }

  if (!Array.isArray(instagram.carousel)) {
    instagram.carousel = Array.isArray(article.carousel_slides)
      ? article.carousel_slides
      : [];
  }

  formats.instagram = instagram;
  return { ...article, formats };
}

module.exports = { adapt };
