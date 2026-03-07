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
    }))
    .filter((item) => item.id);
}

export function normalizePayload(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const source = asObject(raw);
  const reading = resolveReading(source);
  const cards = normalizeCards(resolveCards(source, reading));
  const posterSource = asObject(source.poster);

  const title = asString(posterSource.title ?? source.title, 'MeowTarot Reading');
  const subtitle = asString(posterSource.subtitle ?? source.subtitle, '');
  const footer = asString(posterSource.footer ?? source.footer, 'meowtarot.com');

  return {
    ...source,
    mode: normalizeMode(source.mode || source?.poster?.mode),
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
