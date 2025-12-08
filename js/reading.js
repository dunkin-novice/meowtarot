import { initShell, translations } from './common.js';
import { loadTarotData, meowTarotCards } from './data.js';

const params = new URLSearchParams(window.location.search);
const initialLang = params.get('lang') || 'en';
const initialContext = params.get('context') || 'daily';
const cardIds = (params.get('cards') || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

const state = {
  currentLang: initialLang,
  context: initialContext,
  selectedIds: cardIds,
};

const resultsGrid = document.getElementById('resultsGrid');
const summaryContent = document.getElementById('summaryContent');
const resultsSection = document.querySelector('.results');
const newReadingBtn = document.getElementById('newReadingBtn');
const shareBtn = document.getElementById('shareBtn');
const saveBtn = document.getElementById('saveBtn');
const contextCopy = document.getElementById('context-copy');
const readingTitle = document.getElementById('readingTitle');

function getCardName(card) {
  return state.currentLang === 'th' ? card.alias_th : card.card_name_en;
}

function getFoolCard() {
  return meowTarotCards.find((card) => card.id === 'the-fool' && card.orientation === 'upright')
    || meowTarotCards.find((card) => card.id === 'the-fool');
}

function findUprightCard(id) {
  const direct = meowTarotCards.find((card) => card.id === id);
  if (direct && direct.orientation === 'upright') return direct;

  const baseId = id.endsWith('-reversed') ? id.replace(/-reversed$/, '') : id;
  const upright = meowTarotCards.find((card) => card.id === baseId && card.orientation === 'upright');
  if (upright) return upright;

  if (direct) return direct;
  return getFoolCard();
}

function getCardArchetype(card) {
  return state.currentLang === 'th' ? card.archetype_th : card.archetype_en;
}

function getStandaloneByPosition(card, position) {
  const lang = state.currentLang;
  if (position === 0) {
    return lang === 'th' ? card.standalone_past_th : card.standalone_past_en;
  }
  if (position === 1) {
    return lang === 'th' ? card.standalone_present_th : card.standalone_present_en;
  }
  return lang === 'th' ? card.standalone_future_th : card.standalone_future_en;
}

function getReadingSummary(card) {
  return state.currentLang === 'th' ? card.reading_summary_preview_th : card.reading_summary_preview_en;
}

function getSelectedCards() {
  return state.selectedIds
    .slice(0, 3)
    .map((id) => findUprightCard(id) || getFoolCard())
    .filter(Boolean);
}

function buildSummary(cards) {
  const list = cards.length ? cards : meowTarotCards.filter((c) => c.id === 'the-fool');
  return list.map((card) => getReadingSummary(card));
}

function renderResults() {
  if (!resultsGrid || state.selectedIds.length !== 3 || !meowTarotCards.length) return;
  const dict = translations[state.currentLang];
  const labels = [dict.past, dict.present, dict.future];
  const selectedCards = getSelectedCards();
  if (!selectedCards.length) return;
  resultsGrid.innerHTML = '';

  selectedCards.forEach((card, idx) => {
    const name = getCardName(card);
    const archetype = getCardArchetype(card);
    const meaning = getStandaloneByPosition(card, idx);
    const cardEl = document.createElement('div');
    cardEl.className = 'result-card';
    cardEl.innerHTML = `
      <div class="label">${labels[idx]}</div>
      <h5>${card.icon_emoji ? `${card.icon_emoji} ` : ''}${name}</h5>
      <p class="archetype">${archetype}</p>
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

function updateContextCopy(dict = translations[state.currentLang]) {
  if (!contextCopy) return;
  contextCopy.textContent = dict[state.context === 'question' ? 'contextQuestion' : 'contextDaily'];
}

function handleTranslations(dict) {
  updateContextCopy(dict);
  renderResults();
  if (readingTitle) {
    readingTitle.textContent = state.context === 'question' ? dict.questionTitle : dict.dailyTitle;
  }
}

function init() {
  initShell(state, handleTranslations, 'reading');

  newReadingBtn?.addEventListener('click', () => {
    const target = state.context === 'question' ? 'question.html' : 'daily.html';
    window.location.href = target;
  });
  shareBtn?.addEventListener('click', handleShare);
  saveBtn?.addEventListener('click', saveImage);

  loadTarotData()
    .then(() => {
      renderResults();
    })
    .catch(() => {
      renderResults();
    });
}

document.addEventListener('DOMContentLoaded', init);
