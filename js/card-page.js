import { initShell, pathHasThaiPrefix } from './common.js';
import { getCardImageUrl, loadTarotData, meowTarotCards, normalizeId } from './data.js';
import {
  renderCardHero,
  renderMeaningSnapshot,
  renderTimeline,
  renderReadingDigest,
  renderLove,
  renderTopicTimeline,
  renderPracticalGuidance,
  renderSymbolism,
  renderRelatedLinks,
  renderReadingCta,
  hasContent,
} from './components/card-meaning-components.js';
import { getRelatedCards } from './related-cards.js';

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
  page: document.getElementById('cardPage'),
  hero: document.getElementById('cardHero'),
  crumbCard: document.getElementById('crumbCard'),
  crumbIndex: document.getElementById('crumbIndex'),
  crumbHome: document.getElementById('crumbHome'),
  crumbHubItem: document.getElementById('crumbHubItem'),
  crumbHub: document.getElementById('crumbHub'),
  meaningSnapshot: document.getElementById('meaningSnapshot'),
  meaningTimeline: document.getElementById('meaningTimeline'),
  readingDigest: document.getElementById('readingDigest'),
  loveSection: document.getElementById('loveSection'),
  careerSection: document.getElementById('careerSection'),
  financeSection: document.getElementById('financeSection'),
  ritualSection: document.getElementById('ritualSection'),
  symbolismMeta: document.getElementById('symbolismMeta'),
  relatedLinks: document.getElementById('relatedLinks'),
  readingCta: document.getElementById('readingCta'),
  seoNotes: document.getElementById('seoNotes'),
};

const state = {
  currentLang: 'en',
};

function isThaiPath() {
  return pathHasThaiPrefix(window.location.pathname || '/');
}

function getRequestedMode() {
  const param = (new URLSearchParams(window.location.search).get('lang') || '').toLowerCase();
  if (param === 'th' || param === 'en' || param === 'both') return param;
  return isThaiPath() ? 'th' : 'en';
}

function getRequestedOrientation() {
  const param = (new URLSearchParams(window.location.search).get('orientation') || '').toLowerCase();
  return param === 'reversed' ? 'reversed' : 'upright';
}

function cleanSlug(raw = '') {
  return raw.replace(/\/+$/, '').split('/').filter(Boolean).pop() || '';
}

function extractSlugFromPath(pathname = '') {
  const segments = `${pathname}`
    .replace(/\/+$/, '')
    .split('/')
    .filter(Boolean);

  const meaningsIdx = segments.lastIndexOf('tarot-card-meanings');
  if (meaningsIdx === -1) return '';

  const candidate = segments[meaningsIdx + 1] || '';
  if (!candidate || candidate === 'card.html' || candidate === 'index.html') return '';

  return normalizeId(candidate);
}

function getRequestedSlug() {
  const pathSlug = extractSlugFromPath(window.location.pathname || '');
  const querySlug = new URLSearchParams(window.location.search).get('card') || '';
  if (pathSlug) return pathSlug;
  return normalizeId(querySlug);
}

function cardSlug(card) {
  return normalizeId(card?.seo_slug_en || card?.card_id || card?.id || '');
}

function findCardVariant(slug, orientation) {
  return meowTarotCards.find((card) => cardSlug(card) === slug && (card.orientation || 'upright') === orientation) || null;
}

function findBaseCard(slug) {
  return meowTarotCards.find((card) => cardSlug(card) === slug && (card.orientation || 'upright') !== 'reversed')
    || meowTarotCards.find((card) => cardSlug(card) === slug)
    || null;
}

function buildCardUrl(slug, lang = 'en') {
  const prefix = lang === 'th' ? '/th' : '';
  return `https://www.meowtarot.com${prefix}/tarot-card-meanings/${slug}/`;
}

function orientationLabel(orientation, mode) {
  if (orientation === 'reversed') return mode === 'th' ? 'กลับหัว' : 'Reversed';
  return mode === 'th' ? 'ตั้งตรง' : 'Upright';
}

function resolveMetaDescription(card, mode) {
  if (mode === 'th' && hasContent(card.meta_description_th)) return card.meta_description_th;
  return card.meta_description_en || card.reading_summary_preview_en || card.tarot_imply_en || '';
}

function updateSeo(card, slug, mode) {
  const isThai = mode === 'th';
  const titleEn = `${card.card_name_en || 'Tarot Card'} Tarot Meaning | MeowTarot`;
  const titleTh = `${card.alias_th || card.card_name_en || 'ไพ่ทาโรต์'} ความหมายไพ่ทาโรต์ | MeowTarot`;
  const title = isThai ? titleTh : titleEn;
  const description = resolveMetaDescription(card, mode);

  if (metaFields.title) metaFields.title.textContent = title;
  if (metaFields.description) metaFields.description.setAttribute('content', description);
  if (metaFields.ogTitle) metaFields.ogTitle.setAttribute('content', title);
  if (metaFields.ogDescription) metaFields.ogDescription.setAttribute('content', description);
  if (metaFields.ogUrl) metaFields.ogUrl.setAttribute('content', buildCardUrl(slug, isThai ? 'th' : 'en'));
  if (metaFields.twitterTitle) metaFields.twitterTitle.setAttribute('content', title);
  if (metaFields.twitterDescription) metaFields.twitterDescription.setAttribute('content', description);
  if (metaFields.canonical) metaFields.canonical.setAttribute('href', buildCardUrl(slug, isThai ? 'th' : 'en'));
  if (metaFields.hreflangEn) metaFields.hreflangEn.setAttribute('href', buildCardUrl(slug, 'en'));
  if (metaFields.hreflangTh) metaFields.hreflangTh.setAttribute('href', buildCardUrl(slug, 'th'));
  if (metaFields.hreflangX) metaFields.hreflangX.setAttribute('href', buildCardUrl(slug, 'en'));
}

function setSection(sectionEl, html) {
  if (!sectionEl) return;
  const value = (html || '').trim();
  if (!value) {
    sectionEl.innerHTML = '';
    sectionEl.hidden = true;
    return;
  }
  sectionEl.innerHTML = value;
  sectionEl.hidden = false;
}

function getGroupMeta(card) {
  const raw = card.card_id || card.id || '';
  const match = `${raw}`.match(/^(\d{2})/);
  const number = match ? parseInt(match[1], 10) : 0;
  if (!number || number <= 22) return { label: 'Major Arcana', href: '/tarot-card-meanings/major.html' };
  if (number <= 36) return { label: 'Wands', href: '/tarot-card-meanings/wands.html' };
  if (number <= 50) return { label: 'Cups', href: '/tarot-card-meanings/cups.html' };
  if (number <= 64) return { label: 'Swords', href: '/tarot-card-meanings/swords.html' };
  return { label: 'Pentacles', href: '/tarot-card-meanings/pentacles.html' };
}

function localizeLink(path, mode) {
  if (mode !== 'th') return path;
  if (path.startsWith('/th/')) return path;
  if (path === '/') return '/th/';
  return `/th${path}`;
}

function redirectToMeaningsIndex(mode) {
  const target = localizeLink('/tarot-card-meanings/', mode);
  window.location.replace(target);
}

function renderPage(card, slug, mode, orientation) {
  const group = getGroupMeta(card);
  const imageUrl = getCardImageUrl(card, { orientation });
  const isThai = mode === 'th';

  if (dom.page) dom.page.dataset.renderLang = mode;
  if (dom.crumbCard) dom.crumbCard.textContent = isThai ? (card.alias_th || card.card_name_en || 'ไพ่') : (card.card_name_en || 'Card');
  if (dom.crumbHome) dom.crumbHome.setAttribute('href', localizeLink('/', mode));
  if (dom.crumbIndex) dom.crumbIndex.setAttribute('href', localizeLink('/tarot-card-meanings/', mode));
  if (dom.crumbHub && dom.crumbHubItem) {
    dom.crumbHub.textContent = group.label;
    dom.crumbHub.setAttribute('href', localizeLink(group.href, mode));
    dom.crumbHubItem.hidden = false;
  }

  setSection(dom.hero, renderCardHero(card, orientationLabel(orientation, mode), imageUrl, mode));
  setSection(dom.meaningSnapshot, renderMeaningSnapshot(card, mode));
  setSection(dom.meaningTimeline, renderTimeline(card, mode));
  setSection(dom.readingDigest, renderReadingDigest(card, mode));
  setSection(dom.loveSection, renderLove(card, mode));
  setSection(dom.careerSection, renderTopicTimeline(isThai ? 'การงาน' : 'Career', {
    pastEn: card.career_past_en,
    presentEn: card.career_present_en,
    futureEn: card.career_future_en,
    pastTh: card.career_past_th,
    presentTh: card.career_present_th,
    futureTh: card.career_future_th,
  }, mode));
  setSection(dom.financeSection, renderTopicTimeline(isThai ? 'การเงิน' : 'Finance', {
    pastEn: card.finance_past_en,
    presentEn: card.finance_present_en,
    futureEn: card.finance_future_en,
    pastTh: card.finance_past_th,
    presentTh: card.finance_present_th,
    futureTh: card.finance_future_th,
  }, mode));
  setSection(dom.ritualSection, renderPracticalGuidance(card, mode));
  setSection(dom.symbolismMeta, renderSymbolism(card));

  const relatedCards = getRelatedCards(card, meowTarotCards, { orientation, limit: 6 });
  setSection(dom.relatedLinks, renderRelatedLinks({
    indexPath: localizeLink('/tarot-card-meanings/', mode),
    hubPath: localizeLink(group.href, mode),
    hubLabel: group.label,
    relatedCards,
    mode,
  }));
  setSection(dom.readingCta, renderReadingCta(isThai));

  if (dom.seoNotes) {
    dom.seoNotes.innerHTML = `
      <p>seo_slug_en: ${card.seo_slug_en || slug}</p>
      ${hasContent(card.meta_description_en) ? `<p>meta_description_en: ${card.meta_description_en}</p>` : ''}
      ${hasContent(card.meta_description_th) ? `<p>meta_description_th: ${card.meta_description_th}</p>` : ''}
    `;
  }

  updateSeo(card, slug, mode);
}

function init() {
  initShell(state, null, document.body?.dataset?.page || 'card-meaning');
  loadTarotData().then(() => {
    const slug = getRequestedSlug();
    const requestedOrientation = getRequestedOrientation();
    const mode = getRequestedMode();

    if (!slug) {
      redirectToMeaningsIndex(mode);
      return;
    }

    const fallbackCard = findBaseCard(slug);
    if (!fallbackCard) {
      redirectToMeaningsIndex(mode);
      return;
    }

    const orientedCard = findCardVariant(cardSlug(fallbackCard), requestedOrientation)
      || findCardVariant(cardSlug(fallbackCard), 'upright')
      || fallbackCard;

    renderPage(orientedCard, cardSlug(fallbackCard), mode, requestedOrientation);
  });
}

init();
