import { initShell, applyTranslations } from './common.js';
import { tarotCards } from './data.js';

const state = {
  currentLang: 'en',
};

const meaningList = document.getElementById('meaningList');

function renderMeaningList() {
  if (!meaningList) return;
  meaningList.innerHTML = '';
  tarotCards.slice(0, 12).forEach((card) => {
    const name = state.currentLang === 'en' ? card.name_en : card.name_th;
    const meaning = state.currentLang === 'en' ? card.meaning_en : card.meaning_th;
    const div = document.createElement('div');
    div.className = 'sample-card';
    div.innerHTML = `<h5>${name}</h5><p>${meaning}</p>`;
    meaningList.appendChild(div);
  });
}

function handleTranslations() {
  renderMeaningList();
}

function init() {
  initShell(state, handleTranslations, document.body.dataset.page);
}

document.addEventListener('DOMContentLoaded', init);
