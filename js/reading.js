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
import { findCardById, getBaseCardId, toOrientation } from './reading-helpers.js';
import { buildPosterConfig, buildPosterCardPayload, buildReadingPayload } from './share-payload.js';
import { buildCardImageUrls, resolveCardImageUrl, resolvePosterBackgroundPath, exists } from './asset-resolver.js';
import { getLocalizedField, getOrientationLabel } from './tarot-format.js';

const params = new URLSearchParams(window.location.search);
const hasUrlSelection = ['cards', 'card', 'id', 'mode', 'topic', 'spread'].some((key) => params.has(key));
const storageSelection = hasUrlSelection
  ? null
  : JSON.parse(sessionStorage.getItem('meowtarot_selection') || 'null');
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
let translationsReady = false;
let hasRendered = false;
let activeDict = translations[state.currentLang] || translations.en;
const imageSourceCache = new Map();
const imagePreloadCache = new Map();
const imageLoadedCache = new Set();
const resolvedResultCardSrcByKey = new Map();

const readingContent = document.getElementById('reading-content');
const contextCopy = document.getElementById('reading-context');
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
let energyChart = null;
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
        swatch.style.width = '22px';
        swatch.style.height = '22px';
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
  if (!isMobile()) return ALL_TOPICS;
  return ALL_TOPICS.filter((topic) => !['family', 'travel', 'self'].includes(topic.key));
}

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

    luckyPalette.forEach((c) => {
      const swatch = document.createElement('span');
      swatch.className = 'swatch';
      const cssColor = resolveCssColor(c);
      if (cssColor) swatch.style.background = cssColor;
      swatch.style.width = '22px';
      swatch.style.height = '22px';
      swatch.style.borderRadius = '999px';
      circles.appendChild(swatch);
    });

    panel.appendChild(circles);
  }

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
  h2.style.textAlign = 'center';
  panel.appendChild(h2);

  const archetype = getText(card, 'archetype');
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

  const hook = getText(card, 'hook') || getText(card, 'action_prompt') || getText(card, 'standalone_present');

  readingContent.appendChild(panel);

  const guidance = buildDailyGuidancePanel(card, hook);
  if (guidance) readingContent.appendChild(guidance);

  const advice = buildDailyAdvicePanel(card);
  if (advice) readingContent.appendChild(advice);
}

function renderFull(cards, dict) {
  if (!readingContent || !cards?.length) return;
  readingContent.innerHTML = '';

  const positions = ['past', 'present', 'future'];

  const spreadPanel = document.createElement('div');
  spreadPanel.className = 'panel panel--spread';

  const spreadGrid = document.createElement('div');
  spreadGrid.className = 'reading-spread-grid';

  cards.slice(0, 3).forEach((card, idx) => {
    const cardWrap = document.createElement('button');
    cardWrap.className = 'reading-spread-card';
    cardWrap.type = 'button';
    cardWrap.setAttribute('aria-label', `${dict[positions[idx]] || positions[idx]}`);

    cardWrap.appendChild(buildCardArt(card, 'thumb'));

    const caption = document.createElement('div');
    caption.className = 'spread-caption';

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

  const payloadReading = buildSharePayload()?.reading || {};

  const summaries = [
    getText(cards[0], 'reading_summary_past') || payloadReading.reading_summary_past || '',
    getText(cards[1], 'reading_summary_present') || payloadReading.reading_summary_present || '',
    getText(cards[2], 'reading_summary_future') || payloadReading.reading_summary_future || '',
  ];

  if (summaries.some((item) => !item)) {
    console.warn('[Full] missing reading_summary fields');
  }

  const summaryPanel = document.createElement('div');
  summaryPanel.className = 'panel full-summary-panel';
  const summaryGrid = document.createElement('div');
  summaryGrid.className = 'full-summary-grid';

  summaries.forEach((summary, idx) => {
    const card = cards[idx];
    const fallbackName = state.currentLang === 'th'
      ? (card?.alias_th || card?.name_th || card?.id || '')
      : (payloadReading[`card_name_${positions[idx]}`] || payloadReading.subHeading || '');
    const cardName = state.currentLang === 'th'
      ? (card?.alias_th || card?.name_th || fallbackName || '')
      : (card?.card_name_en || card?.name_en || card?.name || fallbackName || card?.id || '');
    const orientationLabel = getOrientationLabel(toOrientation(card), state.currentLang);
    const fallbackArchetype = payloadReading[`archetype_${positions[idx]}`] || payloadReading.archetype || '';
    const archetypeText = getText(card, 'archetype') || fallbackArchetype;
    const fallbackImply = payloadReading[`tarot_imply_${positions[idx]}`] || payloadReading.summary || '';
    const implyText = getText(card, 'tarot_imply') || fallbackImply;

    const box = document.createElement('article');
    box.className = 'full-summary-box';

    const h3 = document.createElement('h3');
    h3.textContent = dict[positions[idx]] || positions[idx];
    box.appendChild(h3);

    const meta = document.createElement('div');
    meta.className = 'full-summary-meta';

    const nameLine = document.createElement('p');
    nameLine.className = 'full-summary-meta__name';
    nameLine.textContent = cardName ? `${cardName} (${orientationLabel})` : orientationLabel;
    meta.appendChild(nameLine);

    if (archetypeText) {
      const archetypeLine = document.createElement('p');
      archetypeLine.className = 'full-summary-meta__archetype';
      archetypeLine.textContent = archetypeText;
      meta.appendChild(archetypeLine);
    }

    if (implyText) {
      const implyLine = document.createElement('p');
      implyLine.className = 'full-summary-meta__imply';
      implyLine.textContent = implyText;
      meta.appendChild(implyLine);
    }

    box.appendChild(meta);

    const body = document.createElement('p');
    body.textContent = summary || '';
    box.appendChild(body);

    summaryGrid.appendChild(box);
  });

  summaryPanel.appendChild(summaryGrid);
  readingContent.appendChild(summaryPanel);

  const deeperPanel = document.createElement('div');
  deeperPanel.className = 'panel';
  let deeperHasContent = false;

  getTopicConfig().forEach((topic) => {
    const texts = cards.slice(0, 3).map((card, idx) => ({
      label: dict[positions[idx]] || positions[idx],
      text: getText(card, topic.spreadKeys[idx]),
    })).filter((item) => item.text);

    if (!texts.length) return;

    const section = document.createElement('div');
    section.className = 'deeper-section';

    const h3 = document.createElement('h3');
    h3.textContent = getTopicTitle(dict, topic.titleKey);
    section.appendChild(h3);

    texts.forEach((item) => {
      const p = document.createElement('p');
      p.innerHTML = `<strong>${item.label}:</strong> ${item.text}`;
      section.appendChild(p);
    });

    deeperPanel.appendChild(section);
    deeperHasContent = true;
  });

  if (deeperHasContent) {
    readingContent.appendChild(deeperPanel);
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

  const topicConfig = getTopicConfig().find((item) => item.key === topic);
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
    const summary = card ? getText(card, `${state.topic}_reading_single`) || getText(card, 'general_meaning') : '';
    return {
      id: baseId,
      orientation,
      name: card ? getName(card) : baseId,
      title: card ? getText(card, 'card_title') || getName(card) : baseId,
      keywords: card ? getText(card, 'keywords') : '',
      summary,
      archetype: card ? getText(card, 'affirmation') : '',
      resolvedImageUrl: resolvedResultCardSrcByKey.get(getResultCardCacheKey(baseId, orientation)) || '',
    };
  });

  const primaryCard = cards[0] || null;
  const reading = buildReadingPayload({
    heading: primaryCard?.summary || '',
    subHeading: primaryCard?.title || '',
    archetype: primaryCard?.archetype || '',
    keywords: primaryCard?.keywords || '',
    summary: primaryCard?.summary || '',
    reading_summary_past: getText(findCard(state.selectedIds[0]), 'reading_summary_past'),
    reading_summary_present: getText(findCard(state.selectedIds[1]), 'reading_summary_present'),
    reading_summary_future: getText(findCard(state.selectedIds[2]), 'reading_summary_future'),
  });

  const poster = buildPosterConfig({
    mode: state.mode,
    orientation: primaryCard?.orientation || 'upright',
    backgroundPath: resolvePosterBackgroundPath({
      payload: { mode: state.mode, cards: cards.map(({ id, orientation }) => ({ id, orientation })) },
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
    spread: state.mode === 'daily' ? 'quick' : state.spread,
    topic: state.topic,
    cards: cards.map((card) => ({ id: card.id, orientation: card.orientation })),
    title: modeTitle,
    subtitle: modeSubtitle,
    headline: dict.yourReading,
    heading: reading.heading,
    reading,
    poster,
    keywords: cards.map((card) => card.name).filter(Boolean).slice(0, 3),
    lucky: {
      colors: normalizeColorArray(findCard(state.selectedIds[0])?.color_palette).slice(0, 6),
      avoidColors: normalizeColorArray(findCard(state.selectedIds[0])?.avoid_color_palette).slice(0, 6),
    },
    canonicalUrl: window.location.href,
  };

  payload.cards = cards.map((card) => ({ ...buildPosterCardPayload(card), id: card.id, orientation: card.orientation }));

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
  const url = new URL('/share/', window.location.origin);
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
  if (!contextCopy) return;

  if (isMobile()) {
    contextCopy.textContent = '';
    return;
  }

  contextCopy.textContent = state.mode === 'question' ? dict.contextQuestion : dict.contextDaily;
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

    const openImage = (href) => {
      const opened = window.open(href, '_blank', 'noopener');
      if (!opened) {
        window.location.href = href;
      }
    };

    if (downscaled.toBlob) {
      downscaled.toBlob((blob) => {
        if (blob) {
          openImage(URL.createObjectURL(blob));
        } else {
          openImage(downscaled.toDataURL('image/png'));
        }
      }, 'image/png');
    } else {
      openImage(downscaled.toDataURL('image/png'));
    }
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
        ? 'แชร์คำทำนายอย่างละเอียด'
        : 'Share detailed result'
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
    renderReading(dict);
    hasRendered = true;
  }
}

function maybeRenderReading() {
  if (hasRendered || !dataLoaded || !translationsReady) return;
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
