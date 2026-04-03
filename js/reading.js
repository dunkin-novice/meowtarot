import {
  applyLocaleMeta,
  applyTranslations,
  initShell,
  localizePath,
  pathHasThaiPrefix,
  translations,
} from './common.js';
import {
  loadTarotData,
  meowTarotCards,
  normalizeId,
  getCardImageFallbackUrl,
  getCardBackUrl,
  getCardBackFallbackUrl,
  applyImgFallback,
} from './data.js';
import {
  buildQuestionReadingInputPayload,
  findCardById,
  getBaseCardId,
  getCelticCrossIntegration,
  getCelticCrossInterpretation,
  getCelticCrossSlotText,
  toOrientation,
} from './reading-helpers.js';
import { buildPosterConfig, buildPosterCardPayload, buildReadingPayload } from './share-payload.js';
import {
  FULL_READING_POSITION_KEYS,
  getFullReadingPositionAt,
  getFullReadingPositionMeta,
} from './full-reading-position-order.js';
import { orderQuestionCards, QUESTION_CARD_POSITIONS } from './question-card-order.js';
import { buildCardImageUrls, resolveCardImageUrl, resolvePosterBackgroundPath, exists } from './asset-resolver.js';
import { getLocalizedField, getOrientationLabel } from './tarot-format.js';
import { getLuckyColorVisibilityStyle } from './lucky-color-visibility.js';

const params = new URLSearchParams(window.location.search);
const hasUrlSelection = ['cards', 'card', 'id', 'mode', 'topic', 'spread'].some((key) => params.has(key));

function readStoredSelection() {
  if (hasUrlSelection) return null;
  try {
    return JSON.parse(sessionStorage.getItem('meowtarot_selection') || 'null');
  } catch (_) {
    return null;
  }
}

const storageSelection = readStoredSelection();
const DEBUG_CAPTURE_ERRORS = false;

function isValidMode(raw = '') {
  const val = String(raw || '').toLowerCase().trim();
  return ['daily', 'day', 'full', 'overall', 'life', 'question', 'ask'].includes(val);
}

function normalizeMode(raw = '') {
  const val = String(raw || '').toLowerCase().trim();
  if (['daily', 'day'].includes(val)) return 'daily';
  if (['full', 'overall', 'life'].includes(val)) return 'full';
  if (['question', 'ask'].includes(val)) return 'question';
  return 'daily';
}

function defaultSpreadForMode(mode = 'daily') {
  if (mode === 'daily') return 'quick';
  if (mode === 'question') return 'story';
  return 'story';
}

function hydrateSpread(rawSpread, mode) {
  const spread = String(rawSpread || '').trim();
  return spread || defaultSpreadForMode(mode);
}

function parseSelectedIds() {
  const single = params.get('card') || params.get('id');
  if (single) return [single.trim()].filter(Boolean);

  const paramCards = params.get('ids') || params.get('cards');
  const storedCards = storageSelection?.cards;

  const combined = paramCards || (Array.isArray(storedCards) ? storedCards.join(',') : storedCards);
  if (!combined) return [];

  return combined
    .toString()
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

const rawHydratedMode = params.get('mode') || storageSelection?.mode || 'daily';
const hydratedMode = normalizeMode(rawHydratedMode);

const state = {
  currentLang: params.get('lang') || (pathHasThaiPrefix(window.location.pathname) ? 'th' : 'en'),
  mode: hydratedMode,
  spread: hydrateSpread(params.get('spread') || storageSelection?.spread, hydratedMode),
  topic: params.get('topic') || storageSelection?.topic || 'generic',
  selectedIds: parseSelectedIds(),
};

let dataLoaded = false;
let translationsReady = false;
let hasRendered = false;
let activeDict = translations[state.currentLang] || translations.en;
const imageSourceCache = new Map();
const imagePreloadCache = new Map();
const imageLoadedCache = new Set();
const resolvedResultCardSrcByKey = new Map();
const dailyUiState = {
  phase: 'idle',
  isAnimating: false,
  spreadCards: [],
  renderCards: [],
  selectedCardId: '',
  lastSignature: '',
  animationRunId: 0,
};
const DAILY_VISUAL_STATES = Object.freeze({
  IDLE: 'idle',
  GATHERING: 'gathering',
  STACKED: 'stacked',
  DEALING: 'dealing',
  REVEALED: 'revealed',
});
const DAILY_TIMINGS = Object.freeze({
  gatherMs: 260,
  shuffleMs: 200,
  dealMs: 210,
  staggerMs: 95,
  revealMs: 180,
});
const FULL_CELTIC_POSITION_KEYS = FULL_READING_POSITION_KEYS;
const LEGACY_FULL_POSITION_KEYS = ['past', 'present', 'future'];

function setDailyPhaseAttr(phase = '') {
  if (!document.body) return;
  if (!phase) {
    document.body.removeAttribute('data-daily-phase');
    return;
  }
  document.body.setAttribute('data-daily-phase', phase);
}

const readingContent = document.getElementById('reading-content');
const contextCopy = document.getElementById('reading-context');
const readingSubcontext = document.getElementById('reading-subcontext');
const readingTitle = document.getElementById('readingTitle');
const newReadingBtn = document.getElementById('newReadingBtn');
const shareBtn = document.getElementById('shareBtn');
const saveBtn = document.getElementById('saveBtn');
const resultsSection = document.querySelector('.section-block.results');
const backLink = document.querySelector('.back-link');

const cardSheetState = {
  card: null,
  src: '',
};

const cardSheetEls = {
  overlay: null,
  closeBtn: null,
  image: null,
  title: null,
  saveBtn: null,
  meaningBtn: null,
};
const SHARE_STORAGE_KEY = 'meowtarot_share_payload';
const SHARE_POSTER_SELECTOR = '#share-poster-root';
const SHARE_READY_TIMEOUT_MS = 8000;
const SHARE_HASH_MAX_CHARS = 8000;
let energyRadarController = null;
const ENERGY_BALANCE_CONFIG_URL = new URL('../data/energy-balance-interpretations.json', import.meta.url).toString();
let energyBalanceInterpretationsPromise = null;
let saveButtonHandler = null;
let shareButtonHandler = null;
let newReadingButtonHandler = null;
const HTML2CANVAS_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
let html2CanvasPromise = null;

function isPosterDebugEnabled() {
  const params = new URLSearchParams(window.location.search || '');
  if (params.get('poster_debug') === '1') return true;
  try {
    return String(window.localStorage?.getItem('POSTER_DEBUG') || '').trim() === '1';
  } catch (_) {
    return false;
  }
}

function isShareCiDebugEnabled() {
  if (typeof window === 'undefined') return false;
  if (window.DEBUG_SHARE_CI) return true;
  return new URLSearchParams(window.location.search).get('ci_share_debug') === '1';
}

function shareCiLog(step, payload = {}) {
  if (!isShareCiDebugEnabled()) return;
  console.log(JSON.stringify({ step, ...payload }));
}

const probedResultCardUrls = new Set();

function resultCardDebugLog(label, payload = {}) {
  if (!isPosterDebugEnabled()) return;
  console.info(label, payload);
}

async function probeResultCardUrl(url) {
  if (!isPosterDebugEnabled() || !url || probedResultCardUrls.has(url) || typeof fetch !== 'function') return;
  probedResultCardUrls.add(url);

  const probeHeaders = (res) => ({
    'content-type': res.headers.get('content-type'),
    'access-control-allow-origin': res.headers.get('access-control-allow-origin'),
    'cache-control': res.headers.get('cache-control'),
  });

  const requestWithTimeout = async (method) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(`${method}-timeout`), 5000);
    try {
      const res = await fetch(url, { method, mode: 'cors', signal: controller.signal });
      resultCardDebugLog('[ResultCard] probe', {
        method,
        url,
        status: res.status,
        finalUrl: res.url,
        redirected: res.redirected,
        headers: probeHeaders(res),
      });
      return true;
    } catch (error) {
      resultCardDebugLog('[ResultCard] probe_error', {
        method,
        url,
        message: error?.message || String(error),
      });
      return false;
    } finally {
      clearTimeout(timer);
    }
  };

  const headOk = await requestWithTimeout('HEAD');
  if (!headOk) await requestWithTimeout('GET');
}

const isMobile = () => window.innerWidth <= 768;

function getText(card, keyBase, lang = state.currentLang) {
  return getLocalizedField(card, keyBase, lang);
}

function getName(card, lang = state.currentLang) {
  if (!card) return '';

  const englishName = card.card_name_en || card.name_en || card.name || card.id;
  if (lang === 'en') return englishName;

  const thaiName = card.alias_th || card.name_th || card.name || '';
  if (thaiName && englishName) return `${thaiName} (${englishName})`;
  return thaiName || englishName || card.id;
}

function normalizeArchetypeText(text = '') {
  const raw = String(text || '').trim();
  if (!raw) return '';
  return raw.replace(/^I\s+/i, '').replace(/^(ฉัน)\s*/u, '').trim();
}

function getOrientationEnglish(card) {
  return getOrientationLabel(toOrientation(card), state.currentLang);
}

function getCardBaseSlug(card) {
  const slug = normalizeId(card?.seo_slug_en || card?.card_id || card?.id || card?.name_en || card?.name || '');
  return slug.replace(/-reversed$/, '').replace(/-upright$/, '');
}

function getResultCardCacheKey(cardId = '', orientation = 'upright') {
  const baseId = getBaseCardId(cardId, normalizeId) || normalizeId(cardId);
  const safeOrientation = orientation === 'reversed' ? 'reversed' : 'upright';
  return `${baseId}:${safeOrientation}`;
}

function getCardSelectionId(card) {
  if (!card) return '';
  return String(card.id || card.card_id || card.image_id || '').trim();
}

function buildCardMeaningUrl(card) {
  const slug = getCardBaseSlug(card);
  if (!slug) return null;
  const prefix = state.currentLang === 'th' ? '/th' : '';
  return `https://www.meowtarot.com${prefix}/tarot-card-meanings/${slug}/?lang=${state.currentLang}`;
}

function setBodyScrollLocked(locked) {
  document.body.classList.toggle('is-modal-open', locked);
}

function closeCardSheet() {
  if (!cardSheetEls.overlay || !cardSheetEls.overlay.classList.contains('is-open')) return;
  cardSheetEls.overlay.classList.remove('is-open');
  cardSheetEls.overlay.setAttribute('aria-hidden', 'true');
  setBodyScrollLocked(false);
  cardSheetEls.closeBtn?.focus();
}

async function saveCardImageFromSheet() {
  const src = cardSheetState.src;
  const card = cardSheetState.card;
  if (!src || !card) return;

  const fileName = `${getCardBaseSlug(card) || 'meowtarot-card'}.webp`;

  try {
    if (navigator.share && navigator.canShare) {
      const response = await fetch(src, { mode: 'cors' });
      const blob = await response.blob();
      const file = new File([blob], fileName, { type: blob.type || 'image/webp' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: getName(card) });
        return;
      }
    }
  } catch (error) {
    console.error('Share card image failed', error);
  }

  const link = document.createElement('a');
  link.href = src;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function openCardSheet(card) {
  if (!card || !cardSheetEls.overlay || !cardSheetEls.image) return;

  const { src, candidates = [] } = getCardImageUrlWithFallback(card);
  cardSheetState.card = card;
  cardSheetState.src = src;

  applyImgFallback(cardSheetEls.image, src, candidates);
  resolveCardImageUrl(card, toOrientation(card)).then((resolvedSrc) => {
    if (resolvedSrc && resolvedSrc !== cardSheetEls.image.src) {
      cardSheetEls.image.src = resolvedSrc;
      cardSheetState.src = resolvedSrc;
      probeResultCardUrl(resolvedSrc);
    }
  }).catch(() => {});
  cardSheetEls.image.alt = `${getName(card)} — ${getOrientationEnglish(card)}`;
  cardSheetEls.title.textContent = getName(card);
  cardSheetEls.meaningBtn.href = buildCardMeaningUrl(card) || '#';

  cardSheetEls.overlay.classList.add('is-open');
  cardSheetEls.overlay.setAttribute('aria-hidden', 'false');
  setBodyScrollLocked(true);
  cardSheetEls.closeBtn?.focus();
}

function ensureCardSheet() {
  if (cardSheetEls.overlay) return;
  const wrap = document.createElement('div');
  wrap.className = 'card-sheet-overlay';
  wrap.setAttribute('aria-hidden', 'true');
  wrap.innerHTML = `
    <div class="card-sheet-backdrop" data-sheet-close></div>
    <section class="card-sheet" role="dialog" aria-modal="true" aria-label="Card details">
      <button class="card-sheet-close" type="button" aria-label="Close" data-sheet-close>✕</button>
      <div class="card-sheet-media-wrap">
        <img class="card-sheet-media" alt="" />
      </div>
      <p class="card-sheet-title"></p>
      <div class="card-sheet-actions">
        <button class="primary" type="button" id="cardSheetSaveBtn">Save Image</button>
        <a class="ghost" id="cardSheetMeaningBtn" href="#">Read Card Meaning</a>
      </div>
    </section>
  `;

  document.body.appendChild(wrap);
  cardSheetEls.overlay = wrap;
  cardSheetEls.closeBtn = wrap.querySelector('.card-sheet-close');
  cardSheetEls.image = wrap.querySelector('.card-sheet-media');
  cardSheetEls.title = wrap.querySelector('.card-sheet-title');
  cardSheetEls.saveBtn = wrap.querySelector('#cardSheetSaveBtn');
  cardSheetEls.meaningBtn = wrap.querySelector('#cardSheetMeaningBtn');

  wrap.addEventListener('click', (event) => {
    if (event.target?.hasAttribute('data-sheet-close')) closeCardSheet();
  });

  cardSheetEls.saveBtn?.addEventListener('click', saveCardImageFromSheet);
  cardSheetEls.closeBtn?.addEventListener('click', closeCardSheet);

  let touchStartY = 0;
  wrap.addEventListener('touchstart', (event) => {
    touchStartY = event.changedTouches?.[0]?.clientY || 0;
  }, { passive: true });
  wrap.addEventListener('touchend', (event) => {
    const endY = event.changedTouches?.[0]?.clientY || 0;
    if (endY - touchStartY > 90) closeCardSheet();
  }, { passive: true });
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

const rgbToHslCache = new Map();

function rgbToHsl(r, g, b) {
  const cacheKey = `${r},${g},${b}`;
  const cached = rgbToHslCache.get(cacheKey);
  if (cached) return cached;
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

  const result = { h, s, l };
  rgbToHslCache.set(cacheKey, result);
  return result;
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
  const cacheKey = `${key}|${lang}`;
  const cached = hexToName.cache.get(cacheKey);
  if (cached) return cached;
  const hit = HEX_NAME_OVERRIDES[key];
  const resolved = hit ? hit[lang] || hit.en : basicColorNameFromHex(key, lang);
  hexToName.cache.set(cacheKey, resolved);
  return resolved;
}

hexToName.cache = new Map();

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
      || getOrientationLabel(targetOrientation, 'th'),
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

function getExpectedCardCount(mode = 'daily') {
  if (mode === 'daily') return state.spread === 'story' ? 3 : 1;
  if (mode === 'full') return FULL_CELTIC_POSITION_KEYS.length;
  return 3;
}

function getEntryPathForMode(mode = 'daily') {
  if (mode === 'question') return '/question.html';
  if (mode === 'full') return '/full.html';
  return '/daily.html';
}

function redirectToSafeEntry(mode = 'daily') {
  window.location.replace(localizePath(getEntryPathForMode(mode), state.currentLang));
}

function validateReadingState() {
  if (!isValidMode(rawHydratedMode)) {
    redirectToSafeEntry('daily');
    return false;
  }

  const expectedCount = getExpectedCardCount(state.mode);
  const selectedCount = state.selectedIds.length;

  if (state.mode === 'daily') {
    if (selectedCount && selectedCount !== expectedCount) state.selectedIds = [];
  } else if (selectedCount !== expectedCount) {
    redirectToSafeEntry(state.mode);
    return false;
  }

  const resolvedCount = state.selectedIds.map((id) => findCard(id)).filter(Boolean).length;
  if (resolvedCount !== selectedCount) {
    if (state.mode === 'daily') {
      state.selectedIds = [];
      return true;
    }
    redirectToSafeEntry(state.mode);
    return false;
  }

  return true;
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
  const orientation = toOrientation(card);
  const { uprightUrl, reversedUrl, backUrl } = buildCardImageUrls(card, orientation);
  const globalSiteFallbackUrl = getCardImageFallbackUrl() || getCardBackFallbackUrl() || getCardBackUrl();

  if (orientation === 'reversed') {
    return {
      src: reversedUrl || uprightUrl || backUrl || globalSiteFallbackUrl,
      candidates: [uprightUrl, backUrl, globalSiteFallbackUrl].filter(Boolean),
    };
  }

  return {
    src: uprightUrl || backUrl,
    candidates: [backUrl].filter(Boolean),
  };
}

async function resolveReadingResultRuntimeImageUrl(card) {
  const orientation = toOrientation(card);
  if (orientation !== 'reversed') return resolveCardImageUrl(card, orientation);

  const cardSlug = getCardBaseSlug(card) || normalizeId(card?.id || card?.card_id || card?.image_id || 'unknown-card');
  const { uprightUrl, reversedUrl, backUrl } = buildCardImageUrls(card, orientation);
  const globalSiteFallbackUrl = getCardImageFallbackUrl() || getCardBackFallbackUrl() || getCardBackUrl();
  const candidates = [reversedUrl, uprightUrl, backUrl, globalSiteFallbackUrl].filter(Boolean);
  let chosenFinalFallbackUrl = globalSiteFallbackUrl || backUrl || uprightUrl || reversedUrl || '';

  for (const requestedImageUrl of candidates) {
    const assetExists = await exists(requestedImageUrl);

    if (assetExists) {
      chosenFinalFallbackUrl = requestedImageUrl;
    }

    console.debug('[ReadingResult] runtime-image-resolver', {
      cardSlug,
      orientation,
      requestedImageUrl,
      assetExists,
      chosenFinalFallbackUrl,
    });

    if (assetExists) break;
  }

  return chosenFinalFallbackUrl;
}

function getStableCardImageSources(card) {
  const orientation = toOrientation(card);
  const cardId = String(card?.id || card?.image_id || card?.card_id || 'back-card');
  const cacheKey = `${cardId}:${orientation}:${state.currentLang}`;
  if (imageSourceCache.has(cacheKey)) return imageSourceCache.get(cacheKey);

  const resolved = getCardImageUrlWithFallback(card);
  const stable = {
    src: resolved?.src || getCardBackUrl(),
    candidates: Array.isArray(resolved?.candidates) ? resolved.candidates.filter(Boolean) : [],
  };
  imageSourceCache.set(cacheKey, stable);
  return stable;
}

function preloadImageSources(card, src, candidates = []) {
  const key = [card?.id || '', src, ...candidates].filter(Boolean).join('|');
  if (!key) return Promise.resolve();
  if (imagePreloadCache.has(key)) return imagePreloadCache.get(key);

  const promise = new Promise((resolve) => {
    const probe = new Image();
    const finalCandidates = Array.from(new Set([src, ...candidates].filter(Boolean)));

    resolveReadingResultRuntimeImageUrl(card)
      .then((finalUrl) => {
        if (finalUrl) {
          const idx = finalCandidates.indexOf(finalUrl);
          if (idx > 0) {
            finalCandidates.splice(idx, 1);
            finalCandidates.unshift(finalUrl);
          } else if (idx < 0) {
            finalCandidates.unshift(finalUrl);
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        applyImgFallback(probe, finalCandidates[0], finalCandidates.slice(1));

        if (probe.complete && probe.naturalWidth > 0) {
          imageLoadedCache.add(key);
          resolve();
          return;
        }

        probe.onload = () => {
          imageLoadedCache.add(key);
          resolve();
        };
        probe.onerror = () => resolve();
      });
  });

  imagePreloadCache.set(key, promise);
  return promise;
}

function buildCardArt(card, variant = 'hero') {
  const wrap = document.createElement('div');
  wrap.className = variant === 'thumb' ? 'card-art is-thumb' : 'card-art';

  const img = document.createElement('img');
  img.className = 'card-art-img';
  img.alt = `${getName(card)} — ${getOrientationEnglish(card)}`;
  img.loading = 'eager';
  // Must be set before src for cross-origin draw/share paths.
  img.crossOrigin = 'anonymous';

  const orientation = toOrientation(card);
  const { src, candidates = [] } = getStableCardImageSources(card);
  const { backUrl } = buildCardImageUrls(card, orientation);
  const webpUrl = src || backUrl;
  const jpgUrl = webpUrl.replace(/\.webp(?=\?|$)/i, '.jpg');
  const fallbackCandidates = [jpgUrl, ...candidates, backUrl].filter(Boolean);

  // Deterministic fallback chain: WebP -> JPG -> card back.
  const fallbackChain = [webpUrl, ...fallbackCandidates].filter(Boolean);
  let index = 0;

  resultCardDebugLog('[ResultCard] urls', {
    webpUrl,
    jpgUrl,
    chosenUrl: fallbackChain[0] || null,
  });
  probeResultCardUrl(webpUrl);

  const cacheKey = getResultCardCacheKey(card?.id || card?.card_id || card?.image_id || '', orientation);

  const stepToNextFallback = (reason = 'error') => {
    if (index >= fallbackChain.length - 1) return;
    index += 1;
    const nextUrl = fallbackChain[index];
    if (!nextUrl || nextUrl === img.src) return;
    resultCardDebugLog('[ResultCard] fallback', { reason, nextUrl, step: index });
    img.src = nextUrl;
    probeResultCardUrl(nextUrl);
  };

  img.addEventListener('load', () => {
    // WebKit edge-case guard: onload can fire with naturalWidth=0 when decode fails.
    if (!img.naturalWidth || !img.naturalHeight) {
      resultCardDebugLog('[ResultCard] onload_decode_fail', { url: img.currentSrc || img.src });
      stepToNextFallback('decode-fail');
      return;
    }

    const loadedUrl = img.currentSrc || img.src;
    resolvedResultCardSrcByKey.set(cacheKey, loadedUrl);
    resultCardDebugLog('[ResultCard] onload', {
      url: loadedUrl,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
    });
  });

  img.addEventListener('error', (event) => {
    const failedUrl = img.currentSrc || img.src || fallbackChain[index];
    resultCardDebugLog('[ResultCard] onerror', {
      url: failedUrl,
      message: event?.message || event?.type || 'error',
    });
    stepToNextFallback('error');
  });

  img.src = fallbackChain[0] || backUrl;

  resolveReadingResultRuntimeImageUrl(card).then((resolvedSrc) => {
    if (!resolvedSrc || resolvedSrc === img.src) return;
    img.src = resolvedSrc;
    probeResultCardUrl(resolvedSrc);
  }).catch(() => {});

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

function splitFirstSentence(text) {
  const value = String(text || '').trim();
  if (!value) return { first: '', rest: '' };

  const sentenceMatch = value.match(/^(.+?[.!?。！？]+)(\s+|$)([\s\S]*)$/u);
  if (sentenceMatch) {
    return {
      first: sentenceMatch[1].trim(),
      rest: sentenceMatch[3] ? sentenceMatch[3].trim() : '',
    };
  }

  return { first: value, rest: '' };
}

function buildTopicPanel(title, text) {
  if (!text) return null;

  const panel = document.createElement('div');
  panel.className = 'panel';

  const h3 = document.createElement('h3');
  h3.textContent = title;
  panel.appendChild(h3);

  const { first, rest } = splitFirstSentence(text);
  const p = document.createElement('p');
  p.className = 'topic-copy';

  const lead = document.createElement('span');
  lead.className = 'topic-copy-lead';
  lead.textContent = first;
  p.appendChild(lead);

  if (rest) {
    p.appendChild(document.createTextNode(' '));
    const detail = document.createElement('span');
    detail.className = 'topic-copy-rest';
    detail.textContent = rest;
    p.appendChild(detail);
  }

  panel.appendChild(p);

  return panel;
}

function buildMetaPanel(card, options = {}) {
  if (!card) return null;

  const { onlyLuckyColors = false } = options;
  const meta = [];

  if (!onlyLuckyColors) {
    const element = getText(card, 'element') || card.element;
    const planet = getText(card, 'planet') || card.planet;

    // ✅ FIX: support numerology_value (your JSON uses numerology_value)
    const numerology =
      card.numerology
      ?? card.numerology_value
      ?? getText(card, 'numerology')
      ?? '';

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
  }

  // ✅ Lucky colors: use color_palette (show NAME not hex)
  const luckyPalette = normalizeColorArray(card.color_palette).filter(Boolean).slice(0, 6);

  // ✅ Avoid colors: use avoid_color_palette
  const avoidPalette = onlyLuckyColors
    ? []
    : normalizeColorArray(card.avoid_color_palette).filter(Boolean).slice(0, 6);

  if (!meta.length && !luckyPalette.length && !avoidPalette.length) return null;

  const panel = document.createElement('div');
  panel.className = 'panel';

  const row = document.createElement('div');
  row.className = 'meta-row';

  const identityGroup = document.createElement('div');
  identityGroup.className = 'meta-group meta-group--identity';

  meta.forEach((item) => {
    const chip = document.createElement('span');
    chip.className = 'meta-badge';
    chip.textContent = `${item.label}: ${item.value}`;
    identityGroup.appendChild(chip);
  });

  if (identityGroup.childElementCount) {
    row.appendChild(identityGroup);
  }

  function buildColorGroup(label, colors, groupClassName, options = {}) {
    if (!colors.length) return null;

    const { circlesOnly = false } = options;
    const group = document.createElement('div');
    group.className = `meta-group ${groupClassName}`;
    if (circlesOnly) {
      group.style.justifyContent = 'center';
      group.style.width = '100%';
    }

    const labelChip = document.createElement('span');
    labelChip.className = 'meta-badge';
    labelChip.textContent = label;
    if (circlesOnly) {
      labelChip.style.width = '100%';
      labelChip.style.justifyContent = 'center';
      labelChip.style.textAlign = 'center';
    }
    group.appendChild(labelChip);

    const circlesRow = circlesOnly ? document.createElement('div') : null;
    if (circlesRow) {
      circlesRow.style.display = 'flex';
      circlesRow.style.justifyContent = 'center';
      circlesRow.style.gap = '10px';
      circlesRow.style.width = '100%';
    }

    colors.forEach((c) => {
      const swatch = document.createElement('span');
      swatch.className = 'swatch';

      const cssColor = resolveCssColor(c);
      if (cssColor) swatch.style.background = cssColor;

      if (circlesOnly) {
        swatch.style.width = '16px';
        swatch.style.height = '16px';
        swatch.style.borderRadius = '999px';
        circlesRow.appendChild(swatch);
        return;
      }

      const chip = document.createElement('span');
      chip.className = 'meta-badge';

      const txt = document.createElement('span');

      // ✅ IMPORTANT: never show hex text
      if (isHexColor(c)) {
        txt.textContent = hexToName(c, state.currentLang === 'th' ? 'th' : 'en');
      } else {
        txt.textContent = String(c);
      }

      chip.append(swatch, txt);
      group.appendChild(chip);
    });

    if (circlesRow) group.appendChild(circlesRow);
    return group;
  }

  const luckyGroup = buildColorGroup(
    state.currentLang === 'th' ? 'สีมงคลประจำวัน' : "Today's lucky colors",
    luckyPalette,
    'meta-group--lucky',
    { circlesOnly: onlyLuckyColors }
  );
  if (luckyGroup) row.appendChild(luckyGroup);

  const avoidGroup = buildColorGroup(
    state.currentLang === 'th' ? 'สีที่ควรเลี่ยง' : 'Colors to avoid',
    avoidPalette,
    'meta-group--avoid'
  );
  if (avoidGroup) row.appendChild(avoidGroup);

  panel.appendChild(row);
  return panel;
}

// Topic mapping for daily/question/full reading sections.
const ALL_TOPICS = [
  { key: 'love', titleKey: 'topicLove', singleKey: 'love_reading_single', spreadKeys: ['love_past', 'love_present', 'love_future'] },
  { key: 'career', titleKey: 'topicCareer', singleKey: 'career_reading_single', spreadKeys: ['career_past', 'career_present', 'career_future'] },
  { key: 'finance', titleKey: 'topicFinance', singleKey: 'finance_reading_single', spreadKeys: ['finance_past', 'finance_present', 'finance_future'] },
  { key: 'self', titleKey: 'topicSelf', singleKey: 'self_reading_single', spreadKeys: ['self_past', 'self_present', 'self_future'] },
  { key: 'family', titleKey: 'topicFamily', singleKey: 'family_reading_single', spreadKeys: ['family_past', 'family_present', 'family_future'] },
  { key: 'travel', titleKey: 'topicTravel', singleKey: 'travel_reading_single', spreadKeys: ['travel_past', 'travel_present', 'travel_future'] },
  { key: 'health', titleKey: 'topicHealth', singleKey: 'health_reading_single', spreadKeys: ['health_past', 'health_present', 'health_future'] },
];

function getTopicConfig() {
  return ALL_TOPICS;
}

function getTopicTitle(dict, titleKey) {
  return dict?.[titleKey]
    || (translations[state.currentLang] || translations.en)[titleKey]
    || titleKey;
}

function formatReadingTemplate(template = '', replacements = {}) {
  return String(template || '').replace(/\{(\w+)\}/g, (_, key) => replacements[key] ?? '');
}

function getQuestionTopicLabel(dict = activeDict) {
  const topicConfig = getTopicConfig().find((item) => item.key === String(state.topic || '').toLowerCase());
  if (!topicConfig) return dict?.topicGeneric || translations[state.currentLang]?.topicGeneric || 'Any question';
  return getTopicTitle(dict, topicConfig.titleKey);
}

function getQuestionResultKicker(dict = activeDict) {
  return formatReadingTemplate(dict?.questionResultKicker || 'Ask a Question · {topic}', {
    topic: getQuestionTopicLabel(dict),
  }).trim();
}

function buildQuestionTakeawayPanel(cards = [], dict = activeDict) {
  const orderedCards = orderQuestionCards(cards).slice(0, 3);
  if (!orderedCards.length) return null;

  const panel = document.createElement('section');
  panel.className = 'panel panel--question-takeaway';

  const title = document.createElement('h3');
  title.textContent = dict?.questionTakeawayTitle || (state.currentLang === 'th' ? 'ข้อสรุปสำคัญ' : 'Your takeaway');
  panel.appendChild(title);

  const sentences = [];
  orderedCards.forEach((card, idx) => {
    const positionKey = QUESTION_CARD_POSITIONS[idx];
    const templateKey = idx === 0 ? 'summaryPast' : idx === 1 ? 'summaryPresent' : 'summaryFuture';
    const summaryLine = formatReadingTemplate(dict?.[templateKey] || '', {
      card: getName(card),
      position: dict?.[positionKey] || positionKey,
    }).trim();
    if (summaryLine) sentences.push(summaryLine);
  });

  const lead = document.createElement('p');
  lead.className = 'question-takeaway__lead';
  lead.textContent = formatReadingTemplate(dict?.questionTakeawayLead || 'Taken together, your cards suggest {summary}', {
    summary: sentences.join(' '),
  }).trim();
  panel.appendChild(lead);

  const advice = document.createElement('p');
  advice.className = 'question-takeaway__advice';
  advice.textContent = dict?.summaryAdvice || '';
  panel.appendChild(advice);

  return panel;
}

function isEnergyBalanceDebugEnabled() {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search || '');
  if (params.get('energy_debug') === '1') return true;
  try {
    return String(window.localStorage?.getItem('ENERGY_DEBUG') || '').trim() === '1';
  } catch (_) {
    return false;
  }
}

function energyDebugLog(message, payload = {}) {
  if (!isEnergyBalanceDebugEnabled()) return;
  console.info(`[EnergyBalance] ${message}`, payload);
}

function loadEnergyBalanceInterpretations() {
  if (energyBalanceInterpretationsPromise) return energyBalanceInterpretationsPromise;

  energyBalanceInterpretationsPromise = fetch(ENERGY_BALANCE_CONFIG_URL, { cache: 'force-cache' })
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to load interpretations (${res.status})`);
      return res.json();
    })
    .catch((error) => {
      energyBalanceInterpretationsPromise = null;
      throw error;
    });

  return energyBalanceInterpretationsPromise;
}

function normalizeEnergyBalanceValues(values = {}) {
  const keys = ['A', 'E', 'T', 'S'];
  const parsed = keys.map((key) => {
    const value = Number(values[key]);
    return Number.isFinite(value) ? value : 0;
  });

  const maxValue = Math.max(...parsed);
  const scale = maxValue <= 1 ? 100 : 1;
  const toRange = (value) => Math.max(0, Math.min(100, Math.round(value * scale)));

  return {
    A: toRange(parsed[0]),
    E: toRange(parsed[1]),
    T: toRange(parsed[2]),
    S: toRange(parsed[3]),
  };
}

function buildEnergyMatcherById(id, thresholds = {}) {
  const BAL = Number(thresholds.BAL ?? 8);
  const GAP = Number(thresholds.GAP ?? 10);
  const LOW = Number(thresholds.LOW ?? 30);

  const abs = Math.abs;
  const max = (...nums) => Math.max(...nums);
  const min = (...nums) => Math.min(...nums);
  const avg = (...nums) => nums.reduce((sum, value) => sum + value, 0) / nums.length;
  const parseAxis = (axis) => ['A', 'E', 'T', 'S'].includes(axis) ? axis : null;
  const otherAxes = (axis) => ['A', 'E', 'T', 'S'].filter((key) => key !== axis);

  if (id === 'balanced_all') {
    return ({ A, E, T, S }) => max(A, E, T, S) - min(A, E, T, S) <= BAL;
  }

  if (id === 'muted_all') {
    return ({ A, E, T, S }) => max(A, E, T, S) <= LOW && (max(A, E, T, S) - min(A, E, T, S)) <= BAL;
  }

  const tripleMatch = /^triple_([AETS]{3})_low_([AETS])$/.exec(id);
  if (tripleMatch) {
    const tripleAxes = tripleMatch[1].split('').map(parseAxis);
    const lowAxis = parseAxis(tripleMatch[2]);
    if (!lowAxis || tripleAxes.some((axis) => !axis)) return () => false;
    return (values) => {
      const [x, y, z] = tripleAxes.map((axis) => values[axis]);
      return abs(x - y) <= BAL && abs(x - z) <= BAL && abs(y - z) <= BAL && (avg(x, y, z) - values[lowAxis]) >= GAP;
    };
  }

  const pairMatch = /^pair_([AETS]{2})$/.exec(id);
  if (pairMatch) {
    const pairAxes = pairMatch[1].split('').map(parseAxis);
    if (pairAxes.some((axis) => !axis)) return () => false;
    const [a1, a2] = pairAxes;
    const rest = ['A', 'E', 'T', 'S'].filter((axis) => !pairAxes.includes(axis));
    return (values) => abs(values[a1] - values[a2]) <= BAL
      && values[a1] - values[rest[0]] >= GAP
      && values[a1] - values[rest[1]] >= GAP
      && values[a2] - values[rest[0]] >= GAP
      && values[a2] - values[rest[1]] >= GAP;
  }

  const domWeakMatch = /^dom_([AETS])_weak_([AETS])$/.exec(id);
  if (domWeakMatch) {
    const domAxis = parseAxis(domWeakMatch[1]);
    const weakAxis = parseAxis(domWeakMatch[2]);
    if (!domAxis || !weakAxis || domAxis === weakAxis) return () => false;
    const rest = otherAxes(domAxis);
    return (values) => values[domAxis] >= values[rest[0]]
      && values[domAxis] >= values[rest[1]]
      && values[domAxis] >= values[rest[2]]
      && (values[domAxis] - max(values[rest[0]], values[rest[1]], values[rest[2]])) >= BAL
      && min(values.A, values.E, values.T, values.S) === values[weakAxis];
  }

  const domMatch = /^dom_([AETS])$/.exec(id);
  if (domMatch) {
    const domAxis = parseAxis(domMatch[1]);
    if (!domAxis) return () => false;
    const rest = otherAxes(domAxis);
    return (values) => (values[domAxis] - max(values[rest[0]], values[rest[1]], values[rest[2]])) >= GAP
      && (max(values[rest[0]], values[rest[1]], values[rest[2]]) - min(values[rest[0]], values[rest[1]], values[rest[2]])) < BAL;
  }

  const weakMatch = /^weak_([AETS])$/.exec(id);
  if (weakMatch) {
    const weakAxis = parseAxis(weakMatch[1]);
    if (!weakAxis) return () => false;
    const rest = otherAxes(weakAxis);
    return (values) => (min(values[rest[0]], values[rest[1]], values[rest[2]]) - values[weakAxis]) >= GAP
      && (max(values[rest[0]], values[rest[1]], values[rest[2]]) - min(values[rest[0]], values[rest[1]], values[rest[2]])) < BAL;
  }

  return () => false;
}

function resolveEnergyBalanceInterpretation(values, config = {}) {
  const normalized = normalizeEnergyBalanceValues(values);
  const conditions = Array.isArray(config.conditions) ? config.conditions : [];
  const fallback = conditions.find((condition) => condition?.id === 'mixed_transition')
    || conditions.find((condition) => String(condition?.rule || '').toUpperCase() === 'ELSE')
    || conditions[conditions.length - 1]
    || null;

  for (const condition of conditions) {
    if (!condition?.id || String(condition.rule || '').toUpperCase() === 'ELSE') continue;
    const matcher = buildEnergyMatcherById(condition.id, config.thresholds || {});
    if (matcher(normalized)) {
      energyDebugLog('matched', {
        values: normalized,
        id: condition.id,
        group: condition.group,
        fallbackUsed: false,
      });
      return condition;
    }
  }

  energyDebugLog('fallback', {
    values: normalized,
    id: fallback?.id || null,
    group: fallback?.group || null,
    fallbackUsed: true,
  });
  return fallback;
}

function renderEnergyBalanceInterpretation(target, interpretation) {
  if (!target) return;
  target.textContent = interpretation?.sentence || '';
}

function computeFullReadingEnergyData(cards = []) {
  const elements = ['fire', 'water', 'air', 'earth'];
  const selectedCards = cards.slice(0, 3);
  const divisor = selectedCards.length || 1;
  const averages = elements.map((key) => {
    const sum = selectedCards.reduce((acc, card) => {
      const value = Number(card?.energy_scores?.[key] ?? 0);
      return acc + (Number.isFinite(value) ? value : 0);
    }, 0);
    return Math.round(sum / divisor);
  });

  return {
    action: averages[0],
    emotion: averages[1],
    thinking: averages[2],
    stability: averages[3],
  };
}

// Energy Balance radar chart (full/life reading only).
function buildEnergyPanel(cards, dict) {
  const panel = document.createElement('section');
  panel.className = 'panel energy-balance';

  const heading = document.createElement('h2');
  heading.className = 'energy-balance__title';
  heading.textContent = dict.energyTitle || (state.currentLang === 'th' ? 'สมดุลพลังงาน' : 'Energy Balance');
  panel.appendChild(heading);

  const chartCard = document.createElement('div');
  chartCard.className = 'energy-balance__chart-card';

  const chartWrap = document.createElement('div');
  chartWrap.className = 'energy-balance__chart-wrap';
  chartWrap.innerHTML = `
    <svg class="energy-radar" viewBox="0 0 400 400" aria-label="Energy balance radar chart" role="img">
      <defs>
        <linearGradient id="energyRadarFillGradient" x1="20%" y1="15%" x2="86%" y2="88%">
          <stop offset="0%" stop-color="#d8fff2" stop-opacity="0.9"></stop>
          <stop offset="33%" stop-color="#ffe7a8" stop-opacity="0.86"></stop>
          <stop offset="67%" stop-color="#ffd3eb" stop-opacity="0.84"></stop>
          <stop offset="100%" stop-color="#dccbff" stop-opacity="0.88"></stop>
        </linearGradient>
        <filter id="energyRadarBlur" x="-28%" y="-28%" width="156%" height="156%">
          <feGaussianBlur stdDeviation="10"></feGaussianBlur>
        </filter>
      </defs>

      <g id="energyRadarGrid"></g>
      <g id="energyRadarAxes"></g>

      <polygon id="energyRadarGlow"></polygon>
      <polygon id="energyRadarShape"></polygon>

      <g id="energyRadarDots"></g>
    </svg>

    <div class="energy-radar__label energy-radar__label--top">Action</div>
    <div class="energy-radar__label energy-radar__label--right">Emotion</div>
    <div class="energy-radar__label energy-radar__label--bottom">Thinking</div>
    <div class="energy-radar__label energy-radar__label--left">Stability</div>
  `;
  chartCard.appendChild(chartWrap);

  const interpretation = document.createElement('p');
  interpretation.className = 'energy-interpretation';
  interpretation.textContent = 'Your energy is currently led by emotion, with strong support from thinking. Keep this momentum balanced with gentle reflection to stay grounded and clear.';
  chartCard.appendChild(interpretation);
  panel.appendChild(chartCard);

  const energyData = computeFullReadingEnergyData(cards);

  const svg = chartWrap.querySelector('.energy-radar');
  const gridGroup = svg?.querySelector('#energyRadarGrid');
  const axesGroup = svg?.querySelector('#energyRadarAxes');
  const shape = svg?.querySelector('#energyRadarShape');
  const glow = svg?.querySelector('#energyRadarGlow');
  const dotsGroup = svg?.querySelector('#energyRadarDots');

  const chartConfig = {
    centerX: 200,
    centerY: 200,
    maxRadius: 132,
    axisOrder: ['action', 'emotion', 'thinking', 'stability'],
    angles: {
      action: -Math.PI / 2,
      emotion: 0,
      thinking: Math.PI / 2,
      stability: Math.PI,
    },
    gridRings: [1, 0.75, 0.5, 0.25],
  };

  const clampUnit = (value) => Math.max(0, Math.min(1, Number(value) || 0));
  const toRadius = (value) => clampUnit(value / 100) * chartConfig.maxRadius;
  const toPoint = (axis, value) => {
    const radius = toRadius(value);
    const angle = chartConfig.angles[axis];
    return {
      x: chartConfig.centerX + Math.cos(angle) * radius,
      y: chartConfig.centerY + Math.sin(angle) * radius,
    };
  };
  const buildPolygonPoints = (values) => chartConfig.axisOrder
    .map((axis) => {
      const point = toPoint(axis, values[axis]);
      return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
    })
    .join(' ');

  const renderGrid = () => {
    if (!gridGroup) return;
    gridGroup.textContent = '';
    chartConfig.gridRings.forEach((ring) => {
      const radius = chartConfig.maxRadius * ring;
      const points = [
        `${chartConfig.centerX},${(chartConfig.centerY - radius).toFixed(2)}`,
        `${(chartConfig.centerX + radius).toFixed(2)},${chartConfig.centerY}`,
        `${chartConfig.centerX},${(chartConfig.centerY + radius).toFixed(2)}`,
        `${(chartConfig.centerX - radius).toFixed(2)},${chartConfig.centerY}`,
      ].join(' ');
      const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      polygon.setAttribute('points', points);
      polygon.setAttribute('class', 'energy-radar__grid-ring');
      gridGroup.appendChild(polygon);
    });
  };

  const renderAxes = () => {
    if (!axesGroup) return;
    axesGroup.textContent = '';
    chartConfig.axisOrder.forEach((axis) => {
      const endpoint = toPoint(axis, 100);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(chartConfig.centerX));
      line.setAttribute('y1', String(chartConfig.centerY));
      line.setAttribute('x2', endpoint.x.toFixed(2));
      line.setAttribute('y2', endpoint.y.toFixed(2));
      line.setAttribute('class', 'energy-radar__axis');
      axesGroup.appendChild(line);
    });
  };

  const renderDots = (values) => {
    if (!dotsGroup) return;
    dotsGroup.textContent = '';
    chartConfig.axisOrder.forEach((axis) => {
      const point = toPoint(axis, values[axis]);
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('class', 'energy-radar__dot');
      dot.setAttribute('r', '5.2');
      dot.setAttribute('cx', point.x.toFixed(2));
      dot.setAttribute('cy', point.y.toFixed(2));
      dotsGroup.appendChild(dot);
    });
  };

  let animatedValues = {
    action: 0,
    emotion: 0,
    thinking: 0,
    stability: 0,
  };
  let animationFrame = null;

  const renderRadarShape = (values) => {
    const points = buildPolygonPoints(values);
    if (shape) shape.setAttribute('points', points);
    if (glow) glow.setAttribute('points', points);
    renderDots(values);
  };

  const renderEnergyRadar = (values) => {
    const next = {
      action: Number(values?.action) || 0,
      emotion: Number(values?.emotion) || 0,
      thinking: Number(values?.thinking) || 0,
      stability: Number(values?.stability) || 0,
    };
    const start = { ...animatedValues };
    const startedAt = performance.now();
    const duration = 520;

    if (animationFrame) cancelAnimationFrame(animationFrame);

    const animate = (now) => {
      const elapsed = now - startedAt;
      const t = clampUnit(elapsed / duration);
      const eased = 1 - (1 - t) ** 3;

      animatedValues = {
        action: start.action + ((next.action - start.action) * eased),
        emotion: start.emotion + ((next.emotion - start.emotion) * eased),
        thinking: start.thinking + ((next.thinking - start.thinking) * eased),
        stability: start.stability + ((next.stability - start.stability) * eased),
      };

      renderRadarShape(animatedValues);

      if (t < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        animationFrame = null;
      }
    };

    animationFrame = requestAnimationFrame(animate);
  };

  renderGrid();
  renderAxes();
  renderEnergyRadar(energyData);

  energyRadarController = { renderEnergyRadar };
  panel.renderEnergyRadar = renderEnergyRadar;
  if (typeof window !== 'undefined') {
    window.renderEnergyRadar = (values) => {
      energyRadarController?.renderEnergyRadar(values || {});
    };
  }

  return panel;
}


function buildDailyTextPanel(text, options = {}) {
  if (!text) return null;

  const { emphasize = false, subtle = false } = options;
  const panel = document.createElement('div');
  panel.className = 'panel';

  const p = document.createElement('p');
  if (subtle) p.className = 'topic-copy';
  if (emphasize) {
    p.innerHTML = `<em>"${String(text).trim()}"</em>`;
  } else {
    p.textContent = text;
  }
  panel.appendChild(p);

  return panel;
}

function buildDailyGuidancePanel(card, hook = '') {
  if (!card) return null;

  const reflection = getText(card, 'reflection_question');
  const action = getText(card, 'action_prompt');
  const affirmation = getText(card, 'affirmation');
  if (!hook && !reflection && !action && !affirmation) return null;

  const panel = document.createElement('div');
  panel.className = 'panel';

  if (hook) {
    const p = document.createElement('p');
    p.className = 'lede';
    p.style.fontSize = '1.04em';
    p.style.fontWeight = '600';
    p.style.color = '#2f2940';
    p.style.textAlign = 'center';
    p.textContent = hook;
    panel.appendChild(p);
  }

  if (reflection) {
    const p = document.createElement('p');
    p.style.textAlign = 'left';
    p.textContent = reflection;
    panel.appendChild(p);
  }

  if (action) {
    const p = document.createElement('p');
    p.style.textAlign = 'left';
    p.textContent = action;
    panel.appendChild(p);
  }

  if (affirmation) {
    const p = document.createElement('p');
    p.style.textAlign = 'left';
    p.innerHTML = `<em>"${String(affirmation).trim()}"</em>`;
    panel.appendChild(p);
  }

  return panel;
}

function buildDailyAdvicePanel(card) {
  if (!card) return null;

  const ritual = getText(card, 'ritual_2min');
  const luckyPalette = normalizeColorArray(card.color_palette).filter(Boolean).slice(0, 6);
  if (!ritual && !luckyPalette.length) return null;

  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.style.textAlign = 'center';

  const title = document.createElement('h3');
  title.textContent = state.currentLang === 'th' ? 'คำแนะนำวันนี้' : "Today's Advice";
  title.style.textAlign = 'center';
  panel.appendChild(title);

  if (ritual) {
    const ritualText = document.createElement('p');
    ritualText.className = 'topic-copy';
    ritualText.textContent = ritual;
    panel.appendChild(ritualText);
  }

  if (luckyPalette.length) {
    const luckyLabel = document.createElement('p');
    luckyLabel.className = 'meta-badge';
    luckyLabel.style.display = 'inline-flex';
    luckyLabel.style.justifyContent = 'center';
    luckyLabel.style.width = '100%';
    luckyLabel.style.textAlign = 'center';
    luckyLabel.style.marginTop = ritual ? '6px' : '0';
    luckyLabel.textContent = state.currentLang === 'th' ? 'สีมงคลวันนี้' : "Today's lucky colors";
    panel.appendChild(luckyLabel);

    const circles = document.createElement('div');
    circles.style.display = 'flex';
    circles.style.justifyContent = 'center';
    circles.style.gap = '10px';
    circles.style.marginTop = '4px';
    const panelSurface = window.getComputedStyle(panel).backgroundColor || 'rgba(255, 255, 255, 0.05)';

    luckyPalette.forEach((c) => {
      const swatch = document.createElement('span');
      swatch.className = 'swatch';
      const cssColor = resolveCssColor(c);
      if (cssColor) swatch.style.background = cssColor;
      const visibility = getLuckyColorVisibilityStyle(cssColor, panelSurface);
      swatch.style.width = '16px';
      swatch.style.height = '16px';
      swatch.style.borderRadius = '999px';
      swatch.style.border = `${visibility.ringWidth}px solid ${visibility.ringColor}`;
      circles.appendChild(swatch);
    });

    panel.appendChild(circles);
  }

  return panel;
}

function resetDailyUiState() {
  dailyUiState.phase = DAILY_VISUAL_STATES.IDLE;
  dailyUiState.isAnimating = false;
  dailyUiState.spreadCards = [];
  dailyUiState.renderCards = [];
  dailyUiState.selectedCardId = '';
  dailyUiState.lastSignature = '';
  dailyUiState.animationRunId += 1;
  setDailyPhaseAttr(DAILY_VISUAL_STATES.IDLE);
}

function stripOrientationSuffix(value = '') {
  return String(value || '').replace(/-(upright|reversed)$/i, '');
}

function pickDailyOrientation(probabilityReversed = 0.5) {
  const safeProb = Math.min(1, Math.max(0, probabilityReversed));
  return Math.random() < safeProb ? 'reversed' : 'upright';
}

function getDailySpreadCandidates(size = 6) {
  const cards = Array.isArray(meowTarotCards) ? meowTarotCards : [];
  if (!cards.length) return [];

  const seen = new Set();
  const pool = cards
    .filter((card) => {
      const baseId = stripOrientationSuffix(card?.card_id || card?.id || card?.image_id || '');
      if (!baseId || seen.has(baseId)) return false;
      seen.add(baseId);
      return true;
    })
    .map((card) => {
      const baseId = normalizeId(stripOrientationSuffix(card?.card_id || card?.id || card?.image_id || ''));
      const orientation = pickDailyOrientation();
      return findCard(`${baseId}-${orientation}`) || ensureOrientation(card, orientation);
    })
    .filter(Boolean);

  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, Math.min(size, pool.length));
}

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getDailyEntryStrings(dict = activeDict) {
  if (state.currentLang === 'th') {
    return {
      deal: 'เปิดไพ่',
      card: 'ไพ่ใบที่',
    };
  }

  return {
    deal: 'Deal',
    card: 'Card',
  };
}

function createDailyDeckElement(label = '') {
  const deckWrap = document.createElement('div');
  deckWrap.className = 'daily-deck-stack daily-deck-stack--center';
  if (label) deckWrap.setAttribute('aria-label', label);

  const deckBackUrl = getCardBackUrl() || getCardBackFallbackUrl();
  if (deckBackUrl) {
    deckWrap.style.setProperty('--daily-deck-back-url', `url("${deckBackUrl}")`);
  }

  for (let i = 0; i < 7; i += 1) {
    const layer = document.createElement('span');
    layer.className = 'daily-deck-layer';
    const offset = Math.max(0, i - 2);
    layer.style.setProperty('--dx', `${(i % 2 === 0 ? -1 : 1) * offset * 1.4}px`);
    layer.style.setProperty('--dy', `${-offset * 1.8}px`);
    layer.style.setProperty('--dr', `${(i - 3) * 0.45}deg`);
    layer.style.setProperty('--z', String(i + 1));
    deckWrap.appendChild(layer);
  }

  return deckWrap;
}

function getDailyReadingCardCount(cards = []) {
  if (Array.isArray(cards) && cards.length === 3) return 3;
  return state.spread === 'story' ? 3 : 1;
}

function getDailyReadingCards(cards = []) {
  const count = getDailyReadingCardCount(cards);
  const resolved = Array.isArray(cards) ? cards.filter(Boolean).slice(0, count) : [];
  if (resolved.length === count) return resolved;
  return getDailySpreadCandidates(count);
}

function getDailyCardLabel(dict, index) {
  const base = dict?.card || getDailyEntryStrings(dict).card;
  return `${base} ${index + 1}`;
}

function getDailyCardRotation(index, count) {
  if (count === 1) return 0;
  return [-2.4, 0, 2.4][index] || 0;
}

function waitForDailyMotion(duration) {
  return new Promise((resolve) => window.setTimeout(resolve, duration));
}

function waitForDailyFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function setDailyVisualState(phase) {
  dailyUiState.phase = phase;
  setDailyPhaseAttr(phase);
}

function createDailyCardSummaryPanel(card, heading = '') {
  const panel = document.createElement('div');
  panel.className = 'panel daily-board-panel';

  const h2 = document.createElement('h2');
  h2.textContent = heading
    ? `${heading} · ${getName(card)} — ${getOrientationEnglish(card)}`
    : `${getName(card)} — ${getOrientationEnglish(card)}`;
  h2.style.textAlign = 'center';
  panel.appendChild(h2);

  const archetype = normalizeArchetypeText(getText(card, 'archetype'));
  if (archetype) {
    const p = document.createElement('p');
    p.className = 'keywords';
    p.style.textAlign = 'center';
    p.textContent = archetype;
    panel.appendChild(p);
  }

  const tarotImply = getText(card, 'tarot_imply');
  if (tarotImply) {
    const implyText = document.createElement('p');
    implyText.className = 'keywords';
    implyText.style.textAlign = 'center';
    implyText.style.fontStyle = 'italic';
    implyText.textContent = tarotImply;
    panel.appendChild(implyText);
  }

  return panel;
}

function createDailyDetails(card) {
  const frag = document.createDocumentFragment();
  const hook = getText(card, 'hook') || getText(card, 'action_prompt') || getText(card, 'standalone_present');
  const guidance = buildDailyGuidancePanel(card, hook);
  if (guidance) frag.appendChild(guidance);
  const advice = buildDailyAdvicePanel(card);
  if (advice) frag.appendChild(advice);
  return frag;
}

function createDailyMotionStage(cards, dict) {
  const count = Math.max(1, cards.length || 1);
  const strings = getDailyEntryStrings(dict);

  const stage = document.createElement('section');
  stage.className = 'daily-reading-stage daily-reading-stage--motion';

  const board = document.createElement('div');
  board.className = `daily-motion-board daily-motion-board--${count === 1 ? 'single' : 'triple'}`;

  const layout = document.createElement('div');
  layout.className = `daily-motion-layout daily-motion-layout--${count === 1 ? 'single' : 'triple'}`;
  board.appendChild(layout);

  const slots = cards.map((card, index) => {
    const slot = document.createElement('div');
    slot.className = 'daily-motion-slot';
    slot.setAttribute('aria-hidden', 'true');

    const label = document.createElement('span');
    label.className = 'daily-motion-slot-label';
    label.textContent = count === 1 ? '' : getDailyCardLabel(strings, index);
    slot.appendChild(label);
    layout.appendChild(slot);
    return slot;
  });

  const deck = createDailyDeckElement(strings.deal);
  board.appendChild(deck);

  const cardBackUrl = getCardBackUrl() || getCardBackFallbackUrl();
  const cardsEls = cards.map((card, index) => {
    const cardEl = document.createElement('div');
    cardEl.className = `daily-motion-card daily-motion-card--${count === 1 ? 'single' : 'triple'}`;
    cardEl.dataset.cardId = getCardSelectionId(card);
    cardEl.style.setProperty('--deal-rotation', `${getDailyCardRotation(index, count)}deg`);
    cardEl.style.setProperty('--stack-offset-x', `${(index - Math.floor(count / 2)) * 1.6}px`);
    cardEl.style.setProperty('--stack-offset-y', `${-Math.min(index, 2) * 2}px`);

    const backFace = document.createElement('span');
    backFace.className = 'daily-motion-face daily-motion-face--back';
    const back = Object.assign(document.createElement('img'), {
      className: 'card-back',
      alt: '',
    });
    applyImgFallback(back, cardBackUrl, [getCardBackFallbackUrl()].filter(Boolean));
    backFace.appendChild(back);

    const frontFace = document.createElement('span');
    frontFace.className = 'daily-motion-face daily-motion-face--front';
    const art = buildCardArt(card, count === 1 ? 'hero' : 'thumb');
    art.classList.add('daily-motion-art');
    frontFace.appendChild(art);

    cardEl.appendChild(backFace);
    cardEl.appendChild(frontFace);
    board.appendChild(cardEl);
    return cardEl;
  });

  stage.appendChild(board);
  return { stage, board, layout, slots, deck, cards: cardsEls };
}

function syncDailyStageCards(stageRefs, cards) {
  stageRefs.cards.forEach((cardEl, index) => {
    const nextCard = cards[index];
    if (!nextCard) return;
    cardEl.dataset.cardId = getCardSelectionId(nextCard);
    const frontFace = cardEl.querySelector('.daily-motion-face--front');
    if (!frontFace) return;
    frontFace.textContent = '';
    const art = buildCardArt(nextCard, cards.length === 1 ? 'hero' : 'thumb');
    art.classList.add('daily-motion-art');
    frontFace.appendChild(art);
  });
}

function measureDailyMotionStage(stageRefs) {
  const boardRect = stageRefs.board.getBoundingClientRect();
  const deckRect = stageRefs.deck.getBoundingClientRect();
  const deckCenterX = deckRect.left - boardRect.left + (deckRect.width / 2);
  const deckCenterY = deckRect.top - boardRect.top + (deckRect.height / 2);

  const targets = stageRefs.slots.map((slot) => {
    const slotRect = slot.getBoundingClientRect();
    const width = slotRect.width;
    const height = slotRect.height;
    return {
      width,
      height,
      x: slotRect.left - boardRect.left + (width / 2) - deckCenterX,
      y: slotRect.top - boardRect.top + (height / 2) - deckCenterY,
    };
  });

  stageRefs.cards.forEach((cardEl, index) => {
    const target = targets[index];
    if (!target) return;
    cardEl.style.width = `${target.width}px`;
    cardEl.style.height = `${target.height}px`;
    cardEl.style.left = `${deckCenterX}px`;
    cardEl.style.top = `${deckCenterY}px`;
  });

  return targets;
}

function setDailyCardsToDeck(stageRefs) {
  stageRefs.cards.forEach((cardEl) => {
    cardEl.classList.remove('is-revealed');
    cardEl.classList.remove('is-dealt');
    cardEl.style.setProperty('--deal-x', '0px');
    cardEl.style.setProperty('--deal-y', '0px');
    cardEl.style.setProperty('--deal-scale', '1');
    cardEl.style.setProperty('--deal-rotation-current', '0deg');
  });
}

async function animateDailyGather(stageRefs, targets) {
  if (prefersReducedMotion()) {
    setDailyCardsToDeck(stageRefs);
    return;
  }

  stageRefs.cards.forEach((cardEl, index) => {
    const target = targets[index];
    if (!target) return;
    cardEl.classList.add('is-dealt');
    cardEl.classList.add('is-revealed');
    cardEl.style.transitionDuration = `${DAILY_TIMINGS.gatherMs}ms`;
    cardEl.style.transitionTimingFunction = 'cubic-bezier(0.2, 0.7, 0.22, 1)';
    cardEl.style.setProperty('--deal-x', `${target.x}px`);
    cardEl.style.setProperty('--deal-y', `${target.y}px`);
    cardEl.style.setProperty('--deal-scale', '1');
    cardEl.style.setProperty('--deal-rotation-current', cardEl.style.getPropertyValue('--deal-rotation') || '0deg');
  });

  await waitForDailyFrame();

  stageRefs.cards.forEach((cardEl, index) => {
    cardEl.style.transitionDelay = `${index * 20}ms`;
    cardEl.style.setProperty('--deal-x', '0px');
    cardEl.style.setProperty('--deal-y', '0px');
    cardEl.style.setProperty('--deal-scale', '0.992');
    cardEl.style.setProperty('--deal-rotation-current', '0deg');
  });

  await waitForDailyMotion(DAILY_TIMINGS.gatherMs + Math.max(0, (stageRefs.cards.length - 1) * 20));
  stageRefs.cards.forEach((cardEl) => {
    cardEl.style.transitionDelay = '0ms';
    cardEl.style.transitionTimingFunction = '';
  });
}

async function animateDailyShuffle(stageRefs) {
  if (prefersReducedMotion()) return;
  stageRefs.deck.classList.add('is-shuffling');
  await waitForDailyMotion(DAILY_TIMINGS.shuffleMs);
  stageRefs.deck.classList.remove('is-shuffling');
}

async function animateDailyDeal(stageRefs, targets) {
  setDailyCardsToDeck(stageRefs);
  if (prefersReducedMotion()) {
    stageRefs.cards.forEach((cardEl, index) => {
      const target = targets[index];
      if (!target) return;
      cardEl.classList.add('is-dealt');
      cardEl.style.setProperty('--deal-x', `${target.x}px`);
      cardEl.style.setProperty('--deal-y', `${target.y}px`);
      cardEl.style.setProperty('--deal-scale', '1');
      cardEl.style.setProperty('--deal-rotation-current', cardEl.style.getPropertyValue('--deal-rotation') || '0deg');
    });
    return;
  }

  await waitForDailyFrame();

  stageRefs.cards.forEach((cardEl, index) => {
    const target = targets[index];
    if (!target) return;
    cardEl.classList.add('is-dealt');
    cardEl.style.transitionDelay = `${index * DAILY_TIMINGS.staggerMs}ms`;
    cardEl.style.transitionDuration = `${DAILY_TIMINGS.dealMs}ms`;
    cardEl.style.transitionTimingFunction = 'cubic-bezier(0.22, 0.68, 0.2, 1)';
    cardEl.style.setProperty('--deal-x', `${target.x}px`);
    cardEl.style.setProperty('--deal-y', `${target.y}px`);
    cardEl.style.setProperty('--deal-scale', '1');
    cardEl.style.setProperty('--deal-rotation-current', cardEl.style.getPropertyValue('--deal-rotation') || '0deg');
  });

  await waitForDailyMotion(DAILY_TIMINGS.dealMs + ((stageRefs.cards.length - 1) * DAILY_TIMINGS.staggerMs));
  stageRefs.cards.forEach((cardEl) => {
    cardEl.style.transitionDelay = '0ms';
    cardEl.style.transitionTimingFunction = '';
  });
}

async function animateDailyReveal(stageRefs) {
  if (prefersReducedMotion()) {
    stageRefs.cards.forEach((cardEl) => cardEl.classList.add('is-revealed'));
    return;
  }

  await waitForDailyFrame();
  stageRefs.cards.forEach((cardEl, index) => {
    cardEl.style.transitionDelay = `${index * 30}ms`;
    cardEl.classList.add('is-revealed');
  });
  await waitForDailyMotion(DAILY_TIMINGS.revealMs + ((stageRefs.cards.length - 1) * 30));
  stageRefs.cards.forEach((cardEl) => {
    cardEl.style.transitionDelay = '0ms';
  });
}

function createDailyMultiCardDetails(cards, dict) {
  const wrap = document.createElement('section');
  wrap.className = 'daily-reading-details daily-reading-details--multi';
  cards.forEach((entryCard, index) => {
    wrap.appendChild(createDailyCardSummaryPanel(entryCard, getDailyCardLabel(dict, index)));
  });
  return wrap;
}

function renderDailyDetails(cards, dict, stage) {
  const count = cards.length;
  if (count === 1) {
    stage.appendChild(createDailyCardSummaryPanel(cards[0]));
    const detailsWrap = document.createElement('section');
    detailsWrap.className = 'daily-reading-details';
    detailsWrap.appendChild(createDailyDetails(cards[0]));
    stage.appendChild(detailsWrap);
    return;
  }

  stage.appendChild(createDailyMultiCardDetails(cards, dict));
}

async function startDailyReadingFlow(cards, dict, { gatherCurrent = false } = {}) {
  if (!readingContent) return;

  const runId = dailyUiState.animationRunId + 1;
  dailyUiState.animationRunId = runId;
  dailyUiState.isAnimating = true;
  const currentCards = gatherCurrent && dailyUiState.renderCards.length === cards.length
    ? dailyUiState.renderCards.slice()
    : cards;
  dailyUiState.selectedCardId = getCardSelectionId(cards[0]) || '';
  dailyUiState.lastSignature = cards.map((card) => getCardSelectionId(card)).filter(Boolean).join(',');

  readingContent.innerHTML = '';
  const stageRefs = createDailyMotionStage(currentCards, dict);
  readingContent.appendChild(stageRefs.stage);
  await waitForDailyFrame();

  const targets = measureDailyMotionStage(stageRefs);
  setDailyCardsToDeck(stageRefs);

  if (gatherCurrent) {
    setDailyVisualState(DAILY_VISUAL_STATES.GATHERING);
    await animateDailyGather(stageRefs, targets);
    if (dailyUiState.animationRunId !== runId) return;
    syncDailyStageCards(stageRefs, cards);
    setDailyCardsToDeck(stageRefs);
    await waitForDailyFrame();
  }

  setDailyVisualState(DAILY_VISUAL_STATES.STACKED);
  await animateDailyShuffle(stageRefs);
  if (dailyUiState.animationRunId !== runId) return;

  setDailyVisualState(DAILY_VISUAL_STATES.DEALING);
  await animateDailyDeal(stageRefs, targets);
  if (dailyUiState.animationRunId !== runId) return;

  setDailyVisualState(DAILY_VISUAL_STATES.REVEALED);
  await animateDailyReveal(stageRefs);
  if (dailyUiState.animationRunId !== runId) return;

  stageRefs.deck.remove();

  state.selectedIds = cards.map((entryCard) => getCardSelectionId(entryCard)).filter(Boolean);
  dailyUiState.selectedCardId = state.selectedIds[0] || '';
  dailyUiState.spreadCards = cards.slice();
  dailyUiState.renderCards = cards.slice();
  renderDailyDetails(cards, dict, stageRefs.stage);
  dailyUiState.isAnimating = false;
  configureActionButtons(activeDict);
}

function getFullPositionTranslationKey(position = '') {
  const safe = String(position || '').toLowerCase();
  const map = {
    present: 'positionPresent',
    challenge: 'positionChallenge',
    past: 'positionPast',
    future: 'positionFuture',
    above: 'positionAbove',
    below: 'positionBelow',
    advice: 'positionAdvice',
    external: 'positionExternal',
    hopes: 'positionHopes',
    outcome: 'positionOutcome',
  };
  return map[safe] || 'positionPresent';
}

function getFullPositionLabel(dict, position = '') {
  const translationKey = getFullPositionTranslationKey(position);
  return dict?.[translationKey]
    || (translations[state.currentLang] || translations.en)?.[translationKey]
    || position;
}

function getFullPositionMeta(cards = []) {
  return getFullReadingPositionMeta(cards, { legacyKeys: LEGACY_FULL_POSITION_KEYS });
}

function getFullInterpretationText(card, topicConfig = null) {
  if (!card) return '';
  if (topicConfig?.singleKey) {
    return getText(card, topicConfig.singleKey)
      || getText(card, 'general_meaning')
      || getText(card, 'tarot_imply')
      || getText(card, 'card_desc')
      || '';
  }
  return getText(card, 'general_meaning')
    || getText(card, 'tarot_imply')
    || getText(card, 'card_desc')
    || '';
}

function getFullIntegrationEntries(dict, positions = []) {
  const cards = positions.map(({ card, position }) => ({ ...card, position }));
  const integration = getCelticCrossIntegration(cards, state.currentLang);
  const entries = [
    {
      key: 'action',
      title: dict?.celticCrossNextStep || (state.currentLang === 'th' ? 'ก้าวต่อไปของคุณ' : 'Your next step'),
      ...integration.action,
    },
    {
      key: 'affirmation',
      title: dict?.celticCrossHoldEnergy || (state.currentLang === 'th' ? 'โอบพลังนี้ไว้' : 'Hold this energy'),
      ...integration.affirmation,
    },
    {
      key: 'reflection',
      title: dict?.celticCrossAskYourself || (state.currentLang === 'th' ? 'ลองถามตัวเอง' : 'Ask yourself'),
      ...integration.reflection,
    },
  ];

  return entries.filter((entry) => entry.text);
}

function renderDaily(cards, dict) {
  if (!readingContent) return;
  const resolvedCards = getDailyReadingCards(cards);
  if (!resolvedCards.length) return;

  const signature = resolvedCards.map((entryCard) => getCardSelectionId(entryCard)).filter(Boolean).join(',');
  if (dailyUiState.isAnimating && dailyUiState.lastSignature === signature) return;
  if (dailyUiState.phase === DAILY_VISUAL_STATES.REVEALED && dailyUiState.lastSignature === signature) return;

  startDailyReadingFlow(resolvedCards, dict, { gatherCurrent: false });
}

function renderFull(cards, dict) {
  if (!readingContent || !cards?.length) return;
  readingContent.innerHTML = '';

  const topic = String(state.topic || 'generic').toLowerCase();
  const topicConfig = getTopicConfig().find((item) => item.key === topic);
  const hasTopic = topicConfig && !['generic', 'other'].includes(topic);
  const positions = getFullPositionMeta(cards);
  const isCelticCross = cards.length >= 10;

  const spreadPanel = document.createElement('div');
  spreadPanel.className = 'panel panel--spread panel--celtic-cross';

  const spreadLayout = document.createElement('div');
  spreadLayout.className = 'celtic-cross-layout';

  const centerSlot = document.createElement('div');
  centerSlot.className = 'celtic-slot celtic-slot--center';
  spreadLayout.appendChild(centerSlot);

  const layoutSlotByPosition = {
    present: 'situation',
    challenge: 'challenge',
    above: 'focus',
    past: 'recentpast',
    below: 'past',
    future: 'nearfuture',
    advice: 'power',
    external: 'environment',
    hopes: 'hopes',
    outcome: 'outcome',
  };

  positions.forEach(({ card, position }) => {
    const layoutSlot = layoutSlotByPosition[position] || 'situation';
    const slot = document.createElement('button');
    slot.className = `reading-spread-card celtic-cross-slot celtic-slot celtic-slot--${layoutSlot} card-slot--${position}`;
    slot.type = 'button';
    slot.dataset.position = position;
    slot.dataset.layoutSlot = layoutSlot;
    slot.setAttribute('aria-label', getFullPositionLabel(dict, position));

    slot.appendChild(buildCardArt(card, 'thumb'));

    const caption = document.createElement('div');
    caption.className = 'spread-caption';

    const label = document.createElement('div');
    label.className = 'spread-label';
    label.textContent = getFullPositionLabel(dict, position);
    caption.appendChild(label);

    const orientation = document.createElement('div');
    orientation.className = 'spread-orientation';
    orientation.textContent = getOrientationLabel(toOrientation(card), state.currentLang);
    caption.appendChild(orientation);

    slot.appendChild(caption);
    slot.addEventListener('click', () => openCardSheet(card));

    if (position === 'present' || position === 'challenge') {
      centerSlot.appendChild(slot);
      return;
    }

    spreadLayout.appendChild(slot);
  });
  spreadPanel.appendChild(spreadLayout);
  readingContent.appendChild(spreadPanel);

  const interpretationPanel = document.createElement('div');
  interpretationPanel.className = 'panel full-interpretation-panel';
  const interpretationGrid = document.createElement('div');
  interpretationGrid.className = 'full-summary-grid full-interpretation-grid';

  positions.forEach(({ card, position }) => {
    const box = document.createElement('article');
    box.className = `full-summary-box full-interpretation-box full-interpretation-box--${position}`;
    box.dataset.position = position;

    const tag = document.createElement('p');
    tag.className = 'full-interpretation-tag';
    tag.textContent = getFullPositionLabel(dict, position);
    box.appendChild(tag);

    const heading = document.createElement('h3');
    heading.className = 'full-interpretation-title';
    heading.textContent = getName(card);
    box.appendChild(heading);

    const meta = document.createElement('div');
    meta.className = 'full-summary-meta';

    const nameLine = document.createElement('p');
    nameLine.className = 'full-summary-meta__name';
    nameLine.textContent = getOrientationLabel(toOrientation(card), state.currentLang);
    meta.appendChild(nameLine);

    const archetypeText = normalizeArchetypeText(getText(card, 'archetype'));
    if (archetypeText) {
      const archetypeLine = document.createElement('p');
      archetypeLine.className = 'full-summary-meta__archetype';
      archetypeLine.textContent = archetypeText;
      meta.appendChild(archetypeLine);
    }

    box.appendChild(meta);

    const body = document.createElement('p');
    body.className = 'full-interpretation-body';
    body.textContent = isCelticCross
      ? getCelticCrossInterpretation(card, position, state.currentLang)
      : getFullInterpretationText(card, hasTopic ? topicConfig : null);
    box.appendChild(body);

    if (isCelticCross && position === 'challenge') {
      const adviceText = getCelticCrossSlotText(
        card,
        'challenge_advice',
        state.currentLang,
        getCelticCrossInterpretation(card, 'advice', state.currentLang),
      );
      if (adviceText) {
        const adviceLabel = document.createElement('p');
        adviceLabel.className = 'full-interpretation-tag full-interpretation-tag--advice';
        adviceLabel.textContent = dict?.positionAdvice
          || (translations[state.currentLang] || translations.en)?.positionAdvice
          || (state.currentLang === 'th' ? 'คำแนะนำ' : 'Advice');
        box.appendChild(adviceLabel);

        const adviceBody = document.createElement('p');
        adviceBody.className = 'full-interpretation-body full-interpretation-body--advice';
        adviceBody.textContent = adviceText;
        box.appendChild(adviceBody);
      }
    }

    interpretationGrid.appendChild(box);
  });

  interpretationPanel.appendChild(interpretationGrid);
  readingContent.appendChild(interpretationPanel);

  if (isCelticCross) {
    const integrationEntries = getFullIntegrationEntries(dict, positions);
    if (integrationEntries.length) {
      const integrationPanel = document.createElement('section');
      integrationPanel.className = 'panel full-integration-panel';

      const heading = document.createElement('h3');
      heading.textContent = dict?.guidanceHeading || (state.currentLang === 'th' ? 'คำแนะนำ' : 'Guidance');
      integrationPanel.appendChild(heading);

      const grid = document.createElement('div');
      grid.className = 'full-integration-grid';

      integrationEntries.forEach((entry) => {
        const item = document.createElement('article');
        item.className = 'full-summary-box full-integration-box';

        const title = document.createElement('h4');
        title.textContent = entry.title;
        item.appendChild(title);

        if (entry.source) {
          const source = document.createElement('p');
          source.className = 'full-integration-box__source';
          source.textContent = getName(entry.source);
          item.appendChild(source);
        }

        const copy = document.createElement('p');
        copy.textContent = entry.text;
        item.appendChild(copy);

        grid.appendChild(item);
      });

      integrationPanel.appendChild(grid);
      readingContent.appendChild(integrationPanel);
    }
  }

  const energyPanel = buildEnergyPanel(cards, dict);
  if (energyPanel) {
    energyPanel.classList.add('energy-panel--subtle');
    readingContent.appendChild(energyPanel);
  }
}

function renderQuestion(cards, dict) {
  if (!readingContent || !cards?.length) return;
  readingContent.innerHTML = '';

  const topic = String(state.topic || 'generic').toLowerCase();
  const positions = QUESTION_CARD_POSITIONS;
  const orderedCards = orderQuestionCards(cards).slice(0, 3);

  const topicConfig = getTopicConfig().find((item) => item.key === topic);
  const isGeneric = topic === 'generic' || topic === 'other';

  const spreadPanel = document.createElement('section');
  spreadPanel.className = 'panel panel--spread';

  const spreadGrid = document.createElement('div');
  spreadGrid.className = 'reading-spread-grid';

  orderedCards.forEach((card, idx) => {
    const cardWrap = document.createElement('button');
    cardWrap.className = 'reading-spread-card';
    cardWrap.type = 'button';
    cardWrap.setAttribute('aria-label', `${dict[positions[idx]] || positions[idx]}`);

    cardWrap.appendChild(buildCardArt(card, 'thumb'));

    const caption = document.createElement('div');
    caption.className = 'spread-caption';

    const label = document.createElement('div');
    label.className = 'spread-label';
    label.textContent = dict[positions[idx]] || positions[idx];
    caption.appendChild(label);

    const orientation = document.createElement('div');
    orientation.className = 'spread-orientation';
    orientation.textContent = getOrientationLabel(toOrientation(card), state.currentLang);
    caption.appendChild(orientation);

    cardWrap.appendChild(caption);
    cardWrap.addEventListener('click', () => openCardSheet(card));
    spreadGrid.appendChild(cardWrap);
  });

  spreadPanel.appendChild(spreadGrid);
  readingContent.appendChild(spreadPanel);

  if (topicConfig && !isGeneric) {
    const texts = orderedCards.map((card, idx) => ({
      label: dict[positions[idx]] || positions[idx],
      text: getText(card, topicConfig.spreadKeys[idx]),
    })).filter((item) => item.text);

    const topicPanel = document.createElement('section');
    topicPanel.className = 'panel panel--question-story';
    const section = document.createElement('div');
    section.className = 'deeper-section';

    const h3 = document.createElement('h3');
    h3.textContent = formatReadingTemplate(dict?.questionTopicPanelTitle || '{topic} perspective', {
      topic: getTopicTitle(dict, topicConfig.titleKey),
    });
    section.appendChild(h3);

    texts.forEach((item) => {
      const block = document.createElement('div');
      block.className = 'question-story-item';

      const label = document.createElement('p');
      label.className = 'question-story-item__label';
      label.textContent = item.label;
      block.appendChild(label);

      const body = document.createElement('p');
      body.className = 'question-story-item__body';
      body.textContent = item.text;
      block.appendChild(body);

      section.appendChild(block);
    });

    topicPanel.appendChild(section);
    if (topicPanel) readingContent.appendChild(topicPanel);
  } else {
    const heading = state.currentLang === 'th' ? 'คำแนะนำ' : (dict.guidanceHeading || dict.suggestionTitle || 'Guidance');
    const suggestion = buildSuggestionPanel(cards[1] || cards[0], dict, heading);
    if (suggestion) readingContent.appendChild(suggestion);

    const meta = buildMetaPanel(cards[1] || cards[0]);
    if (meta) readingContent.appendChild(meta);
  }

  const takeawayPanel = buildQuestionTakeawayPanel(orderedCards, dict);
  if (takeawayPanel) readingContent.appendChild(takeawayPanel);

  const energyPanel = buildEnergyPanel(cards, dict);
  if (energyPanel) {
    energyPanel.classList.add('energy-panel--subtle');
    readingContent.appendChild(energyPanel);
  }
}

function renderReading(dict) {
  if (!readingContent) return;

  const cards = state.selectedIds.map((id) => findCard(id)).filter(Boolean);

  if (!cards.length) {
    if (state.mode === 'daily') {
      renderDaily(null, dict);
      return;
    }

    if (state.mode !== 'daily') setDailyPhaseAttr('');
    const message = dict?.missingSelection || 'No cards found. Please draw cards first.';
    readingContent.innerHTML = `<div class="panel"><p class="lede">${message}</p></div>`;
    return;
  }

  if (state.mode === 'daily') {
    renderDaily(cards, dict);
    return;
  }

  setDailyPhaseAttr('');

  if (state.mode === 'question') {
    renderQuestion(cards, dict);
    return;
  }

  renderFull(cards, dict);
}

function base64UrlEncode(input) {
  const encoded = btoa(unescape(encodeURIComponent(input)));
  return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function setShareButtonLoading(isLoading) {
  if (!shareBtn) return;
  const dict = translations[state.currentLang] || translations.en;
  shareBtn.disabled = Boolean(isLoading);
  if (isLoading) {
    shareBtn.dataset.prevLabel = shareBtn.textContent || dict.share || 'Share';
    shareBtn.textContent = state.currentLang === 'th' ? 'กำลังเตรียมภาพ…' : 'Preparing image…';
  } else if (shareBtn.dataset.prevLabel) {
    shareBtn.textContent = shareBtn.dataset.prevLabel;
    delete shareBtn.dataset.prevLabel;
  }
}

function getSharePosterRoot() {
  return document.querySelector(SHARE_POSTER_SELECTOR) || resultsSection;
}

function waitForImagesLoaded(root) {
  if (!root) return Promise.resolve();
  const images = Array.from(root.querySelectorAll('img'));
  return Promise.all(images.map(async (img) => {
    if (!img) return;
    if (img.crossOrigin !== 'anonymous') {
      img.crossOrigin = 'anonymous';
    }

    if (img.complete && img.naturalWidth > 0) {
      if (typeof img.decode === 'function') {
        try {
          await img.decode();
        } catch (_) {
          // ignore decode errors
        }
      }
      return;
    }

    await new Promise((resolve) => {
      const done = () => resolve();
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    });

    if (typeof img.decode === 'function') {
      try {
        await img.decode();
      } catch (_) {
        // ignore decode errors
      }
    }
  }));
}

async function waitForShareReady(timeoutMs = SHARE_READY_TIMEOUT_MS) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const root = getSharePosterRoot();
    const hasHeroImage = Boolean(root?.querySelector('.card-art-img')) || state.mode !== 'daily';
    if (root && dataLoaded && translationsReady && hasRendered && hasHeroImage) {
      if (document.fonts?.ready) await document.fonts.ready;
      await waitForImagesLoaded(root);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return root;
    }
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  throw new Error('Share poster is not ready yet');
}

function buildSharePayload() {
  const dict = translations[state.currentLang] || translations.en;
  const modeTitle =
    state.mode === 'question'
      ? formatReadingTemplate(dict.questionShareTitle || 'Ask a Question · {topic}', { topic: getQuestionTopicLabel(dict) })
      : state.mode === 'full'
        ? dict.overallTitle
        : dict.dailyTitle;
  const modeSubtitle =
    state.mode === 'question'
      ? (dict.questionShareSubtitle || dict.questionSpreadNote)
      : state.mode === 'full'
        ? dict.readingSubtitle
        : (state.spread === 'story' ? dict.spreadStory : dict.spreadQuick);

  const cards = state.selectedIds.map((id) => {
    const card = findCard(id);
    const orientation = toOrientation(id);
    const baseId = getBaseCardId(id, normalizeId) || normalizeId(id);
    const cardIdentity = card || { id: `${baseId}-${orientation}` };
    const { uprightUrl, reversedUrl } = buildCardImageUrls(cardIdentity, orientation);
    const imageByOrientation = orientation === 'reversed'
      ? (reversedUrl || uprightUrl || '')
      : (uprightUrl || reversedUrl || '');
    const summary = card ? getText(card, `${state.topic}_reading_single`) || getText(card, 'general_meaning') : '';
    return {
      id: baseId,
      orientation,
      name: card ? getName(card) : baseId,
      title: card ? getText(card, 'card_title') || getName(card) : baseId,
      keywords: card ? getText(card, 'keywords') : '',
      summary,
      archetype: card ? normalizeArchetypeText(getText(card, 'archetype')) : '',
      image: imageByOrientation,
      image_upright: uprightUrl || '',
      image_reversed: reversedUrl || '',
      resolvedImageUrl: resolvedResultCardSrcByKey.get(getResultCardCacheKey(baseId, orientation)) || '',
    };
  });

  const orderedCards = state.mode === 'question' ? orderQuestionCards(cards) : cards;
  const orderedReadingCards = orderedCards.map((card) => findCard(`${card.id}-${card.orientation}`) || findCard(card.id) || card);
  const primaryCard = cards[0] || null;
  const reading = buildReadingPayload({
    heading: primaryCard?.summary || '',
    subHeading: primaryCard?.title || '',
    archetype: primaryCard?.archetype || '',
    keywords: primaryCard?.keywords || '',
    summary: primaryCard?.summary || '',
    hook: getText(findCard(state.selectedIds[0]), 'hook'),
    action_prompt: getText(findCard(state.selectedIds[0]), 'action_prompt'),
    reading_summary_past: getText(orderedReadingCards[0], 'reading_summary_past'),
    reading_summary_present: getText(orderedReadingCards[1], 'reading_summary_present'),
    reading_summary_future: getText(orderedReadingCards[2], 'reading_summary_future'),
  });

  const poster = buildPosterConfig({
    mode: state.mode,
    orientation: primaryCard?.orientation || 'upright',
    backgroundPath: resolvePosterBackgroundPath({
      payload: { mode: state.mode, cards: orderedCards.map(({ id, orientation, position }) => ({ id, orientation, position })) },
    }),
    assetPack: 'meow-v2',
    backPack: 'meow-v2',
  });
  poster.title = modeTitle;
  poster.subtitle = modeSubtitle;
  poster.footer = 'meowtarot.com';

  const payload = {
    version: 1,
    lang: state.currentLang,
    mode: state.mode,
    spread: state.spread,
    topic: state.topic,
    cards: orderedCards.map((card) => ({ id: card.id, orientation: card.orientation, position: card.position })),
    title: modeTitle,
    subtitle: modeSubtitle,
    headline: dict.yourReading,
    heading: reading.heading,
    reading,
    poster,
    keywords: orderedCards.map((card) => card.name).filter(Boolean).slice(0, 3),
    lucky: {
      colors: normalizeColorArray(findCard(state.selectedIds[0])?.color_palette).slice(0, 6),
      avoidColors: normalizeColorArray(findCard(state.selectedIds[0])?.avoid_color_palette).slice(0, 6),
    },
    canonicalUrl: window.location.href,
  };

  if (state.mode === 'question') {
    payload.llmInput = buildQuestionReadingInputPayload({
      topic: state.topic,
      selectedIds: state.selectedIds,
      cards: meowTarotCards,
    });
  }

  if (state.mode === 'full') {
    payload.energyData = computeFullReadingEnergyData(
      state.selectedIds.map((id) => findCard(id)).filter(Boolean),
    );
  }

  payload.cards = orderedCards.map((card, index) => {
    const withPosterPayload = { ...buildPosterCardPayload(card), id: card.id, orientation: card.orientation };
    if (state.mode === 'question') {
      const position = card.position || QUESTION_CARD_POSITIONS[index] || 'present';
      return { ...withPosterPayload, position };
    }
    if (state.mode === 'full') {
      const position = getFullReadingPositionAt(index, orderedCards.length, { legacyKeys: LEGACY_FULL_POSITION_KEYS });
      return { ...withPosterPayload, position };
    }
    return withPosterPayload;
  });

  shareCiLog('share_payload', {
    mode: payload.mode,
    spread: payload.spread,
    cards: payload.cards.map((card) => card.id),
    hasReading: Boolean(payload.reading?.heading || payload.reading?.subHeading || payload.reading?.archetype || payload.reading?.keywords || payload.reading?.summary),
    hasHeading: Boolean(payload.heading),
    hasPoster: Boolean(payload.poster?.assetPack),
    keywordCount: payload.keywords.length,
  });

  return payload;
}

async function buildSharePageUrl({ action } = {}) {
  const payload = buildSharePayload();
  const hasCards = Array.isArray(payload?.cards) && payload.cards.length > 0;
  if (!hasCards) {
    throw new Error('Share payload missing cards');
  }

  const payloadJson = JSON.stringify(payload);
  sessionStorage.setItem(SHARE_STORAGE_KEY, payloadJson);
  const encoded = base64UrlEncode(payloadJson);
  const url = new URL('/share/index.html', window.location.origin);
  const oversizedHash = encoded.length > SHARE_HASH_MAX_CHARS;
  if (encoded && !oversizedHash) url.hash = `p=${encoded}`;
  if (action) url.searchParams.set('action', action);
  if (isPosterDebugEnabled()) url.searchParams.set('poster_debug', '1');

  if (isPosterDebugEnabled()) {
    console.info('[Share] outgoing_url', url.toString());
    console.info('[Share] payload_bytes', payloadJson.length, 'encoded_head', encoded.slice(0, 60));
  }

  return { url: url.toString(), oversizedHash, encodedLength: encoded.length };
}

function showTemporaryToast(message = '') {
  if (!message || typeof document === 'undefined') return;
  const existing = document.getElementById('readingToast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'readingToast';
  toast.textContent = message;
  Object.assign(toast.style, {
    position: 'fixed',
    left: '50%',
    bottom: '24px',
    transform: 'translateX(-50%)',
    background: 'rgba(7,10,25,0.92)',
    color: '#f8f8ff',
    padding: '10px 14px',
    borderRadius: '10px',
    fontSize: '14px',
    zIndex: '9999',
    boxShadow: '0 6px 16px rgba(0,0,0,0.35)',
  });
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1800);
}

async function copyTextWithFallback(text) {
  if (!text) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_error) {
    // fallback below
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    return Boolean(copied);
  } catch (_error) {
    return false;
  }
}

async function openSharePage({ action } = {}) {
  setShareButtonLoading(true);
  try {
    await waitForShareReady();
  } catch (error) {
    console.error('Share readiness check failed', error);
  } finally {
    setShareButtonLoading(false);
  }

  try {
    const { url: shareUrl, oversizedHash, encodedLength } = await buildSharePageUrl({ action });
    if (oversizedHash) {
      try {
        if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(shareUrl);
      } catch (_) {
        // ignore clipboard errors
      }
      alert(state.currentLang === 'th'
        ? `ข้อมูลแชร์ยาวเกินไป (${encodedLength} ตัวอักษร) ระบบจะใช้ลิงก์สำรองและคัดลอกลิงก์ให้แล้ว`
        : `Share data is too large (${encodedLength} chars). Using fallback link and copying it for you.`);
    }
    window.location.href = shareUrl;
  } catch (error) {
    console.error('Failed to build share URL', error);
    alert(state.currentLang === 'th' ? 'ยังไม่พบผลการเปิดไพ่สำหรับการแชร์' : 'Missing reading data for sharing.');
  }
}

function updateContextCopy(dict = translations[state.currentLang]) {
  if (state.mode === 'question') {
    if (contextCopy) contextCopy.textContent = getQuestionResultKicker(dict);
    if (readingSubcontext) readingSubcontext.textContent = dict?.questionResultContext || '';
    return;
  }

  if (contextCopy) {
    if (isMobile()) contextCopy.textContent = '';
    else contextCopy.textContent = dict.contextDaily;
  }
  if (readingSubcontext) readingSubcontext.textContent = '';
}

function downscaleCanvas(canvas, maxWidth = 1080) {
  if (canvas.width <= maxWidth) return canvas;
  const ratio = maxWidth / canvas.width;
  const c = document.createElement('canvas');
  c.width = maxWidth;
  c.height = Math.round(canvas.height * ratio);
  c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height);
  return c;
}

async function downloadPoster(canvas, fileName = 'meowtarot-daily-reading.png') {
  if (!canvas || typeof canvas.toBlob !== 'function') {
    throw new Error('Poster canvas is unavailable for download');
  }

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error('Failed to create poster blob'));
    }, 'image/png', 0.95);
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function loadHtml2Canvas() {
  if (typeof window === 'undefined') return null;
  if (typeof window.html2canvas === 'function') return window.html2canvas;
  if (html2CanvasPromise) return html2CanvasPromise;

  html2CanvasPromise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = HTML2CANVAS_SRC;
    script.async = true;
    script.onload = () => resolve(window.html2canvas || null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });

  return html2CanvasPromise;
}

async function saveImage() {
  const html2c = await loadHtml2Canvas();
  if (!resultsSection || !html2c) {
    console.error('Save as image unavailable: missing target or html2canvas');
    return;
  }

  try {
    if (document.fonts?.ready) await document.fonts.ready;

    const images = Array.from(resultsSection.querySelectorAll('img'));
    await Promise.all(
      images.map(async (img) => {
        try {
          if (img.decode) {
            await img.decode();
          } else if (!img.complete) {
            await new Promise((resolve, reject) => {
              img.addEventListener('load', resolve, { once: true });
              img.addEventListener('error', reject, { once: true });
            });
          }
        } catch (_) {
          // ignore decode errors
        }
      }),
    );

    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = await html2c(resultsSection, {
      backgroundColor: '#0b1020',
      scale: isIOS ? 1 : dpr,
    });
    const downscaled = downscaleCanvas(canvas);

    if (downscaled.toBlob) {
      await downloadPoster(downscaled, 'meowtarot-daily-reading.png');
      return;
    }

    const fallbackLink = document.createElement('a');
    fallbackLink.href = downscaled.toDataURL('image/png');
    fallbackLink.download = 'meowtarot-daily-reading.png';
    fallbackLink.rel = 'noopener';
    fallbackLink.style.display = 'none';
    document.body.appendChild(fallbackLink);
    fallbackLink.click();
    fallbackLink.remove();
  } catch (error) {
    console.error('Save as image failed', error);
  }
}

async function shareReadingLink() {
  try {
    const { url: shareUrl } = await buildSharePageUrl();
    const copied = await copyTextWithFallback(shareUrl);
    if (copied) {
      showTemporaryToast(state.currentLang === 'th' ? 'คัดลอกลิงก์แล้ว ส่งให้เพื่อนอ่านคำทำนายของคุณ 🔮' : 'Link copied! Send it to a friend to read your tarot reading 🔮');
      return;
    }
  } catch (error) {
    console.error('Copy reading link failed', error);
  }

  showTemporaryToast(state.currentLang === 'th' ? 'คัดลอกลิงก์ไม่สำเร็จ' : 'Unable to copy link');
}

function configureSaveButton(dict = translations[state.currentLang]) {
  if (!saveBtn) return;
  if (saveButtonHandler) {
    saveBtn.removeEventListener('click', saveButtonHandler);
  }

  if (isMobile()) {
    saveBtn.textContent = state.currentLang === 'th' ? 'แชร์' : 'Share';
    saveButtonHandler = () => openSharePage();
  } else {
    saveBtn.textContent = dict.save || saveBtn.textContent;
    saveButtonHandler = saveImage;
  }

  saveBtn.addEventListener('click', saveButtonHandler);
}

function configureActionButtons(dict = translations[state.currentLang]) {
  const mobile = isMobile();

  if (shareBtn && shareButtonHandler) {
    shareBtn.removeEventListener('click', shareButtonHandler);
  }

  if (newReadingBtn && newReadingButtonHandler) {
    newReadingBtn.removeEventListener('click', newReadingButtonHandler);
  }

  if (shareBtn) {
    shareBtn.textContent = mobile
      ? state.currentLang === 'th'
        ? 'คัดลอกลิงก์คำทำนาย'
        : 'Copy reading link'
      : (dict.share || shareBtn.textContent);
    shareBtn.disabled = state.selectedIds.length === 0;
  }

  if (newReadingBtn) {
    newReadingBtn.textContent = mobile
      ? state.currentLang === 'th'
        ? 'เปิดไพ่อีกครั้ง'
        : 'Re-draw'
      : (dict.newReading || newReadingBtn.textContent);
  }

  configureSaveButton(dict);

  shareButtonHandler = () => {
    shareReadingLink();
  };
  shareBtn?.addEventListener('click', shareButtonHandler);

  newReadingButtonHandler = () => {
    if (state.mode === 'daily') {
      const nextCards = getDailyReadingCards([]);
      startDailyReadingFlow(nextCards, activeDict, { gatherCurrent: true });
      return;
    }

    const target =
      state.mode === 'question'
        ? '/question.html'
        : state.mode === 'full'
          ? '/full.html'
          : '/daily.html';

    window.location.href = localizePath(target, state.currentLang);
  };
  newReadingBtn?.addEventListener('click', newReadingButtonHandler);
}

function handleTranslations(dict) {
  activeDict = dict;
  translationsReady = true;
  updateContextCopy(dict);
  configureActionButtons(dict);

  if (readingTitle) {
    if (state.mode === 'question') readingTitle.textContent = dict.questionTitle;
    else if (state.mode === 'full') readingTitle.textContent = dict.overallTitle;
    else readingTitle.textContent = dict.dailyTitle;
    readingTitle.style.textAlign = state.mode === 'daily' ? 'center' : '';
  }

  if (dataLoaded) {
    if (!validateReadingState()) return;
    renderReading(dict);
    hasRendered = true;
  }
}

function maybeRenderReading() {
  if (hasRendered || !dataLoaded || !translationsReady) return;
  if (!validateReadingState()) return;
  renderReading(activeDict);
  hasRendered = true;
}


function switchLanguageInPlace(nextLang) {
  if (!nextLang || nextLang === state.currentLang) return;

  state.currentLang = nextLang;
  hasRendered = false;
  imageSourceCache.clear();
  imagePreloadCache.clear();

  const url = new URL(window.location.href);
  url.searchParams.set('lang', nextLang);
  window.history.replaceState({}, '', url.toString());

  applyTranslations(nextLang, handleTranslations);
  applyLocaleMeta(nextLang);
}

function init() {
  if (DEBUG_CAPTURE_ERRORS) {
    window.onerror = (...args) => console.error('Reading page error', ...args);
    window.onunhandledrejection = (event) => console.error('Reading page unhandled rejection', event?.reason || event);
  }

  initShell(state, handleTranslations, 'reading', {
    onLangToggle: switchLanguageInPlace,
  });

  if (document.body) {
    document.body.setAttribute('data-reading-mode', state.mode || 'daily');
  }

  ensureCardSheet();

  backLink?.addEventListener('click', (event) => {
    if (window.history.length > 1) {
      event.preventDefault();
      window.history.back();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeCardSheet();
  });

  configureActionButtons(translations[state.currentLang] || translations.en);

  window.addEventListener('resize', () => {
    const dict = translations[state.currentLang] || translations.en;
    updateContextCopy(dict);
    configureActionButtons(dict);
  });

  loadTarotData()
    .then(() => {
      dataLoaded = true;
      maybeRenderReading();
    })
    .catch(() => {
      dataLoaded = true;
      maybeRenderReading();
    });
}

document.addEventListener('DOMContentLoaded', init);
