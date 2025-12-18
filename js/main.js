import { initShell, localizePath, translations } from './common.js';
import { loadTarotData, meowTarotCards, getCardBackUrl, getCardImageUrl, normalizeId } from './data.js';

const BOARD_CARD_COUNT = 12;
const DAILY_BOARD_COUNT = 6;
const OVERALL_SELECTION_COUNT = 3;
const ORIENTATION_REVERSED_PROBABILITY = 0.5;
const STORAGE_KEY = 'meowtarot_selection';
const DAILY_SELECTION_MAX = 1;
const DEAL_STAGGER = 180;
const STACK_DURATION = 520;
const CARD_BACK_URL = getCardBackUrl();

const state = {
  currentLang: 'en',
  cards: [],
  questionTopic: 'love',
};

const meaningPreview = document.getElementById('meaningPreview');
const staticCardBacks = document.querySelectorAll('.card-back');

function applyCardBackBackground(el) {
  if (!el) return;
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

  const buildSlots = () => {
    boardEl.innerHTML = '';
    slots = [];
    for (let i = 0; i < boardSize; i += 1) {
      const slot = document.createElement('button');
      slot.type = 'button';
      slot.className = 'card-slot';
      const cardBack = Object.assign(document.createElement('div'), { className: 'card-back', textContent: '🐾' });
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

  const performDeal = (withAnimation) => {
    buildSlots();
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
  const startBtn = document.getElementById('daily-start');
  const board = document.getElementById('daily-board');
  const shuffleBtn = document.getElementById('daily-shuffle');
  const counter = document.getElementById('daily-counter');
  const continueBtn = document.getElementById('daily-continue');
  if (!startBtn || !board || !shuffleBtn || !continueBtn || !counter) return;

  let latestSelection = [];
  let isAnimating = false;
  let hasStarted = false;

  const updateContinue = (cards = [], dict = translations[state.currentLang] || translations.en) => {
    latestSelection = cards;
    counter.textContent = `${cards.length}/${DAILY_SELECTION_MAX}`;
    continueBtn.disabled = cards.length !== DAILY_SELECTION_MAX || isAnimating;
    shuffleBtn.disabled = !hasStarted || isAnimating;
  };

  const resetSelection = () => {
    latestSelection = [];
    board.querySelectorAll('.card-slot').forEach((slot) => slot.classList.remove('is-selected'));
    updateContinue([]);
  };

  const bindCard = (slot, card) => {
    slot.addEventListener('click', () => {
      if (isAnimating) return;
      if (latestSelection.some((c) => c.id === card.id)) {
        slot.classList.remove('is-selected');
        updateContinue([]);
      } else {
        board.querySelectorAll('.card-slot').forEach((btn) => btn.classList.remove('is-selected'));
        slot.classList.add('is-selected');
        updateContinue([card]);
      }
    });
  };

  const createSlots = () => {
    const cards = getDrawableCards(DAILY_BOARD_COUNT);
    board.innerHTML = '';
    const slots = cards.map((card) => {
      const slot = document.createElement('button');
      slot.type = 'button';
      slot.className = 'card-slot card-slot--dealable';
      slot.dataset.id = card.id;
      const cardBack = Object.assign(document.createElement('div'), { className: 'card-back', textContent: '🐾' });
      applyCardBackBackground(cardBack);
      slot.appendChild(cardBack);
      bindCard(slot, card);
      board.appendChild(slot);
      return slot;
    });
    return { cards, slots };
  };

  const animateDeal = (slots) => {
    animateDealSlots(board, slots, () => {
      isAnimating = false;
      updateContinue(latestSelection);
      board.classList.remove('is-locked');
    });
  };

  const deal = () => {
    if (!state.cards.length) return;
    isAnimating = true;
    board.classList.add('is-locked');
    resetSelection();
    const { slots } = createSlots();
    requestAnimationFrame(() => animateDeal(slots));
  };

  startBtn.onclick = () => {
    if (!state.cards.length) return;
    hasStarted = true;
    startBtn.disabled = true;
    shuffleBtn.disabled = true;
    continueBtn.disabled = true;
    deal();
  };

  shuffleBtn.onclick = () => {
    if (isAnimating || !hasStarted) return;
    isAnimating = true;
    continueBtn.disabled = true;
    shuffleBtn.disabled = true;
    resetSelection();
    const slots = Array.from(board.querySelectorAll('.card-slot'));
    animateCollectSlots(board, slots);
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
  const startBtn = document.getElementById('overallStartBtn');
  const board = document.getElementById('overall-card-board');
  const actions = document.getElementById('overall-actions');
  const shuffleBtn = document.getElementById('overall-shuffle');
  const toolbar = document.getElementById('overall-toolbar');
  const counter = document.getElementById('overall-counter');
  const continueBtn = document.getElementById('overall-continue');
  if (!startBtn || !board || !actions || !shuffleBtn || !continueBtn || !toolbar || !counter) return;

  let boardApi = null;
  let latestSelection = [];

  const updateContinue = (cards) => {
    latestSelection = cards;
    counter.textContent = `${cards.length}/${OVERALL_SELECTION_COUNT}`;
    continueBtn.disabled = cards.length !== OVERALL_SELECTION_COUNT;
  };

  const renderBoard = () => {
    board.hidden = false;
    toolbar.hidden = false;
    actions.hidden = false;
    boardApi = setupBoard(board, BOARD_CARD_COUNT, OVERALL_SELECTION_COUNT, updateContinue, { animated: true });
    updateContinue([]);
  };

  startBtn.onclick = renderBoard;
  shuffleBtn.onclick = () => boardApi?.render();
  continueBtn.onclick = () => {
    if (latestSelection.length !== OVERALL_SELECTION_COUNT) return;
    saveSelectionAndGo({ mode: 'overall', spread: 'story', topic: 'generic', cards: latestSelection.map((c) => c.id) });
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
    continueBtn.disabled = cards.length !== OVERALL_SELECTION_COUNT;
    counter.textContent = `${cards.length}/${OVERALL_SELECTION_COUNT}`;
  };

  const renderBoard = () => {
    board.hidden = false;
    toolbar.hidden = false;
    boardApi = setupBoard(board, BOARD_CARD_COUNT, OVERALL_SELECTION_COUNT, updateContinue);
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
    if (latestSelection.length !== OVERALL_SELECTION_COUNT) return;
    saveSelectionAndGo({
      mode: 'question',
      spread: 'story',
      topic: state.questionTopic,
      cards: latestSelection.map((c) => c.id),
    });
  };

  renderBoard();
}

function renderMeaningPreview(cardsSource = []) {
  if (!meaningPreview) return;
  const pool = cardsSource.length ? cardsSource : meowTarotCards;
  if (!pool.length) return;

  meaningPreview.innerHTML = '';

  pool.slice(0, 9).forEach((card) => {
    const name =
      state.currentLang === 'en'
        ? card.card_name_en || card.name_en || card.name || card.id
        : card.alias_th || card.name_th || card.name || card.id;

    const summary =
      state.currentLang === 'en'
        ? card.reading_summary_preview_en || card.meaning_en || card.tarot_imply_en || ''
        : card.reading_summary_preview_th || card.meaning_th || card.tarot_imply_th || '';

    const archetype = state.currentLang === 'en' ? card.archetype_en || '' : card.archetype_th || '';

    const div = document.createElement('div');
    div.className = 'sample-card';
    div.innerHTML = `
      <h5>${card.icon_emoji ? `${card.icon_emoji} ` : ''}${name}</h5>
      ${archetype ? `<p class="archetype">${archetype}</p>` : ''}
      <p>${summary}</p>
    `;
    meaningPreview.appendChild(div);
  });
}

function initHomeHeroRandomCards(cards = []) {
  const card1 = document.getElementById('homeHeroCard1');
  const card2 = document.getElementById('homeHeroCard2');
  const cardBack = document.getElementById('homeHeroCardBack');
  if (!card1 || !card2 || !cardBack) return;

  const seen = new Set();
  const baseIds = [];

  cards.forEach((card) => {
    const baseId = stripOrientation(card.card_id || card.id || '');
    if (baseId && !seen.has(baseId)) {
      seen.add(baseId);
      baseIds.push(baseId);
    }
  });

  if (baseIds.length < 2) return;

  for (let i = baseIds.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [baseIds[i], baseIds[j]] = [baseIds[j], baseIds[i]];
  }

  const [firstId, secondId] = baseIds.slice(0, 2).map((id) => `${id}-upright`);

  card1.src = getCardImageUrl({ id: firstId, card_id: firstId, orientation: 'upright' });
  card2.src = getCardImageUrl({ id: secondId, card_id: secondId, orientation: 'upright' });
  cardBack.src = getCardBackUrl();
}

function renderPage(dict) {
  const page = document.body.dataset.page;
  if (page === 'daily') renderDaily(dict);
  if (page === 'overall') renderOverall(dict);
  if (page === 'question') renderQuestion(dict);
  if (page === 'home') renderMeaningPreview(state.cards);
}

function init() {
  initShell(state, (dict) => renderPage(dict), document.body.dataset.page);
  loadTarotData()
    .then((cards) => {
      state.cards = cards;
      renderPage(translations[state.currentLang] || translations.en);
      initHomeHeroRandomCards(cards);
    })
    .catch(() => {
      renderPage(translations[state.currentLang] || translations.en);
      initHomeHeroRandomCards([]);
    });
}

document.addEventListener('DOMContentLoaded', init);
