import { translations, initShell } from './common.js';
import { loadTarotData, meowTarotCards } from './data.js';

const state = {
  currentLang: 'en',
  context: document.body.dataset.context || 'daily',
  selectedIds: [],
  spreadCards: [],
  isShuffling: false,
  reading: [],
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
const resultsGrid = document.getElementById('resultsGrid');

const overlay = document.getElementById('board-overlay');
const selectedCount = document.getElementById('selectedCount');
const contextCopy = document.getElementById('context-copy');
const readingTitle = document.querySelector('[data-reading-title]');

function getDrawableCards() {
  return meowTarotCards.length ? meowTarotCards : [];
}

function findCardForReading(id) {
  const idStr = String(id || '');
  const direct = meowTarotCards.find((card) => String(card.id) === idStr);
  if (direct) return direct;

  const baseId = idStr.endsWith('-reversed') ? idStr.replace(/-reversed$/, '') : idStr;
  const baseMatch = meowTarotCards.find((card) => String(card.id) === baseId);
  if (baseMatch) return baseMatch;

  return null;
}

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

  const sourceCards = getDrawableCards();
  state.spreadCards = shuffleArray(sourceCards).slice(0, 6);

  if (overlay) overlay.classList.add('is-hidden');

  renderGrid();
  updateContinueState();
  updateContextCopy();

  if (cardGrid) {
    cardGrid.classList.add('shuffling');
    setTimeout(() => cardGrid.classList.remove('shuffling'), 600);
  }

  if (resultsSection) {
    resultsSection.classList.remove('show');
  }
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

function shuffleWithAnimation(context = state.context) {
  if (!cardGrid || state.isShuffling || !meowTarotCards.length) return;

  state.isShuffling = true;
  if (shuffleBtn) shuffleBtn.disabled = true;
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
    const sourceCards = getDrawableCards();
    state.spreadCards = shuffleArray(sourceCards).slice(0, 6);
    if (overlay) overlay.classList.add('is-hidden');
    renderGrid({ entering: true });
    updateContextCopy();

    if (resultsSection) {
      resultsSection.classList.remove('show');
    }

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
        if (shuffleBtn) shuffleBtn.disabled = false;
        state.isShuffling = false;
      }, totalInDuration);
    });
  }, outDuration);
}

function buildSummary(cards) {
  const dict = translations[state.currentLang];
  const names = cards.map((c) => (
    state.currentLang === 'en'
      ? c.name_en || c.card_name_en || c.name || c.id
      : c.name_th || c.alias_th || c.name || c.id
  ));

  const lines = [];
  if (dict.summaryPast && names[0]) lines.push(dict.summaryPast.replace('{card}', names[0]));
  if (dict.summaryPresent && names[1]) lines.push(dict.summaryPresent.replace('{card}', names[1]));
  if (dict.summaryFuture && names[2]) lines.push(dict.summaryFuture.replace('{card}', names[2]));
  if (dict.summaryAdvice) lines.push(dict.summaryAdvice);
  return lines;
}

function getCardName(card, lang = state.currentLang) {
  return lang === 'en'
    ? card.name_en || card.card_name_en || card.name || card.id
    : card.name_th || card.alias_th || card.name || card.id;
}

function getStandaloneMeaning(card, position, lang = state.currentLang) {
  const suffix = lang === 'en' ? '_en' : '_th';
  const key = `standalone_${position}${suffix}`;
  if (card[key]) return card[key];

  const implyKey = lang === 'en' ? 'tarot_imply_en' : 'tarot_imply_th';
  return card[implyKey] || '';
}

function getReadingSummary(cards, lang = state.currentLang) {
  const suffix = lang === 'en' ? '_en' : '_th';
  const positions = ['past', 'present', 'future'];

  const summaries = cards
    .map((card, idx) => {
      const positionKey = `reading_summary_${positions[idx]}${suffix}`;
      if (card[positionKey]) return card[positionKey];

      const previewKey = `reading_summary_preview${suffix}`;
      return card[previewKey] || '';
    })
    .filter(Boolean);

  if (summaries.length) return summaries.join(' ');

  return buildSummary(cards).join(' ');
}

function renderResults() {
  if (!resultsGrid || state.selectedIds.length !== 3) return;
  const dict = translations[state.currentLang];
  const labels = [dict.past, dict.present, dict.future];
  resultsGrid.innerHTML = '';

  const selectedCards = state.selectedIds.slice(0, 3)
    .map((id) => findCardForReading(id))
    .filter(Boolean);

  if (selectedCards.length !== 3) return;

  state.reading = selectedCards;

  const positions = ['past', 'present', 'future'];

  selectedCards.forEach((card, idx) => {
    const name = getCardName(card);
    const meaning = getStandaloneMeaning(card, positions[idx]);
    const icon = card.icon_emoji || '🜚';

    const cardEl = document.createElement('div');
    cardEl.className = 'result-card';
    cardEl.innerHTML = `
      <div class="label">${labels[idx]}</div>
      <h5>${icon} ${name}</h5>
      <p>${meaning}</p>
    `;
    resultsGrid.appendChild(cardEl);
  });

  if (summaryContent) {
    const summaryText = getReadingSummary(selectedCards);
    summaryContent.innerHTML = '';
    if (summaryText) {
      const p = document.createElement('p');
      p.textContent = summaryText;
      summaryContent.appendChild(p);
    }
  }

  if (resultsSection) {
    resultsSection.classList.add('show');
    resultsSection.scrollIntoView({ behavior: 'smooth' });
  }
}

function saveImage() {
  if (!resultsSection || typeof html2canvas === 'undefined') return;
  html2canvas(resultsSection, { backgroundColor: '#0b102b', scale: 2 }).then((canvas) => {
    const link = document.createElement('a');
    link.download = `meowtarot-reading-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  });
}

function handleShare() {
  if (!resultsSection) return;

  const dict = translations[state.currentLang] || {};
  const shareText = dict.shareMessage || 'Check out my MeowTarot reading!';
  const shareUrl = window.location.href;

  if (navigator.share) {
    navigator.share({
      title: document.title,
      text: shareText,
      url: shareUrl,
    }).catch(() => {
      // ignore cancel / failure
    });
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(`${shareText} ${shareUrl}`).catch(() => {});
    alert(dict.shareCopied || 'Link copied to clipboard');
  } else {
    // very old browsers
    alert(shareUrl);
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

  shuffleBtn?.addEventListener('click', () => shuffleWithAnimation(state.context));
  continueBtn?.addEventListener('click', () => {
    if (state.selectedIds.length === 3) {
      const cardsParam = encodeURIComponent(state.selectedIds.join(','));
      const contextParam = encodeURIComponent(state.context);
      const langParam = encodeURIComponent(state.currentLang);
      window.location.href = `reading.html?context=${contextParam}&lang=${langParam}&cards=${cardsParam}`;
    }
  });
  newReadingBtn?.addEventListener('click', () => {
    prepareSpread(state.context);
    cardGrid?.scrollIntoView({ behavior: 'smooth' });
  });
  shareBtn?.addEventListener('click', handleShare);
  saveBtn?.addEventListener('click', saveImage);

  loadTarotData()
    .then(() => {
      prepareSpread(state.context);
    })
    .catch(() => {
      prepareSpread(state.context);
    });
}

document.addEventListener('DOMContentLoaded', init);
