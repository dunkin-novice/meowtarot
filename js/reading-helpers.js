import { normalizeId } from './data.js';
import { normalizeQuestionCardPosition, orderQuestionCards, QUESTION_CARD_POSITIONS } from './question-card-order.js';

export function getBaseId(id, normalizeFn = normalizeId) {
  const normalized = normalizeFn(String(id ?? ''));
  return normalized.replace(/-(upright|reversed|u|r)$/i, '');
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
  if (/(?:-reversed|-r)$/i.test(str) || /reversed/i.test(str)) return 'reversed';
  if (/(?:-upright|-u)$/i.test(str) || /upright/i.test(str)) return 'upright';
  return 'upright';
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

  const hasOrientationSuffix = /-(upright|reversed|u|r)$/i.test(idStr);
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

function normalizeQuestionTopic(topic = '') {
  const normalized = String(topic || '').toLowerCase().trim();
  return ['love', 'career', 'finance'].includes(normalized) ? normalized : 'other';
}

export function getQuestionMeaningField(topic = 'other', position = 'present') {
  const normalizedPosition = normalizeQuestionCardPosition(position) || 'present';
  const normalizedTopic = normalizeQuestionTopic(topic);
  const fieldPrefix = normalizedTopic === 'other' ? 'standalone' : normalizedTopic;
  return `${fieldPrefix}_${normalizedPosition}_en`;
}

export function buildQuestionReadingInputPayload({ topic = 'other', selectedIds = [], cards = [] } = {}) {
  const orderedSelections = orderQuestionCards(
    (Array.isArray(selectedIds) ? selectedIds : []).map((entry) => (
      entry && typeof entry === 'object'
        ? { ...entry }
        : { id: entry }
    )),
  ).slice(0, QUESTION_CARD_POSITIONS.length);

  const spread = orderedSelections
    .map((selection, index) => {
      const position = normalizeQuestionCardPosition(selection?.position) || QUESTION_CARD_POSITIONS[index] || 'present';
      const selectedId = selection?.id || selection?.card_id || selection?.seo_slug_en || '';
      const card = findCardById(cards, selectedId, normalizeId);
      if (!card) return null;

      return {
        position,
        card: card.card_name_en || card.name_en || card.name || card.id || selectedId,
        meaning: card[getQuestionMeaningField(topic, position)] || '',
        reading_summary_preview_en: card.reading_summary_preview_en || '',
        _action_prompt_en: card.action_prompt_en || '',
        _reflection_question_en: card.reflection_question_en || '',
        _affirmation_en: card.affirmation_en || '',
      };
    })
    .filter(Boolean);

  const presentCard = spread.find((card) => card.position === 'present') || spread[1] || null;

  return {
    topic: normalizeQuestionTopic(topic),
    reading_summary_preview_en: presentCard?.reading_summary_preview_en || '',
    cards: spread.map((card) => ({
      position: card.position,
      card: card.card,
      meaning: card.meaning,
      reading_summary_preview_en: card.reading_summary_preview_en,
    })),
    action: {
      prompt: presentCard?._action_prompt_en || '',
      reflection: presentCard?._reflection_question_en || '',
      affirmation: presentCard?._affirmation_en || '',
    },
  };
}

function asString(value) {
  return value == null ? '' : String(value).trim();
}

function toQuestionCardMap(cards = []) {
  return orderQuestionCards(Array.isArray(cards) ? cards : [])
    .slice(0, QUESTION_CARD_POSITIONS.length)
    .reduce((acc, card) => {
      const position = normalizeQuestionCardPosition(card?.position);
      if (position && !acc[position]) acc[position] = card;
      return acc;
    }, {});
}

function buildQuestionSpread(cardsByPosition = {}) {
  return QUESTION_CARD_POSITIONS.map((position) => {
    const card = cardsByPosition[position] || {};
    return {
      position,
      card: asString(card.card),
      meaning: asString(card.meaning),
    };
  }).filter((entry) => entry.card || entry.meaning);
}

export function generateQuestionReading(llmInput = {}) {
  const cardsByPosition = toQuestionCardMap(llmInput?.cards);
  const spread = buildQuestionSpread(cardsByPosition);
  const past = cardsByPosition.past || {};
  const present = cardsByPosition.present || {};
  const future = cardsByPosition.future || {};
  const synthesisBase = asString(llmInput?.reading_summary_preview_en);
  const intro = asString(
    synthesisBase
    || present.meaning
    || past.meaning
    || future.meaning
  );
  const synthesis = asString(
    synthesisBase
    || [past.meaning, present.meaning, future.meaning].filter(Boolean).join(' ')
  );
  const takeaway = asString(
    [synthesisBase, future.meaning || present.meaning || past.meaning].filter(Boolean).join(' ').trim()
  );

  return {
    intro,
    spread,
    synthesis,
    takeaway,
    action: {
      position: 'present',
      card: asString(present.card),
      insight: asString(present.meaning),
      direction: asString(llmInput?.action?.prompt),
    },
  };
}
