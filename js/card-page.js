import { initShell } from './common.js';
import { getCardImageUrl, loadTarotData, meowTarotCards, normalizeId } from './data.js';

const TARGET_CARD_ID = '01-the-fool-upright';

const metaFields = {
  title: document.querySelector('[data-card-meta="title"]'),
  description: document.querySelector('[data-card-meta="description"]'),
  ogTitle: document.querySelector('[data-card-meta="og-title"]'),
  ogDescription: document.querySelector('[data-card-meta="og-description"]'),
  ogUrl: document.querySelector('[data-card-meta="og-url"]'),
  twitterTitle: document.querySelector('[data-card-meta="twitter-title"]'),
  twitterDescription: document.querySelector('[data-card-meta="twitter-description"]'),
  canonical: document.querySelector('[data-card-meta="canonical"]'),
  hreflangEn: document.querySelector('[data-card-meta="hreflang-en"]'),
  hreflangTh: document.querySelector('[data-card-meta="hreflang-th"]'),
  hreflangX: document.querySelector('[data-card-meta="hreflang-x"]'),
};

const dom = {
  cardTitle: document.getElementById('cardTitle'),
  cardAlias: document.getElementById('cardAlias'),
  cardArchetype: document.getElementById('cardArchetype'),
  cardImage: document.getElementById('cardImage'),
  orientationBadge: document.getElementById('orientationBadge'),
  orientationToggle: document.getElementById('orientationToggle'),
  orientationButtons: Array.from(document.querySelectorAll('[data-orientation]')),
  keywordChips: document.getElementById('keywordChips'),
  cardSummary: document.getElementById('cardSummary'),
  meaningOverview: document.getElementById('meaningOverview'),
  meaningLove: document.getElementById('meaningLove'),
  meaningCareer: document.getElementById('meaningCareer'),
  meaningAdvice: document.getElementById('meaningAdvice'),
  meaningWarning: document.getElementById('meaningWarning'),
  spreadSingle: document.getElementById('spreadSingle'),
  spreadPast: document.getElementById('spreadPast'),
  spreadPresent: document.getElementById('spreadPresent'),
  spreadFuture: document.getElementById('spreadFuture'),
  relatedCards: document.getElementById('relatedCards'),
  faqList: document.getElementById('faqList'),
  crumbCard: document.getElementById('crumbCard'),
};

const state = {
  baseSlug: null,
  baseCard: null,
  orientedCards: {
    upright: null,
    reversed: null,
  },
  orientation: 'upright',
};

function cleanSlug(slug = '') {
  return slug.replace(/\/+$/, '').split('/').filter(Boolean).pop() || '';
}

function deriveBaseSlug(rawSlug = '') {
  const normalized = normalizeId(rawSlug);
  return normalized.replace(/-reversed(?=-tarot-meaning|$)/, '').replace(/-upright(?=-tarot-meaning|$)/, '');
}

function deriveOrientationFromId(rawId = '') {
  return /reversed/i.test(rawId) ? 'reversed' : 'upright';
}

function resolveRequestedId() {
  const pathSlug = cleanSlug(window.location.pathname || '');
  const querySlug = new URLSearchParams(window.location.search || '').get('card');
  const pathCandidate = pathSlug && pathSlug !== 'tarot-card-meanings' ? pathSlug : '';
  return pathCandidate || querySlug || TARGET_CARD_ID;
}

function extractSlug() {
  const requestedId = resolveRequestedId();
  return deriveBaseSlug(requestedId);
}

function cardBaseSlug(card) {
  if (!card) return '';
  const slug = card.seo_slug_en || card.card_id || card.id || '';
  return deriveBaseSlug(slug);
}

function orientationLabel(value) {
  return value === 'reversed' ? 'Reversed' : 'Upright';
}

function buildCareerMoneyHtml(card) {
  const pieces = [];
  if (card?.career_present_en) pieces.push(`<p><strong>Career:</strong> ${card.career_present_en}</p>`);
  if (card?.finance_present_en) pieces.push(`<p><strong>Money:</strong> ${card.finance_present_en}</p>`);
  if (!pieces.length && card?.career_future_en) pieces.push(`<p>${card.career_future_en}</p>`);
  return pieces.join('');
}

function splitKeywords(card, orientation) {
  const source = orientation === 'reversed' ? card?.keywords_shadow : card?.keywords_light;
  if (!source) return [];
  return source
    .split(',')
    .map((kw) => kw.trim())
    .filter(Boolean);
}

function findOrientedCards(baseSlug) {
  const upright = meowTarotCards.find((card) => card.orientation !== 'reversed' && cardBaseSlug(card) === baseSlug);
  const reversed = meowTarotCards.find((card) => card.orientation === 'reversed' && cardBaseSlug(card) === baseSlug);
  return { upright: upright || null, reversed: reversed || null };
}

function pickBaseCard(oriented) {
  return oriented.upright || oriented.reversed || null;
}

function setKeywordChips(card, orientation) {
  if (!dom.keywordChips) return;
  dom.keywordChips.innerHTML = '';
  splitKeywords(card, orientation).forEach((keyword) => {
    const chip = document.createElement('span');
    chip.className = 'chip keyword';
    chip.textContent = keyword;
    dom.keywordChips.appendChild(chip);
  });
}

function setText(el, value) {
  if (!el) return;
  el.textContent = value || '';
}

function chooseOverview(card) {
  return card?.reading_summary_preview_en || card?.tarot_imply_en || '';
}

function chooseLove(card) {
  return card?.love_present_en || card?.love_future_en || card?.love_reading_single_en || '';
}

function chooseAdvice(card) {
  return card?.standalone_future_en || card?.reading_summary_future_en || '';
}

function chooseWarning(card) {
  return card?.standalone_present_en || card?.reading_summary_past_en || '';
}

function chooseSummary(card) {
  return card?.reading_summary_preview_en || card?.reading_summary_present_en || card?.tarot_imply_en || '';
}

function buildCardUrl(baseSlug, langPrefix = '') {
  const prefix = langPrefix ? `/${langPrefix}` : '';
  return `https://www.meowtarot.com${prefix}/tarot-card-meanings/${baseSlug}/`;
}

function updateSeo(baseSlug, baseCard) {
  if (!baseSlug || !baseCard) return;
  const name = baseCard.card_name_en || baseCard.name_en || 'Tarot card';
  const title = `${name} Tarot Meaning | Upright & Reversed | MeowTarot`;
  const description = baseCard.meta_description_en || chooseOverview(baseCard) || `${name} tarot meaning`;
  const url = buildCardUrl(baseSlug);

  if (metaFields.title) metaFields.title.textContent = title;
  if (metaFields.description) metaFields.description.setAttribute('content', description);
  if (metaFields.ogTitle) metaFields.ogTitle.setAttribute('content', title);
  if (metaFields.ogDescription) metaFields.ogDescription.setAttribute('content', description);
  if (metaFields.ogUrl) metaFields.ogUrl.setAttribute('content', url);
  if (metaFields.twitterTitle) metaFields.twitterTitle.setAttribute('content', title);
  if (metaFields.twitterDescription) metaFields.twitterDescription.setAttribute('content', description);
  if (metaFields.canonical) metaFields.canonical.setAttribute('href', url);
  if (metaFields.hreflangEn) metaFields.hreflangEn.setAttribute('href', url);
  if (metaFields.hreflangTh) metaFields.hreflangTh.setAttribute('href', buildCardUrl(baseSlug, 'th'));
  if (metaFields.hreflangX) metaFields.hreflangX.setAttribute('href', url);
}

function updateImage(card, orientation) {
  if (!dom.cardImage) return;
  const url = getCardImageUrl(card, { orientation });
  dom.cardImage.src = url;
  const safeName = card?.card_name_en || card?.name_en || 'Tarot card';
  dom.cardImage.alt = card?.image_alt_en || `${safeName} tarot card illustration (${orientationLabel(orientation)})`;
  dom.cardImage.onerror = () => {
    if (orientation === 'reversed' && state.orientedCards.upright) {
      dom.cardImage.src = getCardImageUrl(state.orientedCards.upright, { orientation: 'upright' });
    }
  };
}

function renderOrientation(card, orientation) {
  if (!card) return;
  state.orientation = orientation;
  dom.orientationButtons.forEach((btn) => {
    const isActive = btn.dataset.orientation === orientation;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });

  if (dom.orientationBadge) setText(dom.orientationBadge, orientationLabel(orientation));
  setKeywordChips(card, orientation);
  setText(dom.cardSummary, chooseSummary(card));
  setText(dom.meaningOverview, chooseOverview(card));
  setText(dom.meaningLove, chooseLove(card));
  dom.meaningCareer.innerHTML = buildCareerMoneyHtml(card);
  setText(dom.meaningAdvice, chooseAdvice(card));
  setText(dom.meaningWarning, chooseWarning(card));
  setText(dom.spreadSingle, chooseSummary(card));
  setText(dom.spreadPast, card?.reading_summary_past_en || '');
  setText(dom.spreadPresent, card?.reading_summary_present_en || '');
  setText(dom.spreadFuture, card?.reading_summary_future_en || '');
  updateImage(card, orientation);
  buildFaq(card);
}

function buildRelatedCards(baseCard) {
  if (!dom.relatedCards || !baseCard) return;
  dom.relatedCards.innerHTML = '';
  const baseSuit = deriveSuit(baseCard.card_id || baseCard.id || '');
  const baseSlug = cardBaseSlug(baseCard);
  const candidates = meowTarotCards
    .filter((card) => card.orientation !== 'reversed')
    .filter((card) => deriveSuit(card.card_id || card.id || '') === baseSuit)
    .filter((card) => cardBaseSlug(card) !== baseSlug)
    .slice(0, 4);

  candidates.forEach((card) => {
    const li = document.createElement('li');
    li.className = 'related-card';
    const slug = cardBaseSlug(card);
    li.innerHTML = `
      <a href="/tarot-card-meanings/${slug}/">
        <p class="related-title">${card.card_name_en || card.name_en || card.id}</p>
        <p class="related-meta">${card.archetype_en || card.tarot_imply_en || ''}</p>
      </a>
    `;
    dom.relatedCards.appendChild(li);
  });
}

function deriveSuit(cardId = '') {
  const match = cardId.match(/^(\d{2})/);
  if (!match) return 'major';
  const num = parseInt(match[1], 10);
  if (num <= 22) return 'major';
  if (num <= 36) return 'wands';
  if (num <= 50) return 'cups';
  if (num <= 64) return 'swords';
  return 'pentacles';
}

function buildFaq(card) {
  if (!dom.faqList || !card) return;
  dom.faqList.innerHTML = '';
  const upright = state.orientedCards.upright || card;
  const reversed = state.orientedCards.reversed;

  const faqs = [
    {
      q: `What does ${upright.card_name_en || upright.name_en || 'this card'} mean upright?`,
      a: chooseOverview(upright),
    },
    {
      q: 'How do I read this card in love?',
      a: chooseLove(card),
    },
  ];

  if (reversed) {
    faqs.push({
      q: `What does ${reversed.card_name_en || reversed.name_en || 'this card'} mean reversed?`,
      a: chooseSummary(reversed),
    });
  }

  const filteredFaqs = faqs.filter((item) => Boolean(item.a));

  filteredFaqs.forEach((item) => {
    const detail = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = item.q;
    const body = document.createElement('p');
    body.textContent = item.a;
    detail.appendChild(summary);
    detail.appendChild(body);
    dom.faqList.appendChild(detail);
  });

  renderFaqSchema(filteredFaqs, cardBaseSlug(card));
}

function renderFaqSchema(entries, baseSlug) {
  const schemaEl = document.getElementById('card-schema');
  if (!schemaEl || !entries?.length) return;
  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${buildCardUrl(baseSlug)}#faq`,
    mainEntity: entries.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
  schemaEl.textContent = JSON.stringify(faq, null, 2);
}

function hydrateBaseCard(baseCard) {
  if (!baseCard) return;
  setText(dom.cardTitle, `${baseCard.card_name_en || baseCard.name_en || 'Tarot card'} Tarot Meaning`);
  setText(dom.cardAlias, baseCard.alias_th ? `Thai: ${baseCard.alias_th}` : '');
  setText(dom.cardArchetype, baseCard.archetype_en || 'Tarot archetype');
  setText(dom.crumbCard, baseCard.card_name_en || baseCard.name_en || 'Card');
}

function bindOrientationToggle() {
  dom.orientationButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const orientation = btn.dataset.orientation;
      const targetCard = state.orientedCards[orientation] || state.baseCard;
      renderOrientation(targetCard, orientation);
    });
  });
}

function setOrientationAvailability() {
  const availableCount = dom.orientationButtons.reduce(
    (count, btn) => count + (state.orientedCards[btn.dataset.orientation] ? 1 : 0),
    0,
  );
  dom.orientationButtons.forEach((btn) => {
    const orientation = btn.dataset.orientation;
    const hasCard = Boolean(state.orientedCards[orientation]);
    btn.disabled = !hasCard;
    btn.classList.toggle('is-disabled', !hasCard);
  });

  const shouldHideToggle = availableCount < 2;
  if (dom.orientationToggle) {
    dom.orientationToggle.classList.toggle('is-hidden', shouldHideToggle);
    dom.orientationToggle.setAttribute('aria-hidden', shouldHideToggle ? 'true' : 'false');
  }
}

function hydratePage() {
  const requestedId = resolveRequestedId();
  const requestedOrientation = deriveOrientationFromId(requestedId);
  state.baseSlug = extractSlug();
  if (!state.baseSlug) return;
  const oriented = findOrientedCards(state.baseSlug);
  state.orientedCards = oriented;
  state.baseCard = pickBaseCard(oriented);
  if (!state.baseCard) return;

  hydrateBaseCard(state.baseCard);
  updateSeo(state.baseSlug, state.baseCard);
  buildRelatedCards(state.baseCard);
  setOrientationAvailability();
  const initialOrientation = state.orientedCards[requestedOrientation]
    ? requestedOrientation
    : state.orientedCards.upright
      ? 'upright'
      : 'reversed';
  const initialCard = state.orientedCards[initialOrientation] || state.baseCard;
  renderOrientation(initialCard, initialOrientation);
}

function init() {
  initShell();
  loadTarotData().then(() => {
    hydratePage();
    bindOrientationToggle();
  });
}

init();
