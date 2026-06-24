// MeowTarot Deck Gacha (founder 2026-06-22) — replaces the fixed-price shop. Implements the
// Claude Design "MeowTarot Gacha.dc.html": pull a mystery deck for 120 Meow Coins, a CS:GO-style
// roulette reel decelerates onto the won deck, then a reveal. Pulls are GUARANTEED-NEW (drawn
// from decks you don't own yet). Gallery: every deck, searchable, star-pinnable, auto-sorted
// pinned → not-owned → owned. (Pull ×10 intentionally removed per founder.)
import { applyLocaleMeta, applyTranslations, initShell, pathHasThaiPrefix } from './common.js';
import { getMeowCoins, spendCoins, onMeowCoinsChange } from './meow-coin.js';
import {
  getAllDecks, getActiveDeckId, setActiveDeck, canUnlockDeck, purchaseDeck,
} from './data.js';
import { showDeckPreview } from './deck-preview.js';
import { getWeeklyFeatured } from './weekly-shop.js';
import { trackLocaleSwitched } from './analytics.js';

const CDN = 'https://cdn.meowtarot.com/assets';
const PULL = 200;          // gacha: random, guaranteed-new
const WEEKLY_PRICE = 250;  // Weekly Shop: buy a SPECIFIC featured deck (+50 for the choice)
const state = { currentLang: pathHasThaiPrefix(window.location.pathname) ? 'th' : 'en', query: '', phase: 'idle' };
const pick = (en, th) => (state.currentLang === 'th' ? th : en);
const fmt = (n) => Number(n).toLocaleString('en-US');
let timers = [];
const clearTimers = () => { timers.forEach((t) => window.clearTimeout(t)); timers = []; };

// Gacha + Weekly Shop pool = buyable art decks ONLY (role 'shop'), minus Seasonal/hidden ones.
// Achievement decks (role 'streak-unlock') are earned on the streak ladder and never sold here;
// the free defaults (moonmallow, veila-tarot) are excluded too. (founder 2026-06-24)
const isGachaDeck = (d) => d && d.role === 'shop' && !d.seasonal && !d.hidden;
const gachaDecks = () => getAllDecks().filter(isGachaDeck);
const isAchievementDeck = (d) => d && !d.hidden && d.role === 'streak-unlock';
// Collection denominator for the progress bar: every collectible deck (buyable + achievement).
const collectibleDecks = () => getAllDecks().filter((d) => isGachaDeck(d) || isAchievementDeck(d));

const backThumb = (id) => `${CDN}/${id}/00-back-200.webp`;
const backFull = (id) => `${CDN}/${id}/00-back.webp`;
const deckName = (d) => pick(d.name, d.name_th || d.name);
const deckSub = (d) => pick(d.name_th || d.name, d.name);

// A deck-back <img> with -200 → full-res fallback.
function backImg(id, className) {
  const img = document.createElement('img');
  img.className = className || '';
  img.loading = 'lazy';
  img.alt = '';
  img.src = backThumb(id);
  img.addEventListener('error', function onErr() { img.removeEventListener('error', onErr); img.src = backFull(id); });
  return img;
}

// ---- header / hero / progress ----------------------------------------------------------
function buildHero() {
  const wrap = document.createElement('section');
  wrap.className = 'gacha-hero';
  wrap.innerHTML = `
    <div class="gacha-head">
      <div class="gacha-head__left">
        <div class="gacha-eyebrow">${pick('Gacha', 'กาชา')}</div>
        <h1 class="gacha-title">${pick('Gacha Shop', 'ร้านกาชา')}</h1>
        <p class="gacha-sub">${pick('Pull a new deck for just 200 Meow Coins — always one you don’t own yet.', 'สุ่มสำรับใหม่ เพียง 200 MeowCoin — ได้สำรับที่คุณยังไม่มีเสมอ')}</p>
      </div>
    </div>
    <!-- In-page coin balance removed (founder 2026-06-23): the universal top-right chip already shows it. -->
    <div class="gacha-capsule-zone">
      <div class="gacha-capsule" id="gacha-capsule" role="button" tabindex="0" aria-label="${pick('Pull a deck', 'สุ่มสำรับ')}">
        <span class="gacha-capsule__q">?</span>
        <span class="gacha-capsule__label">${pick('Mystery', 'ปริศนา')}</span>
      </div>
    </div>
    <button type="button" class="gacha-pull-btn" id="gacha-pull">
      <span>${pick('Pull', 'สุ่ม')} ·</span>
      <img src="/assets/meow-coin-200.webp" alt="" aria-hidden="true" /><span>200</span>
    </button>
    <p class="gacha-helper" id="gacha-helper"></p>`;
  return wrap;
}

function buildProgress() {
  const wrap = document.createElement('div');
  wrap.className = 'gacha-progress';
  wrap.innerHTML = `
    <div class="gacha-progress__row">
      <span class="gacha-progress__label" id="gacha-prog-label"></span>
      <span class="gacha-progress__pct" id="gacha-prog-pct"></span>
    </div>
    <div class="gacha-progress__track"><div class="gacha-progress__fill" id="gacha-prog-fill"></div></div>`;
  return wrap;
}

function refreshHeroStats() {
  const decks = collectibleDecks();
  const total = decks.length;
  const owned = decks.filter((d) => canUnlockDeck(d.id)).length;
  const pct = total ? Math.round((owned / total) * 100) : 0;
  const bal = getMeowCoins();
  // Gacha "Collection complete": no buyable deck left to pull → disable the pull, don't tease coins.
  const gachaLeft = gachaDecks().filter((d) => !canUnlockDeck(d.id)).length;
  const complete = gachaLeft === 0;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('gacha-prog-label', pick(`${owned} of ${total} decks collected`, `${owned} จาก ${total} สำรับ`));
  set('gacha-prog-pct', `${pct}%`);
  const fill = document.getElementById('gacha-prog-fill'); if (fill) fill.style.width = `${pct}%`;
  const helper = document.getElementById('gacha-helper');
  if (helper) {
    helper.textContent = complete
      ? pick('You own every gacha deck — collection complete! 🎉', 'คุณมีครบทุกสำรับกาชาแล้ว! 🎉')
      : (bal >= PULL
        ? pick(`You have ${fmt(bal)} coins`, `คุณมี ${fmt(bal)} เหรียญ`)
        : pick(`Need ${PULL - bal} more coins for a pull`, `ต้องการอีก ${PULL - bal} เหรียญเพื่อสุ่ม`));
  }
  const pullBtn = document.getElementById('gacha-pull');
  if (pullBtn) {
    pullBtn.classList.toggle('is-dim', complete || bal < PULL);
    pullBtn.disabled = complete;
    if (complete) pullBtn.innerHTML = `<span>${pick('Collection complete', 'สะสมครบแล้ว')} 🎉</span>`;
  }
  const capsule = document.getElementById('gacha-capsule');
  if (capsule) capsule.classList.toggle('is-complete', complete);
}

// ---- weekly shop -----------------------------------------------------------------------
function buildWeeklyHead() {
  const head = document.createElement('div');
  head.className = 'gacha-gallery-head';
  head.innerHTML = `<h2>${pick('Weekly Spotlight', 'สำรับประจำสัปดาห์')}</h2><span></span>`;
  return head;
}

function buildWeeklyCell(deck) {
  const owned = canUnlockDeck(deck.id);
  const active = deck.id === getActiveDeckId();

  const cell = document.createElement('div');
  cell.className = 'gacha-cell';

  const art = document.createElement('div');
  art.className = 'gacha-cell__art' + (active ? ' is-active' : '');
  art.appendChild(backImg(deck.id, 'gacha-cell__img'));
  if (owned) {
    const check = document.createElement('span');
    check.className = 'gacha-cell__check';
    check.textContent = '✓';
    art.appendChild(check);
  }
  cell.appendChild(art);

  const name = document.createElement('div');
  name.className = 'gacha-cell__name';
  name.textContent = deckName(deck);
  cell.appendChild(name);

  const price = document.createElement('div');
  price.className = 'gacha-cell__price';
  if (active) {
    price.innerHTML = `<span class="gacha-cell__owned">${pick('Active', 'ใช้อยู่')}</span>`;
  } else if (owned) {
    price.innerHTML = `<span class="gacha-cell__owned">${pick('Owned', 'มีแล้ว')}</span>`;
  } else {
    price.innerHTML = `<img src="/assets/meow-coin-200.webp" alt="" aria-hidden="true" /><b>${WEEKLY_PRICE}</b>`;
  }
  cell.appendChild(price);

  art.addEventListener('click', () => openPreview(deck));
  name.addEventListener('click', () => openPreview(deck));
  return cell;
}

function renderWeekly() {
  const grid = document.getElementById('gacha-grid');
  if (!grid) return;
  grid.textContent = '';
  const decks = getWeeklyFeatured();
  decks.forEach((d) => grid.appendChild(buildWeeklyCell(d)));
}

// ---- buy a specific featured deck (250) ------------------------------------------------
async function buyDeck(deck) {
  if (canUnlockDeck(deck.id)) { setActiveDeck(deck.id); renderWeekly(); refreshHeroStats(); return; }
  if (getMeowCoins() < WEEKLY_PRICE) { showNotEnough(WEEKLY_PRICE); return; }
  const res = await spendCoins(WEEKLY_PRICE, 'weekly_shop_buy');
  if (!res.ok) { showNotEnough(WEEKLY_PRICE); return; }
  purchaseDeck(deck.id);
  showBuyReveal(deck);
  renderWeekly();
  refreshHeroStats();
}

// ---- preview (reuse shared Fool-card popup) --------------------------------------------
function openPreview(deck) {
  showDeckPreview(deck, {
    lang: state.currentLang,
    buildCondition(cond, { close }) {
      const owned = canUnlockDeck(deck.id);
      const active = deck.id === getActiveDeckId();
      const text = document.createElement('p');
      text.className = 'mt-dp-cond-text';
      if (active) {
        text.textContent = pick('✓ This is your active deck.', '✓ นี่คือสำรับที่ใช้อยู่');
      } else if (owned) {
        text.textContent = pick('✓ You own this deck — set it as your active deck.', '✓ คุณมีสำรับนี้แล้ว — ตั้งเป็นสำรับที่ใช้อยู่ได้เลย');
      } else {
        text.textContent = pick('Featured this week — buy it now to add it to Your Decks.', 'สำรับเด่นประจำสัปดาห์ — ซื้อเลยเพื่อเพิ่มในสำรับของคุณ');
      }
      cond.appendChild(text);
      const btn = document.createElement('button');
      btn.type = 'button';
      if (active) {
        btn.className = 'mt-dp-btn mt-dp-btn--close';
        btn.textContent = pick('Close', 'ปิด');
        btn.addEventListener('click', close);
      } else if (owned) {
        btn.className = 'mt-dp-btn mt-dp-btn--close';
        btn.textContent = pick('Set active', 'ใช้สำรับนี้');
        btn.addEventListener('click', () => { setActiveDeck(deck.id); close(); renderWeekly(); });
      } else {
        btn.className = 'mt-dp-btn mt-dp-btn--buy';
        btn.innerHTML = `<img src="/assets/meow-coin-200.webp" alt="" aria-hidden="true" />${pick('Buy', 'ซื้อ')} · ${WEEKLY_PRICE}`;
        btn.addEventListener('click', () => { close(); window.setTimeout(() => buyDeck(deck), 120); });
      }
      cond.appendChild(btn);
    },
  });
}

// ---- pull → roulette → reveal ----------------------------------------------------------
let toastTimer = null;
function showToast(msg) {
  let toast = document.querySelector('.gacha-toast');
  if (!toast) { toast = document.createElement('div'); toast.className = 'gacha-toast'; document.body.appendChild(toast); }
  toast.textContent = msg;
  toast.classList.add('is-visible');
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2400);
}

function showNotEnough(price = PULL) {
  const bal = getMeowCoins();
  const ov = document.createElement('div');
  ov.className = 'gacha-sheet-overlay';
  ov.innerHTML = `
    <div class="gacha-sheet">
      <div class="gacha-sheet__grip"></div>
      <div class="gacha-sheet__head">
        <div class="gacha-sheet__coin"><img src="/assets/meow-coin-200.webp" alt="" aria-hidden="true" /></div>
        <div>
          <h3 class="gacha-sheet__title">${pick('Not enough Meow Coins yet', 'เหรียญเหมียวยังไม่พอ')}</h3>
          <p class="gacha-sheet__body">${pick(`Keep earning! You have ${fmt(bal)} / ${price}.`, `สะสมต่อได้เลย! คุณมี ${fmt(bal)} / ${price}`)}</p>
        </div>
      </div>
      <div class="gacha-sheet__earn">
        <p class="gacha-sheet__earn-h">${pick('How you earn coins', 'วิธีรับเหรียญ')}</p>
        <div class="gacha-sheet__earn-row"><b>+5</b>${pick('Daily visit', 'เข้าแอปรายวัน')}</div>
        <div class="gacha-sheet__earn-row"><b>+5</b>${pick('Daily reading', 'เปิดไพ่รายวัน')}</div>
        <div class="gacha-sheet__earn-row"><b>+20</b>${pick('Each milestone unlocked', 'ปลดล็อกความสำเร็จ')}</div>
      </div>
      <button type="button" class="gacha-sheet__ok">${pick('Got it', 'เข้าใจแล้ว')}</button>
    </div>`;
  const close = () => ov.remove();
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
  ov.querySelector('.gacha-sheet__ok').addEventListener('click', close);
  document.body.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('in'));
}

async function doPull() {
  if (state.phase !== 'idle') return;
  if (getMeowCoins() < PULL) { showNotEnough(); return; }
  const pool = gachaDecks().filter((d) => !canUnlockDeck(d.id));
  if (!pool.length) { showToast(pick('You’ve collected every deck! 🎉', 'สะสมครบทุกสำรับแล้ว! 🎉')); return; }
  state.phase = 'spin'; // lock immediately so a double-tap can't double-spend while we await
  // Server-authoritative spend when signed in (atomic; can't double-spend across devices).
  const res = await spendCoins(PULL, 'gacha_pull');
  if (!res.ok) { state.phase = 'idle'; showNotEnough(); return; }
  const won = pool[Math.floor(Math.random() * pool.length)];
  runRoulette(won);
  refreshHeroStats();
}

function runRoulette(won) {
  const all = gachaDecks();
  const LEN = 50;
  const WIN = 45;
  const CARDW = 100;
  const GAP = 6;
  const STEP = CARDW + GAP;

  const ov = document.createElement('div');
  ov.className = 'gacha-reveal-overlay';
  ov.innerHTML = `
    <p class="gacha-reel-caption">${pick('Opening your pull…', 'กำลังเปิดสำรับ…')}</p>
    <div class="gacha-reel-viewport">
      <div class="gacha-reel-strip" id="gacha-reel-strip"></div>
      <div class="gacha-reel-marker"></div>
      <div class="gacha-reel-arrow gacha-reel-arrow--top"></div>
      <div class="gacha-reel-arrow gacha-reel-arrow--bottom"></div>
    </div>
    <p class="gacha-skip-hint">${pick('tap to skip', 'แตะเพื่อข้าม')}</p>`;
  document.body.appendChild(ov);

  const strip = ov.querySelector('#gacha-reel-strip');
  const reelDecks = [];
  for (let i = 0; i < LEN; i += 1) {
    reelDecks.push(i === WIN ? won : all[Math.floor(Math.random() * all.length)]);
  }
  reelDecks.forEach((d, i) => {
    const card = document.createElement('div');
    card.className = 'gacha-reel-card' + (i === WIN ? ' is-win' : '');
    card.appendChild(backImg(d.id, 'gacha-reel-card__img'));
    strip.appendChild(card);
  });

  const settle = () => {
    if (state.phase === 'reveal') return;
    clearTimers();
    state.phase = 'reveal';
    purchaseDeck(won.id); // guaranteed-new → actually unlock it
    showReveal(ov, won);
  };
  ov.addEventListener('click', () => { if (state.phase === 'spin' || state.phase === 'landed') settle(); });

  // viewport width measured after layout
  requestAnimationFrame(() => {
    const vw = ov.querySelector('.gacha-reel-viewport').clientWidth || 360;
    const finalX = -((WIN * STEP) + (CARDW / 2) - (vw / 2));
    strip.style.transform = 'translateX(0)';
    strip.style.filter = 'blur(7px)';
    requestAnimationFrame(() => {
      strip.style.transition = 'transform 3.78s cubic-bezier(0.12,0.78,0.16,1), filter 3.78s ease-out';
      strip.style.transform = `translateX(${finalX}px)`;
      strip.style.filter = 'blur(0px)';
    });
    timers.push(window.setTimeout(() => {
      state.phase = 'landed';
      strip.classList.add('is-landed');
      const winCard = strip.querySelector('.gacha-reel-card.is-win');
      if (winCard) winCard.classList.add('is-landed');
    }, 3850));
    timers.push(window.setTimeout(settle, 4550));
  });
}

function showReveal(ov, won) {
  const bal = getMeowCoins();
  const canAgain = bal >= PULL;
  ov.classList.add('is-reveal');
  ov.innerHTML = `
    <div class="gacha-rays"></div>
    <div class="gacha-won-card">
      <div class="gacha-won-ribbon">${pick('NEW!', 'ใหม่!')}</div>
    </div>
    <div class="gacha-confetti" id="gacha-confetti"></div>
    <div class="gacha-reveal-text">
      <p class="gacha-reveal-kicker">${pick('A new deck appears', 'สำรับใหม่ปรากฏ')}</p>
      <h2 class="gacha-reveal-name">${deckName(won)}</h2>
      <p class="gacha-reveal-sub">${deckSub(won)}</p>
      <p class="gacha-reveal-note">${pick('Added to Your Decks', 'เพิ่มในสำรับของคุณแล้ว')}</p>
      <button type="button" class="gacha-reveal-primary" id="gacha-setactive">${pick('Set active', 'ใช้สำรับนี้')}</button>
      <div class="gacha-reveal-row">
        <button type="button" class="gacha-reveal-secondary${canAgain ? '' : ' is-dim'}" id="gacha-again"><img src="/assets/meow-coin-200.webp" alt="" aria-hidden="true" />${pick('Pull again', 'สุ่มอีกครั้ง')} · ${PULL}</button>
        <button type="button" class="gacha-reveal-ghost" id="gacha-done">${pick('Done', 'เสร็จสิ้น')}</button>
      </div>
    </div>`;
  const wonCard = ov.querySelector('.gacha-won-card');
  wonCard.insertBefore(backImg(won.id, 'gacha-won-card__img'), wonCard.firstChild);

  addConfetti(ov.querySelector('#gacha-confetti'));

  const close = () => { clearTimers(); state.phase = 'idle'; ov.remove(); renderWeekly(); refreshHeroStats(); };
  ov.querySelector('#gacha-setactive').addEventListener('click', () => { setActiveDeck(won.id); close(); });
  ov.querySelector('#gacha-done').addEventListener('click', close);
  ov.querySelector('#gacha-again').addEventListener('click', () => {
    if (getMeowCoins() < PULL) { close(); window.setTimeout(() => showNotEnough(PULL), 200); return; }
    close();
    window.setTimeout(doPull, 80);
  });
}

function addConfetti(conf) {
  if (!conf) return;
  const colors = ['#e8457a', '#e8c478', '#d12878', '#c08327', '#fff8ec'];
  for (let i = 0; i < 26; i += 1) {
    const c = document.createElement('span');
    c.className = 'gacha-confetti__bit';
    c.style.left = `${Math.round((i / 26) * 100)}%`;
    c.style.background = colors[i % colors.length];
    c.style.animationDelay = `${(i % 8) * 90}ms`;
    conf.appendChild(c);
  }
}

// Direct Weekly-Shop buy: known deck, so no roulette — straight to the celebratory reveal.
function showBuyReveal(deck) {
  const ov = document.createElement('div');
  ov.className = 'gacha-reveal-overlay is-reveal';
  requestAnimationFrame(() => ov.classList.add('in'));
  ov.innerHTML = `
    <div class="gacha-rays"></div>
    <div class="gacha-won-card">
      <div class="gacha-won-ribbon">${pick('NEW!', 'ใหม่!')}</div>
    </div>
    <div class="gacha-confetti" id="gacha-confetti"></div>
    <div class="gacha-reveal-text">
      <p class="gacha-reveal-kicker">${pick('Deck unlocked', 'ปลดล็อกสำรับแล้ว')}</p>
      <h2 class="gacha-reveal-name">${deckName(deck)}</h2>
      <p class="gacha-reveal-sub">${deckSub(deck)}</p>
      <p class="gacha-reveal-note">${pick('Added to Your Decks', 'เพิ่มในสำรับของคุณแล้ว')}</p>
      <button type="button" class="gacha-reveal-primary" id="gacha-buy-setactive">${pick('Set active', 'ใช้สำรับนี้')}</button>
      <div class="gacha-reveal-row">
        <button type="button" class="gacha-reveal-ghost" id="gacha-buy-done">${pick('Done', 'เสร็จสิ้น')}</button>
      </div>
    </div>`;
  const wonCard = ov.querySelector('.gacha-won-card');
  wonCard.insertBefore(backImg(deck.id, 'gacha-won-card__img'), wonCard.firstChild);
  document.body.appendChild(ov);
  addConfetti(ov.querySelector('#gacha-confetti'));
  const close = () => { ov.remove(); renderWeekly(); refreshHeroStats(); };
  ov.querySelector('#gacha-buy-setactive').addEventListener('click', () => { setActiveDeck(deck.id); close(); });
  ov.querySelector('#gacha-buy-done').addEventListener('click', close);
}

// ---- shell -----------------------------------------------------------------------------
function renderAll() {
  const content = document.getElementById('shop-content');
  if (!content) return;
  content.textContent = '';
  content.appendChild(buildHero());
  content.appendChild(buildProgress());

  content.appendChild(buildWeeklyHead());

  const sub = document.createElement('p');
  sub.className = 'gacha-weekly-sub';
  sub.textContent = pick('Refresh every Monday', 'อัปเดตใหม่ทุกวันจันทร์');
  content.appendChild(sub);

  const grid = document.createElement('div');
  grid.className = 'gacha-grid';
  grid.id = 'gacha-grid';
  content.appendChild(grid);

  renderWeekly();
  refreshHeroStats();

  const capsule = document.getElementById('gacha-capsule');
  const pullBtn = document.getElementById('gacha-pull');
  if (pullBtn) pullBtn.addEventListener('click', doPull);
  if (capsule) {
    capsule.addEventListener('click', doPull);
    capsule.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') doPull(); });
  }
  onMeowCoinsChange(() => { refreshHeroStats(); });
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
