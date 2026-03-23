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

function ensureSentence(value) {
  const text = asString(value).replace(/\s+/g, ' ');
  if (!text) return '';
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function stripTrailingPunctuation(value) {
  return asString(value).replace(/[.!?]+$/, '');
}

function lowerFirst(value) {
  const text = asString(value);
  if (!text) return '';
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function buildTopicLabel(topic = '') {
  const normalized = asString(topic).toLowerCase();
  if (normalized === 'love') return 'your love life';
  if (normalized === 'career') return 'your career path';
  if (normalized === 'finance') return 'your financial situation';
  return 'this question';
}

function pickQuestionThread(...values) {
  return values.map(ensureSentence).find(Boolean) || '';
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

function firstSentence(value) {
  const text = ensureSentence(value);
  if (!text) return '';
  const match = text.match(/^(.+?[.!?])(?:\s|$)/);
  return match ? match[1].trim() : text;
}

function compactText(value, maxWords = 18) {
  const text = asString(value).replace(/\s+/g, ' ');
  if (!text) return '';

  const words = text.split(' ');
  if (words.length <= maxWords) return text;
  return `${words.slice(0, maxWords).join(' ')}…`;
}

export function generateQuestionReading(llmInput = {}) {
  const cardsByPosition = toQuestionCardMap(llmInput?.cards);
  const spread = buildQuestionSpread(cardsByPosition);
  const past = cardsByPosition.past || {};
  const present = cardsByPosition.present || {};
  const future = cardsByPosition.future || {};
  const synthesisBase = ensureSentence(llmInput?.reading_summary_preview_en);
  const pastThread = pickQuestionThread(past.reading_summary_preview_en, past.meaning);
  const presentThread = pickQuestionThread(present.reading_summary_preview_en, present.meaning);
  const futureThread = pickQuestionThread(future.reading_summary_preview_en, future.meaning);
  const topicLabel = buildTopicLabel(llmInput?.topic);
  const introLead = stripTrailingPunctuation(synthesisBase || presentThread || present.meaning || pastThread || futureThread);
  const intro = asString(
    introLead
      ? `Right now, ${topicLabel} centers on ${asString(present.card) || 'the present moment'}: ${lowerFirst(introLead)}.`
      : ''
  );
  const synthesis = asString([
    pastThread,
    presentThread && pastThread
      ? `Now, ${asString(present.card) || 'the present card'} asks for this response: ${lowerFirst(presentThread)}`
      : presentThread,
    synthesisBase && synthesisBase !== presentThread
      ? `Taken together, it shows that ${lowerFirst(synthesisBase)}`
      : '',
    futureThread && (pastThread || presentThread || synthesisBase)
      ? `That opens into ${lowerFirst(futureThread)}`
      : futureThread,
  ].filter(Boolean).join(' '));
  const beneathSurface = stripTrailingPunctuation(synthesisBase || presentThread || pastThread || present.meaning || past.meaning || future.meaning);
  const nextFocus = ensureSentence(present.meaning || future.meaning || presentThread || futureThread);
  const takeaway = asString([
    beneathSurface ? `Beneath the surface, ${lowerFirst(beneathSurface)}.` : '',
    nextFocus ? `Next, focus on this: ${nextFocus}` : '',
  ].filter(Boolean).join(' '));

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


export function generateQuestionShareSummary(reading = {}) {
  const cardsByPosition = toQuestionCardMap(reading?.spread);
  const past = cardsByPosition.past || {};
  const present = cardsByPosition.present || {};
  const future = cardsByPosition.future || {};
  const actionCard = asString(reading?.action?.card || present.card);
  const actionInsight = firstSentence(reading?.action?.insight || present.meaning || reading?.takeaway || reading?.synthesis || reading?.intro);
  const headline = compactText(
    actionCard && actionInsight
      ? `${actionCard}: it's time to ${lowerFirst(stripTrailingPunctuation(actionInsight))}`
      : actionInsight || firstSentence(reading?.intro),
    14,
  );
  const summary = compactText([
    firstSentence(past.meaning),
    firstSentence(actionInsight && actionInsight !== firstSentence(past.meaning)
      ? `Right now, ${lowerFirst(actionInsight)}`
      : present.meaning),
    firstSentence(future.meaning ? `Next, ${lowerFirst(future.meaning)}` : ''),
  ].filter(Boolean).join(' '), 28);
  const ctaSource = firstSentence(reading?.action?.direction)
    || firstSentence(actionInsight ? `Let this guide your next move: ${lowerFirst(actionInsight)}` : `Move toward this: ${lowerFirst(future.meaning)}`)
    || 'Take the next clear step.';

  return {
    headline,
    summary,
    cta: compactText(ctaSource, 14),
  };
}
