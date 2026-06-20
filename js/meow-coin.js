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

// --- earn helpers (idempotent per the founder spec) -------------------------------------
export function grantDailyLogin() {
  return grantMeowCoins(DAILY_LOGIN_COINS, 'daily_login', `login-${todayKey()}`);
}
export function grantDailyReading() {
  return grantMeowCoins(DAILY_READING_COINS, 'daily_reading', `reading-${todayKey()}`);
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
const CHIP_PAGES = new Set(['home', 'profile', 'decks', 'daily', 'question-draw', 'full', 'reading', 'shop']);
export function renderMeowCoinChip() {
  if (typeof document === 'undefined' || !document.body) return;
  const page = document.body.dataset.page || '';
  if (!CHIP_PAGES.has(page)) return;
  if (document.getElementById('mt-coin-chip')) return;
  const isThai = (document.documentElement.lang === 'th') || (window.location.pathname || '').startsWith('/th/');
  const chip = document.createElement('a');
  chip.id = 'mt-coin-chip';
  chip.className = 'mt-coin-chip';
  chip.href = isThai ? '/th/shop.html' : '/shop.html';
  chip.setAttribute('aria-label', isThai ? 'เหรียญเหมียว — ไปที่ร้านค้า' : 'Meow Coins — open shop');
  chip.innerHTML = '<img src="/assets/meow-coin.svg" alt="" class="mt-coin-chip__icon" aria-hidden="true" />'
    + '<span class="mt-coin-chip__num">0</span>';
  document.body.appendChild(chip);
  const numEl = chip.querySelector('.mt-coin-chip__num');
  onMeowCoinsChange((bal) => { numEl.textContent = String(bal); });
}
