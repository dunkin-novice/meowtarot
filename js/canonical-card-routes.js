const CANONICAL_CARD_SLUGS = new Set([
  'the-fool',
  'the-magician',
  'the-high-priestess',
  'the-empress',
  'the-emperor',
  'the-hierophant',
  'the-lovers',
  'the-chariot',
  'strength',
  'the-hermit',
  'wheel-of-fortune',
  'justice',
  'the-hanged-man',
  'death',
  'temperance',
  'the-devil',
  'the-tower',
  'the-star',
  'the-moon',
  'the-sun',
  'judgement',
  'the-world',
]);

export const CANONICAL_CARD_ORDER = Object.freeze([
  'the-fool',
  'the-magician',
  'the-high-priestess',
  'the-empress',
  'the-emperor',
  'the-hierophant',
  'the-lovers',
  'the-chariot',
  'strength',
  'the-hermit',
  'wheel-of-fortune',
  'justice',
  'the-hanged-man',
  'death',
  'temperance',
  'the-devil',
  'the-tower',
  'the-star',
  'the-moon',
  'the-sun',
  'judgement',
  'the-world',
]);

export function normalizeCanonicalSlug(slug = '') {
  return String(slug || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/-(upright|reversed)(?=-|$)/g, '')
    .replace(/-tarot-meaning$/, '')
    .replace(/^-+|-+$/g, '');
}

export function isCanonicalCardSlug(slug = '') {
  return CANONICAL_CARD_SLUGS.has(normalizeCanonicalSlug(slug));
}

export function getCanonicalCardPath(slug = '', lang = 'en') {
  const normalized = normalizeCanonicalSlug(slug);
  if (!isCanonicalCardSlug(normalized)) return null;
  const prefix = lang === 'th' ? '/th' : '';
  return `${prefix}/cards/${normalized}/`;
}

export function getCanonicalCardUrl(slug = '', lang = 'en') {
  const path = getCanonicalCardPath(slug, lang);
  if (!path) return null;
  return `https://www.meowtarot.com${path}`;
}
