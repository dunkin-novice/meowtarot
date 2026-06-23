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
import { getCurrentUserSync, loginWithProvider } from './auth.js';
import {
  isDailyLoginClaimed, isDailyReadingClaimed, isWeeklyQuestionClaimed,
  isMonthlyCelticClaimed, isWeeklyStreakClaimed,
} from './meow-coin.js';

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

  // RECURRING earns (reset per period). `done` = claimed for the CURRENT period (from the wallet).
  // (founder 2026-06-23: Daily / Weekly / Monthly / Repeatable groups + coin-source labels.)
  const earn = (group, id, en, thName, reqEn, reqTh, done, coins, cur, total, unit) => items.push({
    group, kind: 'earn', id, name: th ? thName : en, req: th ? reqTh : reqEn,
    done, coins, cur: cur != null ? cur : (done ? 1 : 0), total: total != null ? total : 1, unit: unit || '',
  });
  earn('daily', 'daily_login', 'Daily sign-in', 'เข้าระบบรายวัน', 'Sign in today', 'เข้าระบบวันนี้', isDailyLoginClaimed(), 5);
  earn('daily', 'daily_reading', 'Daily reading', 'เปิดไพ่รายวัน', "Do today's reading", 'เปิดไพ่วันนี้', isDailyReadingClaimed(), 5);
  earn('weekly', 'weekly_question', 'Ask a Question', 'ถามไพ่', 'Once this week', 'สัปดาห์ละครั้ง', isWeeklyQuestionClaimed(), 10);
  earn('monthly', 'monthly_celtic', 'Celtic Cross', 'เซลติกครอส', 'Once this month', 'เดือนละครั้ง', isMonthlyCelticClaimed(), 20);
  earn('repeatable', 'weekly_streak', '7-day streak', 'สตรีค 7 วัน', 'Keep a 7-day streak · weekly', 'รักษาสตรีค 7 วัน · รายสัปดาห์', isWeeklyStreakClaimed(), 5, Math.min(streak, 7), 7, th ? 'วัน' : 'days');

  // LIFETIME — deck-reward milestones (the exclusive streak decks; "sign in for X days").
  getAllDecks()
    .filter((d) => d.role === 'streak-unlock' && typeof d.unlock_day === 'number')
    .sort((a, b) => a.unlock_day - b.unlock_day)
    .forEach((d) => {
      items.push({
        group: 'lifetime', kind: 'deck', id: d.id,
        name: th ? (d.name_th || d.name) : d.name,
        req: th ? fmt('เปิดไพ่ครบ {n} วัน', { n: d.unlock_day }) : fmt('Draw on {n} different days', { n: d.unlock_day }),
        done: days >= d.unlock_day, cur: Math.min(days, d.unlock_day), total: d.unlock_day,
        unit: th ? 'วัน' : 'days', coins: 20, date: dates[deckDateKey(d.id)] || null,
      });
    });
  // LIFETIME — one-time badges. (streak_3/streak_7 dropped: streak is now the Repeatable reward.)
  const badge = (key, en, thName, req, reqTh, cur, total) => items.push({
    group: 'lifetime', kind: 'badge', id: key, name: th ? thName : en, sym: '✦',
    req: th ? reqTh : req, done: !!ach[key], cur, total, coins: 20, date: dates[key] || null,
  });
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
  marker.textContent = it.done ? '✓' : (it.kind === 'deck' ? String(it.total) : it.kind === 'earn' ? '○' : '✦');
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
  }
  // badge + earn rows just show the coin reward (no gold-sphere ✦).
  const coin = document.createElement('span');
  coin.className = 'mt-ach-row__coin';
  coin.innerHTML = `<img src="/assets/meow-coin-200.webp" alt="" aria-hidden="true" />${it.coins}`;
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
          // Signed-out: these reward decks are tied to the account, so nudge sign-in to collect
          // them. (founder 2026-06-23) Signed-in: just a dismiss button.
          if (!getCurrentUserSync()) {
            const cta = document.createElement('p');
            cta.className = 'mt-dp-cond-text';
            cta.textContent = th ? 'เข้าสู่ระบบเพื่อสะสมสำรับใหม่' : 'Sign in to collect new decks';
            cond.appendChild(cta);
            const signin = document.createElement('button');
            signin.type = 'button';
            signin.className = 'mt-dp-btn mt-dp-btn--buy';
            signin.textContent = th ? 'เข้าสู่ระบบด้วย Google' : 'Sign in with Google';
            signin.addEventListener('click', () => { loginWithProvider('google').catch(() => {}); });
            cond.appendChild(signin);
          } else {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'mt-dp-btn mt-dp-btn--close';
            btn.textContent = th ? 'เข้าใจแล้ว' : 'Got it';
            btn.addEventListener('click', close);
            cond.appendChild(btn);
          }
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
  // Summary / next / recent track the LIFETIME (permanent) rewards; the recurring earns reset.
  const lifetime = items.filter((i) => i.group === 'lifetime');
  const total = lifetime.length;
  const unlocked = lifetime.filter((i) => i.done).length;
  const pct = total ? Math.round((unlocked / total) * 100) : 0;
  const nextItem = lifetime.find((i) => !i.done) || null;
  const recent = lifetime.filter((i) => i.done && i.date).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 4);

  const card = document.createElement('section');
  card.className = 'mt-ach-card panel';

  // header
  const head = document.createElement('div');
  head.className = 'mt-ach-head';
  head.innerHTML = `
    <div class="mt-ach-head__l"><span class="mt-ach-head__ico">★</span><h2 class="mt-ach-head__title">${th ? 'ความสำเร็จ' : 'Achievements'}</h2></div>
    <button type="button" class="mt-ach-seeall" id="mt-ach-seeall">${th ? 'ดูทั้งหมด →' : 'See all →'}</button>`;
  card.appendChild(head);

  // NEXT REWARD first (founder 2026-06-23): lead with the next DECK you're working toward (with
  // its art) — the strongest motivator — above the daily coin earns.
  const nextDeck = lifetime.find((i) => !i.done && i.kind === 'deck') || nextItem;
  if (nextDeck) {
    const eb = document.createElement('div');
    eb.className = 'mt-ach-eyebrow';
    eb.textContent = th ? 'รางวัลถัดไป' : 'Next reward';
    card.appendChild(eb);
    const nextWrap = document.createElement('div');
    nextWrap.className = 'mt-ach-next';
    nextWrap.appendChild(rowEl(nextDeck, lang, { next: true }));
    card.appendChild(nextWrap);
  }

  const groupHeader = (parent, label) => {
    const g = document.createElement('div');
    g.className = 'mt-ach-group';
    g.textContent = label;
    parent.appendChild(g);
  };
  const renderGroup = (parent, key, label) => {
    const groupItems = items.filter((i) => i.group === key);
    if (!groupItems.length) return;
    groupHeader(parent, label);
    groupItems.forEach((it) => parent.appendChild(rowEl(it, lang)));
  };

  // DAILY shown by default (today's quick wins). Everything else is behind "See all".
  renderGroup(card, 'daily', th ? 'รายวัน' : 'Daily');

  const more = document.createElement('div');
  more.className = 'mt-ach-more';
  more.hidden = true;
  renderGroup(more, 'weekly', th ? 'รายสัปดาห์' : 'Weekly');
  renderGroup(more, 'monthly', th ? 'รายเดือน' : 'Monthly');
  renderGroup(more, 'repeatable', th ? 'ทำซ้ำได้' : 'Repeatable');

  // Lifetime (inside "See all"): progress summary + recently-unlocked + the full ladder.
  groupHeader(more, th ? 'ตลอดกาล' : 'Lifetime');
  const sum = document.createElement('div');
  sum.className = 'mt-ach-summary';
  sum.innerHTML = `
    <div class="mt-ach-summary__row"><span>${th ? fmt('ปลดล็อกแล้ว {u} จาก {t} รางวัล', { u: unlocked, t: total }) : fmt('{u} of {t} rewards unlocked', { u: unlocked, t: total })}</span><span class="mt-ach-summary__pct">${pct}%</span></div>
    <div class="mt-ach-summary__track"><div class="mt-ach-summary__fill" style="width:${pct}%"></div></div>`;
  more.appendChild(sum);
  if (recent.length) {
    const reb = document.createElement('div');
    reb.className = 'mt-ach-recent-head';
    reb.textContent = th ? 'ปลดล็อกล่าสุด' : 'Recently unlocked';
    more.appendChild(reb);
    const chips = document.createElement('div');
    chips.className = 'mt-ach-chips';
    recent.forEach((it) => {
      const chip = document.createElement('div');
      chip.className = 'mt-ach-chip';
      const box = document.createElement('div');
      box.className = 'mt-ach-chip__box' + (it.kind === 'deck' ? ' is-deck' : ' is-badge');
      if (it.kind === 'deck') {
        const t = deckThumb(it.id); box.appendChild(t);
      } else {
        const ci = document.createElement('img');
        ci.src = '/assets/meow-coin-200.webp'; ci.alt = ''; ci.loading = 'lazy';
        box.appendChild(ci);
      }
      box.insertAdjacentHTML('beforeend', '<span class="mt-ach-chip__check">✓</span>');
      chip.appendChild(box);
      const lbl = document.createElement('span'); lbl.className = 'mt-ach-chip__label'; lbl.textContent = it.name; chip.appendChild(lbl);
      chips.appendChild(chip);
    });
    more.appendChild(chips);
  }
  lifetime.forEach((it) => more.appendChild(rowEl(it, lang, { next: nextDeck && it.id === nextDeck.id && it.kind === nextDeck.kind })));

  card.appendChild(more);
  container.appendChild(card);

  const seeAll = card.querySelector('#mt-ach-seeall');
  seeAll.addEventListener('click', () => {
    const showing = !more.hidden;
    more.hidden = showing;
    seeAll.textContent = showing ? (th ? 'ดูทั้งหมด →' : 'See all →') : (th ? 'ย่อ ↑' : 'Show less ↑');
  });
}
