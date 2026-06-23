// Meow Coin — soft in-app currency (founder 2026-06-21). Earn through engagement, spend in the
// Shop to unlock AI decks. This is the CLIENT-SIDE MVP (localStorage), matching the existing
// client-side deck-unlock model so it ships now; the server-authoritative wallet (Supabase
// meow_wallets/meow_ledger + edge fns) is the planned hardening — see [[MeowTarot Meow Coin]].
//
// Earn (founder spec): daily login +5, daily reading +5 (10/day cap via once-per-day keys);
// each achievement / deck unlock +20. Spend: 100 coins per AI deck in the Shop.

const WALLET_KEY = 'meowtarot_meow_wallet';
export const DAILY_LOGIN_COINS = 5;
export const DAILY_READING_COINS = 5;
export const ACHIEVEMENT_COINS = 20;
export const DECK_PRICE_COINS = 100;

const listeners = new Set();

function readWallet() {
  try {
    const w = JSON.parse(localStorage.getItem(WALLET_KEY) || '{}');
    return {
      balance: Math.max(0, Math.floor(Number(w.balance) || 0)),
      keys: (w.keys && typeof w.keys === 'object') ? w.keys : {},
    };
  } catch (_) {
    return { balance: 0, keys: {} };
  }
}

function writeWallet(w) {
  try {
    localStorage.setItem(WALLET_KEY, JSON.stringify({ balance: Math.max(0, Math.floor(w.balance)), keys: w.keys }));
  } catch (_) { /* ignore quota / disabled storage */ }
  notify(w.balance);
}

function notify(balance) {
  listeners.forEach((fn) => { try { fn(balance); } catch (_) { /* ignore */ } });
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
// Calendar-week key = the Monday date of the current week (stable per calendar week).
function weekKey() {
  const d = new Date();
  const mondayOffset = (d.getDay() + 6) % 7; // Sun=6 … Mon=0
  const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - mondayOffset);
  return `W${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, '0')}-${String(mon.getDate()).padStart(2, '0')}`;
}
function monthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function trackCoin(action, amount, reason) {
  try {
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', 'meow_coin', { coin_action: action, coin_amount: amount, coin_reason: reason });
    }
  } catch (_) { /* analytics best-effort */ }
}

export function getMeowCoins() {
  return readWallet().balance;
}

// --- coin-earned popup ------------------------------------------------------------------
// Celebratory pop-up shown whenever coins are actually minted (founder 2026-06-21: "when you
// get coin → please have pop up window"). Fired from grantMeowCoins on a real grant only
// (idempotent no-ops stay silent). Queued so back-to-back earns (e.g. +5 reading then +20
// achievement) play one after another instead of stacking.
const COIN_POPUP_QUEUE = [];
let coinPopupShowing = false;

function isThaiLocale() {
  try {
    return (document.documentElement.lang === 'th')
      || (window.location.pathname || '').startsWith('/th/');
  } catch (_) { return false; }
}

function coinReasonLabel(reason) {
  const th = isThaiLocale();
  const r = String(reason || '');
  if (r === 'daily_login') return th ? 'เข้าระบบรายวัน' : 'Daily sign-in';
  if (r === 'daily_reading') return th ? 'เปิดไพ่รายวัน' : 'Daily reading';
  if (r === 'weekly_question') return th ? 'ถามไพ่รายสัปดาห์' : 'Weekly question';
  if (r === 'monthly_celtic') return th ? 'เซลติกครอสรายเดือน' : 'Monthly Celtic Cross';
  if (r === 'weekly_streak') return th ? 'สตรีค 7 วัน' : '7-day streak';
  if (r.startsWith('achievement:')) return th ? 'ปลดล็อกความสำเร็จ!' : 'Achievement unlocked!';
  if (r.startsWith('deck_unlock:')) return th ? 'ปลดล็อกสำรับใหม่!' : 'New deck unlocked!';
  return th ? 'ได้รับเหรียญเหมียว' : 'Meow Coins earned';
}

function playNextCoinPopup() {
  if (coinPopupShowing) return;
  const next = COIN_POPUP_QUEUE.shift();
  if (!next) return;
  if (typeof document === 'undefined' || !document.body) return;
  coinPopupShowing = true;

  const th = isThaiLocale();
  const overlay = document.createElement('div');
  overlay.className = 'mt-coin-pop-overlay';
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'polite');
  overlay.innerHTML =
    '<div class="mt-coin-pop">'
    + '<img class="mt-coin-pop__icon" src="/assets/meow-coin-200.webp" alt="" aria-hidden="true" />'
    + `<div class="mt-coin-pop__amount">+${next.amount}</div>`
    + `<div class="mt-coin-pop__unit">${th ? 'เหรียญเหมียว' : 'Meow Coins'}</div>`
    + `<div class="mt-coin-pop__reason">${coinReasonLabel(next.reason)}</div>`
    + '<div class="mt-coin-pop__cta" hidden></div>'
    + '</div>';
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('is-visible'));

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    overlay.classList.remove('is-visible');
    window.setTimeout(() => {
      overlay.remove();
      coinPopupShowing = false;
      playNextCoinPopup();
    }, 260);
  };
  // Signed-in: tap-anywhere / auto-dismiss. Signed-out: this SAME popup grows a "sign in to keep
  // your coins" CTA (merged — no second sign-in popup) and stays open until they act. (founder
  // 2026-06-23) We DON'T auto-close until auth resolves (so a slow auth check can't dismiss the
  // popup before a signed-out user sees the CTA); a 6s safety cap prevents a stuck popup.
  let safety = window.setTimeout(close, 6000);
  const autoDismissSignedIn = () => { window.clearTimeout(safety); window.setTimeout(close, 2000); };
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('.mt-coin-pop').addEventListener('click', (e) => {
    if (e.target.closest('.mt-coin-pop__cta')) return; // CTA buttons handle themselves
    close();
  });

  import('./auth.js').then(async ({ getCurrentUser, loginWithProvider, isAuthConfigured }) => {
    if (typeof isAuthConfigured === 'function' && !isAuthConfigured()) { autoDismissSignedIn(); return; }
    let user = null;
    try { user = await getCurrentUser(); } catch (_) {}
    if (closed) return;
    if (user) { autoDismissSignedIn(); return; } // signed in → behave like the old toast
    window.clearTimeout(safety); // signed out → keep it open so they can sign in
    const cta = overlay.querySelector('.mt-coin-pop__cta');
    if (!cta) { autoDismissSignedIn(); return; }
    cta.hidden = false;
    cta.innerHTML =
      `<p class="mt-coin-pop__keep">${th ? 'ลงชื่อเข้าใช้เพื่อเก็บเหรียญไว้' : 'Sign in to keep your coins'}</p>`
      + `<button type="button" class="mt-coin-pop__signin">${th ? 'เข้าสู่ระบบด้วย Google' : 'Sign in with Google'}</button>`
      + `<button type="button" class="mt-coin-pop__later">${th ? 'ไว้ทีหลัง' : 'Maybe later'}</button>`;
    cta.querySelector('.mt-coin-pop__signin').addEventListener('click', (e) => {
      e.stopPropagation();
      loginWithProvider('google').catch(() => {});
    });
    cta.querySelector('.mt-coin-pop__later').addEventListener('click', (e) => { e.stopPropagation(); close(); });
  }).catch(() => {});
}

export function showCoinPopup(amount, reason) {
  const amt = Math.max(0, Math.floor(Number(amount) || 0));
  if (!amt) return;
  COIN_POPUP_QUEUE.push({ amount: amt, reason });
  playNextCoinPopup();
}

// Shown when the daily coin was ALREADY claimed today (e.g. signing in after earning it from the
// daily reading) — "you've already received today's quota" instead of a misleading second +N.
export function showQuotaReachedPopup() {
  if (typeof document === 'undefined' || !document.body) return;
  if (document.getElementById('mt-quota-pop')) return;
  const th = isThaiLocale();
  const overlay = document.createElement('div');
  overlay.id = 'mt-quota-pop';
  overlay.className = 'mt-coin-pop-overlay';
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'polite');
  overlay.innerHTML = '<div class="mt-coin-pop">'
    + '<img class="mt-coin-pop__icon" src="/assets/meow-coin-200.webp" alt="" aria-hidden="true" style="opacity:.9;" />'
    + `<div class="mt-coin-pop__unit" style="margin-top:10px;">${th ? 'วันนี้รับเหรียญครบแล้ว' : "You've already received today's quota"}</div>`
    + `<div class="mt-coin-pop__reason">${th ? 'กลับมารับใหม่พรุ่งนี้นะ 🐾' : 'Come back tomorrow for more 🐾'}</div>`
    + '</div>';
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('is-visible'));
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    overlay.classList.remove('is-visible');
    window.setTimeout(() => overlay.remove(), 260);
  };
  overlay.addEventListener('click', close);
  window.setTimeout(close, 2400);
}

// Idempotent credit: when `key` is given the amount is granted at most ONCE for that key
// (e.g. 'login-2026-06-21', 'ach-streak_7', 'deck-unlock-pawbit') — enforces the daily cap and
// stops double-minting. Returns the new balance.
export function grantMeowCoins(amount, reason, key) {
  const amt = Math.max(0, Math.floor(Number(amount) || 0));
  if (!amt) return getMeowCoins();
  const w = readWallet();
  if (key) {
    if (w.keys[key]) return w.balance;
    w.keys[key] = 1;
  }
  w.balance += amt;
  writeWallet(w);
  trackCoin('earn', amt, reason || 'grant');
  try { showCoinPopup(amt, reason); } catch (_) { /* popup is non-critical */ }
  return w.balance;
}

// Spend; returns { ok, balance }. ok=false (and no deduction) when the balance is too low.
export function spendMeowCoins(amount, reason) {
  const amt = Math.max(0, Math.floor(Number(amount) || 0));
  const w = readWallet();
  if (w.balance < amt) return { ok: false, balance: w.balance };
  w.balance -= amt;
  writeWallet(w);
  trackCoin('spend', amt, reason || 'spend');
  return { ok: true, balance: w.balance };
}

export function canAfford(amount) {
  return getMeowCoins() >= Math.max(0, Math.floor(Number(amount) || 0));
}

// --- earn helpers (idempotent per source/period) -----------------------------------------
// Founder 2026-06-23 economy: DAILY sign-in +5 (signed-in only) and DAILY reading +5 are SEPARATE
// (≈10/day). WEEKLY Ask-a-Question +10, MONTHLY Celtic Cross +20, and a REPEATABLE 7-day-streak +5
// once per calendar week. Each is idempotent for its period via a dated key.
export const WEEKLY_QUESTION_COINS = 10;
export const MONTHLY_CELTIC_COINS = 20;
export const WEEKLY_STREAK_COINS = 5;

const hasKey = (key) => { try { return !!(readWallet().keys || {})[key]; } catch (_) { return false; } };
const LOGIN_KEY = () => `login-${todayKey()}`;
const READING_KEY = () => `reading-${todayKey()}`;
const QUESTION_KEY = () => `question-${weekKey()}`;
const CELTIC_KEY = () => `celtic-${monthKey()}`;
const STREAKWEEK_KEY = () => `streakweek-${weekKey()}`;

export const isDailyLoginClaimed = () => hasKey(LOGIN_KEY());
export const isDailyReadingClaimed = () => hasKey(READING_KEY());
export const isWeeklyQuestionClaimed = () => hasKey(QUESTION_KEY());
export const isMonthlyCelticClaimed = () => hasKey(CELTIC_KEY());
export const isWeeklyStreakClaimed = () => hasKey(STREAKWEEK_KEY());

export function grantDailyLogin() {
  return grantMeowCoins(DAILY_LOGIN_COINS, 'daily_login', LOGIN_KEY());
}
export function grantDailyReading() {
  return grantMeowCoins(DAILY_READING_COINS, 'daily_reading', READING_KEY());
}
// +10 once per calendar week — completing an Ask-a-Question reading.
export function grantWeeklyQuestion() {
  return grantMeowCoins(WEEKLY_QUESTION_COINS, 'weekly_question', QUESTION_KEY());
}
// +20 once per calendar month — completing a Celtic Cross (full) reading.
export function grantMonthlyCeltic() {
  return grantMeowCoins(MONTHLY_CELTIC_COINS, 'monthly_celtic', CELTIC_KEY());
}
// +5 once per calendar week — keeping a 7-day streak alive (caller checks streak >= 7).
export function grantWeeklyStreak() {
  return grantMeowCoins(WEEKLY_STREAK_COINS, 'weekly_streak', STREAKWEEK_KEY());
}
// +20 per achievement / deck unlock — once each (keyed by the achievement/deck id).
export function grantAchievementCoins(achievementKey) {
  if (!achievementKey) return getMeowCoins();
  return grantMeowCoins(ACHIEVEMENT_COINS, `achievement:${achievementKey}`, `ach-${achievementKey}`);
}
export function grantDeckUnlockCoins(deckId) {
  if (!deckId) return getMeowCoins();
  return grantMeowCoins(ACHIEVEMENT_COINS, `deck_unlock:${deckId}`, `deck-unlock-${deckId}`);
}

// Subscribe a balance-chip / UI to wallet changes. Calls back immediately with the current
// balance, then on every change. Returns an unsubscribe fn.
export function onMeowCoinsChange(fn) {
  if (typeof fn !== 'function') return () => {};
  listeners.add(fn);
  try { fn(getMeowCoins()); } catch (_) { /* ignore */ }
  return () => listeners.delete(fn);
}

// Top-right Meow Coin balance chip. Rendered on the app-shell pages only; live-updates on any
// earn/spend. Tapping it goes to the Shop. (Founder spec: balance chip top-right on Home / Your
// Deck / Profile.)
const CHIP_PAGES = new Set(['home', 'profile', 'decks', 'deck-detail', 'question', 'daily', 'question-draw', 'full', 'reading', 'shop']);

// Fixed top-right cluster holding the avatar (signed-in) + the coin chip, side by side.
// Positioning is set INLINE (not relying on styles.css) because this module loads UNVERSIONED
// (1h edge cache) while the CSS is versioned — a CSS/JS skew once left the coin chip unpositioned
// and "gone". Inline styles here are self-consistent with the markup this same file creates.
function ensureTopChips() {
  let cluster = document.getElementById('mt-top-chips');
  if (!cluster) {
    cluster = document.createElement('div');
    cluster.id = 'mt-top-chips';
    cluster.style.cssText = 'position:fixed;'
      + 'top:calc(env(safe-area-inset-top, 0px) + 10px);'
      + 'right:calc(env(safe-area-inset-right, 0px) + 12px);'
      + 'z-index:70;display:flex;align-items:center;gap:8px;';
    document.body.appendChild(cluster);
  }
  return cluster;
}

export function renderMeowCoinChip() {
  if (typeof document === 'undefined' || !document.body) return;
  const page = document.body.dataset.page || '';
  if (!CHIP_PAGES.has(page)) return;
  const isThai = (document.documentElement.lang === 'th') || (window.location.pathname || '').startsWith('/th/');
  const cluster = ensureTopChips();
  renderAuthAvatar(cluster, isThai); // sits LEFT of the coin chip; shown only when signed in
  if (document.getElementById('mt-coin-chip')) return;
  const chip = document.createElement('a');
  chip.id = 'mt-coin-chip';
  chip.className = 'mt-coin-chip';
  chip.href = isThai ? '/th/shop.html' : '/shop.html';
  chip.setAttribute('aria-label', isThai ? 'เหรียญเหมียว — ไปที่ร้านค้า' : 'Meow Coins — open shop');
  chip.innerHTML = '<img src="/assets/meow-coin-200.webp" alt="" class="mt-coin-chip__icon" aria-hidden="true" />'
    + '<span class="mt-coin-chip__num">0</span>';
  // Inline-override the CSS fallback (position:fixed) so the chip sits INSIDE the cluster.
  chip.style.position = 'static';
  chip.style.top = 'auto';
  chip.style.right = 'auto';
  cluster.appendChild(chip);
  const numEl = chip.querySelector('.mt-coin-chip__num');
  onMeowCoinsChange((bal) => { numEl.textContent = String(bal); });
}

// Avatar chip — the "you're signed in" indicator (founder 2026-06-23). Shows the Google avatar
// (or a fallback profile glyph) when signed in, hidden when signed out; taps through to Profile.
// Reactive via subscribeAuthState so it appears the moment the session resolves after OAuth.
function renderAuthAvatar(cluster, isThai) {
  if (document.getElementById('mt-avatar-chip')) return;
  const a = document.createElement('a');
  a.id = 'mt-avatar-chip';
  a.className = 'mt-avatar-chip';
  // Inline layout (cache-proof — see ensureTopChips note). Visibility is driven by inline
  // display (NOT the [hidden] attr, which the inline display:flex would override). CSS adds polish.
  a.style.cssText = 'width:34px;height:34px;border-radius:50%;overflow:hidden;display:none;'
    + 'align-items:center;justify-content:center;background:rgba(255,255,255,.85);'
    + 'border:1px solid var(--mt-gold-pale,#e8c478);box-shadow:0 4px 12px -4px rgba(61,26,92,.32);'
    + 'color:var(--mt-plum,#3d1a5c);text-decoration:none;flex:none;';
  a.href = isThai ? '/th/profile.html' : '/profile.html';
  a.setAttribute('aria-label', isThai ? 'โปรไฟล์ของคุณ — เข้าสู่ระบบแล้ว' : 'Your profile — signed in');
  a.innerHTML = '<img class="mt-avatar-chip__img" alt="" />'
    + '<span class="mt-avatar-chip__glyph" aria-hidden="true">'
    + '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8.5" r="3.6"/><path d="M5.5 19a6.5 6.5 0 0 1 13 0"/></svg>'
    + '</span>';
  cluster.insertBefore(a, cluster.firstChild); // left of the coin chip
  const img = a.querySelector('.mt-avatar-chip__img');
  const glyph = a.querySelector('.mt-avatar-chip__glyph');
  const showGlyph = () => { img.style.display = 'none'; glyph.style.display = 'flex'; };
  const showImg = (url) => { img.onerror = showGlyph; img.src = url; img.style.display = 'block'; glyph.style.display = 'none'; };
  import('./auth.js').then(({ subscribeAuthState }) => {
    if (typeof subscribeAuthState !== 'function') return;
    subscribeAuthState((user) => {
      if (!user) { a.style.display = 'none'; return; }
      a.style.display = 'flex';
      const meta = user.user_metadata || {};
      const url = meta.avatar_url || meta.picture || '';
      if (url) showImg(url); else showGlyph();
    });
  }).catch(() => {});
}
