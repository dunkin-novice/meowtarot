import { initShell, localizePath, pathHasThaiPrefix, translations } from './common.js';
import { loadTarotData, meowTarotCards, normalizeId } from './data.js';
import { findCardById } from './reading-helpers.js';

// Toggle this later if/when you upload reversed images.
// For now: reversed cards use the upright image file (no 404 spam).
const USE_REVERSED_IMAGES = false;

const params = new URLSearchParams(window.location.search);
const storageSelection = JSON.parse(sessionStorage.getItem('meowtarot_selection') || 'null');

function normalizeMode(modeRaw) {
  const mode = String(modeRaw || '').toLowerCase().trim();
  // Back-compat: older links might use "overall"
  if (mode === 'overall' || mode === 'life' || mode === 'full') return 'full';
  if (mode === 'question') return 'question';
  return 'daily';
}

function parseSelectedIds() {
  // Daily uses `card=...`
  const paramCard = params.get('card');
  // Full/question uses `cards=a,b,c`
  const paramCards = params.get('cards');
  const storedCards = storageSelection?.cards;

  if (paramCard) return [paramCard.trim()].filter(Boolean);

  let combined = paramCards;
  if (!combined && Array.isArray(storedCards)) return storedCards.map((x) => String(x).trim()).filter(Boolean);
  if (!combined && storedCards) combined = storedCards;

  if (!combined) return [];

  return combined
    .toString()
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

let dataLoaded = false;

const state = {
  currentLang: params.get('lang') || (pathHasThaiPrefix(window.location.pathname) ? 'th' : 'en'),
  mode: normalizeMode(params.get('mode') || storageSelection?.mode || 'daily'),
  topic: params.get('topic') || storageSelection?.topic || 'generic',
  selectedIds: parseSelectedIds(),
};

const readingContent = document.getElementById('reading-content');
const contextCopy = document.getElementById('reading-context');
const readingTitle = document.getElementById('readingTitle');
const newReadingBtn = document.getElementById('newReadingBtn');
const shareBtn = document.getElementById('shareBtn');
const saveBtn = document.getElementById('saveBtn');

function getCardId(card) {
  return (card?.id || card?.card_id || card?.legacy_id || '').toString();
}

function getText(card, keyBase, lang = state.currentLang) {
  const suffix = lang === 'en' ? '_en' : '_th';
  return card?.[`${keyBase}${suffix}`] || '';
}

function getName(card, lang = state.currentLang) {
  if (!card) return '';
  if (lang === 'en') return card.card_name_en || card.name_en || card.name || getCardId(card);

  // TH UI: alias_th (card_name_en)
  const thaiName = card.alias_th || card.name_th || card.name || card.card_name_en || getCardId(card);
  const englishName = card.card_name_en || card.name_en || '';
  return englishName ? `${thaiName} (${englishName})` : thaiName;
}

function isReversed(card) {
  const orientation = (card?.orientation || '').toLowerCase();
  if (orientation === 'reversed') return true;
  const id = getCardId(card).toLowerCase();
  return id.endsWith('-reversed');
}

function getOrientationLabel(card) {
  // Per your spec: show Upright / Reversed (English) even in TH UI.
  return isReversed(card) ? 'Reversed' : 'Upright';
}

function findCard(id) {
  const deck = Array.isArray(meowTarotCards) ? meowTarotCards : [];
  const direct = findCardById(deck, id, normalizeId);
  if (direct) return direct;

  // Extra safety if your card objects only have `card_id` (not `id`)
  const normalizedCandidate = normalizeId(String(id ?? ''));
  return (
    deck.find((c) => normalizeId(getCardId(c)) === normalizedCandidate)
    || deck.find((c) => getCardId(c) === String(id ?? ''))
    || null
  );
}

function withPreservedNewlines(el) {
  if (!el) return el;
  el.style.whiteSpace = 'pre-line';
  return el;
}

function buildCardImage(card, size = 'hero') {
  const id = getCardId(card);
  if (!id) return null;

  const wrapper = document.createElement('div');
  wrapper.className = size === 'thumb' ? 'reading-card-thumb' : 'reading-card-hero';

  const img = document.createElement('img');
  img.className = size === 'thumb' ? 'tarot-card-img tarot-card-img--thumb' : 'tarot-card-img tarot-card-img--hero';

  img.alt = getText(card, 'image_alt') || getName(card) || 'Tarot card';

  const uprightId = id.replace(/-reversed$/i, '-upright');
  const reversedId = id;

  const basePath = '/assets/meow-v1/';
  const candidates = [];
  if (USE_REVERSED_IMAGES && isReversed(card)) candidates.push(`${reversedId}.webp`);
  candidates.push(`${uprightId}.webp`);

  let i = 0;
  function setNext() {
    if (i >= candidates.length) return;
    img.src = basePath + candidates[i];
    i += 1;
  }

  img.addEventListener('error', () => setNext());
  setNext();

  wrapper.appendChild(img);
  return wrapper;
}

function parseColorPalette(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((v) => typeof v === 'string' && v.trim()).map((v) => v.trim());
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const arr = JSON.parse(trimmed);
        if (Array.isArray(arr)) return arr.filter((v) => typeof v === 'string' && v.trim()).map((v) => v.trim());
      } catch (e) {
        // fall through
      }
    }
    return trimmed.split(',').map((v) => v.trim()).filter(Boolean);
  }
  return [];
}

function buildDailyHeader(card) {
  const header = document.createElement('div');
  header.className = 'card-heading';

  const title = document.createElement('h2');
  title.textContent = `${getName(card)} — ${getOrientationLabel(card)}`;
  header.appendChild(title);

  const imply = getText(card, 'tarot_imply');
  if (imply) {
    const implyLine = document.createElement('p');
    implyLine.className = 'keywords';
    implyLine.textContent = imply;
    header.appendChild(implyLine);
  }

  return header;
}

function buildSuggestionPanel(card, dict, headingText) {
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

  const combined = [action, reflection].filter(Boolean).map((t) => t.trim()).join(' ');
  if (combined) {
    const p = document.createElement('p');
    p.textContent = combined;
    panel.appendChild(withPreservedNewlines(p));
  }

  if (affirmation) {
    const pAff = document.createElement('p');
    const em = document.createElement('em');
    em.textContent = `"${affirmation.trim()}"`;
    pAff.appendChild(em);
    panel.appendChild(withPreservedNewlines(pAff));
  }

  return panel;
}

function buildMetaPanel(card, dict) {
  // Optional meta (you said can come later). Keep or remove anytime.
  if (!card) return null;

  const element = (card.element || '').toString().trim();
  const planet = (card.planet || '').toString().trim();
  const numerology = (card.numerology_value || '').toString().trim();
  const colors = parseColorPalette(card.color_palette);

  if (!element && !planet && !numerology && !colors.length) return null;

  const panel = document.createElement('div');
  panel.className = 'panel';

  const h = document.createElement('h3');
  h.textContent = dict?.metaTitle || (state.currentLang === 'th' ? 'ข้อมูลเพิ่มเติม' : 'Details');
  panel.appendChild(h);

  const row = document.createElement('div');
  row.className = 'meta-row';

  const labelElement = state.currentLang === 'th' ? 'ธาตุ' : 'Element';
  const labelPlanet = state.currentLang === 'th' ? 'ดาว' : 'Planet';
  const labelNumber = state.currentLang === 'th' ? 'เลข' : 'Number';

  function addBadge(text) {
    const badge = document.createElement('span');
    badge.className = 'meta-badge';
    badge.textContent = text;
    row.appendChild(badge);
  }

  if (element) addBadge(`${labelElement}: ${element}`);
  if (planet) addBadge(`${labelPlanet}: ${planet}`);
  if (numerology) addBadge(`${labelNumber}: ${numerology}`);

  if (row.childNodes.length) panel.appendChild(row);

  if (colors.length) {
    const colorRow = document.createElement('div');
    colorRow.className = 'meta-row';
    colors.slice(0, 8).forEach((hex) => {
      const sw = document.createElement('span');
      sw.className = 'swatch';
      sw.title = hex;
      sw.style.backgroundColor = hex;
      colorRow.appendChild(sw);
    });
    panel.appendChild(colorRow);
  }

  return panel;
}

function renderDaily(card, dict) {
  if (!readingContent || !card) return;
  readingContent.innerHTML = '';

  // Header block (image + name/orientation + imply + main message)
  const hero = document.createElement('div');
  hero.className = 'panel';

  const img = buildCardImage(card, 'hero');
  if (img) hero.appendChild(img);

  hero.appendChild(buildDailyHeader(card));

  const main = getText(card, 'standalone_present');
  if (main) {
    const p = document.createElement('p');
    p.className = 'lede';
    p.textContent = main;
    hero.appendChild(withPreservedNewlines(p));
  }

  readingContent.appendChild(hero);

  // Suggestion box (Daily-specific heading)
  const dailySuggestionHeading = state.currentLang === 'th' ? 'คำแนะนำวันนี้' : 'Today’s Guidance';
  const suggestion = buildSuggestionPanel(card, dict, dailySuggestionHeading);
  if (suggestion) readingContent.appendChild(suggestion);

  // Optional meta
  const meta = buildMetaPanel(card, dict);
  if (meta) readingContent.appendChild(meta);
}

function getPositionText(card, position, mode, topic) {
  if (!card) return '';

  // Ask-a-question: topic fields only (love/career/finance), fallback to standalone
  if (mode === 'question' && topic && topic !== 'generic') {
    const topicKey = `${topic}_${position}`; // e.g., love_present
    const topicText = getText(card, topicKey);
    if (topicText) return topicText;
  }

  return getText(card, `standalone_${position}`);
}

function buildThreeCardGrid(cards, dict, mode, topic) {
  const positions = ['past', 'present', 'future'];
  const grid = document.createElement('div');
  grid.className = 'results-grid';

  cards.slice(0, 3).forEach((card, idx) => {
    const position = positions[idx];
    const box = document.createElement('div');
    box.className = 'result-card';

    const label = document.createElement('div');
    label.className = 'label';
    label.textContent = dict?.[position] || position;

    const imgWrap = buildCardImage(card, 'thumb');

    const title = document.createElement('h5');
    title.textContent = `${getName(card)} — ${getOrientationLabel(card)}`;

    const text = getPositionText(card, position, mode, topic);
    const p = document.createElement('p');
    p.textContent = text || '';
    withPreservedNewlines(p);

    box.appendChild(label);
    if (imgWrap) box.appendChild(imgWrap);
    box.appendChild(title);
    if (text) box.appendChild(p);

    grid.appendChild(box);
  });

  return grid;
}

function buildFortunePanel(cards, dict) {
  const positions = ['past', 'present', 'future'];
  const summaries = cards
    .slice(0, 3)
    .map((card, idx) => getText(card, `reading_summary_${positions[idx]}`))
    .filter(Boolean);

  if (!summaries.length) return null;

  const panel = document.createElement('div');
  panel.className = 'panel';

  const h = document.createElement('h3');
  h.textContent = dict?.readingSummaryTitle || (state.currentLang === 'th' ? 'ดวงของคุณ' : 'Your Fortune');
  panel.appendChild(h);

  const p = document.createElement('p');
  p.textContent = summaries.join(' ');
  panel.appendChild(withPreservedNewlines(p));

  return panel;
}

function renderThreeCardMode(cards, dict, mode, topic) {
  if (!readingContent) return;
  readingContent.innerHTML = '';

  readingContent.appendChild(buildThreeCardGrid(cards, dict, mode, topic));

  // Full reading: show combined summary paragraph
  if (mode === 'full') {
    const fortune = buildFortunePanel(cards, dict);
    if (fortune) readingContent.appendChild(fortune);
  }

  // Suggestion: anchor on the center card (Present)
  const presentCard = cards[1] || cards[0];
  const suggestionHeading = dict?.suggestionTitle || (state.currentLang === 'th' ? 'คำแนะนำ' : 'Suggestion');
  const suggestion = buildSuggestionPanel(presentCard, dict, suggestionHeading);
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

  // full / question: 3 cards required
  if (cards.length < 3) {
    const message = dict?.selectThreeHint || (state.currentLang === 'th' ? 'เลือกไพ่ให้ครบ 3 ใบก่อน' : 'Please select 3 cards.');
    readingContent.innerHTML = `<div class="panel"><p class="lede">${message}</p></div>`;
    return;
  }

  renderThreeCardMode(cards.slice(0, 3), dict, state.mode, state.topic);
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
  html2canvas(readingContent, { backgroundColor: '#0b102b', scale: 2, useCORS: true }).then((canvas) => {
    const link = document.createElement('a');
    link.download = `meowtarot-reading-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  });
}

function updateContextCopy(dict = translations[state.currentLang]) {
  if (!contextCopy) return;
  contextCopy.textContent = state.mode === 'question' ? dict.contextQuestion : dict.contextDaily;
}

function handleTranslations(dict) {
  updateContextCopy(dict);

  if (readingTitle) {
    if (state.mode === 'question') {
      readingTitle.textContent = dict.questionTitle;
    } else if (state.mode === 'full') {
      readingTitle.textContent = dict.overallTitle; // reuse existing "Life Reading" label
    } else {
      readingTitle.textContent = dict.dailyTitle;
    }
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
