// MeowTarot Deck Gacha (founder 2026-06-22) — replaces the fixed-price shop. Implements the
// Claude Design "MeowTarot Gacha.dc.html": pull a mystery deck for 120 Meow Coins, a CS:GO-style
// roulette reel decelerates onto the won deck, then a reveal. Pulls are GUARANTEED-NEW (drawn
// from decks you don't own yet). Gallery: every deck, searchable, star-pinnable, auto-sorted
// pinned → not-owned → owned. (Pull ×10 intentionally removed per founder.)
import { applyLocaleMeta, applyTranslations, initShell, pathHasThaiPrefix } from './common.js';
import { getMeowCoins, spendMeowCoins, onMeowCoinsChange } from './meow-coin.js';
import {
  getAllDecks, getActiveDeckId, setActiveDeck, canUnlockDeck, purchaseDeck,
  isPinnedDeck, togglePinnedDeck,
} from './data.js';
import { showDeckPreview } from './deck-preview.js';
import { trackLocaleSwitched } from './analytics.js';

const CDN = 'https://cdn.meowtarot.com/assets';
const PULL = 120;
const state = { currentLang: pathHasThaiPrefix(window.location.pathname) ? 'th' : 'en', query: '', phase: 'idle' };
const pick = (en, th) => (state.currentLang === 'th' ? th : en);
const fmt = (n) => Number(n).toLocaleString('en-US');
let timers = [];
const clearTimers = () => { timers.forEach((t) => window.clearTimeout(t)); timers = []; };

// Gacha pool = collectible decks ONLY. Achievement decks (role 'streak-unlock') are EXCLUSIVE
// to the streak/achievement ladder and never appear in the gacha; the free default (moonmallow)
// is excluded too. Everything else (veila + the AI 'shop' decks) is gacha. (founder 2026-06-22)
const isGachaDeck = (d) => d && d.role !== 'streak-unlock' && d.id !== 'moonmallow';
const gachaDecks = () => getAllDecks().filter(isGachaDeck);

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
        <h1 class="gacha-title">${pick('Deck Gacha', 'กาชาสำรับ')}</h1>
        <p class="gacha-sub">${pick('Pull a mystery deck — 120 Meow Coins each. Every pull is a deck you don’t own yet.', 'สุ่มสำรับปริศนา — ครั้งละ 120 เหรียญเหมียว ทุกครั้งได้สำรับที่คุณยังไม่มี')}</p>
      </div>
      <div class="gacha-balance">
        <img src="/assets/meow-coin.svg" alt="" class="gacha-balance__icon" aria-hidden="true" />
        <span class="gacha-balance__num">0</span>
      </div>
    </div>
    <div class="gacha-capsule-zone">
      <div class="gacha-capsule" id="gacha-capsule" role="button" tabindex="0" aria-label="${pick('Pull a deck', 'สุ่มสำรับ')}">
        <span class="gacha-capsule__q">?</span>
        <span class="gacha-capsule__label">${pick('Mystery', 'ปริศนา')}</span>
      </div>
    </div>
    <button type="button" class="gacha-pull-btn" id="gacha-pull">
      <span>${pick('Pull', 'สุ่ม')} ·</span>
      <img src="/assets/meow-coin.svg" alt="" aria-hidden="true" /><span>120</span>
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
  const decks = gachaDecks();
  const total = decks.length;
  const owned = decks.filter((d) => canUnlockDeck(d.id)).length;
  const pct = total ? Math.round((owned / total) * 100) : 0;
  const bal = getMeowCoins();
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('gacha-prog-label', pick(`${owned} of ${total} decks collected`, `${owned} จาก ${total} สำรับ`));
  set('gacha-prog-pct', `${pct}%`);
  const fill = document.getElementById('gacha-prog-fill'); if (fill) fill.style.width = `${pct}%`;
  const helper = document.getElementById('gacha-helper');
  if (helper) {
    helper.textContent = bal >= PULL
      ? pick(`You have ${fmt(bal)} coins`, `คุณมี ${fmt(bal)} เหรียญ`)
      : pick(`Need ${PULL - bal} more coins for a pull`, `ต้องการอีก ${PULL - bal} เหรียญเพื่อสุ่ม`);
  }
  const pullBtn = document.getElementById('gacha-pull');
  if (pullBtn) pullBtn.classList.toggle('is-dim', bal < PULL);
}

// ---- gallery ---------------------------------------------------------------------------
function buildSearch() {
  const wrap = document.createElement('div');
  wrap.className = 'gacha-search';
  wrap.innerHTML = `
    <svg class="gacha-search__ico" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="#c08327" stroke-width="2.1"/><path d="M20 20l-4.6-4.6" stroke="#c08327" stroke-width="2.1" stroke-linecap="round"/></svg>
    <input class="gacha-search__input" type="text" placeholder="${pick('Search decks…', 'ค้นหาสำรับ…')}" aria-label="${pick('Search decks', 'ค้นหาสำรับ')}" />
    <button type="button" class="gacha-search__clear" aria-label="${pick('Clear', 'ล้าง')}" hidden>×</button>`;
  const input = wrap.querySelector('.gacha-search__input');
  const clear = wrap.querySelector('.gacha-search__clear');
  input.value = state.query;
  input.addEventListener('input', () => {
    state.query = input.value;
    clear.hidden = !state.query.length;
    renderGallery();
  });
  clear.addEventListener('click', () => { state.query = ''; input.value = ''; clear.hidden = true; renderGallery(); input.focus(); });
  return wrap;
}

// Sort: pinned → not-owned → owned (founder 2026-06-22). Stable within each bucket.
function sortedFilteredDecks() {
  const q = state.query.trim().toLowerCase();
  let decks = gachaDecks().map((d, i) => ({ d, i }));
  if (q) decks = decks.filter(({ d }) => (d.name || '').toLowerCase().includes(q) || (d.name_th || '').includes(state.query.trim()));
  const rank = ({ d }) => {
    if (isPinnedDeck(d.id)) return 0;          // pinned first
    return canUnlockDeck(d.id) ? 2 : 1;        // then not-owned, then owned
  };
  decks.sort((a, b) => (rank(a) - rank(b)) || (a.i - b.i));
  return decks.map((x) => x.d);
}

function buildDeckCell(deck) {
  const owned = canUnlockDeck(deck.id);
  const active = deck.id === getActiveDeckId();
  const pinned = isPinnedDeck(deck.id);

  const cell = document.createElement('div');
  cell.className = 'gacha-cell';

  const art = document.createElement('div');
  art.className = 'gacha-cell__art' + (owned ? '' : ' is-locked') + (active ? ' is-active' : '');
  art.appendChild(backImg(deck.id, 'gacha-cell__img'));
  if (!owned) {
    const scrim = document.createElement('div');
    scrim.className = 'gacha-cell__scrim';
    scrim.innerHTML = '<span class="gacha-cell__q">?</span>';
    art.appendChild(scrim);
  } else {
    const check = document.createElement('span');
    check.className = 'gacha-cell__check';
    check.textContent = '✓';
    art.appendChild(check);
  }
  // star / pin
  const star = document.createElement('span');
  star.className = 'gacha-cell__star' + (pinned ? ' is-pinned' : '');
  star.setAttribute('role', 'button');
  star.setAttribute('tabindex', '0');
  star.setAttribute('aria-pressed', pinned ? 'true' : 'false');
  star.setAttribute('aria-label', pinned ? pick('Unpin', 'เลิกปักหมุด') : pick('Pin to top', 'ปักหมุดไว้บนสุด'));
  star.textContent = pinned ? '★' : '☆';
  const toggleStar = (e) => { if (e) { e.stopPropagation(); e.preventDefault(); } togglePinnedDeck(deck.id); renderGallery(); };
  star.addEventListener('click', toggleStar);
  star.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') toggleStar(e); });
  art.appendChild(star);
  cell.appendChild(art);

  const name = document.createElement('div');
  name.className = 'gacha-cell__name' + (owned ? '' : ' is-locked');
  name.textContent = owned ? deckName(deck) : '? ? ?';
  cell.appendChild(name);

  if (active) {
    const tag = document.createElement('div');
    tag.className = 'gacha-cell__activetag';
    tag.textContent = pick('Active', 'ใช้อยู่');
    cell.appendChild(tag);
  }

  art.addEventListener('click', () => openPreview(deck));
  name.addEventListener('click', () => openPreview(deck));
  return cell;
}

function renderGallery() {
  const grid = document.getElementById('gacha-grid');
  if (!grid) return;
  grid.textContent = '';
  const decks = sortedFilteredDecks();
  if (!decks.length) {
    const empty = document.createElement('div');
    empty.className = 'gacha-empty';
    empty.innerHTML = `<p class="gacha-empty__title">${pick('No decks match', 'ไม่พบสำรับที่ค้นหา')}</p><p class="gacha-empty__sub">${pick('Try a different name', 'ลองค้นหาชื่ออื่น')}</p>`;
    grid.appendChild(empty);
    return;
  }
  decks.forEach((d) => grid.appendChild(buildDeckCell(d)));
}

// ---- preview (reuse shared Fool-card popup) --------------------------------------------
function openPreview(deck) {
  showDeckPreview(deck, {
    lang: state.currentLang,
    buildCondition(cond, { close }) {
      const owned = canUnlockDeck(deck.id);
      const text = document.createElement('p');
      text.className = 'mt-dp-cond-text';
      text.textContent = owned
        ? pick('✓ You own this deck — set it as your active deck.', '✓ คุณมีสำรับนี้แล้ว — ตั้งเป็นสำรับที่ใช้อยู่ได้เลย')
        : pick('Pull the gacha for a chance to get this deck.', 'สุ่มกาชาเพื่อลุ้นรับสำรับนี้');
      cond.appendChild(text);
      const btn = document.createElement('button');
      btn.type = 'button';
      if (owned) {
        btn.className = 'mt-dp-btn mt-dp-btn--close';
        btn.textContent = pick('Set active', 'ใช้สำรับนี้');
        btn.addEventListener('click', () => { setActiveDeck(deck.id); close(); renderGallery(); });
      } else {
        btn.className = 'mt-dp-btn mt-dp-btn--buy';
        btn.innerHTML = `<img src="/assets/meow-coin.svg" alt="" aria-hidden="true" />${pick('Pull', 'สุ่ม')} · ${PULL}`;
        btn.addEventListener('click', () => { close(); window.setTimeout(doPull, 120); });
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

function showNotEnough() {
  const bal = getMeowCoins();
  const ov = document.createElement('div');
  ov.className = 'gacha-sheet-overlay';
  ov.innerHTML = `
    <div class="gacha-sheet">
      <div class="gacha-sheet__grip"></div>
      <div class="gacha-sheet__head">
        <div class="gacha-sheet__coin"><img src="/assets/meow-coin.svg" alt="" aria-hidden="true" /></div>
        <div>
          <h3 class="gacha-sheet__title">${pick('Not enough Meow Coins yet', 'เหรียญเหมียวยังไม่พอ')}</h3>
          <p class="gacha-sheet__body">${pick(`Keep earning! You have ${fmt(bal)} / ${PULL}.`, `สะสมต่อได้เลย! คุณมี ${fmt(bal)} / ${PULL}`)}</p>
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

function doPull() {
  if (state.phase !== 'idle') return;
  if (getMeowCoins() < PULL) { showNotEnough(); return; }
  const pool = gachaDecks().filter((d) => !canUnlockDeck(d.id));
  if (!pool.length) { showToast(pick('You’ve collected every deck! 🎉', 'สะสมครบทุกสำรับแล้ว! 🎉')); return; }
  const res = spendMeowCoins(PULL, 'gacha_pull');
  if (!res.ok) { showNotEnough(); return; }
  const won = pool[Math.floor(Math.random() * pool.length)];
  state.phase = 'spin';
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
        <button type="button" class="gacha-reveal-secondary${canAgain ? '' : ' is-dim'}" id="gacha-again"><img src="/assets/meow-coin.svg" alt="" aria-hidden="true" />${pick('Pull again', 'สุ่มอีกครั้ง')} · ${PULL}</button>
        <button type="button" class="gacha-reveal-ghost" id="gacha-done">${pick('Done', 'เสร็จสิ้น')}</button>
      </div>
    </div>`;
  const wonCard = ov.querySelector('.gacha-won-card');
  wonCard.insertBefore(backImg(won.id, 'gacha-won-card__img'), wonCard.firstChild);

  // confetti
  const conf = ov.querySelector('#gacha-confetti');
  const colors = ['#e8457a', '#e8c478', '#d12878', '#c08327', '#fff8ec'];
  for (let i = 0; i < 26; i += 1) {
    const c = document.createElement('span');
    c.className = 'gacha-confetti__bit';
    c.style.left = `${Math.round((i / 26) * 100)}%`;
    c.style.background = colors[i % colors.length];
    c.style.animationDelay = `${(i % 8) * 90}ms`;
    conf.appendChild(c);
  }

  const close = () => { clearTimers(); state.phase = 'idle'; ov.remove(); renderGallery(); refreshHeroStats(); };
  ov.querySelector('#gacha-setactive').addEventListener('click', () => { setActiveDeck(won.id); close(); });
  ov.querySelector('#gacha-done').addEventListener('click', close);
  ov.querySelector('#gacha-again').addEventListener('click', () => {
    if (getMeowCoins() < PULL) { close(); window.setTimeout(showNotEnough, 200); return; }
    close();
    window.setTimeout(doPull, 80);
  });
}

// ---- shell -----------------------------------------------------------------------------
function renderAll() {
  const content = document.getElementById('shop-content');
  if (!content) return;
  content.textContent = '';
  content.appendChild(buildHero());
  content.appendChild(buildProgress());

  const gHead = document.createElement('div');
  gHead.className = 'gacha-gallery-head';
  gHead.innerHTML = `<h2>${pick('All Decks', 'สำรับทั้งหมด')}</h2><span></span>`;
  content.appendChild(gHead);

  content.appendChild(buildSearch());

  const grid = document.createElement('div');
  grid.className = 'gacha-grid';
  grid.id = 'gacha-grid';
  content.appendChild(grid);

  renderGallery();
  refreshHeroStats();

  const capsule = document.getElementById('gacha-capsule');
  const pullBtn = document.getElementById('gacha-pull');
  if (pullBtn) pullBtn.addEventListener('click', doPull);
  if (capsule) {
    capsule.addEventListener('click', doPull);
    capsule.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') doPull(); });
  }
  onMeowCoinsChange(() => {
    const num = document.querySelector('.gacha-balance__num');
    if (num) num.textContent = fmt(getMeowCoins());
    refreshHeroStats();
  });
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
