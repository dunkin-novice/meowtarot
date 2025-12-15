import { initShell } from './common.js';
import { getCardImageUrl, loadTarotData, meowTarotCards, normalizeId } from './data.js';

const state = {
  currentLang: 'en',
};

const categoryCountEls = {
  major: document.querySelector('[data-category-count="major"]'),
  wands: document.querySelector('[data-category-count="wands"]'),
  cups: document.querySelector('[data-category-count="cups"]'),
  swords: document.querySelector('[data-category-count="swords"]'),
  pentacles: document.querySelector('[data-category-count="pentacles"]'),
};

const searchInput = document.getElementById('cardSearchInput');
const searchResultsEl = document.getElementById('searchResults');
const quickChips = Array.from(document.querySelectorAll('[data-quick]'));
const clearSearchBtn = document.getElementById('clearSearch');
const featuredGrid = document.getElementById('featuredCards');

const featuredSlugs = [
  'the-fool-tarot-meaning',
  'the-magician-tarot-meaning',
  'the-lovers-tarot-meaning',
  'strength-tarot-meaning',
  'the-hermit-tarot-meaning',
  'death-tarot-meaning',
  'the-tower-tarot-meaning',
  'the-star-tarot-meaning',
  'the-sun-tarot-meaning',
  'ace-of-cups-tarot-meaning',
  'ace-of-wands-tarot-meaning',
  'ace-of-swords-tarot-meaning',
  'ace-of-pentacles-tarot-meaning',
];

function getUprightCards() {
  return meowTarotCards.filter((card) => (card.orientation || '').toLowerCase() !== 'reversed');
}

function getCardCategory(card) {
  const raw = card.card_id || card.id || '';
  const numMatch = raw.match(/^(\d{2})/);
  const num = numMatch ? parseInt(numMatch[1], 10) : null;

  if (num && num <= 22) return 'major';
  if (num && num <= 36) return 'wands';
  if (num && num <= 50) return 'cups';
  if (num && num <= 64) return 'swords';
  if (num && num <= 78) return 'pentacles';
  return 'major';
}

function getCardName(card) {
  return state.currentLang === 'en'
    ? card.card_name_en || card.name_en || card.name || card.id
    : card.alias_th || card.name_th || card.name || card.id;
}

function getCardSummary(card) {
  return state.currentLang === 'en'
    ? card.reading_summary_preview_en || card.tarot_imply_en || card.meaning_en || ''
    : card.reading_summary_preview_th || card.tarot_imply_th || card.meaning_th || '';
}

function formatCategoryCount(count) {
  return `${count} card${count === 1 ? '' : 's'}`;
}

function renderCategoryCounts() {
  const counts = {
    major: 0,
    wands: 0,
    cups: 0,
    swords: 0,
    pentacles: 0,
  };

  getUprightCards().forEach((card) => {
    const category = getCardCategory(card);
    if (counts[category] !== undefined) counts[category] += 1;
  });

  Object.entries(categoryCountEls).forEach(([key, el]) => {
    if (!el) return;
    el.textContent = formatCategoryCount(counts[key]);
  });
}

function buildResultHref(card) {
  const slug = card.seo_slug_en || normalizeId(getCardName(card));
  return `meanings.html?card=${slug}`;
}

function renderSearchResults(query = '') {
  if (!searchResultsEl) return;
  const trimmed = query.trim().toLowerCase();
  const cards = getUprightCards();

  const matches = trimmed
    ? cards.filter((card) => {
        const fields = [
          card.card_name_en,
          card.name_en,
          card.name,
          card.alias_th,
          card.seo_slug_en,
        ];
        return fields.some((field) => field && field.toLowerCase().includes(trimmed));
      })
    : cards.slice(0, 6);

  searchResultsEl.innerHTML = '';

  if (!matches.length) {
    const empty = document.createElement('li');
    empty.className = 'search-empty';
    empty.textContent = 'No cards found. Try another name.';
    searchResultsEl.appendChild(empty);
    return;
  }

  matches.slice(0, 8).forEach((card) => {
    const li = document.createElement('li');
    li.className = 'search-result';

    const name = getCardName(card);
    const category = getCardCategory(card);
    const summary = getCardSummary(card);

    li.innerHTML = `
      <a href="${buildResultHref(card)}">
        <span class="result-title">${name}</span>
        <span class="result-meta">${categoryLabel(category)}</span>
        ${summary ? `<span class="result-summary">${summary}</span>` : ''}
      </a>
    `;

    searchResultsEl.appendChild(li);
  });
}

function categoryLabel(key) {
  switch (key) {
    case 'wands':
      return 'Wands — fire & action';
    case 'cups':
      return 'Cups — feelings & intuition';
    case 'swords':
      return 'Swords — mind & truth';
    case 'pentacles':
      return 'Pentacles — money & body';
    default:
      return 'Major Arcana — core archetypes';
  }
}

function renderFeaturedCards() {
  if (!featuredGrid) return;
  featuredGrid.innerHTML = '';

  const cards = getUprightCards();
  const featured = [];

  featuredSlugs.forEach((slug) => {
    const match = cards.find(
      (card) => (card.seo_slug_en || '').toLowerCase() === slug.toLowerCase(),
    );
    if (match) featured.push(match);
  });

  cards.forEach((card) => {
    if (featured.length >= 12) return;
    if (featured.includes(card)) return;
    featured.push(card);
  });

  featured.slice(0, 12).forEach((card) => {
    const cardEl = document.createElement('article');
    cardEl.className = 'featured-card';

    const name = getCardName(card);
    const category = getCardCategory(card);
    const summary = getCardSummary(card);
    const imageUrl = getCardImageUrl(card, { orientation: 'upright' });
    const altText = card.image_alt_en || `${name} tarot card illustration`;

    cardEl.innerHTML = `
      <a class="featured-link" href="${buildResultHref(card)}">
        <div class="featured-media">
          <img loading="lazy" src="${imageUrl}" alt="${altText}" />
        </div>
        <div class="featured-copy">
          <p class="result-meta">${categoryLabel(category)}</p>
          <h3>${name}</h3>
          ${summary ? `<p class="result-summary">${summary}</p>` : ''}
        </div>
      </a>
    `;

    featuredGrid.appendChild(cardEl);
  });
}

function attachEvents() {
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      renderSearchResults(e.target.value);
    });
  }

  if (clearSearchBtn && searchInput) {
    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      renderSearchResults('');
      searchInput.focus();
    });
  }

  quickChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      if (!searchInput) return;
      searchInput.value = chip.dataset.quick || '';
      renderSearchResults(searchInput.value);
      searchInput.focus();
    });
  });
}

function applyInitialQuery() {
  if (!searchInput) return;
  const params = new URLSearchParams(window.location.search);
  const cardParam = params.get('card');
  if (cardParam) {
    searchInput.value = cardParam.replace(/-/g, ' ');
  }
  renderSearchResults(searchInput.value);
}

function handleTranslations() {
  renderCategoryCounts();
  renderFeaturedCards();
  renderSearchResults(searchInput ? searchInput.value : '');
}

function init() {
  initShell(state, handleTranslations, document.body.dataset.page);
  attachEvents();

  loadTarotData()
    .then(() => {
      handleTranslations();
      applyInitialQuery();
    })
    .catch(() => {
      handleTranslations();
      applyInitialQuery();
    });
}

document.addEventListener('DOMContentLoaded', init);
