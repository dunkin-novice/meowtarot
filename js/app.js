import { translations, initShell } from './common.js';
import { tarotCards } from './data.js';

const state = {
  currentLang: 'en',
  context: document.body.dataset.context || 'daily',
  selectedIds: [],
  reading: [],
  spreadCards: [],
};

const cardGrid = document.getElementById('cardGrid');
const continueBtn = document.getElementById('continueBtn');
const hintText = document.getElementById('hintText');
const shuffleBtn = document.getElementById('shuffleBtn');
const newReadingBtn = document.getElementById('newReadingBtn');
const shareBtn = document.getElementById('shareBtn');
const saveBtn = document.getElementById('saveBtn');
const summaryContent = document.getElementById('summaryContent');
const resultsSection = document.getElementById('results');
const overlay = document.getElementById('board-overlay');
const selectedCount = document.getElementById('selectedCount');
const contextCopy = document.getElementById('context-copy');
const resultsGrid = document.getElementById('resultsGrid');
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
  state.reading = [];
  state.spreadCards = shuffleArray(tarotCards).slice(0, 15);
  if (overlay) overlay.classList.add('is-hidden');
  renderGrid();
  updateContinueState();
  if (cardGrid) {
    cardGrid.classList.add('shuffling');
    setTimeout(() => cardGrid.classList.remove('shuffling'), 600);
  }
  updateContextCopy();
  if (resultsSection) resultsSection.classList.remove('show');
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

function buildSummary(cards) {
  const dict = translations[state.currentLang];
  const names = cards.map((c) => (state.currentLang === 'en' ? c.name_en : c.name_th));
  return [
    dict.summaryPast.replace('{card}', names[0]),
    dict.summaryPresent.replace('{card}', names[1]),
    dict.summaryFuture.replace('{card}', names[2]),
    dict.summaryAdvice,
  ];
}

function renderResults() {
  if (!resultsGrid || state.selectedIds.length !== 3) return;
  const dict = translations[state.currentLang];
  const labels = [dict.past, dict.present, dict.future];
  resultsGrid.innerHTML = '';
  const selectedCards = state.selectedIds.slice(0, 3).map((id) => tarotCards.find((c) => c.id === id));
  state.reading = selectedCards;

  selectedCards.forEach((card, idx) => {
    const name = state.currentLang === 'en' ? card.name_en : card.name_th;
    const meaning = state.currentLang === 'en' ? card.meaning_en : card.meaning_th;
    const cardEl = document.createElement('div');
    cardEl.className = 'result-card';
    cardEl.innerHTML = `
      <div class="label">${labels[idx]}</div>
      <h5>${name}</h5>
      <p>${meaning}</p>
    `;
    resultsGrid.appendChild(cardEl);
  });

  if (summaryContent) {
    summaryContent.innerHTML = '';
    buildSummary(selectedCards).forEach((line) => {
      const p = document.createElement('p');
      p.textContent = line;
      summaryContent.appendChild(p);
    });
  }

  if (resultsSection) {
    resultsSection.classList.add('show');
    resultsSection.scrollIntoView({ behavior: 'smooth' });
  }
}

function handleShare() {
  const url = window.location.href;
  if (navigator.share) {
    navigator.share({ title: 'MeowTarot', text: translations[state.currentLang].yourReading, url }).catch(() => copyLink(url));
  } else {
    copyLink(url);
  }
}

function copyLink(url) {
  navigator.clipboard.writeText(url).then(() => alert(translations[state.currentLang].shareFallback));
}

function saveImage() {
  if (!resultsSection) return;
  html2canvas(resultsSection, { backgroundColor: '#0b102b', scale: 2 }).then((canvas) => {
    const link = document.createElement('a');
    link.download = `meowtarot-reading-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  });
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

function updateContextCopy(dict = translations[state.currentLang]) {
  if (!contextCopy) return;
  contextCopy.textContent = dict[state.context === 'question' ? 'contextQuestion' : 'contextDaily'];
}

function handleTranslations(dict) {
  updateContextCopy(dict);
  updateContinueState();
  if (state.reading.length === 3) renderResults();
  if (readingTitle) {
    readingTitle.textContent = state.context === 'question' ? dict.questionTitle : dict.dailyTitle;
  }
}

function init() {
  initShell(state, handleTranslations, document.body.dataset.page);
  attachStartButtons();

  shuffleBtn?.addEventListener('click', () => prepareSpread(state.context));
  continueBtn?.addEventListener('click', () => {
    if (state.selectedIds.length === 3) renderResults();
  });
  newReadingBtn?.addEventListener('click', () => {
    prepareSpread(state.context);
    cardGrid?.scrollIntoView({ behavior: 'smooth' });
  });
  shareBtn?.addEventListener('click', handleShare);
  saveBtn?.addEventListener('click', saveImage);

  prepareSpread(state.context);
}

document.addEventListener('DOMContentLoaded', init);
