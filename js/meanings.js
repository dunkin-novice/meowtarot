import { initShell } from './common.js';
import { loadTarotData, meowTarotCards } from './data.js';

const state = {
  currentLang: 'en',
};

const meaningList = document.getElementById('meaningList');

function renderMeaningList() {
  if (!meaningList || !meowTarotCards.length) return;
  meaningList.innerHTML = '';

  meowTarotCards.slice(0, 12).forEach((card) => {
    // Support both the CSV/JSON shape and the simple tarotCards shape
    const name =
      state.currentLang === 'en'
        ? card.card_name_en || card.name_en || card.name || card.id
        : card.alias_th || card.name_th || card.name || card.id;

    const summary =
      state.currentLang === 'en'
        ? card.reading_summary_preview_en ||
          card.meaning_en ||
          card.tarot_imply_en ||
          ''
        : card.reading_summary_preview_th ||
          card.meaning_th ||
          card.tarot_imply_th ||
          '';

    const archetype =
      state.currentLang === 'en'
        ? card.archetype_en || ''
        : card.archetype_th || '';

    const div = document.createElement('div');
    div.className = 'sample-card';
    div.innerHTML = `
      <h5>${card.icon_emoji ? `${card.icon_emoji} ` : ''}${name}</h5>
      ${archetype ? `<p class="archetype">${archetype}</p>` : ''}
      <p>${summary}</p>
    `;
    meaningList.appendChild(div);
  });
}

function handleTranslations() {
  renderMeaningList();
}

function init() {
  initShell(state, handleTranslations, document.body.dataset.page);

  loadTarotData()
    .then(() => {
      renderMeaningList();
    })
    .catch(() => {
      // Fallback: meowTarotCards will contain the static tarotCards
      renderMeaningList();
    });
}

document.addEventListener('DOMContentLoaded', init);
