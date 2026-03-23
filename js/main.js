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
const CELTIC_CROSS_COUNT = 10;
const QUESTION_SELECTION_COUNT = 3;
const FULL_POOL_SIZE = 50;
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
    ids: cards.join(','),
    cards: cards.join(','),
    lang: state.currentLang,
  });
  const destination = localizePath('/reading.html', state.currentLang);
  window.location.href = `${destination}?${params.toString()}`;
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
  const board = document.getElementById('overall-card-board');
  const toolbar = document.getElementById('overall-toolbar');
  const shuffleBtn = document.getElementById('overall-shuffle');
  const counter = document.getElementById('overall-counter');
  const continueBtn = document.getElementById('overall-continue');
  const actions = document.getElementById('overall-actions');
  if (!board || !toolbar || !shuffleBtn || !counter || !continueBtn || !actions) return;

  let selectedCards = [];

  board.parentElement?.querySelector('.full-picked-row')?.remove();

  const pickedRow = document.createElement('div');
  pickedRow.className = 'full-picked-row';

  const updatePickedRow = () => {
    pickedRow.innerHTML = '';
    selectedCards.forEach((card, idx) => {
      const thumb = document.createElement('div');
      thumb.className = 'full-picked-thumb';

      const img = document.createElement('img');
      img.className = 'full-picked-thumb__img';
      img.alt = card?.id || '';
      applyCardBackBackground(img);
      thumb.appendChild(img);

      const badge = document.createElement('span');
      badge.className = 'full-picked-thumb__badge';
      badge.textContent = `${idx + 1}`;
      thumb.appendChild(badge);

      pickedRow.appendChild(thumb);
    });
  };

  const updateContinue = (cards) => {
    selectedCards = cards;
    counter.textContent = `${cards.length}/${CELTIC_CROSS_COUNT}`;
    continueBtn.disabled = cards.length !== CELTIC_CROSS_COUNT;
    updatePickedRow();
  };

  board.insertAdjacentElement('afterend', pickedRow);

  const fullBoard = setupBoard(
    board,
    FULL_POOL_SIZE,
    CELTIC_CROSS_COUNT,
    updateContinue,
    { animated: true, animationProfile: 'default' }
  );

  board.hidden = false;
  toolbar.hidden = false;
  actions.hidden = false;
  counter.textContent = `0/${CELTIC_CROSS_COUNT}`;
  continueBtn.disabled = true;

  shuffleBtn.onclick = () => {
    fullBoard.render();
    updateContinue([]);
  };

  continueBtn.onclick = () => {
    if (selectedCards.length !== CELTIC_CROSS_COUNT) return;
    saveSelectionAndGo({
      mode: 'full',
      spread: 'story',
      topic: 'generic',
      cards: selectedCards.map((c) => c.id),
    });
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
