import {
  loadTarotData,
  meowTarotCards,
  normalizeId,
  getCardBackFallbackUrl,
  getCardBackUrl,
  getCardImageFallbackUrl,
  getActiveDeckId,
  DEFAULT_DECK_ID,
  getReversedMode,
} from '../js/data.js';
import { imageManager } from '../js/image-manager.js';
import { normalizePayload } from './normalize-payload.js';
import { findCardById, getCelticCrossInterpretation, toOrientation } from '../js/reading-helpers.js';
import { getLocalizedField, getOrientationLabel } from '../js/tarot-format.js';
import {
  buildCardImageUrls,
  resolveCardBackFallbackPath,
  resolveCardImageUrl,
  resolvePosterBackgroundPath,
  toAssetUrl,
} from '../js/asset-resolver.js';
import { translations } from '../js/common.js';
import { orderQuestionCards } from '../js/question-card-order.js';


// Reversed-card render mode (hidden Profile toggle, founder 2026-06-20). 'flip'
// (DEFAULT) sources the upright art and rotates 180° on the canvas; 'art' sources
// the dedicated *-reversed.webp and does NOT rotate. These helpers keep the default
// path byte-identical to before (flip → upright + rotate).
const isPosterArtMode = () => getReversedMode() === 'art';
const posterImageOrientation = (realOrientation) =>
  (isPosterArtMode() && toOrientation(realOrientation) === 'reversed') ? 'reversed' : 'upright';
const posterShouldRotateReversed = (realOrientation) =>
  toOrientation(realOrientation) === 'reversed' && !isPosterArtMode();

// Prefer the 200px thumbnail for SMALL multi-card posters (Celtic Cross + the
// 3-card Question spread). Returns the -200 variant URL, or null when the URL
// isn't a face asset. The full-res URL is kept as the first fallback, so a missing
// thumbnail (or a reversed -200 in art mode) degrades gracefully.
const POSTER_FACE_200_RE = /-(upright|reversed)\.webp/;
const toPosterThumb200 = (url) =>
  (typeof url === 'string' && POSTER_FACE_200_RE.test(url))
    ? url.replace(POSTER_FACE_200_RE, '-$1-200.webp')
    : null;

const PRESETS = {
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1350 },
};

const FULL_POSITION_LABELS = {
  en: { present: 'The Present', challenge: 'The Obstacle', past: 'The Past', future: 'The Future', above: 'Above', below: 'Below', advice: 'Advice', external: 'External Influences', hopes: 'Hopes & Fears', outcome: 'Outcome' },
  th: { present: 'สถานการณ์ปัจจุบัน', challenge: 'อุปสรรค', past: 'อดีต', future: 'อนาคต', above: 'เป้าหมาย', below: 'รากฐาน', advice: 'คำแนะนำ', external: 'อิทธิพลภายนอก', hopes: 'ความหวังและความกลัว', outcome: 'ผลลัพธ์' },
};

const CELTIC_CROSS_POSITIONS = ['present', 'challenge', 'above', 'past', 'below', 'future', 'advice', 'external', 'hopes', 'outcome'];
const CELTIC_CROSS_POSTER_STRINGS = {
  en: {
    eyebrow: 'Celtic Cross Reading',
    subtitle: 'A 10-card spread showing the energies around your situation.',
    heroFallback: 'Your path is becoming clearer.',
    insightTitles: {
      present: 'What this is about',
      advice: 'Your next step',
      outcome: 'Where this may lead',
    },
  },
  th: {
    eyebrow: 'เซลติกครอส',
    subtitle: 'การเปิดไพ่ 10 ใบเพื่อมองพลังงานรอบสถานการณ์ของคุณ',
    heroFallback: 'เส้นทางของคุณกำลังชัดเจนขึ้น',
    insightTitles: {
      present: 'เรื่องนี้กำลังพาไปทางไหน',
      advice: 'ก้าวต่อไปของคุณ',
      outcome: 'ผลลัพธ์ที่อาจเกิดขึ้น',
    },
  },
};

function isPosterCiDebugEnabled() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.DEBUG_POSTER_CI);
}

function isPosterDebugEnabled() {
  if (typeof window !== 'undefined') {
    const search = new URLSearchParams(window.location.search || '');
    if (search.get('poster_debug') === '1') return true;
    try {
      if (String(window.localStorage?.getItem('POSTER_DEBUG') || '').trim() === '1') return true;
    } catch (_) {
      // ignore storage errors
    }
    if (String(window.POSTER_DEBUG || '').trim() === '1') return true;
  }
  const runtimeEnv = (typeof globalThis !== 'undefined' && globalThis.process?.env) ? globalThis.process.env : null;
  const envFlag = runtimeEnv?.POSTER_DEBUG;
  return String(envFlag || '').trim() === '1';
}


function posterDebugLog(method = 'info', ...args) {
  if (!isPosterDebugEnabled()) return;
  (console[method] || console.info).call(console, ...args);
}

function emitPosterDebug(step, payload = {}) {
  if (!isPosterDebugEnabled()) return;
  const event = {
    ts: Date.now(),
    step,
    stage: step,
    ...payload,
  };
  console.info('[Poster]', event);
  if (typeof window !== 'undefined') {
    window.__MEOW_POSTER_DEBUG = Array.isArray(window.__MEOW_POSTER_DEBUG) ? window.__MEOW_POSTER_DEBUG : [];
    window.__MEOW_POSTER_DEBUG.push(event);
    if (window.__MEOW_POSTER_DEBUG.length > 120) {
      window.__MEOW_POSTER_DEBUG = window.__MEOW_POSTER_DEBUG.slice(-120);
    }
  }
}

function withTimeout(promise, timeoutMs, label = 'timeout') {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} after ${timeoutMs}ms`)), timeoutMs)),
  ]);
}

const IMAGE_LOAD_TIMEOUT_MS = 5000;

function buildPosterCardVariantCandidates(url) {
  if (!url || !/\.(webp|jpg|jpeg|png)(\?|$)/i.test(url)) return [url].filter(Boolean);
  const variants = [
    url.replace(/\.(webp|jpg|jpeg|png)(\?|$)/i, '.h1080.$1$2'),
    url.replace(/\.(webp|jpg|jpeg|png)(\?|$)/i, '.h900.$1$2'),
    url,
  ];
  return [...new Set(variants.filter(Boolean))];
}

async function loadPosterCardImageWithTimeout(primary, fallbacks = []) {
  const expandedPrimary = buildPosterCardVariantCandidates(primary);
  const expandedFallbacks = fallbacks.flatMap((item) => buildPosterCardVariantCandidates(item));
  return withTimeout(
    imageManager.loadImageWithFallback(expandedPrimary[0], [...expandedPrimary.slice(1), ...expandedFallbacks].filter(Boolean)),
    IMAGE_LOAD_TIMEOUT_MS,
    'image_load_timeout',
  );
}

function setPosterRuntimeFlag(key, value) {
  if (typeof window === 'undefined') return;
  window[key] = value;
}

function posterCiLog(step, payload = {}) {
  if (!isPosterCiDebugEnabled()) return;
  console.log(JSON.stringify({ step, ...payload }));
}

function emitLegacyCardProbe({ ok, url = null, w = 0, h = 0, error = null } = {}) {
  if (!isPosterCiDebugEnabled()) return;
  const payload = {
    ok: Boolean(ok),
    url,
  };
  if (ok) {
    payload.w = Math.round(w || 0);
    payload.h = Math.round(h || 0);
  } else if (error) {
    payload.error = error;
  }
  posterCiLog('img_probe', { kind: 'card', ...payload });
  posterCiLog('card_img_probe', payload);
}

async function probeImageLoad(url, kind) {
  if (!isPosterDebugEnabled() || !url || typeof fetch !== 'function') return;
  let status = null;
  let ok = false;
  let method = 'HEAD';
  let errorMessage = null;
  let responseMeta = null;

  const pickProbeHeaders = (res) => {
    const keys = [
      'content-type',
      'content-length',
      'cache-control',
      'access-control-allow-origin',
      'cross-origin-resource-policy',
      'cross-origin-opener-policy',
      'cross-origin-embedder-policy',
      'timing-allow-origin',
      'cf-ray',
      'server',
    ];
    return keys.reduce((acc, key) => {
      const value = res.headers.get(key);
      if (value != null) acc[key] = value;
      return acc;
    }, {});
  };

  const attachMeta = (res) => {
    responseMeta = {
      statusText: res.statusText,
      redirected: res.redirected,
      type: res.type,
      finalUrl: res.url,
      headers: pickProbeHeaders(res),
    };
  };

  try {
    const headAbort = new AbortController();
    const headTimer = setTimeout(() => headAbort.abort('head-timeout'), 5000);
    const res = await fetch(url, { method: 'HEAD', mode: 'cors', signal: headAbort.signal });
    clearTimeout(headTimer);
    status = res.status;
    ok = res.ok;
    attachMeta(res);
  } catch (error) {
    method = 'GET';
    try {
      const getAbort = new AbortController();
      const getTimer = setTimeout(() => getAbort.abort('get-timeout'), 5000);
      const res = await fetch(url, { method: 'GET', mode: 'cors', signal: getAbort.signal });
      clearTimeout(getTimer);
      status = res.status;
      ok = res.ok;
      attachMeta(res);
    } catch (fallbackError) {
      errorMessage = fallbackError?.message || String(fallbackError);
    }
  }

  const acao = responseMeta?.headers?.['access-control-allow-origin'] || null;
  const acaoOk = !acao || acao === '*' || (typeof window !== 'undefined' && acao === window.location.origin);
  const probePayload = {
    kind,
    url,
    ok,
    status,
    method,
    error: errorMessage,
    acao,
    acaoOk,
    response: responseMeta,
  };
  posterCiLog('img_probe', probePayload);
  emitPosterDebug('img_probe', probePayload);
}

async function preloadImages(items = []) {
  const unique = [];
  const seen = new Set();
  items.forEach((item) => {
    const url = item?.url;
    if (!url || seen.has(url)) return;
    seen.add(url);
    unique.push({ kind: item?.kind || 'image', url });
  });

  const results = await Promise.all(unique.map(async ({ kind, url }) => {
    const startedAt = performance.now();
    try {
      await withTimeout(probeImageLoad(url, kind), 6000, 'img_probe_timeout');
      const img = await withTimeout(imageManager.loadImage(url, { crossOrigin: 'anonymous' }), 6000, 'img_load_timeout');
      const result = {
        kind,
        url,
        status: 'loaded',
        naturalWidth: img?.naturalWidth || 0,
        naturalHeight: img?.naturalHeight || 0,
        ms: Number((performance.now() - startedAt).toFixed(1)),
      };
      emitPosterDebug('preload', result);
      return { ...result, img };
    } catch (error) {
      const result = {
        kind,
        url,
        status: 'error',
        err: error?.message || String(error),
        ms: Number((performance.now() - startedAt).toFixed(1)),
      };
      setPosterRuntimeFlag('__MEOW_POSTER_LAST_FAILED_ASSET_URL', url);
      emitPosterDebug('preload', result);
      return result;
    }
  }));

  return results;
}


function isLocalPosterAssetsEnabled() {
  if (typeof window === 'undefined') return false;
  return window.MEOWTAROT_LOCAL_POSTER_ASSETS === true;
}

function resolveLocalPosterFixtureUrl(kind, orientation = 'upright') {
  if (!isLocalPosterAssetsEnabled()) return null;
  const base = String(window.MEOWTAROT_LOCAL_POSTER_ASSET_BASE || '').replace(/\/+$/g, '');
  const root = `${base}/tests/fixtures`;
  if (kind === 'background') return `${root}/bg-000.png`;
  if (kind === 'card') return `${root}/${orientation === 'reversed' ? '01-the-fool-reversed.png' : '01-the-fool-upright.png'}`;
  if (kind === 'back') return `${root}/00-back.png`;
  return null;
}


function resolveEmergencyPosterFixtureUrl(kind, orientation = 'upright') {
  if (typeof window === 'undefined') return null;
  const root = `${window.location.origin}/tests/fixtures`;
  if (kind === 'card') return `${root}/${orientation === 'reversed' ? '01-the-fool-reversed.png' : '01-the-fool-upright.png'}`;
  if (kind === 'back') return `${root}/00-back.png`;
  return null;
}

function createCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function isEmbeddedWebViewForExport() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/HeadlessChrome/i.test(ua)) return false;
  return /(FBAN|FBAV|Instagram|Line|Twitter|TikTok|Snapchat)/i.test(ua);
}

function probeCanvasTaint(canvas) {
  try {
    const ctx = canvas?.getContext('2d');
    if (!ctx) return { taintedCanvas: false, errName: null, errMsg: null };
    ctx.getImageData(0, 0, 1, 1);
    emitPosterDebug('canvas_probe', { taintedCanvas: false, errName: null, errMsg: null });
    setPosterRuntimeFlag('__MEOW_POSTER_TAINTED', false);
    return { taintedCanvas: false, errName: null, errMsg: null };
  } catch (error) {
    const payload = {
      taintedCanvas: true,
      errName: error?.name || 'Error',
      errMsg: error?.message || String(error),
    };
    emitPosterDebug('canvas_probe', payload);
    setPosterRuntimeFlag('__MEOW_POSTER_TAINTED', true);
    return payload;
  }
}

function blobFromDataUrl(dataUrl, fallbackMime = 'image/jpeg') {
  const [meta, body = ''] = String(dataUrl || '').split(',');
  const mimeMatch = /data:([^;]+)/.exec(meta || '');
  const mime = mimeMatch?.[1] || fallbackMime;
  const bytes = atob(body);
  const buffer = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) buffer[i] = bytes.charCodeAt(i);
  return new Blob([buffer], { type: mime });
}

async function toBlobWithTimeout(targetCanvas, mime, quality, timeoutMs = 4500) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`toBlob timeout (${mime})`));
    }, timeoutMs);

    try {
      targetCanvas.toBlob((blob) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (!blob) {
          reject(new Error(`toBlob returned null (${mime})`));
          return;
        }
        resolve(blob);
      }, mime, quality);
    } catch (error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    }
  });
}

function maybeScaleCanvasForExport(canvas, targetWidth = 1080) {
  if (!canvas?.width || !canvas?.height) return canvas;
  if (canvas.width <= targetWidth) return canvas;
  const ratio = targetWidth / canvas.width;
  const w = targetWidth;
  const h = Math.max(1, Math.round(canvas.height * ratio));
  const scaled = createCanvas(w, h);
  const scaledCtx = scaled.getContext('2d');
  scaledCtx.drawImage(canvas, 0, 0, w, h);
  emitPosterDebug('export_scaled', { from: { w: canvas.width, h: canvas.height }, to: { w, h } });
  return scaled;
}

function buildExportTargets(canvas) {
  const targets = [];
  const pushTarget = (label, targetCanvas) => {
    if (!targetCanvas) return;
    const exists = targets.some((entry) => entry.canvas?.width === targetCanvas.width && entry.canvas?.height === targetCanvas.height);
    if (exists) return;
    targets.push({ label, canvas: targetCanvas });
  };

  pushTarget('original', canvas);

  const embedded = isEmbeddedWebViewForExport();
  if (!embedded) return targets;

  // Clamp for embedded webviews; keep 1080 for quality, then 900 as memory fallback.
  const clamp1080 = maybeScaleCanvasForExport(canvas, 1080);
  pushTarget('clamp_1080', clamp1080);
  const clamp900 = maybeScaleCanvasForExport(canvas, 900);
  pushTarget('clamp_900', clamp900);
  return targets;
}

async function exportPoster(canvas) {
  setPosterRuntimeFlag('__MEOW_POSTER_STAGE', 'exporting');
  const { taintedCanvas, errName, errMsg } = probeCanvasTaint(canvas);
  const canvasSize = { w: canvas?.width || 0, h: canvas?.height || 0 };
  setPosterRuntimeFlag('__MEOW_POSTER_CANVAS_SIZE', canvasSize);
  setPosterRuntimeFlag('__MEOW_POSTER_EXPORT_ATTEMPTS', []);

  if (taintedCanvas) {
    const err = new Error(`CORS/tainted canvas: ${errName || 'SecurityError'} ${errMsg || ''}`.trim());
    setPosterRuntimeFlag('__MEOW_POSTER_FAILURE_REASON', 'CORS/tainted canvas');
    setPosterRuntimeFlag('__MEOW_POSTER_EXPORT_ATTEMPTS', []);
    throw err;
  }

  const targets = buildExportTargets(canvas);
  const scaledTarget = targets.find((entry) => entry.label !== 'original');
  setPosterRuntimeFlag('__MEOW_POSTER_SCALED_CANVAS_SIZE', scaledTarget ? { w: scaledTarget.canvas.width, h: scaledTarget.canvas.height } : null);

  const attempts = [
    { method: 'toBlob', mime: 'image/png', quality: 0.92 },
    { method: 'toBlob', mime: 'image/jpeg', quality: 0.92 },
    { method: 'toDataURL', mime: 'image/jpeg', quality: 0.92 },
  ];

  const exportAttempts = [];
  let lastError = null;
  for (const target of targets) {
    const targetCanvas = target.canvas;
    for (const attempt of attempts) {
      const startedAt = performance.now();
      try {
        let blob = null;
        if (attempt.method === 'toBlob') {
          setPosterRuntimeFlag('__MEOW_POSTER_EXPORT_METHOD', `toBlob:${attempt.mime}`);
          blob = await toBlobWithTimeout(targetCanvas, attempt.mime, attempt.quality, 4500);
        } else {
          setPosterRuntimeFlag('__MEOW_POSTER_EXPORT_METHOD', `toDataURL:${attempt.mime}`);
          const dataUrl = targetCanvas.toDataURL(attempt.mime, attempt.quality);
          blob = blobFromDataUrl(dataUrl, attempt.mime);
        }

        const row = {
          method: attempt.method,
          mime: attempt.mime,
          ok: Boolean(blob),
          bytes: blob?.size || 0,
          ms: Number((performance.now() - startedAt).toFixed(1)),
          canvas: { w: targetCanvas.width, h: targetCanvas.height },
          target: target.label,
          err: null,
        };
        exportAttempts.push(row);
        setPosterRuntimeFlag('__MEOW_POSTER_EXPORT_ATTEMPTS', exportAttempts);
        emitPosterDebug('export_attempt', row);
        if (blob) {
          setPosterRuntimeFlag('__MEOW_POSTER_STAGE', 'done');
          setPosterRuntimeFlag('__MEOW_POSTER_EXPORT_BYTES', blob.size || 0);
          setPosterRuntimeFlag('__MEOW_POSTER_EXPORT_BLOB_TYPE', blob.type || attempt.mime);
          return blob;
        }
      } catch (error) {
        lastError = error;
        const message = error?.message || String(error);
        const tainted = /tainted canvas|securityerror/i.test(message);
        if (tainted) setPosterRuntimeFlag('__MEOW_POSTER_TAINTED', true);
        const row = {
          method: attempt.method,
          mime: attempt.mime,
          ok: false,
          bytes: 0,
          ms: Number((performance.now() - startedAt).toFixed(1)),
          canvas: { w: targetCanvas.width, h: targetCanvas.height },
          target: target.label,
          err: message,
        };
        exportAttempts.push(row);
        setPosterRuntimeFlag('__MEOW_POSTER_EXPORT_ATTEMPTS', exportAttempts);
        emitPosterDebug('export_attempt', row);
      }
    }
  }

  setPosterRuntimeFlag('__MEOW_POSTER_FAILURE_REASON', 'memory/export failure');
  setPosterRuntimeFlag('__MEOW_POSTER_STAGE', 'fail');
  throw lastError || new Error('Export failed across all methods');
}

function baseCardId(id = '') {
  return normalizeId(String(id).replace(/-(upright|reversed)$/i, '')) || normalizeId(id);
}

export function resolvePosterCardImageSources(cardEntry, { resolvedPrimary, uprightUrl, reversedUrl, backUrl, lang } = {}) {
  const card = cardEntry?.card || {};
  const orientation = toOrientation(cardEntry?.orientation || card?.orientation || 'upright');
  const cardSlug = normalizeId(card?.slug || card?.name_en || card?.card_name_en || card?.id || card?.card_id || card?.image_id || 'unknown-card');
  const fromEntry = {
    default: cardEntry?.preferredImageUrl || cardEntry?.image || cardEntry?.imageUrl || cardEntry?.resolvedImageUrl || '',
    upright: cardEntry?.image_upright || cardEntry?.imageUpright || '',
    reversed: cardEntry?.image_reversed || cardEntry?.imageReversed || '',
  };
  const fromCard = {
    default: card?.image || card?.image_url || '',
    upright: card?.image_upright || card?.imageUpright || '',
    reversed: card?.image_reversed || card?.imageReversed || '',
  };

  const globalSiteFallback = getCardImageFallbackUrl() || getCardBackFallbackUrl() || getCardBackUrl();

  const primary = orientation === 'reversed'
    ? (
      fromEntry.reversed
      || fromCard.reversed
      || reversedUrl
      || fromEntry.upright
      || fromCard.upright
      || uprightUrl
      || fromEntry.default
      || fromCard.default
      || resolvedPrimary
      || backUrl
      || globalSiteFallback
    )
    : (
      fromEntry.upright
      || fromCard.upright
      || uprightUrl
      || fromEntry.default
      || fromCard.default
      || resolvedPrimary
      || backUrl
      || globalSiteFallback
    );

  // BUG-020: before falling back to a card BACK, try the default deck's face of
  // the SAME card (identical nn-slug-orientation.webp filename), so a deck that is
  // missing/blocked for a given card still shares real card art — the visual proof
  // a share needs (hard rule #8). No-op when already on the default deck (returns
  // null). This previously existed only on the daily poster; routing it through the
  // shared resolver extends it to the question / full / celtic posters too.
  const defaultUprightFace = toDefaultDeckFaceUrl(uprightUrl);
  const defaultReversedFace = toDefaultDeckFaceUrl(reversedUrl);
  const defaultPrimaryFace = toDefaultDeckFaceUrl(primary);

  const fallbackCandidates = orientation === 'reversed'
    ? [
      fromEntry.upright,
      fromCard.upright,
      uprightUrl,
      fromEntry.default,
      fromCard.default,
      resolvedPrimary,
      defaultReversedFace,
      defaultUprightFace,
      defaultPrimaryFace,
      backUrl,
      globalSiteFallback,
    ]
    : [
      fromEntry.default,
      fromCard.default,
      resolvedPrimary,
      defaultUprightFace,
      defaultPrimaryFace,
      backUrl,
      globalSiteFallback,
    ];

  const fallbackChain = [...new Set(fallbackCandidates.filter(Boolean).filter((item) => item !== primary))];

  console.log('[Poster] card image resolved', {
    cardSlug,
    orientation,
    reversedAsset: fromEntry.reversed || fromCard.reversed || reversedUrl || null,
    uprightAsset: fromEntry.upright || fromCard.upright || uprightUrl || null,
    finalImage: primary || null,
    lang: lang || null,
  });

  return { primary, fallbackChain, cardSlug, orientation };
}


function toSameOriginAssetCandidate(url) {
  if (!url || typeof window === 'undefined') return null;
  try {
    const parsed = new URL(url, window.location.origin);
    return `${window.location.origin}${parsed.pathname}`;
  } catch (error) {
    return null;
  }
}

function emitFullCardRenderProbe(payload = {}) {
  if (!isPosterCiDebugEnabled()) return;
  posterCiLog('full_card_render_probe', payload);
}

function toSafeText(value, fallback = '') {
  if (value == null) return fallback;
  return String(value);
}

function normalizePosterLanguage(lang = 'en') {
  return String(lang || '').toLowerCase().startsWith('th') ? 'th' : 'en';
}

function isCelticCrossPosterPayload(payload) {
  return String(payload?.mode || '').toLowerCase() === 'full'
    && Array.isArray(payload?.cards)
    && payload.cards.length >= CELTIC_CROSS_POSITIONS.length;
}

function resolveLocalizedCardName(card = {}, fallback = '', lang = 'en') {
  const locale = normalizePosterLanguage(lang);
  const name = locale === 'th'
    ? (card?.card_name_th || card?.name_th || card?.card_name_en || card?.name_en || card?.name)
    : (card?.card_name_en || card?.name_en || card?.card_name_th || card?.name_th || card?.name);
  return toSafeText(name || fallback, fallback);
}

function mergeCelticCrossCardEntries(payload = {}, cardEntries = []) {
  return CELTIC_CROSS_POSITIONS.map((position, index) => {
    const payloadCard = payload?.cards?.[index] || {};
    const entry = cardEntries[index] || null;
    return {
      position,
      payloadCard,
      entry,
      card: entry?.card || payloadCard || null,
      orientation: toOrientation(entry?.orientation || payloadCard?.orientation || 'upright'),
    };
  });
}

function firstSentenceForNarration(text, maxChars = 130) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  // Prefer the first sentence (Latin sentence-final punctuation). Languages that
  // don't end sentences with . ! ? — notably Thai — fall through to the whole
  // string, so cap the length (breaking at a space when possible) to keep the
  // narration short enough to render large and legible. Also guards runaway EN.
  const match = t.match(/^[\s\S]*?[.!?](?=\s|$)/);
  let s = (match ? match[0] : t).trim();
  if (s.length > maxChars) {
    const cut = s.slice(0, maxChars);
    const lastSpace = cut.lastIndexOf(' ');
    s = (lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut).trim() + '…';
  }
  return s;
}

// Weave the key Celtic positions (Present, the Obstacle/Crossing, Advice,
// Outcome) into one flowing reading — no position labels, no card names. Each
// position contributes its lead sentence so the result stays short enough to
// render large and legible on the poster (replaces the old three cramped
// low-contrast insight panels).
function buildCelticNarration(insights = []) {
  return insights
    .map((insight) => firstSentenceForNarration(insight && insight.body))
    .filter(Boolean)
    .join(' ');
}

export function resolveCelticCrossPosterContent(payload = {}, cardEntries = []) {
  const lang = normalizePosterLanguage(payload?.lang || 'en');
  const strings = CELTIC_CROSS_POSTER_STRINGS[lang] || CELTIC_CROSS_POSTER_STRINGS.en;
  const positionedCards = mergeCelticCrossCardEntries(payload, cardEntries);
  const byPosition = new Map(positionedCards.map((item) => [item.position, item]));

  const buildInsight = (position) => {
    const item = byPosition.get(position) || { position, payloadCard: {}, entry: null, card: null, orientation: 'upright' };
    const card = item.card || {};
    const body = getCelticCrossInterpretation(card, position, lang);
    const fallbackTitle = strings.insightTitles[position] || getFullPosterPositionLabel(position, lang);
    return {
      ...item,
      label: getFullPosterPositionLabel(position, lang),
      title: resolveLocalizedCardName(card, fallbackTitle, lang) || fallbackTitle,
      body: toSafeText(body, '').trim(),
      orientationLabel: getOrientationLabel(item.orientation, lang),
    };
  };

  const present = buildInsight('present');
  const challenge = buildInsight('challenge');
  const advice = buildInsight('advice');
  const outcome = buildInsight('outcome');
  const heroTitle = normalizeStandaloneAffirmation(outcome.body, lang, strings.heroFallback);
  const narration = buildCelticNarration([present, challenge, advice, outcome]);

  return {
    lang,
    strings,
    heroTitle,
    subtitle: strings.subtitle,
    present,
    challenge,
    advice,
    outcome,
    narration,
    positionedCards,
  };
}

function getQuestionPosterStrings(payload = {}) {
  const lang = normalizePosterLanguage(payload?.lang || 'en');
  const dict = translations[lang] || translations.en;
  const topicConfigBySlug = {
    love: {
      titleKey: 'topicLove',
      supportKey: 'topicLoveDesc',
      subtitle: lang === 'th' ? 'ภาพรวมจังหวะความรักที่ควรรู้ตอนนี้' : 'Your love timeline at a glance',
    },
    career: {
      titleKey: 'topicCareer',
      supportKey: 'topicCareerDesc',
      subtitle: lang === 'th' ? 'ภาพรวมจังหวะการงานที่ควรรู้ตอนนี้' : 'Your career timeline at a glance',
    },
    finance: {
      titleKey: 'topicFinance',
      supportKey: 'topicFinanceDesc',
      subtitle: lang === 'th' ? 'ภาพรวมจังหวะการเงินที่ควรรู้ตอนนี้' : 'Your money timeline at a glance',
    },
    other: {
      titleKey: 'topicOther',
      supportKey: 'topicOtherDesc',
      subtitle: lang === 'th' ? 'ภาพรวมคำถามนี้ในสามช่วงเวลา' : 'Your question timeline at a glance',
    },
    generic: {
      titleKey: 'topicGeneric',
      supportKey: 'topicOtherDesc',
      subtitle: lang === 'th' ? 'ภาพรวมคำถามนี้ในสามช่วงเวลา' : 'Your question timeline at a glance',
    },
  };
  const topicSlug = String(payload?.topic || '').toLowerCase();
  const topicConfig = topicConfigBySlug[topicSlug] || topicConfigBySlug.generic;
  const topicTitle = toSafeText(dict?.[topicConfig.titleKey], '').trim();
  const heroTitle = topicTitle || toSafeText(payload?.poster?.title ?? payload?.title, dict.questionTitle || dict.yourReading || '3-Card Spread');
  const spreadFallback = dict.questionSpreadNote || (lang === 'th' ? 'อดีต · ปัจจุบัน · อนาคต' : 'Past · Present · Future');
  const supportLine = toSafeText(dict?.[topicConfig.supportKey], '').trim() || spreadFallback;
  return {
    title: heroTitle,
    eyebrow: toSafeText(dict.questionTitle, 'Ask a Question'),
    subtitle: topicConfig.subtitle,
    tertiary: supportLine,
    positions: [dict.past || 'Past', dict.present || 'Present', dict.future || 'Future'],
  };
}

const QUESTION_TOPIC_SUMMARY_PREFIX = {
  love: 'love',
  finance: 'finance',
  career: 'career',
  self: 'self',
  family: 'family',
  travel: 'travel',
  health: 'health',
};

function resolveQuestionPosterSummaries(payload = {}, cardEntries = []) {
  const lang = normalizePosterLanguage(payload?.lang || 'en');
  const reading = payload?.reading || {};
  const slots = ['past', 'present', 'future'];
  const topic = String(payload?.topic || '').toLowerCase();
  const topicPrefix = QUESTION_TOPIC_SUMMARY_PREFIX[topic] || '';
  const pickFirst = (candidates = []) => {
    for (const item of candidates) {
      const text = toSafeText(item, '').trim();
      if (text) return text;
    }
    return '';
  };

  return slots.map((slot, idx) => {
    const card = cardEntries[idx]?.card || {};
    return pickFirst([
      topicPrefix ? getLocalizedField(card, `${topicPrefix}_${slot}`, lang) : '',
      topicPrefix ? card[`${topicPrefix}_${slot}`] : '',
      topicPrefix ? reading[`${topicPrefix}_${slot}_${lang}`] : '',
      topicPrefix ? reading[`${topicPrefix}_${slot}`] : '',
      getLocalizedField(card, `reading_summary_${slot}`, lang),
      reading[`reading_summary_${slot}_${lang}`],
      reading[`reading_summary_${slot}`],
      card[`reading_summary_${slot}`],
      // Topic-agnostic position interpretation (a real "present/past/future" answer).
      getLocalizedField(card, `standalone_${slot}`, lang),
      getLocalizedField(card, 'general_meaning', lang),
      // EN gap-fillers (always a statement, never the reflection question) so a TH
      // content gap shows an English interpretation rather than a bare question or
      // blank. reflection_question is deliberately excluded — it's a prompt, not an answer.
      card[`standalone_${slot}_en`],
      card.general_meaning_en,
      card.tarot_imply_en,
    ]);
  });
}

async function buildCardEntries(payload) {
  posterDebugLog('log', '[Poster] buildCardEntries: meowTarotCards length', meowTarotCards.length);
  if (!deckHasLocale(String(payload?.lang || '').toLowerCase().startsWith('th') ? 'th' : 'en')) {
    await ensureTarotData(payload?.lang);
    posterDebugLog('log', '[Poster] tarot deck ensured', {
      size: Array.isArray(meowTarotCards) ? meowTarotCards.length : 0,
    });
    posterDebugLog('log', '[Poster] buildCardEntries: reloaded tarot data', meowTarotCards.length);
  }
  const rawCards = Array.isArray(payload?.cards)
    ? payload.cards
    : (payload?.card && typeof payload.card === 'object' ? [payload.card] : []);
  const cards = String(payload?.mode || '').toLowerCase() === 'question'
    ? orderQuestionCards(rawCards)
    : rawCards;
  return cards
    .map((entry) => {
      const orientation = toOrientation(entry?.orientation || entry?.id || 'upright');
      const targetId = baseCardId(entry?.id || entry?.cardId || entry?.card_id);
      const orientedLookupId = targetId ? `${targetId}-${orientation}` : targetId;
      const hit = findCardById(meowTarotCards, orientedLookupId, normalizeId);
      return hit
        ? {
          card: hit,
          id: targetId,
          orientation,
          name: entry?.name || hit.card_name_en || hit.name_en || hit.name_th || hit.name || targetId,
          preferredImageUrl: entry?.resolvedImageUrl || entry?.imageUrl || '',
          image: entry?.image || '',
          resolvedImageUrl: entry?.resolvedImageUrl || '',
          imageUrl: entry?.imageUrl || '',
          image_upright: entry?.image_upright || entry?.imageUpright || '',
          image_reversed: entry?.image_reversed || entry?.imageReversed || '',
        }
        : {
          card: null,
          id: targetId,
          orientation,
          name: entry?.name || targetId,
          preferredImageUrl: entry?.resolvedImageUrl || entry?.imageUrl || '',
          image: entry?.image || '',
          resolvedImageUrl: entry?.resolvedImageUrl || '',
          imageUrl: entry?.imageUrl || '',
          image_upright: entry?.image_upright || entry?.imageUpright || '',
          image_reversed: entry?.image_reversed || entry?.imageReversed || '',
        };
    })
    .filter((entry) => entry.card || entry.name);
}

let tarotDataPromise = null;

// True when the cached deck actually carries interpretation fields for `locale`.
function deckHasLocale(locale) {
  return meowTarotCards.length >= 150 && meowTarotCards.some((c) => c && (
    c[`reading_summary_present_${locale}`] || c[`standalone_present_${locale}`] || c[`general_meaning_${locale}`]
  ));
}

// A poster can be generated in EITHER language regardless of the page URL, but
// loadTarotData() infers the slice from the URL (`/th/` / `?l=`) — so a Thai poster
// built on a non-/th/ page would get the EN-only slice and every `_th` lookup would
// miss, falling back to the English gap-fillers (the "lang doesn't match" bug). So
// load the full bilingual deck whenever the poster's language isn't already present.
function ensureTarotData(lang) {
  const locale = String(lang || '').toLowerCase().startsWith('th') ? 'th' : 'en';
  if (deckHasLocale(locale)) return Promise.resolve(meowTarotCards);
  if (!tarotDataPromise) {
    tarotDataPromise = loadTarotData('both').finally(() => {
      tarotDataPromise = null;
    });
  }
  return tarotDataPromise;
}

function drawStarfield(ctx, width, height) {
  const stars = [
    [0.12, 0.2, 2.2],
    [0.22, 0.32, 1.6],
    [0.35, 0.16, 1.8],
    [0.68, 0.22, 1.4],
    [0.84, 0.18, 2.3],
    [0.15, 0.6, 1.1],
    [0.32, 0.72, 1.6],
    [0.8, 0.55, 1.2],
    [0.6, 0.72, 1.8],
  ];
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  stars.forEach(([x, y, r]) => {
    ctx.beginPath();
    ctx.arc(width * x, height * y, r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function ellipsizeText(ctx, text, maxWidth) {
  const clean = String(text);
  if (ctx.measureText(clean).width <= maxWidth) return clean;
  let truncated = clean;
  while (truncated.length > 0 && ctx.measureText(`${truncated}…`).width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated ? `${truncated}…` : '…';
}

// Split a string into break-units (grapheme-ish): a base character + any following Thai
// above/below vowels & tone marks, so a wrap never orphans a combining mark onto the next
// line. Falls back to code points for everything else.
function toBreakUnits(value) {
  const m = String(value).match(/[\s\S][ัิ-ฺ็-๎]*/gu);
  return m || Array.from(value);
}

// Segment Thai into WORD units (dictionary-based) so a wrap breaks BETWEEN words, never inside
// one — fixes e.g. "บาด" splitting into "บา" / "ด" at a line break (founder 2026-06-22). Falls
// back to cluster units if Intl.Segmenter is unavailable.
let _thWordSeg = null;
function toThaiWordUnits(value) {
  try {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      if (!_thWordSeg) _thWordSeg = new Intl.Segmenter('th', { granularity: 'word' });
      const out = Array.from(_thWordSeg.segment(String(value)), (s) => s.segment);
      if (out.length) return out;
    }
  } catch (_) { /* fall through */ }
  return toBreakUnits(value);
}

function tokenizeText(ctx, text, maxWidth) {
  const value = String(text || '');
  if (!value) return { tokens: [], sep: ' ' };
  // No-space scripts (Thai/Lao/CJK/Khmer): wrap at WORD boundaries via Intl.Segmenter so a Thai
  // word never breaks mid-cluster (e.g. "บาด" → "บา"/"ด"). Each word-unit that still exceeds
  // maxWidth (a very long word) is cluster-split so a line can never overflow/clip — keeping the
  // old no-overflow guarantee while fixing the mid-word breaks. (2026-06-22, was cluster-only.)
  if (/[฀-๿຀-໿ក-៿぀-ヿ㐀-鿿가-힯]/.test(value)) {
    const units = toThaiWordUnits(value);
    const tokens = [];
    for (let i = 0; i < units.length; i += 1) {
      const u = units[i];
      if (ctx.measureText(u).width <= maxWidth) tokens.push(u);
      else toBreakUnits(u).forEach((c) => tokens.push(c));
    }
    return { tokens, sep: '' };
  }
  // Latin etc: word-tokenize, but never leave an over-wide single word unbroken.
  const words = value.split(/\s+/).filter(Boolean);
  const everyWordFits = words.every((w) => ctx.measureText(w).width <= maxWidth);
  if (words.length > 1 && everyWordFits) return { tokens: words, sep: ' ' };
  if (ctx.measureText(value).width <= maxWidth) return { tokens: [value], sep: ' ' };
  return { tokens: Array.from(value), sep: '' };
}

function wrapTextLines(ctx, text, maxWidth, maxLines = Infinity) {
  if (!text) return [];
  const { tokens, sep } = tokenizeText(ctx, text, maxWidth);
  const lines = [];
  let line = '';

  let overflow = false;
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const candidate = line ? `${line}${sep}${token}` : token;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = token;
    } else {
      line = candidate;
    }

    if (lines.length === maxLines) {
      overflow = i < tokens.length - 1 || line;
      line = '';
      break;
    }
  }

  if (line && lines.length < maxLines) {
    lines.push(line);
  }

  if (overflow && lines.length) {
    lines[maxLines - 1] = ellipsizeText(ctx, lines[maxLines - 1], maxWidth);
  }
  return lines;
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = Infinity) {
  if (!text) return y;
  const lines = wrapTextLines(ctx, text, maxWidth, maxLines);
  lines.forEach((content, index) => {
    ctx.fillText(content, x, y + index * lineHeight);
  });
  return y + lines.length * lineHeight;
}

function fitDailyQuoteText(ctx, text, maxWidth, maxHeight, opts = {}) {
  const {
    fontFamily = '"Prata", serif',
    defaultFontSize = 58,
    minimumFontSize = 46,
    addQuotes = true,
  } = opts;
  const quoteText = String(text || '').trim();
  if (!quoteText) {
    return {
      fontSize: defaultFontSize,
      lineHeight: Math.round(defaultFontSize * 1.24),
      lines: [],
      isTruncated: false,
      ascent: Math.round(defaultFontSize * 0.82),
      descent: Math.round(defaultFontSize * 0.24),
      occupiedHeight: 0,
    };
  }

  const quoteRenderSafety = 8;
  const measureQuoteMetrics = (fontSize) => {
    ctx.font = `italic 500 ${fontSize}px ${fontFamily}`;
    const metrics = ctx.measureText('“Ag”');
    const ascent = Math.max(metrics.actualBoundingBoxAscent || 0, Math.round(fontSize * 0.82));
    const descent = Math.max(metrics.actualBoundingBoxDescent || 0, Math.round(fontSize * 0.24));
    const lineHeight = Math.max(fontSize + 14, Math.ceil(ascent + descent + 10));
    return { ascent, descent, lineHeight };
  };

  // Keep the premium display style, then progressively shrink only as needed.
  const fontStep = 2;
  const quote = addQuotes ? `“${quoteText}”` : quoteText;

  for (let fontSize = defaultFontSize; fontSize >= minimumFontSize; fontSize -= fontStep) {
    const { ascent, descent, lineHeight } = measureQuoteMetrics(fontSize);
    const lines = wrapTextLines(ctx, quote, maxWidth, Number.POSITIVE_INFINITY);
    const occupiedHeight = ascent + descent + Math.max(0, lines.length - 1) * lineHeight + quoteRenderSafety;
    // Belt-and-suspenders: also require EVERY line to fit the width at this (draw) font, so
    // a line can never overflow + clip even if wrapping under-measured. (Attempt 2.)
    const widest = lines.reduce((m, ln) => Math.max(m, ctx.measureText(ln).width), 0);
    if (occupiedHeight <= maxHeight && widest <= maxWidth) {
      return {
        fontSize,
        lineHeight,
        lines,
        isTruncated: false,
        ascent,
        descent,
        occupiedHeight,
      };
    }
  }

  // If the minimum readable size still overflows, clamp lines and rely on ellipsis.
  const fontSize = minimumFontSize;
  const { ascent, descent, lineHeight } = measureQuoteMetrics(fontSize);
  const usableHeight = Math.max(0, maxHeight - ascent - descent - quoteRenderSafety);
  const maxLines = Math.max(1, Math.floor(usableHeight / lineHeight) + 1);
  const lines = wrapTextLines(ctx, quote, maxWidth, maxLines);
  const occupiedHeight = ascent + descent + Math.max(0, lines.length - 1) * lineHeight + quoteRenderSafety;
  return {
    fontSize,
    lineHeight,
    lines,
    isTruncated: true,
    ascent,
    descent,
    occupiedHeight,
  };
}


function normalizeStandaloneAffirmation(text, lang = 'en', fallback = '') {
  const value = toSafeText(text, '').replace(/\s+/g, ' ').trim();
  if (!value) return fallback;

  const sentenceParts = lang === 'th'
    ? value.split(/[.!?！？]+\s*/u)
    : value.split(/[.!?]+\s*/u);
  const firstSentence = (sentenceParts.find((part) => part && part.trim()) || value).trim();

  const softBreakMatch = firstSentence.match(/^(.+?)(?:\s*[—–-]\s*|,\s*|;\s*)/u);
  const conciseSentence = softBreakMatch?.[1]?.trim() || firstSentence;

  const ensureSentenceEnding = (content) => {
    if (!content) return fallback;
    if (/[.!?。！？]$/u.test(content)) return content;
    return lang === 'th' ? content : `${content}.`;
  };

  const maxChars = lang === 'th' ? 82 : 98;
  if (firstSentence.length <= maxChars) return ensureSentenceEnding(firstSentence);
  if (conciseSentence.length >= 16) return ensureSentenceEnding(conciseSentence);
  return ensureSentenceEnding(firstSentence);
}

function fitAffirmationText(ctx, text, {
  maxWidth,
  maxLines = 3,
  startFontSize = 22,
  minFontSize = 14,
  lineHeightRatio = 1.3,
} = {}) {
  const value = toSafeText(text, '').trim();
  if (!value) {
    return { fontSize: startFontSize, lineHeight: Math.round(startFontSize * lineHeightRatio), lines: [] };
  }
  for (let fontSize = startFontSize; fontSize >= minFontSize; fontSize -= 1) {
    const lineHeight = Math.round(fontSize * lineHeightRatio);
    ctx.font = `620 ${fontSize}px "Space Grotesk", "IBM Plex Sans Thai", sans-serif`;
    const lines = wrapTextLines(ctx, value, maxWidth, maxLines);
    const hasClampEllipsis = lines.some((line) => /…$/.test(line));
    if (!hasClampEllipsis || fontSize === minFontSize) {
      return { fontSize, lineHeight, lines };
    }
  }
  const fontSize = minFontSize;
  const lineHeight = Math.round(fontSize * lineHeightRatio);
  ctx.font = `620 ${fontSize}px "Space Grotesk", "IBM Plex Sans Thai", sans-serif`;
  return { fontSize, lineHeight, lines: wrapTextLines(ctx, value, maxWidth, maxLines) };
}

function fitMainGuidanceText(ctx, text, { maxWidth, maxLines = 3, maxHeight, startFontSize = 52, minFontSize = 40 } = {}) {
  const safeWidth = Number.isFinite(maxWidth) && maxWidth > 0 ? maxWidth : 560;
  const safeMaxHeight = Number.isFinite(maxHeight) && maxHeight > 0 ? maxHeight : 160;
  const safeMaxLines = Number.isFinite(maxLines) && maxLines > 0 ? maxLines : 3;
  const value = String(text || '').trim();
  if (!value) {
    return {
      fontSize: startFontSize,
      lineHeight: Math.round(startFontSize * 1.1),
      lines: [],
    };
  }

  for (let fontSize = startFontSize; fontSize >= minFontSize; fontSize -= 2) {
    const lineHeight = Math.round(fontSize * 1.1);
    ctx.font = `620 ${fontSize}px "Space Grotesk", "IBM Plex Sans Thai", sans-serif`;
    const lines = wrapTextLines(ctx, value, safeWidth, Number.POSITIVE_INFINITY);
    const occupiedHeight = lines.length * lineHeight;
    if (lines.length <= safeMaxLines && occupiedHeight <= safeMaxHeight) {
      return { fontSize, lineHeight, lines };
    }
  }

  const fontSize = minFontSize;
  const lineHeight = Math.round(fontSize * 1.1);
  ctx.font = `620 ${fontSize}px "Space Grotesk", "IBM Plex Sans Thai", sans-serif`;
  const lines = wrapTextLines(ctx, value, safeWidth, safeMaxLines);
  return { fontSize, lineHeight, lines };
}

function drawTextBlock(ctx, text, x, y, maxWidth, lineHeight) {
  return wrapText(ctx, text, x, y, maxWidth, lineHeight);
}

function drawTrackingText(ctx, text, x, y, tracking = 0) {
  const value = String(text || '');
  if (!value) return;
  if (!tracking) {
    ctx.fillText(value, x, y);
    return;
  }
  // Thai (and other complex scripts) must NOT be split per code point — combining
  // vowels / tone marks would detach from their base consonant and render as tofu.
  // Letter-spacing isn't idiomatic for Thai anyway, so draw it as one centred run
  // (the per-char path below also centres around x).
  if (/[฀-๿]/.test(value)) {
    // EXPLICIT centring: measure + draw left-aligned at x − w/2 instead of relying on
    // ctx.textAlign='center', which mis-centres Thai on some canvas impls (iOS Safari) →
    // text drifts to the right edge. Latin is unaffected, which is why only the Thai
    // date/orientation/reading looked off. (2026-06-20)
    const prevAlign = ctx.textAlign;
    ctx.textAlign = 'left';
    const w = ctx.measureText(value).width;
    ctx.fillText(value, x - w / 2, y);
    ctx.textAlign = prevAlign;
    return;
  }
  const chars = Array.from(value);
  const textWidth = chars.reduce((sum, ch) => sum + ctx.measureText(ch).width, 0);
  const totalTracking = tracking * Math.max(chars.length - 1, 0);
  let cursor = x - (textWidth + totalTracking) / 2;
  chars.forEach((ch, index) => {
    ctx.fillText(ch, cursor, y);
    cursor += ctx.measureText(ch).width;
    if (index < chars.length - 1) cursor += tracking;
  });
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function fillRoundedRect(ctx, x, y, width, height, radius, fillStyle) {
  ctx.save();
  drawRoundedRect(ctx, x, y, width, height, radius);
  ctx.fillStyle = fillStyle;
  ctx.fill();
  ctx.restore();
}

function strokeRoundedRect(ctx, x, y, width, height, radius, strokeStyle, lineWidth = 1) {
  ctx.save();
  drawRoundedRect(ctx, x, y, width, height, radius);
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  ctx.restore();
}

function drawFallbackCardArt(ctx, x, y, width, height, { radius = 16, label = 'MEOW TAROT' } = {}) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
  gradient.addColorStop(0, 'rgba(255, 244, 214, 0.18)');
  gradient.addColorStop(1, 'rgba(100, 126, 210, 0.24)');
  fillRoundedRect(ctx, x, y, width, height, safeRadius, gradient);
  strokeRoundedRect(ctx, x, y, width, height, safeRadius, 'rgba(255,255,255,0.26)', 1.5);

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.font = `600 ${Math.max(10, Math.round(Math.min(width, height) * 0.072))}px "Space Grotesk", "IBM Plex Sans Thai", sans-serif`;
  ctx.fillText(label, x + width / 2, y + height / 2);
  ctx.restore();
}

function resolveCelticCrossPresetLayout(preset = 'story', width = 1080, height = 1920) {
  const layouts = {
    story: {
      header: { top: 110, brandSize: 72, eyebrowSize: 20, heroSize: 44, subtitleSize: 22 },
      spreadShell: { x: 56, y: 286, w: width - 112, h: 930, radius: 32 },
      spread: { cardW: 132, cardH: 210, gapX: 14, gapY: 20, labelGap: 10, nameGap: 7 },
      insights: { x: 56, y: 1272, w: width - 112, gap: 14, rowH: 150, direction: 'column', heroFirst: true },
      footerY: height - 92,
    },
    portrait: {
      header: { top: 92, brandSize: 66, eyebrowSize: 18, heroSize: 38, subtitleSize: 20 },
      spreadShell: { x: 72, y: 238, w: width - 144, h: 630, radius: 30 },
      spread: { cardW: 110, cardH: 176, gapX: 12, gapY: 16, labelGap: 8, nameGap: 6 },
      insights: { x: 72, y: 920, w: width - 144, gap: 14, rowH: 148, direction: 'portrait-grid', heroFirst: false },
      footerY: height - 86,
    },
    square: {
      header: { top: 86, brandSize: 56, eyebrowSize: 16, heroSize: 32, subtitleSize: 18 },
      spreadShell: { x: 56, y: 204, w: width - 112, h: 458, radius: 28 },
      spread: { cardW: 84, cardH: 134, gapX: 10, gapY: 14, labelGap: 7, nameGap: 5 },
      insights: { x: 56, y: 722, w: width - 112, gap: 10, rowH: 176, direction: 'row', heroFirst: false },
      footerY: height - 64,
    },
  };
  return layouts[preset] || layouts.story;
}

async function renderCelticCrossPoster(ctx, payload, preset, width, height) {
  const lang = normalizePosterLanguage(payload?.lang || 'en');
  const layout = resolveCelticCrossPresetLayout(preset, width, height);
  const cardEntries = (await buildCardEntries(payload)).slice(0, CELTIC_CROSS_POSITIONS.length);
  const content = resolveCelticCrossPosterContent(payload, cardEntries);
  const {
    header,
    spreadShell,
    spread,
    insights,
    footerY,
  } = layout;

  const drawHeader = () => {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.42)';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#bf8a20';
    // Brand title in the loaded Cormorant Garamond serif (Poppins isn't preloaded → it
    // fell back to a blocky sans). Matches the Daily poster's elegant serif style.
    // Wordmark deepened from #c9933a → #bf8a20 (founder 2026-06-20) — old gold read muddy/
    // washed-out on the pastel poster background.
    ctx.font = `italic 700 ${header.brandSize}px "Cormorant Garamond", "Noto Serif Thai", serif`;
    ctx.fillText('MeowTarot', width / 2, header.top);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(201, 147, 58, 0.95)';
    ctx.font = `600 ${header.eyebrowSize}px "Space Grotesk", "IBM Plex Sans Thai", sans-serif`;
    drawTrackingText(ctx, content.strings.eyebrow, width / 2, header.top + 44, 1.2);

    const heroWidth = Math.min(width - 180, preset === 'square' ? 820 : 860);
    const heroFit = fitMainGuidanceText(ctx, content.heroTitle, {
      maxWidth: heroWidth,
      maxLines: preset === 'square' ? 2 : 3,
      maxHeight: preset === 'square' ? 82 : 128,
      startFontSize: header.heroSize,
      minFontSize: preset === 'square' ? 24 : 28,
    });
    ctx.fillStyle = '#f7f4ee';
    ctx.font = `700 ${heroFit.fontSize}px "Space Grotesk", "IBM Plex Sans Thai", sans-serif`;
    heroFit.lines.forEach((line, index) => {
      ctx.fillText(line, width / 2, header.top + 94 + index * heroFit.lineHeight);
    });

    const subtitleY = header.top + 94 + heroFit.lines.length * heroFit.lineHeight + 10;
    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    ctx.font = `500 ${header.subtitleSize}px "Space Grotesk", "IBM Plex Sans Thai", sans-serif`;
    wrapText(ctx, content.subtitle, width / 2, subtitleY, width - 220, Math.round(header.subtitleSize * 1.45), 2);
    ctx.restore();
  };

  const drawSpreadShell = () => {
    const shellGradient = ctx.createLinearGradient(spreadShell.x, spreadShell.y, spreadShell.x, spreadShell.y + spreadShell.h);
    shellGradient.addColorStop(0, 'rgba(255,255,255,0.08)');
    shellGradient.addColorStop(1, 'rgba(255,255,255,0.035)');
    fillRoundedRect(ctx, spreadShell.x, spreadShell.y, spreadShell.w, spreadShell.h, spreadShell.radius, shellGradient);
    strokeRoundedRect(ctx, spreadShell.x, spreadShell.y, spreadShell.w, spreadShell.h, spreadShell.radius, 'rgba(255,255,255,0.14)', 1.5);
  };

  const spreadGridWidth = spread.cardW * 5 + spread.gapX * 4;
  const spreadGridHeight = spread.cardH * 4 + spread.gapY * 3;
  const spreadOriginX = spreadShell.x + (spreadShell.w - spreadGridWidth) / 2;
  const spreadOriginY = spreadShell.y + Math.max(26, (spreadShell.h - spreadGridHeight - 84) / 2);
  const spreadCenterX = spreadOriginX + spread.cardW + spread.gapX + spread.cardW / 2;
  const spreadCenterY = spreadOriginY + spread.cardH + spread.gapY + spread.cardH / 2;
  const staffX = spreadOriginX + (spread.cardW + spread.gapX) * 4 + spread.cardW / 2;
  const cardLayouts = {
    present: { x: spreadCenterX, y: spreadCenterY },
    challenge: { x: spreadCenterX, y: spreadCenterY, rotated: true },
    past: { x: spreadOriginX + spread.cardW / 2, y: spreadCenterY },
    future: { x: spreadOriginX + (spread.cardW + spread.gapX) * 2 + spread.cardW / 2, y: spreadCenterY },
    above: { x: spreadCenterX, y: spreadOriginY + spread.cardH / 2 },
    below: { x: spreadCenterX, y: spreadOriginY + (spread.cardH + spread.gapY) * 2 + spread.cardH / 2 },
    outcome: { x: staffX, y: spreadOriginY + spread.cardH / 2 },
    hopes: { x: staffX, y: spreadOriginY + (spread.cardH + spread.gapY) + spread.cardH / 2 },
    external: { x: staffX, y: spreadOriginY + (spread.cardH + spread.gapY) * 2 + spread.cardH / 2 },
    advice: { x: staffX, y: spreadOriginY + (spread.cardH + spread.gapY) * 3 + spread.cardH / 2 },
  };

  const drawCardMeta = ({ item, layoutBox, isHeroPosition = false }) => {
    const label = getFullPosterPositionLabel(item.position, lang);
    const cardName = resolveLocalizedCardName(item.card, item.entry?.name || item.payloadCard?.name || '', lang);
    const orientationLabel = getOrientationLabel(item.orientation, lang);
    const pillPaddingX = preset === 'square' ? 12 : 14;
    const pillHeight = preset === 'square' ? 17 : 18;
    const pillFontSize = preset === 'square' ? 10 : 11;
    // Sit the pill tight under the card (small fixed gap) so it fits the ~14-20px row gap
    // instead of spilling onto the card below.
    const labelY = layoutBox.y + spread.cardH / 2 + 1;
    ctx.save();
    ctx.font = `600 ${pillFontSize}px "Space Grotesk", "IBM Plex Sans Thai", sans-serif`;
    const pillWidth = Math.min(spread.cardW + 18, Math.max(70, ctx.measureText(label).width + pillPaddingX * 2));
    ctx.restore();
    const pillX = layoutBox.x - pillWidth / 2;

    fillRoundedRect(ctx, pillX, labelY, pillWidth, pillHeight, pillHeight / 2, 'rgba(61, 26, 92, 0.78)');
    strokeRoundedRect(ctx, pillX, labelY, pillWidth, pillHeight, pillHeight / 2, 'rgba(255,255,255,0.14)', 1);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.font = `600 ${pillFontSize}px "Space Grotesk", "IBM Plex Sans Thai", sans-serif`;
    ctx.fillText(label, layoutBox.x, labelY + pillHeight - 8);
    // Card name + orientation per card were drawn here but the ~50px block overlapped the
    // next (vertically-stacked) card — the cross gaps are only ~20px and the canvas height
    // is fixed. Dropped to a pill-only label; card names live in the reading narration.
    ctx.restore();
  };

  const drawCardArt = async (item) => {
    const sourceCard = item.entry?.card || item.payloadCard || {};
    const fallbackBaseId = baseCardId(item.payloadCard?.id || item.payloadCard?.card_id || item.payloadCard?.image_id || item.position);
    const baseId = baseCardId(sourceCard?.id || sourceCard?.card_id || sourceCard?.image_id || fallbackBaseId);
    // Reversed cards now SOURCE the upright art; the canvas is rotated 180° at
    // draw time (item.orientation === 'reversed' rotation below). So coerce the
    // image sourcing to 'upright' here — never request a *-reversed.webp asset.
    // item.orientation keeps the REAL orientation for the rotate + label/meaning.
    const imageOrientation = posterImageOrientation(item.orientation);
    const orientedId = `${baseId}-${imageOrientation}`;
    const cardIdentity = { ...sourceCard, id: orientedId, card_id: orientedId, image_id: orientedId };
    const { uprightUrl, reversedUrl, backUrl } = buildCardImageUrls(cardIdentity, imageOrientation);
    const resolvedPrimary = await resolveCardImageUrl(cardIdentity, imageOrientation);
    const { primary, fallbackChain } = resolvePosterCardImageSources({ ...item.entry, ...item.payloadCard, orientation: imageOrientation, card: sourceCard }, {
      resolvedPrimary,
      uprightUrl,
      reversedUrl,
      backUrl,
      lang,
    });
    try {
      // Small Celtic cards: prefer the 200px thumbnail, full-res as first fallback.
      const thumb = toPosterThumb200(primary);
      return await loadPosterCardImageWithTimeout(thumb || primary, thumb ? [primary, ...fallbackChain] : fallbackChain);
    } catch (error) {
      console.warn('[Poster] celtic cross card image failed', { position: item.position, url: primary || backUrl, reason: error?.message || String(error) });
      return null;
    }
  };

  const drawSingleCard = async (item) => {
    const layoutBox = cardLayouts[item.position] || cardLayouts.present;
    const image = await drawCardArt(item);
    const cardX = layoutBox.x - spread.cardW / 2;
    const cardY = layoutBox.y - spread.cardH / 2;
    const frameRadius = Math.max(16, Math.round(spread.cardW * 0.18));
    const isHeroPosition = ['present', 'advice', 'outcome'].includes(item.position);
    const shadowBlur = item.position === 'outcome' ? 32 : (isHeroPosition ? 24 : 18);

    ctx.save();
    ctx.shadowColor = item.position === 'outcome' ? 'rgba(201, 147, 58, 0.18)' : 'rgba(0,0,0,0.32)';
    ctx.shadowBlur = shadowBlur;
    ctx.shadowOffsetY = 10;
    drawRoundedRect(ctx, cardX, cardY, spread.cardW, spread.cardH, frameRadius);
    ctx.fillStyle = 'rgba(255,255,255,0.01)';
    ctx.fill();
    ctx.restore();

    if (isHeroPosition) {
      strokeRoundedRect(ctx, cardX - 1, cardY - 1, spread.cardW + 2, spread.cardH + 2, frameRadius + 1, 'rgba(201, 147, 58, 0.22)', 1.5);
    }

    ctx.save();
    ctx.translate(layoutBox.x, layoutBox.y);
    if (layoutBox.rotated) ctx.rotate(Math.PI / 2);
    drawRoundedRect(ctx, -spread.cardW / 2, -spread.cardH / 2, spread.cardW, spread.cardH, frameRadius);
    ctx.clip();
    if (image) {
      if (posterShouldRotateReversed(item.orientation)) {
        ctx.translate(0, 0);
        ctx.rotate(Math.PI);
      }
      ctx.drawImage(image, -spread.cardW / 2, -spread.cardH / 2, spread.cardW, spread.cardH);
    } else {
      const fallbackFill = ctx.createLinearGradient(-spread.cardW / 2, -spread.cardH / 2, spread.cardW / 2, spread.cardH / 2);
      fallbackFill.addColorStop(0, 'rgba(255,255,255,0.12)');
      fallbackFill.addColorStop(1, 'rgba(201, 147, 58, 0.08)');
      ctx.fillStyle = fallbackFill;
      ctx.fillRect(-spread.cardW / 2, -spread.cardH / 2, spread.cardW, spread.cardH);
    }
    ctx.restore();

    drawCardMeta({ item, layoutBox, isHeroPosition });
    emitFullCardRenderProbe({ position: item.position, ok: Boolean(image), preset });
  };

  // Single readable narration block (replaces the old 3 cramped low-contrast
  // insight panels). One flowing reading — Present -> Obstacle -> Advice ->
  // Outcome — large, full-contrast serif, no labels or card names.
  const drawNarration = () => {
    const text = content.narration;
    if (!text) return;
    const boxX = insights.x;
    const boxY = insights.y;
    const boxW = insights.w;
    const boxH = Math.max(insights.rowH, footerY - insights.y - 48);

    const grad = ctx.createLinearGradient(boxX, boxY, boxX, boxY + boxH);
    grad.addColorStop(0, 'rgba(255,255,255,0.10)');
    grad.addColorStop(1, 'rgba(255,255,255,0.05)');
    fillRoundedRect(ctx, boxX, boxY, boxW, boxH, 26, grad);
    strokeRoundedRect(ctx, boxX, boxY, boxW, boxH, 26, 'rgba(255,255,255,0.16)', 1.25);
    fillRoundedRect(ctx, boxX, boxY, 4, boxH, 3, 'rgba(201, 147, 58, 0.9)');

    // quiet gold ornament (line + diamond) instead of a text label
    const ornY = boxY + 42;
    ctx.save();
    ctx.strokeStyle = 'rgba(201, 147, 58, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(boxX + 44, ornY);
    ctx.lineTo(boxX + 96, ornY);
    ctx.stroke();
    ctx.fillStyle = 'rgba(201, 147, 58, 0.92)';
    ctx.beginPath();
    ctx.moveTo(boxX + 108, ornY - 5);
    ctx.lineTo(boxX + 113, ornY);
    ctx.lineTo(boxX + 108, ornY + 5);
    ctx.lineTo(boxX + 103, ornY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const padX = 44;
    const bodyTop = boxY + 92;
    const availW = boxW - padX * 2;
    const availH = boxH - (bodyTop - boxY) - 36;
    const maxFont = preset === 'square' ? 27 : (preset === 'portrait' ? 29 : 33);
    const minFont = preset === 'square' ? 20 : 23;
    // Shrink-to-fit: the reading length varies per spread, so step the font down
    // until the whole narration fits — never cut a sentence mid-word.
    let fontSize = maxFont;
    let lineHeight = Math.round(fontSize * 1.46);
    let lines = [];
    for (; fontSize >= minFont; fontSize -= 1) {
      ctx.font = `500 ${fontSize}px "Cormorant Garamond", "Noto Serif Thai", serif`;
      lineHeight = Math.round(fontSize * 1.46);
      lines = wrapTextLines(ctx, text, availW);
      if (lines.length * lineHeight <= availH) break;
    }
    const maxLines = Math.max(3, Math.floor(availH / lineHeight));
    // Dark plum for readable contrast on the pale reading box (was faint cream #f7f4ee).
    ctx.fillStyle = '#3d1a5c';
    ctx.font = `500 ${fontSize}px "Cormorant Garamond", "Noto Serif Thai", serif`;
    lines.slice(0, maxLines).forEach((line, index) => {
      ctx.fillText(line, boxX + padX, bodyTop + index * lineHeight);
    });
    ctx.restore();
  };

  drawHeader();
  drawSpreadShell();
  for (const item of content.positionedCards) {
    // Keep the implementation canvas-based while mirroring the product's poster--celtic-cross layout structure.
    await drawSingleCard(item);
  }
  drawNarration();

  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.58)';
  ctx.font = `500 ${preset === 'square' ? 24 : 28}px "Space Grotesk", "IBM Plex Sans Thai", sans-serif`;
  ctx.fillText(toSafeText(payload?.poster?.footer, 'meowtarot.com'), width / 2, footerY);
  ctx.restore();

  return {
    cardEntries,
    content,
  };
}


function getFullPosterPositionLabel(position = '', lang = 'en') {
  const labels = FULL_POSITION_LABELS[lang] || FULL_POSITION_LABELS.en;
  return labels[position] || FULL_POSITION_LABELS.en[position] || position;
}

function getDailyStrings(lang = 'en') {
  if (lang === 'th') {
    return {
      title: 'MeowTarot',
      subtitle: 'คำทำนายรายวัน',
      badgePrefix: 'ไพ่ของวันนี้',
      luckyColors: 'สีมงคลวันนี้',
      identitySeparator: '•',
      phasePrefix: 'ช่วงพลัง',
    };
  }
  return {
    title: 'MeowTarot',
    subtitle: 'Daily Reading',
    badgePrefix: "Today's Card",
    luckyColors: 'Lucky Colors',
    identitySeparator: '•',
    phasePrefix: 'Phase',
  };
}

// Render-time date for the poster eyebrow, e.g. "THURSDAY · 28 MAY" (EN) /
// "วันพฤหัสบดี · 28 พฤษภาคม" (TH). The date is display-only social proof of a
// fresh draw — it is NOT collected and never plumbed through the payload, so it
// reflects the moment the poster is built. Single language per locale.
function formatPosterDate(lang = 'en') {
  const locale = normalizePosterLanguage(lang) === 'th' ? 'th-TH' : 'en-US';
  try {
    const parts = new Intl.DateTimeFormat(locale, {
      weekday: 'long', day: 'numeric', month: 'long',
    }).formatToParts(new Date());
    const get = (type) => (parts.find((p) => p.type === type)?.value || '').trim();
    const weekday = get('weekday');
    const day = get('day');
    const month = get('month');
    if (!weekday || !day || !month) return '';
    const label = `${weekday} · ${day} ${month}`;
    return locale === 'en-US' ? label.toUpperCase() : label;
  } catch (error) {
    return '';
  }
}


function resolveDailyOrientation(payload) {
  const payloadOrientation = payload?.orientation || payload?.card?.orientation;
  if (payloadOrientation) return toOrientation(payloadOrientation);
  const firstCardOrientation = Array.isArray(payload?.cards) ? payload.cards[0]?.orientation : null;
  return toOrientation(firstCardOrientation || 'upright');
}

function resolveDailyReadingOrientation(payload, cardEntry) {
  const readingOrientation = payload?.reading?.orientation;
  if (readingOrientation) return toOrientation(readingOrientation);
  if (cardEntry?.orientation) return toOrientation(cardEntry.orientation);
  return toOrientation('upright');
}


async function drawPosterBackground(ctx, width, height, payload) {
  const localBgUrl = resolveLocalPosterFixtureUrl('background');
  const mode = String(payload?.poster?.mode || payload?.mode || '').toLowerCase();
  const preferredBgPath = resolvePosterBackgroundPath({ payload });
  const fullPrimaryBgUrl = toAssetUrl('backgrounds/bg-full-v2.webp');
  const primaryBgUrl = localBgUrl || (mode === 'full' || mode === 'question' ? fullPrimaryBgUrl : toAssetUrl(preferredBgPath));
  const previousBgUrl = localBgUrl || toAssetUrl(preferredBgPath);
  const fallbackBgUrl = localBgUrl || toAssetUrl('backgrounds/bg-000.webp');
  const bgCandidates = [...new Set([primaryBgUrl, previousBgUrl, fallbackBgUrl].filter(Boolean))];
  posterCiLog('bg_url', {
    mode,
    primary: primaryBgUrl,
    previous: previousBgUrl,
    fallback: fallbackBgUrl,
    candidates: bgCandidates,
  });

  const preloadResults = await preloadImages(bgCandidates.map((url) => ({ kind: 'background', url })));
  for (const item of preloadResults) {
    const bgUrl = item?.url;
    try {
      if (item?.status !== 'loaded' || !item?.img) continue;
      const bg = item.img;
      ctx.drawImage(bg, 0, 0, width, height);
      posterCiLog('bg_draw', { executed: true, chosen: bgUrl });
      return bgUrl;
    } catch (error) {
      posterCiLog('img_probe', {
        kind: 'background',
        url: bgUrl,
        ok: false,
        status: null,
        method: 'loadImage',
        error: error?.message || String(error),
      });
      console.warn('[Poster] Failed to load poster background image', bgUrl, error);
    }
  }

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#6f5ca8');
  gradient.addColorStop(0.45, '#d9a7c7');
  gradient.addColorStop(1, '#9fb8e6');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  drawStarfield(ctx, width, height);
  posterCiLog('bg_draw', { executed: false, chosen: null, fallback: 'gradient' });
  return null;
}
function normalizeArchetypeText(text = '') {
  const raw = String(text || '').trim();
  if (!raw) return '';
  return raw.replace(/^I\s+/i, '').replace(/^(ฉัน)\s*/u, '').trim();
}

function isDailySingle(payload) {
  const posterMode = String(payload?.poster?.mode || payload?.mode || '').toLowerCase();
  return posterMode === 'daily';
}

function buildDailyReadingFromCard(card, orientation, lang) {
  if (!card) return null;
  const orient = getOrientationLabel(orientation, lang);
  const meaning = getLocalizedField(card, 'reading_summary_preview', lang)
    || getLocalizedField(card, 'tarot_imply', lang)
    || '';
  return {
    orientation: orient,
    archetype: normalizeArchetypeText(getLocalizedField(card, 'archetype', lang)),
    meaning,
    hook: getLocalizedField(card, 'hook', lang),
    actionPrompt: getLocalizedField(card, 'action_prompt', lang),
    keywords: getLocalizedField(card, 'tarot_imply', lang),
  };
}

function resolveDailyReading(payload, cardEntry, lang) {
  const payloadReading = payload?.reading || {};
  const resolvedOrientation = resolveDailyReadingOrientation(payload, cardEntry);
  const cardReading = buildDailyReadingFromCard(cardEntry?.card, resolvedOrientation, lang) || {};
  const fallbackOrientation = getOrientationLabel(resolvedOrientation || resolveDailyOrientation(payload), lang);
  const localizedHook = payloadReading[`hook_${lang}`] || payloadReading.hook || '';
  const localizedActionPrompt = payloadReading[`action_prompt_${lang}`] || payloadReading.action_prompt || '';
  const actionPrompt = localizedActionPrompt || cardReading.actionPrompt || '';
  const hook = localizedHook || cardReading.hook || '';
  const orientedMeaning = cardReading.meaning || '';
  const readingResult = payloadReading.readingResult || payloadReading.result || payloadReading.heading || payloadReading.summary || '';
  const quote = payloadReading.quote || payloadReading.mainQuote || '';
  const mainQuoteText = readingResult || hook || actionPrompt || quote || orientedMeaning || '';
  const mainQuoteSource = readingResult
    ? 'reading_result'
    : (hook
      ? 'hook'
      : (actionPrompt
        ? 'action_prompt'
        : (quote
          ? 'quote'
          : (orientedMeaning ? 'card_meaning_oriented' : 'none'))));
  return {
    orientation: getOrientationLabel(resolvedOrientation, lang) || cardReading.orientation || fallbackOrientation,
    archetype: normalizeArchetypeText(payloadReading.archetype || cardReading.archetype || ''),
    readingResult,
    mainQuoteText,
    mainQuoteSource,
    implyLineText: '',
    supportingLineSource: 'none',
    summary: payloadReading.summary || '',
  };
}

function resolveLuckyColorDot(color) {
  const raw = String(color?.hex || color?.label || color?.name || color || '').trim();
  if (!raw) return '#d8c7f2';
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) return raw;

  const key = raw.toLowerCase();
  const map = {
    'sky blue': '#9fd8ff',
    cream: '#f7ebc9',
    lavender: '#cbb7ff',
    pink: '#f6b8d0',
    mint: '#bcefdc',
    lilac: '#d6b8ff',
    peach: '#ffc6a8',
  };
  return map[key] || '#d8c7f2';
}



function resolveFullSummaries(payload, cardEntries) {
  const reading = payload?.reading || {};
  const slots = ['past', 'present', 'future'];
  const pickFirst = (candidates = []) => {
    for (const item of candidates) {
      const text = toSafeText(item?.value, '').trim();
      if (text) return { text, sourceTier: item?.tier || 99 };
    }
    return { text: '', sourceTier: 99 };
  };

  return slots.map((slot, idx) => {
    const card = cardEntries[idx]?.card || {};
    return pickFirst([
      { value: card[`reflection_question_${slot}`], tier: 1 },
      { value: card.reflection_question_en, tier: 2 },
      { value: card.action_prompt_en, tier: 3 },
      { value: card.hook_en, tier: 4 },
      { value: card.archetype_en, tier: 5 },
      { value: card[`standalone_${slot}_en`], tier: 6 },
      { value: card[`reading_summary_${slot}_en`], tier: 7 },
      { value: reading[`reading_summary_${slot}_en`], tier: 8 },
      { value: reading[`reading_summary_${slot}`], tier: 9 },
    ]);
  });
}

function resolveSymbolicMetadata(cardEntries) {
  const cards = cardEntries.map((entry) => entry?.card || {});
  const presentCard = cards[1] || {};

  const elementVotes = cards
    .map((card) => toSafeText(card?.element, '').trim())
    .filter(Boolean);
  const voteCounts = elementVotes.reduce((acc, value) => {
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
  const bestVote = Object.values(voteCounts).length ? Math.max(...Object.values(voteCounts)) : 0;
  const topElements = Object.entries(voteCounts)
    .filter(([, count]) => count === bestVote)
    .map(([value]) => value);
  const presentElement = toSafeText(presentCard?.element, '').trim();
  const element = topElements.length > 1 && presentElement
    ? (topElements.includes(presentElement) ? presentElement : topElements[0])
    : (topElements[0] || presentElement);

  const planet = toSafeText(presentCard?.planet, '').trim();

  const numerology = cards.reduce((sum, card) => {
    const raw = toSafeText(card?.numerology_value, '').trim();
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? sum + parsed : sum;
  }, 0);
  const numerologyValue = Number.isFinite(numerology) ? String(Math.round(numerology)) : '';

  return {
    element,
    planet,
    numerology: numerologyValue,
  };
}


// Energy-balance axis names — inline (lowercase) for the interpretation sentence
// and as display labels for the radar axes. EN + TH (hard rule #2 parity).
const ENERGY_AXIS_WORDS = {
  en: { action: 'action', emotion: 'emotion', thinking: 'thinking', stability: 'stability' },
  th: { action: 'การลงมือทำ', emotion: 'อารมณ์', thinking: 'ความคิด', stability: 'ความมั่นคง' },
};
const ENERGY_AXIS_LABELS = {
  en: { action: 'Action', emotion: 'Emotion', thinking: 'Thinking', stability: 'Stability' },
  th: { action: 'การลงมือทำ', emotion: 'อารมณ์', thinking: 'ความคิด', stability: 'ความมั่นคง' },
};

function resolveEnergyBalance(energyData = {}, lang = 'en') {
  const toScore = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(100, Math.round(numeric)));
  };

  const scores = {
    action: toScore(energyData.action),
    emotion: toScore(energyData.emotion),
    thinking: toScore(energyData.thinking),
    stability: toScore(energyData.stability),
  };

  const ordered = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const axisWords = ENERGY_AXIS_WORDS[lang] || ENERGY_AXIS_WORDS.en;
  const dominant = axisWords[ordered[0]?.[0] || 'action'];
  const support = axisWords[ordered[1]?.[0] || 'stability'];

  const interpretation = lang === 'th'
    ? [
        `ตอนนี้พลังงานของคุณถูกนำด้วย${dominant} โดยมี${support}เป็นแรงหนุนที่ชัดเจน`,
        'ประคองจังหวะนี้ไว้ด้วยการใคร่ครวญอย่างอ่อนโยน เพื่อให้ใจมั่นคงและชัดเจน',
      ]
    : [
        `Your energy is currently led by ${dominant}, with strong support from ${support}.`,
        'Keep this momentum balanced with gentle reflection to stay grounded and clear.',
      ];

  return { scores, interpretation };
}

function computeQuestionEnergyData(cardEntries = []) {
  const totals = { action: 0, emotion: 0, thinking: 0, stability: 0 };
  let withScores = 0;

  cardEntries.forEach((entry) => {
    const scores = entry?.card?.energy_scores;
    if (!scores || typeof scores !== 'object') return;
    withScores += 1;
    totals.action += Number(scores.fire) || 0;
    totals.emotion += Number(scores.water) || 0;
    totals.thinking += Number(scores.air) || 0;
    totals.stability += Number(scores.earth) || 0;
  });

  if (!withScores) return null;
  return {
    action: totals.action / withScores,
    emotion: totals.emotion / withScores,
    thinking: totals.thinking / withScores,
    stability: totals.stability / withScores,
  };
}

function resolveLuckyInfo(payload, cardEntry) {
  const lucky = payload?.lucky || {};
  const colors = Array.isArray(lucky.colors) && lucky.colors.length
    ? lucky.colors
    : Array.isArray(cardEntry?.card?.color_palette)
      ? cardEntry.card.color_palette.map((hex) => ({ hex }))
      : [];
  return {
    colors: colors.filter(Boolean).slice(0, 3),
    element: lucky.element || cardEntry?.card?.element || '',
    planet: lucky.planet || cardEntry?.card?.planet || '',
    number: lucky.number ?? cardEntry?.card?.numerology_value,
  };
}

// BUG-020: if the active deck is incomplete (e.g. boba-oracle set anonymously),
// its card face 404s and the poster would fall back to a card back — gutting the
// visual-proof share (hard rule #8). Derive the default-deck (moonmallow) face by
// swapping the /assets/<activeDeck>/ path segment (both decks share identical
// nn-slug-orientation.webp filenames). asset-resolver.js stays untouched (rule #4).
function toDefaultDeckFaceUrl(url) {
  const activeDeck = getActiveDeckId();
  if (!url || activeDeck === DEFAULT_DECK_ID) return null;
  const swapped = url.replace(`/assets/${activeDeck}/`, `/assets/${DEFAULT_DECK_ID}/`);
  return swapped !== url ? swapped : null;
}

// Quick Pull (single-card Ask-a-Question) poster — a Daily-style ceremonial
// layout: topic headline → big card with warm aura → Answer badge + card name →
// gold ornament → the topic reading underneath. NO energy radar (that is a
// 3-card-spread feature). Background is already painted by drawPosterBackground.
async function renderQuickPullPoster(ctx, canvas, perf, opts) {
  const { width, height, payload, lang, card = {}, cardEntry = null, topic, topicTitle, eyebrow, answerLabel } = opts;
  const safeMargin = 72;
  const displayFont = '"Cormorant Garamond", "Noto Serif Thai", serif';
  const eyebrowFont = '"Space Grotesk", "IBM Plex Sans Thai", sans-serif';
  // Ivory-on-purple — matches the existing question-poster background (not the
  // orientation-tinted daily palette, whose text sits over the card itself).
  const palette = { primary: '#fff7de', secondary: 'rgba(252,245,231,0.95)', gold: '#ffe1a8', goldSoft: 'rgba(255,225,165,0.55)', reading: '#3d1a5c' };

  // Card identity / orientation (Quick Pull card is the answer card).
  const sourceCard = cardEntry?.card || card || {};
  const orientation = toOrientation(cardEntry?.orientation || card?.orientation || sourceCard?.orientation || 'upright');
  const baseId = baseCardId(sourceCard?.id || sourceCard?.card_id || sourceCard?.image_id || card?.id || '');
  const orientedId = baseId ? `${baseId}-${orientation}` : '';
  const cardName = toSafeText(
    resolveLocalizedCardName(sourceCard, '', 'en') || card?.title || card?.name || '',
    '',
  ).trim();
  const orientationLabel = getOrientationLabel(orientation, lang);
  const badgeText = [answerLabel, orientationLabel].filter(Boolean).join(' · ');

  // Reading text = the topic-aware "present"/answer summary for this card. Reuse
  // the question summary resolver, placing the card in the present slot.
  const summaries = resolveQuestionPosterSummaries(
    { ...payload, topic, cards: [null, card, null] },
    [null, cardEntry, null],
  );
  const taglineText = toSafeText(summaries[1] || summaries[0] || summaries[2] || '', '').trim();

  // ---- Header: topic headline (current locale ONLY) + gold rule + eyebrow ----
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  if (eyebrow) {
    ctx.save();
    ctx.fillStyle = palette.gold;
    ctx.font = `600 27px ${eyebrowFont}`;
    drawTrackingText(ctx, eyebrow, width / 2, 100, 0.18 * 27);
    ctx.restore();
  }
  // Topic headline — large, auto-fit to one line so longer topics never overflow.
  ctx.save();
  ctx.fillStyle = palette.primary;
  ctx.shadowColor = 'rgba(11, 13, 26, 0.5)';
  ctx.shadowBlur = 18;
  const topicText = toSafeText(topicTitle, '').trim();
  let topicSize = 112;
  while (topicSize > 72) {
    ctx.font = `italic 600 ${topicSize}px ${displayFont}`;
    if (ctx.measureText(topicText).width <= width - safeMargin * 2) break;
    topicSize -= 4;
  }
  ctx.font = `italic 600 ${topicSize}px ${displayFont}`;
  ctx.fillText(topicText, width / 2, 208);
  ctx.restore();
  ctx.save();
  ctx.fillStyle = palette.goldSoft;
  ctx.fillRect(width / 2 - 36, 240, 72, 3);
  ctx.restore();

  // ---- Big card with warm aura (Daily treatment) ----
  const cardTop = 286;
  const maxCardWidth = Math.min(520, width - safeMargin * 2);
  const maxCardHeight = 700;
  let cardImg = null;
  try {
    // Reversed cards SOURCE the upright art and are rotated 180° at draw time
    // (see the `orientation === 'reversed'` rotate below). Coerce sourcing to
    // 'upright' so we never request a *-reversed.webp; `orientation` keeps the
    // real value for the orientation LABEL.
    const imageOrientation = posterImageOrientation(orientation);
    const uprightOrientedId = baseId ? `${baseId}-${imageOrientation}` : '';
    const cardIdentity = uprightOrientedId
      ? { ...sourceCard, id: uprightOrientedId, card_id: uprightOrientedId, image_id: uprightOrientedId }
      : sourceCard;
    const { uprightUrl, reversedUrl, backUrl } = buildCardImageUrls(cardIdentity, imageOrientation);
    const resolvedPrimary = uprightOrientedId ? await resolveCardImageUrl(cardIdentity, imageOrientation) : '';
    const { primary, fallbackChain } = resolvePosterCardImageSources(
      { ...(cardEntry || {}), ...card, orientation: imageOrientation, card: sourceCard },
      { resolvedPrimary, uprightUrl, reversedUrl, backUrl, lang },
    );
    cardImg = await loadPosterCardImageWithTimeout(primary, fallbackChain);
  } catch (error) {
    console.warn('[Poster] quick-pull card image failed', { reason: error?.message || String(error) });
  }
  const imgW = cardImg?.naturalWidth || maxCardWidth;
  const imgH = cardImg?.naturalHeight || Math.round(maxCardWidth * 1.5);
  const scale = Math.min(maxCardWidth / imgW, maxCardHeight / imgH);
  const cardW = Math.max(0, imgW * scale);
  const cardH = Math.max(0, imgH * scale);
  const cardX = (width - cardW) / 2;
  const cardYPos = cardTop;

  // warm radial aura behind the card
  const cx = cardX + cardW / 2;
  const cy = cardYPos + cardH / 2;
  const auraR = Math.max(cardW, cardH) / 2 + 110;
  ctx.save();
  const aura = ctx.createRadialGradient(cx, cy, auraR * 0.2, cx, cy, auraR);
  aura.addColorStop(0, 'rgba(255, 225, 180, 0.5)');
  aura.addColorStop(0.55, 'rgba(255, 223, 178, 0.2)');
  aura.addColorStop(1, 'rgba(255, 223, 178, 0)');
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.ellipse(cx, cy, auraR, auraR, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (cardW && cardH) {
    const cardRadius = 28;
    if (cardImg) {
      ctx.save();
      ctx.shadowColor = 'rgba(42, 17, 66, 0.4)';
      ctx.shadowBlur = 56;
      ctx.shadowOffsetY = 28;
      drawRoundedRect(ctx, cardX, cardYPos, cardW, cardH, cardRadius);
      ctx.fillStyle = '#2a1142';
      ctx.fill();
      ctx.restore();
      ctx.save();
      drawRoundedRect(ctx, cardX, cardYPos, cardW, cardH, cardRadius);
      ctx.clip();
      if (posterShouldRotateReversed(orientation)) {
        // Reversed = upright art rotated 180° about the card center (mirrors the
        // celtic poster's reversed rotation). Clip rect is unrotated, image is.
        ctx.translate(cardX + cardW / 2, cardYPos + cardH / 2);
        ctx.rotate(Math.PI);
        ctx.drawImage(cardImg, -cardW / 2, -cardH / 2, cardW, cardH);
      } else {
        ctx.drawImage(cardImg, cardX, cardYPos, cardW, cardH);
      }
      ctx.restore();
    } else {
      drawFallbackCardArt(ctx, cardX, cardYPos, cardW, cardH, { radius: cardRadius, label: 'MEOW TAROT' });
    }
  }

  // ---- Answer badge → card name → gold ornament → reading tagline ----
  const cardBottomY = cardYPos + cardH;
  ctx.textAlign = 'center';
  if (badgeText) {
    ctx.save();
    ctx.fillStyle = palette.gold;
    ctx.font = `700 27px ${eyebrowFont}`;
    ctx.shadowColor = 'rgba(11, 13, 26, 0.45)';
    ctx.shadowBlur = 12;
    drawTrackingText(ctx, badgeText, width / 2, cardBottomY + 70, 0.28 * 27);
    ctx.restore();
  }

  let nameBottomY = cardBottomY + 152;
  if (cardName) {
    const maxWidth = width - safeMargin * 2;
    let fontSize = 96;
    while (fontSize > 56) {
      ctx.font = `italic 500 ${fontSize}px ${displayFont}`;
      if (ctx.measureText(cardName).width <= maxWidth) break;
      fontSize -= 4;
    }
    ctx.font = `italic 500 ${fontSize}px ${displayFont}`;
    const lines = wrapTextLines(ctx, cardName, maxWidth, 2);
    const lineHeight = Math.round(fontSize * 1.02);
    // Highlight the card name with a soft drop-shadow so it pops off the pale BG
    // (same treatment as the topic headline).
    ctx.save();
    ctx.fillStyle = palette.primary;
    ctx.shadowColor = 'rgba(11, 13, 26, 0.55)';
    ctx.shadowBlur = 20;
    lines.forEach((line, i) => ctx.fillText(line, width / 2, nameBottomY + i * lineHeight));
    ctx.restore();
    nameBottomY = nameBottomY + (lines.length - 1) * lineHeight + Math.round(fontSize * 0.26);
  }

  // gold rule + diamond ornament
  const ornamentY = nameBottomY + 46;
  ctx.save();
  ctx.fillStyle = palette.goldSoft;
  ctx.fillRect(width / 2 - 66, ornamentY - 1.5, 133, 3);
  ctx.fillStyle = palette.gold;
  ctx.translate(width / 2, ornamentY);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-8, -8, 16, 16);
  ctx.restore();

  if (taglineText) {
    const footerMargin = 96;
    const taglineTop = ornamentY + 56;
    const taglineWidth = width - 2 * 110;
    const taglineMaxHeight = Math.max(0, (height - footerMargin) - taglineTop);
    const fit = fitDailyQuoteText(ctx, taglineText, taglineWidth, taglineMaxHeight, {
      fontFamily: displayFont,
      defaultFontSize: 58,
      minimumFontSize: 42,
      addQuotes: true,
    });
    ctx.save();
    // EXPLICIT centring (vs textAlign='center', which mis-centres Thai on iOS Safari).
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    // Deep plum for contrast against the pale lower background (ivory was too faint).
    ctx.fillStyle = palette.reading;
    ctx.font = `italic 500 ${fit.fontSize}px ${displayFont}`;
    const firstBaseline = taglineTop + fit.ascent;
    fit.lines.forEach((line, i) => {
      const lw = ctx.measureText(line).width;
      ctx.fillText(line, width / 2 - lw / 2, firstBaseline + i * fit.lineHeight);
    });
    ctx.restore();
  }

  // footer
  ctx.fillStyle = '#aab0c9';
  ctx.font = '500 28px "Space Grotesk", "IBM Plex Sans Thai", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(toSafeText(payload?.poster?.footer, 'meowtarot.com'), width / 2, height - 56);

  const exportStart = performance.now();
  perf.captureCount += 1;
  const blob = await exportPoster(canvas);
  perf.captureMs = exportStart - perf.startedAt - perf.preloadMs;
  perf.exportMs = performance.now() - exportStart;
  if (!blob) throw new Error('Failed to build poster blob');
  return { blob, width, height, perf };
}

export async function buildPoster(rawPayload, { preset = 'story' } = {}) {
  const payload = normalizePayload(rawPayload) || normalizePayload({});
  if (Array.isArray(payload?.cards) && payload.cards.length) {
    console.log('[Poster][CI] card payload summary',
      payload.cards.map((c) => ({
        id: c?.id,
        orientation: c?.orientation,
        hasImage: !!c?.image,
        hasArchetype: !!c?.archetype,
        hasImply: !!c?.imply,
      })));
  }
  const perf = {
    startedAt: performance.now(),
    preloadMs: 0,
    captureMs: 0,
    exportMs: 0,
    captureCount: 0,
  };
  let cardY = 0;
  let cardHeight = 0;
  let cardWidth = 0;

  const preloadStart = performance.now();
  await ensureTarotData(payload?.lang);
  posterCiLog('payload_ok', {
    mode: payload?.mode,
    preset,
    cards: Array.isArray(payload?.cards)
      ? payload.cards.map((card) => card?.id || card?.cardId || card?.card_id).filter(Boolean)
      : [],
  });
  const missingPosterFields = ['title', 'subtitle', 'footer'].filter((key) => !toSafeText(payload?.poster?.[key]).trim());
  missingPosterFields.forEach((field) => {
    console.warn(`[Poster] missing poster.${field}`);
  });
  if (document.fonts?.load) {
    // Webfonts only fetch once referenced, so request the exact faces the daily
    // poster draws (incl. italic-serif Cormorant) before relying on fonts.ready.
    const faceSpecs = [
      '700 72px "Poppins"',
      '500 38px "Space Grotesk"',
      'italic 500 58px "Prata"',
      'italic 500 132px "Cormorant Garamond"',
      '500 60px "Cormorant Garamond"',
      'italic 500 56px "Noto Serif Thai"',
      // Thai sans fallback for every "Space Grotesk" stack (header/labels/radar) —
      // without this, Thai combining marks render as tofu on the canvas.
      '500 32px "IBM Plex Sans Thai"',
      '600 32px "IBM Plex Sans Thai"',
      '700 32px "IBM Plex Sans Thai"',
    ];
    try {
      await Promise.all(faceSpecs.map((spec) => document.fonts.load(spec)));
    } catch (error) {
      posterDebugLog('warn', '[Poster] font preload failed', error?.message || String(error));
    }
  }
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }
  perf.preloadMs = performance.now() - preloadStart;
  posterDebugLog('log', '[Poster] Data loaded', { preloadMs: Number(perf.preloadMs.toFixed(1)) });

  const { width, height } = PRESETS[preset] || PRESETS.story;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const fontFamilies = [
    '"Poppins", sans-serif',
    '"Space Grotesk", "IBM Plex Sans Thai", sans-serif',
    '"Prata", serif',
    '"Cormorant Garamond", serif',
    '"Noto Serif Thai", serif',
  ];
  fontFamilies.forEach((family) => {
    ctx.font = `16px ${family}`;
    ctx.fillText(' ', 0, 0);
  });

  const backgroundUrl = await drawPosterBackground(ctx, width, height, payload);
  posterDebugLog('log', '[Poster] Background resolved', backgroundUrl || 'fallback-gradient');

  if (isCelticCrossPosterPayload(payload)) {
    await renderCelticCrossPoster(ctx, payload, preset, width, height);

    const exportStart = performance.now();
    perf.captureCount += 1;
    const blob = await exportPoster(canvas);
    perf.captureMs = exportStart - perf.startedAt - perf.preloadMs;
    perf.exportMs = performance.now() - exportStart;
    if (!blob) throw new Error('Failed to build poster blob');
    return { blob, width, height, perf };
  }

  if (String(payload?.mode || '').toLowerCase() === 'full' && preset === 'story') {
    const lang = payload?.lang || 'en';
    const cardEntries = (await buildCardEntries(payload)).slice(0, 10);
    const cardW = 150;
    const cardH = Math.round(cardW * 1.5);
    const crossCenterX = 350;
    const crossCenterY = 760;
    const crossOffsetX = 190;
    const crossOffsetY = 290;
    const staffX = 835;
    const staffStartY = 360;
    const staffGapY = 265;
    const layoutByPosition = {
      above: { x: crossCenterX, y: crossCenterY - crossOffsetY, labelX: crossCenterX, labelY: crossCenterY - crossOffsetY + cardH + 28 },
      below: { x: crossCenterX, y: crossCenterY + crossOffsetY, labelX: crossCenterX, labelY: crossCenterY + crossOffsetY + cardH + 28 },
      present: { x: crossCenterX, y: crossCenterY, labelX: crossCenterX, labelY: crossCenterY + cardH + 28 },
      challenge: { x: crossCenterX, y: crossCenterY, rotated: true, labelX: crossCenterX + cardH / 2 + 56, labelY: crossCenterY + 8, labelAlign: 'left', orientationX: crossCenterX + cardH / 2 + 56, orientationY: crossCenterY + 34, orientationAlign: 'left' },
      future: { x: crossCenterX + crossOffsetX, y: crossCenterY, labelX: crossCenterX + crossOffsetX, labelY: crossCenterY + cardH + 28 },
      past: { x: crossCenterX - crossOffsetX, y: crossCenterY, labelX: crossCenterX - crossOffsetX, labelY: crossCenterY + cardH + 28 },
      outcome: { x: staffX, y: staffStartY, labelX: staffX, labelY: staffStartY + cardH + 28 },
      hopes: { x: staffX, y: staffStartY + staffGapY, labelX: staffX, labelY: staffStartY + staffGapY + cardH + 28 },
      external: { x: staffX, y: staffStartY + staffGapY * 2, labelX: staffX, labelY: staffStartY + staffGapY * 2 + cardH + 28 },
      advice: { x: staffX, y: staffStartY + staffGapY * 3, labelX: staffX, labelY: staffStartY + staffGapY * 3 + cardH + 28 },
    };

    const drawCardShadow = (x, y, rotated = false) => {
      ctx.save();
      ctx.translate(x, y);
      if (rotated) ctx.rotate(Math.PI / 2);
      ctx.shadowColor = 'rgba(0, 0, 0, 0.38)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 8;
      ctx.fillStyle = '#0f1429';
      ctx.fillRect(-cardW / 2, -cardH / 2, cardW, cardH);
      ctx.restore();
    };

    const drawCardImage = (img, x, y, rotated = false, reversed = false) => {
      ctx.save();
      ctx.translate(x, y);
      if (rotated) ctx.rotate(Math.PI / 2);
      // Reversed = upright art rotated an extra 180° about the card center
      // (composes with the challenge card's 90° rotation when both apply).
      if (reversed) ctx.rotate(Math.PI);
      ctx.drawImage(img, -cardW / 2, -cardH / 2, cardW, cardH);
      ctx.restore();
    };

    const drawCardLabelBlock = ({ label, orientation, x, y, align = 'center', orientationX = x, orientationY = y + 38, orientationAlign = align }) => {
      ctx.save();
      ctx.fillStyle = '#f7f4ee';
      ctx.font = '600 18px "Space Grotesk", "IBM Plex Sans Thai", sans-serif';
      ctx.textAlign = align;
      wrapText(ctx, label, x, y, align === 'center' ? cardW + 24 : 170, 22, 2);
      ctx.fillStyle = '#b8bfd6';
      ctx.font = '500 15px "Space Grotesk", "IBM Plex Sans Thai", sans-serif';
      ctx.textAlign = orientationAlign;
      wrapText(ctx, orientation, orientationX, orientationY, orientationAlign === 'center' ? cardW + 18 : 170, 18, 1);
      ctx.restore();
    };

    ctx.textAlign = 'center';
    ctx.fillStyle = '#c9933a';
    ctx.font = 'italic 700 62px "Cormorant Garamond", "Noto Serif Thai", serif';
    ctx.shadowColor = 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = 14;
    ctx.fillText('MeowTarot', width / 2, 100);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#efe4c2';
    ctx.font = '500 24px "Space Grotesk", "IBM Plex Sans Thai", sans-serif';
    drawTrackingText(ctx, toSafeText(payload?.poster?.title, 'Celtic Cross Reading'), width / 2, 142, 0.8);
    ctx.fillStyle = 'rgba(245, 241, 232, 0.92)';
    ctx.font = '500 20px "Space Grotesk", "IBM Plex Sans Thai", sans-serif';
    drawTrackingText(ctx, toSafeText(payload?.poster?.subtitle, ''), width / 2, 178, 0.35);

    for (let i = 0; i < cardEntries.length; i += 1) {
      const entry = cardEntries[i] || null;
      const payloadCard = payload?.cards?.[i] || {};
      const fallbackBaseId = baseCardId(payloadCard?.id || payloadCard?.card_id || payloadCard?.image_id || `slot-${i + 1}`);
      const sourceCard = entry?.card || payloadCard;
      const baseId = baseCardId(sourceCard?.id || sourceCard?.card_id || sourceCard?.image_id || fallbackBaseId);
      const orientation = toOrientation(entry?.orientation || payloadCard?.orientation || sourceCard?.orientation || 'upright');
      // Reversed cards SOURCE upright art and rotate 180° at draw time. Coerce
      // sourcing to upright; `orientation` stays real for the label + rotation.
      const imageOrientation = posterImageOrientation(orientation);
      const orientedId = `${baseId}-${imageOrientation}`;
      const cardIdentity = { ...sourceCard, id: orientedId, card_id: orientedId, image_id: orientedId };
      const { uprightUrl, reversedUrl, backUrl } = buildCardImageUrls(cardIdentity, imageOrientation);
      const resolvedPrimary = await resolveCardImageUrl(cardIdentity, imageOrientation);
      const { primary: selectedUrl, fallbackChain } = resolvePosterCardImageSources({ ...entry, ...payloadCard, orientation: imageOrientation, card: sourceCard }, {
        resolvedPrimary,
        uprightUrl,
        reversedUrl,
        backUrl,
        lang,
      });

      const position = payloadCard?.position || ['present', 'challenge', 'above', 'past', 'below', 'future', 'advice', 'external', 'hopes', 'outcome'][i] || 'present';
      const layout = layoutByPosition[position] || layoutByPosition.present;

      drawCardShadow(layout.x, layout.y, Boolean(layout.rotated));

      try {
        const thumb = toPosterThumb200(selectedUrl);
        const img = await loadPosterCardImageWithTimeout(thumb || selectedUrl, thumb ? [selectedUrl, ...fallbackChain] : fallbackChain);
        drawCardImage(img, layout.x, layout.y, Boolean(layout.rotated), posterShouldRotateReversed(orientation));
      } catch (error) {
        console.warn('[Poster] full card image failed', { url: resolvedPrimary || reversedUrl || uprightUrl || backUrl, reason: error?.message || String(error) });
        drawFallbackCardArt(ctx, layout.x - cardW / 2, layout.y - cardH / 2, cardW, cardH, { radius: 18, label: 'MEOW TAROT' });
      }

      drawCardLabelBlock({
        label: getFullPosterPositionLabel(position, lang),
        orientation: getOrientationLabel(orientation, lang),
        x: layout.labelX,
        y: layout.labelY,
        align: layout.labelAlign || 'center',
        orientationX: layout.orientationX,
        orientationY: layout.orientationY,
        orientationAlign: layout.orientationAlign || layout.labelAlign || 'center',
      });
    }

    ctx.fillStyle = '#aab0c9';
    ctx.font = '500 28px "Space Grotesk", "IBM Plex Sans Thai", sans-serif';
    const footerText = toSafeText(payload?.poster?.footer, 'meowtarot.com');
    ctx.textAlign = 'center';
    ctx.fillText(footerText, width / 2, height - 90);

    const exportStart = performance.now();
    perf.captureCount += 1;
    const blob = await exportPoster(canvas);
    perf.captureMs = exportStart - perf.startedAt - perf.preloadMs;
    perf.exportMs = performance.now() - exportStart;
    if (!blob) throw new Error('Failed to build poster blob');
    return { blob, width, height, perf };
  }

  if (String(payload?.mode || '').toLowerCase() === 'question' && preset === 'story') {
    const orderedQuestionCards = orderQuestionCards(Array.isArray(payload?.cards) ? payload.cards : []);
    const questionPayload = { ...payload, cards: orderedQuestionCards };
    const cardEntries = (await buildCardEntries(questionPayload)).slice(0, 3);
    const questionStrings = getQuestionPosterStrings(questionPayload);
    const questionSummaries = resolveQuestionPosterSummaries(questionPayload, cardEntries);
    const questionCardCount = orderedQuestionCards.length === 1 ? 1 : 3;
    const isSinglePull = questionCardCount === 1;
    const lang = normalizePosterLanguage(payload?.lang || 'en');
    // Quick Pull (single card) is an "Answer", not a timeline position.
    const answerLabel = lang === 'th' ? 'คำตอบ' : 'Answer';

    // Quick Pull → Daily-style single-card poster (big card + reading underneath,
    // no energy radar). The 3-card Story spread keeps its own layout below
    // (hard rule #6 — scoped by mode).
    if (isSinglePull) {
      return await renderQuickPullPoster(ctx, canvas, perf, {
        width,
        height,
        payload,
        lang,
        topic: String(payload?.topic || '').toLowerCase(),
        card: orderedQuestionCards[0] || {},
        cardEntry: cardEntries[0] || null,
        topicTitle: questionStrings.title,
        eyebrow: questionStrings.eyebrow,
        answerLabel,
      });
    }

    // 3-card Story spread only below — the energy radar is a 3-card feature.
    const energySource = payload?.energyData || computeQuestionEnergyData(cardEntries) || {};
    const energyBalance = resolveEnergyBalance(energySource, lang);
    const slots = questionStrings.positions;
    const summaries = questionSummaries;
    const cardGap = 20;
    const cardW = 260;
    const cardH = Math.round(cardW * 1.5);
    const totalW = cardW * questionCardCount + cardGap * Math.max(0, questionCardCount - 1);
    const startX = (width - totalW) / 2;
    const cardY = 378;
    const textPanelX = 74;
    const textPanelY = 48;
    const textPanelW = width - textPanelX * 2;
    const textPanelH = 236;

    ctx.textAlign = 'center';
    ctx.save();
    ctx.fillStyle = 'rgba(61, 26, 92, 0.42)';
    drawRoundedRect(ctx, textPanelX, textPanelY, textPanelW, textPanelH, 44);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = 'rgba(245, 238, 222, 0.88)';
    ctx.font = '600 24px "Space Grotesk", "IBM Plex Sans Thai", sans-serif';
    drawTrackingText(ctx, questionStrings.eyebrow, width / 2, 100, 1.5);

    ctx.fillStyle = '#fff7de';
    ctx.font = '700 76px "Poppins", "Space Grotesk", "IBM Plex Sans Thai", sans-serif';
    ctx.shadowColor = 'rgba(11, 13, 26, 0.55)';
    ctx.shadowBlur = 20;
    ctx.fillText(questionStrings.title, width / 2, 166);
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(252, 245, 231, 0.95)';
    ctx.font = '600 31px "Space Grotesk", "IBM Plex Sans Thai", sans-serif';
    drawTrackingText(ctx, questionStrings.subtitle, width / 2, 212, 0.2);

    ctx.fillStyle = 'rgba(235, 228, 214, 0.9)';
    ctx.font = '500 22px "Space Grotesk", "IBM Plex Sans Thai", sans-serif';
    drawTrackingText(ctx, questionStrings.tertiary, width / 2, 248, 0.8);

    for (let i = 0; i < questionCardCount; i += 1) {
      const entry = cardEntries[i] || null;
      const payloadCard = orderedQuestionCards[i] || {};
      const fallbackBaseId = baseCardId(payloadCard?.id || payloadCard?.card_id || payloadCard?.image_id || `slot-${i + 1}`);
      const sourceCard = entry?.card || payloadCard;
      const baseId = baseCardId(sourceCard?.id || sourceCard?.card_id || sourceCard?.image_id || fallbackBaseId);
      const orientation = toOrientation(entry?.orientation || payloadCard?.orientation || sourceCard?.orientation || 'upright');
      // Reversed cards SOURCE upright art and rotate 180° at draw time. Coerce
      // sourcing to upright; `orientation` stays real for label + rotation.
      const imageOrientation = posterImageOrientation(orientation);
      const orientedId = `${baseId}-${imageOrientation}`;
      const cardIdentity = { ...sourceCard, id: orientedId, card_id: orientedId, image_id: orientedId };
      const { uprightUrl, reversedUrl, backUrl } = buildCardImageUrls(cardIdentity, imageOrientation);
      const resolvedPrimary = await resolveCardImageUrl(cardIdentity, imageOrientation);

      const x = startX + i * (cardW + cardGap);
      const y = cardY;

      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 20;
      ctx.shadowOffsetY = 8;
      ctx.fillStyle = '#0f1429';
      ctx.fillRect(x, y, cardW, cardH);
      ctx.restore();

      try {
        const { primary: selectedUrl, fallbackChain } = resolvePosterCardImageSources({ ...entry, ...payloadCard, orientation: imageOrientation, card: sourceCard }, {
          resolvedPrimary,
          uprightUrl,
          reversedUrl,
          backUrl,
          lang: payload?.lang || 'en',
        });
        const thumb = toPosterThumb200(selectedUrl);
        const img = await loadPosterCardImageWithTimeout(thumb || selectedUrl, thumb ? [selectedUrl, ...fallbackChain] : fallbackChain);
        if (posterShouldRotateReversed(orientation)) {
          // Reversed = upright art rotated 180° about the card center.
          ctx.save();
          ctx.translate(x + cardW / 2, y + cardH / 2);
          ctx.rotate(Math.PI);
          ctx.drawImage(img, -cardW / 2, -cardH / 2, cardW, cardH);
          ctx.restore();
        } else {
          ctx.drawImage(img, x, y, cardW, cardH);
        }
      } catch (error) {
        console.warn('[Poster] question card image failed', { url: resolvedPrimary || reversedUrl || uprightUrl || backUrl, reason: error?.message || String(error) });
        drawFallbackCardArt(ctx, x, y, cardW, cardH, { radius: 16, label: 'MEOW TAROT' });
      }

      const labelPillW = Math.min(228, cardW - 24);
      const labelPillH = 42;
      const labelPillX = x + (cardW - labelPillW) / 2;
      const labelPillY = y + cardH + 14;
      ctx.save();
      ctx.fillStyle = 'rgba(61, 26, 92, 0.62)';
      drawRoundedRect(ctx, labelPillX, labelPillY, labelPillW, labelPillH, 22);
      ctx.fill();
      ctx.restore();

      const positionLabel = slots[i] || questionStrings.positions[1];
      ctx.fillStyle = '#fff9eb';
      ctx.font = '700 22px "Space Grotesk", "IBM Plex Sans Thai", sans-serif';
      ctx.fillText(positionLabel, x + cardW / 2, labelPillY + 29);

      const summaryText = toSafeText(summaries[i], '').trim();
      if (summaryText) {
        const summaryY = labelPillY + labelPillH + 16;
        const summaryH = 160;
        ctx.save();
        ctx.fillStyle = 'rgba(61, 26, 92, 0.52)';
        drawRoundedRect(ctx, x + 4, summaryY, cardW - 8, summaryH, 24);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = 'rgba(255, 248, 235, 0.96)';
        ctx.font = '500 18px "Space Grotesk", "IBM Plex Sans Thai", sans-serif';
        wrapText(ctx, summaryText, x + cardW / 2, summaryY + 36, cardW - 40, 24, 5);
      }
    }

    const graphPanelX = 96;
    const graphPanelY = 1154;
    const graphPanelW = width - graphPanelX * 2;
    const graphPanelH = 520;
    const graphCenterX = width / 2;
    const graphCenterY = graphPanelY + 214;
    const graphRadius = 124;
    const axisLabels = ENERGY_AXIS_LABELS[lang] || ENERGY_AXIS_LABELS.en;
    const axisOrder = [
      { key: 'action', label: axisLabels.action, angle: -Math.PI / 2 },
      { key: 'emotion', label: axisLabels.emotion, angle: 0 },
      { key: 'thinking', label: axisLabels.thinking, angle: Math.PI / 2 },
      { key: 'stability', label: axisLabels.stability, angle: Math.PI },
    ];
    const toPoint = (angle, radius) => ({
      x: graphCenterX + Math.cos(angle) * radius,
      y: graphCenterY + Math.sin(angle) * radius,
    });
    const dataPoints = axisOrder.map(({ key, angle }) => {
      const ratio = Math.max(0, Math.min(1, (Number(energyBalance?.scores?.[key]) || 0) / 100));
      return toPoint(angle, graphRadius * ratio);
    });

    ctx.save();
    ctx.fillStyle = 'rgba(15, 18, 38, 0.62)';
    drawRoundedRect(ctx, graphPanelX, graphPanelY, graphPanelW, graphPanelH, 40);
    ctx.fill();
    ctx.restore();

    for (let ring = 1; ring <= 4; ring += 1) {
      const ringRadius = (graphRadius / 4) * ring;
      ctx.beginPath();
      axisOrder.forEach(({ angle }, idx) => {
        const point = toPoint(angle, ringRadius);
        if (idx === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.closePath();
      ctx.strokeStyle = 'rgba(255, 247, 229, 0.14)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }

    axisOrder.forEach(({ label, angle }) => {
      const edge = toPoint(angle, graphRadius);
      ctx.beginPath();
      ctx.moveTo(graphCenterX, graphCenterY);
      ctx.lineTo(edge.x, edge.y);
      ctx.strokeStyle = 'rgba(255, 247, 229, 0.2)';
      ctx.lineWidth = 1.1;
      ctx.stroke();

      const labelPoint = toPoint(angle, graphRadius + 44);
      ctx.fillStyle = 'rgba(252, 246, 236, 0.92)';
      ctx.font = '500 22px "Space Grotesk", "IBM Plex Sans Thai", sans-serif';
      if (Math.cos(angle) > 0.4) ctx.textAlign = 'left';
      else if (Math.cos(angle) < -0.4) ctx.textAlign = 'right';
      else ctx.textAlign = 'center';
      const axisLabelOffsetX = ctx.textAlign === 'left' ? 10 : ctx.textAlign === 'right' ? -10 : 0;
      const axisLabelOffsetY = Math.sin(angle) > 0.4 ? 12 : Math.sin(angle) < -0.4 ? -8 : 8;
      ctx.fillText(label, labelPoint.x + axisLabelOffsetX, labelPoint.y + axisLabelOffsetY);
      ctx.textAlign = 'center';
    });

    ctx.beginPath();
    dataPoints.forEach((point, idx) => {
      if (idx === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(235, 192, 255, 0.42)';
    ctx.strokeStyle = 'rgba(255, 228, 165, 0.82)';
    ctx.lineWidth = 3;
    ctx.fill();
    ctx.stroke();

    dataPoints.forEach((point) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffefc7';
      ctx.fill();
    });

    ctx.fillStyle = 'rgba(252, 246, 236, 0.94)';
    ctx.font = '500 24px "Space Grotesk", "IBM Plex Sans Thai", sans-serif';
    wrapText(
      ctx,
      energyBalance.interpretation.join(' '),
      graphCenterX,
      graphPanelY + 428,
      graphPanelW - 132,
      30,
      3,
    );

    ctx.fillStyle = 'rgba(228, 230, 245, 0.96)';
    ctx.font = '500 28px "Space Grotesk", "IBM Plex Sans Thai", sans-serif';
    const footerText = toSafeText(payload?.poster?.footer, 'meowtarot.com');
    ctx.fillText(footerText, width / 2, height - 62);

    const exportStart = performance.now();
    perf.captureCount += 1;
    const blob = await exportPoster(canvas);
    perf.captureMs = exportStart - perf.startedAt - perf.preloadMs;
    perf.exportMs = performance.now() - exportStart;
    if (!blob) throw new Error('Failed to build poster blob');
    return { blob, width, height, perf };
  }

  if (isDailySingle(payload) && preset === 'story') {
    const safeMargin = 72;
    const lang = payload?.lang || 'en';
    const strings = getDailyStrings(lang);
    const cardEntries = (await buildCardEntries(payload)).slice(0, 1);
    const cardEntry = cardEntries[0];
    const resolvedOrientation = resolveDailyReadingOrientation(payload, cardEntry);
    const reading = resolveDailyReading(payload, cardEntry, lang);
    const mainQuoteText = reading.mainQuoteText || '';
    // Card name renders in English in BOTH locales (user direction — interim until
    // Thai card names land; tarot names commonly stay English in TH). Resolve the
    // EN name from card data first so a localized payload title can't reintroduce Thai.
    const cardName = toSafeText(
      resolveLocalizedCardName(cardEntry?.card, '', 'en')
      || payload?.cards?.[0]?.title
      || payload?.cards?.[0]?.name
      || '',
      '',
    ).trim();
    // ScreenPoster (design §11) — ceremonial daily poster: italic-serif wordmark,
    // gold accent line, render-time date, card + aura, gold-tracked position badge,
    // big italic-serif card name, gold diamond ornament, full-reading tagline.
    const hasTagline = Boolean(mainQuoteText);
    const dateLabel = formatPosterDate(lang);
    const orientationLabel = reading.orientation || getOrientationLabel(resolvedOrientation, lang);
    const badgeText = [strings.badgePrefix, orientationLabel].filter(Boolean).join(' · ');
    const isUprightTone = resolvedOrientation === 'upright';
    // Plum ink on the light upright card; warm ivory on the dark reversed card.
    const textPalette = isUprightTone
      ? { primary: '#3d1a5c', secondary: '#6a3f8e', gold: '#bf8a20', goldSoft: 'rgba(191,138,32,0.62)' }
      : { primary: '#F8F5EF', secondary: 'rgba(235,245,255,0.92)', gold: '#e7b955', goldSoft: 'rgba(231,185,85,0.72)' };
    const displayFont = '"Cormorant Garamond", "Noto Serif Thai", serif';
    const eyebrowFont = '"Space Grotesk", "IBM Plex Sans Thai", sans-serif';
    const layout = {
      wordmarkBaselineY: 142,
      goldLineTopY: 164,
      dateBaselineY: 232,
      cardTop: 300,
      cardMaxHeight: 820,
      bottomMargin: 84,
    };

    // Centred, letter-spaced eyebrow (date, position badge). drawTrackingText lays
    // glyphs out from x with left alignment, so set it explicitly; tracking is px (em × size).
    const drawTrackedEyebrow = (text, y, { color, size, weight = 700, trackingEm = 0.3 }) => {
      if (!text) return;
      ctx.save();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = color;
      ctx.font = `${weight} ${size}px ${eyebrowFont}`;
      drawTrackingText(ctx, text, width / 2, y, trackingEm * size);
      ctx.restore();
    };

    // Short gold rule with a centred diamond node (design's accent below the card name).
    const drawGoldOrnament = (centerY, lineWidth) => {
      ctx.save();
      ctx.fillStyle = textPalette.goldSoft;
      ctx.fillRect(width / 2 - lineWidth / 2, centerY - 1.5, lineWidth, 3);
      ctx.fillStyle = textPalette.gold;
      ctx.translate(width / 2, centerY);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-8.5, -8.5, 17, 17);
      ctx.restore();
    };

    const drawHeader = () => {
      // italic-serif wordmark
      ctx.save();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = textPalette.primary;
      ctx.font = `italic 500 60px ${displayFont}`;
      drawTrackingText(ctx, strings.title, width / 2, layout.wordmarkBaselineY, 0.05 * 60);
      ctx.restore();
      // gold accent line under the wordmark (design: 24×1 → 66×3 at poster scale)
      ctx.save();
      ctx.fillStyle = textPalette.goldSoft;
      ctx.fillRect(width / 2 - 33, layout.goldLineTopY, 66, 3);
      ctx.restore();
      // render-time date eyebrow — gold, tracked, uppercase (EN) / native (TH)
      drawTrackedEyebrow(dateLabel, layout.dateBaselineY, { color: textPalette.gold, size: 28, weight: 600, trackingEm: 0.3 });
    };

    const resolveCardImage = async () => {
      if (!cardEntry) return null;
      const baseId = baseCardId(
        cardEntry?.card?.id
        || cardEntry?.card?.card_id
        || cardEntry?.card?.image_id
        || cardEntry?.id
        || '',
      );
      // Reversed cards SOURCE upright art and rotate 180° at draw time
      // (drawCardWithAura uses resolvedOrientation). Coerce all sourcing to
      // 'upright' here so we never request a *-reversed.webp fixture/asset.
      const imageOrientation = posterImageOrientation(resolvedOrientation);
      const orientedId = baseId ? `${baseId}-${imageOrientation}` : '';
      const localPrimary = cardEntry?.card ? resolveLocalPosterFixtureUrl('card', imageOrientation) : '';
      const localUpright = cardEntry?.card ? resolveLocalPosterFixtureUrl('card', 'upright') : '';
      const localBack = resolveLocalPosterFixtureUrl('back');
      let uprightUrl = '';
      let reversedUrl = '';
      let backUrl = localBack || toAssetUrl(resolveCardBackFallbackPath());
      let resolvedPrimary = '';

      if (orientedId) {
        const cardIdentity = { ...(cardEntry.card || {}), id: orientedId, card_id: orientedId, image_id: orientedId };
        ({ uprightUrl, reversedUrl, backUrl } = buildCardImageUrls(cardIdentity, imageOrientation));
        resolvedPrimary = await resolveCardImageUrl(cardIdentity, imageOrientation);
      }

      const { primary: resolvedAssetPrimary, fallbackChain } = resolvePosterCardImageSources({ ...cardEntry, orientation: imageOrientation }, {
        resolvedPrimary,
        uprightUrl,
        reversedUrl,
        backUrl,
        lang,
      });
      const primary = localPrimary || resolvedAssetPrimary;
      emitPosterDebug('waiting_for_card', { url: primary });
      // BUG-020: cross-deck face fallback (default deck) before any card back.
      const defaultDeckFaces = [
        toDefaultDeckFaceUrl(primary),
        toDefaultDeckFaceUrl(uprightUrl),
        toDefaultDeckFaceUrl(reversedUrl),
      ].filter(Boolean);
      const fallbackUrls = [...new Set([...(localUpright ? [localUpright] : []), ...fallbackChain, ...defaultDeckFaces, localBack || backUrl].filter(Boolean).filter((item) => item !== primary))];
      posterCiLog('card_urls', { primary, fallbackUrls });
      const backFallback = localBack || toAssetUrl(resolveCardBackFallbackPath());
      const preloadResults = await preloadImages([
        { kind: 'card', url: primary },
        ...fallbackUrls.map((url) => ({ kind: 'card', url })),
        { kind: 'card', url: backFallback },
      ]);
      const loaded = preloadResults.find((entry) => entry.status === 'loaded' && entry.img);
      if (loaded?.img) {
        emitLegacyCardProbe({
          ok: true,
          url: loaded.url || primary,
          w: loaded.img?.naturalWidth || 0,
          h: loaded.img?.naturalHeight || 0,
        });
        return loaded.img;
      }
      const failedUrls = preloadResults.filter((entry) => entry.status !== 'loaded').map((entry) => entry.url).filter(Boolean);
      if (failedUrls.length) {
        setPosterRuntimeFlag('__MEOW_POSTER_LAST_FAILED_ASSET_URL', failedUrls[0] || null);
        emitLegacyCardProbe({ ok: false, url: failedUrls[0] || primary, error: `asset load failure: ${failedUrls.join(', ')}` });
        throw new Error(`asset load failure: ${failedUrls.join(', ')}`);
      }
      if (isPosterCiDebugEnabled() || isPosterDebugEnabled()) return null;
      return loadPosterCardImageWithTimeout(primary, fallbackUrls);
    };

    const drawCardWithAura = (img, cardX, cardYPos, cardW, cardH) => {
      const cx = cardX + cardW / 2;
      const cy = cardYPos + cardH / 2;
      const auraR = Math.max(cardW, cardH) / 2 + 120;
      // warm radial aura behind the card (design ::before glow)
      ctx.save();
      const aura = ctx.createRadialGradient(cx, cy, auraR * 0.2, cx, cy, auraR);
      aura.addColorStop(0, 'rgba(255, 225, 180, 0.55)');
      aura.addColorStop(0.55, 'rgba(255, 223, 178, 0.22)');
      aura.addColorStop(1, 'rgba(255, 223, 178, 0)');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.ellipse(cx, cy, auraR, auraR, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const cardRadius = 30;
      if (img) {
        ctx.save();
        ctx.shadowColor = 'rgba(42, 17, 66, 0.40)';
        ctx.shadowBlur = 60;
        ctx.shadowOffsetY = 30;
        drawRoundedRect(ctx, cardX, cardYPos, cardW, cardH, cardRadius);
        ctx.fillStyle = '#2a1142';
        ctx.fill();
        ctx.restore();
        ctx.save();
        drawRoundedRect(ctx, cardX, cardYPos, cardW, cardH, cardRadius);
        ctx.clip();
        if (posterShouldRotateReversed(resolvedOrientation)) {
          // Reversed = upright art rotated 180° about the card center.
          ctx.translate(cardX + cardW / 2, cardYPos + cardH / 2);
          ctx.rotate(Math.PI);
          ctx.drawImage(img, -cardW / 2, -cardH / 2, cardW, cardH);
        } else {
          ctx.drawImage(img, cardX, cardYPos, cardW, cardH);
        }
        ctx.restore();
      } else {
        drawFallbackCardArt(ctx, cardX, cardYPos, cardW, cardH, { radius: cardRadius, label: 'MEOW TAROT' });
      }
    };

    // Big italic-serif card name, auto-fit to one line where possible, ≤2 lines.
    const drawCardName = (topBaselineY) => {
      if (!cardName) return topBaselineY;
      const maxWidth = width - safeMargin * 2;
      const minSize = 66;
      let fontSize = 132;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      while (fontSize > minSize) {
        ctx.font = `italic 500 ${fontSize}px ${displayFont}`;
        if (ctx.measureText(cardName).width <= maxWidth) break;
        fontSize -= 4;
      }
      ctx.font = `italic 500 ${fontSize}px ${displayFont}`;
      const lines = wrapTextLines(ctx, cardName, maxWidth, 2);
      const lineHeight = Math.round(fontSize * 1.02);
      ctx.fillStyle = textPalette.primary;
      lines.forEach((line, i) => ctx.fillText(line, width / 2, topBaselineY + i * lineHeight));
      const descent = Math.round(fontSize * 0.26);
      return topBaselineY + (lines.length - 1) * lineHeight + descent;
    };

    // Full reading line rendered as an italic-serif tagline (never truncated unless
    // it overflows the whole band) — keeps the free reading feeling complete.
    const drawTagline = (startTop) => {
      if (!hasTagline) return;
      const taglineWidth = width - 2 * 120;
      const taglineMaxHeight = Math.max(0, (height - layout.bottomMargin) - startTop);
      const fit = fitDailyQuoteText(ctx, mainQuoteText, taglineWidth, taglineMaxHeight, {
        fontFamily: displayFont,
        defaultFontSize: 56,
        minimumFontSize: 38,
        addQuotes: true,
      });
      ctx.save();
      // EXPLICIT centring (left-align + x − lineWidth/2) instead of textAlign='center',
      // which mis-centres Thai on iOS Safari canvas → tagline drifts to the right edge.
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = textPalette.primary;
      ctx.font = `italic 500 ${fit.fontSize}px ${displayFont}`;
      const firstBaseline = startTop + fit.ascent;
      fit.lines.forEach((line, i) => {
        const lw = ctx.measureText(line).width;
        ctx.fillText(line, width / 2 - lw / 2, firstBaseline + i * fit.lineHeight);
      });
      ctx.restore();
    };

    drawHeader();

    const cardTopY = layout.cardTop;
    const maxCardWidth = Math.min(660, width - safeMargin * 2);
    const maxCardHeight = layout.cardMaxHeight;
    const fallbackAspect = 2 / 3;
    const fallbackWidth = Math.min(maxCardWidth, maxCardHeight * fallbackAspect);
    cardWidth = fallbackWidth || 560;
    cardHeight = (fallbackWidth / fallbackAspect) || Math.round(560 * 1.5);
    cardY = cardTopY;
    let cardImg = null;
    try {
      cardImg = await resolveCardImage();
    } catch (error) {
      posterCiLog('exception', { stage: 'resolveCardImage', message: error?.message || String(error) });
      console.warn('Poster image failed to load, continuing without card art.', error);
    }
    posterDebugLog('log', '[Poster] Images resolved');
    const imgWidth = cardImg?.naturalWidth || cardWidth || 560;
    const imgHeight = cardImg?.naturalHeight || cardHeight || Math.round(560 * 1.5);
    const scale = Math.min(maxCardWidth / imgWidth, maxCardHeight / imgHeight);
    cardWidth = Math.max(0, imgWidth * scale);
    cardHeight = Math.max(0, imgHeight * scale);
    const cardX = (width - cardWidth) / 2;

    if (cardWidth && cardHeight) {
      drawCardWithAura(cardImg, cardX, cardY, cardWidth, cardHeight);
      posterCiLog('draw_card', {
        executed: Boolean(cardImg),
        w: Math.round(cardWidth),
        h: Math.round(cardHeight),
      });
    }

    const cardBottomY = cardY + cardHeight;
    // position badge → card name → gold ornament → full-reading tagline
    drawTrackedEyebrow(badgeText, cardBottomY + 88, { color: textPalette.gold, size: 27, weight: 700, trackingEm: 0.3 });
    const nameBottomY = drawCardName(cardBottomY + 200);
    drawGoldOrnament(nameBottomY + 52, 133);
    drawTagline(nameBottomY + 96);

    posterCiLog('draw_text', {
      executed: hasTagline,
      blocks: [Boolean(badgeText), Boolean(cardName), hasTagline].filter(Boolean).length,
      detail: { badge: Boolean(badgeText), cardName: Boolean(cardName), tagline: hasTagline },
    });
    if (isPosterDebugEnabled()) {
      posterDebugLog('info', '[poster-debug][daily]', {
        lang,
        dateLabel,
        badgeText,
        orientationLabel,
        cardName,
        mainQuoteSource: reading.mainQuoteSource,
        mainQuoteText,
      });
    }
    posterDebugLog('log', '[Poster] Canvas drawn');

    const exportStart = performance.now();
    perf.captureCount += 1;
    posterDebugLog('info', '[share-export] captureCount:', perf.captureCount);
    const blob = await exportPoster(canvas);
    perf.captureMs = exportStart - perf.startedAt - perf.preloadMs;
    perf.exportMs = performance.now() - exportStart;
    if (!blob) throw new Error('Failed to build poster blob');
    posterDebugLog('info', '[Poster] Performance', {
      preloadMs: Number(perf.preloadMs.toFixed(1)),
      captureMs: Number(perf.captureMs.toFixed(1)),
      exportMs: Number(perf.exportMs.toFixed(1)),
      captureCount: perf.captureCount,
      totalMs: Number((performance.now() - perf.startedAt).toFixed(1)),
      bytes: blob.size,
      type: blob.type,
    });
    return { blob, width, height, perf };
  }

  const title = toSafeText(payload?.poster?.title ?? payload?.title, 'MeowTarot Reading');
  const subtitle = toSafeText(payload?.poster?.subtitle ?? payload?.subtitle, '');
  const keywords = Array.isArray(payload?.keywords) ? payload.keywords.filter(Boolean).slice(0, 3) : [];
  ctx.textAlign = 'center';
  ctx.fillStyle = '#c9933a';
  ctx.font = '600 72px "Poppins", "Space Grotesk", "IBM Plex Sans Thai", sans-serif';
  ctx.fillText(title, width / 2, 150);

  ctx.fillStyle = '#d8dbe6';
  ctx.font = '500 38px "Space Grotesk", "IBM Plex Sans Thai", sans-serif';
  if (subtitle) {
    ctx.fillText(subtitle, width / 2, 215);
  }

  if (keywords.length) {
    ctx.fillStyle = '#f7f4ee';
    ctx.font = '500 32px "Space Grotesk", "IBM Plex Sans Thai", sans-serif';
    ctx.fillText(keywords.join(' · '), width / 2, 265);
  }

  const cardEntries = await buildCardEntries(payload);
  const cardCount = cardEntries.length || 1;
  const cardGap = cardCount > 1 ? 32 : 0;
  cardWidth = cardCount === 1 ? 520 : 280;
  cardHeight = Math.round(cardWidth * 1.55);
  const totalWidth = cardCount * cardWidth + (cardCount - 1) * cardGap;
  const startX = (width - totalWidth) / 2;
  const startY = height * 0.34;

  for (let i = 0; i < cardCount; i += 1) {
    const entry = cardEntries[i];
    const x = startX + i * (cardWidth + cardGap);
    const y = startY + (cardCount === 1 ? 0 : (i === 1 ? -20 : 10));

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = '#0f1429';
    ctx.fillRect(x, y, cardWidth, cardHeight);
    ctx.restore();

    if (entry?.card) {
      const baseId = baseCardId(entry.card.id || entry.card.card_id || entry.card.image_id);
      // Reversed cards SOURCE upright art and rotate 180° at draw time. Coerce
      // sourcing to upright; entry.orientation stays real for the rotation.
      const realOrientation = toOrientation(entry.orientation);
      const imageOrientation = posterImageOrientation(realOrientation);
      const orientedId = `${baseId}-${imageOrientation}`;
      const cardIdentity = { ...entry.card, id: orientedId, card_id: orientedId, image_id: orientedId };
      const { uprightUrl, reversedUrl, backUrl } = buildCardImageUrls(cardIdentity, imageOrientation);
      const resolvedPrimary = await resolveCardImageUrl(cardIdentity, imageOrientation);
      try {
        const { primary: selectedUrl, fallbackChain } = resolvePosterCardImageSources({ ...entry, orientation: imageOrientation }, {
          resolvedPrimary,
          uprightUrl,
          reversedUrl,
          backUrl,
          lang: payload?.lang || 'en',
        });
        emitPosterDebug('waiting_for_card', { url: selectedUrl });
        const img = await loadPosterCardImageWithTimeout(selectedUrl, fallbackChain);
        emitLegacyCardProbe({ ok: true, url: img?.currentSrc || img?.src || resolvedPrimary || reversedUrl || uprightUrl || backUrl, w: img?.naturalWidth || cardWidth, h: img?.naturalHeight || cardHeight });
        if (posterShouldRotateReversed(realOrientation)) {
          // Reversed = upright art rotated 180° about the card center.
          ctx.save();
          ctx.translate(x + cardWidth / 2, y + cardHeight / 2);
          ctx.rotate(Math.PI);
          ctx.drawImage(img, -cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight);
          ctx.restore();
        } else {
          ctx.drawImage(img, x, y, cardWidth, cardHeight);
        }
      } catch (error) {
        emitLegacyCardProbe({ ok: false, url: resolvedPrimary || reversedUrl || uprightUrl || backUrl, error: error?.message || String(error) });
        console.warn('[Poster] card image failed', { url: resolvedPrimary || reversedUrl || uprightUrl || backUrl, reason: error?.message || String(error) });
        drawFallbackCardArt(ctx, x, y, cardWidth, cardHeight, { radius: 18, label: 'MEOW TAROT' });
      }
    }
  }
  posterDebugLog('log', '[Poster] Images resolved');

  ctx.fillStyle = '#f7f4ee';
  ctx.font = '500 30px "Space Grotesk", "IBM Plex Sans Thai", sans-serif';
  const headline = toSafeText(payload?.headline, '');
  if (!headline.trim()) {
    console.warn('[Poster] missing headline text');
  }
  drawTextBlock(ctx, headline, width / 2, height * 0.73, width * 0.78, 38);

  ctx.fillStyle = '#aab0c9';
  ctx.font = '500 28px "Space Grotesk", "IBM Plex Sans Thai", sans-serif';
  const footerText = toSafeText(payload?.poster?.footer, 'meowtarot.com');
  ctx.fillText(footerText, width / 2, height - 90);
  posterDebugLog('log', '[Poster] Canvas drawn');

  const exportStart = performance.now();
  perf.captureCount += 1;
  posterDebugLog('info', '[share-export] captureCount:', perf.captureCount);
  const blob = await exportPoster(canvas);
  perf.captureMs = exportStart - perf.startedAt - perf.preloadMs;
  perf.exportMs = performance.now() - exportStart;
  if (!blob) throw new Error('Failed to build poster blob');
  posterDebugLog('info', '[Poster] Performance', {
    preloadMs: Number(perf.preloadMs.toFixed(1)),
    captureMs: Number(perf.captureMs.toFixed(1)),
    exportMs: Number(perf.exportMs.toFixed(1)),
    captureCount: perf.captureCount,
    totalMs: Number((performance.now() - perf.startedAt).toFixed(1)),
    bytes: blob.size,
    type: blob.type,
  });
  return { blob, width, height, perf };
}

export { PRESETS, resolveQuestionPosterSummaries };
