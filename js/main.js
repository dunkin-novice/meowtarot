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
const OVERALL_SELECTION_COUNT = CELTIC_CROSS_COUNT;
const QUESTION_SELECTION_COUNT = 3;
const FULL_POOL_SIZE = 50;
const ORIENTATION_REVERSED_PROBABILITY = 0.5;
const STORAGE_KEY = 'meowtarot_selection';
const DAILY_SELECTION_MAX = 1;
const DEAL_STAGGER = 160;
const STACK_DURATION = 520;
const CARD_BACK_URL = getCardBackUrl();
const CARD_BACK_FALLBACK_URL = getCardBackFallbackUrl();
const FULL_DEAL_ENTRANCE_DURATION = 620;
const FULL_SHUFFLE_VISUAL_DURATION = 1450;
const FULL_READY_PULSE_DURATION = 620;

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

  const isThai = state.currentLang === 'th';
  const fullState = {
    phase: 'preDeal',
    pool: [],
    selectedCards: [],
    activeCard: null,
    activeCardFlipped: false,
    isDrawing: false,
  };

  const fullLabels = {
    previewIdle: isThai ? 'แตะกองไพ่เพื่อเปิดไพ่ 1 ใบ แล้วแตะไพ่เพื่อยืนยัน' : 'Tap the deck to reveal one card, then tap the card to confirm it.',
    previewReady: isThai ? 'แตะไพ่ที่เปิดอยู่เพื่อยืนยันการเลือกใบนี้' : 'Tap the revealed card to confirm this pick.',
    previewComplete: isThai ? 'เลือกครบ 10 ใบแล้ว พร้อมไปยังคำทำนาย' : 'All 10 cards selected. Continue to your reading.',
    selectedHeading: isThai ? 'ไพ่ที่เลือกแล้ว' : 'Selected cards',
    selectedEmpty: isThai ? 'ไพ่ที่ยืนยันแล้วจะปรากฏที่นี่' : 'Confirmed cards will appear here.',
    confirmHint: isThai ? 'แตะเพื่อยืนยัน' : 'Tap to confirm',
    drawAria: isThai ? 'กองไพ่สำหรับสุ่มไพ่ชุดถัดไป' : 'Deck stack for drawing the next card',
    previewTitle: isThai ? 'ไพ่ที่เปิดอยู่' : 'Revealed card',
  };

  dealBtn.textContent = isThai ? 'หยิบไพ่ของคุณ' : 'Draw your cards';
  shuffleBtn.textContent = isThai ? 'เริ่มใหม่' : 'Shuffle / Reset';
  flow.querySelectorAll('.deck-stack-card').forEach(applyCardBackBackground);

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const ensureDeckStackCards = (deckEl, count = 6) => {
    if (!deckEl) return;
    while (deckEl.children.length < count) {
      const layer = document.createElement('span');
      layer.className = 'deck-stack-card';
      deckEl.appendChild(layer);
    }
  };

  const getRemainingCount = () => fullState.pool.length;
  const getSelectedIds = () => fullState.selectedCards.map((card) => card?.id).filter(Boolean);

  const applyDisabledState = (el, isDisabled) => {
    el.disabled = !!isDisabled;
    el.classList.toggle('is-disabled', !!isDisabled);
  };

  const buildFullCardImage = (card, className) => {
    const img = document.createElement('img');
    img.className = className;
    img.alt = card?.card_name_en || card?.name_en || card?.name_th || card?.id || '';
    applyImageFallback(img, getCardImageUrl(card, { orientation: card?.orientation || 'upright' }), [CARD_BACK_URL, CARD_BACK_FALLBACK_URL].filter(Boolean));
    return img;
  };

  const createThumbnail = (card, order) => {
    const thumb = document.createElement('div');
    thumb.className = 'full-picked-thumb';
    thumb.dataset.cardId = card?.id || '';

    const imageWrap = document.createElement('div');
    imageWrap.className = 'full-picked-thumb__image';
    imageWrap.appendChild(buildFullCardImage(card, 'full-picked-thumb__img'));

    const orderBadge = document.createElement('span');
    orderBadge.className = 'full-picked-thumb__badge';
    orderBadge.textContent = `${order + 1}`;
    imageWrap.appendChild(orderBadge);

    thumb.appendChild(imageWrap);
    return thumb;
  };

  const createActiveCard = (card) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'full-draw-card';
    button.setAttribute('aria-label', fullLabels.confirmHint);
    button.disabled = fullState.phase !== 'dealt' || fullState.isDrawing || !fullState.activeCardFlipped;

    const inner = document.createElement('span');
    inner.className = 'full-draw-card__inner';

    const backFace = document.createElement('span');
    backFace.className = 'full-draw-card__face full-draw-card__face--back';
    const backImage = Object.assign(document.createElement('img'), { className: 'full-draw-card__back' });
    applyCardBackBackground(backImage);
    backFace.appendChild(backImage);

    const frontFace = document.createElement('span');
    frontFace.className = 'full-draw-card__face full-draw-card__face--front';
    frontFace.appendChild(buildFullCardImage(card, 'full-draw-card__front'));

    const hint = document.createElement('span');
    hint.className = 'full-draw-card__hint';
    hint.textContent = fullLabels.confirmHint;
    frontFace.appendChild(hint);

    inner.append(backFace, frontFace);
    button.appendChild(inner);
    button.classList.toggle('is-flipped', fullState.activeCardFlipped);
    button.onclick = () => {
      if (button.disabled || !fullState.activeCard) return;
      fullState.selectedCards = [...fullState.selectedCards, fullState.activeCard];
      fullState.activeCard = null;
      fullState.activeCardFlipped = false;
      renderFullUi();
    };

    return button;
  };

  const renderSelectedRow = () => {
    const row = document.createElement('div');
    row.className = 'full-picked-row';

    const heading = document.createElement('div');
    heading.className = 'full-picked-row__heading';
    heading.textContent = `${fullLabels.selectedHeading} (${fullState.selectedCards.length}/${CELTIC_CROSS_COUNT})`;
    row.appendChild(heading);

    const list = document.createElement('div');
    list.className = 'full-picked-row__list';
    if (!fullState.selectedCards.length) {
      const empty = document.createElement('p');
      empty.className = 'full-picked-row__empty';
      empty.textContent = fullLabels.selectedEmpty;
      list.appendChild(empty);
    } else {
      fullState.selectedCards.forEach((card, order) => {
        list.appendChild(createThumbnail(card, order));
      });
    }
    row.appendChild(list);
    return row;
  };

  const renderBoardSurface = () => {
    board.textContent = '';

    const surface = document.createElement('div');
    surface.className = 'full-selection-stage';

    const preview = document.createElement('div');
    preview.className = 'full-selection-preview';

    const previewTitle = document.createElement('div');
    previewTitle.className = 'full-selection-preview__title';
    previewTitle.textContent = fullLabels.previewTitle;
    preview.appendChild(previewTitle);

    const previewBody = document.createElement('div');
    previewBody.className = 'full-selection-preview__body';
    if (fullState.activeCard) {
      previewBody.appendChild(createActiveCard(fullState.activeCard));
    } else {
      const idle = document.createElement('p');
      idle.className = 'full-selection-preview__message';
      idle.textContent = fullState.selectedCards.length === CELTIC_CROSS_COUNT
        ? fullLabels.previewComplete
        : fullLabels.previewIdle;
      previewBody.appendChild(idle);
    }

    const previewMeta = document.createElement('p');
    previewMeta.className = 'full-selection-preview__meta';
    previewMeta.textContent = fullState.activeCard
      ? fullLabels.previewReady
      : (fullState.selectedCards.length === CELTIC_CROSS_COUNT ? fullLabels.previewComplete : `${getRemainingCount()} ${isThai ? 'ใบในกองที่เหลือ' : 'cards remaining in the pool'}`);
    preview.append(previewBody, previewMeta);

    surface.append(preview, renderSelectedRow());
    board.appendChild(surface);
  };

  const renderFullUi = () => {
    const selectedCount = fullState.selectedCards.length;
    const isPreDeal = fullState.phase === 'preDeal';
    const isDealt = fullState.phase === 'dealt';
    const canDraw = isDealt && !fullState.isDrawing && !fullState.activeCard && selectedCount < CELTIC_CROSS_COUNT && getRemainingCount() > 0;
    const canContinue = isDealt && !fullState.isDrawing && !fullState.activeCard && selectedCount === CELTIC_CROSS_COUNT;

    flow.dataset.fullPhase = fullState.phase;
    counter.textContent = `${selectedCount}/${CELTIC_CROSS_COUNT}`;

    entry.hidden = !isPreDeal;
    heroDeck.hidden = !isPreDeal;
    toolbar.hidden = isPreDeal;
    actions.hidden = isPreDeal;
    board.hidden = isPreDeal;

    centerDeck.hidden = !isDealt;
    centerDeck.classList.toggle('is-clickable', canDraw);
    centerDeck.setAttribute('aria-hidden', String(!isDealt));
    centerDeck.setAttribute('aria-disabled', String(!canDraw));
    centerDeck.tabIndex = canDraw ? 0 : -1;

    animationLayer.hidden = true;
    animationLayer.textContent = '';

    applyDisabledState(dealBtn, !isPreDeal || fullState.isDrawing);
    applyDisabledState(shuffleBtn, !isDealt || fullState.isDrawing);
    applyDisabledState(continueBtn, !canContinue);

    renderBoardSurface();
  };

  const resetFullState = async ({ preservePhase = false } = {}) => {
    fullState.pool = getDrawableCards(FULL_POOL_SIZE);
    fullState.selectedCards = [];
    fullState.activeCard = null;
    fullState.activeCardFlipped = false;
    fullState.isDrawing = false;
    if (!preservePhase) fullState.phase = 'dealt';
    renderFullUi();
    await wait(0);
  };

  const drawNextCard = async () => {
    if (fullState.phase !== 'dealt' || fullState.isDrawing || fullState.activeCard || fullState.selectedCards.length >= CELTIC_CROSS_COUNT || !fullState.pool.length) return;
    const nextCard = fullState.pool.shift();
    if (!nextCard) return;

    fullState.activeCard = nextCard;
    fullState.activeCardFlipped = false;
    fullState.isDrawing = true;
    renderFullUi();

    await wait(prefersReducedMotion ? 0 : 40);
    fullState.activeCardFlipped = true;
    fullState.isDrawing = false;
    renderFullUi();
  };

  const startFullDeal = async () => {
    if (fullState.phase !== 'preDeal' || fullState.isDrawing || !state.cards.length) return;
    await resetFullState();
  };

  const startFullShuffle = async () => {
    if (fullState.phase !== 'dealt' || fullState.isDrawing) return;
    await resetFullState({ preservePhase: true });
  };

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const handleDeckActivate = () => {
    void drawNextCard();
  };

  centerDeck.addEventListener('click', handleDeckActivate);
  centerDeck.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    handleDeckActivate();
  });
  centerDeck.setAttribute('role', 'button');
  centerDeck.setAttribute('aria-label', fullLabels.drawAria);

  dealBtn.onclick = () => {
    void startFullDeal();
  };
  shuffleBtn.onclick = () => {
    void startFullShuffle();
  };
  continueBtn.onclick = () => {
    const selectedIds = getSelectedIds();
    if (fullState.phase !== 'dealt' || fullState.isDrawing || fullState.activeCard || selectedIds.length !== CELTIC_CROSS_COUNT) return;
    saveSelectionAndGo({ mode: 'full', spread: 'story', topic: 'generic', cards: selectedIds });
  };

  ensureDeckStackCards(heroDeck);
  ensureDeckStackCards(centerDeck);
  flow.querySelectorAll('.deck-stack-card').forEach(applyCardBackBackground);

  fullState.phase = 'preDeal';
  fullState.pool = [];
  fullState.selectedCards = [];
  fullState.activeCard = null;
  fullState.activeCardFlipped = false;
  fullState.isDrawing = false;
  renderFullUi();
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
