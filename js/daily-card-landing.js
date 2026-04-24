import { initShell, pathHasThaiPrefix } from './common.js';
import {
  applyImageFallback,
  getCardBackFallbackUrl,
  getCardBackUrl,
  getCardImageUrl,
  loadTarotData,
  normalizeId,
} from './data.js';

const state = {
  currentLang: pathHasThaiPrefix(window.location.pathname) ? 'th' : 'en',
};

function toDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function hashString(input = '') {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function summarizeMeaning(card, lang) {
  const primary = lang === 'th' ? card.standalone_present_th : card.standalone_present_en;
  if (primary) return String(primary).trim();

  const fallback = lang === 'th' ? card.tarot_imply_th : card.tarot_imply_en;
  if (!fallback) return lang === 'th' ? 'ลองเชื่อใจสัญชาตญาณของคุณในวันนี้' : 'Trust your intuition and take one gentle step today.';

  return String(fallback)
    .split(/[,.]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(lang === 'th' ? ' · ' : ', ');
}

function getBaseDeck(cards = []) {
  const seen = new Set();
  return cards.filter((card) => {
    const base = normalizeId(String(card.card_id || card.id || '').replace(/-(upright|reversed)$/i, ''));
    if (!base || seen.has(base)) return false;
    seen.add(base);
    return true;
  });
}

function resolveOrientedCard(baseCard, orientation, cards) {
  const baseId = normalizeId(String(baseCard.card_id || baseCard.id || '').replace(/-(upright|reversed)$/i, ''));
  const orientedId = `${baseId}-${orientation}`;
  return cards.find((card) => normalizeId(card.card_id || card.id || '') === orientedId) || {
    ...baseCard,
    orientation,
    card_id: orientedId,
    id: orientedId,
  };
}

function pickDailyCard(cards = [], lang = 'en') {
  const dateKey = toDateKey(new Date());
  const seed = hashString(`${dateKey}-${lang}-meowtarot-daily-card`);
  const baseDeck = getBaseDeck(cards);
  const baseCard = baseDeck[seed % baseDeck.length];
  const orientation = seed % 2 === 0 ? 'upright' : 'reversed';
  return {
    dateKey,
    card: resolveOrientedCard(baseCard, orientation, cards),
  };
}

function formatDateForDisplay(dateKey, lang) {
  const [year, month, day] = dateKey.split('-').map((value) => Number(value));
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : 'en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

function renderDailyCard(card, dateKey, lang) {
  const dateEl = document.getElementById('daily-card-date');
  const imageEl = document.getElementById('daily-card-image');
  const nameEl = document.getElementById('daily-card-name');
  const orientationEl = document.getElementById('daily-card-orientation');
  const meaningEl = document.getElementById('daily-card-meaning');

  if (!dateEl || !imageEl || !nameEl || !orientationEl || !meaningEl) return;

  const isThai = lang === 'th';
  const cardName = isThai ? card.alias_th || card.name_th || card.card_name_en : card.card_name_en || card.name_en;
  const orientationLabel = card.orientation === 'reversed'
    ? (isThai ? 'ไพ่กลับหัว' : 'Reversed')
    : (isThai ? 'ไพ่ปกติ' : 'Upright');

  dateEl.textContent = isThai ? `ประจำวันที่ ${formatDateForDisplay(dateKey, lang)}` : `For ${formatDateForDisplay(dateKey, lang)}`;
  nameEl.textContent = cardName;
  orientationEl.textContent = orientationLabel;
  meaningEl.textContent = summarizeMeaning(card, lang);

  const cardBackUrl = getCardBackUrl();
  const cardBackFallbackUrl = getCardBackFallbackUrl();
  applyImageFallback(imageEl, getCardImageUrl(card, { orientation: card.orientation }), [cardBackUrl, cardBackFallbackUrl]);
  imageEl.alt = isThai ? `ภาพไพ่ประจำวัน: ${cardName}` : `Tarot card of the day: ${cardName}`;
}

async function initDailyCard() {
  initShell(state, null, 'daily');

  const cards = await loadTarotData();
  if (!cards?.length) return;

  const lang = state.currentLang === 'th' ? 'th' : 'en';
  const { dateKey, card } = pickDailyCard(cards, lang);
  renderDailyCard(card, dateKey, lang);
}

void initDailyCard();
