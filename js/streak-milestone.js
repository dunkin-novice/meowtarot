/**
 * streak-milestone.js — Phase 5 "Halfway · Day N" celebration popup
 *
 * Fires when the user's daily streak crosses the halfway point between
 * two consecutive deck-unlock streak days (e.g., last unlock at day 14,
 * next at day 26 → fires on day 20). Persuades the user to keep going
 * by visualizing exactly how close they are.
 *
 * Design: PopupStreakMilestone in MeowTarot Redesign.html section 12.B.
 *
 * Lifetime: auto-dismisses after 3000ms unless the user taps the
 * "Keep going" CTA (which dismisses immediately). Throttled per
 * streak-milestone-day so users only see the popup once per crossing
 * — even if they revisit /reading.html?mode=daily on the same day.
 *
 * Usage:
 *   import { maybeShowStreakMilestonePopup } from './streak-milestone.js';
 *   maybeShowStreakMilestonePopup({
 *     decks,       // array of all decks with unlock_day
 *     progress,    // user progress { streak_current, ... }
 *     lang,        // 'en' | 'th'
 *   });
 */

const OVERLAY_ID = 'mt-streak-milestone-overlay';
const STYLE_ID = 'mt-streak-milestone-style';
const SEEN_KEY_PREFIX = 'mt-streak-milestone-seen-';
const AUTO_DISMISS_MS = 3000;

const COPY = {
  en: {
    eyebrow: 'Halfway · Day {day}',
    title: 'Halfway there',
    body: '{remaining} more days to unlock {deck}',
    cta: 'Keep going',
    autoNote: 'auto-dismiss in 3s',
    barLabelCurrent: 'Day {current}',
    barLabelMid: 'Day {mid} · today',
    barLabelTarget: 'Day {target} · unlock',
  },
  th: {
    eyebrow: 'ครึ่งทาง · วันที่ {day}',
    title: 'ใกล้แล้ว',
    body: 'อีก {remaining} วัน — {deckTh}รอคุณอยู่',
    cta: 'สู้ต่อ',
    autoNote: 'ปิดอัตโนมัติใน 3 วินาที',
    barLabelCurrent: 'วันที่ {current}',
    barLabelMid: 'วันที่ {mid} · วันนี้',
    barLabelTarget: 'วันที่ {target} · ปลดล็อก',
  },
};

function getCopy(lang) {
  return COPY[lang] || COPY.en;
}

function fmt(template, vars) {
  let out = String(template || '');
  Object.entries(vars || {}).forEach(([k, v]) => {
    out = out.split(`{${k}}`).join(String(v));
  });
  return out;
}

function injectStylesOnce() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .mt-streak-overlay {
      position: fixed; inset: 0; z-index: 1200;
      background: rgba(28, 12, 52, 0.4);
      backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
      display: flex; align-items: center; justify-content: center;
      padding: 22px;
      opacity: 0; transition: opacity 220ms ease;
    }
    .mt-streak-overlay.is-visible { opacity: 1; }

    .mt-streak-card {
      width: 100%; max-width: 360px;
      background: linear-gradient(180deg, #fff6e9 0%, #fde8d8 100%);
      border-radius: 24px;
      padding: 22px 22px 18px;
      position: relative;
      box-shadow: 0 30px 60px -20px rgba(20, 8, 40, 0.5),
                  0 8px 20px -8px rgba(20, 8, 40, 0.25);
      border: 1px solid rgba(201, 147, 58, 0.45);
      transform: translateY(12px) scale(0.98);
      transition: transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .mt-streak-overlay.is-visible .mt-streak-card { transform: none; }

    .mt-streak-eyebrow {
      font-family: var(--mt-font-body, "DM Sans", system-ui, sans-serif);
      font-size: 10.5px; letter-spacing: 0.28em;
      color: var(--mt-gold, #c9933a); font-weight: 700;
      text-transform: uppercase;
    }

    .mt-streak-bar-wrap { margin-top: 12px; }
    .mt-streak-bar-track {
      height: 14px; border-radius: 999px;
      background: rgba(61, 26, 92, 0.1);
      position: relative; overflow: visible;
    }
    .mt-streak-bar-fill {
      height: 100%; border-radius: 999px;
      background: linear-gradient(90deg, #e8457a 0%, #c9933a 100%);
      box-shadow: 0 0 18px rgba(232, 69, 122, 0.6),
                  inset 0 1px 0 rgba(255, 255, 255, 0.4);
      position: relative;
      transition: width 620ms cubic-bezier(0.22, 1, 0.36, 1);
    }
    .mt-streak-bar-pearl {
      position: absolute; right: -5px; top: -3px;
      width: 20px; height: 20px; border-radius: 50%;
      background: radial-gradient(circle, #fff 28%, #e8a838 72%);
      box-shadow: 0 0 20px rgba(232, 168, 56, 0.85),
                  0 2px 6px rgba(61, 26, 92, 0.4);
      border: 2px solid #fff;
    }
    .mt-streak-bar-target {
      position: absolute; right: 0; top: -4px;
      height: 22px; width: 2px;
      background: var(--mt-gold, #c9933a); opacity: 0.7;
      border-radius: 1px;
    }
    .mt-streak-bar-labels {
      display: flex; justify-content: space-between;
      margin-top: 7px;
      font-family: var(--mt-font-body, "DM Sans", system-ui, sans-serif);
      font-size: 10px; color: var(--mt-ink-soft, #7c5e96);
      font-weight: 600;
    }
    .mt-streak-bar-labels__current { color: var(--mt-gold, #c9933a); }

    .mt-streak-content {
      margin-top: 18px; display: flex; gap: 14px; align-items: center;
    }
    .mt-streak-deck {
      position: relative; flex-shrink: 0;
      width: 72px; height: 108px;
    }
    .mt-streak-deck::before {
      content: ""; position: absolute; inset: -10px;
      background: radial-gradient(circle, rgba(212, 154, 44, 0.5), transparent 65%);
      filter: blur(6px);
      pointer-events: none;
    }
    .mt-streak-deck-back {
      position: relative;
      width: 72px; height: 108px;
      border-radius: 8px;
      background: linear-gradient(155deg, #2a1d4a 0%, #7c6aa8 100%);
      border: 0.5px solid rgba(201, 147, 58, 0.45);
      box-shadow: 0 10px 22px -8px rgba(61, 26, 92, 0.4);
      overflow: hidden;
    }
    .mt-streak-deck-back__inner {
      position: absolute; inset: 6px;
      border: 0.5px solid rgba(201, 147, 58, 0.4);
      border-radius: 5px; opacity: 0.6;
    }
    .mt-streak-deck-back__sigil {
      position: absolute; left: 50%; top: 42%;
      transform: translate(-50%, -50%);
      font-family: var(--mt-font-display, "Cormorant Garamond", Georgia, serif);
      color: rgba(232, 196, 120, 0.7);
      font-style: italic; font-size: 32px;
      line-height: 1;
    }

    .mt-streak-text { flex: 1; min-width: 0; }
    .mt-streak-title {
      font-family: var(--mt-font-display, "Cormorant Garamond", Georgia, serif);
      font-size: 24px; font-weight: 500;
      color: var(--mt-plum, #3d1a5c);
      font-style: italic; line-height: 1.05; margin: 0;
    }
    .mt-streak-title-alt {
      font-family: var(--mt-font-display-th, "Noto Serif Thai", serif);
      font-size: 16px; color: var(--mt-plum-mid, #6a3f8e);
      margin: 2px 0 0; font-weight: 600;
    }
    .mt-streak-body {
      font-family: var(--mt-font-body, "DM Sans", system-ui, sans-serif);
      font-size: 12.5px; color: var(--mt-plum, #3d1a5c);
      margin: 8px 0 0; line-height: 1.5;
    }
    .mt-streak-body b {
      font-family: var(--mt-font-display, "Cormorant Garamond", Georgia, serif);
      font-style: italic; font-weight: 600;
    }
    .mt-streak-body-alt {
      font-family: var(--mt-font-thai, "IBM Plex Sans Thai", sans-serif);
      font-size: 11.5px; color: var(--mt-plum-mid, #6a3f8e);
      margin: 3px 0 0; line-height: 1.55;
    }

    .mt-streak-cta {
      margin-top: 18px; width: 100%;
      font-family: var(--mt-font-body, "DM Sans", system-ui, sans-serif);
      font-weight: 600; font-size: 14px;
      padding: 13px 18px; border-radius: 14px; border: none;
      background: linear-gradient(135deg, #6e1d4c 0%, #d12878 45%, #e8a838 100%);
      color: #fff8e7; cursor: pointer;
      box-shadow: 0 14px 26px -10px rgba(209, 40, 120, 0.55);
      letter-spacing: 0.01em;
      -webkit-tap-highlight-color: transparent;
      transition: transform 140ms ease;
    }
    .mt-streak-cta:active { transform: scale(0.97); }

    .mt-streak-auto-note {
      margin-top: 10px; text-align: center;
      font-family: var(--mt-font-body, "DM Sans", system-ui, sans-serif);
      font-size: 10px; color: var(--mt-ink-soft, #7c5e96);
      opacity: 0.7;
      letter-spacing: 0.15em; text-transform: uppercase;
    }
  `;
  document.head.appendChild(style);
}

function hasSeen(key) {
  try { return Boolean(window.localStorage?.getItem(SEEN_KEY_PREFIX + key)); }
  catch (_) { return false; }
}
function markSeen(key) {
  try { window.localStorage?.setItem(SEEN_KEY_PREFIX + key, String(Date.now())); } catch (_) {}
}

/**
 * Inspect the user's current streak and the deck unlock schedule.
 * If the streak day matches the halfway point between the last and
 * next deck unlock, return the metadata needed to render the popup.
 * Otherwise return null (no popup should render).
 */
function findHalfwayContext({ decks, currentStreak }) {
  if (!Array.isArray(decks) || !decks.length) return null;
  if (!Number.isFinite(currentStreak) || currentStreak <= 0) return null;

  const unlockable = decks
    .filter((d) => d && Number.isFinite(d.unlock_day) && d.unlock_day > 0)
    .sort((a, b) => a.unlock_day - b.unlock_day);
  if (!unlockable.length) return null;

  const nextDeck = unlockable.find((d) => d.unlock_day > currentStreak);
  if (!nextDeck) return null;

  const prevDeck = unlockable.filter((d) => d.unlock_day <= currentStreak).pop();
  const prevDay = prevDeck ? prevDeck.unlock_day : 0;
  const targetDay = nextDeck.unlock_day;
  const midDay = Math.floor((prevDay + targetDay) / 2);

  if (currentStreak !== midDay) return null;
  if (midDay === prevDay || midDay === targetDay) return null;

  return {
    currentDay: currentStreak,
    prevDay,
    midDay,
    targetDay,
    nextDeck,
    fillPct: targetDay > prevDay ? ((midDay - prevDay) / (targetDay - prevDay)) * 100 : 50,
  };
}

export function maybeShowStreakMilestonePopup({ decks, progress, lang = 'en' } = {}) {
  if (typeof document === 'undefined' || !document.body) return null;
  if (document.getElementById(OVERLAY_ID)) return null;

  const currentStreak = Math.max(0, Number(progress?.streak_current) || 0);
  const ctx = findHalfwayContext({ decks, currentStreak });
  if (!ctx) return null;

  const seenKey = `day${ctx.midDay}-toward-${ctx.nextDeck.id || ctx.nextDeck.unlock_day}`;
  if (hasSeen(seenKey)) return null;
  markSeen(seenKey);

  injectStylesOnce();
  const copy = getCopy(lang);

  const remaining = Math.max(0, ctx.targetDay - ctx.currentDay);
  const deckName = ctx.nextDeck.name || '';
  const deckNameTh = ctx.nextDeck.name_th || deckName;

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.className = 'mt-streak-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  overlay.innerHTML = `
    <div class="mt-streak-card" role="document">
      <div class="mt-streak-eyebrow">${fmt(copy.eyebrow, { day: ctx.midDay })}</div>

      <div class="mt-streak-bar-wrap">
        <div class="mt-streak-bar-track">
          <div class="mt-streak-bar-fill" style="width: 0%;">
            <span class="mt-streak-bar-pearl" aria-hidden="true"></span>
          </div>
          <span class="mt-streak-bar-target" aria-hidden="true"></span>
        </div>
        <div class="mt-streak-bar-labels">
          <span>${fmt(copy.barLabelCurrent, { current: ctx.prevDay })}</span>
          <span class="mt-streak-bar-labels__current">${fmt(copy.barLabelMid, { mid: ctx.midDay })}</span>
          <span>${fmt(copy.barLabelTarget, { target: ctx.targetDay })}</span>
        </div>
      </div>

      <div class="mt-streak-content">
        <div class="mt-streak-deck" aria-hidden="true">
          <div class="mt-streak-deck-back">
            <div class="mt-streak-deck-back__inner"></div>
            <div class="mt-streak-deck-back__sigil">M</div>
          </div>
        </div>
        <div class="mt-streak-text">
          <h2 class="mt-streak-title">${copy.title}</h2>
          <p class="mt-streak-body">${fmt(copy.body, { remaining, deck: `<b>${lang === 'th' ? deckNameTh : deckName}</b>`, deckTh: deckNameTh })}</p>
        </div>
      </div>

      <button type="button" class="mt-streak-cta">${copy.cta}</button>
      <div class="mt-streak-auto-note">${copy.autoNote}</div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Two animation frames: paint the popup at 0% fill, then transition
  // the bar to its halfway position so the rose-gold sweep is visible.
  requestAnimationFrame(() => {
    overlay.classList.add('is-visible');
    requestAnimationFrame(() => {
      const fillEl = overlay.querySelector('.mt-streak-bar-fill');
      if (fillEl) fillEl.style.width = `${ctx.fillPct.toFixed(1)}%`;
    });
  });

  let autoDismissTimer = null;
  const dismiss = () => {
    if (autoDismissTimer) { window.clearTimeout(autoDismissTimer); autoDismissTimer = null; }
    overlay.classList.remove('is-visible');
    window.setTimeout(() => overlay.remove(), 240);
    document.removeEventListener('keydown', escListener);
  };

  const escListener = (e) => {
    if (e.key === 'Escape') dismiss();
  };
  document.addEventListener('keydown', escListener);

  overlay.querySelector('.mt-streak-cta')?.addEventListener('click', dismiss);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) dismiss();
  });

  autoDismissTimer = window.setTimeout(dismiss, AUTO_DISMISS_MS);

  return overlay;
}
