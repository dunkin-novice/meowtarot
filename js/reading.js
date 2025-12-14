import { initShell, localizePath, pathHasThaiPrefix, translations } from './common.js';
import { loadTarotData, meowTarotCards, normalizeId, getActiveDeck, getCardBackUrl } from './data.js';
import { findCardById } from './reading-helpers.js';

const params = new URLSearchParams(window.location.search);
const storageSelection = JSON.parse(sessionStorage.getItem('meowtarot_selection') || 'null');

let dataLoaded = false;

function normalizeMode(raw) {
  const v = String(raw || '').toLowerCase().trim();
  if (v === 'daily') return 'daily';
  if (v === 'question') return 'question';
  if (v === 'full' || v === 'overall' || v === 'life') return 'full';
  return 'daily';
}

function parseSelectedIds() {
  const urlCards = params.get('cards');
  const urlCard = params.get('card');
  const storedCards = storageSelection?.cards ?? storageSelection?.card;

  let combined = '';
  if (urlCards) combined = urlCards;
  else if (urlCard) combined = urlCard;
  else if (Array.isArray(storedCards)) combined = storedCards.join(',');
  else if (typeof storedCards === 'string') combined = storedCards;

  if (!combined) return [];
  return String(combined)
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

const state = {
  currentLang: params.get('lang') || (pathHasThaiPrefix(window.location.pathname) ? 'th' : 'en'),
  mode: normalizeMode(params.get('mode') || storageSelection?.mode || 'daily'),
  topic: String(params.get('topic') || storageSelection?.topic || 'generic').toLowerCase(),
  selectedIds: parseSelectedIds(),
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
    return card.card_name_en || card.name_en || card.name || card.card_id || card.id;
  }

  const thaiName = card.alias_th || card.name_th || card.name || card.card_name_en || card.card_id || card.id;
  const englishName = card.card_name_en || card.name_en || '';
  return englishName ? `${thaiName} (${englishName})` : thaiName;
}

function getCardId(card) {
  return String(card?.card_id || card?.id || '');
}

function isReversed(card) {
  const id = getCardId(card);
  if (id.endsWith('-reversed')) return true;
  return String(card?.orientation || '').toLowerCase() === 'reversed';
}

// Spec: show Upright/Reversed label (EN words) even in TH UI
function getOrientationLabel(card) {
  return isReversed(card) ? 'Reversed' : 'Upright';
}

function getDeckAssetsBase() {
  try {
    return (getActiveDeck()?.assetsBase || '/assets/meow-v1').replace(/\/$/, '');
  } catch {
    return '/assets/meow-v1';
  }
}

// Spec: “same file for upright & reversed for now” → always load upright image file
function getImageIdForDisplay(card) {
  const raw = String(card?.image_id || card?.card_id || card?.id || '');
  if (!raw) return '';
  if (raw.endsWith('-reversed')) return raw.replace(/-reversed$/, '-upright');
  return raw;
}

function getCardImageUrlForDisplay(card) {
  const base = getDeckAssetsBase();
  const imageId = getImageIdForDisplay(card);
  if (!imageId) return getCardBackUrl();
  return `${base}/${imageId}.webp`;
}

function findCard(id) {
  return findCardById(meowTarotCards, id, normalizeId);
}

function parseColorPalette(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);

  const str = String(value).trim();
  if (!str) return [];

  // try JSON array
  if (str.startsWith('[') && str.endsWith(']')) {
    try {
      const arr = JSON.parse(str);
      if (Array.isArray(arr)) return arr.map(String).filter(Boolean);
    } catch (e) {
      // ignore
    }
  }

  // comma-separated
  if (str.includes(',')) {
    return str.split(',').map((s) => s.trim()).filter(Boolean);
  }

  return [str];
}

function renderCardArt(card, variant = 'hero') {
  const wrap = document.createElement('div');
  wrap.className = variant === 'thumb' ? 'reading-card-thumb' : 'reading-card-hero';

  const img = document.createElement('img');
  img.className = variant === 'thumb' ? 'tarot-card-img--thumb' : 'tarot-card-img--hero';
  img.alt = getName(card, state.currentLang);
  img.loading = 'lazy';
  img.decoding = 'async';
  img.src = getCardImageUrlForDisplay(card);

  // fallback to back image if missing
  img.onerror = () => {
    img.onerror = null;
    img.src = getCardBackUrl();
  };

  wrap.appendChild(img);
  return wrap;
}

function buildHeaderBlock(card, dict) {
  const header = document.createElement('div');
  header.className = 'card-heading';

  const title = document.createElement('h2');
  title.textContent = `${card.icon_emoji || '🐾'} ${getName(card)} — ${getOrientationLabel(card)}`;

  const imply = getText(card, 'tarot_imply');
  const implyLine = document.createElement('p');
  implyLine.className = 'keywords';
  implyLine.textContent = imply || '';

  header.appendChild(title);
  if (imply) header.appendChild(implyLine);

  return header;
}

function renderMetaRow(card) {
  const row = document.createElement('div');
  row.className = 'meta-row';

  const element = getText(card, 'element') || card.element;
  const planet = getText(card, 'planet') || card.planet;
  const numerology = getText(card, 'numerology') || card.numerology;

  const items = [
    element ? `Element: ${String(element)}` : '',
    planet ? `Planet: ${String(planet)}` : '',
    numerology ? `Number: ${String(numerology)}` : '',
  ].filter(Boolean);

  items.forEach((txt) => {
    const badge = document.createElement('span');
    badge.className = 'meta-badge';
    badge.textContent = txt;
    row.appendChild(badge);
  });

  const palette = parseColorPalette(card.color_palette || card.color_palette_en || card.color_palette_th);
  if (palette.length) {
    palette.slice(0, 8).forEach((c) => {
      const chip = document.createElement('span');
      chip.className = 'meta-badge';

      const sw = document.createElement('span');
      sw.className = 'swatch';
      sw.style.background = c;

      const label = document.createElement('span');
      label.textContent = c;

      chip.append(sw, label);
      row.appendChild(chip);
    });
  }

  return row.childNodes.length ? row : null;
}

function buildSuggestionPanel(card, dict, headingText) {
  const action = getText(card, 'action_prompt');
  const reflection = getText(card, 'reflection_question');
  const affirmation = getText(card, 'affirmation');

  if (!action && !reflection && !affirmation) return null;

  const panel = document.createElement('div');
  panel.className = 'panel';

  const h = document.createElement('h3');
  h.textContent =
    headingText
    || (state.currentLang === 'th' ? 'คำแนะนำวันนี้' : (dict.suggestionTitle || 'Suggestion'));
  panel.appendChild(h);

  const combined = [action, reflection].filter(Boolean).map((s) => String(s).trim()).join(' ');
  if (combined) {
    const p = document.createElement('p');
    p.textContent = combined;
    panel.appendChild(p);
  }

  if (affirmation) {
    const p2 = document.createElement('p');
    p2.innerHTML = `<em>"${String(affirmation).trim()}"</em>`;
    panel.appendChild(p2);
  }

  return panel;
}

function renderDaily(card, dict) {
  if (!readingContent || !card) return;
  readingContent.innerHTML = '';

  const panel = document.createElement('div');
  panel.className = 'panel';

  panel.appendChild(renderCardArt(card, 'hero'));
  panel.appendChild(buildHeaderBlock(card, dict));

  const main = getText(card, 'standalone_present');
  if (main) {
    const p = document.createElement('p');
    p.className = 'lede';
    p.textContent = main;
    panel.appendChild(p);
  }

  const meta = renderMetaRow(card);
  if (meta) panel.appendChild(meta);

  readingContent.appendChild(panel);

  const suggestion = buildSuggestionPanel(
    card,
    dict,
    state.currentLang === 'th' ? 'คำแนะนำวันนี้' : (dict.suggestionTitle || 'Suggestion')
  );
  if (suggestion) readingContent.appendChild(suggestion);
}

function getTopicText(card, topic, position) {
  const p = String(position || '').toLowerCase();

  if (topic === 'love') {
    return getText(card, `love_${p}`) || getText(card, `standalone_${p}`);
  }

  if (topic === 'career') {
    return getText(card, `career_${p}`) || (p !== 'present' ? '' : getText(card, 'career_present')) || getText(card, `standalone_${p}`);
  }

  if (topic === 'finance') {
    return getText(card, `finance_${p}`) || (p !== 'present' ? '' : getText(card, 'finance_present')) || getText(card, `standalone_${p}`);
  }

  return getText(card, `standalone_${p}`);
}

function renderThreePanels(cards, dict, topic, modeLabel) {
  if (!readingContent) return;
  readingContent.innerHTML = '';

  const positions = ['past', 'present', 'future'];

  cards.slice(0, 3).forEach((card, idx) => {
    const pos = positions[idx];

    const panel = document.createElement('div');
    panel.className = 'panel';

    panel.appendChild(renderCardArt(card, 'thumb'));

    const h = document.createElement('h3');
    h.textContent = `${dict[pos]} • ${getName(card)} — ${getOrientationLabel(card)}`;
    panel.appendChild(h);

    const body = modeLabel === 'question'
      ? getTopicText(card, topic, pos)
      : getText(card, `standalone_${pos}`);

    if (body) {
      const p = document.createElement('p');
      p.textContent = body;
      panel.appendChild(p);
    }

    readingContent.appendChild(panel);
  });
}

function renderFortuneSummary(cards, dict) {
  const positions = ['past', 'present', 'future'];
  const parts = cards.slice(0, 3)
    .map((card, idx) => getText(card, `reading_summary_${positions[idx]}`))
    .filter(Boolean);

  if (!parts.length) return null;

  const wrap = document.createElement('div');
  wrap.className = 'panel';

  const h = document.createElement('h3');
  h.textContent = state.currentLang === 'th' ? 'ดวงของคุณวันนี้' : 'Your Fortune';
  wrap.appendChild(h);

  const p = document.createElement('p');
  p.textContent = parts.join(' ');
  wrap.appendChild(p);

  return wrap;
}

function renderFull(cards, dict) {
  if (!cards?.length) return;
  renderThreePanels(cards, dict, 'generic', 'full');

  const summary = renderFortuneSummary(cards, dict);
  if (summary) readingContent.appendChild(summary);

  const presentCard = cards[1] || cards[0];
  if (presentCard) {
    const suggestion = buildSuggestionPanel(
      presentCard,
      dict,
      state.currentLang === 'th' ? 'คำแนะนำ' : (dict.guidanceHeading || 'Suggestion')
    );
    if (suggestion) readingContent.appendChild(suggestion);
  }
}

function renderQuestion(cards, dict, topic) {
  if (!cards?.length) return;
  renderThreePanels(cards, dict, topic, 'question');

  const summary = renderFortuneSummary(cards, dict);
  if (summary) readingContent.appendChild(summary);

  const presentCard = cards[1] || cards[0];
  if (presentCard) {
    const suggestion = buildSuggestionPanel(
      presentCard,
      dict,
      state.currentLang === 'th' ? 'คำแนะนำ' : (dict.guidanceHeading || 'Suggestion')
    );
    if (suggestion) readingContent.appendChild(suggestion);
  }
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

  if (state.mode === 'question') {
    renderQuestion(cards.slice(0, 3), dict, state.topic || 'generic');
    return;
  }

  // full reading
  renderFull(cards.slice(0, 3), dict);
}

function updateContextCopy(dict = translations[state.currentLang]) {
  if (!contextCopy) return;

  if (state.mode === 'question') {
    contextCopy.textContent = dict.contextQuestion;
    return;
  }

  if (state.mode === 'full') {
    contextCopy.textContent = dict.overallDesc || dict.overallShortDesc || dict.contextDaily;
    return;
  }

  contextCopy.textContent = dict.contextDaily;
}

function handleTranslations(dict) {
  updateContextCopy(dict);

  if (readingTitle) {
    if (state.mode === 'question') readingTitle.textContent = dict.questionTitle;
    else if (state.mode === 'full') readingTitle.textContent = dict.overallTitle;
    else readingTitle.textContent = dict.dailyTitle;
  }

  if (dataLoaded) renderReading(dict);
}

function handleShare() {
  const url = window.location.href;
  if (navigator.share) {
    navigator.share({ title: 'MeowTarot', text: translations[state.currentLang].yourReading, url })
      .catch(() => copyLink(url));
  } else {
    copyLink(url);
  }
}

function copyLink(url) {
  navigator.clipboard.writeText(url).then(() => alert(translations[state.currentLang].shareFallback));
}

function saveImage() {
  if (!readingContent || typeof html2canvas === 'undefined') return;
  html2canvas(readingContent, { backgroundColor: '#0b102b', scale: 2 }).then((canvas) => {
    const link = document.createElement('a');
    link.download = `meowtarot-reading-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  });
}

function init() {
  initShell(state, handleTranslations, 'reading');

  newReadingBtn?.addEventListener('click', () => {
    const target =
      state.mode === 'question'
        ? '/question.html'
        : state.mode === 'full'
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
