import { initShell, localizePath, translations } from './common.js';
import {
  loadTarotManifest,
  loadTarotData,
  getCardBackUrl,
  getCardBackFallbackUrl,
  getCardImageUrl,
  applyImageFallback,
  normalizeId,
  getAllDecks,
  getDecksForDisplay,
  getActiveDeckId,
  setActiveDeck,
  canUnlockDeck,
} from './data.js';
import { serializeReadingStateToUrl } from './reading-url.js';
import { trackTopicSelected, trackSpreadSelected, trackShuffleHit } from './analytics.js';
import { getUserProgress, getNextStreakMilestone } from './progress.js';
import { getCurrentUser, getCurrentUserSync, loginWithProvider, subscribeAuthState } from './auth.js';

const BOARD_CARD_COUNT = 12;
// Phase 5 BUG 3 fix: changed from 6 → 12 to match design doc ScreenCardBoardDaily.
// The 12-card spread matches what the question-draw board already renders
// (BOARD_CARD_COUNT = 12 above). Selection still = 1 of N (DAILY_SELECTION_MAX = 1).
const DAILY_BOARD_COUNT = 12;
const CELTIC_CROSS_COUNT = 10;
const QUESTION_SELECTION_COUNTS = { story: 3, quick: 1 };
let questionSpread = 'quick';
const FULL_POOL_SIZE = 50;
const ORIENTATION_REVERSED_PROBABILITY = 0.5;
const STORAGE_KEY = 'meowtarot_selection';
const DAILY_SELECTION_MAX = 1;
const DEAL_STAGGER = 160;
const STACK_DURATION = 520;
const FULL_DEAL_ANIMATION_DURATION = 960;
const FULL_PICK_CLEAR_DURATION = 120;
const FULL_PICK_REDEAL_DURATION = 1000;
const FULL_PICK_CONFIRM_DURATION = 200;
const FULL_PICK_REDEAL_ONLY_DURATION = FULL_PICK_REDEAL_DURATION - FULL_PICK_CLEAR_DURATION;
const FULL_PICK_REDUCED_CLEAR_DURATION = 50;
const FULL_PICK_REDUCED_REDEAL_DURATION = 100;
const FULL_PICK_REDUCED_CONFIRM_DURATION = 70;
const CARD_BACK_FALLBACK_URL = getCardBackFallbackUrl();
const CELTIC_CROSS_POSITIONS = [
  { key: 'present', labelKey: 'positionPresent' },
  { key: 'challenge', labelKey: 'positionChallenge' },
  { key: 'above', labelKey: 'positionAbove' },
  { key: 'past', labelKey: 'positionPast' },
  { key: 'below', labelKey: 'positionBelow' },
  { key: 'future', labelKey: 'positionFuture' },
  { key: 'advice', labelKey: 'positionAdvice' },
  { key: 'external', labelKey: 'positionExternal' },
  { key: 'hopes', labelKey: 'positionHopes' },
  { key: 'outcome', labelKey: 'positionOutcome' },
];

const state = {
  currentLang: 'en',
  cards: [],
  questionTopic: 'love',
};
let overallFlowCleanup = null;
let fullReadingFlowModulePromise = null;
let questionTopicsModulePromise = null;

const staticCardBacks = document.querySelectorAll('.card-back');

function applyCardBackBackground(el, { thumb = false } = {}) {
  if (!el) return;
  const backUrl = getCardBackUrl({ thumb });
  if (el.tagName === 'IMG') {
    applyImageFallback(el, backUrl, [CARD_BACK_FALLBACK_URL]);
    el.loading = el.loading || 'eager';
    el.alt = '';
    return;
  }
  el.style.backgroundImage = `url('${backUrl}')`;
}

// Board backs render tiny (~40-64px), so use the lightweight 200px thumbnail.
staticCardBacks.forEach((el) => applyCardBackBackground(el, { thumb: true }));

const stripOrientation = (value = '') => String(value || '').replace(/-(upright|reversed)$/i, '');

function pickOrientation(probabilityReversed = ORIENTATION_REVERSED_PROBABILITY) {
  const safeProb = Math.min(1, Math.max(0, probabilityReversed));
  return Math.random() < safeProb ? 'reversed' : 'upright';
}

function findCardWithOrientation(baseCard, orientation) {
  const baseId = stripOrientation(baseCard.card_id || baseCard.id || '');
  const targetId = `${baseId}-${orientation}`;
  const targetNormalized = normalizeId(targetId);

  const hit = state.cards.find((card) => normalizeId(card.card_id || card.id || '') === targetNormalized);
  if (hit) return hit;

  return {
    ...baseCard,
    id: targetNormalized,
    card_id: targetId,
    orientation,
  };
}

function buildDrawablePool() {
  const seen = new Set();
  return state.cards
    .filter((card) => {
      const baseId = stripOrientation(card.card_id || card.id || '');
      if (!baseId || seen.has(baseId)) return false;
      seen.add(baseId);
      return true;
    })
    .map((card) => findCardWithOrientation(card, pickOrientation()));
}

function getDrawableCards(size = 6) {
  if (!state.cards.length) return [];
  const pool = buildDrawablePool();
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(size, pool.length));
}


function setRitualCtaLabel(button, hasDealt) {
  if (!button) return;
  const isThai = state.currentLang === 'th';
  button.textContent = isThai
    ? (hasDealt ? 'สับไพ่' : 'แจกไพ่')
    : (hasDealt ? 'Shuffle' : 'Deal');
  button.classList.toggle('ritual-cta--deal', !hasDealt);
}

function saveSelectionAndGo({ mode, spread, topic, cards }) {
  const payload = { mode, spread, topic, cards };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  const destination = localizePath('/reading.html', state.currentLang);
  window.location.href = serializeReadingStateToUrl({
    mode,
    spread,
    topic,
    cards,
    lang: state.currentLang,
  }, { path: destination });
}

function formatCopy(template, values = {}) {
  return String(template || '').replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ''));
}

function createCardArt(card, className = '', { useBack = false, alt = '' } = {}) {
  const img = document.createElement('img');
  img.className = className;
  img.alt = alt;
  img.width = 360;
  img.height = 600;
  img.decoding = 'async';
  img.loading = 'lazy';
  img.fetchPriority = 'low';
  if (useBack) {
    applyCardBackBackground(img);
    return img;
  }
  applyImageFallback(img, getCardImageUrl(card), [getCardBackUrl(), CARD_BACK_FALLBACK_URL]);
  return img;
}

function getFullReadingFlowModule() {
  if (!fullReadingFlowModulePromise) {
    fullReadingFlowModulePromise = import('./full-reading-flow.js');
  }
  return fullReadingFlowModulePromise;
}

function getQuestionTopicsModule() {
  if (!questionTopicsModulePromise) {
    questionTopicsModulePromise = import('./question-topics.js');
  }
  return questionTopicsModulePromise;
}

function animateBoard(boardEl) {
  const slots = boardEl.querySelectorAll('.card-slot');
  requestAnimationFrame(() => {
    slots.forEach((slot) => {
      slot.classList.add('card-visible');
    });
  });
}

function animateCollectSlots(boardEl, slots) {
  const boardRect = boardEl.getBoundingClientRect();
  const centerX = boardRect.left + boardRect.width / 2;
  const centerY = boardRect.top + boardRect.height / 2;

  slots.forEach((slot) => {
    const rect = slot.getBoundingClientRect();
    const dx = centerX - (rect.left + rect.width / 2);
    const dy = centerY - (rect.top + rect.height / 2);
    slot.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
    slot.style.transform = `translate(${dx}px, ${dy}px) scale(0.9)`;
    slot.style.opacity = '0.8';
  });
}

function animateDealSlots(boardEl, slots, onDone) {
  const boardRect = boardEl.getBoundingClientRect();
  const centerX = boardRect.left + boardRect.width / 2;
  const centerY = boardRect.top + boardRect.height / 2;

  slots.forEach((slot) => {
    const rect = slot.getBoundingClientRect();
    const dx = centerX - (rect.left + rect.width / 2);
    const dy = centerY - (rect.top + rect.height / 2);
    slot.style.transition = 'none';
    slot.style.transform = `translate(${dx}px, ${dy}px) scale(0.9)`;
    slot.style.opacity = '0';
  });

  // Cap the cumulative stagger on big boards: the 78-card Celtic deck at the full
  // 160ms/card stagger took ~12s to deal. For >24 slots, shrink the per-card delay so
  // the whole deal lands in ~0.8s; small boards (daily/question = 12) keep the original
  // ceremonial stagger.
  const stagger = slots.length > 24 ? Math.max(4, Math.floor(700 / slots.length)) : DEAL_STAGGER;

  requestAnimationFrame(() => {
    slots.forEach((slot, idx) => {
      slot.classList.add('card-visible');
      slot.style.transition = 'transform 0.35s ease, opacity 0.35s ease';
      setTimeout(() => {
        slot.style.opacity = '1';
        slot.style.transform = 'translate(0, 0) scale(1)';
      }, idx * stagger);
    });

    const total = 350 + slots.length * stagger + 120;
    setTimeout(() => {
      slots.forEach((slot) => {
        slot.style.transition = '';
        slot.style.transform = '';
        slot.style.opacity = '';
      });
      onDone?.();
    }, total);
  });
}

// Celtic 78-card board deal: simple, jank-free reveal — every card fades + scales in
// together (so all 4 rows and both sides appear at the same time), then inline styles are
// cleared. No per-card translate / getBoundingClientRect / staggered timers (those were
// fragile and could leave cards stuck invisible). ~0.3s vs the old multi-second sweep.
// Simple, jank-free collect for the 78-card board: fade + slight shrink in place, all at
// once (no fly-to-centre transforms that thrashed layout on overlapping cards).
function animateSimpleCollect(boardEl, slots) {
  slots.forEach((slot) => {
    slot.style.transition = 'opacity .16s ease, transform .16s ease';
    slot.style.opacity = '0';
    slot.style.transform = 'scale(0.92)';
  });
}

function animateDailyShuffleSlots(boardEl, slots, onDone) {
  const SHUFFLE_EASE = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)';
  const LANDING_EASE = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
  const spreadRange = Math.min(60, Math.max(20, Math.round(boardEl.clientWidth * 0.2)));
  let finalized = false;

  const resetSlotStyles = () => {
    slots.forEach((slot) => {
      slot.style.transform = 'none';
      slot.style.transition = '';
      slot.style.willChange = 'auto';
      slot.style.zIndex = '';
      slot.style.top = '0';
      slot.style.left = '0';
      slot.style.position = '';
      slot.style.opacity = '1';
      slot.classList.remove('daily-appearing');
      const cardBack = slot.querySelector('.card-back');
      if (cardBack) {
        cardBack.style.opacity = '1';
        cardBack.style.filter = '';
      }
    });
  };

  const finalize = () => {
    if (finalized) return;
    finalized = true;
    resetSlotStyles();
    requestAnimationFrame(() => {
      resetSlotStyles();
      onDone?.();
    });
  };

  slots.forEach((slot) => {
    slot.classList.add('card-visible', 'daily-appearing');
    slot.style.opacity = '';
    slot.style.willChange = 'transform';
    slot.style.zIndex = '10';
    slot.style.transition = 'none';
    slot.style.transform = 'none';
  });

  requestAnimationFrame(() => {
    slots.forEach((slot) => {
      slot.style.transition = 'opacity 300ms ease-out';
      slot.classList.remove('daily-appearing');
    });
  });

  const phaseOneStart = () => {
    slots.forEach((slot) => {
      slot.style.transition = `transform 100ms ${SHUFFLE_EASE}`;
      slot.style.transform = 'translateY(-8px) scale(1.03)';
    });
  };

  const phaseTwoSpread = () => {
    // Phase 5 fix: generate spread vectors algorithmically so the animation
    // scales to any board count. The previous version was hardcoded to 6
    // entries; when DAILY_BOARD_COUNT moved from 6 → 12 in commit 5929448,
    // cards 7-12 fell back to {x:0, y:0, r:0} and sat motionless at center
    // while cards 1-6 fanned out — the "animation only applies to 6 cards"
    // bug. Circular fan with slight vertical flattening (×0.5) so it fits
    // a wider-than-tall daily board; per-card rotation drifts -15° → +15°
    // for variety.
    const count = slots.length;
    slots.forEach((slot, idx) => {
      const angle = (idx / count) * 2 * Math.PI - Math.PI / 2; // start at top
      const x = Math.round(Math.cos(angle) * spreadRange);
      const y = Math.round(Math.sin(angle) * spreadRange * 0.5);
      const r = Math.round((idx / count) * 30 - 15);
      slot.style.transition = `transform 400ms ${SHUFFLE_EASE}`;
      slot.style.transform = `translate(${x}px, ${y}px) rotate(${r}deg) scale(1.03)`;
    });
  };

  const phaseThreeLand = () => {
    slots.forEach((slot) => {
      slot.style.transition = `transform 360ms ${LANDING_EASE}`;
      slot.style.transform = 'translate(0, 0) rotate(0deg) scale(1)';
    });
  };

  setTimeout(phaseOneStart, 340);
  setTimeout(phaseTwoSpread, 460);
  setTimeout(phaseThreeLand, 880);
  setTimeout(finalize, 1260);
}

// Deal the cards out one-by-one from a stacked pile in the CENTRE of the board — the
// "dealing onto the table" feel the founder asked for (2026-06-21). On a re-shuffle the
// previous spread is first collected to the middle (animateCollectSlots / animateSimpleCollect
// in render), then this deals the fresh pile back out card-by-card. Big boards (Celtic = 40)
// use a tighter stagger so the whole deal still lands in well under 2s. Replaces the old
// fan-out (animateDailyShuffleSlots) for daily + question + full.
// Celtic / full board (40 cards) deal — ROBUST + self-contained. Operates on the LIVE DOM
// (boardEl.querySelectorAll), NOT the setupBoard closure `slots` array, because that array can
// diverge from the rendered cards on the full board and strand animateDealStack on an empty set
// (the "shuffle freezes with the cards stuck at centre" bug — confirmed 2026-06-23: is-locked
// cleared but card styles untouched = animateDealStack's empty-slots guard fired). No centre
// gather either, so a hiccup can never leave a stacked pile — cards only ever fade/slide IN at
// their grid slots, and a guaranteed setTimeout clears the inline styles no matter what.
function animateFullDeal(boardEl, onDone) {
  const slots = Array.from(boardEl.querySelectorAll('.card-slot'));
  if (!slots.length) { onDone?.(); return; }
  slots.forEach((slot) => {
    slot.classList.add('card-visible');
    slot.style.transition = 'none';
    slot.style.transform = 'translateY(12px) scale(0.94)';
    slot.style.opacity = '0';
    slot.style.willChange = 'transform, opacity';
  });
  void boardEl.offsetWidth;
  const stagger = 14;
  const flight = 300;
  const total = flight + slots.length * stagger + 160;
  requestAnimationFrame(() => {
    slots.forEach((slot, idx) => {
      window.setTimeout(() => {
        slot.style.transition = `transform ${flight}ms cubic-bezier(0.22, 1, 0.36, 1), opacity 240ms ease-out`;
        slot.style.transform = 'translateY(0) scale(1)';
        slot.style.opacity = '1';
      }, idx * stagger);
    });
  });
  window.setTimeout(() => {
    slots.forEach((slot) => {
      slot.style.transition = '';
      slot.style.transform = '';
      slot.style.opacity = '';
      slot.style.willChange = '';
    });
    onDone?.();
  }, total);
}

function animateDealStack(boardEl, slots, onDone) {
  if (!slots.length) { onDone?.(); return; }
  // CRITICAL: clear any leftover transform first and force a reflow, so getBoundingClientRect
  // measures each card's TRUE GRID position — not a stale transformed one. Bug (2026-06-22):
  // on the shuffle button the previous step (animateCollectSlots) leaves every card translated
  // to the centre; measuring then gave a fly-out distance of ~0, so the "deal" collapsed into
  // an in-place pulse — i.e. each card just shook. Reset → reflow → measure clean grid coords.
  slots.forEach((slot) => {
    slot.classList.add('card-visible');
    slot.style.transition = 'none';
    slot.style.transform = 'none';
    slot.style.opacity = '1';
  });
  void boardEl.offsetWidth; // force reflow so the cleared transforms take effect before measuring

  const boardRect = boardEl.getBoundingClientRect();
  const centerX = boardRect.left + boardRect.width / 2;
  const centerY = boardRect.top + boardRect.height / 2;

  // 1) Pull every card to the centre but keep it INVISIBLE — no visible stacked pile sits there
  //    (founder 2026-06-22: "no need for the stack of deck at the centre"). As the deal begins
  //    each card fades in while spreading out, so the centre stack just "disappears".
  slots.forEach((slot, idx) => {
    const rect = slot.getBoundingClientRect();
    const dx = centerX - (rect.left + rect.width / 2);
    const dy = centerY - (rect.top + rect.height / 2);
    slot.style.transition = 'none';
    slot.style.transform = `translate(${dx}px, ${dy}px) scale(0.9)`;
    slot.style.opacity = '0';
    slot.style.zIndex = String(slots.length - idx);
    slot.style.willChange = 'transform, opacity';
  });

  // 2) DEAL out — each card fades in while flying to its slot, staggered (the spread). Tighter
  //    stagger on big boards so the 40-card Celtic spread still lands well under 2s.
  const stagger = slots.length > 18 ? Math.max(12, Math.floor(900 / slots.length)) : 60;
  const flight = 360;
  const total = flight + (slots.length - 1) * stagger + 140;

  requestAnimationFrame(() => {
    slots.forEach((slot, idx) => {
      window.setTimeout(() => {
        slot.style.transition = `transform ${flight}ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease-out`;
        slot.style.transform = 'translate(0, 0) scale(1)';
        slot.style.opacity = '1';
      }, idx * stagger);
    });
  });

  // GUARANTEED cleanup — scheduled OUTSIDE any rAF so cards ALWAYS end visible at their grid slot
  // even if a frame/timer is dropped (fixes the Celtic shuffle leaving the board blank).
  window.setTimeout(() => {
    slots.forEach((slot) => {
      slot.style.transition = '';
      slot.style.transform = '';
      slot.style.opacity = '';
      slot.style.zIndex = '';
      slot.style.willChange = '';
    });
    onDone?.();
  }, total);
}

function setupBoard(boardEl, boardSize, selectionGoal, onSelectionChange, { animated = false, animationProfile = 'default' } = {}) {
  let cards = [];
  let selected = [];
  let slots = [];

  const refreshBadges = () => {
    slots.forEach((slot) => {
      slot.classList.remove('is-selected');
      slot.querySelector('.selection-badge')?.remove();
    });
    selected.forEach((idx, order) => {
      const slot = slots[idx];
      if (!slot) return;
      slot.classList.add('is-selected');
      slot.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      const badge = document.createElement('span');
      badge.className = 'selection-badge';
      badge.textContent = `${order + 1}`;
      slot.appendChild(badge);
    });
    if (selectionGoal > 1 && selected.length >= selectionGoal) {
      slots.forEach((slot, idx) => {
        if (!selected.includes(idx)) slot.disabled = true;
      });
    } else {
      slots.forEach((slot) => {
        slot.disabled = false;
      });
    }
    boardEl.classList.toggle('has-selection', selected.length > 0);
    // is-complete = all required cards picked. The full board only dims the unpicked cards
    // once the selection is COMPLETE (not from the first pick) — see full.css.
    boardEl.classList.toggle('is-complete', selectionGoal > 1 && selected.length >= selectionGoal);
    onSelectionChange(selected.map((idx) => cards[idx]).filter(Boolean));
  };

  const ensureSlots = () => {
    if (slots.length === boardSize) return;
    slots = [];
    boardEl.textContent = '';
    for (let i = 0; i < boardSize; i += 1) {
      const slot = document.createElement('button');
      slot.type = 'button';
      slot.className = 'card-slot';
      const cardBack = Object.assign(document.createElement('img'), { className: 'card-back' });
      if (i === 0) {
        cardBack.fetchPriority = 'high';
        cardBack.loading = 'eager';
      }
      applyCardBackBackground(cardBack, { thumb: true });
      slot.appendChild(cardBack);
      slot.onclick = () => {
        // BUG-021 tail: ignore taps on slots with no card behind them yet.
        // On a cold/slow load the daily board renders once before card data
        // arrives (all slots is-hidden / cardless), then renderDaily runs a
        // second time with data and rebuilds the board from scratch. A tap in
        // that first window toggled is-selected on a cardless slot — visible
        // for a frame, contributing nothing real (cards[i] is undefined), then
        // silently discarded by the rebuild, so the tap "missed". Guarding on
        // cards[i] makes the early tap a clean no-op until the card is dealt.
        if (!cards[i]) return;
        if (selected.includes(i)) {
          selected = selected.filter((idx) => idx !== i);
        } else if (selectionGoal === 1) {
          selected = [i];
        } else if (selected.length < selectionGoal) {
          selected.push(i);
        }
        refreshBadges();
      };
      slots.push(slot);
      boardEl.appendChild(slot);
    }
  };

  const updateSlots = () => {
    slots.forEach((slot, idx) => {
      const card = cards[idx];
      slot.dataset.id = card?.id || '';
      slot.classList.toggle('is-hidden', !card);
    });
  };

  const performDeal = (withAnimation) => {
    ensureSlots();
    updateSlots();
    refreshBadges();
    if (withAnimation) {
      boardEl.classList.add('is-locked');
      const onDone = () => {
        boardEl.classList.remove('is-locked');
        refreshBadges();
      };
      // Full (Celtic) board uses its own DOM-based deal (robust against the closure/DOM slot
      // divergence that froze the 40-card shuffle). daily + question ('daily' profile) keep the
      // centre-spread animateDealStack (works for the 12-card boards, "spreads beautifully").
      if (animationProfile === 'full') {
        animateFullDeal(boardEl, onDone);
      } else if (animationProfile === 'daily') {
        animateDealStack(boardEl, slots, onDone);
      } else {
        animateDealSlots(boardEl, slots, onDone);
      }
    } else {
      animateBoard(boardEl);
    }
  };

  const render = ({ withAnimation = false } = {}) => {
    const previousSlots = withAnimation ? Array.from(boardEl.querySelectorAll('.card-slot')) : [];
    const proceed = () => {
      cards = getDrawableCards(boardSize);
      selected = [];
      performDeal(withAnimation);
    };

    if (withAnimation && previousSlots.length) {
      boardEl.classList.add('is-locked');
      if (animationProfile === 'full') {
        // Full board: quick in-place fade-out, then re-deal via animateFullDeal (grid fade/slide-in).
        // No centre collect — the 40-card gather is what kept stranding the deal. (2026-06-23)
        previousSlots.forEach((s) => { s.style.transition = 'opacity 0.14s ease'; s.style.opacity = '0'; });
        setTimeout(proceed, 150);
      } else {
        // daily + question: collect the spread to the centre (visible converge), then re-deal.
        animateCollectSlots(boardEl, previousSlots);
        setTimeout(proceed, STACK_DURATION);
      }
    } else {
      proceed();
    }
  };

  render({ withAnimation: animated });

  return {
    render: () => render({ withAnimation: true }),
    getSelectedCards: () => selected.map((idx) => cards[idx]).filter(Boolean),
  };
}

// Daily-board top-right streak chip. The markup ships a hardcoded "14"/"Day 14"
// placeholder; wire it to the real local streak (progress is tracked in localStorage
// for everyone, signed in or not). No-op on surfaces without the chip (e.g. /today/).
function renderStreakChip() {
  // Covers both the daily AND full/Celtic topbar chips (full's was hardcoded "Day 14").
  const chips = document.querySelectorAll('.daily-topbar__streak-chip, .full-topbar__streak-chip');
  if (!chips.length) return;
  const dict = translations[state.currentLang] || translations.en;
  const signedIn = Boolean(getCurrentUserSync());
  const streak = Math.max(0, Number(getUserProgress().streak_current) || 0);
  // Logged-in chip shows progress to the NEXT deck unlock (accumulated days) — the
  // reward goal — instead of a bare streak number. Full bar lives on Profile.
  const next = getNextStreakMilestone();

  ensureChipProgressStyles();

  chips.forEach((chip) => {
    const numEl = chip.querySelector('.daily-topbar__streak-num, .full-topbar__streak-num');
    const labelEl = chip.querySelector('.daily-topbar__streak-label, .full-topbar__streak-label');
    if (!numEl || !labelEl) return;

    // Bind a SINGLE click handler once and route by LIVE state at click time, so the
    // chip stays correct across a logged-out → signed-in re-render (binding per-state
    // would leave a stale "open sign-in gate" listener firing after the user logs in).
    if (!chip.dataset.chipBound) {
      chip.dataset.chipBound = '1';
      chip.setAttribute('role', 'button');
      chip.setAttribute('tabindex', '0');
      const onActivate = () => {
        if (!getCurrentUserSync()) {
          import('./sign-in-gate.js')
            .then(({ showSignInGate }) => showSignInGate({
              lang: state.currentLang,
              onSignIn: () => loginWithProvider('google').catch(() => {}),
            }))
            .catch(() => {});
          return;
        }
        const m = getNextStreakMilestone();
        if (m) showRewardPopup(m);
      };
      chip.addEventListener('click', onActivate);
      chip.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate(); }
      });
    }

    let bar = chip.querySelector('.mt-chip-bar');
    const dropBar = () => { if (bar) { bar.remove(); bar = null; } chip.classList.remove('mt-has-progress'); };

    if (!signedIn) {
      // Local streaks are fragile (cache-clear / no cross-device). Show the streak the
      // user has built AND nudge sign-in to save it — tap opens the sign-in gate.
      numEl.textContent = streak >= 1 ? String(streak) : '✦';
      labelEl.textContent = dict.dailyStreakSaveCta;
      chip.setAttribute('aria-label', dict.dailyStreakSaveCta);
      chip.classList.add('is-cta');
      dropBar();
      return;
    }

    // Signed in.
    chip.classList.remove('is-cta');
    if (next) {
      // Progress to the next deck unlock: big number = days remaining, plus a mini
      // progress bar. Tap opens the reward popup (next deck + full progress).
      numEl.textContent = String(next.remaining);
      labelEl.textContent = dict.deckUnlockProgress || 'to next deck';
      chip.setAttribute('aria-label', `${next.remaining} ${dict.deckUnlockProgress || 'to next deck'} (${next.current}/${next.target})`);
      if (!bar) {
        bar = document.createElement('span');
        bar.className = 'mt-chip-bar';
        bar.setAttribute('aria-hidden', 'true');
        const fill = document.createElement('span');
        fill.className = 'mt-chip-bar__fill';
        bar.appendChild(fill);
        chip.appendChild(bar);
      }
      chip.classList.add('mt-has-progress');
      const pct = Math.max(0, Math.min(100, Math.round((next.current / Math.max(1, next.target)) * 100)));
      bar.querySelector('.mt-chip-bar__fill').style.width = `${pct}%`;
    } else {
      // All decks unlocked — fall back to the streak.
      numEl.textContent = streak >= 1 ? String(streak) : '✦';
      labelEl.textContent = streak >= 1 ? dict.dailyStreakLabel : dict.dailyStreakStart;
      chip.setAttribute('aria-label', streak >= 1 ? `${streak} ${dict.dailyStreakLabel}` : dict.dailyStreakStart);
      dropBar();
    }
  });
}

// Reward popup — tapping the signed-in streak chip shows the next deck you'll
// unlock + how far along the streak you are. `next` = { target, current, remaining }.
let rewardPopupOpen = false;
function showRewardPopup(next) {
  if (rewardPopupOpen || !next) return;
  rewardPopupOpen = true;
  const dict = translations[state.currentLang] || translations.en;
  const th = state.currentLang === 'th';
  ensureChipProgressStyles();

  const deck = getAllDecks().find((d) => d.unlock_day === next.target);
  const deckName = deck ? (th ? (deck.name_th || deck.name) : deck.name) : '';
  const pct = Math.max(0, Math.min(100, Math.round((next.current / Math.max(1, next.target)) * 100)));

  const ov = document.createElement('div');
  ov.className = 'mt-reward-overlay';
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-modal', 'true');

  const card = document.createElement('div');
  card.className = 'mt-reward';

  const close = () => {
    rewardPopupOpen = false;
    ov.classList.remove('in');
    setTimeout(() => ov.remove(), 200);
  };

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'mt-reward__close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', close);
  card.appendChild(closeBtn);

  const title = document.createElement('h2');
  title.className = 'mt-reward__title';
  title.textContent = dict.rewardPopupTitle || 'Your next reward';
  card.appendChild(title);

  if (deck) {
    const img = document.createElement('img');
    img.className = 'mt-reward__img';
    img.loading = 'lazy';
    img.alt = '';
    img.src = String(deck.backImage || '').replace('00-back.webp', '00-back-200.webp');
    card.appendChild(img);

    const name = document.createElement('div');
    name.className = 'mt-reward__deck';
    name.textContent = deckName;
    card.appendChild(name);
  }

  const bar = document.createElement('div');
  bar.className = 'mt-reward__bar';
  const fill = document.createElement('div');
  fill.className = 'mt-reward__bar-fill';
  fill.style.width = `${pct}%`;
  bar.appendChild(fill);
  card.appendChild(bar);

  const dayline = document.createElement('div');
  dayline.className = 'mt-reward__days';
  dayline.textContent = th ? `วันที่ ${next.current} จาก ${next.target}` : `Day ${next.current} of ${next.target}`;
  card.appendChild(dayline);

  const remain = document.createElement('div');
  remain.className = 'mt-reward__remain';
  remain.innerHTML = `<b>${next.remaining}</b> ${dict.rewardDaysToGo || 'days to go'}`;
  card.appendChild(remain);

  const keep = document.createElement('p');
  keep.className = 'mt-reward__keep';
  keep.textContent = dict.rewardKeepGoing || '';
  card.appendChild(keep);

  ov.appendChild(card);
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
  });
  document.body.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('in'));
}

function ensureChipProgressStyles() {
  if (document.getElementById('mt-chip-progress-styles')) return;
  const s = document.createElement('style');
  s.id = 'mt-chip-progress-styles';
  s.textContent = `
    .daily-topbar__streak-chip,.full-topbar__streak-chip{position:relative;}
    .daily-topbar__streak-chip.mt-has-progress,.full-topbar__streak-chip.mt-has-progress{padding-bottom:9px;cursor:pointer;}
    .mt-chip-bar{position:absolute;left:8px;right:8px;bottom:3px;height:3px;border-radius:2px;background:rgba(61,26,92,.14);overflow:hidden;}
    .mt-chip-bar__fill{display:block;height:100%;border-radius:2px;background:linear-gradient(90deg,var(--mt-rose,#e89bc0),var(--mt-gold-deep,#c9933a));transition:width .45s ease;}
    .mt-reward-overlay{position:fixed;inset:0;z-index:1320;display:flex;align-items:center;justify-content:center;padding:22px;background:rgba(28,12,52,.5);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:0;transition:opacity .2s ease;}
    .mt-reward-overlay.in{opacity:1;}
    .mt-reward{position:relative;width:100%;max-width:320px;background:linear-gradient(180deg,#fbf6ff,#f3ecfc);border-radius:22px;padding:24px 22px 22px;text-align:center;box-shadow:0 18px 50px rgba(28,12,52,.35);transform:translateY(10px) scale(.98);transition:transform .22s ease;}
    .mt-reward-overlay.in .mt-reward{transform:none;}
    .mt-reward__close{position:absolute;top:12px;right:14px;width:30px;height:30px;border-radius:50%;border:none;background:rgba(61,26,92,.08);color:#3d1a5c;font-size:14px;line-height:1;cursor:pointer;}
    .mt-reward__title{margin:0 0 14px;font-family:'Playfair Display',serif;font-size:20px;color:#3d1a5c;}
    .mt-reward__img{width:96px;aspect-ratio:1568/2720;object-fit:cover;border-radius:11px;box-shadow:0 8px 20px -6px rgba(61,26,92,.55);margin:0 auto 10px;display:block;}
    .mt-reward__deck{font-family:'Playfair Display',serif;font-size:16px;font-weight:600;color:#3d1a5c;margin-bottom:14px;}
    .mt-reward__bar{height:8px;border-radius:6px;background:rgba(61,26,92,.12);overflow:hidden;margin:0 0 9px;}
    .mt-reward__bar-fill{height:100%;border-radius:6px;background:linear-gradient(90deg,var(--mt-rose,#e89bc0),var(--mt-gold-deep,#c9933a));transition:width .5s ease;}
    .mt-reward__days{font-size:12.5px;font-weight:600;color:#8b6db0;}
    .mt-reward__remain{margin-top:6px;font-size:13px;color:#3d1a5c;}
    .mt-reward__remain b{font-size:22px;font-family:'Playfair Display',serif;color:#c9933a;}
    .mt-reward__keep{margin:12px 0 0;font-size:12px;line-height:1.5;color:#8b6db0;}
  `;
  document.head.appendChild(s);
}

// Daily-board "From the deck" name. The markup hardcodes "Velvet Familiar"; wire it to
// the active deck (localized — deck names ARE translated, unlike card names) so it matches
// the board's card backs. No-op where the element is absent.
function renderDeckName() {
  // Covers both the daily AND full/Celtic topbars (both hardcoded "Velvet Familiar"
  // in markup — not a real deck). Wire to the active deck, localized.
  const nameEls = document.querySelectorAll('.daily-topbar__deck-name, .full-topbar__deck-name');
  if (!nameEls.length) return;
  const deck = getAllDecks().find((d) => d.id === getActiveDeckId());
  if (!deck) return;
  const name = state.currentLang === 'th' ? (deck.name_th || deck.name) : deck.name;
  nameEls.forEach((el) => { el.textContent = name; });
  wireDeckSwitcher();
}

// Re-point every rendered .card-back to the ACTIVE deck's back. Needed after a deck
// switch from the board picker — the slots were painted once at deal time, so without
// this they'd keep showing the old deck (the repaint requirement noted in CLAUDE.md).
function repaintCardBacks() {
  document.querySelectorAll('.card-back').forEach((el) => applyCardBackBackground(el, { thumb: true }));
}

// Make the board's "From the deck <name>" label a tappable deck switcher.
function wireDeckSwitcher() {
  document.querySelectorAll('.daily-topbar__deck, .full-topbar__deck').forEach((host) => {
    if (host.dataset.deckSwitch === '1') return;
    host.dataset.deckSwitch = '1';
    host.classList.add('mt-deck-switch');
    host.setAttribute('role', 'button');
    host.setAttribute('tabindex', '0');
    const dict = translations[state.currentLang] || translations.en;
    host.setAttribute('aria-label', dict.deckSwitchAria || 'Change deck');
    if (!host.querySelector('.mt-deck-switch__caret')) {
      const caret = document.createElement('span');
      caret.className = 'mt-deck-switch__caret';
      caret.setAttribute('aria-hidden', 'true');
      caret.textContent = '▾';
      host.appendChild(caret);
    }
    const open = () => {
      // Logged out you can only own the default deck, so the picker is a dead end — nudge
      // sign-in instead ("sign in to get new decks").
      if (!getCurrentUserSync()) {
        const d = translations[state.currentLang] || translations.en;
        import('./sign-in-gate.js')
          .then(({ showSignInGate }) => showSignInGate({
            lang: state.currentLang,
            title: d.deckGateTitle,
            body: d.deckGateBody,
            onSignIn: () => loginWithProvider('google').catch(() => {}),
          }))
          .catch(() => {});
        return;
      }
      showDeckPicker();
    };
    host.addEventListener('click', open);
    host.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
  });
}

let deckPickerOpen = false;
function showDeckPicker() {
  if (deckPickerOpen) return;
  deckPickerOpen = true;
  const dict = translations[state.currentLang] || translations.en;
  const th = state.currentLang === 'th';
  ensureDeckPickerStyles();

  const ov = document.createElement('div');
  ov.className = 'mt-deckpick-overlay';
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-modal', 'true');

  const card = document.createElement('div');
  card.className = 'mt-deckpick';

  const title = document.createElement('h2');
  title.className = 'mt-deckpick__title';
  title.textContent = dict.deckPickerTitle || 'Your deck';
  card.appendChild(title);

  const hint = document.createElement('p');
  hint.className = 'mt-deckpick__hint';
  hint.textContent = dict.deckPickerHint || '';
  card.appendChild(hint);

  const grid = document.createElement('div');
  grid.className = 'mt-deckpick__grid';
  const activeId = getActiveDeckId();

  const close = () => {
    deckPickerOpen = false;
    ov.classList.remove('in');
    setTimeout(() => ov.remove(), 200);
  };

  getDecksForDisplay().forEach((deck) => {
    const owned = canUnlockDeck(deck.id);
    const isActive = deck.id === activeId;
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'mt-deckpick__cell'
      + (isActive ? ' is-active' : '')
      + (owned ? '' : ' is-locked');
    const img = document.createElement('img');
    img.className = 'mt-deckpick__img';
    img.loading = 'lazy';
    img.alt = '';
    img.src = String(deck.backImage || '').replace('00-back.webp', '00-back-200.webp');
    cell.appendChild(img);
    if (isActive) {
      const activeBadge = document.createElement('span');
      activeBadge.className = 'mt-deckpick__active';
      activeBadge.textContent = th ? 'ใช้อยู่' : 'Active';
      cell.appendChild(activeBadge);
    }
    const label = document.createElement('span');
    label.className = 'mt-deckpick__name';
    label.textContent = th ? (deck.name_th || deck.name) : deck.name;
    cell.appendChild(label);
    if (!owned) {
      const lock = document.createElement('span');
      lock.className = 'mt-deckpick__lock';
      lock.setAttribute('aria-hidden', 'true');
      lock.textContent = '🔒';
      cell.appendChild(lock);
      cell.disabled = true;
    } else {
      cell.addEventListener('click', () => {
        try { setActiveDeck(deck.id); } catch (_) {}
        repaintCardBacks();
        renderDeckName();
        close();
      });
    }
    grid.appendChild(cell);
  });
  card.appendChild(grid);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'mt-deckpick__close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', close);
  card.appendChild(closeBtn);

  ov.appendChild(card);
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
  });
  document.body.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('in'));
}

function ensureDeckPickerStyles() {
  if (document.getElementById('mt-deckpick-styles')) return;
  const s = document.createElement('style');
  s.id = 'mt-deckpick-styles';
  s.textContent = `
    .mt-deck-switch{position:relative;cursor:pointer;}
    .mt-deck-switch__caret{margin-left:6px;font-size:11px;opacity:.7;vertical-align:middle;}
    .mt-deckpick-overlay{position:fixed;inset:0;z-index:1300;display:flex;align-items:flex-end;justify-content:center;padding:0;background:rgba(28,12,52,.45);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:0;transition:opacity .2s ease;}
    .mt-deckpick-overlay.in{opacity:1;}
    .mt-deckpick{position:relative;width:100%;max-width:520px;max-height:78vh;overflow-y:auto;background:linear-gradient(180deg,#fbf6ff,#f3ecfc);border-radius:22px 22px 0 0;padding:22px 18px calc(22px + env(safe-area-inset-bottom));box-shadow:0 -10px 40px rgba(28,12,52,.3);transform:translateY(16px);transition:transform .22s ease;}
    .mt-deckpick-overlay.in .mt-deckpick{transform:none;}
    .mt-deckpick__title{margin:0 0 2px;font-family:'Playfair Display',serif;font-size:22px;color:#3d1a5c;text-align:center;}
    .mt-deckpick__hint{margin:0 0 16px;font-size:12.5px;color:#8b6db0;text-align:center;}
    .mt-deckpick__grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px 10px;}
    .mt-deckpick__cell{position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;padding:6px;border:none;background:transparent;cursor:pointer;border-radius:12px;}
    .mt-deckpick__active{position:absolute;top:3px;left:50%;transform:translateX(-50%);z-index:2;background:#9270d0;color:#fff;font-size:8.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;padding:2px 6px;border-radius:5px;white-space:nowrap;}
    .mt-deckpick__cell .mt-deckpick__img{width:100%;max-width:88px;aspect-ratio:1568/2720;object-fit:cover;border-radius:9px;border:1.5px solid transparent;box-shadow:0 5px 12px -5px rgba(61,26,92,.5);transition:transform .15s ease,border-color .15s ease;}
    .mt-deckpick__cell.is-active .mt-deckpick__img{border-color:var(--mt-gold-deep,#c9933a);box-shadow:0 6px 16px -5px rgba(201,147,58,.6);}
    .mt-deckpick__cell:not(.is-locked):active .mt-deckpick__img{transform:scale(.95);}
    .mt-deckpick__name{font-size:11.5px;font-weight:600;color:#3d1a5c;text-align:center;line-height:1.2;}
    .mt-deckpick__cell.is-locked{position:relative;cursor:default;}
    .mt-deckpick__cell.is-locked .mt-deckpick__img{filter:grayscale(.85) brightness(.9);opacity:.6;}
    .mt-deckpick__cell.is-locked .mt-deckpick__name{opacity:.6;}
    .mt-deckpick__lock{position:absolute;top:6px;right:10px;font-size:15px;}
    .mt-deckpick__close{position:absolute;top:12px;right:14px;width:32px;height:32px;border-radius:50%;border:none;background:rgba(61,26,92,.08);color:#3d1a5c;font-size:15px;cursor:pointer;line-height:1;}
  `;
  document.head.appendChild(s);
}

function renderDaily() {
  // Phase 5 review pass: dealShuffleBtn (the "Draw card · เปิดไพ่" button on
  // the removed Before-Draw state) no longer exists on daily.html/th/daily.html.
  // We still look it up for /today/ and other legacy data-page='daily' surfaces
  // that may still ship a Deal button; the handler is gated below.
  const dealShuffleBtn = document.getElementById('daily-deal-shuffle');
  const board = document.getElementById('daily-board');
  const counter = document.getElementById('daily-counter');
  const continueBtn = document.getElementById('daily-continue');
  if (!board || !counter) return;

  renderStreakChip();
  renderDeckName();

  // Phase 5 mobile review fix: signal to CSS that the new daily-shell layout
  // is active. A real body class gives the cascade a hook every browser
  // honors (the :has(.daily-shell) approach in commit 1d3a81a was unreliable
  // for body-level overflow on mobile Safari — cards 7-12 stayed clipped
  // below the fold). /today/ and other legacy data-page='daily' surfaces
  // without .daily-shell don't carry this class, so their existing fixed-
  // height behavior is preserved.
  if (document.querySelector('.daily-shell')) {
    document.body.classList.add('daily-shell-active');
  }

  let selectedCards = [];
  const updateDailySelectionUi = (cards) => {
    selectedCards = cards;
    counter.textContent = `${cards.length}/${DAILY_SELECTION_MAX}`;
    if (continueBtn) {
      continueBtn.disabled = cards.length !== DAILY_SELECTION_MAX;
    }
  };

  const dailyBoard = setupBoard(
    board,
    DAILY_BOARD_COUNT,
    DAILY_SELECTION_MAX,
    updateDailySelectionUi,
    { animated: true, animationProfile: 'daily' }
  );

  counter.textContent = `0/${DAILY_SELECTION_MAX}`;
  if (continueBtn) {
    continueBtn.disabled = true;
  }

  // Phase 5 review: auto-deal on init. The ceremonial Before-Draw state was
  // removed; users land directly on the selection board, so we render the
  // 12 cards immediately instead of waiting for a Draw-button click.
  dailyBoard.render();
  updateDailySelectionUi([]);

  // Warm the full deck in the background while the user is choosing a card, so
  // the reading result page (which needs the heavy reading text from the full
  // cards.json) loads from cache instead of a cold ~1.15MB fetch after Continue.
  // The board itself only needs the tiny manifest, so this never blocks it
  // (BUG-021). Fire-and-forget, idle-scheduled.
  const prefetchFullDeck = () => { loadTarotData().catch(() => {}); };
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(prefetchFullDeck, { timeout: 2500 });
  } else {
    setTimeout(prefetchFullDeck, 1200);
  }

  // Legacy dealShuffleBtn handler — preserved for /today/ and other pre-
  // Phase-5 data-page='daily' surfaces that still ship a Deal/Shuffle
  // button. On daily.html / th/daily.html (Phase 5 markup) this button
  // is gone, so the block is a no-op.
  if (dealShuffleBtn) {
    if (!dealShuffleBtn.closest('.daily-shell')) {
      setRitualCtaLabel(dealShuffleBtn, true);
    }
    dealShuffleBtn.onclick = () => {
      dailyBoard.render();
      updateDailySelectionUi([]);
    };
  }

  const commitDailySelection = () => {
    const pickedCards = selectedCards.length ? selectedCards : dailyBoard.getSelectedCards();
    if (pickedCards.length !== DAILY_SELECTION_MAX) return;
    const selectedIds = pickedCards
      .map((card) => card?.id || card?.card_id)
      .filter(Boolean);
    if (selectedIds.length !== DAILY_SELECTION_MAX) return;

    saveSelectionAndGo({ mode: 'daily', spread: 'quick', topic: 'generic', cards: selectedIds });
  };

  if (continueBtn) {
    continueBtn.onclick = commitDailySelection;
  }

  // Phase 5: shuffle button above the board re-deals a fresh 12-card
  // spread and clears the current pick. dailyBoard.render() already
  // animates the deal and resets selection state; we just guard against
  // double-taps while the board is mid-animation and spin the icon
  // during the redraw.
  const shuffleBtn = document.getElementById('daily-shuffle');
  if (shuffleBtn) {
    // onclick (not addEventListener) so a re-bind replaces rather than stacks.
    shuffleBtn.onclick = () => {
      if (board.classList.contains('is-locked')) return;
      try { trackShuffleHit({ mode: 'daily', locale: state.currentLang, source: 'board' }); } catch (_) {}
      shuffleBtn.classList.add('is-spinning');
      if (navigator.vibrate) { try { navigator.vibrate(10); } catch (_) {} }
      dailyBoard.render();
      updateDailySelectionUi([]);
      window.setTimeout(() => shuffleBtn.classList.remove('is-spinning'), 1500);
    };
  }
}

if (typeof window !== 'undefined' && !window._meowContinueListenerBound) {
  window._meowContinueListenerBound = true;
  document.addEventListener('meow:request-continue', () => {
    const btn =
      document.getElementById('daily-continue') ||
      document.getElementById('question-continue') ||
      document.getElementById('overall-continue');
    if (btn && !btn.disabled) btn.click();
  });
}

// Celtic Cross: pick 10 from the FULL 78-card deck (was 12 → "pick 10 of 12" felt
// pointless). All slots show the same deck-back image, so 78 is cheap to render. B2-4.
const FULL_BOARD_COUNT = 40;
const FULL_SELECTION_MAX = 10;

function renderFullBoard() {
  // Phase 5 B1 rebuild: 12-card grid, pick 10 in order, no arrange step.
  // Positions get auto-assigned by pick order on the result page via
  // js/full-reading-position-order.js getFullReadingPositionMeta —
  // first picked card → present (The Situation), second → challenge
  // (What Crosses), … tenth → outcome. Drops the legacy ~540-line
  // renderOverall (deal-board with swap + arrange-list with tap-swap).
  const board = document.getElementById('full-board');
  const counter = document.getElementById('full-counter');
  const continueBtn = document.getElementById('full-continue');
  if (!board || !counter) return null;

  // Wire the Celtic topbar (deck name + chip) — both were hardcoded "Velvet
  // Familiar"/"Day 14" in full.html markup.
  renderStreakChip();
  renderDeckName();

  // Phase 5 mobile review pattern: same body class signal daily uses to
  // hand mobile Safari a viewport-sized scrollable shell instead of
  // letting cards 7-12 clip below the fold.
  if (document.querySelector('.full-shell')) {
    document.body.classList.add('full-shell-active');
  }

  let selectedCards = [];
  const updateFullSelectionUi = (cards) => {
    selectedCards = cards;
    counter.textContent = `${cards.length}/${FULL_SELECTION_MAX}`;
    if (continueBtn) {
      continueBtn.disabled = cards.length !== FULL_SELECTION_MAX;
    }
  };

  const fullBoard = setupBoard(
    board,
    FULL_BOARD_COUNT,
    FULL_SELECTION_MAX,
    updateFullSelectionUi,
    // 78-card board: 'full' profile = symmetric center-out reveal (rows in lockstep,
    // L/R mirrored) + a simple in-place fade collect on shuffle (no buggy fly-to-centre).
    { animated: false, animationProfile: 'full' }
  );

  counter.textContent = `0/${FULL_SELECTION_MAX}`;
  if (continueBtn) continueBtn.disabled = true;
  fullBoard.render();
  updateFullSelectionUi([]);

  const commitFullSelection = () => {
    const pickedCards = selectedCards.length ? selectedCards : fullBoard.getSelectedCards();
    if (pickedCards.length !== FULL_SELECTION_MAX) return;
    const selectedIds = pickedCards
      .map((card) => card?.id || card?.card_id)
      .filter(Boolean);
    if (selectedIds.length !== FULL_SELECTION_MAX) return;
    saveSelectionAndGo({ mode: 'full', spread: 'celtic', topic: 'generic', cards: selectedIds });
  };

  if (continueBtn) {
    continueBtn.onclick = commitFullSelection;
  }

  // Same shuffle pattern as the daily board: spin the icon, light haptic,
  // redeal a fresh 12-card spread, reset selection. Guarded against
  // double-taps via the is-locked class setupBoard adds during animation.
  const shuffleBtn = document.getElementById('full-shuffle');
  if (shuffleBtn) {
    shuffleBtn.addEventListener('click', () => {
      if (board.classList.contains('is-locked')) return;
      try { trackShuffleHit({ mode: 'full', locale: state.currentLang, source: 'board' }); } catch (_) {}
      shuffleBtn.classList.add('is-spinning');
      if (navigator.vibrate) { try { navigator.vibrate(10); } catch (_) {} }
      fullBoard.render();
      updateFullSelectionUi([]);
      window.setTimeout(() => shuffleBtn.classList.remove('is-spinning'), 1500);
    });
  }

  return null;
}

async function renderQuestion(dict = translations[state.currentLang] || translations.en) {
  const topicGrid = document.getElementById('question-topic-grid');
  const continueBtn = document.getElementById('question-continue');
  if (!topicGrid) return;
  const { getAskQuestionTopics } = await getQuestionTopicsModule();
  const topics = getAskQuestionTopics();

  // Phase 5 ask flow: explicit Continue tap. Topic-chip click selects only;
  // navigation happens on Continue. Bilingual chip rendering (EN + Thai title
  // visible on every chip) matches the design doc's chip pattern.
  let selectedTopic = state.questionTopic || '';

  const updateContinueState = () => {
    if (continueBtn) continueBtn.disabled = !selectedTopic;
  };

  const setActiveChip = (topicKey) => {
    selectedTopic = topicKey;
    state.questionTopic = topicKey;
    topicGrid.querySelectorAll('.question-topic-chip').forEach((chip) => {
      const isActive = chip.dataset.topic === topicKey;
      chip.classList.toggle('is-active', isActive);
      chip.setAttribute('aria-pressed', String(isActive));
    });
    updateContinueState();
  };

  const buildTopicChip = (topic) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'question-topic-chip';
    button.dataset.topic = topic.key;
    button.setAttribute('aria-pressed', 'false');

    const enTitle = (translations.en && translations.en[topic.titleKey]) || topic.key;
    const thTitle = (translations.th && translations.th[topic.titleKey]) || null;

    const enSpan = document.createElement('span');
    enSpan.className = 'question-topic-chip__en';
    enSpan.textContent = enTitle;
    button.appendChild(enSpan);

    if (thTitle && thTitle !== enTitle) {
      const thSpan = document.createElement('span');
      thSpan.className = 'question-topic-chip__th thai';
      thSpan.textContent = `· ${thTitle}`;
      button.appendChild(thSpan);
    }

    button.addEventListener('click', () => {
      trackTopicSelected({ locale: state.currentLang, mode: 'question', topic: topic.key });
      setActiveChip(topic.key);
    });

    return button;
  };

  topicGrid.innerHTML = '';
  topics.forEach((topic) => topicGrid.appendChild(buildTopicChip(topic)));

  if (selectedTopic) setActiveChip(selectedTopic);
  updateContinueState();

  if (continueBtn) {
    continueBtn.onclick = () => {
      if (!selectedTopic) return;
      const destination = localizePath('/question-draw.html', state.currentLang);
      const params = new URLSearchParams({ topic: selectedTopic, spread: questionSpread });
      window.location.href = `${destination}?${params.toString()}`;
    };
  }

  const spreadBtns = document.querySelectorAll('.question-spread-btn');
  spreadBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      questionSpread = btn.dataset.spread || 'story';
      try { trackSpreadSelected({ locale: state.currentLang, spread: questionSpread }); } catch (_) {}
      spreadBtns.forEach((b) => {
        const active = b === btn;
        b.classList.toggle('question-spread-btn--active', active);
        b.setAttribute('aria-pressed', String(active));
      });
    });
  });

  // Phase 5: live char counter on the question textarea. Updates the
  // `#question-text-counter` span as the user types; flips to
  // .is-near-limit (gold tint) when within 20 chars of the 180-char
  // maxlength to nudge the user before they're cut off.
  const questionInput = document.getElementById('question-text-input');
  const questionCounter = document.getElementById('question-text-counter');
  if (questionInput && questionCounter) {
    const max = Number(questionInput.getAttribute('maxlength')) || 180;
    const updateCounter = () => {
      const len = questionInput.value.length;
      questionCounter.textContent = `${len} / ${max}`;
      questionCounter.classList.toggle('is-near-limit', len >= max - 20);
    };
    questionInput.addEventListener('input', updateCounter);
    updateCounter();
  }
}

async function renderQuestionDraw(dict = translations[state.currentLang] || translations.en) {
  const board = document.getElementById('question-card-board');
  const shuffleBtn = document.getElementById('question-reset');
  const continueBtn = document.getElementById('question-continue');
  const counter = document.getElementById('question-counter');
  const selectedTopicTitle = document.getElementById('question-selected-topic-title');
  if (!board || !shuffleBtn || !continueBtn || !counter || !selectedTopicTitle) return;

  let latestSelection = [];
  const { getAskQuestionTopics } = await getQuestionTopicsModule();
  const topics = getAskQuestionTopics();
  const urlParams = new URLSearchParams(window.location.search);
  const queryTopic = urlParams.get('topic') || '';
  const isKnownTopic = topics.some((item) => item.key === queryTopic);
  state.questionTopic = isKnownTopic ? queryTopic : state.questionTopic;

  const querySpread = urlParams.get('spread') || 'story';
  const spread = QUESTION_SELECTION_COUNTS[querySpread] ? querySpread : 'story';
  const selectionCount = QUESTION_SELECTION_COUNTS[spread];

  // Phase 5 ask flow: CSS swaps title / legend / button-label off this attr.
  const drawShell = board.closest('.question-draw-shell');
  if (drawShell) drawShell.setAttribute('data-question-spread', spread);

  const selectedTopic = topics.find((item) => item.key === state.questionTopic);
  selectedTopicTitle.textContent = selectedTopic
    ? (dict[selectedTopic.titleKey] || selectedTopic.key)
    : (dict.topicGeneric || translations[state.currentLang]?.topicGeneric || 'Any question');

  const updateContinue = (cards) => {
    latestSelection = cards;
    continueBtn.disabled = cards.length !== selectionCount;
    counter.textContent = `${cards.length}/${selectionCount}`;
  };

  const boardApi = setupBoard(board, BOARD_CARD_COUNT, selectionCount, updateContinue, { animated: true, animationProfile: 'daily' });
  // Match the Daily board: animated initial deal, then a shuffle button above the
  // board that spins + light-haptics, re-deals a fresh spread and clears the pick.
  // Guarded against double-taps via the is-locked class setupBoard adds mid-animation.
  boardApi.render();
  updateContinue([]);
  shuffleBtn.onclick = () => {
    if (board.classList.contains('is-locked')) return;
    try { trackShuffleHit({ mode: 'question', locale: state.currentLang, source: 'board' }); } catch (_) {}
    shuffleBtn.classList.add('is-spinning');
    if (navigator.vibrate) { try { navigator.vibrate(10); } catch (_) {} }
    boardApi.render();
    updateContinue([]);
    window.setTimeout(() => shuffleBtn.classList.remove('is-spinning'), 1500);
  };
  continueBtn.onclick = () => {
    if (latestSelection.length !== selectionCount) return;
    saveSelectionAndGo({
      mode: 'question',
      spread,
      topic: state.questionTopic,
      cards: latestSelection.map((c) => c.id),
    });
  };
}

async function renderPage(dict) {
  const page = document.body.dataset.page;
  overallFlowCleanup?.();
  overallFlowCleanup = null;
  if (page === 'daily') renderDaily(dict);
  if (page === 'overall' || page === 'full') overallFlowCleanup = renderFullBoard() || null;
  if (page === 'question') await renderQuestion(dict);
  if (page === 'question-draw') await renderQuestionDraw(dict);
}

// Populate the homepage "Your decks" strip with real decks. The static markup
// was a redesign placeholder (gradient + "M" monogram, fake names); this renders
// each deck's actual back using the lightweight 00-back-200 thumbnail, with the
// deck's real EN/TH name and locked/active state. Display-only: each tile links
// to the decks page (profile.html), which owns the switch flow — so this avoids
// the deck-switch repaint requirement (see CLAUDE.md backlog).
function renderHomeDeckStrip() {
  const row = document.querySelector('.home-deck-strip__row');
  if (!row) return;
  const activeId = getActiveDeckId();
  const isThai = state.currentLang === 'th';
  const frag = document.createDocumentFragment();

  getDecksForDisplay().forEach((deck) => {
    const unlocked = canUnlockDeck(deck.id);
    const active = deck.id === activeId;

    const tile = document.createElement('a');
    tile.className = `home-deck-thumb${unlocked ? '' : ' is-locked'}${active ? ' is-active' : ''}`;
    tile.href = 'profile.html';
    tile.style.cssText = 'text-decoration: none; color: inherit;';
    tile.setAttribute('aria-label', deck.name || deck.id);

    const card = document.createElement('div');
    card.className = 'home-deck-thumb__card';

    const img = document.createElement('img');
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.style.cssText = 'position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0;';
    // 00-back-200 thumbnail (~12-20KB), graceful fallback to the full 00-back.
    const thumb = String(deck.backImage || '').replace('00-back.webp', '00-back-200.webp');
    applyImageFallback(img, thumb, [deck.backImage].filter(Boolean));
    card.appendChild(img);

    if (active) {
      const badge = document.createElement('span');
      badge.textContent = isThai ? 'ใช้อยู่' : 'Active';
      badge.style.cssText = 'position: absolute; top: 6px; left: 6px; z-index: 2; background: #9270d0; color: #fff; font-size: 9px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; padding: 2px 6px; border-radius: 6px;';
      card.appendChild(badge);
    }
    if (!unlocked) {
      const lock = document.createElement('span');
      lock.textContent = '🔒';
      lock.style.cssText = 'position: absolute; top: 6px; right: 6px; z-index: 2; font-size: 13px;';
      card.appendChild(lock);
    }
    tile.appendChild(card);

    const nameEn = document.createElement('div');
    nameEn.className = 'home-deck-thumb__name';
    nameEn.textContent = deck.name || '';
    tile.appendChild(nameEn);

    const nameTh = document.createElement('div');
    nameTh.className = 'home-deck-thumb__name-th';
    nameTh.textContent = deck.name_th || '';
    tile.appendChild(nameTh);

    frag.appendChild(tile);
  });

  row.replaceChildren(frag);
}

// Re-render the auth-dependent board UI once the session settles. Nothing else
// creates the Supabase client on the board/home pages, so getCurrentUserSync()
// stays null on load even for a logged-in user — which made the deck switcher
// show the sign-in gate and the streak chip show "Save your fortune" to people
// who were already signed in. We trigger getCurrentUser() (restores the session +
// creates the client, which fires onAuthStateChange) and re-render here.
function onAuthSettled() {
  renderStreakChip();
  renderDeckName();
  if (document.body.dataset.page === 'home') renderHomeDeckStrip();
}

function init() {
  const page = document.body.dataset.page;
  const navPage = page === 'question-draw' ? 'question' : page;
  initShell(state, (dict) => { void renderPage(dict); }, navPage);

  // Restore any saved Supabase session so getCurrentUserSync() is populated for
  // the deck switcher + streak chip. subscribeAuthState catches the async settle;
  // getCurrentUser() kicks off client creation (otherwise the listener never fires).
  subscribeAuthState(onAuthSettled);
  getCurrentUser().then(onAuthSettled).catch(() => {});

  if (page === 'home') {
    renderHomeDeckStrip();
    void renderPage(translations[state.currentLang] || translations.en);
    return;
  }

  loadTarotManifest()
    .then((cards) => {
      state.cards = cards;
      void renderPage(translations[state.currentLang] || translations.en);
    })
    .catch(() => {
      void renderPage(translations[state.currentLang] || translations.en);
    });
}

document.addEventListener('DOMContentLoaded', init);
