import { normalizeId } from './data.js';
import { getBaseCardId, toOrientation } from './reading-helpers.js';

const MODE_TO_COMPACT = Object.freeze({ daily: 'd', full: 'f', question: 'q' });
const COMPACT_TO_MODE = Object.freeze({ d: 'daily', f: 'full', q: 'question' });

const TOPIC_TO_COMPACT = Object.freeze({
  generic: 'g',
  love: 'l',
  career: 'c',
  finance: 'fn',
  health: 'h',
  family: 'fm',
  travel: 't',
  self: 's',
  other: 'o',
});

const COMPACT_TO_TOPIC = Object.freeze(
  Object.entries(TOPIC_TO_COMPACT).reduce((acc, [topic, compact]) => {
    acc[compact] = topic;
    return acc;
  }, {}),
);

function asSearchParams(input) {
  if (input instanceof URLSearchParams) return input;
  if (input instanceof URL) return input.searchParams;
  if (typeof input === 'string') return new URLSearchParams(input);
  if (input && typeof input === 'object' && typeof input.search === 'string') {
    return new URLSearchParams(input.search);
  }
  return new URLSearchParams();
}

function normalizeModeValue(rawMode = '') {
  const value = String(rawMode || '').trim().toLowerCase();
  if (COMPACT_TO_MODE[value]) return COMPACT_TO_MODE[value];
  if (['daily', 'day'].includes(value)) return 'daily';
  if (['full', 'overall', 'life'].includes(value)) return 'full';
  if (['question', 'ask'].includes(value)) return 'question';
  return '';
}

function normalizeTopicValue(rawTopic = '') {
  const value = String(rawTopic || '').trim().toLowerCase();
  if (!value) return '';
  return COMPACT_TO_TOPIC[value] || value;
}

function splitCardList(rawList = '') {
  return String(rawList || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function encodeCompactCardToken(cardId = '') {
  const orientation = toOrientation(cardId) === 'reversed' ? 'r' : 'u';
  const baseId = getBaseCardId(cardId, normalizeId);
  const cardNumber = String(baseId || '').match(/^(\d{1,3})\b/);
  if (!cardNumber) return `${baseId}${orientation}`;
  return `${Number(cardNumber[1])}${orientation}`;
}

export function decodeCompactCardToken(token = '') {
  const match = String(token || '').trim().toLowerCase().match(/^(\d{1,3})([ur])$/);
  if (!match) return null;
  return {
    cardNumber: Number(match[1]),
    orientation: match[2] === 'r' ? 'reversed' : 'upright',
  };
}

export function normalizeLegacyReadingQuery(searchInput) {
  const params = asSearchParams(searchInput);
  const mode = normalizeModeValue(params.get('m') || params.get('mode'));
  const spread = (params.get('s') || params.get('spread') || '').trim();
  const topic = normalizeTopicValue(params.get('t') || params.get('topic'));
  const lang = (params.get('l') || params.get('lang') || '').trim().toLowerCase();
  const cards = splitCardList(params.get('c') || params.get('cards') || params.get('ids'));
  const single = (params.get('card') || params.get('id') || '').trim();

  return {
    mode,
    spread,
    topic,
    lang,
    cards: single ? [single] : cards,
    hasAnySelection: ['c', 'cards', 'ids', 'card', 'id'].some((key) => params.has(key)),
  };
}

function resolveCompactCardToken(token, resolveCompactTokenToId) {
  const decoded = decodeCompactCardToken(token);
  if (!decoded) return token;
  if (typeof resolveCompactTokenToId === 'function') {
    const resolved = resolveCompactTokenToId(decoded);
    if (resolved) return resolved;
  }
  return `${decoded.cardNumber}-${decoded.orientation}`;
}

export function parseReadingStateFromUrl(searchInput, options = {}) {
  const normalized = normalizeLegacyReadingQuery(searchInput);
  const cards = normalized.cards.map((token) => resolveCompactCardToken(token, options.resolveCompactTokenToId));

  return {
    mode: normalized.mode,
    spread: normalized.spread,
    topic: normalized.topic,
    lang: normalized.lang,
    cards,
    hasAnySelection: normalized.hasAnySelection,
  };
}

export function serializeReadingStateToUrl(state = {}, options = {}) {
  const params = new URLSearchParams();
  const mode = String(state.mode || '').trim().toLowerCase();
  const spread = String(state.spread || '').trim();
  const topic = String(state.topic || '').trim().toLowerCase();
  const lang = String(state.lang || '').trim().toLowerCase();
  const cards = Array.isArray(state.cards) ? state.cards : [];

  if (mode) params.set('m', MODE_TO_COMPACT[mode] || mode);
  if (spread) params.set('s', spread);
  if (topic) params.set('t', TOPIC_TO_COMPACT[topic] || topic);
  if (cards.length) params.set('c', cards.map((id) => encodeCompactCardToken(id)).join(','));
  if (lang) params.set('l', lang);

  const path = options.path || '/reading.html';
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function buildShareUrl({ origin, path = '/reading.html', state = {} } = {}) {
  const relative = serializeReadingStateToUrl({
    mode: state.mode,
    spread: state.spread,
    topic: state.topic,
    lang: state.lang,
    cards: state.cards,
  }, { path });

  if (!origin) return relative;
  return new URL(relative, origin).toString();
}
