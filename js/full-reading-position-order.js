export const FULL_READING_POSITION_KEYS = [
  'present',
  'challenge',
  'above',
  'past',
  'below',
  'future',
  'advice',
  'external',
  'hopes',
  'outcome',
];

export function getFullReadingPositionKeys(totalCards = 0, { legacyKeys = [] } = {}) {
  return totalCards === legacyKeys.length && legacyKeys.length ? legacyKeys : FULL_READING_POSITION_KEYS;
}

export function getFullReadingPositionAt(index, totalCards = 0, options = {}) {
  const keys = getFullReadingPositionKeys(totalCards, options);
  return keys[index] || FULL_READING_POSITION_KEYS[index] || 'present';
}

export function getFullReadingPositionMeta(cards = [], options = {}) {
  return cards.map((card, index) => ({
    card,
    index,
    position: card?.position || getFullReadingPositionAt(index, cards.length, options),
  }));
}
