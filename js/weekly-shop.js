// weekly-shop.js — the universal, date-seeded "Weekly Shop" (founder 2026-06-24).
//
// Each ISO week the Shop features 4 buyable decks, the SAME 4 for every user worldwide, with
// NO server and NO scheduled job: the selection is a pure function of the week number + the deck
// pool, so every client computes the identical set and it rotates on its own every Monday.
//
// Rules baked in:
//   1. No deck repeats two weeks in a row. (Walking a fixed shuffle 4-at-a-time guarantees this:
//      week W shows positions [4W .. 4W+3] mod N and week W+1 shows [4W+4 .. 4W+7] mod N — together
//      8 consecutive positions, all distinct mod N whenever N >= 8, so the two sets never overlap.)
//   2. Universal — depends only on the week index + pool, never on the user.
//   3. Pool excludes Seasonal (e.g. Boo Familiar) and Achievement decks; it's the buyable art decks.
//
// To hand-curate a specific week, drop a data/weekly-shop.json override (not required); this module
// is the zero-infra default the rest of the app reads.

import { getAllDecks } from './data.js';

const FEATURED_COUNT = 4;
const FIXED_SEED = 0x9e3779b1; // stable global permutation seed — do NOT change (would reshuffle history)
// Week 0 anchor: Monday 2026-01-05 00:00 UTC. UTC-based so the week boundary is identical worldwide.
const ANCHOR_UTC = Date.UTC(2026, 0, 5);
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Buyable pool = role 'shop' art decks, minus seasonal/hidden. Achievement decks (role
// 'streak-unlock') and the free defaults are never here. This is the gacha pull pool too.
export function weeklyEligibleDecks() {
  return getAllDecks().filter((d) => d && d.role === 'shop' && !d.seasonal && !d.hidden);
}

// Monday-anchored UTC week index. Same value for everyone within a calendar week.
export function getWeekIndex(now = new Date()) {
  return Math.floor((now.getTime() - ANCHOR_UTC) / WEEK_MS);
}

// Deterministic PRNG (mulberry32) — same seed → same sequence on every device.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle(arr, seed) {
  const a = arr.slice();
  const rnd = mulberry32(seed);
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

// The 4 featured decks for a given week. Returns deck objects in display order.
export function getWeeklyFeatured(weekIndex = getWeekIndex()) {
  // Stable base order (by id) so the shuffle is reproducible regardless of DECKS insertion order.
  const pool = weeklyEligibleDecks().slice().sort((a, b) => a.id.localeCompare(b.id));
  const n = pool.length;
  if (n <= FEATURED_COUNT) return pool.slice();
  const ordered = seededShuffle(pool, FIXED_SEED);
  const start = (((weekIndex % n) + n) % n) * FEATURED_COUNT % n; // (4 * W) mod n, safe for W<0
  const out = [];
  for (let i = 0; i < FEATURED_COUNT; i += 1) {
    out.push(ordered[(start + i) % n]);
  }
  return out;
}

// ---- weekly "new decks!" login popup --------------------------------------------------------
// Shown once per week to signed-in users, queued AFTER the daily coin popup. Pure notice — its
// single button just dismisses (it co-fires with the coin reward, so it doesn't navigate).
const NEWS_SEEN_KEY = 'meowtarot_weekly_news_week';
const NEWS_STYLE_FLAG = 'mt-weekly-news-style';
const NEWS_ID = 'mt-weekly-news-popup';

function newsSeenThisWeek(weekIndex) {
  try { return Number(localStorage.getItem(NEWS_SEEN_KEY)) === weekIndex; } catch (_) { return false; }
}
function markNewsSeen(weekIndex) {
  try { localStorage.setItem(NEWS_SEEN_KEY, String(weekIndex)); } catch (_) { /* ignore */ }
}

function injectNewsStyle() {
  if (typeof document === 'undefined' || document.getElementById(NEWS_STYLE_FLAG)) return;
  const st = document.createElement('style');
  st.id = NEWS_STYLE_FLAG;
  st.textContent = `
    .mt-wn-overlay{position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;padding:22px;background:rgba(20,14,40,0);transition:background .28s ease;-webkit-tap-highlight-color:transparent;}
    .mt-wn-overlay.in{background:rgba(20,14,40,.66);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);}
    .mt-wn-card{width:100%;max-width:340px;background:linear-gradient(180deg,#fffaf2,#fdf3ec);border:1px solid rgba(197,177,220,.5);border-radius:24px;padding:24px 22px 20px;text-align:center;box-shadow:0 30px 60px -20px rgba(20,8,40,.55);transform:translateY(14px) scale(.94);opacity:0;transition:transform .34s cubic-bezier(.34,1.56,.64,1),opacity .22s ease;}
    .mt-wn-overlay.in .mt-wn-card{transform:none;opacity:1;}
    .mt-wn-thumbs{display:flex;justify-content:center;gap:7px;margin:0 0 14px;}
    .mt-wn-thumbs img{width:52px;aspect-ratio:848/1264;object-fit:cover;border-radius:8px;box-shadow:0 8px 18px -8px rgba(61,26,92,.5);border:1px solid var(--mt-gold-pale,#e8c478);}
    .mt-wn-eyebrow{font-family:var(--mt-font-body,"DM Sans",sans-serif);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--mt-gold-deep,#c08327);font-weight:700;margin:0 0 4px;}
    .mt-wn-title{font-family:var(--mt-font-display,"Cormorant Garamond",serif);font-style:italic;font-weight:600;font-size:23px;color:var(--mt-plum,#3d1a5c);margin:0 0 8px;line-height:1.2;}
    .mt-wn-body{font-family:var(--mt-font-body,"DM Sans",sans-serif);font-size:13.5px;color:var(--mt-ink-soft,#6b5b82);line-height:1.5;margin:0 0 18px;}
    .mt-wn-btn{width:100%;padding:13px;border:none;border-radius:14px;background:var(--mt-plum,#3d1a5c);color:#fff8e7;font-family:var(--mt-font-body,"DM Sans",sans-serif);font-weight:700;font-size:14px;cursor:pointer;}
  `;
  document.head.appendChild(st);
}

// Self-guards: signed-in only, once per week, never stacked on the welcome / deck-reward popups.
export function maybeShowWeeklyShopNews(user, lang = 'en') {
  if (typeof document === 'undefined' || !document.body || !user) return;
  const weekIndex = getWeekIndex();
  if (newsSeenThisWeek(weekIndex)) return;

  const th = lang === 'th';
  const featured = getWeeklyFeatured(weekIndex);
  if (!featured.length) return;

  // Queue behind the daily coin popup + the first-login / deck-reward popups so it never stacks.
  const STACKED = ['.mt-coin-pop-overlay', '#mt-login-reward-popup', '#mt-deck-reward-popup', `#${NEWS_ID}`];
  let tries = 0;
  const tryShow = () => {
    if (newsSeenThisWeek(weekIndex)) return;
    const blocked = STACKED.some((sel) => document.querySelector(sel));
    if (blocked && tries < 24) { tries += 1; window.setTimeout(tryShow, 700); return; }
    if (document.getElementById(NEWS_ID)) return;
    markNewsSeen(weekIndex); // mark on show so a reload the same week won't re-pop

    injectNewsStyle();
    const ov = document.createElement('div');
    ov.id = NEWS_ID;
    ov.className = 'mt-wn-overlay';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    const thumbs = featured.slice(0, 4)
      .map((d) => `<img src="${d.backImage || ''}" alt="" aria-hidden="true" />`).join('');
    ov.innerHTML = `
      <div class="mt-wn-card" role="document">
        <div class="mt-wn-thumbs">${thumbs}</div>
        <p class="mt-wn-eyebrow">${th ? 'ร้านประจำสัปดาห์' : 'Weekly Shop'}</p>
        <h2 class="mt-wn-title">${th ? 'มีสำรับใหม่ในร้านแล้ว! 🎉' : 'New decks are in the shop! 🎉'}</h2>
        <p class="mt-wn-body">${th
          ? 'สำรับใหม่ 4 ใบประจำสัปดาห์นี้ — แวะดูที่ร้านค้าได้เลย'
          : '4 fresh decks are featured this week — swing by the Shop to take a look.'}</p>
        <button type="button" class="mt-wn-btn">${th ? 'รับทราบ' : 'Got it'}</button>
      </div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('in'));
    const close = () => { ov.classList.remove('in'); window.setTimeout(() => ov.remove(), 280); };
    ov.querySelector('.mt-wn-btn').addEventListener('click', close);
    ov.addEventListener('click', (e) => { if (e.target === ov) close(); });

    import('./analytics.js')
      .then(({ trackPopupShown }) => trackPopupShown({ popup: 'weekly_shop_news', surface: document.body?.dataset?.page || 'page', locale: lang }))
      .catch(() => {});
  };
  window.setTimeout(tryShow, 1400);
}
