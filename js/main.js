import { initShell, localizePath, translations } from './common.js';
import {
  loadTarotManifest,
  getCardBackUrl,
  getCardBackFallbackUrl,
  getCardImageUrl,
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
const FULL_DEAL_ANIMATION_DURATION = 960;
const CARD_BACK_URL = getCardBackUrl();
const CARD_BACK_FALLBACK_URL = getCardBackFallbackUrl();
const CELTIC_CROSS_POSITIONS = [
  { key: 'present', labelKey: 'positionPresent' },
  { key: 'challenge', labelKey: 'positionChallenge' },
  { key: 'past', labelKey: 'positionPast' },
  { key: 'future', labelKey: 'positionFuture' },
  { key: 'above', labelKey: 'positionAbove' },
  { key: 'below', labelKey: 'positionBelow' },
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

function getCardName(card) {
  if (!card) return '';
  return state.currentLang === 'th'
    ? (card.alias_th || card.name_th || card.card_name_en || card.name_en || card.name || card.id || '')
    : (card.card_name_en || card.name_en || card.name || card.name_th || card.id || '');
}

function getOrientationLabel(card) {
  const orientation = card?.orientation || (String(card?.id || '').endsWith('-reversed') ? 'reversed' : 'upright');
  if (state.currentLang === 'th') return orientation === 'reversed' ? 'กลับหัว' : 'ตั้งตรง';
  return orientation === 'reversed' ? 'Reversed' : 'Upright';
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

function moveItem(list, fromIndex, toIndex) {
  const copy = Array.from(list);
  if (
    fromIndex < 0
    || fromIndex >= copy.length
    || toIndex < 0
    || toIndex >= copy.length
    || fromIndex === toIndex
  ) {
    return copy;
  }
  const [item] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, item);
  return copy;
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
    || !dealStage
    || !arrangeStage
    || !arrangeList
  ) return;

  const dict = translations[state.currentLang] || translations.en;
  const sortingState = {
    pointerId: null,
    activeIndex: -1,
    activeHandle: null,
  };
  const dealPositions = [
    { x: '-33%', y: '34%', r: '-18deg' },
    { x: '-25%', y: '18%', r: '-14deg' },
    { x: '-16%', y: '8%', r: '-10deg' },
    { x: '-8%', y: '0%', r: '-6deg' },
    { x: '0%', y: '-3%', r: '-2deg' },
    { x: '8%', y: '0%', r: '2deg' },
    { x: '16%', y: '8%', r: '6deg' },
    { x: '25%', y: '18%', r: '10deg' },
    { x: '33%', y: '34%', r: '14deg' },
    { x: '0%', y: '20%', r: '0deg' },
  ];
  let stage = 'deal';
  let pool = [];
  let selectedCards = [];
  let dealTimer = null;
  let isDisposed = false;

  const clearDealTimer = () => {
    if (!dealTimer) return;
    window.clearTimeout(dealTimer);
    dealTimer = null;
  };

  const isPoolReady = () => pool.length >= CELTIC_CROSS_COUNT;

  const teardownSortCapture = () => {
    if (sortingState.pointerId == null) return;
    if (!sortingState.activeHandle?.hasPointerCapture?.(sortingState.pointerId)) return;
    sortingState.activeHandle.releasePointerCapture(sortingState.pointerId);
  };

  const stopSorting = () => {
    teardownSortCapture();
    sortingState.pointerId = null;
    sortingState.activeIndex = -1;
    sortingState.activeHandle = null;
    arrangeList.classList.remove('is-sorting');
    rerenderArrangeList();
  };

  const handleSortMove = (event) => {
    if (sortingState.pointerId !== event.pointerId || sortingState.activeIndex < 0) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.full-arrange-item');
    const targetIndex = Number(target?.dataset.index ?? sortingState.activeIndex);
    if (!Number.isInteger(targetIndex) || targetIndex === sortingState.activeIndex) return;
    selectedCards = moveItem(selectedCards, sortingState.activeIndex, targetIndex);
    sortingState.activeIndex = targetIndex;
    rerenderArrangeList(targetIndex);
  };

  const handleSortEnd = (event) => {
    if (sortingState.pointerId !== event.pointerId) return;
    stopSorting();
  };

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
    dealPositions.forEach((position, idx) => {
      const ghost = document.createElement('div');
      ghost.className = 'full-deal-card';
      ghost.style.setProperty('--deal-x', position.x);
      ghost.style.setProperty('--deal-y', position.y);
      ghost.style.setProperty('--deal-rotate', position.r);
      ghost.style.transitionDelay = `${idx * 42}ms`;
      ghost.appendChild(createCardArt(null, 'full-deal-card__img', { useBack: true }));
      dealOrbit.appendChild(ghost);
    });
    dealOrbit.classList.remove('is-dealt');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        dealOrbit.classList.add('is-dealt');
      });
    });
  };

  const renderDrawSummary = () => {
    if (!selectedCards.length) {
      drawSummary.hidden = true;
      drawSummary.innerHTML = '';
      return;
    }

    drawSummary.hidden = false;
    drawSummary.innerHTML = '';

    const latestCard = selectedCards[selectedCards.length - 1];
    const latestWrap = document.createElement('article');
    latestWrap.className = 'full-latest-card';
    latestWrap.appendChild(createCardArt(latestCard, 'full-latest-card__img', {
      alt: `${getCardName(latestCard)} — ${getOrientationLabel(latestCard)}`,
    }));

    const latestMeta = document.createElement('div');
    latestMeta.className = 'full-latest-card__meta';

    const latestEyebrow = document.createElement('p');
    latestEyebrow.className = 'full-latest-card__eyebrow';
    latestEyebrow.textContent = dict.fullReadingLatestCard;
    latestMeta.appendChild(latestEyebrow);

    const latestPosition = document.createElement('h3');
    latestPosition.textContent = dict[CELTIC_CROSS_POSITIONS[selectedCards.length - 1]?.labelKey] || '';
    latestMeta.appendChild(latestPosition);

    const latestName = document.createElement('p');
    latestName.className = 'full-latest-card__name';
    latestName.textContent = `${getCardName(latestCard)} · ${getOrientationLabel(latestCard)}`;
    latestMeta.appendChild(latestName);
    latestWrap.appendChild(latestMeta);
    drawSummary.appendChild(latestWrap);

    const rail = document.createElement('section');
    rail.className = 'full-picked-rail';

    const railLabel = document.createElement('p');
    railLabel.className = 'full-picked-rail__label';
    railLabel.textContent = dict.fullReadingDrawnLabel;
    rail.appendChild(railLabel);

    const railGrid = document.createElement('div');
    railGrid.className = 'full-picked-rail__grid';
    selectedCards.forEach((card, idx) => {
      const item = document.createElement('article');
      item.className = 'full-picked-rail__item';

      const badge = document.createElement('span');
      badge.className = 'full-picked-rail__badge';
      badge.textContent = `${idx + 1}`;
      item.appendChild(badge);
      item.appendChild(createCardArt(card, 'full-picked-rail__img', { alt: getCardName(card) }));

      const label = document.createElement('p');
      label.className = 'full-picked-rail__position';
      label.textContent = dict[CELTIC_CROSS_POSITIONS[idx]?.labelKey] || '';
      item.appendChild(label);
      railGrid.appendChild(item);
    });
    rail.appendChild(railGrid);
    drawSummary.appendChild(rail);
  };

  const rerenderArrangeList = (activeIndex = -1) => {
    arrangeList.innerHTML = '';

    selectedCards.forEach((card, idx) => {
      const item = document.createElement('article');
      item.className = 'full-arrange-item';
      item.dataset.index = String(idx);
      item.setAttribute('role', 'listitem');
      if (idx === activeIndex) item.classList.add('is-dragging');

      const order = document.createElement('div');
      order.className = 'full-arrange-item__order';
      order.innerHTML = `
        <span class="full-arrange-item__order-index">${idx + 1}</span>
        <span class="full-arrange-item__order-label">${formatCopy(dict.fullReadingPositionPrefix, { index: idx + 1 })}</span>
      `;
      item.appendChild(order);

      item.appendChild(createCardArt(card, 'full-arrange-item__img', { alt: getCardName(card) }));

      const meta = document.createElement('div');
      meta.className = 'full-arrange-item__meta';

      const position = document.createElement('p');
      position.className = 'full-arrange-item__position';
      position.textContent = dict[CELTIC_CROSS_POSITIONS[idx]?.labelKey] || '';
      meta.appendChild(position);

      const name = document.createElement('h3');
      name.className = 'full-arrange-item__name';
      name.textContent = getCardName(card);
      meta.appendChild(name);

      const orientation = document.createElement('p');
      orientation.className = 'full-arrange-item__orientation';
      orientation.textContent = getOrientationLabel(card);
      meta.appendChild(orientation);
      item.appendChild(meta);

      const controls = document.createElement('div');
      controls.className = 'full-arrange-item__controls';

      const handle = document.createElement('button');
      handle.type = 'button';
      handle.className = 'full-arrange-item__handle';
      handle.setAttribute('aria-label', dict.fullReadingDragHandle);
      handle.innerHTML = '<span aria-hidden="true">⋮⋮</span>';
      handle.onpointerdown = (event) => {
        sortingState.pointerId = event.pointerId;
        sortingState.activeIndex = idx;
        sortingState.activeHandle = handle;
        handle.setPointerCapture?.(event.pointerId);
        arrangeList.classList.add('is-sorting');
        rerenderArrangeList(idx);
      };
      controls.appendChild(handle);

      const moveUp = document.createElement('button');
      moveUp.type = 'button';
      moveUp.className = 'full-arrange-item__move';
      moveUp.textContent = '↑';
      moveUp.setAttribute('aria-label', dict.fullReadingMoveUp);
      moveUp.disabled = idx === 0;
      moveUp.onclick = () => {
        selectedCards = moveItem(selectedCards, idx, idx - 1);
        rerenderArrangeList();
      };
      controls.appendChild(moveUp);

      const moveDown = document.createElement('button');
      moveDown.type = 'button';
      moveDown.className = 'full-arrange-item__move';
      moveDown.textContent = '↓';
      moveDown.setAttribute('aria-label', dict.fullReadingMoveDown);
      moveDown.disabled = idx === selectedCards.length - 1;
      moveDown.onclick = () => {
        selectedCards = moveItem(selectedCards, idx, idx + 1);
        rerenderArrangeList();
      };
      controls.appendChild(moveDown);

      item.appendChild(controls);
      arrangeList.appendChild(item);
    });

    updateContinue();
  };

  const syncUi = () => {
    setStageCopy(stage);
    updateCounter();
    updateContinue();
    drawDeck.disabled = stage !== 'draw' || !isPoolReady() || selectedCards.length >= CELTIC_CROSS_COUNT;
    drawDeck.classList.toggle('is-complete', selectedCards.length >= CELTIC_CROSS_COUNT);
    dealStage.hidden = stage === 'arrange';
    dealOrbit.hidden = stage === 'arrange';
    arrangeStage.hidden = stage !== 'arrange';
    renderDrawSummary();
    if (stage === 'arrange') rerenderArrangeList(sortingState.activeIndex);
  };

  const goToArrangeStage = () => {
    stage = 'arrange';
    syncUi();
  };

  const drawNextCard = () => {
    if (stage !== 'draw') return;
    const nextCard = pool[selectedCards.length];
    if (!nextCard) return;
    selectedCards = [...selectedCards, nextCard];
    if (selectedCards.length >= CELTIC_CROSS_COUNT) {
      goToArrangeStage();
      return;
    }
    syncUi();
  };

  const resetFullFlow = () => {
    clearDealTimer();
    stage = 'deal';
    pool = getDrawableCards(FULL_POOL_SIZE);
    selectedCards = [];
    stopSorting();
    renderDealOrbit();
    syncUi();
    if (!isPoolReady()) return;
    dealTimer = window.setTimeout(() => {
      if (isDisposed) return;
      stage = 'draw';
      syncUi();
    }, FULL_DEAL_ANIMATION_DURATION);
  };

  toolbar.hidden = false;
  actions.hidden = false;
  continueBtn.disabled = true;
  document.addEventListener('pointermove', handleSortMove);
  document.addEventListener('pointerup', handleSortEnd);
  document.addEventListener('pointercancel', handleSortEnd);

  shuffleBtn.onclick = () => resetFullFlow();
  drawDeck.onclick = () => drawNextCard();
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
    teardownSortCapture();
    arrangeList.classList.remove('is-sorting');
    document.removeEventListener('pointermove', handleSortMove);
    document.removeEventListener('pointerup', handleSortEnd);
    document.removeEventListener('pointercancel', handleSortEnd);
    shuffleBtn.onclick = null;
    drawDeck.onclick = null;
    continueBtn.onclick = null;
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
  overallFlowCleanup?.();
  overallFlowCleanup = null;
  if (page === 'daily') renderDaily(dict);
  if (page === 'overall' || page === 'full') overallFlowCleanup = renderOverall(dict) || null;
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
