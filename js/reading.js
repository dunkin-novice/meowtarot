import { initShell, localizePath, pathHasThaiPrefix, translations } from './common.js';
import { loadTarotData, meowTarotCards, normalizeId } from './data.js';
import { findCardById } from './reading-helpers.js';

/**
 * Card images
 * - Current: you said upright & reversed can use same file for now.
 * - Future-ready: if /assets/meow-v1/<id>.webp exists (incl. reversed), it will load.
 *   If missing (common now for reversed), it auto-falls-back to the upright file.
 */
const CARD_IMAGE_BASE = '/assets/meow-v1/';

const readingTitle = document.getElementById('reading-title');
const contextCopy = document.getElementById('context-copy');
const readingContent = document.getElementById('reading-content');

const newReadingBtn = document.getElementById('new-reading-btn');
const saveImageBtn = document.getElementById('save-image-btn');
const shareReadingBtn = document.getElementById('share-reading-btn');

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeMode(raw) {
  const val = String(raw ?? '').toLowerCase().trim();
  if (val === 'daily') return 'daily';
  if (val === 'question') return 'question';
  // treat old "overall" as "full"
  if (val === 'full' || val === 'overall' || val === 'life') return 'full';
  return 'daily';
}

function getInitialLang() {
  return pathHasThaiPrefix(window.location.pathname) ? 'th' : 'en';
}

const params = new URLSearchParams(window.location.search);
const storedSelection = safeJsonParse(sessionStorage.getItem('meowtarot_selection')) || {};

const state = {
  currentLang: getInitialLang(),
  mode: normalizeMode(params.get('mode') || storedSelection.mode || 'daily'),
  topic: String(params.get('topic') || storedSelection.topic || 'love').toLowerCase(),
  selectedIds: [],
};

function parseSelectedIds() {
  const urlCards = params.get('cards'); // comma separated
  const urlCard = params.get('card'); // single
  const storedCards = storedSelection.cards ?? storedSelection.card;

  let combined = '';
  if (urlCards) combined = urlCards;
  else if (urlCard) combined = urlCard;
  else if (Array.isArray(storedCards)) combined = storedCards.join(',');
  else if (typeof storedCards === 'string') combined = storedCards;

  return String(combined || '')
    .split(',')
    .map((val) => val.trim())
    .filter(Boolean);
}

function getText(card, baseKey) {
  if (!card) return '';
  const key = `${baseKey}_${state.currentLang}`;
  return card[key] || '';
}

function getName(card) {
  if (!card) return '';
  if (state.currentLang === 'th') {
    const th = card.alias_th || '';
    const en = card.card_name_en || '';
    if (th && en) return `${th} (${en})`;
    return th || en || '';
  }
  return card.card_name_en || card.alias_th || '';
}

function isReversed(card) {
  const id = String(card?.card_id || card?.id || '');
  return id.endsWith('-reversed') || String(card?.orientation || '').toLowerCase() === 'reversed';
}

function getOrientationLabel(card) {
  // Per your spec: show Upright / Reversed (even in TH UI)
  return isReversed(card) ? 'Reversed' : 'Upright';
}

function getCardId(card) {
  return String(card?.card_id || card?.id || card?.legacy_id || '');
}

function getCardBaseIdFromId(id) {
  return String(id || '').replace(/-(upright|reversed)$/i, '');
}

function getCardImageFiles(card) {
  const id = getCardId(card);
  const base = getCardBaseIdFromId(id);
  // exact file: 04-the-empress-reversed.webp (future)
  const exactFile = `${id}.webp`;
  // fallback: 04-the-empress-upright.webp (current default)
  const uprightFile = `${base}-upright.webp`;
  return { exactFile, uprightFile };
}

function createCardImage(card, variant = 'hero') {
  const wrap = document.createElement('div');
  wrap.className = variant === 'thumb' ? 'reading-card-thumb' : 'reading-card-hero';

  const img = document.createElement('img');
  img.alt = getName(card);

  // Use your CSS hooks
  if (variant === 'thumb') {
    img.className = 'tarot-card-img--thumb';
    img.loading = 'lazy';
  } else {
    img.className = 'card-art-img';
  }

  const { exactFile, uprightFile } = getCardImageFiles(card);
  img.src = `${CARD_IMAGE_BASE}${exactFile}`;

  // Fallback to upright art if reversed file doesn't exist (current situation).
  img.addEventListener('error', () => {
    if (img.dataset.fallbackDone) return;
    img.dataset.fallbackDone = '1';
    img.src = `${CARD_IMAGE_BASE}${uprightFile}`;
  });

  wrap.appendChild(img);
  return wrap;
}

function createMetaBlock(card, dict) {
  if (!card) return null;

  const chips = [];
  if (card.element) chips.push(`Element: ${card.element}`);
  if (card.planet) chips.push(`Planet: ${card.planet}`);
  if (card.numerology_value != null && String(card.numerology_value).trim() !== '') {
    chips.push(`No. ${card.numerology_value}`);
  }

  let colors = card.color_palette;
  if (typeof colors === 'string') {
    // allow "['#fff', '#000']" or "#fff,#000" etc.
    const maybeJson = safeJsonParse(colors);
    colors = Array.isArray(maybeJson) ? maybeJson : colors.split(',').map((v) => v.trim());
  }
  if (!Array.isArray(colors)) colors = [];
  colors = colors.filter(Boolean);

  if (!chips.length && !colors.length) return null;

  const panel = document.createElement('div');
  panel.className = 'panel';

  const row = document.createElement('div');
  row.className = 'meta-row';

  chips.forEach((text) => {
    const badge = document.createElement('div');
    badge.className = 'meta-badge';
    badge.textContent = text;
    row.appendChild(badge);
  });

  panel.appendChild(row);

  if (colors.length) {
    const colorsRow = document.createElement('div');
    colorsRow.className = 'meta-row';

    colors.slice(0, 8).forEach((hex) => {
      const badge = document.createElement('div');
      badge.className = 'meta-badge';

      const sw = document.createElement('span');
      sw.className = 'swatch';
      sw.style.backgroundColor = hex;

      const label = document.createElement('span');
      label.textContent = hex;

      badge.appendChild(sw);
      badge.appendChild(label);
      colorsRow.appendChild(badge);
    });

    panel.appendChild(colorsRow);
  }

  return panel;
}

function createSuggestionPanel(card, dict, headingText) {
  if (!card) return null;

  const action = getText(card, 'action_prompt');
  const reflection = getText(card, 'reflection_question');
  const affirmation = getText(card, 'affirmation');

  const combined = [action, reflection].filter(Boolean).join(' ').trim();
  if (!combined && !affirmation) return null;

  const panel = document.createElement('div');
  panel.className = 'panel';

  const h = document.createElement('h3');
  h.textContent = headingText;
  panel.appendChild(h);

  if (combined) {
    const p = document.createElement('p');
    p.textContent = combined;
    panel.appendChild(p);
  }

  if (affirmation) {
    const p = document.createElement('p');
    const em = document.createElement('em');
    em.textContent = `"${affirmation.trim()}"`;
    p.appendChild(em);
    panel.appendChild(p);
  }

  return panel;
}

function createDailyReading(card, dict) {
  const container = document.createElement('div');
  container.className = 'card-result';

  const header = document.createElement('div');
  header.className = 'panel';

  header.appendChild(createCardImage(card, 'hero'));

  const heading = document.createElement('div');
  heading.className = 'card-heading';

  const h2 = document.createElement('h2');
  h2.textContent = `${getName(card)} — ${getOrientationLabel(card)}`;
  heading.appendChild(h2);

  const imply = getText(card, 'tarot_imply');
  if (imply) {
    const p = document.createElement('p');
    p.className = 'keywords';
    p.textContent = imply;
    heading.appendChild(p);
  }

  header.appendChild(heading);

  const main = getText(card, 'standalone_present');
  if (main) {
    const p = document.createElement('p');
    p.className = 'lede';
    p.textContent = main;
    header.appendChild(p);
  }

  container.appendChild(header);

  const meta = createMetaBlock(card, dict);
  if (meta) container.appendChild(meta);

  const suggestionHeading = dict.dailySuggestionTitle || (state.currentLang === 'th' ? 'คำแนะนำวันนี้' : 'Suggestion');
  const suggestion = createSuggestionPanel(card, dict, suggestionHeading);
  if (suggestion) container.appendChild(suggestion);

  return container;
}

function createThreeCardBoxes(cards, dict, mode) {
  const wrap = document.createElement('div');
  wrap.className = 'results-grid';

  const positions = ['past', 'present', 'future'];

  positions.forEach((pos, idx) => {
    const card = cards[idx];
    if (!card) return;

    const panel = document.createElement('div');
    panel.className = 'result-card';

    const label = document.createElement('div');
    label.className = 'label';
    label.textContent = dict[pos] || pos.toUpperCase();
    panel.appendChild(label);

    panel.appendChild(createCardImage(card, 'thumb'));

    const title = document.createElement('h5');
    title.textContent = `${getName(card)} — ${getOrientationLabel(card)}`;
    panel.appendChild(title);

    let text = '';
    if (mode === 'question') {
      const topicKey = `${state.topic}_${pos}`; // love_past, career_present, finance_future
      text = getText(card, topicKey) || getText(card, `standalone_${pos}`);
    } else {
      text = getText(card, `standalone_${pos}`);
    }

    const p = document.createElement('p');
    p.textContent = text || '';
    panel.appendChild(p);

    wrap.appendChild(panel);
  });

  return wrap;
}

function createFullSummary(cards, dict) {
  const positions = ['past', 'present', 'future'];
  const summaryText = positions
    .map((pos, idx) => getText(cards[idx], `reading_summary_${pos}`))
    .filter(Boolean)
    .join(' ')
    .trim();

  if (!summaryText) return null;

  const panel = document.createElement('div');
  panel.className = 'panel';

  const h = document.createElement('h3');
  h.textContent = dict.yourFortuneTitle || (state.currentLang === 'th' ? 'ดวงของคุณ' : 'Your Fortune');
  panel.appendChild(h);

  const p = document.createElement('p');
  p.textContent = summaryText;
  panel.appendChild(p);

  return panel;
}

function renderReading(dict) {
  if (!readingContent) return;

  readingContent.innerHTML = '';

  if (!state.selectedIds.length) {
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.textContent = dict.noCards || 'No cards found. Please go back and select again.';
    readingContent.appendChild(panel);
    return;
  }

  // Find cards (robust even if helpers not updated yet)
  const resolved = state.selectedIds
    .map((id) => {
      const byHelper = findCardById(meowTarotCards, id, normalizeId);
      if (byHelper) return byHelper;

      const target = normalizeId(String(id));
      return (
        meowTarotCards.find((c) => normalizeId(String(c.card_id || c.id || '')) === target)
        || null
      );
    })
    .filter(Boolean);

  if (!resolved.length) {
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.textContent = dict.noCards || 'No cards found. Please go back and select again.';
    readingContent.appendChild(panel);
    return;
  }

  if (state.mode === 'daily') {
    const card = resolved[0];
    readingContent.appendChild(createDailyReading(card, dict));
    return;
  }

  // Both full + question are 3-card
  const cards = resolved.slice(0, 3);

  // A) 3 boxes Past/Present/Future
  readingContent.appendChild(createThreeCardBoxes(cards, dict, state.mode));

  // B) Full-only summary "Your Fortune"
  if (state.mode === 'full') {
    const summary = createFullSummary(cards, dict);
    if (summary) readingContent.appendChild(summary);
  }

  // C) Suggestion (anchor on Present card)
  const presentCard = cards[1] || cards[0];
  const suggestionHeading =
    dict.suggestionTitle || (state.currentLang === 'th' ? 'คำแนะนำ' : 'Suggestion');

  const suggestion = createSuggestionPanel(presentCard, dict, suggestionHeading);
  if (suggestion) readingContent.appendChild(suggestion);

  // Optional meta: show meta for present card
  const meta = createMetaBlock(presentCard, dict);
  if (meta) readingContent.appendChild(meta);
}

function updateHeader(dict) {
  if (readingTitle) {
    if (state.mode === 'daily') readingTitle.textContent = dict.dailyTitle || 'Daily Reading';
    else if (state.mode === 'question') readingTitle.textContent = dict.questionTitle || 'Ask a Question';
    else readingTitle.textContent = dict.overallTitle || 'Full Reading';
  }

  if (contextCopy) {
    if (state.mode === 'daily') contextCopy.textContent = dict.contextDaily || '';
    else if (state.mode === 'question') contextCopy.textContent = dict.contextQuestion || '';
    else contextCopy.textContent = dict.overallDesc || '';
  }
}

function handleTranslations(lang) {
  state.currentLang = lang;
  const dict = translations[lang] || translations.en;

  updateHeader(dict);
  renderReading(dict);

  // Button labels (if they exist)
  if (newReadingBtn) newReadingBtn.textContent = dict.newReading || 'New reading';
  if (saveImageBtn) saveImageBtn.textContent = dict.saveImage || 'Save image';
  if (shareReadingBtn) shareReadingBtn.textContent = dict.share || 'Share';
}

function handleNewReading() {
  // Clear previous selection so board starts fresh
  sessionStorage.removeItem('meowtarot_selection');

  let target = '/daily.html';
  if (state.mode === 'question') target = '/question.html';
  if (state.mode === 'full') target = '/overall.html';

  window.location.href = localizePath(target, state.currentLang);
}

async function handleSaveImage() {
  if (typeof window.html2canvas !== 'function') {
    alert('html2canvas is not loaded on this page.');
    return;
  }

  const target = document.querySelector('main') || document.body;
  const canvas = await window.html2canvas(target, { scale: 2 });
  const link = document.createElement('a');
  link.download = `meowtarot-reading-${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

async function handleShare() {
  const dict = translations[state.currentLang] || translations.en;

  const shareData = {
    title: dict.siteTitle || 'Meow Tarot',
    text: dict.shareCopy || 'My tarot reading on Meow Tarot ✨',
    url: window.location.href,
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return;
    } catch {
      // user cancelled
    }
  }

  try {
    await navigator.clipboard.writeText(window.location.href);
    alert(dict.copied || 'Link copied!');
  } catch {
    alert('Unable to copy link.');
  }
}

async function init() {
  await loadTarotData();

  state.selectedIds = parseSelectedIds();

  // Highlight nav based on mode
  const activePage = state.mode === 'question' ? 'question' : state.mode === 'full' ? 'overall' : 'daily';

  initShell({
    activePage,
    initialLang: state.currentLang,
    onLangChange: handleTranslations,
  });

  handleTranslations(state.currentLang);

  if (newReadingBtn) newReadingBtn.addEventListener('click', handleNewReading);
  if (saveImageBtn) saveImageBtn.addEventListener('click', handleSaveImage);
  if (shareReadingBtn) shareReadingBtn.addEventListener('click', handleShare);
}

init();
