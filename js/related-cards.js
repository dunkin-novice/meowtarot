import { normalizeId } from './data.js';

function normalizeText(value = '') {
  return String(value || '').trim().toLowerCase();
}

function splitKeywords(value = '') {
  return String(value || '')
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

function toCardOrder(card = {}) {
  const raw = card.card_id || card.id || '';
  const match = String(raw).match(/^(\d{2})/);
  return match ? parseInt(match[1], 10) : null;
}

function toArcanaGroup(order) {
  if (!order) return 'major';
  if (order <= 22) return 'major';
  if (order <= 36) return 'wands';
  if (order <= 50) return 'cups';
  if (order <= 64) return 'swords';
  return 'pentacles';
}

function baseSlug(card = {}) {
  const normalized = normalizeId(card.seo_slug_en || card.card_id || card.id || '');
  return normalized
    .replace(/-(upright|reversed)(?=-|$)/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function overlapCount(a = [], b = []) {
  if (!a.length || !b.length) return 0;
  const set = new Set(a);
  return b.reduce((count, item) => count + (set.has(item) ? 1 : 0), 0);
}

function pickOrientationCard(group, orientation) {
  if (orientation === 'reversed') return group.reversed || group.upright || group.primary;
  return group.upright || group.reversed || group.primary;
}

function buildCardGroups(cards = []) {
  const map = new Map();
  cards.forEach((card) => {
    const slug = baseSlug(card);
    if (!slug) return;
    if (!map.has(slug)) {
      map.set(slug, {
        slug,
        upright: null,
        reversed: null,
        primary: null,
      });
    }

    const entry = map.get(slug);
    const orientation = normalizeText(card.orientation);
    if (orientation === 'reversed') entry.reversed = card;
    else entry.upright = card;
    entry.primary = entry.upright || entry.reversed || entry.primary || card;
  });

  return Array.from(map.values());
}

function scoreCandidate(current, candidate, orientation) {
  const currentOrder = toCardOrder(current);
  const candidateOrder = toCardOrder(candidate);
  const currentGroup = toArcanaGroup(currentOrder);
  const candidateGroup = toArcanaGroup(candidateOrder);

  let score = 0;

  if (currentGroup === candidateGroup) score += 35;
  if (normalizeText(current.numerology_value) && normalizeText(current.numerology_value) === normalizeText(candidate.numerology_value)) score += 16;
  if (normalizeText(current.element) && normalizeText(current.element) === normalizeText(candidate.element)) score += 12;
  if (normalizeText(current.planet) && normalizeText(current.planet) === normalizeText(candidate.planet)) score += 10;

  if (currentGroup === 'major' && candidateGroup === 'major' && currentOrder && candidateOrder) {
    const distance = Math.abs(currentOrder - candidateOrder);
    if (distance === 1) score += 18;
    else if (distance === 2) score += 12;
    else if (distance === 3) score += 6;
  }

  const currentKeywords = orientation === 'reversed'
    ? splitKeywords(current.keywords_shadow)
    : splitKeywords(current.keywords_light);

  const candidateKeywords = orientation === 'reversed'
    ? splitKeywords(candidate.keywords_shadow)
    : splitKeywords(candidate.keywords_light);

  score += overlapCount(currentKeywords, candidateKeywords) * 3;

  return score;
}

function sortStable(scored = []) {
  return scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aOrder = toCardOrder(a.card) || 999;
    const bOrder = toCardOrder(b.card) || 999;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return (a.slug || '').localeCompare(b.slug || '');
  });
}

export function getRelatedCards(currentCard, cards, options = {}) {
  const limit = Math.max(4, Math.min(6, options.limit || 6));
  const orientation = normalizeText(options.orientation || currentCard?.orientation || 'upright') === 'reversed'
    ? 'reversed'
    : 'upright';

  if (!currentCard || !Array.isArray(cards) || !cards.length) return [];

  const currentSlug = baseSlug(currentCard);
  const groups = buildCardGroups(cards);

  const scored = groups
    .filter((group) => group.slug !== currentSlug)
    .map((group) => {
      const orientedCandidate = pickOrientationCard(group, orientation);
      const fallbackCandidate = group.primary;
      const candidate = orientedCandidate || fallbackCandidate;
      if (!candidate) return null;

      return {
        slug: group.slug,
        card: candidate,
        score: scoreCandidate(currentCard, candidate, orientation),
      };
    })
    .filter(Boolean);

  return sortStable(scored)
    .slice(0, limit)
    .map((entry) => ({
      slug: entry.slug,
      card_name_en: entry.card.card_name_en || entry.card.name_en || entry.card.id || entry.slug,
      alias_th: entry.card.alias_th || entry.card.name_th || '',
      archetype_en: entry.card.archetype_en || '',
      score: entry.score,
    }));
}
