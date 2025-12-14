import { initShell, localizePath, pathHasThaiPrefix, translations } from './common.js';
import { loadTarotData, meowTarotCards, normalizeId } from './data.js';
import { findCardById } from './reading-helpers.js';

const params = new URLSearchParams(window.location.search);
const storageSelection = JSON.parse(sessionStorage.getItem('meowtarot_selection') || 'null');

const CARD_ASSET_BASE = '/assets/meow-v1';
const CARD_BACK = `${CARD_ASSET_BASE}/00-back.webp`;

function normalizeMode(rawMode) {
  const mode = (rawMode || '').toString().trim().toLowerCase();
  if (mode === 'overall') return 'full';
  if (mode === 'full' || mode === 'daily' || mode === 'question') return mode;
  return 'daily';
}

function parseSelectedIds(mode = 'daily') {
  // Support:
  // - daily: ?card=01-the-fool-upright
  // - full/question: ?cards=...,...,...
  // Also allow sessionStorage fallback.
  const paramCard = params.get('card');
  const paramCards = params.get('cards');

  const storedCard = storageSelection?.card;
  const storedCards = storageSelection?.cards;

  let combined;
  if (mode === 'daily') {
    combined = paramCard || paramCards || storedCard || storedCards;
  } else {
    combined = paramCards || storedCards || paramCard || storedCard;
  }

  if (!combined) return [];

  if (Array.isArray(combined)) {
    return combined.map((id) => id?.toString().trim()).filter(Boolean);
  }

  return combined
    .toString()
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

let dataLoaded = false;

const initialMode = normalizeMode(params.get('mode') || storageSelection?.mode || 'daily');

const state = {
  currentLang: params.get('lang') || (pathHasThaiPrefix(window.location.pathname) ? 'th' : 'en'),
  mode: initialMode,
  topic: params.get('topic') || storageSelection?.topic || 'generic',
  selectedIds: parseSelectedIds(initialMode),
};

const readingContent = document.getElementById('reading-content');
const contextCopy = document.getElementById('reading-context');
const readingTitle = document.getElementById('readingTitle');
const newReadingBtn = document.getElementById('newReadingBtn');
const shareBtn = document.getElementById('shareBtn');
const saveBtn = document.getElementById('saveBtn');

function getText(card, keyBase, lang = state.currentLang) {
  const suffix = lang === 'en' ? '_en' : '_th';
  return card?.[`${keyBase}${suffix}`] || '';
}

function getName(card, lang = state.currentLang) {
  if (!card) return '';

  if (lang === 'en') {
    return card.card_name_en || card.name_en || card.name || card.id;
  }

  const thaiName = card.alias_th || card.name_th || card.name || card.card_name_en || card.id;
  const englishName = card.card_name_en || card.name_en || '';
  return englishName ? `${thaiName} (${englishName})` : thaiName;
}

function getOrientationEnglish(card) {
  if (!card) return '';
  const reversed = (card.orientation || '').toString().toLowerCase() === 'reversed';
  return reversed ? 'Reversed' : 'Upright';
}

function findCard(id) {
  return findCardById(meowTarotCards, id, normalizeId);
}

function assetPathForId(id) {
  const normalized = normalizeId(id);
  return `${CARD_ASSET_BASE}/${normalized}.webp`;
}

function uprightFallbackPath(id) {
  const normalized = normalizeId(id);
  const uprightId = normalized.endsWith('-reversed') ? normalized.replace(/-reversed$/, '-upright') : normalized;
  return `${CARD_ASSET_BASE}/${uprightId}.webp`;
}

function buildCardImage(card) {
  const wrap = document.createElement('div');
  wrap.className = 'reading-card-media';

  const img = document.createElement('img');
  img.className = 'reading-card-image';
  img.alt = getName(card);
  img.loading = 'lazy';
  img.decoding = 'async';
  img.referrerPolicy = 'no-referrer';
  // Helps html2canvas and avoids tainting when possible.
  img.crossOrigin = 'anonymous';
  // Safe defaults so the image doesn't explode the layout even without CSS.
  img.style.display = 'block';
  img.style.width = '100%';
  img.style.maxWidth = '360px';
  img.style.height = 'auto';
  img.style.borderRadius = '14px';

  const exactSrc = assetPathForId(card.id);
  const fallbackSrc = uprightFallbackPath(card.id);

  img.src = exactSrc;
  img.onerror = () => {
    // 1) Try upright if reversed image not available
    if (img.src !== fallbackSrc) {
      img.src = fallbackSrc;
      return;
    }
    // 2) Fallback to back
    if (img.src !== CARD_BACK) img.src = CARD_BACK;
  };

  wrap.appendChild(img);
  return wrap;
}

function renderMeta(card, dict) {
  if (!card) return null;

  const element = getText(card, 'element') || card.element || '';
  const planet = getText(card, 'planet') || card.planet || '';
  const numerology = getText(card, 'numerology') || card.numerology || '';

  const hasMeta = Boolean(element || planet || numerology);

  let palette = card.color_palette;
  if (typeof palette === 'string') {
    // Accept JSON-ish array strings or comma-separated.
    try {
      const parsed = JSON.parse(palette);
      if (Array.isArray(parsed)) palette = parsed;
    } catch {
      palette = palette
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
    }
  }
  const colors = Array.isArray(palette) ? palette.filter(Boolean).slice(0, 6) : [];
  const hasColors = colors.length > 0;

  if (!hasMeta && !hasColors) return null;

  const wrap = document.createElement('div');
  wrap.className = 'meta-row';

  const makeBadge = (label, value) => {
    if (!value) return;
    const badge = document.createElement('span');
    badge.className = 'meta-badge';
    badge.innerHTML = `<strong>${label}:</strong> ${value}`;
    wrap.appendChild(badge);
  };

  makeBadge('Element', element);
  makeBadge('Planet', planet);
  makeBadge('Number', numerology);

  if (hasColors) {
    const chip = document.createElement('div');
    chip.className = 'color-chip';

    const label = document.createElement('span');
    label.textContent = dict?.colorsTitle || (state.currentLang === 'th' ? 'สีประจำวัน' : 'Colors');

    const row = document.createElement('span');
    row.className = 'swatch-row';

    colors.forEach((c) => {
      const swatch = document.createElement('span');
      swatch.className = 'swatch';
      swatch.style.background = c;
      swatch.title = c;
      row.appendChild(swatch);
    });

    chip.append(label, row);
    wrap.appendChild(chip);
  }

  return wrap;
}

function buildSuggestion(card, dict, headingText) {
  if (!card) return null;

  const action = getText(card, 'action_prompt');
  const reflection = getText(card, 'reflection_question');
  const affirmation = getText(card, 'affirmation');

  if (!action && !reflection && !affirmation) return null;

  const panel = document.createElement('div');
  panel.className = 'panel';

  const h = document.createElement('h3');
  h.textContent = headingText || dict?.suggestionTitle || (state.currentLang === 'th' ? 'คำแนะนำ' : 'Suggestion');
  panel.appendChild(h);

  const combinedParts = [action, reflection].map((x) => (x || '').trim()).filter(Boolean);
  if (combinedParts.length) {
    const p = document.createElement('p');
    p.textContent = combinedParts.join(' ');
    panel.appendChild(p);
  }

  if (affirmation) {
    const p = document.createElement('p');
    p.innerHTML = `<em>"${affirmation.trim()}"</em>`;
    panel.appendChild(p);
  }

  return panel;
}

function renderDaily(card, dict) {
  if (!readingContent) return;
  readingContent.innerHTML = '';

  const panel = document.createElement('div');
  panel.className = 'panel';

  // Header block: image + name + orientation + imply line
  const header = document.createElement('div');
  header.className = 'card-heading';

  header.appendChild(buildCardImage(card));

  const title = document.createElement('h2');
  title.textContent = `${getName(card)} — ${getOrientationEnglish(card)}`;

  const imply = getText(card, 'tarot_imply');
  const implyLine = document.createElement('p');
  implyLine.className = 'keywords';
  implyLine.textContent = imply;

  header.append(title);
  if (imply) header.appendChild(implyLine);

  panel.appendChild(header);

  // Main daily message
  const main = getText(card, 'standalone_present') || getText(card, 'tarot_imply_present');
  if (main) {
    const p = document.createElement('p');
    p.className = 'lede';
    p.textContent = main;
    panel.appendChild(p);
  }

  const meta = renderMeta(card, dict);
  if (meta) panel.appendChild(meta);

  readingContent.appendChild(panel);

  // Suggestion
  const suggestionHeading = state.currentLang === 'th' ? 'คำแนะนำวันนี้' : (dict?.suggestionTitle || "Today's Guidance");
  const suggestion = buildSuggestion(card, dict, suggestionHeading);
  if (suggestion) readingContent.appendChild(suggestion);
}

function getPositionText(card, position, topic, mode) {
  if (!card) return '';

  const posKey = position.toLowerCase();

  // Question mode: use topic_* fields when available.
  if (mode === 'question' && topic && topic !== 'generic') {
    const topicKey = `${topic}_${posKey}`;
    const topicText = getText(card, topicKey);
    if (topicText) return topicText;
  }

  // Full reading: standalone_* per position.
  const standaloneText = getText(card, `standalone_${posKey}`);
  if (standaloneText) return standaloneText;

  // Fallbacks
  if (posKey === 'present') return getText(card, 'standalone_present');
  if (posKey === 'past') return getText(card, 'standalone_past');
  if (posKey === 'future') return getText(card, 'standalone_future');

  return '';
}

function buildThreeCardBoxes(cards, dict, mode) {
  const positions = ['past', 'present', 'future'];
  const wrap = document.createElement('div');
  wrap.className = 'reading-three';

  cards.slice(0, 3).forEach((card, idx) => {
    const position = positions[idx];

    const panel = document.createElement('div');
    panel.className = 'panel';

    const label = document.createElement('h3');
    label.textContent = dict?.[position] || position;
    panel.appendChild(label);

    panel.appendChild(buildCardImage(card));

    const nameLine = document.createElement('p');
    nameLine.className = 'lede';
    nameLine.textContent = `${getName(card)} — ${getOrientationEnglish(card)}`;
    panel.appendChild(nameLine);

    const text = getPositionText(card, position, state.topic, mode);
    if (text) {
      const p = document.createElement('p');
      p.textContent = text;
      panel.appendChild(p);
    }

    wrap.appendChild(panel);
  });

  return wrap;
}

function renderFull(cards, dict) {
  if (!readingContent) return;
  readingContent.innerHTML = '';

  const picked = cards.slice(0, 3);
  const boxes = buildThreeCardBoxes(picked, dict, 'full');
  readingContent.appendChild(boxes);

  // Summary / Your Fortune
  const positions = ['past', 'present', 'future'];
  const summaries = picked
    .map((card, idx) => getText(card, `reading_summary_${positions[idx]}`))
    .map((s) => (s || '').trim())
    .filter(Boolean);

  if (summaries.length) {
    const summaryPanel = document.createElement('div');
    summaryPanel.className = 'panel';

    const h = document.createElement('h3');
    h.textContent = state.currentLang === 'th' ? 'ดวงของคุณวันนี้' : 'Your Fortune';
    summaryPanel.appendChild(h);

    const p = document.createElement('p');
    p.textContent = summaries.join(' ').replace(/\s+/g, ' ').trim();
    summaryPanel.appendChild(p);

    readingContent.appendChild(summaryPanel);
  }

  // Global suggestion anchored on Present
  const present = picked[1] || picked[0];
  const suggestionHeading = dict?.guidanceHeading || dict?.suggestionTitle || (state.currentLang === 'th' ? 'คำแนะนำ' : 'Guidance');
  const suggestion = buildSuggestion(present, dict, suggestionHeading);
  if (suggestion) readingContent.appendChild(suggestion);
}

function renderQuestion(cards, dict) {
  if (!readingContent) return;
  readingContent.innerHTML = '';

  const picked = cards.slice(0, 3);
  const boxes = buildThreeCardBoxes(picked, dict, 'question');
  readingContent.appendChild(boxes);

  // Suggestion anchored on Present
  const present = picked[1] || picked[0];
  const suggestionHeading = dict?.guidanceHeading || dict?.suggestionTitle || (state.currentLang === 'th' ? 'คำแนะนำ' : 'Guidance');
  const suggestion = buildSuggestion(present, dict, suggestionHeading);
  if (suggestion) readingContent.appendChild(suggestion);
}

function renderReading(dict) {
  if (!readingContent) return;

  const cards = state.selectedIds.map((id) => findCard(id)).filter(Boolean);

  if (!cards.length) {
    const message = dict?.missingSelection || 'No cards found. Please draw cards first.';
    readingContent.innerHTML = `<div class="panel"><p class="lede">${message}</p></div>`;
    return;
  }

  if (state.mode === 'daily') {
    renderDaily(cards[0], dict);
    return;
  }

  if ((state.mode === 'full' || state.mode === 'overall') && cards.length >= 3) {
    renderFull(cards, dict);
    return;
  }

  if (state.mode === 'question' && cards.length >= 3) {
    renderQuestion(cards, dict);
    return;
  }

  // Fallbacks if something unexpected is passed.
  if (cards.length === 1) {
    renderDaily(cards[0], dict);
    return;
  }

  if (cards.length >= 3) {
    renderFull(cards, dict);
    return;
  }

  const message = dict?.missingSelection || 'No cards found. Please draw cards first.';
  readingContent.innerHTML = `<div class="panel"><p class="lede">${message}</p></div>`;
}

function handleShare() {
  const url = window.location.href;
  if (navigator.share) {
    navigator
      .share({ title: 'MeowTarot', text: translations[state.currentLang].yourReading, url })
      .catch(() => copyLink(url));
  } else {
    copyLink(url);
  }
}

function copyLink(url) {
  navigator.clipboard.writeText(url).then(() => alert(translations[state.currentLang].shareFallback));
}

function saveImage() {
  if (!readingContent || typeof html2canvas !== 'function') return;

  html2canvas(readingContent, {
    backgroundColor: '#0b102b',
    scale: 2,
    useCORS: true,
    allowTaint: true,
  }).then((canvas) => {
    const link = document.createElement('a');
    link.download = `meowtarot-reading-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  });
}

function updateContextCopy(dict = translations[state.currentLang]) {
  if (!contextCopy) return;
  if (state.mode === 'question') {
    contextCopy.textContent = dict.contextQuestion;
  } else {
    contextCopy.textContent = dict.contextDaily;
  }
}

function handleTranslations(dict) {
  updateContextCopy(dict);

  if (readingTitle) {
    if (state.mode === 'question') {
      readingTitle.textContent = dict.questionTitle;
    } else if (state.mode === 'full' || state.mode === 'overall') {
      readingTitle.textContent = dict.overallTitle;
    } else {
      readingTitle.textContent = dict.dailyTitle;
    }
  }

  if (dataLoaded) {
    renderReading(dict);
  }
}

function init() {
  initShell(state, handleTranslations, 'reading');

  // Recompute selected ids after shell picks language + mode.
  state.mode = normalizeMode(params.get('mode') || storageSelection?.mode || state.mode);
  state.selectedIds = parseSelectedIds(state.mode);

  newReadingBtn?.addEventListener('click', () => {
    const target =
      state.mode === 'question'
        ? '/question.html'
        : state.mode === 'full' || state.mode === 'overall'
          ? '/overall.html'
          : '/daily.html';

    window.location.href = localizePath(target, state.currentLang);
  });

  shareBtn?.addEventListener('click', handleShare);
  saveBtn?.addEventListener('click', saveImage);

  loadTarotData()
    .then(() => {
      dataLoaded = true;
      renderReading(translations[state.currentLang] || translations.en);
    })
    .catch(() => {
      dataLoaded = true;
      renderReading(translations[state.currentLang] || translations.en);
    });
}

document.addEventListener('DOMContentLoaded', init);
