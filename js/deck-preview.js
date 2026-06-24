// deck-preview.js — shared "tap a deck → preview" popup (founder 2026-06-22).
// Shows a real sample card from the deck (The Fool, upright) so you can see the deck's ART
// style, the deck name, and BELOW it the condition to get the deck (Shop: price + Buy;
// streak/achievement: the unlock day + progress). Used by shop.js + achievements-panel.js.
//
// The condition area is caller-built: pass buildCondition(conditionEl, { close }) and fill it
// with whatever that surface needs (a Buy button, a "Day N" line, etc.).
import { canUnlockDeck } from './data.js';

const CDN = 'https://cdn.meowtarot.com/assets';

function injectStyleOnce() {
  if (document.getElementById('mt-deck-preview-style')) return;
  const st = document.createElement('style');
  st.id = 'mt-deck-preview-style';
  st.textContent = `
    .mt-dp-overlay{position:fixed;inset:0;z-index:1250;display:flex;align-items:center;justify-content:center;padding:22px;background:rgba(28,12,52,0);transition:background .22s ease;-webkit-tap-highlight-color:transparent;}
    .mt-dp-overlay.in{background:rgba(28,12,52,.5);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);}
    .mt-dp-card{width:100%;max-width:320px;background:linear-gradient(180deg,#fffaf2,#fdf3ec);border:1px solid rgba(197,177,220,.55);border-radius:24px;padding:20px 20px 18px;text-align:center;box-shadow:0 30px 60px -20px rgba(20,8,40,.55),inset 0 1px 0 rgba(255,255,255,.8);transform:translateY(12px) scale(.94);opacity:0;transition:transform .3s cubic-bezier(.34,1.56,.64,1),opacity .2s ease;}
    .mt-dp-overlay.in .mt-dp-card{transform:none;opacity:1;}
    .mt-dp-thumb{width:150px;height:auto;border-radius:12px;margin:0 auto 4px;display:block;box-shadow:0 14px 30px -12px rgba(61,26,92,.6);border:1px solid var(--mt-gold-pale,#e8c478);}
    .mt-dp-fool{font-family:var(--mt-font-body,"DM Sans",sans-serif);font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--mt-plum-mid,#6b4a86);opacity:.7;margin:6px 0 2px;}
    .mt-dp-name{font-family:var(--mt-font-display,"Cormorant Garamond",serif);font-style:italic;font-weight:600;font-size:23px;color:var(--mt-plum,#3d1a5c);margin:0 0 2px;line-height:1.15;}
    .mt-dp-name-th{font-family:var(--mt-font-body,"DM Sans",sans-serif);font-size:13px;color:var(--mt-plum-mid,#6b4a86);margin:0 0 12px;}
    .mt-dp-cond{border-top:1px solid rgba(197,177,220,.45);padding-top:13px;margin-top:2px;}
    .mt-dp-cond-text{font-family:var(--mt-font-body,"DM Sans",sans-serif);font-size:13.5px;color:var(--mt-ink-soft,#6b5b82);line-height:1.5;margin:0 0 10px;}
    .mt-dp-btn{width:100%;padding:13px;border:none;border-radius:14px;font-family:var(--mt-font-body,"DM Sans",sans-serif);font-weight:700;font-size:14px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;}
    .mt-dp-btn--buy{background:var(--mt-cta-grad,linear-gradient(135deg,#d4972c,#d12878));color:#fff8e7;}
    .mt-dp-btn--buy.is-disabled{opacity:.55;}
    .mt-dp-btn--buy img{width:16px;height:16px;}
    .mt-dp-btn--close{background:var(--mt-plum,#3d1a5c);color:#fff8e7;}
    .mt-dp-owned{font-family:var(--mt-font-body,"DM Sans",sans-serif);font-weight:700;font-size:14px;color:var(--mt-gold-deep,#c08327);margin:0 0 4px;}
  `;
  document.head.appendChild(st);
}

// deck: accepts a DECKS entry ({id,name,name_th}) OR a shop entry ({id,nameEn,nameTh}).
export function showDeckPreview(deck, { lang = 'en', buildCondition } = {}) {
  if (typeof document === 'undefined' || !deck || document.getElementById('mt-deck-preview')) return;
  injectStyleOnce();
  const th = lang === 'th';
  const id = deck.id;
  const nameEn = deck.name || deck.nameEn || id;
  const nameTh = deck.name_th || deck.nameTh || '';

  const ov = document.createElement('div');
  ov.id = 'mt-deck-preview';
  ov.className = 'mt-dp-overlay';
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-modal', 'true');

  const card = document.createElement('div');
  card.className = 'mt-dp-card';

  // The Fool (upright) = the sample card. Full-res (always present); falls back to the back.
  const img = document.createElement('img');
  img.className = 'mt-dp-thumb';
  img.alt = th ? nameTh || nameEn : nameEn;
  img.src = `${CDN}/${id}/01-the-fool-upright.webp`;
  img.addEventListener('error', function onErr() {
    img.removeEventListener('error', onErr);
    img.src = `${CDN}/${id}/00-back.webp`;
  });
  card.appendChild(img);

  const fool = document.createElement('div');
  fool.className = 'mt-dp-fool';
  fool.textContent = th ? 'ตัวอย่างไพ่ · The Fool' : 'Preview · The Fool';
  card.appendChild(fool);

  const name = document.createElement('div');
  name.className = 'mt-dp-name';
  name.textContent = th ? (nameTh || nameEn) : nameEn;
  card.appendChild(name);

  // Secondary name only in the TH session (shows the English deck name underneath). In EN we
  // show the English name alone — no Thai deck name under it. (founder 2026-06-24)
  if (th && nameEn) {
    const sub = document.createElement('div');
    sub.className = 'mt-dp-name-th';
    sub.textContent = nameEn;
    card.appendChild(sub);
  }

  // "See all cards" → the full Deck Detail page. OWNER-ONLY: the full 78-card browse is a perk of
  // owning the deck, so the link only shows for decks the viewer owns (un-owned gacha previews
  // get the single-card teaser only). (founder 2026-06-23)
  let isOwned = false;
  try { isOwned = canUnlockDeck(id); } catch (_) {}
  if (isOwned) {
    const seeAll = document.createElement('a');
    seeAll.className = 'mt-dp-seeall';
    seeAll.href = `${lang === 'th' ? '/th' : ''}/deck-detail.html?deck=${encodeURIComponent(id)}`;
    seeAll.textContent = th ? 'ดูไพ่ทั้งหมด →' : 'See all cards →';
    seeAll.style.cssText = 'display:inline-block;margin:0 0 12px;font-family:var(--mt-font-body,"DM Sans",sans-serif);font-size:12.5px;font-weight:700;color:#d12878;text-decoration:none;';
    card.appendChild(seeAll);
  }

  const cond = document.createElement('div');
  cond.className = 'mt-dp-cond';
  card.appendChild(cond);

  document.body.appendChild(ov);
  ov.appendChild(card);
  requestAnimationFrame(() => ov.classList.add('in'));

  // The site-wide Report FAB sits at the maximum z-index (always-on-top so a bug can be
  // reported over any overlay). On short/standard mobile viewports its bottom-right hitbox
  // overlaps THIS popup's action button and silently steals the tap — "the button can't be
  // clicked". Hide the FAB while the preview is open; restore it on close. (founder 2026-06-24)
  const reportFab = document.getElementById('mt-report-fab');
  const prevFabDisplay = reportFab ? reportFab.style.display : '';
  if (reportFab) reportFab.style.display = 'none';

  const close = () => {
    if (reportFab) reportFab.style.display = prevFabDisplay;
    ov.classList.remove('in');
    window.setTimeout(() => ov.remove(), 240);
  };
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); });

  // Caller fills the condition area (price + Buy, or Day-N + progress, etc.).
  if (typeof buildCondition === 'function') {
    buildCondition(cond, { close });
  } else {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mt-dp-btn mt-dp-btn--close';
    btn.textContent = th ? 'เข้าใจแล้ว' : 'Got it';
    btn.addEventListener('click', close);
    cond.appendChild(btn);
  }
  return { close };
}
