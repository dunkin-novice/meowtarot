export const QUESTION_CARD_POSITIONS = ['past', 'present', 'future'];

export function normalizeQuestionCardPosition(position = '') {
  const normalized = String(position || '').toLowerCase().trim();
  return QUESTION_CARD_POSITIONS.includes(normalized) ? normalized : '';
}

export function orderQuestionCards(cards = []) {
  if (!Array.isArray(cards) || !cards.length) return [];

  const decorated = cards.map((card, index) => ({
    card,
    index,
    position: normalizeQuestionCardPosition(card?.position),
  }));

  if (decorated.length === 1) {
    const [{ card, position }] = decorated;
    return [{ ...card, position: position || 'present' }];
  }

  const assignedPositions = new Set(decorated.map((entry) => entry.position).filter(Boolean));
  const remainingPositions = QUESTION_CARD_POSITIONS.filter((position) => !assignedPositions.has(position));
  let fallbackIndex = 0;

  return decorated
    .map((entry) => ({
      ...entry,
      position: entry.position || remainingPositions[fallbackIndex++] || 'present',
    }))
    .sort((left, right) => {
      const leftIndex = QUESTION_CARD_POSITIONS.indexOf(left.position);
      const rightIndex = QUESTION_CARD_POSITIONS.indexOf(right.position);
      if (leftIndex === rightIndex) return left.index - right.index;
      return leftIndex - rightIndex;
    })
    .map(({ card, position }) => ({
      ...card,
      position,
    }));
}
