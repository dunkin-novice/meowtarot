/**
 * decks.js — Phase 5 standalone Deck Inventory page entry
 *
 * Renders /decks.html (and /th/decks.html) per ScreenDeckInventory in
 * the design doc (section 10). 2-column responsive grid showing all
 * decks with unlock state, active deck badge, and a status pill at
 * the top ("2 of 11 unlocked").
 *
 * Reuses getAllDecks / getActiveDeckId / setActiveDeck / canUnlockDeck
 * from data.js — the same primitives the profile-page deck strip uses.
 * Tap an unlocked deck → setActiveDeck + re-render. Tap a locked deck
 * → show a hint with the unlock day.
 */

import {
  applyLocaleMeta,
  applyTranslations,
  initShell,
  localizePath,
  pathHasThaiPrefix,
  translations,
} from './common.js';
import {
  getAllDecks,
  getActiveDeckId,
  setActiveDeck,
  canUnlockDeck,
} from './data.js';
import { getUserProgress } from './progress.js';
import { getCurrentUserSync, loginWithProvider } from './auth.js';
import { trackLocaleSwitched, trackDeckSelected, trackDeckUnlockPrompt } from './analytics.js';

const state = {
  currentLang: pathHasThaiPrefix(window.location.pathname) ? 'th' : 'en',
};

const els = {
  content: document.getElementById('decks-content'),
};

const COPY = {
  en: {
    eyebrowEn: 'Decks',
    eyebrowTh: 'สำรับ',
    headingEn: 'Your decks',
    headingTh: 'สำรับของคุณ',
    statusPattern: '{n} of {total} unlocked',
    statusPatternTh: 'ปลดล็อกแล้ว {n} จาก {total}',
    activeBadge: 'Active',
    activeBadgeTh: 'ใช้อยู่',
    unlockedAt: 'Unlocked · Day {day}',
    unlockedAtTh: 'ปลดล็อกที่วันที่ {day}',
    freeNote: 'Free · always yours',
    freeNoteTh: 'ฟรี · ใช้ได้เสมอ',
    awayPattern: 'Day {day} · {away} days away',
    awayPatternTh: 'วันที่ {day} · อีก {away} วัน',
    todayPattern: 'Day {day} · today',
    todayPatternTh: 'วันที่ {day} · วันนี้',
    backLabel: 'Back',
    backLabelTh: 'กลับ',
    setActiveToast: '{deck} is now your active deck',
    setActiveToastTh: 'เลือก {deck} เป็นสำรับหลักแล้ว',
    lockedToast: 'Reach Day {day} to unlock {deck}',
    lockedToastTh: 'ถึงวันที่ {day} เพื่อปลดล็อก {deck}',
  },
};

function getCopy() {
  return COPY.en; // single dict; lang switches done per-call inline
}

function pickLocalized(en, th) {
  return state.currentLang === 'th' ? th : en;
}

function fmt(template, vars) {
  let out = String(template || '');
  Object.entries(vars || {}).forEach(([k, v]) => {
    out = out.split(`{${k}}`).join(String(v));
  });
  return out;
}

let toastTimer = null;
function showDecksToast(message) {
  if (!els.content) return;
  const existing = document.getElementById('decks-toast');
  if (existing) existing.remove();
  if (toastTimer) { window.clearTimeout(toastTimer); toastTimer = null; }
  const toast = document.createElement('div');
  toast.id = 'decks-toast';
  toast.className = 'decks-toast';
  toast.textContent = message;
  els.content.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('is-visible'));
  toastTimer = window.setTimeout(() => {
    toast.classList.remove('is-visible');
    window.setTimeout(() => toast.remove(), 240);
  }, 2400);
}

function buildHero(progress, unlockedCount, totalCount) {
  const wrap = document.createElement('section');
  wrap.className = 'decks-hero';

  const topRow = document.createElement('div');
  topRow.className = 'decks-top-row';

  // No "back" button: Decks is reachable 3 ways (home, profile, bottom-nav), so a
  // back arrow that always returns to /profile is misleading. Bottom-nav handles nav.

  const eyebrowGroup = document.createElement('div');
  eyebrowGroup.className = 'decks-top-row__eyebrow';
  const eyebrowEn = document.createElement('span');
  // EN-only on EN / TH-only on TH — single-language eyebrow.
  eyebrowEn.textContent = pickLocalized('Decks', 'สำรับ');
  eyebrowGroup.appendChild(eyebrowEn);
  topRow.appendChild(eyebrowGroup);

  const spacer = document.createElement('div');
  spacer.className = 'decks-top-row__spacer';
  topRow.appendChild(spacer);

  wrap.appendChild(topRow);

  const headingEn = document.createElement('h1');
  headingEn.className = 'decks-heading__en';
  headingEn.textContent = pickLocalized('Your decks', 'สำรับของคุณ');
  wrap.appendChild(headingEn);

  const statusRow = document.createElement('div');
  statusRow.className = 'decks-status-row';

  const pill = document.createElement('div');
  pill.className = 'decks-status-pill';
  pill.textContent = state.currentLang === 'th'
    ? fmt('ปลดล็อกแล้ว {n} จาก {total}', { n: unlockedCount, total: totalCount })
    : fmt('{n} of {total} unlocked', { n: unlockedCount, total: totalCount });
  statusRow.appendChild(pill);

  wrap.appendChild(statusRow);
  return wrap;
}

function buildDeckCell(deck, { progress, activeId, render }) {
  const cell = document.createElement('button');
  cell.type = 'button';
  cell.className = 'decks-cell';
  cell.dataset.deck = deck.id;

  const unlocked = canUnlockDeck(deck.id);
  const isActive = deck.id === activeId;
  if (unlocked) cell.classList.add('is-unlocked');
  else cell.classList.add('is-locked');
  if (isActive) cell.classList.add('is-active');

  const thumb = document.createElement('div');
  thumb.className = 'decks-cell__thumb';
  const img = document.createElement('img');
  img.className = 'decks-cell__img';
  img.alt = '';
  img.loading = 'lazy';
  img.src = deck.backImage || '';
  thumb.appendChild(img);

  if (isActive) {
    const badge = document.createElement('span');
    badge.className = 'decks-cell__active-badge';
    badge.textContent = pickLocalized('Active', 'ใช้อยู่');
    thumb.appendChild(badge);
  }

  if (!unlocked) {
    const lock = document.createElement('span');
    lock.className = 'decks-cell__lock';
    lock.setAttribute('aria-hidden', 'true');
    lock.textContent = '🔒';
    thumb.appendChild(lock);
  }

  cell.appendChild(thumb);

  const meta = document.createElement('div');
  meta.className = 'decks-cell__meta';

  // EN-only on EN / TH-only on TH — single name per locale.
  const nameEn = document.createElement('div');
  nameEn.className = 'decks-cell__name';
  nameEn.textContent = pickLocalized(deck.name || '', deck.name_th || deck.name || '');
  meta.appendChild(nameEn);

  const note = document.createElement('div');
  note.className = 'decks-cell__note';
  const streak = Math.max(0, Number(progress?.streak_current) || 0);
  const signedIn = Boolean(getCurrentUserSync());
  if (!signedIn) {
    // Logged out: decks/streak don't persist without an account, so every cell is a
    // sign-in CTA — "own it" for the free defaults, "get it" for the unlock decks.
    note.textContent = deck.unlock_day == null
      ? pickLocalized('Sign in to own it', 'ลงชื่อเข้าใช้เพื่อเป็นเจ้าของ')
      : pickLocalized('Sign in to get it', 'ลงชื่อเข้าใช้เพื่อรับสำรับนี้');
  } else if (deck.unlock_day == null) {
    note.textContent = pickLocalized('Free · always yours', 'ฟรี · ใช้ได้เสมอ');
  } else if (unlocked) {
    note.textContent = pickLocalized(
      fmt('Unlocked · Day {day}', { day: deck.unlock_day }),
      fmt('ปลดล็อกที่วันที่ {day}', { day: deck.unlock_day })
    );
  } else {
    const away = Math.max(0, deck.unlock_day - streak);
    if (away === 0) {
      note.textContent = pickLocalized(
        fmt('Day {day} · today', { day: deck.unlock_day }),
        fmt('วันที่ {day} · วันนี้', { day: deck.unlock_day })
      );
    } else {
      note.textContent = pickLocalized(
        fmt('Day {day} · {away} days away', { day: deck.unlock_day, away }),
        fmt('วันที่ {day} · อีก {away} วัน', { day: deck.unlock_day, away })
      );
    }
  }
  meta.appendChild(note);
  cell.appendChild(meta);

  cell.addEventListener('click', () => {
    try { trackDeckSelected({ deckId: deck.id, locale: state.currentLang, locked: !unlocked }); } catch (_) {}
    // Logged out: any deck tap → sign-in gate (matches the "Sign in to own/get it" notes).
    if (!getCurrentUserSync()) {
      try { trackDeckUnlockPrompt({ deckId: deck.id, locale: state.currentLang, reason: 'signin_required' }); } catch (_) {}
      import('./sign-in-gate.js')
        .then(({ showSignInGate }) => showSignInGate({
          lang: state.currentLang,
          onSignIn: () => loginWithProvider('google').catch(() => {}),
        }))
        .catch(() => {});
      return;
    }
    if (!unlocked) {
      try { trackDeckUnlockPrompt({ deckId: deck.id, locale: state.currentLang, reason: 'streak_locked' }); } catch (_) {}
      showDecksToast(state.currentLang === 'th'
        ? fmt('ถึงวันที่ {day} เพื่อปลดล็อก {deck}', { day: deck.unlock_day, deck: deck.name_th || deck.name })
        : fmt('Reach Day {day} to unlock {deck}', { day: deck.unlock_day, deck: deck.name }));
      return;
    }
    if (isActive) return;
    try { setActiveDeck(deck.id); } catch (_) {}
    showDecksToast(state.currentLang === 'th'
      ? fmt('เลือก {deck} เป็นสำรับหลักแล้ว', { deck: deck.name_th || deck.name })
      : fmt('{deck} is now your active deck', { deck: deck.name }));
    render();
  });

  return cell;
}

function renderAll() {
  if (!els.content) return;
  els.content.innerHTML = '';

  const decks = getAllDecks();
  const progress = getUserProgress();
  const activeId = getActiveDeckId();

  const unlockableDecks = decks.filter((d) => d && d.unlock_day != null);
  const unlockedDecks = decks.filter((d) => canUnlockDeck(d.id));
  const unlockedCount = unlockedDecks.length;
  const totalCount = decks.length;

  els.content.appendChild(buildHero(progress, unlockedCount, totalCount));

  const grid = document.createElement('div');
  grid.className = 'decks-grid';
  decks.forEach((deck) => {
    grid.appendChild(buildDeckCell(deck, { progress, activeId, render: renderAll }));
  });
  els.content.appendChild(grid);
}

function onTranslations() {
  renderAll();
}

function switchLanguageInPlace(nextLang) {
  if (!nextLang || nextLang === state.currentLang) return;
  const fromLocale = state.currentLang;
  state.currentLang = nextLang;
  try { trackLocaleSwitched({ fromLocale, toLocale: nextLang }); } catch (_) {}
  try { localStorage.setItem('meowtarot_lang', nextLang); } catch (_) {}
  applyTranslations(nextLang, onTranslations);
  applyLocaleMeta(nextLang);
}

function init() {
  initShell(state, onTranslations, 'decks', {
    onLangToggle: switchLanguageInPlace,
  });
  renderAll();
}

document.addEventListener('DOMContentLoaded', init);
