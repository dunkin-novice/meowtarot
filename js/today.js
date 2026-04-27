import { initShell } from './common.js';
import { getUserProgress } from './progress.js';
import { getCardImageUrl, loadTarotData, meowTarotCards } from './data.js';

const state = { currentLang: 'en' };
const DAILY_CARD_OF_DAY_STORAGE_KEY = 'meowtarot.daily.cardOfTheDay';

const els = {
  streak: document.getElementById('today-streak'),
  empty: document.getElementById('today-empty'),
  filled: document.getElementById('today-filled'),
  cardName: document.getElementById('today-card-name'),
  cardMeaning: document.getElementById('today-card-meaning'),
  cardKeywords: document.getElementById('today-card-keywords'),
  cardImage: document.getElementById('today-card-image'),
  share: document.getElementById('today-share'),
};

function isThai() {
  return window.location.pathname.startsWith('/th/');
}

function toLocalDateIso(input = new Date()) {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return '';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function readCardOfTheDay() {
  try {
    const raw = window.localStorage?.getItem(DAILY_CARD_OF_DAY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const date = String(parsed.date || '').trim();
    const cardSlug = String(parsed.card_slug || '').trim();
    const orientation = String(parsed.orientation || '').toLowerCase() === 'reversed' ? 'reversed' : 'upright';
    if (!date || !cardSlug) return null;
    return { date, card_slug: cardSlug, orientation };
  } catch (_) {
    return null;
  }
}

function findCardBySlug(slug) {
  const safe = String(slug || '').trim().toLowerCase();
  if (!safe) return null;
  return meowTarotCards.find((card) => {
    const id = String(card.image_id || card.card_id || card.id || '').toLowerCase();
    return id.includes(`-${safe}`);
  }) || null;
}

function text(card, key) {
  if (!card) return '';
  if (isThai()) return card[`${key}_th`] || card[`${key}_en`] || '';
  return card[`${key}_en`] || card[`${key}_th`] || '';
}

async function onShare() {
  const url = window.location.href;
  const title = isThai() ? 'Today | MeowTarot' : 'Today | MeowTarot';
  try {
    if (navigator.share) {
      await navigator.share({ title, url });
      return;
    }
  } catch (_) {
    // no-op
  }
  try {
    await navigator.clipboard.writeText(url);
    els.share.textContent = isThai() ? 'คัดลอกลิงก์แล้ว' : 'Link copied';
  } catch (_) {
    // no-op
  }
}

async function renderToday() {
  const progress = getUserProgress();
  const streakCount = Number(progress?.streak_current || 0);
  const entry = readCardOfTheDay();
  const today = toLocalDateIso(new Date());

  els.streak.textContent = isThai()
    ? `🔥 สตรีควันที่ ${streakCount}`
    : `🔥 Day ${streakCount} streak`;

  if (!entry?.card_slug || entry.date !== today) {
    els.empty.hidden = false;
    els.filled.hidden = true;
    return;
  }

  await loadTarotData();
  const card = findCardBySlug(entry.card_slug);
  if (!card) {
    els.empty.hidden = false;
    els.filled.hidden = true;
    return;
  }

  els.empty.hidden = true;
  els.filled.hidden = false;

  const orientation = entry.orientation === 'reversed' ? 'reversed' : 'upright';
  const imageUrl = getCardImageUrl(card, { orientation });
  const keywords = text(card, 'keywords') || text(card, 'tarot_imply');
  const orientationLabel = orientation === 'reversed'
    ? (isThai() ? 'ไพ่กลับหัว' : 'Reversed')
    : (isThai() ? 'ไพ่ปกติ' : 'Upright');

  const cardName = text(card, 'card_name') || text(card, 'alias') || 'Tarot card';
  els.cardName.textContent = `${cardName} · ${orientationLabel}`;
  els.cardMeaning.textContent = text(card, 'summary_short') || text(card, 'summary') || text(card, 'meta_description');
  els.cardKeywords.textContent = keywords;
  els.cardImage.src = imageUrl;
  els.cardImage.alt = els.cardName.textContent;
  els.share.addEventListener('click', onShare);
}

document.addEventListener('DOMContentLoaded', () => {
  initShell(state, null, 'daily');
  renderToday().catch(() => {
    els.empty.hidden = false;
    els.filled.hidden = true;
  });
});
