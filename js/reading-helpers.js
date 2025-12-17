import { normalizeId } from './data.js';

export function getBaseId(id, normalizeFn = normalizeId) {
  const normalized = normalizeFn(String(id ?? ''));
  return normalized.replace(/-(upright|reversed)$/i, '');
}

export function getBaseCardId(id, normalizeFn = normalizeId) {
  return getBaseId(id, normalizeFn);
}

export function toOrientation(input) {
  if (input && typeof input === 'object') {
    if (typeof input.orientation === 'string' && input.orientation.toLowerCase().includes('reversed')) {
      return 'reversed';
    }
    if (typeof input.orientation === 'string' && input.orientation.toLowerCase().includes('upright')) {
      return 'upright';
    }
    if (input.id) return toOrientation(input.id);
  }

  const str = String(input ?? '');
  return /-reversed$/i.test(str) || /reversed/i.test(str) ? 'reversed' : 'upright';
}

export function getOrientation(id) {
  return toOrientation(id);
}

export function toSeoSlugFromId(id, normalizeFn = normalizeId) {
  return getBaseId(id, normalizeFn);
}

export function matchesCardId(card, candidateId, normalizeFn = normalizeId, options = {}) {
  if (!card) return false;

  const { orientation = null, requireOrientationMatch = false } = options;
  const candidate = String(candidateId ?? '');
  if (!candidate) return false;

  const targetOrientation = orientation || toOrientation(candidate);
  const cardOrientation = toOrientation(card);
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

  const hasDirectIdMatch = idsToCheck.some((val) => {
    const normalizedVal = normalizeFn(val);
    return val === candidate || normalizedVal === normalizedCandidate;
  });

  if (hasDirectIdMatch && (!requireOrientationMatch || cardOrientation === targetOrientation)) {
    return true;
  }

  if (requireOrientationMatch) {
    return cardOrientation === targetOrientation && normalizedBaseIds.includes(normalizedCandidateBase);
  }

  return hasDirectIdMatch || normalizedBaseIds.includes(normalizedCandidateBase);
}

export function findCardById(cards, id, normalizeFn = normalizeId) {
  const idStr = String(id ?? '');
  if (!idStr) return null;

  const hasOrientationSuffix = /-(upright|reversed)$/i.test(idStr);
  const targetOrientation = toOrientation(idStr);
  const baseId = getBaseId(idStr, normalizeFn);
  const deck = Array.isArray(cards) ? cards : [];

  const orientedCandidates = hasOrientationSuffix
    ? [idStr, `${baseId}-${targetOrientation}`]
    : [`${baseId}-${targetOrientation}`];

  const fallbackCandidates = hasOrientationSuffix
    ? [baseId]
    : [`${baseId}-reversed`, `${baseId}-upright`, baseId];

  const tryFind = (candidates, requireOrientationMatch) => {
    for (const candidate of candidates) {
      const hit = deck.find((card) =>
        matchesCardId(card, candidate, normalizeFn, { orientation: targetOrientation, requireOrientationMatch })
      );
      if (hit) return hit;
    }
    return null;
  };

  return (
    tryFind(orientedCandidates, true)
    || tryFind(orientedCandidates, false)
    || tryFind(fallbackCandidates, false)
  );
}
