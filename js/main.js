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
  getActiveDeckId,
  canUnlockDeck,
} from './data.js';
import { serializeReadingStateToUrl } from './reading-url.js';
import { trackTopicSelected } from './analytics.js';
import { getUserProgress } from './progress.js';

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

  requestAnimationFrame(() => {
    slots.forEach((slot, idx) => {
      slot.classList.add('card-visible');
      slot.style.transition = 'transform 0.35s ease, opacity 0.35s ease';
      setTimeout(() => {
        slot.style.opacity = '1';
        slot.style.transform = 'translate(0, 0) scale(1)';
      }, idx * DEAL_STAGGER);
    });

    const total = 350 + slots.length * DEAL_STAGGER + 120;
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
      requestAnimationFrame(() => {
        const animate = animationProfile === 'daily' ? animateDailyShuffleSlots : animateDealSlots;
        animate(boardEl, slots, () => {
          boardEl.classList.remove('is-locked');
          refreshBadges();
        });
      });
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
      animateCollectSlots(boardEl, previousSlots);
      setTimeout(proceed, STACK_DURATION);
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
  const chip = document.querySelector('.daily-topbar__streak-chip');
  if (!chip) return;
  const numEl = chip.querySelector('.daily-topbar__streak-num');
  const labelEl = chip.querySelector('.daily-topbar__streak-label');
  if (!numEl || !labelEl) return;
  const dict = translations[state.currentLang] || translations.en;
  const streak = Math.max(0, Number(getUserProgress().streak_current) || 0);
  if (streak >= 1) {
    numEl.textContent = String(streak);
    labelEl.textContent = dict.dailyStreakLabel;
    chip.setAttribute('aria-label', `${streak} ${dict.dailyStreakLabel}`);
  } else {
    // No streak yet — gentle prompt instead of a sad "0".
    numEl.textContent = '✦';
    labelEl.textContent = dict.dailyStreakStart;
    chip.setAttribute('aria-label', dict.dailyStreakStart);
  }
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

const FULL_BOARD_COUNT = 12;
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
    { animated: true, animationProfile: 'daily' }
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

  const boardApi = setupBoard(board, BOARD_CARD_COUNT, selectionCount, updateContinue);
  shuffleBtn.onclick = () => boardApi.render();
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

  getAllDecks().forEach((deck) => {
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

function init() {
  const page = document.body.dataset.page;
  const navPage = page === 'question-draw' ? 'question' : page;
  initShell(state, (dict) => { void renderPage(dict); }, navPage);

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
