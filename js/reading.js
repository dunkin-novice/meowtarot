import { initShell, localizePath, pathHasThaiPrefix, translations } from './common.js';
import { loadTarotData, meowTarotCards, normalizeId, getActiveDeck } from './data.js';
import { findCardById } from './reading-helpers.js';

const params = new URLSearchParams(window.location.search);
const storageSelection = JSON.parse(sessionStorage.getItem('meowtarot_selection') || 'null');

const readingContent = document.getElementById('reading-content');
const contextCopy = document.getElementById('reading-context');
const readingTitle = document.getElementById('readingTitle');

const newReadingBtn = document.getElementById('newReadingBtn');
const shareBtn = document.getElementById('shareBtn');
const saveBtn = document.getElementById('saveBtn');

let dataLoaded = false;

function normalizeMode(raw) {
  const v = String(raw || '').toLowerCase().trim();
  if (v === 'daily') return 'daily';
  if (v === 'question') return 'question';
  if (v === 'full' || v === 'overall' || v === 'life') return 'full';
  return 'daily';
}

function parseSelectedIds() {
  const urlCards = params.get('cards'); // comma separated
  const urlCard = params.get('card'); // single
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

function getText(card, keyBase, lang = state.currentLang) {
  const suffix = lang === 'en' ? '_en' : '_th';
  return card?.[`${keyBase}${suffix}`] || '';
}

function getName(card, lang = state.currentLang) {
  if (!card) return '';
  if (lang === 'en') return card.card_name_en || card.name_en || card.name || card.id;

  const thaiName = card.alias_th || card.name_th || card.name || card.card_name_en || card.id;
  const englishName = card.card_name_en || card.name_en || '';
  return englishName ? `${thaiName} (${englishName})` : thaiName;
}

function isReversed(card) {
  const id = String(card?.card_id || card?.id || '');
  if (id.endsWith('-reversed')) return true;
  return String(card?.orientation || '').toLowerCase() === 'reversed';
}

// Per your spec: show Upright/Reversed even in TH UI
function getOrientationLabel(card) {
  return isReversed(card) ? 'Reversed' : 'Upright';
}

function findCard(id) {
  return findCardById(meowTarotCards, id, normalizeId);
}

function getDeckAssetsBase() {
  try {
    return (getActiveDeck()?.assetsBase || '/assets/meow-v1').replace(/\/$/, '');
  } catch {
    return '/assets/meow-v1';
  }
}

function getImageId(card) {
  // Prefer true image id if you ever add it later
  return String(card?.image_id || card?.card_id || card?.id || '');
}

function toUprightId(id) {
  // If reversed image missing, fallback to upright
  return String(id || '').replace(/-reversed$/i, '-upright');
}

function createCardImage(card, variant = 'hero') {
  const base = getDeckAssetsBase();
  const imageId = getImageId(card);

  const wrap = document.createElement('div');
  wrap.className = variant === 'thumb' ? 'reading-card-thumb' : 'card-art';

  const img = document.createElement('img');
  img.alt = getName(card);
  img.className = variant === 'thumb' ? 'tarot-card-img--thumb' : 'card-art-img';
  img.loading = variant === 'thumb' ? 'lazy' : 'eager';

  img.src = `${base}/${imageId}.webp`;

  img.addEventListener('error', () => {
    if (img.dataset.fallbackDone) return;
    img.dataset.fallbackDone = '1';
    const fallback = toUprightId(imageId);
    if (fallback && fallback !== imageId) {
      img.src = `${base}/${fallback}.webp`;
    }
  });

  wrap.appendChild(img);
  return wrap;
}

function buildMetaPanel(card, dict) {
  if (!card) return null;

  const chips = [];
  if (card.element) chips.push(`Element: ${card.element}`);
  if (card.planet) chips.push(`Planet: ${card.planet}`);
  if (card.numerology_value != null && String(card.numerology_value).trim() !== '') {
    chips.push(`No. ${card.numerology_value}`);
  }

  let colors = card.color_palette;
  if (typeof colors === 'string') {
    // allow comma-separated or JSON array string
    try {
      const parsed = JSON.parse(colors);
      colors = Array.isArray(parsed) ? parsed : colors;
    } catch {
      // keep as string
    }
  }
  if (typeof colors === 'string') colors = colors.split(',').map((v) => v.trim());
  if (!Array.isArray(colors)) colors = [];
  colors = colors.filter(Boolean);

  if (!chips.length && !colors.length) return null;

  const panel = document.createElement('div');
  panel.className = 'panel';

  if (chips.length) {
    const row = document.createElement('div');
    row.className = 'meta-row';
    chips.forEach((t) => {
      const badge = document.createElement('div');
      badge.className = 'meta-badge';
      badge.textContent = t;
      row.appendChild(badge);
    });
    panel.appendChild(row);
  }

  if (colors.length) {
    const row = document.createElement('div');
    row.className = 'meta-row';

    colors.slice(0, 8).forEach((hex) => {
      const badge = document.createElement('div');
      badge.className = 'meta-badge';

      const sw = document.createElement('span');
      sw.className = 'swatch';
      sw.style.backgroundColor = hex;

      const label = document.createElement('span');
      label.textContent = hex;

      badge.append(sw, label);
      row.appendChild(badge);
    });

    panel.appendChild(row);
  }

  return panel;
}

function buildSuggestionPanel(card, dict, headingText) {
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
    p.innerHTML = `<em>"${affirmation.trim()}"</em>`;
    panel.appendChild(p);
  }

  return panel;
}

function renderDaily(card, dict) {
  if (!readingContent || !card) return;
  readingContent.innerHTML = '';

  const panel = document.createElement('div');
  panel.className = 'panel';

  panel.appendChild(createCardImage(card, 'hero'));

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

  panel.appendChild(heading);

  const main = getText(card, 'standalone_present');
  if (main) {
    const p = document.createElement('p');
    p.className = 'lede';
    p.textContent = main;
    panel.appendChild(p);
  }

  readingContent.appendChild(panel);

  const meta = buildMetaPanel(card, dict);
  if (meta) readingContent.appendChild(meta);

  const suggestionHeading = state.currentLang === 'th' ? 'คำแนะนำวันนี้' : 'Suggestion';
  const suggestion = buildSuggestionPanel(card, dict, suggestionHeading);
  if (suggestion) readingContent.appendChild(suggestion);
}

function renderThreeBoxes(cards, dict, mode) {
  const wrap = document.createElement('div');
  wrap.className = 'results-grid';

  const positions = ['past', 'present', 'future'];

  positions.forEach((pos, idx) => {
    const card = cards[idx];
    if (!card) return;

    const box = document.createElement('div');
    box.className = 'result-card';

    const label = document.createElement('div');
    label.className = 'label';
    label.textContent = dict[pos] || pos.toUpperCase();
    box.appendChild(label);

    box.appendChild(createCardImage(card, 'thumb'));

    const title = document.createElement('h5');
    title.textContent = `${getName(card)} — ${getOrientationLabel(card)}`;
    box.appendChild(title);

    let text = '';
    if (mode === 'question') {
      const topic = state.topic;
      const topicKey = `${topic}_${pos}`; // love_past, career_present, finance_future
      text = getText(card, topicKey) || getText(card, `standalone_${pos}`);
    } else {
      text = getText(card, `standalone_${pos}`);
    }

    const p = document.createElement('p');
    p.textContent = text || '';
    box.appendChild(p);

    wrap.appendChild(box);
  });

  return wrap;
}

function renderFortuneSummary(cards, dict) {
  const positions = ['past', 'present', 'future'];
  const text = positions
    .map((pos, idx) => getText(cards[idx], `reading_summary_${pos}`))
    .filter(Boolean)
    .join(' ')
    .trim();

  if (!text) return null;

  const panel = document.createElement('div');
  panel.className = 'panel';

  const h = document.createElement('h3');
  h.textContent = dict.readingSummaryTitle || (state.currentLang === 'th' ? 'ดวงของคุณ' : 'Your Fortune');
  panel.appendChild(h);

  const p = document.createElement('p');
  p.textContent = text;
  panel.appendChild(p);

  return panel;
}

function renderFullOrQuestion(cards, dict) {
  if (!readingContent) return;
  readingContent.innerHTML = '';

  const three = cards.slice(0, 3);
  readingContent.appendChild(renderThreeBoxes(three, dict, state.mode));

  if (state.mode === 'full') {
    const summary = renderFortuneSummary(three, dict);
    if (summary) readingContent.appendChild(summary);
  }

  const present = three[1] || three[0];
  const suggestionHeading = dict.suggestionTitle || (state.currentLang === 'th' ? 'คำแนะนำ' : 'Suggestion');
  const suggestion = buildSuggestionPanel(present, dict, suggestionHeading);
  if (suggestion) readingContent.appendChild(suggestion);

  const meta = buildMetaPanel(present, dict);
  if (meta) readingContent.appendChild(meta);
}

function renderReading(dict) {
  if (!readingContent) return;

  const cards = state.selectedIds.map((id) => findCard(id)).filter(Boolean);

  if (!cards.length) {
    const msg = dict.missingSelection || 'No cards found. Please draw cards first.';
    readingContent.innerHTML = `<div class="panel"><p class="lede">${msg}</p></div>`;
    return;
  }

  if (state.mode === 'daily') {
    renderDaily(cards[0], dict);
    return;
  }

  renderFullOrQuestion(cards, dict);
}

function updateContextCopy(dict) {
  if (!contextCopy) return;

  if (state.mode === 'question') contextCopy.textContent = dict.contextQuestion || '';
  else if (state.mode === 'full') contextCopy.textContent = dict.overallDesc || dict.contextDaily || '';
  else contextCopy.textContent = dict.contextDaily || '';
}

function handleTranslations(dict) {
  updateContextCopy(dict);

  if (readingTitle) {
    if (state.mode === 'full') readingTitle.textContent = dict.overallTitle || 'Full Reading';
    else if (state.mode === 'question') readingTitle.textContent = dict.questionTitle || 'Ask a Question';
    else readingTitle.textContent = dict.dailyTitle || 'Daily Reading';
  }

  if (dataLoaded) renderReading(dict);
}

function handleShare() {
  const url = window.location.href;
  const dict = translations[state.currentLang] || translations.en;

  if (navigator.share) {
    navigator
      .share({ title: 'MeowTarot', text: dict.yourReading || 'Your MeowTarot Reading', url })
      .catch(() => copyLink(url));
  } else {
    copyLink(url);
  }
}

function copyLink(url) {
  const dict = translations[state.currentLang] || translations.en;
  navigator.clipboard.writeText(url).then(() => alert(dict.shareFallback || 'Link copied!'));
}

function saveImage() {
  if (!readingContent) return;
  if (typeof window.html2canvas !== 'function') {
    alert('html2canvas not loaded.');
    return;
  }

  window.html2canvas(readingContent, { backgroundColor: '#0b102b', scale: 2 }).then((canvas) => {
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
      state.mode === 'question' ? '/question.html' : state.mode === 'full' ? '/overall.html' : '/daily.html';
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
