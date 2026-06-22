// Achievement-unlocked popup (Claude Design AchievementsFollowup.dc.html, founder 2026-06-22).
// The big milestone-celebration moment — distinct from the small coin-earn popup. Two variants:
//   'deck'  → a deck reward: deck back art + "New deck!" ribbon + View in Your Decks / Awesome
//   'badge' → a badge: a gold medallion + symbol + Awesome
// Rays + confetti + a "+N Meow Coins" chip. Self-contained styles via styles.css (.mt-au-*).
const CDN = 'https://cdn.meowtarot.com/assets';
const CONFETTI_COLORS = ['#e8457a', '#c9933a', '#a487c4', '#f6abc3', '#6a3f8e', '#e8c478'];

function localizePathSafe(path, lang) {
  return lang === 'th' ? (path.startsWith('/th') ? path : `/th${path}`) : path;
}

// opts: { variant:'deck'|'badge', lang, deckId, name, nameTh, sub, subTh, sym, coins }
export function showAchievementUnlocked(opts = {}) {
  if (typeof document === 'undefined' || !document.body) return;
  if (document.getElementById('mt-au-popup')) return; // one at a time
  const { variant = 'deck', lang = 'en', deckId = '', sym = '✦', coins = 20 } = opts;
  const th = lang === 'th';
  const isDeck = variant === 'deck';
  const name = th ? (opts.nameTh || opts.name || '') : (opts.name || opts.nameTh || '');
  const sub = (th ? (opts.subTh || opts.subEn || opts.sub) : (opts.subEn || opts.sub || opts.subTh)) || '';

  const ov = document.createElement('div');
  ov.id = 'mt-au-popup';
  ov.className = 'mt-au-overlay';
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-modal', 'true');

  const confetti = Array.from({ length: 14 }).map((_, i) => {
    const left = 6 + ((i * 6.4) % 88);
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    const dur = 2.2 + (((i * 7) % 13) / 10);
    const delay = ((i * 5) % 24) / 10;
    const size = 6 + (i % 3) * 2;
    const round = i % 2 ? '50%' : '2px';
    return `<span class="mt-au-confetti__bit" style="left:${left}%;width:${size}px;height:${size + 2}px;background:${color};border-radius:${round};animation-duration:${dur}s;animation-delay:${delay}s;"></span>`;
  }).join('');

  const visual = isDeck
    ? `<div class="mt-au-card"><img class="mt-au-card__img" src="${CDN}/${deckId}/00-back.webp" alt="" onerror="this.style.display='none'" /><span class="mt-au-ribbon">${th ? 'สำรับใหม่!' : 'New deck!'}</span></div>`
    : `<div class="mt-au-medallion"><span>${sym}</span></div>`;

  const buttons = isDeck
    ? `<button type="button" class="mt-au-btn mt-au-btn--primary" id="mt-au-primary">${th ? 'ดูใน “สำรับของคุณ”' : 'View in Your Decks'}</button>
       <button type="button" class="mt-au-btn mt-au-btn--ghost" id="mt-au-close2">${th ? 'เยี่ยมเลย' : 'Awesome'}</button>`
    : `<button type="button" class="mt-au-btn mt-au-btn--gold" id="mt-au-close2">${th ? 'เยี่ยมเลย' : 'Awesome'}</button>`;

  ov.innerHTML = `
    <div class="mt-au-sheet" id="mt-au-sheet">
      <button type="button" class="mt-au-x" id="mt-au-x" aria-label="${th ? 'ปิด' : 'Close'}">×</button>
      <div class="mt-au-rays"></div>
      <div class="mt-au-confetti">${confetti}</div>
      <div class="mt-au-body">
        <div class="mt-au-kicker">${th ? 'ปลดล็อกความสำเร็จ!' : 'Achievement unlocked!'}</div>
        <div class="mt-au-visual">${visual}</div>
        <h2 class="mt-au-name">${name}</h2>
        <p class="mt-au-sub">${sub}</p>
        <div class="mt-au-coinchip"><img src="/assets/meow-coin.svg" alt="" class="mt-au-coinchip__icon" aria-hidden="true" /><span>${th ? `+${coins} เหรียญเหมียว` : `+${coins} Meow Coins`}</span></div>
        <div class="mt-au-actions">${buttons}</div>
      </div>
    </div>`;
  document.body.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('is-in'));

  let closed = false;
  const close = () => {
    if (closed) return; closed = true;
    ov.classList.remove('is-in');
    window.setTimeout(() => ov.remove(), 280);
  };
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
  ov.querySelector('#mt-au-x').addEventListener('click', close);
  const close2 = ov.querySelector('#mt-au-close2'); if (close2) close2.addEventListener('click', close);
  const primary = ov.querySelector('#mt-au-primary');
  if (primary) primary.addEventListener('click', () => { window.location.href = localizePathSafe('/decks.html', lang); });
  return { close };
}
