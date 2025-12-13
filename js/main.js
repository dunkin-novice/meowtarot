import { initShell, localizePath, translations } from './common.js';
import { loadTarotData, meowTarotCards } from './data.js';

const BOARD_CARD_COUNT = 12;
const DAILY_BOARD_COUNT = 6;
const OVERALL_SELECTION_COUNT = 3;
const STORAGE_KEY = 'meowtarot_selection';
const DAILY_SELECTION_MAX = 1;
const DEAL_STAGGER = 180;
const STACK_DURATION = 520;

const state = {
  currentLang: 'en',
  cards: [],
  questionTopic: 'love',
};

const meaningPreview = document.getElementById('meaningPreview');

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
  const shuffleBtn = document.getElementById('daily-shuffle');
  const counter = document.getElementById('daily-counter');
  const continueBtn = document.getElementById('daily-continue');
  const startShell = document.getElementById('daily-start-shell');
  if (!startBtn || !board || !shuffleBtn || !continueBtn || !counter || !startShell) return;

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
      slot.appendChild(Object.assign(document.createElement('div'), { className: 'card-back', textContent: '🐾' }));
      bindCard(slot, card);
      board.appendChild(slot);
      return slot;
    });
    return { cards, slots };
  };

  const animateDeal = (slots) => {
    const boardRect = board.getBoundingClientRect();
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
        isAnimating = false;
        updateContinue(latestSelection);
        board.classList.remove('is-locked');
      }, total);
    });
  };

  const animateCollect = (slots) => {
    const boardRect = board.getBoundingClientRect();
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
    startShell.classList.add('is-hidden');
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
    animateCollect(slots);
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
    })
    .catch(() => {
      renderPage(translations[state.currentLang] || translations.en);
    });
}

document.addEventListener('DOMContentLoaded', init);
