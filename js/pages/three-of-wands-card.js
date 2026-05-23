import { initShell } from '../common.js';
import { getCardImageUrl, loadTarotData, meowTarotCards } from '../data.js';
import { CANONICAL_CARD_ORDER, getCanonicalCardPath } from '../canonical-card-routes.js';
import { buildCardSchema } from '../card-seo-schema.js';

const CARD_ID_PREFIX = '25-three-of-wands';
const BASE_URL = 'https://www.meowtarot.com';

const labels = {
  en: {
    upright: 'Upright Meaning',
    reversed: 'Reversed Meaning',
    aliasPrefix: 'Thai name:',
    archetypePrefix: 'Archetype',
    symbolic: ['Zodiac', 'Element', 'Planet', 'Numerology'],
    profileTitle: 'Quick Symbolic Profile',
    coreTitle: 'Core Meaning',
    readingTitle: 'Reading Summary',
    keywordTitle: 'Light & Shadow Keywords',
    light: 'Light',
    shadow: 'Shadow',
    descriptionSuffix: 'Read both upright and reversed interpretations.',
  },
  th: {
    upright: 'ความหมายไพ่ตั้งตรง',
    reversed: 'ความหมายไพ่กลับหัว',
    aliasPrefix: 'ชื่อไทย:',
    archetypePrefix: 'อาร์คีไทป์',
    symbolic: ['ราศี', 'ธาตุ', 'ดาวเคราะห์', 'เลขศาสตร์'],
    profileTitle: 'โปรไฟล์เชิงสัญลักษณ์',
    coreTitle: 'ความหมายหลัก',
    readingTitle: 'สรุปคำทำนาย',
    keywordTitle: 'คีย์เวิร์ดด้านสว่างและเงา',
    light: 'ด้านสว่าง',
    shadow: 'ด้านเงา',
    descriptionSuffix: 'อ่านความหมายทั้งไพ่ตั้งตรงและกลับหัวได้ในหน้าเดียว',
  },
};

const state = {
  lang: 'en',
  orientation: 'upright',
  cards: {
    upright: null,
    reversed: null,
  },
};

const dom = {
  title: document.querySelector('[data-card-meta="title"]'),
  description: document.querySelector('[data-card-meta="description"]'),
  ogTitle: document.querySelector('[data-card-meta="og-title"]'),
  ogDescription: document.querySelector('[data-card-meta="og-description"]'),
  ogUrl: document.querySelector('[data-card-meta="og-url"]'),
  twitterTitle: document.querySelector('[data-card-meta="twitter-title"]'),
  twitterDescription: document.querySelector('[data-card-meta="twitter-description"]'),
  canonical: document.querySelector('[data-card-meta="canonical"]'),
  schema: document.getElementById('cardMeaningSchema'),
  orientationLabel: document.getElementById('orientationLabel'),
  cardNameHeading: document.getElementById('cardNameHeading'),
  cardAlias: document.getElementById('cardAlias'),
  cardArchetype: document.getElementById('cardArchetype'),
  introLine: document.getElementById('introLine'),
  cardImageWrap: document.getElementById('cardImageWrap'),
  symbolicGrid: document.getElementById('symbolicGrid'),
  energyGrid: document.getElementById('energyGrid'),
  tarotImply: document.getElementById('tarotImply'),
  summaryPreview: document.getElementById('summaryPreview'),
  lightKeywords: document.getElementById('lightKeywords'),
  shadowKeywords: document.getElementById('shadowKeywords'),
  toggles: [...document.querySelectorAll('[data-orientation]')],
  profileTitle: document.querySelector('#symbolicProfile h2'),
  coreTitle: document.querySelector('#coreMeaning h2'),
  readingTitle: document.querySelector('#readingSummary h2'),
  keywordTitle: document.querySelector('#keywordSection h2'),
  keywordLightLabel: document.querySelector('#keywordSection p:nth-of-type(1) strong'),
  keywordShadowLabel: document.querySelector('#keywordSection p:nth-of-type(2) strong'),
};

function sanitize(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getLang() {
  const queryLang = (new URLSearchParams(window.location.search).get('lang') || '').toLowerCase();
  if (queryLang === 'th') return 'th';
  if (queryLang === 'en') return 'en';
  return window.location.pathname.startsWith('/th/') ? 'th' : 'en';
}

function getPagePath(lang = 'en') {
  return getCanonicalCardPath('three-of-wands', lang) || (lang === 'th' ? '/th/cards/three-of-wands/' : '/cards/three-of-wands/');
}

function getPageUrl(lang = 'en') {
  return `${BASE_URL}${getPagePath(lang)}`;
}

function buildLocaleUrl(lang = 'en') {
  const url = new URL(window.location.href);
  const params = new URLSearchParams(url.search);
  params.delete('lang');
  const search = params.toString();
  return `${getPagePath(lang)}${search ? `?${search}` : ''}${url.hash || ''}`;
}

function getVariant(orientation) {
  return state.cards[orientation] || state.cards.upright;
}

function orientationText(orientation) {
  return labels[state.lang][orientation] || labels.en.upright;
}

function getLocalized(card, fieldBase) {
  if (!card) return '';
  const thValue = card[`${fieldBase}_th`];
  const enValue = card[`${fieldBase}_en`];
  if (state.lang === 'th') return thValue || enValue || '';
  return enValue || thValue || '';
}

function renderImage(card, orientation) {
  const imageUrl = getCardImageUrl(card, { orientation });
  if (!imageUrl) {
    dom.cardImageWrap.innerHTML = '';
    return;
  }

  dom.cardImageWrap.innerHTML = `
    <div class="card-frame">
      <img
        src="${sanitize(imageUrl)}"
        alt="${sanitize(card.image_alt_en || card.card_name_en || 'Tarot card')}"
        loading="eager"
        width="720"
        height="1200"
      />
    </div>
  `;
}

function renderSymbolicProfile(card) {
  const metaLabels = labels[state.lang].symbolic;
  const zodiac = state.lang === 'th' ? (card.zodiac_sign_th || card.zodiac_sign) : (card.zodiac_sign || card.zodiac_sign_th);

  dom.symbolicGrid.innerHTML = [
    [metaLabels[0], zodiac],
    [metaLabels[1], card.element],
    [metaLabels[2], card.planet],
    [metaLabels[3], card.numerology_value],
  ].map(([label, value]) => `
    <div class="symbolic-row">
      <dt>${sanitize(label)}</dt>
      <dd>${sanitize(value)}</dd>
    </div>
  `).join('');

  const scores = card.energy_scores || {};
  const energyOrder = ['fire', 'water', 'air', 'earth'];
  dom.energyGrid.innerHTML = energyOrder.map((key) => {
    const score = Number(scores[key] || 0);
    return `
      <div class="energy-meter">
        <div class="energy-meter__top">
          <span>${sanitize(key)}</span>
          <strong>${score}</strong>
        </div>
        <div class="energy-meter__track" role="img" aria-label="${sanitize(key)} energy ${score} out of 100">
          <span style="width:${Math.max(0, Math.min(score, 100))}%"></span>
        </div>
      </div>
    `;
  }).join('');
}


function getDisplayName(card) {
  if (state.lang === 'th') return card.alias_th || card.card_name_en || 'ไพ่ทาโรต์';
  return card.card_name_en || card.alias_th || 'Tarot Card';
}

function updateSeo(card) {
  const pageUrl = getPageUrl(state.lang);
  const orientation = state.orientation;
  const orientationLabel = orientation === 'reversed'
    ? (state.lang === 'th' ? 'กลับหัว' : 'Reversed')
    : (state.lang === 'th' ? 'ตั้งตรง' : 'Upright');
  const displayName = getDisplayName(card);
  const baseTitle = state.lang === 'th'
    ? `ความหมายไพ่ ${displayName} (${orientationLabel}) | MeowTarot`
    : `${displayName} Tarot Meaning (${orientationLabel}) | MeowTarot`;
  const description = state.lang === 'th'
    ? (card.meta_description_th || card.meta_description_en || '')
    : (card.meta_description_en || card.meta_description_th || '');
  const fullDescription = `${description} ${labels[state.lang].descriptionSuffix}`.trim();

  if (dom.title) dom.title.textContent = baseTitle;
  if (dom.description) dom.description.setAttribute('content', fullDescription);
  if (dom.ogTitle) dom.ogTitle.setAttribute('content', baseTitle);
  if (dom.ogDescription) dom.ogDescription.setAttribute('content', fullDescription);
  if (dom.ogUrl) dom.ogUrl.setAttribute('content', pageUrl);
  if (dom.twitterTitle) dom.twitterTitle.setAttribute('content', baseTitle);
  if (dom.twitterDescription) dom.twitterDescription.setAttribute('content', fullDescription);
  if (dom.canonical) dom.canonical.setAttribute('href', pageUrl);
}

function updateSchema(card) {
  if (!dom.schema) return;
  const pageUrl = getPageUrl(state.lang);
  const schema = buildCardSchema(card, {
    lang: state.lang,
    pageUrl,
    baseUrl: BASE_URL,
    displayName: getDisplayName(card),
  });

  dom.schema.textContent = JSON.stringify(schema);
}

function render() {
  const card = getVariant(state.orientation);
  if (!card) return;

  const currentLabels = labels[state.lang];

  const isThai = state.lang === 'th';
  const localize = (path) => {
    if (!isThai) return path;
    if (path === '/') return '/th/';
    return path.startsWith('/th/') ? path : `/th${path}`;
  };

  const crumbHome = document.getElementById('crumbHome');
  const crumbMeanings = document.getElementById('crumbMeanings');
  const footerHome = document.getElementById('footerHomeLink');
  const footerIndex = document.getElementById('footerIndexLink');
  const footerNext = document.getElementById('footerNextLink');
  const footerDaily = document.getElementById('footerDailyLink');
  const footerFull = document.getElementById('footerFullLink');
  const footerQuestion = document.getElementById('footerQuestionLink');
  const nextCanonicalSlug = CANONICAL_CARD_ORDER[CANONICAL_CARD_ORDER.indexOf('three-of-wands') + 1] || '';
  const nextCanonicalPath = getCanonicalCardPath(nextCanonicalSlug, state.lang);

  if (crumbHome) crumbHome.setAttribute('href', localize('/'));
  if (crumbMeanings) crumbMeanings.setAttribute('href', localize('/tarot-card-meanings/'));
  if (footerHome) footerHome.setAttribute('href', localize('/'));
  if (footerIndex) footerIndex.setAttribute('href', localize('/tarot-card-meanings/'));
  if (footerNext) {
    const fallbackNext = localize('/cards/four-of-wands/');
    footerNext.setAttribute('href', nextCanonicalPath || fallbackNext);
  }
  if (footerDaily) footerDaily.setAttribute('href', localize('/daily.html'));
  if (footerFull) footerFull.setAttribute('href', localize('/full.html'));
  if (footerQuestion) footerQuestion.setAttribute('href', localize('/question.html'));

  dom.orientationLabel.textContent = orientationText(state.orientation);
  dom.cardNameHeading.textContent = getDisplayName(card);
  dom.cardAlias.textContent = card.alias_th ? `${currentLabels.aliasPrefix} ${card.alias_th}` : '';
  dom.cardArchetype.textContent = `${currentLabels.archetypePrefix}: ${getLocalized(card, 'archetype')}`;
  dom.introLine.textContent = getLocalized(card, 'tarot_imply');

  dom.profileTitle.textContent = currentLabels.profileTitle;
  dom.coreTitle.textContent = currentLabels.coreTitle;
  dom.readingTitle.textContent = currentLabels.readingTitle;
  dom.keywordTitle.textContent = currentLabels.keywordTitle;
  dom.keywordLightLabel.textContent = `${currentLabels.light}:`;
  dom.keywordShadowLabel.textContent = `${currentLabels.shadow}:`;

  renderImage(card, state.orientation);
  renderSymbolicProfile(card);

  dom.tarotImply.textContent = getLocalized(card, 'tarot_imply');

  dom.summaryPreview.textContent = getLocalized(card, 'reading_summary_preview');

  dom.lightKeywords.textContent = card.keywords_light || '';
  dom.shadowKeywords.textContent = card.keywords_shadow || '';

  dom.toggles.forEach((toggle) => {
    const active = toggle.dataset.orientation === state.orientation;
    toggle.setAttribute('aria-selected', active ? 'true' : 'false');
    toggle.classList.toggle('is-active', active);
  });

  updateSeo(card);
  updateSchema(card);
}

function pickCardData() {
  const matches = meowTarotCards.filter((card) => String(card.card_id || '').startsWith(CARD_ID_PREFIX));
  if (!matches.length) return false;

  state.cards.upright = matches.find((card) => card.orientation === 'upright') || matches[0];
  state.cards.reversed = matches.find((card) => card.orientation === 'reversed') || state.cards.upright;
  return true;
}

function bindEvents() {
  dom.toggles.forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const nextOrientation = toggle.dataset.orientation === 'reversed' ? 'reversed' : 'upright';
      if (nextOrientation === state.orientation) return;
      state.orientation = nextOrientation;
      render();
    });
  });
}

async function init() {
  state.lang = getLang();

  const expectedPath = getPagePath(state.lang);
  if (window.location.pathname !== expectedPath) {
    window.location.replace(buildLocaleUrl(state.lang));
    return;
  }

  initShell({ currentLang: state.lang }, null, 'meanings', {
    onLangToggle(lang) {
      window.location.assign(buildLocaleUrl(lang === 'th' ? 'th' : 'en'));
    },
  });

  await loadTarotData();

  if (!pickCardData()) {
    window.location.replace('/tarot-card-meanings/');
    return;
  }

  bindEvents();
  render();
}

init();
