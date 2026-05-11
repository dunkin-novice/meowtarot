/**
 * ladder-b.js — Ladder B (Lifetime Engagement Counter)
 *
 * Trigger  : user opened app today (any session)
 * Resets   : never — counter only goes up
 * Cycles   : 14-day windows; bar fills 0→13, completes at 14, resets to 0
 * Storage  : Supabase public.ladder_b (one row per user)
 * v1 reward: affirmation copy only — no deck unlocks, no gacha
 */

import { getSupabaseClient, getCurrentUser } from './auth.js';

const CYCLE_LENGTH = 14;

// PLACEHOLDER — Dunkin to review and refine. Thai poetic register.
// One string per cycle completion. Wraps after 14 cycles.
const AFFIRMATIONS = [
  'คุณมาแล้ว และนั่นคือทุกอย่าง',
  '14 วันแห่งการปรากฏตัว ขอบคุณที่ยังอยู่',
  'ดาวไม่ได้สว่างทุกคืน แต่มันยังอยู่ที่นั่น',
  'คุณเดินทางมาไกลแล้ว',
  'แต่ละวันที่มา คือความกล้าแบบเงียบๆ',
  'ไพ่รู้ว่าคุณมา',
  'ความสม่ำเสมอคือรูปแบบหนึ่งของความรัก',
  'คุณไม่ต้องสมบูรณ์แบบ แค่มาก็พอ',
  'วันนี้นับ พรุ่งนี้ก็นับ',
  'คุณกำลังสร้างบางอย่างที่มองไม่เห็น',
  'ไม่มีวันที่หายไปจริงๆ ถ้าคุณยังจำได้',
  'แมวรู้จักคุณแล้ว',
  'ทุกการมาถือเป็นส่วนหนึ่งของคุณ',
  'คุณอยู่ที่นี่ นั่นคือเพียงพอแล้ว',
];

/** Returns today as YYYY-MM-DD in the user's local timezone. */
function getLocalDateStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Initialize Ladder B for the current calendar day.
 *
 * Returns null if: Supabase not configured, user not authed, or DB error.
 * Returns:
 * {
 *   state        : { lifetime_count, cycle_position, cycles_completed },
 *   prevCyclePos : number,    // position before this advance (for animation)
 *   advanced     : boolean,   // true = first open today → show popup
 *   cycleCompleted: boolean,
 *   affirmation  : string|null
 * }
 */
export async function initLadderB() {
  console.log('[ladder-b] initLadderB called');
  const client = await getSupabaseClient();
  if (!client) {
    console.log('[ladder-b] exit: no client');
    return null;
  }

  const user = await getCurrentUser();
  if (!user) {
    console.log('[ladder-b] exit: no user, auth returned:', user);
    return null;
  }

  const today = getLocalDateStr();

  const { data: row, error: fetchError } = await client
    .from('ladder_b')
    .select('lifetime_count, cycle_position, cycles_completed, last_open_date')
    .eq('user_id', user.id)
    .maybeSingle();

  if (fetchError) {
    console.warn('[ladder-b] fetch error', fetchError.message);
    return null;
  }

  // Already advanced today — no popup
  if (row && row.last_open_date === today) {
    console.log('[ladder-b] exit: already advanced today, last_open_date:', row.last_open_date);
    return {
      state: {
        lifetime_count: row.lifetime_count,
        cycle_position: row.cycle_position,
        cycles_completed: row.cycles_completed,
      },
      prevCyclePos: row.cycle_position,
      advanced: false,
      cycleCompleted: false,
      affirmation: null,
    };
  }

  const prevLifetime       = row ? row.lifetime_count   : 0;
  const prevCyclePos       = row ? row.cycle_position   : 0;
  const prevCyclesCompleted = row ? row.cycles_completed : 0;

  const newLifetime        = prevLifetime + 1;
  const rawNewPos          = prevCyclePos + 1;
  const cycleCompleted     = rawNewPos >= CYCLE_LENGTH;
  const newCyclePos        = cycleCompleted ? 0 : rawNewPos;
  const newCyclesCompleted = cycleCompleted ? prevCyclesCompleted + 1 : prevCyclesCompleted;
  const affirmation        = cycleCompleted
    ? AFFIRMATIONS[prevCyclesCompleted % AFFIRMATIONS.length]
    : null;

  const { error: upsertError } = await client
    .from('ladder_b')
    .upsert(
      {
        user_id          : user.id,
        lifetime_count   : newLifetime,
        cycle_position   : newCyclePos,
        cycles_completed : newCyclesCompleted,
        last_open_date   : today,
        updated_at       : new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

  if (upsertError) {
    console.warn('[ladder-b] upsert error', upsertError.message);
    return null;
  }

  return {
    state: { lifetime_count: newLifetime, cycle_position: newCyclePos, cycles_completed: newCyclesCompleted },
    prevCyclePos,
    advanced: true,
    cycleCompleted,
    affirmation,
  };
}

/**
 * Inject and animate the daily Ladder B popup.
 * Pass the return value of initLadderB() when advanced === true.
 * Auto-dismisses: 2500ms normal day, 3500ms cycle-complete day.
 */
export function showLadderBPopup(result) {
  if (!result || !result.advanced) return;

  const { state, prevCyclePos, cycleCompleted, affirmation } = result;
  const { lifetime_count } = state;

  const R = 45;
  const C = 2 * Math.PI * R; // ≈ 282.74

  // Animate from prevCyclePos/14 → toPos/14
  // If cycle completed, animate to full (14/14), not 0
  const toPos      = cycleCompleted ? CYCLE_LENGTH : (prevCyclePos + 1);
  const fromOffset = C * (1 - prevCyclePos / CYCLE_LENGTH);
  const toOffset   = C * (1 - toPos / CYCLE_LENGTH);

  const isThai       = window.location.pathname.startsWith('/th/');
  const counterLabel = isThai ? 'วันแล้ว' : 'days';

  const popup = document.createElement('div');
  popup.id = 'mt-ladder-b-popup';
  popup.setAttribute('role', 'status');
  popup.setAttribute('aria-live', 'polite');
  popup.innerHTML = `
    <div class="mt-lbp-card">
      <div class="mt-lbp-ring-wrap">
        <svg class="mt-lbp-ring" viewBox="0 0 100 100" aria-hidden="true">
          <circle class="mt-lbp-ring-bg" cx="50" cy="50" r="${R}"/>
          <circle class="mt-lbp-ring-fill" cx="50" cy="50" r="${R}"
            stroke-dasharray="${C.toFixed(2)}"
            stroke-dashoffset="${fromOffset.toFixed(2)}"/>
        </svg>
        <div class="mt-lbp-counter">
          <span class="mt-lbp-count">${lifetime_count}</span>
          <span class="mt-lbp-label">${counterLabel}</span>
        </div>
      </div>
      ${affirmation ? `<p class="mt-lbp-affirmation">${affirmation}</p>` : ''}
    </div>
  `;

  document.body.appendChild(popup);

  // Trigger ring animation on next frame
  requestAnimationFrame(() => {
    const fill = popup.querySelector('.mt-lbp-ring-fill');
    if (fill) {
      fill.style.transition = 'stroke-dashoffset 600ms cubic-bezier(0.4, 0, 0.2, 1)';
      fill.style.strokeDashoffset = toOffset.toFixed(2);
    }
  });

  const dismiss = () => {
    popup.classList.add('mt-lbp-fade-out');
    setTimeout(() => popup.remove(), 400);
  };

  popup.addEventListener('click', dismiss, { once: true });
  setTimeout(dismiss, cycleCompleted ? 3500 : 2500);
}
