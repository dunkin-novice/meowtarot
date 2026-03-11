import { initShell, localizePath, translations } from './common.js';
import {
  loadTarotManifest,
  getCardBackUrl,
  getCardBackFallbackUrl,
  applyImageFallback,
  normalizeId,
} from './data.js';

const BOARD_CARD_COUNT = 12;
const DAILY_BOARD_COUNT = 6;
const OVERALL_SELECTION_COUNT = 3;
const QUESTION_SELECTION_COUNT = 1;
const ORIENTATION_REVERSED_PROBABILITY = 0.5;
const STORAGE_KEY = 'meowtarot_selection';
const DAILY_SELECTION_MAX = 1;
const DEAL_STAGGER = 160;
const STACK_DURATION = 520;
const CARD_BACK_URL = getCardBackUrl();
const CARD_BACK_FALLBACK_URL = getCardBackFallbackUrl();

const state = {
  currentLang: 'en',
  cards: [],
  questionTopic: 'love',
};

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
    cards: cards.join(','),
    lang: state.currentLang,
  });
  const destination = localizePath('/reading.html', state.currentLang);
  window.location.href = `${destination}?${params.toString()}`;
}

function animateBoard(boardEl) {
  const slots = boardEl.querySelectorAll('.card-slot');
  requestAnimationFrame(() => {
    slots.forEach((slot, idx) => {
      setTimeout(() => {
        slot.classList.add('card-visible');
      }, 60 * idx);
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

function setupBoard(boardEl, boardSize, selectionGoal, onSelectionChange, { animated = false } = {}) {
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
        animateDealSlots(boardEl, slots, () => {
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
    { animated: true }
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
  const flow = document.getElementById('overall-flow');
  const entry = document.getElementById('overall-entry');
  const heroDeck = document.getElementById('overall-hero-deck');
  const centerDeck = document.getElementById('overall-center-deck');
  const animationLayer = document.getElementById('overall-animation-layer');
  const dealBtn = document.getElementById('overall-deal');
  const shuffleBtn = document.getElementById('overall-shuffle');
  const board = document.getElementById('overall-card-board');
  const actions = document.getElementById('overall-actions');
  const toolbar = document.getElementById('overall-toolbar');
  const counter = document.getElementById('overall-counter');
  const continueBtn = document.getElementById('overall-continue');
  if (!flow || !entry || !heroDeck || !centerDeck || !animationLayer || !dealBtn || !shuffleBtn || !board || !actions || !continueBtn || !toolbar || !counter) return;

  const FULL_TIMING = {
    dealStagger: 30,
    dealDuration: 220,
    collectStagger: 18,
    collectDuration: 180,
    badgeClearDuration: 140,
  };

  const MOTION_PHASES = new Set(['dealing', 'shufflingCollect', 'shufflingRedeal']);

  const isThai = state.currentLang === 'th';
  dealBtn.textContent = isThai ? 'แจกไพ่' : 'Deal';
  shuffleBtn.textContent = isThai ? 'สับไพ่' : 'Shuffle';
  flow.querySelectorAll('.deck-stack-card').forEach(applyCardBackBackground);

  let fullPhase = 'preDeal';
  let selectedSlotIndices = [];
  let slots = [];
  let boardCards = [];
  let isFullAnimating = false;

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const getSelectedCards = () => selectedSlotIndices.map((idx) => boardCards[idx]).filter(Boolean);

  const ensureFullBoardSlots = () => {
    if (slots.length === BOARD_CARD_COUNT) return;
    slots = [];
    board.textContent = '';
    for (let i = 0; i < BOARD_CARD_COUNT; i += 1) {
      const slot = document.createElement('button');
      slot.type = 'button';
      slot.className = 'card-slot card-visible';
      slot.dataset.slotIndex = `${i}`;
      const cardBack = Object.assign(document.createElement('img'), { className: 'card-back' });
      applyCardBackBackground(cardBack);
      slot.appendChild(cardBack);
      slot.onclick = () => {
        if (fullPhase !== 'dealt' || isFullAnimating) return;
        if (selectedSlotIndices.includes(i)) {
          selectedSlotIndices = selectedSlotIndices.filter((idx) => idx !== i);
        } else if (selectedSlotIndices.length < OVERALL_SELECTION_COUNT) {
          selectedSlotIndices.push(i);
        }
        renderFullSelection();
      };
      slots.push(slot);
      board.appendChild(slot);
    }
  };

  const hydrateBoardSlots = () => {
    slots.forEach((slot, idx) => {
      const card = boardCards[idx];
      slot.dataset.id = card?.id || '';
      slot.classList.toggle('is-hidden', !card);
      slot.classList.toggle('card-visible', !!card);
    });
  };

  const restoreStableBoardSurface = () => {
    ensureFullBoardSlots();
    hydrateBoardSlots();
    board.hidden = false;
    board.classList.remove('is-hidden', 'is-phase-placeholder');
    board.style.visibility = '';
    board.style.pointerEvents = '';
  };

  const renderFullSelection = () => {
    slots.forEach((slot) => {
      slot.classList.remove('is-selected', 'is-clearing');
      slot.querySelector('.selection-badge')?.remove();
      slot.disabled = fullPhase !== 'dealt' || isFullAnimating;
    });

    selectedSlotIndices.forEach((slotIndex, order) => {
      const slot = slots[slotIndex];
      if (!slot) return;
      slot.classList.add('is-selected');
      const badge = document.createElement('span');
      badge.className = 'selection-badge';
      badge.textContent = `${order + 1}`;
      slot.appendChild(badge);
    });

    if (selectedSlotIndices.length >= OVERALL_SELECTION_COUNT) {
      slots.forEach((slot, idx) => {
        if (!selectedSlotIndices.includes(idx)) slot.disabled = true;
      });
    }

    const selectedCount = getSelectedCards().length;
    counter.textContent = `${selectedCount}/${OVERALL_SELECTION_COUNT}`;
    continueBtn.disabled = fullPhase !== 'dealt' || isFullAnimating || selectedCount !== OVERALL_SELECTION_COUNT;
  };

  const applyDisabledState = (el, isDisabled) => {
    el.disabled = !!isDisabled;
    el.classList.toggle('is-disabled', !!isDisabled);
  };

  let renderFullPhase = () => {};

  const lockFullInteraction = () => {
    isFullAnimating = true;
    flow.classList.add('is-animating');
    renderFullSelection();
    renderFullPhase();
  };

  const unlockFullInteraction = () => {
    isFullAnimating = false;
    flow.classList.remove('is-animating');
    renderFullSelection();
    renderFullPhase();
  };

  const toLocalRect = (rect) => {
    const flowRect = flow.getBoundingClientRect();
    return {
      left: rect.left - flowRect.left,
      top: rect.top - flowRect.top,
      width: rect.width,
      height: rect.height,
      centerX: rect.left - flowRect.left + rect.width / 2,
      centerY: rect.top - flowRect.top + rect.height / 2,
    };
  };

  const ensureFullAnimationLayer = () => {
    animationLayer.hidden = false;
    animationLayer.textContent = '';
  };

  const clearOverlayCards = () => {
    animationLayer.textContent = '';
    animationLayer.hidden = true;
  };

  const measureSlotRects = () => {
    const wasHidden = board.hidden;
    const prevVisibility = board.style.visibility;
    const prevPointer = board.style.pointerEvents;
    if (wasHidden) {
      board.hidden = false;
      board.style.visibility = 'hidden';
      board.style.pointerEvents = 'none';
    }
    const rects = slots.map((slot) => slot.getBoundingClientRect());
    if (wasHidden) {
      board.hidden = true;
      board.style.visibility = prevVisibility;
      board.style.pointerEvents = prevPointer;
    }
    return rects;
  };

  const createOverlayCards = (slotRects) => {
    ensureFullAnimationLayer();
    return slotRects.map((slotRect) => {
      const local = toLocalRect(slotRect);
      const card = document.createElement('div');
      card.className = 'card-slot card-slot--overlay';
      card.style.left = `${local.left}px`;
      card.style.top = `${local.top}px`;
      card.style.width = `${local.width}px`;
      card.style.height = `${local.height}px`;
      const cardBack = Object.assign(document.createElement('img'), { className: 'card-back' });
      applyCardBackBackground(cardBack);
      card.appendChild(cardBack);
      animationLayer.appendChild(card);
      return card;
    });
  };

  const animateOverlayDeal = async (deckEl, {
    duration = FULL_TIMING.dealDuration,
    stagger = FULL_TIMING.dealStagger,
  } = {}) => {
    const slotRects = measureSlotRects();
    const cards = createOverlayCards(slotRects);
    const origin = toLocalRect(deckEl.getBoundingClientRect());

    cards.forEach((card, idx) => {
      const target = toLocalRect(slotRects[idx]);
      const dx = origin.centerX - target.centerX;
      const dy = origin.centerY - target.centerY;
      card.style.transition = 'none';
      card.style.opacity = '0';
      card.style.transform = `translate(${dx}px, ${dy}px) scale(0.96)`;
      card.style.zIndex = `${BOARD_CARD_COUNT - idx}`;
    });

    requestAnimationFrame(() => {
      cards.forEach((card, idx) => {
        setTimeout(() => {
          card.style.transition = `transform ${duration}ms cubic-bezier(0.22, 0.65, 0.2, 1), opacity ${duration}ms ease`;
          card.style.opacity = '1';
          card.style.transform = 'translate(0, 0) scale(1)';
          card.style.zIndex = '';
        }, idx * stagger);
      });
    });

    await wait(duration + cards.length * stagger + 50);
    clearOverlayCards();
  };

  const animateOverlayCollect = async () => {
    const slotRects = measureSlotRects();
    const cards = createOverlayCards(slotRects);
    const origin = toLocalRect(centerDeck.getBoundingClientRect());

    cards.forEach((card, idx) => {
      const target = toLocalRect(slotRects[idx]);
      const dx = origin.centerX - target.centerX;
      const dy = origin.centerY - target.centerY;
      card.classList.add('is-clearing');
      card.style.transition = `transform ${FULL_TIMING.collectDuration}ms cubic-bezier(0.24, 0.62, 0.28, 1), opacity ${FULL_TIMING.collectDuration}ms ease`;
      setTimeout(() => {
        card.style.opacity = '0.88';
        card.style.transform = `translate(${dx}px, ${dy}px) scale(0.96)`;
      }, idx * FULL_TIMING.collectStagger);
    });

    await wait(FULL_TIMING.collectDuration + cards.length * FULL_TIMING.collectStagger + 36);
    clearOverlayCards();
  };

  const resetFullSelection = async ({ animateClear = false } = {}) => {
    selectedSlotIndices = [];
    renderFullSelection();
    if (animateClear) {
      await wait(FULL_TIMING.badgeClearDuration);
      slots.forEach((slot) => slot.classList.remove('is-clearing'));
    }
  };

  const startFullDeal = async () => {
    if (fullPhase !== 'preDeal' || !state.cards.length || isFullAnimating) return;

    boardCards = getDrawableCards(BOARD_CARD_COUNT);
    ensureFullBoardSlots();
    hydrateBoardSlots();

    fullPhase = 'dealing';
    lockFullInteraction();
    renderFullPhase();

    await animateOverlayDeal(heroDeck);

    fullPhase = 'dealt';
    restoreStableBoardSurface();
    unlockFullInteraction();
    renderFullPhase();
    renderFullSelection();
  };

  const startFullShuffle = async () => {
    if (fullPhase !== 'dealt' || isFullAnimating) return;

    fullPhase = 'shufflingCollect';
    lockFullInteraction();
    renderFullPhase();

    await resetFullSelection({ animateClear: true });
    await animateOverlayCollect();

    fullPhase = 'shufflingRedeal';
    boardCards = getDrawableCards(BOARD_CARD_COUNT);
    hydrateBoardSlots();
    renderFullSelection();
    renderFullPhase();
    await animateOverlayDeal(centerDeck, {
      duration: FULL_TIMING.dealDuration,
      stagger: FULL_TIMING.dealStagger,
    });

    fullPhase = 'dealt';
    restoreStableBoardSurface();
    unlockFullInteraction();
    renderFullPhase();
    renderFullSelection();
  };

  renderFullPhase = () => {
    flow.dataset.fullPhase = fullPhase;

    const isPreDeal = fullPhase === 'preDeal';
    const isDealing = fullPhase === 'dealing';
    const isDealt = fullPhase === 'dealt';
    const isShufflePhase = fullPhase === 'shufflingCollect' || fullPhase === 'shufflingRedeal';

    entry.hidden = !(isPreDeal || isDealing);
    heroDeck.hidden = !(isPreDeal || isDealing);

    toolbar.hidden = isPreDeal || isDealing;
    actions.hidden = isPreDeal || isDealing;

    const hideBoard = isPreDeal || isDealing;
    if (hideBoard) {
      board.hidden = true;
      board.classList.add('is-hidden');
      board.classList.remove('is-phase-placeholder');
      board.style.visibility = '';
      board.style.pointerEvents = '';
    } else if (isShufflePhase) {
      board.hidden = true;
      board.classList.add('is-hidden', 'is-phase-placeholder');
      board.style.visibility = '';
      board.style.pointerEvents = '';
    } else {
      board.hidden = false;
      board.classList.remove('is-hidden', 'is-phase-placeholder');
      board.style.visibility = '';
      board.style.pointerEvents = '';
    }
    board.classList.toggle('is-locked', fullPhase !== 'dealt' || isFullAnimating);

    centerDeck.hidden = !isShufflePhase;
    centerDeck.classList.toggle('is-hidden', centerDeck.hidden);

    if (!MOTION_PHASES.has(fullPhase) && animationLayer.childElementCount) {
      clearOverlayCards();
    }
    animationLayer.hidden = !MOTION_PHASES.has(fullPhase) && !animationLayer.childElementCount;

    const toolbarDisabled = !isDealt || isFullAnimating || MOTION_PHASES.has(fullPhase);
    applyDisabledState(shuffleBtn, toolbarDisabled);
    applyDisabledState(continueBtn, toolbarDisabled || getSelectedCards().length !== OVERALL_SELECTION_COUNT);
    applyDisabledState(dealBtn, !isPreDeal || isFullAnimating);
  };

  dealBtn.onclick = () => {
    void startFullDeal();
  };
  shuffleBtn.onclick = () => {
    void startFullShuffle();
  };
  continueBtn.onclick = () => {
    const selectedCards = getSelectedCards();
    if (fullPhase !== 'dealt' || isFullAnimating || selectedCards.length !== OVERALL_SELECTION_COUNT) return;
    saveSelectionAndGo({ mode: 'full', spread: 'story', topic: 'generic', cards: selectedCards.map((c) => c.id) });
  };

  ensureFullBoardSlots();
  hydrateBoardSlots();
  restoreStableBoardSurface();
  clearOverlayCards();
  fullPhase = 'preDeal';
  resetFullSelection();
  renderFullPhase();
}

function renderQuestion() {
  const board = document.getElementById('question-card-board');
  const topicToggle = document.getElementById('topic-toggle');
  const shuffleBtn = document.getElementById('question-reset');
  const continueBtn = document.getElementById('question-continue');
  const counter = document.getElementById('question-counter');
  const toolbar = document.getElementById('question-toolbar');
  if (!board || !topicToggle || !shuffleBtn || !continueBtn || !counter || !toolbar) return;

  let boardApi = null;
  let latestSelection = [];

  const setActive = (container, btn) => {
    container.querySelectorAll('.chip').forEach((chip) => chip.classList.remove('active', 'chip-active'));
    btn.classList.add('active', 'chip-active');
  };

  const updateContinue = (cards) => {
    latestSelection = cards;
    continueBtn.disabled = cards.length !== QUESTION_SELECTION_COUNT;
    counter.textContent = `${cards.length}/${QUESTION_SELECTION_COUNT}`;
  };

  const renderBoard = () => {
    board.hidden = false;
    toolbar.hidden = false;
    boardApi = setupBoard(board, BOARD_CARD_COUNT, QUESTION_SELECTION_COUNT, updateContinue);
    updateContinue([]);
  };

  topicToggle.querySelectorAll('[data-topic]').forEach((btn) => {
    btn.onclick = () => {
      setActive(topicToggle, btn);
      state.questionTopic = btn.dataset.topic;
    };
  });

  shuffleBtn.onclick = () => boardApi?.render();
  continueBtn.onclick = () => {
    if (latestSelection.length !== QUESTION_SELECTION_COUNT) return;
    saveSelectionAndGo({
      mode: 'question',
      spread: 'story',
      topic: state.questionTopic,
      cards: latestSelection.map((c) => c.id),
    });
  };

  renderBoard();
}

function renderPage(dict) {
  const page = document.body.dataset.page;
  if (page === 'daily') renderDaily(dict);
  if (page === 'overall' || page === 'full') renderOverall(dict);
  if (page === 'question') renderQuestion(dict);
}

function init() {
  const page = document.body.dataset.page;
  initShell(state, (dict) => renderPage(dict), page);

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
