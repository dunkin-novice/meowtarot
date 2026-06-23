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
  isPinnedDeck,
  togglePinnedDeck,
} from './data.js';
import { getUserProgress } from './progress.js';
import { getCurrentUserSync, loginWithProvider, subscribeAuthState } from './auth.js';
import { trackLocaleSwitched, trackDeckSelected, trackDeckUnlockPrompt } from './analytics.js';
import { showDeckPreview } from './deck-preview.js';

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

// Popup shown when a locked deck is tapped (#6): deck preview + the unlock
// condition stated in accumulated days drawn (matches the new unlock logic).
function showUnlockConditionPopup(deck) {
  if (typeof document === 'undefined' || document.getElementById('mt-unlock-popup')) return;
  const th = state.currentLang === 'th';
  const progress = getUserProgress();
  const have = Math.max(0, Number(progress?.total_daily_reads) || 0);
  const need = Number(deck.unlock_day) || 0;
  const remaining = Math.max(0, need - have);
  const name = th ? (deck.name_th || deck.name) : deck.name;

  if (!document.getElementById('mt-unlock-style')) {
    const st = document.createElement('style');
    st.id = 'mt-unlock-style';
    st.textContent = `
      .mt-unlock-overlay{position:fixed;inset:0;z-index:1250;display:flex;align-items:center;justify-content:center;padding:22px;background:rgba(28,12,52,.45);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:0;transition:opacity .2s ease;}
      .mt-unlock-overlay.in{opacity:1;}
      .mt-unlock-card{width:100%;max-width:340px;background:linear-gradient(180deg,#fffaf2,#fdf3ec);border:1px solid rgba(197,177,220,.5);border-radius:22px;padding:22px 20px 18px;text-align:center;box-shadow:0 30px 60px -20px rgba(20,8,40,.5);transform:translateY(10px) scale(.98);transition:transform .26s cubic-bezier(.34,1.56,.64,1);}
      .mt-unlock-overlay.in .mt-unlock-card{transform:none;}
      .mt-unlock-card img{width:96px;height:auto;border-radius:12px;margin:0 auto 12px;display:block;box-shadow:0 10px 24px -10px rgba(61,26,92,.5);}
      .mt-unlock-name{font-family:var(--mt-font-display,"Cormorant Garamond",serif);font-style:italic;font-weight:600;font-size:22px;color:var(--mt-plum,#3d1a5c);margin:0 0 4px;}
      .mt-unlock-cond{font-family:var(--mt-font-body,"DM Sans",sans-serif);font-size:14px;color:var(--mt-ink-soft,#6b5b82);margin:6px 0 2px;line-height:1.5;}
      .mt-unlock-remain{font-family:var(--mt-font-body,"DM Sans",sans-serif);font-size:13px;font-weight:600;color:var(--mt-plum-mid,#6a3f8e);margin:2px 0 14px;}
      .mt-unlock-close{width:100%;padding:12px;border:none;border-radius:14px;background:var(--mt-plum,#3d1a5c);color:#fff8e7;font-family:var(--mt-font-body,"DM Sans",sans-serif);font-weight:600;font-size:14px;cursor:pointer;}
    `;
    document.head.appendChild(st);
  }

  const ov = document.createElement('div');
  ov.id = 'mt-unlock-popup';
  ov.className = 'mt-unlock-overlay';
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-modal', 'true');
  const thumb = String(deck.backImage || '').replace('00-back.webp', '00-back-200.webp');
  const condText = th
    ? `เปิดไพ่สะสมครบ ${need} วันเพื่อปลดล็อก ${name}`
    : `Draw on ${need} days to unlock ${name}`;
  const remainText = remaining > 0
    ? (th ? `เปิดไพ่อีก ${remaining} วัน (ตอนนี้ ${have} วัน)` : `${remaining} more day${remaining === 1 ? '' : 's'} to go (you have ${have})`)
    : (th ? 'พร้อมปลดล็อกแล้ว!' : 'Ready to unlock!');
  ov.innerHTML = `
    <div class="mt-unlock-card" role="document">
      ${thumb ? `<img src="${thumb}" alt="" />` : ''}
      <p class="mt-unlock-name">${name}</p>
      <p class="mt-unlock-cond">🔒 ${condText}</p>
      <p class="mt-unlock-remain">${remainText}</p>
      <button type="button" class="mt-unlock-close">${th ? 'เข้าใจแล้ว' : 'Got it'}</button>
    </div>`;
  document.body.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('in'));
  const close = () => { ov.classList.remove('in'); setTimeout(() => ov.remove(), 220); };
  ov.querySelector('.mt-unlock-close')?.addEventListener('click', close);
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
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

  // Star/pin toggle (top-right) — pinned decks float to the front of the grid.
  if (unlocked) {
    const pinned = isPinnedDeck(deck.id);
    const pin = document.createElement('span');
    pin.className = 'decks-cell__pin' + (pinned ? ' is-pinned' : '');
    pin.setAttribute('role', 'button');
    pin.setAttribute('tabindex', '0');
    pin.setAttribute('aria-pressed', pinned ? 'true' : 'false');
    pin.setAttribute('aria-label', pinned
      ? pickLocalized('Unpin deck', 'เลิกปักหมุดสำรับ')
      : pickLocalized('Pin deck to top', 'ปักหมุดสำรับไว้ด้านบน'));
    pin.textContent = pinned ? '★' : '☆';
    const toggle = (e) => {
      if (e) { e.stopPropagation(); e.preventDefault(); }
      togglePinnedDeck(deck.id);
      render();
    };
    pin.addEventListener('click', toggle);
    pin.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') toggle(e); });
    thumb.appendChild(pin);
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
    // Owned deck → open the deck PREVIEW (the Fool art) with a "Set active" action inside, so
    // tapping a deck always shows it before switching. (founder 2026-06-22; consistent with the
    // gacha/shop preview.) The pin star is a separate control (stops propagation).
    if (unlocked) {
      showDeckPreview(deck, {
        lang: state.currentLang,
        buildCondition(cond, { close }) {
          const text = document.createElement('p');
          text.className = 'mt-dp-cond-text';
          if (isActive) {
            text.textContent = pickLocalized('✓ This is your active deck.', '✓ นี่คือสำรับที่ใช้อยู่');
            cond.appendChild(text);
            const c = document.createElement('button');
            c.type = 'button'; c.className = 'mt-dp-btn mt-dp-btn--close';
            c.textContent = pickLocalized('Close', 'ปิด');
            c.addEventListener('click', close);
            cond.appendChild(c);
            return;
          }
          text.textContent = pickLocalized('Make this your active deck.', 'ตั้งเป็นสำรับที่ใช้อยู่');
          cond.appendChild(text);
          const btn = document.createElement('button');
          btn.type = 'button'; btn.className = 'mt-dp-btn mt-dp-btn--buy';
          btn.textContent = pickLocalized('Set active', 'ใช้สำรับนี้');
          btn.addEventListener('click', () => {
            try { setActiveDeck(deck.id); } catch (_) {}
            showDecksToast(state.currentLang === 'th'
              ? fmt('เลือก {deck} เป็นสำรับหลักแล้ว', { deck: deck.name_th || deck.name })
              : fmt('{deck} is now your active deck', { deck: deck.name }));
            close();
            render();
          });
          cond.appendChild(btn);
        },
      });
      return;
    }
    // Locked deck: logged out → sign-in gate; logged in → unlock-conditions popup.
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
    try { trackDeckUnlockPrompt({ deckId: deck.id, locale: state.currentLang, reason: 'streak_locked' }); } catch (_) {}
    showUnlockConditionPopup(deck);
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
  // "Your decks" shows ONLY decks you actually own/unlocked — not the locked ones you
  // haven't earned yet (founder 2026-06-21: "remove what's not yours"). The status pill
  // above still counts unlocked/total so progress stays visible. Logged-out users see just
  // the free default (+ any coin-purchased deck), which is correctly "what's yours".
  // Pinned/starred decks float to the front (stable order otherwise).
  const orderedDecks = unlockedDecks
    .map((deck, i) => ({ deck, i, pinned: isPinnedDeck(deck.id) }))
    .sort((a, b) => (a.pinned === b.pinned ? a.i - b.i : (a.pinned ? -1 : 1)))
    .map((x) => x.deck);
  orderedDecks.forEach((deck) => {
    grid.appendChild(buildDeckCell(deck, { progress, activeId, render: renderAll }));
  });
  els.content.appendChild(grid);

  // "Want more decks?" → Shop nudge (from MeowShop.dc.html). Earn coins, spend in the shop.
  const nudge = document.createElement('a');
  nudge.className = 'decks-shop-nudge';
  nudge.href = localizePath('/shop.html', state.currentLang);
  nudge.innerHTML =
    '<span class="decks-shop-nudge__icon"><img src="/assets/meow-coin-200.webp" alt="" aria-hidden="true" /></span>'
    + '<span class="decks-shop-nudge__body">'
    + `<span class="decks-shop-nudge__title">${pickLocalized('Want more decks?', 'อยากได้สำรับเพิ่ม?')}</span>`
    + `<span class="decks-shop-nudge__sub">${pickLocalized('Earn Meow Coins from daily readings & streaks, then unlock new art styles in the Shop.', 'รับเหรียญเหมียวจากการเปิดไพ่รายวันและสตรีค แล้วปลดล็อกสไตล์ใหม่ในร้านค้า')}</span>`
    + '</span>'
    + `<span class="decks-shop-nudge__cta">${pickLocalized('Go to Shop', 'ไปที่ร้านค้า')} →</span>`;
  els.content.appendChild(nudge);
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
  // Auth resolves async: the first paint can run logged-out (everything locked/dull),
  // and signing in / unlocking a deck must refresh the lock+dull state. Re-render on
  // every auth change so owned decks lose the dull treatment without a manual reload.
  subscribeAuthState(() => renderAll());
}

document.addEventListener('DOMContentLoaded', init);
