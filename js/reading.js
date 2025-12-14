import { initShell, localizePath, pathHasThaiPrefix, translations } from './common.js';
import {
  loadTarotData,
  meowTarotCards,
  normalizeId,
  getCardImageUrl,
  getCardBackUrl,
} from './data.js';
import { findCardById } from './reading-helpers.js';

const params = new URLSearchParams(window.location.search);
const storageSelection = JSON.parse(sessionStorage.getItem('meowtarot_selection') || 'null');

function normalizeMode(raw = '') {
  const val = String(raw || '').toLowerCase().trim();
  if (['daily', 'day'].includes(val)) return 'daily';
  if (['full', 'overall', 'life'].includes(val)) return 'full';
  if (['question', 'ask'].includes(val)) return 'question';
  return 'daily';
}

function parseSelectedIds() {
  const single = params.get('card') || params.get('id');
  if (single) return [single.trim()].filter(Boolean);

  const paramCards = params.get('cards');
  const storedCards = storageSelection?.cards;

  const combined = paramCards || (Array.isArray(storedCards) ? storedCards.join(',') : storedCards);
  if (!combined) return [];

  return combined
    .toString()
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

const state = {
  currentLang: params.get('lang') || (pathHasThaiPrefix(window.location.pathname) ? 'th' : 'en'),
  mode: normalizeMode(params.get('mode') || storageSelection?.mode || 'daily'),
  topic: params.get('topic') || storageSelection?.topic || 'generic',
  selectedIds: parseSelectedIds(),
};

let dataLoaded = false;

const readingContent = document.getElementById('reading-content');
const contextCopy = document.getElementById('reading-context');
const readingTitle = document.getElementById('readingTitle');
const newReadingBtn = document.getElementById('newReadingBtn');
const shareBtn = document.getElementById('shareBtn');
const saveBtn = document.getElementById('saveBtn');

function getText(card, keyBase, lang = state.currentLang) {
  if (!card) return '';
  const suffix = lang === 'en' ? '_en' : '_th';
  return card[`${keyBase}${suffix}`] || card[keyBase] || '';
}

function getName(card, lang = state.currentLang) {
  if (!card) return '';

  const englishName = card.card_name_en || card.name_en || card.name || card.id;
  if (lang === 'en') return englishName;

  const thaiName = card.alias_th || card.name_th || card.name || '';
  if (thaiName && englishName) return `${thaiName} (${englishName})`;
  return thaiName || englishName || card.id;
}

function isReversed(card) {
  if (!card) return false;
  const byField = String(card.orientation || '').toLowerCase() === 'reversed';
  const byId = String(card.id || '').toLowerCase().includes('reversed');
  return byField || byId;
}

function getOrientationEnglish(card) {
  return isReversed(card) ? 'Reversed' : 'Upright';
}

// Handles legacy ids like maj-08 by mapping majors to your new "01-..-upright" format.
function resolveLegacyMajorId(candidateId) {
  const id = String(candidateId || '').toLowerCase().trim();
  const match = id.match(/^maj[-_]?(\d{1,2})$/);
  if (!match) return null;

  const majNum = Number(match[1]);
  if (!Number.isFinite(majNum)) return null;

  const newNum = String(majNum + 1).padStart(2, '0');
  const orient = id.includes('reversed') ? 'reversed' : 'upright';

  const hit =
    (meowTarotCards || []).find((c) => String(c.id || '').startsWith(`${newNum}-`) && String(c.id || '').endsWith(`-${orient}`))
    || (meowTarotCards || []).find((c) => String(c.id || '').startsWith(`${newNum}-`));

  return hit ? hit.id : null;
}

function findCard(id) {
  if (!id) return null;

  const direct = findCardById(meowTarotCards, id, normalizeId);
  if (direct) return direct;

  const mapped = resolveLegacyMajorId(id);
  if (mapped) {
    const mappedCard = findCardById(meowTarotCards, mapped, normalizeId);
    if (mappedCard) return mappedCard;
  }

  return null;
}

function getSafeCardImageUrl(card) {
  if (!card) return getCardBackUrl();

  // If we still have a legacy maj-xx object in memory (fallback deck), build a best-effort new image id.
  const idLower = String(card.id || '').toLowerCase();
  const majMatch = idLower.match(/^maj-(\d{1,2})$/);

  if (majMatch) {
    const majNum = Number(majMatch[1]);
    const num = String(majNum + 1).padStart(2, '0');
    const slug = normalizeId(card.card_name_en || card.name_en || card.name || 'card');
    const orient = getOrientationEnglish(card).toLowerCase(); // upright/reversed
    const mappedImageId = `${num}-${slug}-${orient}`;
    return getCardImageUrl({ ...card, id: mappedImageId, image_id: mappedImageId });
  }

  return getCardImageUrl(card);
}

function buildCardArt(card, variant = 'hero') {
  const wrap = document.createElement('div');
  wrap.className = variant === 'thumb' ? 'card-art is-thumb' : 'card-art';

  const img = document.createElement('img');
  img.className = 'card-art-img';
  img.alt = `${getName(card)} — ${getOrientationEnglish(card)}`;
  img.loading = 'lazy';

  img.src = getSafeCardImageUrl(card);
  img.addEventListener('error', () => {
    img.src = getCardBackUrl();
  });

  wrap.appendChild(img);
  return wrap;
}

function buildSuggestionPanel(card, dict, headingText) {
  if (!card) return null;

  const action = getText(card, 'action_prompt');
  const reflection = getText(card, 'reflection_question');
  const affirmation = getText(card, 'affirmation');

  const merged = [action, reflection].filter(Boolean).map((t) => t.trim()).join(' ').trim();
  if (!merged && !affirmation) return null;

  const panel = document.createElement('div');
  panel.className = 'panel';

  if (headingText) {
    const h = document.createElement('h3');
    h.textContent = headingText;
    panel.appendChild(h);
  }

  if (merged) {
    const p = document.createElement('p');
    p.textContent = merged.allowText ?? merged;
    panel.appendChild(p);
  }

  if (affirmation) {
    const p = document.createElement('p');
    p.innerHTML = `<em>"${affirmation.trim()}"</em>`;
    panel.appendChild(p);
  }

  return panel;
}

function buildMetaPanel(card) {
  if (!card) return null;

  const meta = [];

  const element = getText(card, 'element') || card.element;
  const planet = getText(card, 'planet') || card.planet;
  const numerology = getText(card, 'numerology') || card.numerology;

  if (element) meta.push({ label: state.currentLang === 'th' ? 'ธาตุ' : 'Element', value: element });
  if (planet) meta.push({ label: state.currentLang === 'th' ? 'ดาว' : 'Planet', value: planet });
  if (numerology) meta.push({ label: state.currentLang === 'th' ? 'เลข' : 'Numerology', value: numerology });

  let palette = card.color_palette || card.colors || null;
  if (typeof palette === 'string') {
    // try to extract hex codes, or split by comma
    const hexes = palette.match(/#[0-9a-fA-F]{3,8}/g);
    palette = hexes && hexes.length ? hexes : palette.split(',').map((s) => s.trim()).filter(Boolean);
  }
  if (Array.isArray(palette)) {
    palette = palette.filter(Boolean).slice(0, 6);
  } else {
    palette = [];
  }

  if (!meta.length && !palette.length) return null;

  const panel = document.createElement('div');
  panel.className = 'panel';

  const row = document.createElement('div');
  row.className = 'meta-row';

  meta.forEach((item) => {
    const chip = document.createElement('span');
    chip.className = 'meta-badge';
    chip.textContent = `${item.label}: ${item.value}`;
    row.appendChild(chip);
  });

  palette.forEach((color) => {
    const chip = document.createElement('span');
    chip.className = 'meta-badge';

    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.background = color;

    const txt = document.createElement('span');
    txt.textContent = String(color).toUpperCase();

    chip.append(swatch, txt);
    row.appendChild(chip);
  });

  panel.appendChild(row);
  return panel;
}

function renderDaily(card, dict) {
  if (!readingContent || !card) return;

  readingContent.innerHTML = '';

  const panel = document.createElement('div');
  panel.className = 'panel';

  panel.appendChild(buildCardArt(card, 'hero'));

  const h2 = document.createElement('h2');
  h2.textContent = `${getName(card)} — ${getOrientationEnglish(card)}`;
  panel.appendChild(h2);

  const imply = getText(card, 'tarot_imply');
  if (imply) {
    const p = document.createElement('p');
    p.className = 'keywords';
    p.textContent = imply;
    panel.appendChild(p);
  }

  const main = getText(card, 'standalone_present') || getText(card, 'tarot_imply_present');
  if (main) {
    const p = document.createElement('p');
    p.className = 'lede';
    p.textContent = main;
    panel.appendChild(p);
  }

  readingContent.appendChild(panel);

  const suggestionHeading = state.currentLang === 'th' ? 'คำแนะนำวันนี้' : (dict.suggestionTitle || 'Suggestion');
  const suggestion = buildSuggestionPanel(card, dict, suggestionHeading);
  if (suggestion) readingContent.appendChild(suggestion);

  const meta = buildMetaPanel(card);
  if (meta) readingContent.appendChild(meta);
}

function renderFull(cards, dict) {
  if (!readingContent || !cards?.length) return;
  readingContent.innerHTML = '';

  const positions = ['past', 'present', 'future'];

  cards.slice(0, 3).forEach((card, idx) => {
    const pos = positions[idx];

    const panel = document.createElement('div');
    panel.className = 'panel';

    // optional thumbnail
    panel.appendChild(buildCardArt(card, 'thumb'));

    const h3 = document.createElement('h3');
    h3.textContent = `${dict[pos]} • ${getName(card)} — ${getOrientationEnglish(card)}`;
    panel.appendChild(h3);

    const text = getText(card, `standalone_${pos}`);
    if (text) {
      const p = document.createElement('p');
      p.textContent = text;
      panel.appendChild(p);
    }

    readingContent.appendChild(panel);
  });

  // Your Fortune (summary)
  const summaries = cards
    .slice(0, 3)
    .map((card, idx) => getText(card, `reading_summary_${positions[idx]}`))
    .filter(Boolean);

  if (summaries.length) {
    const panel = document.createElement('div');
    panel.className = 'panel';

    const h3 = document.createElement('h3');
    h3.textContent = state.currentLang === 'th' ? 'ดวงของคุณ' : 'Your Fortune';
    panel.appendChild(h3);

    const p = document.createElement('p');
    p.textContent = summaries.join(' ').replace(/\s+/g, ' ').trim();
    panel.appendChild(p);

    readingContent.appendChild(panel);
  }

  // Suggestion (anchor on Present card)
  const present = cards[1] || cards[0];
  if (present) {
    const heading = state.currentLang === 'th' ? 'คำแนะนำ' : (dict.suggestionTitle || 'Suggestion');
    const suggestion = buildSuggestionPanel(present, dict, heading);
    if (suggestion) readingContent.appendChild(suggestion);

    const meta = buildMetaPanel(present);
    if (meta) readingContent.appendChild(meta);
  }
}

function renderQuestion(cards, dict) {
  if (!readingContent || !cards?.length) return;
  readingContent.innerHTML = '';

  const positions = ['past', 'present', 'future'];
  const topic = String(state.topic || 'generic').toLowerCase();

  cards.slice(0, 3).forEach((card, idx) => {
    const pos = positions[idx];

    const panel = document.createElement('div');
    panel.className = 'panel';

    panel.appendChild(buildCardArt(card, 'thumb'));

    const h3 = document.createElement('h3');
    h3.textContent = `${dict[pos]} • ${getName(card)} — ${getOrientationEnglish(card)}`;
    panel.appendChild(h3);

    let key = `standalone_${pos}`;
    if (topic === 'love') key = `love_${pos}`;
    if (topic === 'career') key = `career_${pos}`;
    if (topic === 'finance') key = `finance_${pos}`;

    const text = getText(card, key) || getText(card, `standalone_${pos}`);
    if (text) {
      const p = document.createElement('p');
      p.textContent = text;
      panel.appendChild(p);
    }

    readingContent.appendChild(panel);
  });

  const present = cards[1] || cards[0];
  if (present) {
    const heading = state.currentLang === 'th' ? 'คำแนะนำ' : (dict.guidanceHeading || dict.suggestionTitle || 'Guidance');
    const suggestion = buildSuggestionPanel(present, dict, heading);
    if (suggestion) readingContent.appendChild(suggestion);

    const meta = buildMetaPanel(present);
    if (meta) readingContent.appendChild(meta);
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
    renderQuestion(cards, dict);
    return;
  }

  // full
  renderFull(cards, dict);
}

function handleShare() {
  const url = window.location.href;
  if (navigator.share) {
    navigator.share({ title: 'MeowTarot', text: translations[state.currentLang].yourReading, url }).catch(() => copyLink(url));
  } else {
    copyLink(url);
  }
}

function copyLink(url) {
  navigator.clipboard.writeText(url).then(() => alert(translations[state.currentLang].shareFallback));
}

function saveImage() {
  if (!readingContent) return;
  html2canvas(readingContent, { backgroundColor: '#0b102b', scale: 2 }).then((canvas) => {
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
    if (state.mode === 'question') readingTitle.textContent = dict.questionTitle;
    else if (state.mode === 'full') readingTitle.textContent = dict.overallTitle;
    else readingTitle.textContent = dict.dailyTitle;
  }

  if (dataLoaded) renderReading(dict);
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
