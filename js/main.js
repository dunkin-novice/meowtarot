import { initShell, translations } from './common.js';
import { loadTarotData } from './data.js';

const BOARD_CARD_COUNT = 12;
const DAILY_BOARD_COUNT = 6;
const OVERALL_SELECTION_COUNT = 3;
const STORAGE_KEY = 'meowtarot_selection';

const state = {
  currentLang: 'en',
  cards: [],
  questionTopic: 'love',
};

function getDrawableCards(size = 6) {
  if (!state.cards.length) return [];
  const pool = [...state.cards];
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
  window.location.href = `reading.html?${params.toString()}`;
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

function setupBoard(boardEl, boardSize, selectionGoal, onSelectionChange) {
  let cards = [];
  let selected = [];
  const render = () => {
    cards = getDrawableCards(boardSize);
    selected = [];
    boardEl.innerHTML = '';
    const slots = [];

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

    for (let i = 0; i < boardSize; i += 1) {
      const slot = document.createElement('button');
      slot.type = 'button';
      slot.className = 'card-slot';
      slot.appendChild(Object.assign(document.createElement('div'), { className: 'card-back', textContent: '🐾' }));
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

    animateBoard(boardEl);
    refreshBadges();
  };

  render();

  return {
    render,
    getSelectedCards: () => selected.map((idx) => cards[idx]).filter(Boolean),
  };
}

function renderDaily() {
  const startBtn = document.getElementById('daily-start');
  const board = document.getElementById('daily-board');
  const actions = document.getElementById('daily-actions');
  const shuffleBtn = document.getElementById('daily-shuffle');
  const toolbar = document.getElementById('daily-toolbar');
  const counter = document.getElementById('daily-counter');
  const continueBtn = document.getElementById('daily-continue');
  if (!startBtn || !board || !actions || !shuffleBtn || !continueBtn || !toolbar || !counter) return;

  let boardApi = null;
  let latestSelection = [];

  const updateContinue = (cards) => {
    latestSelection = cards;
    counter.textContent = `${cards.length}/1`;
    continueBtn.disabled = cards.length !== 1;
  };

  const renderBoard = () => {
    board.hidden = false;
    actions.hidden = false;
    toolbar.hidden = false;
    boardApi = setupBoard(board, DAILY_BOARD_COUNT, 1, updateContinue);
    updateContinue([]);
  };

  startBtn.onclick = () => {
    renderBoard();
  };

  shuffleBtn.onclick = () => {
    boardApi?.render();
  };

  continueBtn.onclick = () => {
    if (!latestSelection.length) return;
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
    boardApi = setupBoard(board, BOARD_CARD_COUNT, OVERALL_SELECTION_COUNT, updateContinue);
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

function renderPage(dict) {
  const page = document.body.dataset.page;
  if (page === 'daily') renderDaily(dict);
  if (page === 'overall') renderOverall(dict);
  if (page === 'question') renderQuestion(dict);
}

function init() {
  initShell(state, (dict) => renderPage(dict), document.body.dataset.page);
  loadTarotData()
    .then((cards) => {
      state.cards = cards;
      renderPage(translations[state.currentLang] || translations.en);
    })
    .catch(() => {
      renderPage(translations[state.currentLang] || translations.en);
    });
}

document.addEventListener('DOMContentLoaded', init);
