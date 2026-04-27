import { initShell } from './common.js';
import { getUserProgress } from './progress.js';
import { getCardImageUrl, loadTarotData, meowTarotCards } from './data.js';

const state = { currentLang: 'en' };

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

function latestEntry(progress) {
  const entries = Array.isArray(progress?.recent_daily_cards) ? progress.recent_daily_cards : [];
  if (!entries.length) return null;
  return entries[entries.length - 1] || null;
}

function findCardByBaseId(baseId) {
  return meowTarotCards.find((card) => String(card.image_id || '').startsWith(baseId)) || null;
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
  const entry = latestEntry(progress);

  els.streak.textContent = isThai()
    ? `🔥 สตรีควันที่ ${streakCount}`
    : `🔥 Day ${streakCount} streak`;

  if (!entry?.id) {
    els.empty.hidden = false;
    els.filled.hidden = true;
    return;
  }

  await loadTarotData();
  const card = findCardByBaseId(entry.id);
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

  els.cardName.textContent = text(card, 'card_name') || text(card, 'alias') || 'Tarot card';
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
