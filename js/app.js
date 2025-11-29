import { translations, initShell } from './common.js';
import { tarotCards } from './data.js';

const state = {
  currentLang: 'en',
  context: document.body.dataset.context || 'daily',
  selectedIds: [],
  spreadCards: [],
  isShuffling: false,
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
  updateContextCopy();
}

function renderGrid(options = {}) {
  const { entering = false } = options;
  if (!cardGrid) return;
  cardGrid.innerHTML = '';
  state.spreadCards.forEach((card) => {
    const cardEl = document.createElement('div');
    cardEl.className = `card${entering ? ' is-shuffling-in' : ''}`;
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

function shuffleWithAnimation(context = state.context) {
  if (!cardGrid || state.isShuffling) return;

  state.isShuffling = true;
  shuffleBtn.disabled = true;
  state.selectedIds = [];
  updateContinueState();

  const cards = cardGrid.querySelectorAll('.card');
  cardGrid.classList.add('is-animating');
  cards.forEach((card) => {
    card.classList.remove('selected');
    card.classList.add('is-shuffling-out');
  });

  const outDuration = 280;
  const inDuration = 320;

  setTimeout(() => {
    state.context = context;
    state.spreadCards = shuffleArray(tarotCards).slice(0, 15);
    if (overlay) overlay.classList.add('is-hidden');
    renderGrid({ entering: true });
    updateContextCopy();

    requestAnimationFrame(() => {
      const newCards = cardGrid.querySelectorAll('.card');
      newCards.forEach((card, index) => {
        card.style.transitionDelay = `${index * 12}ms`;
      });

      requestAnimationFrame(() => {
        newCards.forEach((card) => card.classList.remove('is-shuffling-in'));
      });

      const totalInDuration = inDuration + newCards.length * 12;
      setTimeout(() => {
        newCards.forEach((card) => {
          card.style.transitionDelay = '';
        });
        cardGrid.classList.remove('is-animating');
        shuffleBtn.disabled = false;
        state.isShuffling = false;
      }, totalInDuration);
    });
  }, outDuration);
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

  shuffleBtn?.addEventListener('click', () => shuffleWithAnimation(state.context));
  continueBtn?.addEventListener('click', handleContinue);

  prepareSpread(state.context);
}

document.addEventListener('DOMContentLoaded', init);
