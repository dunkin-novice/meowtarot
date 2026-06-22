/**
 * achievements-panel.js — compact "Achievements" REWARD section on the Profile page
 * (Claude Design AchievementsFollowup.dc.html, founder 2026-06-22).
 *
 * This is the REWARD board preview (distinct from "Your Decks" = inventory): a summary bar,
 * the NEXT reward you're working toward, and a recently-unlocked strip. "See all" expands the
 * full milestone ladder inline (done rows are crossed out). Moonmallow is NOT a reward — it's
 * the free default (inventory only), so it never appears here.
 */
import { getAllDecks } from './data.js';
import { showDeckPreview } from './deck-preview.js';

const CDN = 'https://cdn.meowtarot.com/assets';

function fmt(t, vars) {
  return String(t || '').replace(/\{(\w+)\}/g, (_, k) => String((vars || {})[k] ?? ''));
}
function fmtDate(iso, lang) {
  if (!iso) return '';
  try {
    const d = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : 'en-US', { month: 'short', day: 'numeric' }).format(d);
  } catch { return ''; }
}
function deckThumb(id) {
  const img = document.createElement('img');
  img.loading = 'lazy'; img.alt = '';
  img.src = `${CDN}/${id}/00-back-200.webp`;
  img.addEventListener('error', function onErr() { img.removeEventListener('error', onErr); img.src = `${CDN}/${id}/00-back.webp`; });
  return img;
}
function deckDateKey(id) { return `deck_${String(id || '').split('-').join('_')}`; }

// Build the unified achievement list (deck milestones + badges) from progress.
function buildAchievements(progress, lang) {
  const th = lang === 'th';
  const days = Math.max(0, Number(progress?.total_daily_reads) || 0);
  const streak = Math.max(0, Number(progress?.streak_current) || 0);
  const collected = (progress?.collected_base_cards || []).length;
  const ach = progress?.achievements || {};
  const dates = progress?.achievement_dates || {};

  const items = [];
  // Deck-reward milestones (the exclusive streak decks) — NOT moonmallow / not gacha decks.
  getAllDecks()
    .filter((d) => d.role === 'streak-unlock' && typeof d.unlock_day === 'number')
    .sort((a, b) => a.unlock_day - b.unlock_day)
    .forEach((d) => {
      items.push({
        kind: 'deck', id: d.id,
        name: th ? (d.name_th || d.name) : d.name,
        req: th ? fmt('เปิดไพ่ครบ {n} วัน', { n: d.unlock_day }) : fmt('Draw on {n} different days', { n: d.unlock_day }),
        done: days >= d.unlock_day, cur: Math.min(days, d.unlock_day), total: d.unlock_day,
        unit: th ? 'วัน' : 'days', coins: 20, date: dates[deckDateKey(d.id)] || null,
      });
    });
  // Badge achievements (keys mirror progress.evaluateAchievements).
  const badge = (key, en, thName, req, reqTh, cur, total) => items.push({
    kind: 'badge', id: key, name: th ? thName : en, sym: '✦',
    req: th ? reqTh : req, done: !!ach[key], cur, total, coins: 20, date: dates[key] || null,
  });
  badge('streak_3', '3-Day Streak', 'สตรีค 3 วัน', 'Read 3 days in a row', 'เปิดไพ่ 3 วันติดต่อกัน', Math.min(streak, 3), 3);
  badge('streak_7', '7-Day Streak', 'สตรีค 7 วัน', 'Read 7 days in a row', 'เปิดไพ่ 7 วันติดต่อกัน', Math.min(streak, 7), 7);
  badge('first_reversed', 'First Reversed', 'ไพ่กลับใบแรก', 'Draw your first reversed card', 'เปิดไพ่กลับใบแรก', 0, 1);
  badge('first_major_arcana', 'First Major Arcana', 'อาร์คานาใหญ่ใบแรก', 'Draw your first Major Arcana', 'เปิดไพ่อาร์คานาใหญ่ใบแรก', 0, 1);
  badge('collect_10', 'Collector I', 'นักสะสม I', 'Collect 10 cards', 'สะสมไพ่ 10 ใบ', Math.min(collected, 10), 10);
  badge('collect_30', 'Collector II', 'นักสะสม II', 'Collect 30 cards', 'สะสมไพ่ 30 ใบ', Math.min(collected, 30), 30);
  badge('full_deck_78', 'Full Deck', 'ครบสำรับ', 'Collect all 78 cards', 'สะสมไพ่ครบ 78 ใบ', Math.min(collected, 78), 78);
  return items;
}

function rowEl(it, lang, { next = false } = {}) {
  const th = lang === 'th';
  const row = document.createElement('div');
  row.className = 'mt-ach-row' + (it.done ? ' is-done' : '') + (next ? ' is-next' : '');

  const marker = document.createElement('span');
  marker.className = 'mt-ach-row__marker';
  marker.textContent = it.done ? '✓' : (it.kind === 'deck' ? String(it.total) : '✦');
  row.appendChild(marker);

  const mid = document.createElement('div');
  mid.className = 'mt-ach-row__mid';
  const req = document.createElement('div');
  req.className = 'mt-ach-row__req';
  req.textContent = it.req;
  mid.appendChild(req);
  if (it.done && it.date) {
    const d = document.createElement('div');
    d.className = 'mt-ach-row__meta';
    d.textContent = th ? `ปลดล็อก ${fmtDate(it.date, lang)}` : `Unlocked ${fmtDate(it.date, lang)}`;
    mid.appendChild(d);
  } else if (!it.done && it.total > 1) {
    const wrap = document.createElement('div');
    wrap.className = 'mt-ach-row__prog';
    const bar = document.createElement('div');
    bar.className = 'mt-ach-row__prog-fill';
    bar.style.width = `${Math.round((it.cur / it.total) * 100)}%`;
    wrap.appendChild(bar);
    mid.appendChild(wrap);
    const c = document.createElement('div');
    c.className = 'mt-ach-row__meta';
    c.textContent = `${it.cur} / ${it.total}${it.unit ? ` ${it.unit}` : ''}`;
    mid.appendChild(c);
  }
  row.appendChild(mid);

  const reward = document.createElement('div');
  reward.className = 'mt-ach-row__reward';
  if (it.kind === 'deck') {
    const t = deckThumb(it.id); t.className = 'mt-ach-row__deck'; reward.appendChild(t);
  } else {
    const b = document.createElement('span'); b.className = 'mt-ach-row__badge'; b.textContent = it.sym; reward.appendChild(b);
  }
  const coin = document.createElement('span');
  coin.className = 'mt-ach-row__coin';
  coin.innerHTML = `<img src="/assets/meow-coin.svg" alt="" aria-hidden="true" />${it.coins}`;
  reward.appendChild(coin);
  row.appendChild(reward);

  // Tap a DECK reward → preview its art (the Fool), with the achievement status below.
  if (it.kind === 'deck') {
    row.style.cursor = 'pointer';
    row.setAttribute('role', 'button');
    row.addEventListener('click', () => {
      const deck = getAllDecks().find((d) => d.id === it.id);
      if (!deck) return;
      const th = lang === 'th';
      showDeckPreview(deck, {
        lang,
        buildCondition(cond, { close }) {
          const text = document.createElement('p');
          text.className = 'mt-dp-cond-text';
          if (it.done) {
            text.textContent = th ? '✓ ปลดล็อกแล้ว — เลือกใช้ได้ที่ “สำรับของคุณ”' : '✓ Unlocked — find it in Your Decks.';
          } else {
            text.textContent = th
              ? `${it.req} (ตอนนี้ ${it.cur}/${it.total})`
              : `${it.req} (${it.cur}/${it.total})`;
          }
          cond.appendChild(text);
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'mt-dp-btn mt-dp-btn--close';
          btn.textContent = th ? 'เข้าใจแล้ว' : 'Got it';
          btn.addEventListener('click', close);
          cond.appendChild(btn);
        },
      });
    });
  }
  return row;
}

export function renderAchievementsPanel(container, progress, dict, lang) {
  if (!container) return;
  container.innerHTML = '';
  const th = lang === 'th';
  const items = buildAchievements(progress, lang);
  const total = items.length;
  const unlocked = items.filter((i) => i.done).length;
  const pct = total ? Math.round((unlocked / total) * 100) : 0;
  const nextItem = items.find((i) => !i.done) || null;
  const recent = items.filter((i) => i.done && i.date).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 4);

  const card = document.createElement('section');
  card.className = 'mt-ach-card panel';

  // header
  const head = document.createElement('div');
  head.className = 'mt-ach-head';
  head.innerHTML = `
    <div class="mt-ach-head__l"><span class="mt-ach-head__ico">★</span><h2 class="mt-ach-head__title">${th ? 'ความสำเร็จ' : 'Achievements'}</h2></div>
    <button type="button" class="mt-ach-seeall" id="mt-ach-seeall">${th ? 'ดูทั้งหมด →' : 'See all →'}</button>`;
  card.appendChild(head);

  // summary
  const sum = document.createElement('div');
  sum.className = 'mt-ach-summary';
  sum.innerHTML = `
    <div class="mt-ach-summary__row"><span>${th ? fmt('ปลดล็อกแล้ว {u} จาก {t} รางวัล', { u: unlocked, t: total }) : fmt('{u} of {t} rewards unlocked', { u: unlocked, t: total })}</span><span class="mt-ach-summary__pct">${pct}%</span></div>
    <div class="mt-ach-summary__track"><div class="mt-ach-summary__fill" style="width:${pct}%"></div></div>`;
  card.appendChild(sum);

  // next reward
  if (nextItem) {
    const eb = document.createElement('div');
    eb.className = 'mt-ach-eyebrow';
    eb.textContent = th ? 'รางวัลถัดไป' : 'Next reward';
    card.appendChild(eb);
    const nextWrap = document.createElement('div');
    nextWrap.className = 'mt-ach-next';
    nextWrap.appendChild(rowEl(nextItem, lang, { next: true }));
    card.appendChild(nextWrap);
  }

  // recently unlocked chips
  if (recent.length) {
    const reb = document.createElement('div');
    reb.className = 'mt-ach-recent-head';
    reb.textContent = th ? 'ปลดล็อกล่าสุด' : 'Recently unlocked';
    card.appendChild(reb);
    const chips = document.createElement('div');
    chips.className = 'mt-ach-chips';
    recent.forEach((it) => {
      const chip = document.createElement('div');
      chip.className = 'mt-ach-chip';
      const box = document.createElement('div');
      box.className = 'mt-ach-chip__box' + (it.kind === 'deck' ? ' is-deck' : ' is-badge');
      if (it.kind === 'deck') { const t = deckThumb(it.id); box.appendChild(t); } else { box.innerHTML = `<span>${it.sym}</span>`; }
      box.insertAdjacentHTML('beforeend', '<span class="mt-ach-chip__check">✓</span>');
      chip.appendChild(box);
      const lbl = document.createElement('span'); lbl.className = 'mt-ach-chip__label'; lbl.textContent = it.name; chip.appendChild(lbl);
      chips.appendChild(chip);
    });
    card.appendChild(chips);
  }

  // expandable full list
  const all = document.createElement('div');
  all.className = 'mt-ach-all';
  all.hidden = true;
  items.forEach((it) => all.appendChild(rowEl(it, lang, { next: nextItem && it.id === nextItem.id && it.kind === nextItem.kind })));
  card.appendChild(all);

  container.appendChild(card);

  const seeAll = card.querySelector('#mt-ach-seeall');
  seeAll.addEventListener('click', () => {
    const showing = !all.hidden;
    all.hidden = showing;
    seeAll.textContent = showing ? (th ? 'ดูทั้งหมด →' : 'See all →') : (th ? 'ย่อ ↑' : 'Show less ↑');
  });
}
