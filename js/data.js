export let meowTarotCards = [];

export function loadTarotData() {
  return fetch('data/cards.json')
    .then((res) => res.json())
    .then((data) => {
      meowTarotCards = data.cards || [];
      return meowTarotCards;
    })
    .catch((err) => {
      console.error('Failed to load tarot data', err);
      meowTarotCards = [];
      throw err;
    });
}
