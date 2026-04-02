import { initShell, localizePath, translations } from './common.js';
import { getAskQuestionTopics } from './question-topics.js';
import {
  loadTarotManifest,
  getCardBackUrl,
  getCardBackFallbackUrl,
  getCardImageUrl,
  applyImageFallback,
  normalizeId,
} from './data.js';
import { applyTapSwap, buildNextDrawBoard } from './full-reading-flow.js';

const BOARD_CARD_COUNT = 12;
const DAILY_BOARD_COUNT = 6;
const CELTIC_CROSS_COUNT = 10;
const QUESTION_SELECTION_COUNT = 3;
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
const CARD_BACK_URL = getCardBackUrl();
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

const staticCardBacks = document.querySelectorAll('.card-back');

function applyCardBackBackground(el) {
  if (!el) return;
  if (el.tagName === 'IMG') {
    applyImageFallback(el, CARD_BACK_URL, [CARD_BACK_FALLBACK_URL]);
    el.loading = el.loading || 'eager';
    el.alt = '';
    return;
  }
  el.style.backgroundImage = `url('${CARD_BACK_URL}')`;
}

staticCardBacks.forEach(applyCardBackBackground);

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
  const params = new URLSearchParams({
    mode,
    spread,
    topic,
    ids: cards.join(','),
    cards: cards.join(','),
    lang: state.currentLang,
  });
  const destination = localizePath('/reading.html', state.currentLang);
  window.location.href = `${destination}?${params.toString()}`;
}

function formatCopy(template, values = {}) {
  return String(template || '').replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ''));
}

function createCardArt(card, className = '', { useBack = false, alt = '' } = {}) {
  const img = document.createElement('img');
  img.className = className;
  img.alt = alt;
  if (useBack) {
    applyCardBackBackground(img);
    return img;
  }
  applyImageFallback(img, getCardImageUrl(card), [CARD_BACK_URL, CARD_BACK_FALLBACK_URL]);
  return img;
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
    const spread = [
      { x: -1, y: 0.35, r: -5 },
      { x: 0, y: 0.6, r: 3 },
      { x: 1, y: 0.35, r: 5 },
      { x: -0.78, y: -0.28, r: -3 },
      { x: 0, y: -0.5, r: 0 },
      { x: 0.78, y: -0.28, r: 3 },
    ];
    slots.forEach((slot, idx) => {
      const vector = spread[idx] || { x: 0, y: 0, r: 0 };
      const x = Math.round(vector.x * spreadRange);
      const y = Math.round(vector.y * spreadRange);
      slot.style.transition = `transform 400ms ${SHUFFLE_EASE}`;
      slot.style.transform = `translate(${x}px, ${y}px) rotate(${vector.r}deg) scale(1.03)`;
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
      applyCardBackBackground(cardBack);
      slot.appendChild(cardBack);
      slot.onclick = () => {
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

function renderDaily() {
  const dealShuffleBtn = document.getElementById('daily-deal-shuffle');
  const board = document.getElementById('daily-board');
  const counter = document.getElementById('daily-counter');
  const continueBtn = document.getElementById('daily-continue');
  if (!dealShuffleBtn || !board || !continueBtn || !counter) return;

  let selectedCards = [];
  const updateDailySelectionUi = (cards) => {
    selectedCards = cards;
    counter.textContent = `${cards.length}/${DAILY_SELECTION_MAX}`;
    continueBtn.disabled = cards.length !== DAILY_SELECTION_MAX;
  };

  const dailyBoard = setupBoard(
    board,
    DAILY_BOARD_COUNT,
    DAILY_SELECTION_MAX,
    updateDailySelectionUi,
    { animated: true, animationProfile: 'daily' }
  );

  setRitualCtaLabel(dealShuffleBtn, true);
  counter.textContent = `0/${DAILY_SELECTION_MAX}`;
  continueBtn.disabled = true;

  dealShuffleBtn.onclick = () => {
    dailyBoard.render();
    updateDailySelectionUi([]);
  };

  continueBtn.onclick = () => {
    const pickedCards = selectedCards.length ? selectedCards : dailyBoard.getSelectedCards();
    if (pickedCards.length !== DAILY_SELECTION_MAX) return;
    const selectedIds = pickedCards
      .map((card) => card?.id || card?.card_id)
      .filter(Boolean);
    if (selectedIds.length !== DAILY_SELECTION_MAX) return;

    saveSelectionAndGo({ mode: 'daily', spread: 'quick', topic: 'generic', cards: selectedIds });
  };
}

function renderOverall() {
  const toolbar = document.getElementById('overall-toolbar');
  const shuffleBtn = document.getElementById('overall-shuffle');
  const counter = document.getElementById('overall-counter');
  const continueBtn = document.getElementById('overall-continue');
  const actions = document.getElementById('overall-actions');
  const stageEyebrow = document.getElementById('overall-stage-eyebrow');
  const stageTitle = document.getElementById('overall-stage-title');
  const stageDescription = document.getElementById('overall-stage-description');
  const dealOrbit = document.getElementById('overall-deal-orbit');
  const drawDeck = document.getElementById('overall-draw-deck');
  const drawSummary = document.getElementById('overall-draw-summary');
  const selectionShell = document.getElementById('overall-selection-shell');
  const dealStage = document.getElementById('overall-deal-stage');
  const arrangeStage = document.getElementById('overall-arrange-stage');
  const arrangeList = document.getElementById('overall-arrange-list');
  if (
    !toolbar
    || !shuffleBtn
    || !counter
    || !continueBtn
    || !actions
    || !stageEyebrow
    || !stageTitle
    || !stageDescription
    || !dealOrbit
    || !drawDeck
    || !drawSummary
    || !selectionShell
    || !dealStage
    || !arrangeStage
    || !arrangeList
  ) return;

  const dict = translations[state.currentLang] || translations.en;
  const DRAW_BOARD_SIZE = 10;
  let stage = 'deal';
  let pool = [];
  let drawBoardCards = [];
  let selectedCards = [];
  let selectedSwapIndex = -1;
  let dealTimer = null;
  let pickAnimationTimer = null;
  let activePickAnimationCleanup = null;
  let pickAnimationRunId = 0;
  let isDisposed = false;
  let isPickAnimating = false;
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  const clearDealTimer = () => {
    if (!dealTimer) return;
    window.clearTimeout(dealTimer);
    dealTimer = null;
  };

  const clearPickAnimation = ({ unlock = true } = {}) => {
    if (pickAnimationTimer) {
      window.clearTimeout(pickAnimationTimer);
      pickAnimationTimer = null;
    }
    if (typeof activePickAnimationCleanup === 'function') {
      activePickAnimationCleanup();
      activePickAnimationCleanup = null;
    }
    pickAnimationRunId += 1;
    if (unlock) isPickAnimating = false;
  };

  const isPoolReady = () => pool.length >= CELTIC_CROSS_COUNT;

  const buildDrawBoardCards = () => buildNextDrawBoard(pool, selectedCards, DRAW_BOARD_SIZE);

  const setStageCopy = (mode) => {
    if (mode === 'arrange') {
      const firstPosition = dict[CELTIC_CROSS_POSITIONS[0].labelKey] || CELTIC_CROSS_POSITIONS[0].key;
      const lastPosition = dict[CELTIC_CROSS_POSITIONS[CELTIC_CROSS_COUNT - 1].labelKey]
        || CELTIC_CROSS_POSITIONS[CELTIC_CROSS_COUNT - 1].key;
      stageEyebrow.textContent = dict.fullReadingStageArrangeEyebrow;
      stageTitle.textContent = dict.fullReadingStageArrangeTitle;
      stageDescription.textContent = formatCopy(dict.fullReadingStageArrangeBody, {
        firstPosition,
        lastPosition,
      });
      return;
    }

    if (mode === 'draw') {
      const current = Math.min(selectedCards.length + 1, CELTIC_CROSS_COUNT);
      const nextLabelKey = CELTIC_CROSS_POSITIONS[Math.min(selectedCards.length, CELTIC_CROSS_COUNT - 1)]?.labelKey;
      stageEyebrow.textContent = dict.fullReadingStageDrawEyebrow;
      stageTitle.textContent = formatCopy(dict.fullReadingStageDrawTitle, { current, total: CELTIC_CROSS_COUNT });
      stageDescription.textContent = formatCopy(dict.fullReadingStageDrawBody, {
        position: dict[nextLabelKey] || '',
      });
      return;
    }

    stageEyebrow.textContent = dict.fullReadingStageDealEyebrow;
    stageTitle.textContent = dict.fullReadingStageDealTitle;
    stageDescription.textContent = dict.fullReadingStageDealBody;
  };

  const updateCounter = () => {
    counter.textContent = `${selectedCards.length}/${CELTIC_CROSS_COUNT}`;
  };

  const updateContinue = () => {
    continueBtn.disabled = stage !== 'arrange' || selectedCards.length !== CELTIC_CROSS_COUNT;
  };

  const renderDealOrbit = () => {
    dealOrbit.innerHTML = '';
    if (stage !== 'draw') return;
    const board = document.createElement('div');
    board.className = 'full-draw-board';
    drawBoardCards.forEach((_, idx) => {
      const slot = document.createElement('button');
      slot.type = 'button';
      slot.className = 'full-draw-board__slot';
      slot.dataset.drawBoardIndex = String(idx);
      slot.setAttribute('aria-label', formatCopy(dict.fullReadingDrawCardLabel, { index: idx + 1 }));
      slot.appendChild(createCardArt(null, 'full-draw-board__img', { useBack: true }));
      slot.onclick = () => {
        const picked = drawBoardCards[idx];
        if (!picked || stage !== 'draw' || isPickAnimating) return;

        isPickAnimating = true;
        board.classList.add('is-picking');

        const commitPick = () => {
          if (isDisposed || stage !== 'draw') {
            isPickAnimating = false;
            return;
          }
          selectedCards = [...selectedCards, picked];
          drawBoardCards = buildDrawBoardCards();
          isPickAnimating = false;

          if (selectedCards.length >= CELTIC_CROSS_COUNT) {
            goToArrangeStage();
            return;
          }
          syncUi();
        };

        const targetIndex = selectedCards.length;
        runPickAnimation({ board, slot, slotIndex: idx, targetIndex, onDone: commitPick });
      };
      board.appendChild(slot);
    });
    dealOrbit.appendChild(board);
  };

  const runPickAnimation = ({
    board, slot, slotIndex, targetIndex, onDone,
  }) => {
    clearPickAnimation({ unlock: false });
    const runId = pickAnimationRunId;
    const targetSlot = drawSummary.querySelector(`[data-draw-target-index="${targetIndex}"]`);
    const finalize = () => {
      if (runId !== pickAnimationRunId) return;
      pickAnimationTimer = null;
      activePickAnimationCleanup = null;
      board.classList.remove('is-picking');
      board.classList.remove('is-clearing-spread');
      board.classList.remove('is-redealing-spread');
      slot.classList.remove('is-picked-confirm');
      if (isDisposed || stage !== 'draw') {
        isPickAnimating = false;
        return;
      }
      onDone?.();
    };

    if (!board?.isConnected || !slot?.isConnected) {
      pickAnimationTimer = window.setTimeout(finalize, 0);
      return;
    }
    const slots = Array.from(board.querySelectorAll('.full-draw-board__slot'));

    const reducedMotion = reducedMotionQuery.matches;
    const clearDuration = reducedMotion ? FULL_PICK_REDUCED_CLEAR_DURATION : FULL_PICK_CLEAR_DURATION;
    const redealDuration = reducedMotion ? FULL_PICK_REDUCED_REDEAL_DURATION : FULL_PICK_REDEAL_ONLY_DURATION;
    const confirmDuration = reducedMotion ? FULL_PICK_REDUCED_CONFIRM_DURATION : FULL_PICK_CONFIRM_DURATION;

    const slotCount = Math.max(slots.length, 1);
    const perSlotDelay = slotCount > 1 ? redealDuration / (slotCount - 1) : 0;
    const columns = 5;
    const selectedCol = slotIndex % columns;
    const selectedRow = Math.floor(slotIndex / columns);

    slots.forEach((candidate, index) => {
      const clearDelay = Math.abs(slotIndex - index) * (reducedMotion ? 6 : 10);
      const col = index % columns;
      const row = Math.floor(index / columns);
      const driftX = (col - selectedCol) * (reducedMotion ? 4 : 10);
      const driftY = (row - selectedRow) * (reducedMotion ? 2 : 8) + (reducedMotion ? 8 : 18);
      candidate.style.setProperty('--clear-delay', `${Math.round(clearDelay)}ms`);
      candidate.style.setProperty('--clear-shift-x', `${Math.round(driftX)}px`);
      candidate.style.setProperty('--clear-shift-y', `${Math.round(driftY)}px`);
      candidate.style.setProperty('--redeal-delay', `${Math.round(index * perSlotDelay)}ms`);
      candidate.style.setProperty('--redeal-duration', `${Math.round(Math.max(130, redealDuration * 0.34))}ms`);
      candidate.style.setProperty('--redeal-lift', `${Math.round(reducedMotion ? 6 : 16 + ((row % 2) * 3))}px`);
    });

    activePickAnimationCleanup = () => {
      board.classList.remove('is-clearing-spread');
      board.classList.remove('is-redealing-spread');
      board.classList.remove('is-picking');
      slot.classList.remove('is-picked-confirm');
      if (targetSlot) targetSlot.classList.remove('is-awaiting-card');
      slots.forEach((candidate) => {
        candidate.style.removeProperty('--clear-delay');
        candidate.style.removeProperty('--clear-shift-x');
        candidate.style.removeProperty('--clear-shift-y');
        candidate.style.removeProperty('--redeal-delay');
        candidate.style.removeProperty('--redeal-duration');
        candidate.style.removeProperty('--redeal-lift');
      });
    };

    slot.classList.add('is-picked-confirm');

    pickAnimationTimer = window.setTimeout(() => {
      if (runId !== pickAnimationRunId) return;
      slot.classList.remove('is-picked-confirm');
      board.classList.add('is-clearing-spread');
      if (targetSlot) targetSlot.classList.add('is-awaiting-card');

      pickAnimationTimer = window.setTimeout(() => {
        if (runId !== pickAnimationRunId) return;
        board.classList.remove('is-clearing-spread');
        board.classList.add('is-redealing-spread');

        pickAnimationTimer = window.setTimeout(() => {
          if (runId !== pickAnimationRunId) return;
          board.classList.remove('is-redealing-spread');
          if (targetSlot) targetSlot.classList.remove('is-awaiting-card');
          finalize();
        }, redealDuration);
      }, clearDuration);
    }, confirmDuration);
  };

  const renderDrawSummary = () => {
    drawSummary.hidden = false;
    drawSummary.innerHTML = '';
    const note = document.createElement('p');
    note.className = 'full-draw-summary__note';
    note.textContent = formatCopy(dict.fullReadingDrawnCount, {
      current: selectedCards.length,
      total: CELTIC_CROSS_COUNT,
    });
    drawSummary.appendChild(note);

    const preview = document.createElement('div');
    preview.className = 'full-celtic-preview';
    preview.setAttribute('aria-hidden', 'true');
    CELTIC_CROSS_POSITIONS.forEach((position, idx) => {
      const slot = document.createElement('div');
      slot.className = `full-celtic-preview__slot full-celtic-preview__slot--${position.key}`;
      slot.dataset.drawTargetIndex = String(idx);
      if (idx < selectedCards.length) slot.classList.add('is-filled');
      if (idx === selectedCards.length && selectedCards.length < CELTIC_CROSS_COUNT) slot.classList.add('is-next');
      const order = document.createElement('span');
      order.className = 'full-celtic-preview__order';
      order.textContent = String(idx + 1);
      slot.appendChild(order);
      preview.appendChild(slot);
    });
    drawSummary.appendChild(preview);
  };

  const captureArrangeRects = () => {
    const rects = new Map();
    arrangeList.querySelectorAll('.full-arrange-item').forEach((item) => {
      const cardId = item.dataset.cardId;
      if (!cardId) return;
      rects.set(cardId, item.getBoundingClientRect());
    });
    return rects;
  };

  const animateArrangeListSwap = (previousRects) => {
    const items = arrangeList.querySelectorAll('.full-arrange-item');
    items.forEach((item) => {
      const cardId = item.dataset.cardId;
      if (!cardId) return;
      const previousRect = previousRects.get(cardId);
      if (!previousRect) return;
      const nextRect = item.getBoundingClientRect();
      const deltaX = previousRect.left - nextRect.left;
      const deltaY = previousRect.top - nextRect.top;
      if (!deltaX && !deltaY) return;

      if (typeof item.animate === 'function') {
        item.animate(
          [
            { transform: `translate(${deltaX}px, ${deltaY}px)` },
            { transform: 'translate(0, 0)' },
          ],
          {
            duration: 320,
            easing: 'cubic-bezier(0.22, 0.68, 0.2, 1)',
          },
        );
        return;
      }

      item.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
      window.requestAnimationFrame(() => {
        item.style.transition = 'transform 320ms cubic-bezier(0.22, 0.68, 0.2, 1)';
        item.style.transform = 'translate(0, 0)';
        window.setTimeout(() => {
          item.style.transition = '';
          item.style.transform = '';
        }, 320);
      });
    });
  };

  const rerenderArrangeList = (activeIndex = -1, { previousRects = null, animateSwap = false } = {}) => {
    arrangeList.innerHTML = '';

    selectedCards.forEach((card, idx) => {
      const item = document.createElement('article');
      item.className = 'full-arrange-item';
      item.dataset.index = String(idx);
      item.dataset.cardId = String(card?.id || card?.card_id || '');
      item.setAttribute('role', 'listitem');
      if (idx === activeIndex) item.classList.add('is-dragging');

      const order = document.createElement('div');
      order.className = 'full-arrange-item__order';
      order.innerHTML = `
        <span class="full-arrange-item__order-index">${idx + 1}</span>
        <span class="full-arrange-item__order-label">${formatCopy(dict.fullReadingPositionPrefix, { index: idx + 1 })}</span>
      `;
      item.appendChild(order);

      item.appendChild(createCardArt(null, 'full-arrange-item__img', { useBack: true }));

      const meta = document.createElement('div');
      meta.className = 'full-arrange-item__meta';

      const position = document.createElement('p');
      position.className = 'full-arrange-item__position';
      position.textContent = dict[CELTIC_CROSS_POSITIONS[idx]?.labelKey] || '';
      meta.appendChild(position);

      const name = document.createElement('h3');
      name.className = 'full-arrange-item__name';
      name.textContent = dict.fullReadingFaceDownCard;
      meta.appendChild(name);
      item.appendChild(meta);
      item.tabIndex = 0;
      item.setAttribute('aria-label', formatCopy(dict.fullReadingSwapCardLabel, { index: idx + 1 }));
      item.onclick = () => {
        const previousRects = captureArrangeRects();
        const next = applyTapSwap(selectedCards, selectedSwapIndex, idx);
        selectedCards = next.cards;
        selectedSwapIndex = next.selectedIndex;
        rerenderArrangeList(selectedSwapIndex, { previousRects, animateSwap: next.swapped });
      };
      item.onkeydown = (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          item.click();
        }
      };
      arrangeList.appendChild(item);
    });

    updateContinue();
    if (animateSwap && previousRects?.size) {
      window.requestAnimationFrame(() => animateArrangeListSwap(previousRects));
    }
  };

  const syncUi = () => {
    setStageCopy(stage);
    updateCounter();
    updateContinue();
    drawDeck.disabled = true;
    dealStage.hidden = stage === 'arrange';
    dealOrbit.hidden = stage !== 'draw';
    arrangeStage.hidden = stage !== 'arrange';
    renderDealOrbit();
    renderDrawSummary();
    if (stage === 'arrange') rerenderArrangeList(selectedSwapIndex);
  };

  const goToArrangeStage = () => {
    clearPickAnimation();
    stage = 'arrange';
    syncUi();
  };

  const resetFullFlow = () => {
    clearDealTimer();
    clearPickAnimation();
    isPickAnimating = false;
    stage = 'deal';
    pool = getDrawableCards(FULL_POOL_SIZE);
    drawBoardCards = [];
    selectedCards = [];
    selectedSwapIndex = -1;
    syncUi();
    if (!isPoolReady()) return;
    dealTimer = window.setTimeout(() => {
      if (isDisposed) return;
      stage = 'draw';
      drawBoardCards = buildDrawBoardCards();
      syncUi();
    }, FULL_DEAL_ANIMATION_DURATION);
  };

  toolbar.hidden = false;
  actions.hidden = false;
  continueBtn.disabled = true;
  shuffleBtn.onclick = () => resetFullFlow();
  drawDeck.onclick = null;
  continueBtn.onclick = () => {
    if (selectedCards.length !== CELTIC_CROSS_COUNT) return;
    saveSelectionAndGo({
      mode: 'full',
      spread: 'story',
      topic: 'generic',
      cards: selectedCards.map((card) => card.id),
    });
  };

  resetFullFlow();

  return () => {
    if (isDisposed) return;
    isDisposed = true;
    clearDealTimer();
    clearPickAnimation();
    shuffleBtn.onclick = null;
    drawDeck.onclick = null;
    continueBtn.onclick = null;
  };
}

function renderQuestion(dict = translations[state.currentLang] || translations.en) {
  const topicGrid = document.getElementById('question-topic-grid');
  if (!topicGrid) return;
  const topics = getAskQuestionTopics();

  const buildTopicCard = (topic) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'topic-card';
    button.dataset.topic = topic.key;

    const icon = document.createElement('span');
    icon.className = 'topic-card__icon';
    icon.textContent = topic.icon;
    button.appendChild(icon);

    const title = document.createElement('span');
    title.className = 'topic-card__title';
    title.textContent = dict[topic.titleKey] || topic.key;
    button.appendChild(title);

    const body = document.createElement('span');
    body.className = 'topic-card__body';
    body.textContent = dict[topic.descriptionKey] || '';
    button.appendChild(body);

    button.addEventListener('click', () => {
      state.questionTopic = topic.key;
      const destination = localizePath('/question-draw.html', state.currentLang);
      const params = new URLSearchParams({ topic: topic.key });
      window.location.href = `${destination}?${params.toString()}`;
    });

    return button;
  };

  topicGrid.innerHTML = '';
  topics.forEach((topic) => topicGrid.appendChild(buildTopicCard(topic)));
}

function renderQuestionDraw(dict = translations[state.currentLang] || translations.en) {
  const board = document.getElementById('question-card-board');
  const shuffleBtn = document.getElementById('question-reset');
  const continueBtn = document.getElementById('question-continue');
  const counter = document.getElementById('question-counter');
  const selectedTopicTitle = document.getElementById('question-selected-topic-title');
  if (!board || !shuffleBtn || !continueBtn || !counter || !selectedTopicTitle) return;

  let latestSelection = [];
  const topics = getAskQuestionTopics();
  const queryTopic = new URLSearchParams(window.location.search).get('topic') || '';
  const isKnownTopic = topics.some((item) => item.key === queryTopic);
  state.questionTopic = isKnownTopic ? queryTopic : state.questionTopic;

  const selectedTopic = topics.find((item) => item.key === state.questionTopic);
  selectedTopicTitle.textContent = selectedTopic
    ? (dict[selectedTopic.titleKey] || selectedTopic.key)
    : (dict.topicGeneric || translations[state.currentLang]?.topicGeneric || 'Any question');

  const updateContinue = (cards) => {
    latestSelection = cards;
    continueBtn.disabled = cards.length !== QUESTION_SELECTION_COUNT;
    counter.textContent = `${cards.length}/${QUESTION_SELECTION_COUNT}`;
  };

  const boardApi = setupBoard(board, BOARD_CARD_COUNT, QUESTION_SELECTION_COUNT, updateContinue);
  shuffleBtn.onclick = () => boardApi.render();
  continueBtn.onclick = () => {
    if (latestSelection.length !== QUESTION_SELECTION_COUNT) return;
    saveSelectionAndGo({
      mode: 'question',
      spread: 'story',
      topic: state.questionTopic,
      cards: latestSelection.map((c) => c.id),
    });
  };
}

function renderPage(dict) {
  const page = document.body.dataset.page;
  overallFlowCleanup?.();
  overallFlowCleanup = null;
  if (page === 'daily') renderDaily(dict);
  if (page === 'overall' || page === 'full') overallFlowCleanup = renderOverall(dict) || null;
  if (page === 'question') renderQuestion(dict);
  if (page === 'question-draw') renderQuestionDraw(dict);
}

function init() {
  const page = document.body.dataset.page;
  const navPage = page === 'question-draw' ? 'question' : page;
  initShell(state, (dict) => renderPage(dict), navPage);

  if (page === 'home') {
    renderPage(translations[state.currentLang] || translations.en);
    return;
  }

  loadTarotManifest()
    .then((cards) => {
      state.cards = cards;
      renderPage(translations[state.currentLang] || translations.en);
    })
    .catch(() => {
      renderPage(translations[state.currentLang] || translations.en);
    });
}

document.addEventListener('DOMContentLoaded', init);
