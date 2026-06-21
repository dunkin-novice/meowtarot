// Meow Coin Shop — spend coins to unlock AI decks (founder 2026-06-21). Each deck = 100 coins.
// SHOP_DECKS is the list of decks that exist on Cloudflare but aren't part of the free rotation;
// it's populated once their art + -200 thumbs are confirmed. Until then the shop shows the
// balance + an honest "coming soon" state (the page is live + the chip link works).
import { applyLocaleMeta, applyTranslations, initShell, pathHasThaiPrefix } from './common.js';
import { getMeowCoins, spendMeowCoins, onMeowCoinsChange, DECK_PRICE_COINS } from './meow-coin.js';
import { DECKS, canUnlockDeck, purchaseDeck } from './data.js';
import { trackLocaleSwitched } from './analytics.js';

const state = { currentLang: pathHasThaiPrefix(window.location.pathname) ? 'th' : 'en' };
const pick = (en, th) => (state.currentLang === 'th' ? th : en);
const CDN = 'https://cdn.meowtarot.com/assets';

// Shop = SHOP-EXCLUSIVE decks only — ones you can ONLY get by spending coins, never via the
// free streak/sign-in ladders. Each: { id, nameEn, nameTh }, back art
// `${CDN}/${id}/00-back-200.webp`. Decks here MUST have role 'shop' in data.js DECKS so
// canUnlockDeck gates them on purchase. (founder 2026-06-21: reopened with Siam Paws — a
// 'cold-storage' deck not on any free ladder — as the first exclusive deck @100 coins.)
const SHOP_DECKS = [
  { id: 'siam-paws', nameEn: 'Siam Paws', nameTh: 'เหมียวสยาม' },
];

// A deck reads as "owned" if it's unlocked by ANY path — streak, gift, or a Shop purchase
// (canUnlockDeck honours all three, including the meowtarot_purchased_decks store the Shop
// writes). So already-unlocked decks show "Owned", only locked ones are buyable.
function isOwned(id) { return canUnlockDeck(id); }

let toastTimer = null;
function showToast(message) {
  let toast = document.querySelector('.shop-toast');
  if (toastTimer) { window.clearTimeout(toastTimer); toastTimer = null; }
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'shop-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('is-visible');
  toastTimer = window.setTimeout(() => { toast.classList.remove('is-visible'); }, 2600);
}

function buyDeck(deck) {
  if (isOwned(deck.id)) return;
  // Safety net: data.js is an unversioned import (1h edge cache), so a returning browser
  // could load a fresh shop.js (deck listed) before a fresh data.js (deck in DECKS). Don't
  // spend coins if the deck isn't in the registry yet — purchaseDeck would no-op and the
  // coins would be lost. Bail with a gentle nudge instead.
  if (!DECKS[deck.id]) {
    showToast(pick('One moment — refresh and try again.', 'รอสักครู่ — รีเฟรชหน้าแล้วลองใหม่อีกครั้ง'));
    return;
  }
  const res = spendMeowCoins(DECK_PRICE_COINS, `shop_deck:${deck.id}`);
  if (!res.ok) {
    showToast(pick('Not enough Meow Coins yet — keep earning!', 'เหรียญเหมียวยังไม่พอ — สะสมต่อได้เลย!'));
    return;
  }
  purchaseDeck(deck.id); // writes meowtarot_purchased_decks → canUnlockDeck now returns true
  showToast(pick(`Unlocked ${deck.nameEn}! Pick it in Your Deck.`, `ปลดล็อก ${deck.nameTh} แล้ว! เลือกใช้ได้ที่ “สำรับของคุณ”`));
  renderAll();
}

function buildHero() {
  const wrap = document.createElement('section');
  wrap.className = 'decks-hero';

  const eyebrow = document.createElement('div');
  eyebrow.className = 'decks-top-row__eyebrow';
  const eyebrowSpan = document.createElement('span');
  eyebrowSpan.textContent = pick('Shop', 'ร้านค้า');
  eyebrow.appendChild(eyebrowSpan);
  wrap.appendChild(eyebrow);

  const heading = document.createElement('h1');
  heading.className = 'decks-heading__en';
  heading.textContent = pick('Meow Coin Shop', 'ร้านค้าเหรียญเหมียว');
  wrap.appendChild(heading);

  const sub = document.createElement('p');
  sub.className = 'shop-sub';
  sub.textContent = pick(
    'Spend your Meow Coins to unlock new decks — 100 coins each.',
    'ใช้เหรียญเหมียวปลดล็อกสำรับใหม่ — สำรับละ 100 เหรียญ',
  );
  wrap.appendChild(sub);

  // Live balance pill
  const balance = document.createElement('div');
  balance.className = 'shop-balance';
  balance.innerHTML = '<img src="/assets/meow-coin.svg" alt="" class="shop-balance__icon" aria-hidden="true" />'
    + '<span class="shop-balance__num">0</span>'
    + `<span class="shop-balance__label">${pick('Meow Coins', 'เหรียญเหมียว')}</span>`;
  wrap.appendChild(balance);
  onMeowCoinsChange((bal) => {
    const n = balance.querySelector('.shop-balance__num');
    if (n) n.textContent = String(bal);
  });

  return wrap;
}

function buildDeckCell(deck) {
  const owned = isOwned(deck.id);
  const affordable = getMeowCoins() >= DECK_PRICE_COINS;
  const cell = document.createElement('div');
  cell.className = 'shop-deck-cell' + (owned ? ' is-owned' : '');

  const art = document.createElement('img');
  art.className = 'shop-deck-cell__art';
  art.loading = 'lazy';
  art.alt = pick(deck.nameEn, deck.nameTh);
  art.src = `${CDN}/${deck.id}/00-back-200.webp`;
  cell.appendChild(art);

  const name = document.createElement('div');
  name.className = 'shop-deck-cell__name';
  name.textContent = pick(deck.nameEn, deck.nameTh);
  cell.appendChild(name);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'shop-deck-cell__buy';
  if (owned) {
    btn.disabled = true;
    btn.textContent = pick('Owned', 'เป็นเจ้าของแล้ว');
  } else {
    btn.classList.toggle('is-disabled', !affordable);
    btn.innerHTML = `<img src="/assets/meow-coin.svg" alt="" aria-hidden="true" />${DECK_PRICE_COINS}`;
    btn.addEventListener('click', () => buyDeck(deck));
  }
  cell.appendChild(btn);
  return cell;
}

function buildComingSoon() {
  const wrap = document.createElement('div');
  wrap.className = 'shop-empty';
  const h = document.createElement('p');
  h.className = 'shop-empty__title';
  h.textContent = pick('New decks are on the way 🐾', 'สำรับใหม่กำลังจะมา 🐾');
  const p = document.createElement('p');
  p.className = 'shop-empty__body';
  p.textContent = pick(
    'Keep doing your daily readings to stack up Meow Coins — you earn +5 each day you visit, +5 per daily reading, and +20 for every milestone you unlock. They\'ll be ready to spend here soon.',
    'เปิดไพ่รายวันต่อไปเพื่อสะสมเหรียญเหมียว — รับ +5 ทุกวันที่เข้ามา, +5 ต่อการเปิดไพ่รายวัน และ +20 ทุกครั้งที่ปลดล็อกความสำเร็จ ไว้ใช้ช้อปที่นี่เร็ว ๆ นี้',
  );
  wrap.appendChild(h);
  wrap.appendChild(p);
  return wrap;
}

function renderAll() {
  const content = document.getElementById('shop-content');
  if (!content) return;
  content.textContent = '';
  content.appendChild(buildHero());

  if (SHOP_DECKS.length) {
    const grid = document.createElement('div');
    grid.className = 'decks-grid shop-grid';
    SHOP_DECKS.forEach((deck) => grid.appendChild(buildDeckCell(deck)));
    content.appendChild(grid);
  } else {
    content.appendChild(buildComingSoon());
  }
}

function onTranslations() { renderAll(); }

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
  initShell(state, onTranslations, 'shop', { onLangToggle: switchLanguageInPlace });
  renderAll();
}

document.addEventListener('DOMContentLoaded', init);
