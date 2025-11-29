import { translations, initShell } from './common.js';
import { tarotCards } from './data.js';

const state = {
  currentLang: 'en',
  context: document.body.dataset.context || 'daily',
  selectedIds: [],
  spreadCards: [],
};

const cardGrid = document.getElementById('cardGrid');
const continueBtn = document.getElementById('continueBtn');
const hintText = document.getElementById('hintText');
const shuffleBtn = document.getElementById('shuffleBtn');
const overlay = document.getElementById('board-overlay');
const selectedCount = document.getElementById('selectedCount');
const contextCopy = document.getElementById('context-copy');
const readingTitle = document.querySelector('[data-reading-title]');

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function prepareSpread(context = state.context) {
  state.context = context;
  state.selectedIds = [];
  state.spreadCards = shuffleArray(tarotCards).slice(0, 15);
  if (overlay) overlay.classList.add('is-hidden');
  renderGrid();
  updateContinueState();
  if (cardGrid) {
    cardGrid.classList.add('shuffling');
    setTimeout(() => cardGrid.classList.remove('shuffling'), 600);
  }
  updateContextCopy();
}

function renderGrid() {
  if (!cardGrid) return;
  cardGrid.innerHTML = '';
  state.spreadCards.forEach((card) => {
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.dataset.id = card.id;

    const back = document.createElement('div');
    back.className = 'face back card-back';

    const front = document.createElement('div');
    front.className = 'face front';
    front.innerHTML = '<div class="icon">🜚</div><div class="name">MeowTarot</div>';

    cardEl.append(back, front);
    cardEl.addEventListener('click', () => toggleSelect(card.id, cardEl));
    cardGrid.appendChild(cardEl);
  });
}

function toggleSelect(id, el) {
  const already = state.selectedIds.includes(id);
  if (already) {
    state.selectedIds = state.selectedIds.filter((cid) => cid !== id);
    el.classList.remove('selected');
  } else if (state.selectedIds.length < 3) {
    state.selectedIds.push(id);
    el.classList.add('selected');
  }
  updateContinueState();
}

function updateContinueState() {
  if (!selectedCount || !continueBtn || !hintText) return;
  const dict = translations[state.currentLang];
  selectedCount.textContent = `${state.selectedIds.length}/3`;
  if (state.selectedIds.length === 3) {
    continueBtn.disabled = false;
    hintText.textContent = '';
  } else {
    continueBtn.disabled = true;
    hintText.textContent = dict.selectThreeHint;
  }
}

function updateContextCopy(dict = translations[state.currentLang]) {
  if (!contextCopy) return;
  contextCopy.textContent = dict[state.context === 'question' ? 'contextQuestion' : 'contextDaily'];
}

function handleTranslations(dict) {
  updateContextCopy(dict);
  updateContinueState();
  if (readingTitle) {
    readingTitle.textContent = state.context === 'question' ? dict.questionTitle : dict.dailyTitle;
  }
}

function handleContinue() {
  if (state.selectedIds.length === 3) {
    const cardsParam = state.selectedIds.join(',');
    const lang = state.currentLang;
    const context = state.context;
    window.location.href = `reading.html?context=${encodeURIComponent(context)}&lang=${encodeURIComponent(lang)}&cards=${encodeURIComponent(cardsParam)}`;
  }
}

function attachStartButtons() {
  document.querySelectorAll('[data-start]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const context = btn.dataset.start;
      prepareSpread(context);
      cardGrid?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function init() {
  initShell(state, handleTranslations, document.body.dataset.page);
  attachStartButtons();

  shuffleBtn?.addEventListener('click', () => prepareSpread(state.context));
  continueBtn?.addEventListener('click', handleContinue);

  prepareSpread(state.context);
}

document.addEventListener('DOMContentLoaded', init);
