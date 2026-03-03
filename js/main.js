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
const DEAL_STAGGER = 180;
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
      slot.style.transition = 'transform 0.35s ease, opacity 0.35s ease';
      setTimeout(() => {
        slot.style.opacity = '1';
        slot.style.transform = 'translate(0, 0) scale(1)';
      }, idx * DEAL_STAGGER);
    });

    const total = 350 + slots.length * DEAL_STAGGER + 120;
    setTimeout(() => {
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

  let latestSelection = [];
  let isAnimating = false;
  let hasDealtOnce = false;
  setRitualCtaLabel(dealShuffleBtn, hasDealtOnce);

  const setDealShuffleDisabled = () => {
    dealShuffleBtn.disabled = isAnimating;
  };

  const updateContinue = (cards = []) => {
    latestSelection = cards;
    counter.textContent = `${cards.length}/${DAILY_SELECTION_MAX}`;
    continueBtn.disabled = cards.length !== DAILY_SELECTION_MAX || isAnimating;
    setDealShuffleDisabled();
  };

  const resetSelection = () => {
    latestSelection = [];
    board.querySelectorAll('.card-slot').forEach((slot) => slot.classList.remove('is-selected'));
    updateContinue([]);
  };

  const bindCard = (slot, card) => {
    slot.onclick = () => {
      if (isAnimating) return;
      if (!card) return;
      if (latestSelection.some((c) => c.id === card.id)) {
        slot.classList.remove('is-selected');
        updateContinue([]);
      } else {
        board.querySelectorAll('.card-slot').forEach((btn) => btn.classList.remove('is-selected'));
        slot.classList.add('is-selected');
        updateContinue([card]);
      }
    };
  };

  let slots = [];
  const ensureSlots = (count) => {
    if (slots.length === count) return;
    slots = [];
    board.textContent = '';
    for (let i = 0; i < count; i += 1) {
      const slot = document.createElement('button');
      slot.type = 'button';
      slot.className = 'card-slot card-slot--dealable';
      const cardBack = Object.assign(document.createElement('img'), { className: 'card-back' });
      applyCardBackBackground(cardBack);
      slot.appendChild(cardBack);
      slots.push(slot);
      board.appendChild(slot);
    }
  };

  const updateSlots = (cards) => {
    ensureSlots(cards.length);
    slots.forEach((slot, idx) => {
      const card = cards[idx];
      slot.dataset.id = card?.id || '';
      slot.classList.toggle('is-hidden', !card);
      if (card) {
        bindCard(slot, card);
      } else {
        slot.onclick = null;
      }
    });
  };

  const animateDeal = (nextSlots) => {
    animateDealSlots(board, nextSlots, () => {
      isAnimating = false;
      hasDealtOnce = true;
      setRitualCtaLabel(dealShuffleBtn, hasDealtOnce);
      updateContinue(latestSelection);
      board.classList.remove('is-locked');
    });
  };

  const deal = () => {
    if (!state.cards.length) return;
    isAnimating = true;
    board.classList.add('is-locked');
    resetSelection();
    const cards = getDrawableCards(DAILY_BOARD_COUNT);
    updateSlots(cards);
    requestAnimationFrame(() => animateDeal(slots));
  };

  dealShuffleBtn.onclick = () => {
    if (!state.cards.length || isAnimating) return;
    if (!hasDealtOnce) {
      deal();
      return;
    }

    isAnimating = true;
    continueBtn.disabled = true;
    setDealShuffleDisabled();
    resetSelection();
    const currentSlots = Array.from(board.querySelectorAll('.card-slot'));
    animateCollectSlots(board, currentSlots);
    setTimeout(() => {
      deal();
    }, STACK_DURATION);
  };

  continueBtn.onclick = () => {
    if (!latestSelection.length || isAnimating) return;
    saveSelectionAndGo({ mode: 'daily', spread: 'quick', topic: 'generic', cards: latestSelection.map((c) => c.id) });
  };
}

function renderOverall() {
  const dealShuffleBtn = document.getElementById('overall-deal-shuffle');
  const board = document.getElementById('overall-card-board');
  const actions = document.getElementById('overall-actions');
  const toolbar = document.getElementById('overall-toolbar');
  const counter = document.getElementById('overall-counter');
  const continueBtn = document.getElementById('overall-continue');
  if (!dealShuffleBtn || !board || !actions || !continueBtn || !toolbar || !counter) return;

  let boardApi = null;
  let latestSelection = [];
  let isAnimating = false;
  let hasDealt = false;
  setRitualCtaLabel(dealShuffleBtn, hasDealt);

  const setDealShuffleDisabled = () => {
    dealShuffleBtn.disabled = isAnimating;
  };

  const updateContinue = (cards) => {
    latestSelection = cards;
    counter.textContent = `${cards.length}/${OVERALL_SELECTION_COUNT}`;
    continueBtn.disabled = cards.length !== OVERALL_SELECTION_COUNT || isAnimating;
    setDealShuffleDisabled();
  };

  const triggerDeal = () => {
    if (!state.cards.length || isAnimating) return;
    board.hidden = false;
    toolbar.hidden = false;
    actions.hidden = false;

    if (!boardApi) {
      isAnimating = true;
      setDealShuffleDisabled();
      boardApi = setupBoard(board, BOARD_CARD_COUNT, OVERALL_SELECTION_COUNT, updateContinue, { animated: true });
      setTimeout(() => {
        isAnimating = false;
        hasDealt = true;
        setRitualCtaLabel(dealShuffleBtn, hasDealt);
        updateContinue([]);
      }, STACK_DURATION + BOARD_CARD_COUNT * DEAL_STAGGER + 520);
      return;
    }

    isAnimating = true;
    continueBtn.disabled = true;
    setDealShuffleDisabled();
    boardApi.render();
    setTimeout(() => {
      isAnimating = false;
      hasDealt = true;
      setRitualCtaLabel(dealShuffleBtn, hasDealt);
      updateContinue([]);
    }, STACK_DURATION + BOARD_CARD_COUNT * DEAL_STAGGER + 520);
  };

  dealShuffleBtn.onclick = triggerDeal;
  continueBtn.onclick = () => {
    if (latestSelection.length !== OVERALL_SELECTION_COUNT || isAnimating) return;
    saveSelectionAndGo({ mode: 'full', spread: 'story', topic: 'generic', cards: latestSelection.map((c) => c.id) });
  };
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
