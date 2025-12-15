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

/* -------------------------------------------------------------------------- */
/* Color helpers: show swatch + show COLOR NAME (no hex text)                  */
/* -------------------------------------------------------------------------- */

function isHexColor(v = '') {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(String(v).trim());
}

function normalizeHex(hex) {
  let h = String(hex || '').trim().toUpperCase();
  if (!h.startsWith('#')) h = `#${h}`;
  if (/^#([0-9A-F]{3})$/.test(h)) {
    const s = h.slice(1);
    return `#${s[0]}${s[0]}${s[1]}${s[1]}${s[2]}${s[2]}`;
  }
  if (/^#([0-9A-F]{8})$/.test(h)) return `#${h.slice(1, 7)}`; // ignore alpha
  return h;
}

function hexToRgb(hex) {
  const h = normalizeHex(hex).slice(1);
  if (!/^[0-9A-F]{6}$/.test(h)) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return { r, g, b };
}

function rgbToHsl(r, g, b) {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;

  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const d = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case rr:
        h = ((gg - bb) / d) % 6;
        break;
      case gg:
        h = (bb - rr) / d + 2;
        break;
      default:
        h = (rr - gg) / d + 4;
        break;
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }

  return { h, s, l };
}

// overrides สำหรับสีที่เจอบ่อยในเด็ค (เติมเพิ่มได้เรื่อยๆ)
const HEX_NAME_OVERRIDES = {
  '#87CEEB': { en: 'Sky Blue', th: 'ฟ้าใส' },
  '#87CEFA': { en: 'Light Sky Blue', th: 'ฟ้าอ่อน' },
  '#E6E6FA': { en: 'Lavender', th: 'ลาเวนเดอร์' },
  '#708090': { en: 'Slate Gray', th: 'เทาสเลต' },
  '#FFD700': { en: 'Gold', th: 'ทอง' },
};

function basicColorNameFromHex(hex, lang = 'en') {
  const rgb = hexToRgb(hex);
  if (!rgb) return lang === 'th' ? 'สี' : 'Color';

  const { r, g, b } = rgb;
  const { h, s, l } = rgbToHsl(r, g, b);

  // black/white/gray first
  if (l >= 0.93) return lang === 'th' ? 'ขาว' : 'White';
  if (l <= 0.08) return lang === 'th' ? 'ดำ' : 'Black';
  if (s <= 0.12) return lang === 'th' ? 'เทา' : 'Gray';

  // brown heuristic
  if (h >= 15 && h <= 45 && l <= 0.45) return lang === 'th' ? 'น้ำตาล' : 'Brown';

  // hue buckets
  if (h >= 345 || h < 15) return lang === 'th' ? 'แดง' : 'Red';
  if (h >= 15 && h < 45) return lang === 'th' ? 'ส้ม' : 'Orange';
  if (h >= 45 && h < 70) return lang === 'th' ? 'เหลือง' : 'Yellow';
  if (h >= 70 && h < 160) return lang === 'th' ? 'เขียว' : 'Green';
  if (h >= 160 && h < 200) return lang === 'th' ? 'เขียวอมฟ้า' : 'Teal';
  if (h >= 200 && h < 250) return lang === 'th' ? 'ฟ้า' : 'Blue';
  if (h >= 250 && h < 290) return lang === 'th' ? 'น้ำเงิน' : 'Indigo';
  if (h >= 290 && h < 330) return lang === 'th' ? 'ม่วง' : 'Purple';
  if (h >= 330 && h < 345) return lang === 'th' ? 'ชมพู' : 'Pink';

  return lang === 'th' ? 'สี' : 'Color';
}

function hexToName(hex, lang = 'en') {
  const key = normalizeHex(hex);
  const hit = HEX_NAME_OVERRIDES[key];
  if (hit) return hit[lang] || hit.en;
  return basicColorNameFromHex(key, lang);
}

function normalizeColorArray(palette) {
  if (!palette) return [];
  if (typeof palette === 'string') {
    const hexes = palette.match(/#[0-9a-fA-F]{3,8}/g);
    return (hexes && hexes.length ? hexes : palette.split(',')).map((s) => s.trim()).filter(Boolean);
  }
  if (Array.isArray(palette)) return palette.map((s) => String(s).trim()).filter(Boolean);
  return [];
}

const TH_COLOR_TO_CSS = {
  'แดง': 'red',
  'ส้ม': 'orange',
  'เหลือง': 'yellow',
  'เขียว': 'green',
  'ฟ้า': 'deepskyblue',
  'น้ำเงิน': 'royalblue',
  'ม่วง': 'purple',
  'ชมพู': 'hotpink',
  'น้ำตาล': 'saddlebrown',
  'เทา': 'gray',
  'ดำ': 'black',
  'ขาว': 'white',
  'ทอง': 'gold',
  'ลาเวนเดอร์': 'lavender',
};

function resolveCssColor(value) {
  const v = String(value || '').trim();
  if (!v) return null;

  if (isHexColor(v)) return normalizeHex(v);

  // Thai name => map to CSS
  if (TH_COLOR_TO_CSS[v]) return TH_COLOR_TO_CSS[v];

  // English / CSS color names
  const collapsed = v.toLowerCase().replace(/\s+/g, '');
  if (typeof CSS !== 'undefined' && CSS.supports) {
    if (CSS.supports('color', collapsed)) return collapsed;
    if (CSS.supports('color', v.toLowerCase())) return v.toLowerCase();
  }

  // Fallback: try it anyway (harmless if invalid)
  return v.toLowerCase();
}

/* -------------------------------------------------------------------------- */
// Handles legacy ids like maj-08 by mapping majors to your new "01-..-upright" format.
/* -------------------------------------------------------------------------- */

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
    const orient = isReversed(card) ? 'reversed' : 'upright';
    const mappedImageId = `${num}-${slug}-${orient}`;
    return getCardImageUrl({ ...card, id: mappedImageId, image_id: mappedImageId, orientation: orient });
  }

  const orientation = isReversed(card) ? 'reversed' : 'upright';
  return getCardImageUrl(card, { orientation });
}

function getUprightImageCard(card) {
  const sourceId = String(card?.image_id || card?.card_id || card?.id || '');
  const base = sourceId.replace(/-(upright|reversed)$/i, '');
  if (!base) return null;
  const uprightId = `${base}-upright`;
  return { ...card, id: uprightId, card_id: uprightId, image_id: uprightId, orientation: 'upright' };
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
    const upright = getUprightImageCard(card);
    if (img.dataset.fallback === 'upright' || !upright) {
      img.dataset.fallback = 'back';
      img.src = getCardBackUrl();
      return;
    }

    img.dataset.fallback = 'upright';
    img.src = getSafeCardImageUrl(upright);
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

  // ✅ FIX: support numerology_value (your JSON uses numerology_value)
  const numerology =
    getText(card, 'numerology')
    || card.numerology
    || card.numerology_value;

  if (element) meta.push({ label: state.currentLang === 'th' ? 'ธาตุ' : 'Element', value: element });
  if (planet) meta.push({ label: state.currentLang === 'th' ? 'ดาว' : 'Planet', value: planet });
  if (numerology !== undefined && numerology !== null && numerology !== '') {
    meta.push({ label: state.currentLang === 'th' ? 'เลข' : 'Numerology', value: numerology });
  }

  // ✅ Lucky colors: use color_palette (existing) but show NAME not hex
  const luckyPalette = normalizeColorArray(
    card.lucky_color_palette || card.lucky_colors || card.color_palette || card.colors
  ).filter(Boolean).slice(0, 6);

  // ✅ Avoid colors: optional (if you add it later)
  const avoidPalette = normalizeColorArray(
    card.avoid_color_palette || card.avoid_colors || card.colors_to_avoid || card.unlucky_colors
  ).filter(Boolean).slice(0, 6);

  if (!meta.length && !luckyPalette.length && !avoidPalette.length) return null;

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

  function appendColorGroup(label, colors) {
    if (!colors.length) return;

    const labelChip = document.createElement('span');
    labelChip.className = 'meta-badge';
    labelChip.textContent = label;
    row.appendChild(labelChip);

    colors.forEach((c) => {
      const chip = document.createElement('span');
      chip.className = 'meta-badge';

      const swatch = document.createElement('span');
      swatch.className = 'swatch';

      const cssColor = resolveCssColor(c);
      if (cssColor) swatch.style.background = cssColor;

      const txt = document.createElement('span');

      // ✅ IMPORTANT: never show hex text
      if (isHexColor(c)) {
        txt.textContent = hexToName(c, state.currentLang === 'th' ? 'th' : 'en');
      } else {
        txt.textContent = String(c);
      }

      chip.append(swatch, txt);
      row.appendChild(chip);
    });
  }

  appendColorGroup(
    state.currentLang === 'th' ? 'สีมงคลประจำวัน' : "Today's lucky colors",
    luckyPalette
  );

  appendColorGroup(
    state.currentLang === 'th' ? 'สีที่ควรเลี่ยง' : 'Colors to avoid',
    avoidPalette
  );

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
