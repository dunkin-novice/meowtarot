import { initShell, localizePath, pathHasThaiPrefix, translations } from './common.js';
import {
  loadTarotData,
  meowTarotCards,
  normalizeId,
  getCardImageUrl,
  getCardBackUrl,
} from './data.js';
import { findCardById, getBaseCardId, toOrientation } from './reading-helpers.js';

const params = new URLSearchParams(window.location.search);
const storageSelection = JSON.parse(sessionStorage.getItem('meowtarot_selection') || 'null');
const DEBUG_CAPTURE_ERRORS = false;

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
const SHARE_STORAGE_KEY = 'meowtarot_share_payload';
let energyChart = null;

function getText(card, keyBase, lang = state.currentLang) {
  if (!card) return '';
  const suffix = lang === 'en' ? '_en' : '_th';
  const orientation = toOrientation(card);
  const orientedKey = orientation === 'reversed' ? `${keyBase}_reversed${suffix}` : `${keyBase}_upright${suffix}`;
  const orientedBaseKey = orientation === 'reversed' ? `${keyBase}_reversed` : `${keyBase}_upright`;
  return (
    card[orientedKey]
    || card[orientedBaseKey]
    || card[`${keyBase}${suffix}`]
    || card[keyBase]
    || ''
  );
}

function getName(card, lang = state.currentLang) {
  if (!card) return '';

  const englishName = card.card_name_en || card.name_en || card.name || card.id;
  if (lang === 'en') return englishName;

  const thaiName = card.alias_th || card.name_th || card.name || '';
  if (thaiName && englishName) return `${thaiName} (${englishName})`;
  return thaiName || englishName || card.id;
}

function getOrientationEnglish(card) {
  return toOrientation(card) === 'reversed' ? 'Reversed' : 'Upright';
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
  const orient = toOrientation(id);

  const hit =
    (meowTarotCards || []).find((c) => String(c.id || '').startsWith(`${newNum}-`) && String(c.id || '').endsWith(`-${orient}`))
    || (meowTarotCards || []).find((c) => String(c.id || '').startsWith(`${newNum}-`));

  return hit ? hit.id : null;
}

function ensureOrientation(card, targetOrientation = toOrientation(card)) {
  if (!card) return null;
  const sourceId = String(card?.image_id || card?.card_id || card?.id || '');
  const base = getBaseCardId(sourceId, normalizeId);
  const orientedId = base ? `${base}-${targetOrientation}` : normalizeId(sourceId || `card-${Date.now()}`);
  return {
    ...card,
    id: orientedId,
    card_id: orientedId,
    image_id: orientedId,
    orientation: targetOrientation,
    orientation_label_th: card.orientation_label_th
      || (targetOrientation === 'reversed' ? 'ไพ่กลับหัว' : 'ไพ่ปกติ'),
  };
}

function findCard(id) {
  if (!id) return null;

  const targetOrientation = toOrientation(id);
  const direct = findCardById(meowTarotCards, id, normalizeId);
  if (direct) return toOrientation(direct) === targetOrientation ? direct : ensureOrientation(direct, targetOrientation);

  const mapped = resolveLegacyMajorId(id);
  if (mapped) {
    const mappedCard = findCardById(meowTarotCards, mapped, normalizeId);
    if (mappedCard) {
      return toOrientation(mappedCard) === targetOrientation
        ? mappedCard
        : ensureOrientation(mappedCard, targetOrientation);
    }
  }

  return null;
}

function resolveImageIds(card, targetOrientation = toOrientation(card)) {
  const idLower = String(card?.id || '').toLowerCase();
  const majMatch = idLower.match(/^maj-(\d{1,2})$/);

  if (majMatch) {
    const majNum = Number(majMatch[1]);
    const num = String(majNum + 1).padStart(2, '0');
    const slug = normalizeId(card?.card_name_en || card?.name_en || card?.name || 'card');
    const baseId = `${num}-${slug}`;
    return {
      baseId,
      orientedId: `${baseId}-${targetOrientation}`,
      uprightId: `${baseId}-upright`,
      orientation: targetOrientation,
    };
  }

  const sourceId = String(card?.image_id || card?.card_id || card?.id || '');
  const baseId = getBaseCardId(sourceId, normalizeId) || normalizeId(sourceId);
  return {
    baseId,
    orientedId: baseId ? `${baseId}-${targetOrientation}` : '',
    uprightId: baseId ? `${baseId}-upright` : '',
    orientation: targetOrientation,
  };
}

function getCardImageUrlWithFallback(card) {
  if (!card) return { src: getCardBackUrl(), fallback: null };

  const { orientedId, uprightId, orientation } = resolveImageIds(card, toOrientation(card));
  if (!orientedId) return { src: getCardBackUrl(), fallback: null };

  const orientedCard = { ...card, id: orientedId, card_id: orientedId, image_id: orientedId, orientation };
  const uprightCard = { ...card, id: uprightId, card_id: uprightId, image_id: uprightId, orientation: 'upright' };

  const src = getCardImageUrl(orientedCard, { orientation });
  const fallback = orientation === 'reversed'
    ? getCardImageUrl(uprightCard, { orientation: 'upright' })
    : null;

  return { src, fallback };
}

function buildCardArt(card, variant = 'hero') {
  const wrap = document.createElement('div');
  wrap.className = variant === 'thumb' ? 'card-art is-thumb' : 'card-art';

  const img = document.createElement('img');
  img.className = 'card-art-img';
  img.alt = `${getName(card)} — ${getOrientationEnglish(card)}`;
  img.loading = 'lazy';

  const { src, fallback } = getCardImageUrlWithFallback(card);
  img.src = src;
  img.addEventListener('error', () => {
    if (fallback && img.dataset.fallback !== 'upright') {
      img.dataset.fallback = 'upright';
      img.src = fallback;
      return;
    }
    if (img.dataset.fallback === 'back') return;
    img.dataset.fallback = 'back';
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

function buildTopicPanel(title, text) {
  if (!text) return null;

  const panel = document.createElement('div');
  panel.className = 'panel';

  const h3 = document.createElement('h3');
  h3.textContent = title;
  panel.appendChild(h3);

  const p = document.createElement('p');
  p.textContent = text;
  panel.appendChild(p);

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

  const zodiac =
    getText(card, 'zodiac_sign')
    || card.zodiac_sign
    || card.astrology_sign;

  if (element) meta.push({ label: state.currentLang === 'th' ? 'ธาตุ' : 'Element', value: element });
  if (planet) meta.push({ label: state.currentLang === 'th' ? 'ดาว' : 'Planet', value: planet });
  if (numerology !== undefined && numerology !== null && numerology !== '') {
    meta.push({ label: state.currentLang === 'th' ? 'เลข' : 'Numerology', value: numerology });
  }
  if (zodiac) {
    meta.push({ label: (translations[state.currentLang] || translations.en).metaZodiac || (state.currentLang === 'th' ? 'ราศี' : 'Zodiac'), value: zodiac });
  }

  // ✅ Lucky colors: use color_palette (show NAME not hex)
  const luckyPalette = normalizeColorArray(card.color_palette).filter(Boolean).slice(0, 6);

  // ✅ Avoid colors: use avoid_color_palette
  const avoidPalette = normalizeColorArray(card.avoid_color_palette).filter(Boolean).slice(0, 6);

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

// Topic mapping for daily/question/full reading sections.
const TOPIC_CONFIG = [
  { key: 'love', titleKey: 'topicLove', singleKey: 'love_reading_single', spreadKeys: ['love_past', 'love_present', 'love_future'] },
  { key: 'career', titleKey: 'topicCareer', singleKey: 'career_reading_single', spreadKeys: ['career_past', 'career_present', 'career_future'] },
  { key: 'finance', titleKey: 'topicFinance', singleKey: 'finance_reading_single', spreadKeys: ['finance_past', 'finance_present', 'finance_future'] },
  { key: 'self', titleKey: 'topicSelf', singleKey: 'self_reading_single', spreadKeys: ['self_past', 'self_present', 'self_future'] },
  { key: 'family', titleKey: 'topicFamily', singleKey: 'family_reading_single', spreadKeys: ['family_past', 'family_present', 'family_future'] },
  { key: 'travel', titleKey: 'topicTravel', singleKey: 'travel_reading_single', spreadKeys: ['travel_past', 'travel_present', 'travel_future'] },
  { key: 'health', titleKey: 'topicHealth', singleKey: 'health_reading_single', spreadKeys: ['health_past', 'health_present', 'health_future'] },
];

function getTopicTitle(dict, titleKey) {
  return dict?.[titleKey]
    || (translations[state.currentLang] || translations.en)[titleKey]
    || titleKey;
}

function loadChartJs() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.Chart) return Promise.resolve(window.Chart);
  return import('https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js')
    .then((mod) => mod.Chart || mod.default || window.Chart)
    .catch(() => window.Chart || null);
}

// Energy Balance radar chart (full/life reading only).
function buildEnergyPanel(cards, dict) {
  const panel = document.createElement('div');
  panel.className = 'panel';

  const heading = document.createElement('h3');
  heading.textContent = dict.energyTitle || (state.currentLang === 'th' ? 'สมดุลพลังงาน' : 'Energy Balance');
  panel.appendChild(heading);

  const canvas = document.createElement('canvas');
  canvas.className = 'energy-chart';
  panel.appendChild(canvas);

  const elements = ['fire', 'water', 'air', 'earth'];
  const averages = elements.map((key) => {
    const sum = cards.slice(0, 3).reduce((acc, card) => {
      const value = Number(card?.energy_scores?.[key] ?? 0);
      return acc + (Number.isFinite(value) ? value : 0);
    }, 0);
    return Math.round(sum / 3);
  });

  const labels = [
    dict.energyFire || 'Fire',
    dict.energyWater || 'Water',
    dict.energyAir || 'Air',
    dict.energyEarth || 'Earth',
  ];

  loadChartJs().then((Chart) => {
    if (!Chart || !canvas) return;
    if (energyChart) energyChart.destroy();
    energyChart = new Chart(canvas, {
      type: 'radar',
      data: {
        labels,
        datasets: [
          {
            label: dict.energyTitle || 'Energy',
            data: averages,
            backgroundColor: 'rgba(120, 107, 255, 0.2)',
            borderColor: 'rgba(120, 107, 255, 0.9)',
            pointBackgroundColor: 'rgba(120, 107, 255, 0.9)',
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            ticks: { display: false },
          },
        },
        plugins: {
          legend: { display: false },
        },
      },
    });
  });

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

  const main = getText(card, 'standalone_present');
  if (main) {
    const p = document.createElement('p');
    p.className = 'lede';
    p.textContent = main;
    panel.appendChild(p);
  }

  readingContent.appendChild(panel);

  TOPIC_CONFIG.forEach((topic) => {
    const text = getText(card, topic.singleKey);
    const title = getTopicTitle(dict, topic.titleKey);
    const topicPanel = buildTopicPanel(title, text);
    if (topicPanel) readingContent.appendChild(topicPanel);
  });

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

  // Your Fortune (summary)
  const summaries = cards
    .slice(0, 3)
    .map((card, idx) => getText(card, `reading_summary_${positions[idx]}`))
    .filter(Boolean);

  if (summaries.length) {
    const panel = document.createElement('div');
    panel.className = 'panel';

    const h3 = document.createElement('h3');
    h3.textContent = dict.yourFortuneTitle || (state.currentLang === 'th' ? 'ดวงของคุณ' : 'Your Fortune');
    panel.appendChild(h3);

    summaries.forEach((summary, idx) => {
      const label = dict[positions[idx]] || positions[idx];
      const p = document.createElement('p');
      p.innerHTML = `<strong>${label}:</strong> ${summary}`;
      panel.appendChild(p);
    });

    readingContent.appendChild(panel);
  }

  TOPIC_CONFIG.forEach((topic) => {
    const texts = cards.slice(0, 3).map((card, idx) => ({
      label: dict[positions[idx]] || positions[idx],
      text: getText(card, topic.spreadKeys[idx]),
    })).filter((item) => item.text);

    if (!texts.length) return;

    const panel = document.createElement('div');
    panel.className = 'panel';

    const h3 = document.createElement('h3');
    h3.textContent = getTopicTitle(dict, topic.titleKey);
    panel.appendChild(h3);

    texts.forEach((item) => {
      const p = document.createElement('p');
      p.innerHTML = `<strong>${item.label}:</strong> ${item.text}`;
      panel.appendChild(p);
    });

    readingContent.appendChild(panel);
  });

  const energyPanel = buildEnergyPanel(cards, dict);
  if (energyPanel) readingContent.appendChild(energyPanel);
}

function renderQuestion(cards, dict) {
  if (!readingContent || !cards?.length) return;
  readingContent.innerHTML = '';

  const topic = String(state.topic || 'generic').toLowerCase();
  const card = cards[0];

  const panel = document.createElement('div');
  panel.className = 'panel';

  panel.appendChild(buildCardArt(card, 'hero'));

  const h2 = document.createElement('h2');
  h2.textContent = `${getName(card)} — ${getOrientationEnglish(card)}`;
  panel.appendChild(h2);

  const main = getText(card, 'standalone_present');
  if (main) {
    const p = document.createElement('p');
    p.className = 'lede';
    p.textContent = main;
    panel.appendChild(p);
  }

  readingContent.appendChild(panel);

  const topicConfig = TOPIC_CONFIG.find((item) => item.key === topic);
  const isGeneric = topic === 'generic' || topic === 'other';

  if (topicConfig && !isGeneric) {
    const topicPanel = buildTopicPanel(
      getTopicTitle(dict, topicConfig.titleKey),
      getText(card, topicConfig.singleKey)
    );
    if (topicPanel) readingContent.appendChild(topicPanel);
    return;
  }

  const heading = state.currentLang === 'th' ? 'คำแนะนำ' : (dict.guidanceHeading || dict.suggestionTitle || 'Guidance');
  const suggestion = buildSuggestionPanel(card, dict, heading);
  if (suggestion) readingContent.appendChild(suggestion);

  const meta = buildMetaPanel(card);
  if (meta) readingContent.appendChild(meta);
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

function base64UrlEncode(input) {
  const encoded = btoa(unescape(encodeURIComponent(input)));
  return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function buildSharePayload() {
  const dict = translations[state.currentLang] || translations.en;
  const modeTitle =
    state.mode === 'question'
      ? dict.questionTitle
      : state.mode === 'full'
        ? dict.overallTitle
        : dict.dailyTitle;
  const modeSubtitle =
    state.mode === 'question'
      ? dict.questionSpreadNote
      : state.mode === 'full'
        ? dict.readingSubtitle
        : dict.spreadQuick;

  const cards = state.selectedIds.map((id) => {
    const card = findCard(id);
    const orientation = toOrientation(id);
    const baseId = getBaseCardId(id, normalizeId) || normalizeId(id);
    return {
      id: baseId,
      orientation,
      name: card ? getName(card) : baseId,
    };
  });

  return {
    version: 1,
    lang: state.currentLang,
    mode: state.mode,
    spread: state.mode === 'daily' ? 'quick' : state.spread,
    topic: state.topic,
    cards: cards.map(({ id, orientation }) => ({ id, orientation })),
    title: modeTitle,
    subtitle: modeSubtitle,
    headline: dict.yourReading,
    keywords: cards.map((card) => card.name).filter(Boolean).slice(0, 3),
    canonicalUrl: window.location.href,
  };
}

function openSharePage({ action } = {}) {
  const payload = buildSharePayload();
  sessionStorage.setItem(SHARE_STORAGE_KEY, JSON.stringify(payload));
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const url = new URL('/share/', window.location.origin);
  if (encoded) url.searchParams.set('d', encoded);
  if (action) url.searchParams.set('action', action);
  window.location.href = url.toString();
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
  if (DEBUG_CAPTURE_ERRORS) {
    window.onerror = (...args) => console.error('Reading page error', ...args);
    window.onunhandledrejection = (event) => console.error('Reading page unhandled rejection', event?.reason || event);
  }

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

  shareBtn?.addEventListener('click', () => openSharePage());

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
