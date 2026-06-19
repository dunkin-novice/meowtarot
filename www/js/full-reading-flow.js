export function buildNextDrawBoard(pool = [], selectedCards = [], boardSize = 10, rng = Math.random) {
  const selectedIds = new Set((selectedCards || []).map((card) => card?.id).filter(Boolean));
  const remaining = (pool || []).filter((card) => card && !selectedIds.has(card.id));
  const shuffled = [...remaining];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor((rng?.() ?? Math.random()) * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(boardSize, shuffled.length));
}

export function applyTapSwap(cards = [], selectedIndex = -1, tappedIndex = -1) {
  if (tappedIndex < 0 || tappedIndex >= cards.length) {
    return { cards: [...cards], selectedIndex, swapped: false };
  }
  if (selectedIndex === tappedIndex) {
    return { cards: [...cards], selectedIndex: -1, swapped: false };
  }
  if (selectedIndex < 0) {
    return { cards: [...cards], selectedIndex: tappedIndex, swapped: false };
  }
  const next = [...cards];
  [next[selectedIndex], next[tappedIndex]] = [next[tappedIndex], next[selectedIndex]];
  return { cards: next, selectedIndex: -1, swapped: true };
}
