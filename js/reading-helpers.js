import { normalizeId } from './data.js';

export function getBaseId(id, normalizeFn = normalizeId) {
  const normalized = normalizeFn(String(id ?? ''));
  return normalized.replace(/-(upright|reversed)$/i, '');
}

export function getOrientation(id) {
  return /-reversed$/i.test(String(id ?? '')) ? 'reversed' : 'upright';
}

export function toSeoSlugFromId(id, normalizeFn = normalizeId) {
  return getBaseId(id, normalizeFn);
}

export function matchesCardId(card, candidateId, normalizeFn = normalizeId) {
  if (!card) return false;
  const candidate = String(candidateId ?? '');
  const normalizedCandidate = normalizeFn(candidate);
  const normalizedCandidateBase = getBaseId(candidate, normalizeFn);

  const idsToCheck = [
    card.id,
    card.card_id,
    card.legacy_id,
    card.seo_slug_en,
    card.seo_slug_th,
    card.seo_slug,
    card.slug,
  ]
    .map((val) => (val == null ? '' : String(val)))
    .filter(Boolean);

  const normalizedBaseIds = idsToCheck.map((val) => getBaseId(val, normalizeFn)).filter(Boolean);

  return idsToCheck.some((val) => {
    const normalizedVal = normalizeFn(val);
    return val === candidate || normalizedVal === normalizedCandidate;
  }) || normalizedBaseIds.includes(normalizedCandidateBase);
}

export function findCardById(cards, id, normalizeFn = normalizeId) {
  const idStr = String(id ?? '');
  if (!idStr) return null;
  const hasOrientationSuffix = /-(upright|reversed)$/i.test(idStr);
  const baseId = getBaseId(idStr, normalizeFn);

  const deck = Array.isArray(cards) ? cards : [];
  const candidates = hasOrientationSuffix
    ? [idStr, baseId]
    : [`${baseId}-reversed`, `${baseId}-upright`, baseId];

  for (const candidate of candidates) {
    const hit = deck.find((card) => matchesCardId(card, candidate, normalizeFn));
    if (hit) return hit;
  }

  return null;
}
