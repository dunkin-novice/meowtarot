// Deck Detail — browse ALL 78 cards of a deck (Claude Design "Deck Detail.dc.html", founder
// 2026-06-22). Reached from Your Decks / the deck-preview "See all cards" link via
// /deck-detail.html?deck=<id>. Header (back art + name + Active/Set-active + favourite star),
// the 78 cards grouped Major + Wands/Cups/Swords/Pentacles, and a tap-to-zoom focus view with
// prev/next. Card data comes from the real manifest (data/cards-manifest.json) so EN/TH names
// match the rest of the app. Integrates with the app shell (global header + bottom nav).
import {
  applyLocaleMeta,
  applyTranslations,
  initShell,
  localizePath,
  pathHasThaiPrefix,
} from './common.js';
import {
  getAllDecks,
  getActiveDeckId,
  setActiveDeck,
  isPinnedDeck,
  togglePinnedDeck,
  getActiveDeckFaceAspect,
  getActiveDeckCardAspect,
  canUnlockDeck,
} from './data.js';
import { trackLocaleSwitched, trackDeckSelected } from './analytics.js';

const CDN = 'https://cdn.meowtarot.com/assets';

const state = {
  currentLang: pathHasThaiPrefix(window.location.pathname) ? 'th' : 'en',
  deckId: null,
  cards: [],
  focusIdx: null,
};

const els = { content: document.getElementById('deck-detail-content') };

const T = {
  back: { en: 'Your Decks', th: 'สำรับของคุณ' },
  cards78: { en: '78 cards', th: 'ไพ่ 78 ใบ' },
  active: { en: 'Active', th: 'ใช้งานอยู่' },
  setActive: { en: 'Set as active', th: 'ตั้งเป็นสำรับหลัก' },
  major: { en: 'Major Arcana', th: 'ไพ่เมเจอร์' },
  minor: { en: 'Minor Arcana', th: 'ไพ่ไมเนอร์' },
  wands: { en: 'Wands', th: 'ไม้เท้า' },
  cups: { en: 'Cups', th: 'ถ้วย' },
  swords: { en: 'Swords', th: 'ดาบ' },
  pentacles: { en: 'Pentacles', th: 'เหรียญ' },
  upright: { en: 'Upright', th: 'ตั้งตรง' },
  readMeaning: { en: 'Read meaning', th: 'อ่านความหมาย' },
  loading: { en: 'Loading the deck…', th: 'กำลังโหลดสำรับ…' },
};
const tr = (k) => (T[k] ? T[k][state.currentLang] || T[k].en : k);

// 01-22 major; 23-36 wands; 37-50 cups; 51-64 swords; 65-78 pentacles (matches card-page.js).
function suitOf(num) {
  if (num <= 22) return 'major';
  if (num <= 36) return 'wands';
  if (num <= 50) return 'cups';
  if (num <= 64) return 'swords';
  return 'pentacles';
}

function deckMeta() {
  return getAllDecks().find((d) => d.id === state.deckId) || { id: state.deckId, name: state.deckId, name_th: state.deckId };
}

async function loadCards() {
  try {
    const res = await fetch('/data/cards-manifest.json', { cache: 'force-cache' });
    const all = await res.json();
    state.cards = all
      .filter((c) => c.orientation === 'upright')
      .map((c) => {
        const id = c.card_id; // "01-the-fool-upright"
        const num = parseInt(id, 10) || 0;
        const slug = id.replace(/^\d+-/, '').replace(/-upright$/, '');
        return { id, num, slug, en: c.card_name_en, th: c.alias_th || c.card_name_en, suit: suitOf(num) };
      })
      .sort((a, b) => a.num - b.num);
  } catch (_) {
    state.cards = [];
  }
}

function el(tag, cls, attrs) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (attrs) Object.entries(attrs).forEach(([k, v]) => { if (v != null) n.setAttribute(k, v); });
  return n;
}

// thumb (-200) → full → deck back
function wireImgFallback(img, full, back) {
  img.addEventListener('error', function onErr() {
    if (!img.dataset.f1 && img.src !== full) { img.dataset.f1 = '1'; img.src = full; return; }
    if (!img.dataset.f2) { img.dataset.f2 = '1'; img.src = back; img.removeEventListener('error', onErr); }
  });
}

function cardThumb(card) { return `${CDN}/${state.deckId}/${card.id}-200.webp`; }
function cardFull(card) { return `${CDN}/${state.deckId}/${card.id}.webp`; }
function deckBack() { return `${CDN}/${state.deckId}/00-back.webp`; }

function render() {
  const lang = state.currentLang;
  const deck = deckMeta();
  const isActive = getActiveDeckId() === state.deckId;
  const starred = isPinnedDeck(state.deckId);
  const faceRatio = getActiveDeckFaceAspect(state.deckId);
  const backRatio = getActiveDeckCardAspect(state.deckId);
  els.content.innerHTML = '';
  els.content.style.setProperty('--dd-face-ratio', faceRatio);
  els.content.style.setProperty('--dd-back-ratio', backRatio);

  // Back link
  const back = el('a', 'dd-back', { href: localizePath('/decks.html'), 'aria-label': tr('back') });
  back.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg><span>${tr('back')}</span>`;
  els.content.appendChild(back);

  // Header
  const header = el('section', 'dd-header');
  const backArt = el('div', 'dd-header__art');
  const bimg = el('img', null, { alt: '', src: deckBack(), loading: 'lazy' });
  bimg.addEventListener('error', () => { bimg.style.visibility = 'hidden'; });
  backArt.appendChild(bimg);
  header.appendChild(backArt);

  const meta = el('div', 'dd-header__meta');
  const h1 = el('h1', 'dd-header__name'); h1.textContent = lang === 'th' ? (deck.name_th || deck.name) : (deck.name || deck.name_th);
  const sub = el('div', 'dd-header__sub'); sub.textContent = lang === 'th' ? (deck.name || '') : (deck.name_th || '');
  const count = el('div', 'dd-header__count');
  count.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="4"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span>${tr('cards78')}</span>`;
  meta.appendChild(h1); meta.appendChild(sub); meta.appendChild(count);

  const actionWrap = el('div', 'dd-header__action');
  if (isActive) {
    const pill = el('span', 'dd-active-pill');
    pill.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>${tr('active')}`;
    actionWrap.appendChild(pill);
  } else {
    const btn = el('button', 'dd-set-active', { type: 'button' });
    btn.textContent = tr('setActive');
    btn.addEventListener('click', () => {
      try { setActiveDeck(state.deckId); } catch (_) {}
      try { trackDeckSelected({ deckId: state.deckId, locale: lang, locked: false }); } catch (_) {}
      render();
    });
    actionWrap.appendChild(btn);
  }
  meta.appendChild(actionWrap);
  header.appendChild(meta);

  const star = el('button', 'dd-star', { type: 'button', 'aria-pressed': String(starred), 'aria-label': 'Favourite' });
  if (starred) star.classList.add('is-on');
  star.innerHTML = `<svg width="17" height="17" viewBox="0 0 24 24" fill="${starred ? '#e8c478' : 'none'}" stroke="#c08327" stroke-width="1.6" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
  star.addEventListener('click', () => { try { togglePinnedDeck(state.deckId); } catch (_) {} render(); });
  header.appendChild(star);
  els.content.appendChild(header);

  if (!state.cards.length) {
    const empty = el('p', 'dd-empty'); empty.textContent = tr('loading');
    els.content.appendChild(empty);
    return;
  }

  // Sections
  const groups = ['major', 'wands', 'cups', 'swords', 'pentacles'];
  groups.forEach((g) => {
    const cards = state.cards.filter((c) => c.suit === g);
    if (!cards.length) return;
    const sec = el('section', 'dd-section');
    const head = el('div', 'dd-section__head');
    const titleWrap = el('div');
    if (g !== 'major') {
      const over = el('div', 'dd-section__over'); over.textContent = tr('minor'); titleWrap.appendChild(over);
    }
    const title = el('div', 'dd-section__title'); title.textContent = g === 'major' ? tr('major') : tr(g);
    titleWrap.appendChild(title);
    const cnt = el('span', 'dd-section__count'); cnt.textContent = `(${cards.length})`;
    head.appendChild(titleWrap); head.appendChild(cnt);
    sec.appendChild(head);

    const grid = el('div', 'dd-grid');
    cards.forEach((card) => {
      // Tapping a card opens its MEANING page, carrying ?deck so that page shows THIS deck's art
      // (not the fixed/active-deck image). (founder 2026-06-23)
      const href = `${localizePath('/cards/' + card.slug + '/')}?deck=${encodeURIComponent(state.deckId)}`;
      const cell = el('a', 'dd-cell', { href });
      const frame = el('div', 'dd-cell__frame');
      const img = el('img', null, { alt: card[lang === 'th' ? 'th' : 'en'], loading: 'lazy', src: cardThumb(card) });
      wireImgFallback(img, cardFull(card), deckBack());
      frame.appendChild(img);
      const name = el('div', 'dd-cell__name'); name.textContent = lang === 'th' ? card.th : card.en;
      cell.appendChild(frame); cell.appendChild(name);
      grid.appendChild(cell);
    });
    sec.appendChild(grid);
    els.content.appendChild(sec);
  });

  const foot = el('div', 'dd-foot'); foot.textContent = `· ${lang === 'th' ? (deck.name_th || deck.name) : (deck.name || deck.name_th)} ·`;
  els.content.appendChild(foot);
}

// ---- Focus overlay ----
let overlayEl = null;
function openFocus(idx) { state.focusIdx = idx; renderFocus(); }
function closeFocus() { state.focusIdx = null; if (overlayEl) { overlayEl.remove(); overlayEl = null; } }
function stepFocus(d) { if (state.focusIdx == null) return; state.focusIdx = (state.focusIdx + d + state.cards.length) % state.cards.length; renderFocus(); }

function renderFocus() {
  const lang = state.currentLang;
  const card = state.cards[state.focusIdx];
  if (!card) return;
  if (!overlayEl) {
    overlayEl = el('div', 'dd-focus');
    overlayEl.addEventListener('click', (e) => { if (e.target === overlayEl) closeFocus(); });
    document.body.appendChild(overlayEl);
  }
  const primary = lang === 'th' ? card.th : card.en;
  const secondary = lang === 'th' ? card.en : card.th;
  overlayEl.innerHTML = `
    <button type="button" class="dd-focus__x" aria-label="Close"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg></button>
    <button type="button" class="dd-focus__nav dd-focus__prev" aria-label="Previous"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
    <button type="button" class="dd-focus__nav dd-focus__next" aria-label="Next"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>
    <div class="dd-focus__inner">
      <div class="dd-focus__card"><img alt="${primary}" /></div>
      <div class="dd-focus__name">${primary}</div>
      <div class="dd-focus__sub">${secondary}</div>
      <div class="dd-focus__orient"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="6 11 12 5 18 11"/></svg>${tr('upright')}</div>
      <a class="dd-focus__meaning" href="${localizePath('/cards/' + card.slug + '/')}">${tr('readMeaning')}<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></a>
    </div>
    <div class="dd-focus__counter">${state.focusIdx + 1} / ${state.cards.length}</div>`;
  const fimg = overlayEl.querySelector('.dd-focus__card img');
  fimg.src = cardFull(card);
  wireImgFallback(fimg, cardFull(card), deckBack());
  overlayEl.querySelector('.dd-focus__x').addEventListener('click', closeFocus);
  overlayEl.querySelector('.dd-focus__prev').addEventListener('click', (e) => { e.stopPropagation(); stepFocus(-1); });
  overlayEl.querySelector('.dd-focus__next').addEventListener('click', (e) => { e.stopPropagation(); stepFocus(1); });
  overlayEl.querySelector('.dd-focus__inner').addEventListener('click', (e) => e.stopPropagation());
}

function resolveDeckId() {
  const param = new URLSearchParams(window.location.search).get('deck');
  const valid = getAllDecks().some((d) => d.id === param);
  return valid ? param : getActiveDeckId();
}

function onTranslations() { render(); }

function switchLanguageInPlace(nextLang) {
  if (!nextLang || nextLang === state.currentLang) return;
  const fromLocale = state.currentLang;
  state.currentLang = nextLang;
  try { trackLocaleSwitched({ fromLocale, toLocale: nextLang }); } catch (_) {}
  applyTranslations(nextLang, onTranslations);
  applyLocaleMeta(nextLang);
  closeFocus();
  render();
}

async function init() {
  if (!els.content) return;
  state.deckId = resolveDeckId();
  // OWNER-ONLY (founder 2026-06-23): the full card browse is a perk of owning the deck. If the
  // viewer doesn't own this deck, bounce them to Your Decks (no peeking at decks you don't have).
  if (!canUnlockDeck(state.deckId)) {
    window.location.replace(localizePath('/decks.html'));
    return;
  }
  initShell(state, onTranslations, 'deck-detail', { onLangToggle: switchLanguageInPlace });
  render(); // header + loading state immediately
  await loadCards();
  render();
}

document.addEventListener('keydown', (e) => {
  if (state.focusIdx == null) return;
  if (e.key === 'Escape') closeFocus();
  else if (e.key === 'ArrowLeft') stepFocus(-1);
  else if (e.key === 'ArrowRight') stepFocus(1);
});

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
