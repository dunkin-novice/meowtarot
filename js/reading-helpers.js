import { normalizeId } from './data.js';

export function matchesCardId(card, candidateId, normalizeFn = normalizeId) {
  if (!card) return false;
  const candidate = String(candidateId ?? '');
  const normalizedCandidate = normalizeFn(candidate);

  const idsToCheck = [card.id, card.card_id, card.legacy_id]
    .map((val) => (val == null ? '' : String(val)))
    .filter(Boolean);

  const normalizedBaseIds = idsToCheck
    .filter((val) => val.toLowerCase().endsWith('-reversed'))
    .map((val) => normalizeFn(val.replace(/-reversed$/, '')));

  return idsToCheck.some((val) => {
    const normalizedVal = normalizeFn(val);
    return val === candidate || normalizedVal === normalizedCandidate;
  }) || normalizedBaseIds.includes(normalizedCandidate);
}

export function findCardById(cards, id, normalizeFn = normalizeId) {
  const idStr = String(id ?? '');
  if (!idStr) return null;
  const baseId = idStr.endsWith('-reversed') ? idStr.replace(/-reversed$/, '') : idStr;

  const deck = Array.isArray(cards) ? cards : [];
  return (
    deck.find((card) => matchesCardId(card, idStr, normalizeFn))
    || deck.find((card) => matchesCardId(card, baseId, normalizeFn))
    || null
  );
}
