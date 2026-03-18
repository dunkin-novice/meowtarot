function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asString(value, fallback = '') {
  if (value == null) return fallback;
  return String(value);
}

function normalizeMode(rawMode) {
  const value = String(rawMode || '').toLowerCase().trim();
  if (['full', 'overall', 'life'].includes(value)) return 'full';
  if (['question', 'ask'].includes(value)) return 'question';
  return 'single';
}

function resolveReading(raw) {
  return asObject(
    raw.reading
    || raw.reading_full
    || raw.overall_reading
    || raw.full_reading
    || raw.reading_single
  );
}

function resolveCards(raw, reading) {
  if (Array.isArray(raw.cards)) return raw.cards;
  if (Array.isArray(reading.cards)) return reading.cards;
  if (Array.isArray(raw?.selected?.cards)) return raw.selected.cards;
  if (Array.isArray(raw?.board?.cards)) return raw.board.cards;
  return [];
}

function normalizeOrientation(value) {
  return String(value || '').toLowerCase() === 'reversed' ? 'reversed' : 'upright';
}

const FULL_POSITIONS = ['present', 'challenge', 'past', 'future', 'above', 'below', 'advice', 'external', 'hopes', 'outcome'];
const LEGACY_FULL_POSITIONS = ['past', 'present', 'future'];
const QUESTION_POSITIONS = ['past', 'present', 'future'];

function normalizeCards(cards = []) {
  return cards
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      ...item,
      id: asString(item.id || item.card_id || item.cardId || item.image_id),
      orientation: normalizeOrientation(item.orientation || item.id),
      image: asString(item.image),
      image_upright: asString(item.image_upright || item.imageUpright),
      image_reversed: asString(item.image_reversed || item.imageReversed),
      resolvedImageUrl: asString(item.resolvedImageUrl || item.imageUrl),
      position: asString(item.position || item.slot || item.label),
    }))
    .filter((item) => item.id);
}

export function normalizePayload(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const source = asObject(raw);
  const reading = resolveReading(source);
  const mode = normalizeMode(source.mode || source?.poster?.mode);
  let cards = normalizeCards(resolveCards(source, reading));
  if (mode === 'question') {
    cards = cards.map((card, index) => ({
      ...card,
      position: card.position || (cards.length === 1 ? 'present' : (QUESTION_POSITIONS[index] || 'present')),
    }));
  }
  if (mode === 'full' && cards.length >= 10) {
    cards = cards.map((card, index) => ({ ...card, position: card.position || FULL_POSITIONS[index] || FULL_POSITIONS[FULL_POSITIONS.length - 1] }));
  }
  if (mode === 'full' && cards.length === 3) {
    cards = cards.map((card, index) => ({ ...card, position: card.position || LEGACY_FULL_POSITIONS[index] || 'present' }));
  }
  const posterSource = asObject(source.poster);

  const title = asString(posterSource.title ?? source.title, 'MeowTarot Reading');
  const subtitle = asString(posterSource.subtitle ?? source.subtitle, '');
  const footer = asString(posterSource.footer ?? source.footer, 'meowtarot.com');

  return {
    ...source,
    mode,
    reading,
    cards,
    title,
    subtitle,
    poster: {
      ...posterSource,
      title,
      subtitle,
      footer,
    },
  };
}
