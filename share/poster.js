import {
  loadTarotData,
  meowTarotCards,
  normalizeId,
  getCardBackFallbackUrl,
  getCardBackUrl,
  getCardImageFallbackUrl,
} from '../js/data.js';
import { imageManager } from '../js/image-manager.js';
import { normalizePayload } from './normalize-payload.js';
import { findCardById, getCelticCrossInterpretation, toOrientation } from '../js/reading-helpers.js';
import { getLuckyColorVisibilityStyle } from '../js/lucky-color-visibility.js';
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


const PRESETS = {
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1350 },
};

const FULL_POSITION_LABELS = {
  en: { present: 'The Present', challenge: 'The Challenge', past: 'The Past', future: 'The Future', above: 'Above', below: 'Below', advice: 'Advice', external: 'External Influences', hopes: 'Hopes & Fears', outcome: 'Outcome' },
  th: { present: 'สถานการณ์ปัจจุบัน', challenge: 'ความท้าทาย', past: 'อดีต', future: 'อนาคต', above: 'เป้าหมาย', below: 'รากฐาน', advice: 'คำแนะนำ', external: 'อิทธิพลภายนอก', hopes: 'ความหวังและความกลัว', outcome: 'ผลลัพธ์' },
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

  const fallbackCandidates = orientation === 'reversed'
    ? [
      fromEntry.upright,
      fromCard.upright,
      uprightUrl,
      fromEntry.default,
      fromCard.default,
      resolvedPrimary,
      backUrl,
      globalSiteFallback,
    ]
    : [
      fromEntry.default,
      fromCard.default,
      resolvedPrimary,
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
  const advice = buildInsight('advice');
  const outcome = buildInsight('outcome');
  const heroTitle = normalizeStandaloneAffirmation(outcome.body, lang, strings.heroFallback);

  return {
    lang,
    strings,
    heroTitle,
    subtitle: strings.subtitle,
    present,
    advice,
    outcome,
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
    eyebrow: 'Ask a Question',
    subtitle: topicConfig.subtitle,
    tertiary: supportLine,
    positions: [dict.past || 'Past', dict.present || 'Present', dict.future || 'Future'],
  };
}

function resolveQuestionPosterSummaries(payload = {}, cardEntries = []) {
  const reading = payload?.reading || {};
  const slots = ['past', 'present', 'future'];
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
      reading[`reading_summary_${slot}`],
      reading[`reading_summary_${slot}_en`],
      card[`reflection_question_${slot}`],
      card.reflection_question_en,
      card[`reading_summary_${slot}_en`],
      card.general_meaning_en,
    ]);
  });
}

async function buildCardEntries(payload) {
  posterDebugLog('log', '[Poster] buildCardEntries: meowTarotCards length', meowTarotCards.length);
  if (meowTarotCards.length < 150) {
    await ensureTarotData();
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

function ensureTarotData() {
  if (meowTarotCards.length >= 150) return Promise.resolve(meowTarotCards);
  if (!tarotDataPromise) {
    tarotDataPromise = loadTarotData().finally(() => {
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

function tokenizeText(ctx, text, maxWidth) {
  const value = String(text || '');
  if (!value) return [];
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length > 1) return words;
  if (ctx.measureText(value).width <= maxWidth) return [value];
  return Array.from(value);
}

function wrapTextLines(ctx, text, maxWidth, maxLines = Infinity) {
  if (!text) return [];
  const tokens = tokenizeText(ctx, text, maxWidth);
  const lines = [];
  let line = '';

  let overflow = false;
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const candidate = line ? `${line} ${token}`.trim() : token;
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

function fitDailyQuoteText(ctx, text, maxWidth, maxHeight) {
  const quoteText = String(text || '').trim();
  if (!quoteText) {
    return {
      fontSize: 58,
      lineHeight: 72,
      lines: [],
      isTruncated: false,
      ascent: 46,
      descent: 14,
      occupiedHeight: 0,
    };
  }

  const quoteRenderSafety = 8;
  const measureQuoteMetrics = (fontSize) => {
    ctx.font = `italic 500 ${fontSize}px "Prata", serif`;
    const metrics = ctx.measureText('“Ag”');
    const ascent = Math.max(metrics.actualBoundingBoxAscent || 0, Math.round(fontSize * 0.82));
    const descent = Math.max(metrics.actualBoundingBoxDescent || 0, Math.round(fontSize * 0.24));
    const lineHeight = Math.max(fontSize + 14, Math.ceil(ascent + descent + 10));
    return { ascent, descent, lineHeight };
  };

  // Keep the premium display style, then progressively shrink only as needed.
  const defaultFontSize = 58;
  const minimumFontSize = 46;
  const fontStep = 2;
  const quote = `“${quoteText}”`;

  for (let fontSize = defaultFontSize; fontSize >= minimumFontSize; fontSize -= fontStep) {
    const { ascent, descent, lineHeight } = measureQuoteMetrics(fontSize);
    const lines = wrapTextLines(ctx, quote, maxWidth, Number.POSITIVE_INFINITY);
    const occupiedHeight = ascent + descent + Math.max(0, lines.length - 1) * lineHeight + quoteRenderSafety;
    if (occupiedHeight <= maxHeight) {
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
    ctx.font = `620 ${fontSize}px "Space Grotesk", sans-serif`;
    const lines = wrapTextLines(ctx, value, maxWidth, maxLines);
    const hasClampEllipsis = lines.some((line) => /…$/.test(line));
    if (!hasClampEllipsis || fontSize === minFontSize) {
      return { fontSize, lineHeight, lines };
    }
  }
  const fontSize = minFontSize;
  const lineHeight = Math.round(fontSize * lineHeightRatio);
  ctx.font = `620 ${fontSize}px "Space Grotesk", sans-serif`;
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
    ctx.font = `620 ${fontSize}px "Space Grotesk", sans-serif`;
    const lines = wrapTextLines(ctx, value, safeWidth, Number.POSITIVE_INFINITY);
    const occupiedHeight = lines.length * lineHeight;
    if (lines.length <= safeMaxLines && occupiedHeight <= safeMaxHeight) {
      return { fontSize, lineHeight, lines };
    }
  }

  const fontSize = minFontSize;
  const lineHeight = Math.round(fontSize * 1.1);
  ctx.font = `620 ${fontSize}px "Space Grotesk", sans-serif`;
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
    ctx.fillStyle = '#f8d77a';
    ctx.font = `700 ${header.brandSize}px "Poppins", "Space Grotesk", sans-serif`;
    ctx.fillText('MeowTarot', width / 2, header.top);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(236, 205, 132, 0.95)';
    ctx.font = `600 ${header.eyebrowSize}px "Space Grotesk", sans-serif`;
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
    ctx.font = `700 ${heroFit.fontSize}px "Space Grotesk", sans-serif`;
    heroFit.lines.forEach((line, index) => {
      ctx.fillText(line, width / 2, header.top + 94 + index * heroFit.lineHeight);
    });

    const subtitleY = header.top + 94 + heroFit.lines.length * heroFit.lineHeight + 10;
    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    ctx.font = `500 ${header.subtitleSize}px "Space Grotesk", sans-serif`;
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
    const pillPaddingX = preset === 'square' ? 13 : 16;
    const pillHeight = preset === 'square' ? 22 : 24;
    const pillFontSize = preset === 'square' ? 11 : 12;
    const labelY = layoutBox.y + spread.cardH / 2 + spread.labelGap;
    ctx.save();
    ctx.font = `600 ${pillFontSize}px "Space Grotesk", sans-serif`;
    const pillWidth = Math.min(spread.cardW + 18, Math.max(70, ctx.measureText(label).width + pillPaddingX * 2));
    ctx.restore();
    const pillX = layoutBox.x - pillWidth / 2;

    fillRoundedRect(ctx, pillX, labelY, pillWidth, pillHeight, pillHeight / 2, 'rgba(17,18,26,0.78)');
    strokeRoundedRect(ctx, pillX, labelY, pillWidth, pillHeight, pillHeight / 2, 'rgba(255,255,255,0.14)', 1);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.font = `600 ${pillFontSize}px "Space Grotesk", sans-serif`;
    ctx.fillText(label, layoutBox.x, labelY + pillHeight - 8);

    ctx.fillStyle = '#f7f4ee';
    ctx.font = `${isHeroPosition ? 600 : 500} ${preset === 'square' ? 11 : 12}px "Space Grotesk", sans-serif`;
    wrapText(ctx, cardName, layoutBox.x, labelY + pillHeight + spread.nameGap + 10, spread.cardW + 24, 15, 2);

    ctx.fillStyle = 'rgba(255,255,255,0.56)';
    ctx.font = `500 ${preset === 'square' ? 9 : 10}px "Space Grotesk", sans-serif`;
    wrapText(ctx, orientationLabel, layoutBox.x, labelY + pillHeight + spread.nameGap + 41, spread.cardW + 24, 13, 1);
    ctx.restore();
  };

  const drawCardArt = async (item) => {
    const sourceCard = item.entry?.card || item.payloadCard || {};
    const fallbackBaseId = baseCardId(item.payloadCard?.id || item.payloadCard?.card_id || item.payloadCard?.image_id || item.position);
    const baseId = baseCardId(sourceCard?.id || sourceCard?.card_id || sourceCard?.image_id || fallbackBaseId);
    const orientation = item.orientation;
    const orientedId = `${baseId}-${orientation}`;
    const cardIdentity = { ...sourceCard, id: orientedId, card_id: orientedId, image_id: orientedId };
    const { uprightUrl, reversedUrl, backUrl } = buildCardImageUrls(cardIdentity, orientation);
    const resolvedPrimary = await resolveCardImageUrl(cardIdentity, orientation);
    const { primary, fallbackChain } = resolvePosterCardImageSources({ ...item.entry, ...item.payloadCard, orientation, card: sourceCard }, {
      resolvedPrimary,
      uprightUrl,
      reversedUrl,
      backUrl,
      lang,
    });
    try {
      return await loadPosterCardImageWithTimeout(primary, fallbackChain);
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
    ctx.shadowColor = item.position === 'outcome' ? 'rgba(236,205,132,0.18)' : 'rgba(0,0,0,0.32)';
    ctx.shadowBlur = shadowBlur;
    ctx.shadowOffsetY = 10;
    drawRoundedRect(ctx, cardX, cardY, spread.cardW, spread.cardH, frameRadius);
    ctx.fillStyle = 'rgba(255,255,255,0.01)';
    ctx.fill();
    ctx.restore();

    if (isHeroPosition) {
      strokeRoundedRect(ctx, cardX - 1, cardY - 1, spread.cardW + 2, spread.cardH + 2, frameRadius + 1, 'rgba(236,205,132,0.22)', 1.5);
    }

    ctx.save();
    ctx.translate(layoutBox.x, layoutBox.y);
    if (layoutBox.rotated) ctx.rotate(Math.PI / 2);
    drawRoundedRect(ctx, -spread.cardW / 2, -spread.cardH / 2, spread.cardW, spread.cardH, frameRadius);
    ctx.clip();
    if (image) {
      if (item.orientation === 'reversed') {
        ctx.translate(0, 0);
        ctx.rotate(Math.PI);
      }
      ctx.drawImage(image, -spread.cardW / 2, -spread.cardH / 2, spread.cardW, spread.cardH);
    } else {
      const fallbackFill = ctx.createLinearGradient(-spread.cardW / 2, -spread.cardH / 2, spread.cardW / 2, spread.cardH / 2);
      fallbackFill.addColorStop(0, 'rgba(255,255,255,0.12)');
      fallbackFill.addColorStop(1, 'rgba(236,205,132,0.08)');
      ctx.fillStyle = fallbackFill;
      ctx.fillRect(-spread.cardW / 2, -spread.cardH / 2, spread.cardW, spread.cardH);
    }
    ctx.restore();

    drawCardMeta({ item, layoutBox, isHeroPosition });
    emitFullCardRenderProbe({ position: item.position, ok: Boolean(image), preset });
  };

  const drawInsightPanel = ({ x, y, w, h, insight, variant }) => {
    const gradient = ctx.createLinearGradient(x, y, x, y + h);
    if (variant === 'outcome') {
      gradient.addColorStop(0, 'rgba(236,205,132,0.16)');
      gradient.addColorStop(1, 'rgba(255,255,255,0.08)');
    } else {
      gradient.addColorStop(0, 'rgba(255,255,255,0.10)');
      gradient.addColorStop(1, 'rgba(255,255,255,0.05)');
    }
    fillRoundedRect(ctx, x, y, w, h, variant === 'outcome' ? 26 : 22, gradient);
    strokeRoundedRect(ctx, x, y, w, h, variant === 'outcome' ? 26 : 22, variant === 'outcome' ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.14)', 1.25);
    fillRoundedRect(ctx, x, y, 4, h, 3, variant === 'outcome' ? 'rgba(236,205,132,0.9)' : 'rgba(236,205,132,0.34)');

    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(236,205,132,0.98)';
    ctx.font = `600 ${preset === 'square' ? 11 : 12}px "Space Grotesk", sans-serif`;
    ctx.fillText(insight.label, x + 20, y + 28);

    ctx.fillStyle = '#f7f4ee';
    const titleFont = variant === 'outcome'
      ? (preset === 'square' ? 22 : 26)
      : (preset === 'square' ? 16 : 19);
    ctx.font = `700 ${titleFont}px "Space Grotesk", sans-serif`;
    const titleWidth = w - 40;
    const titleY = y + 58;
    const titleLines = wrapTextLines(ctx, insight.title, titleWidth, variant === 'outcome' ? 2 : 2);
    titleLines.forEach((line, index) => {
      ctx.fillText(line, x + 20, titleY + index * Math.round(titleFont * 1.18));
    });

    const bodyFont = variant === 'outcome'
      ? (preset === 'square' ? 13 : 15)
      : (preset === 'square' ? 12 : 14);
    const bodyLineHeight = Math.round(bodyFont * (variant === 'outcome' ? 1.48 : 1.42));
    const bodyStartY = titleY + titleLines.length * Math.round(titleFont * 1.18) + 18;
    const maxBodyLines = Math.max(2, Math.floor((h - (bodyStartY - y) - 22) / bodyLineHeight));
    ctx.fillStyle = variant === 'outcome' ? '#f7f4ee' : 'rgba(255,255,255,0.78)';
    ctx.font = `500 ${bodyFont}px "Space Grotesk", sans-serif`;
    wrapText(ctx, insight.body, x + 20, bodyStartY, titleWidth, bodyLineHeight, maxBodyLines);
    ctx.restore();
  };

  const drawInsights = () => {
    const order = insights.heroFirst
      ? [
        { insight: content.outcome, variant: 'outcome' },
        { insight: content.present, variant: 'present' },
        { insight: content.advice, variant: 'advice' },
      ]
      : [
        { insight: content.present, variant: 'present' },
        { insight: content.advice, variant: 'advice' },
        { insight: content.outcome, variant: 'outcome' },
      ];

    if (insights.direction === 'column') {
      order.forEach((item, index) => {
        drawInsightPanel({
          x: insights.x,
          y: insights.y + index * (insights.rowH + insights.gap),
          w: insights.w,
          h: item.variant === 'outcome' ? insights.rowH + 8 : insights.rowH,
          ...item,
        });
      });
      return;
    }

    if (insights.direction === 'portrait-grid') {
      const halfW = (insights.w - insights.gap) / 2;
      drawInsightPanel({ x: insights.x, y: insights.y, w: halfW, h: insights.rowH, ...order[0] });
      drawInsightPanel({ x: insights.x + halfW + insights.gap, y: insights.y, w: halfW, h: insights.rowH, ...order[1] });
      drawInsightPanel({ x: insights.x, y: insights.y + insights.rowH + insights.gap, w: insights.w, h: insights.rowH + 8, ...order[2] });
      return;
    }

    const sideW = Math.max(180, Math.round((insights.w - insights.gap * 2) * 0.3));
    const outcomeW = insights.w - sideW * 2 - insights.gap * 2;
    drawInsightPanel({ x: insights.x, y: insights.y, w: sideW, h: insights.rowH, ...order[0] });
    drawInsightPanel({ x: insights.x + sideW + insights.gap, y: insights.y, w: sideW, h: insights.rowH, ...order[1] });
    drawInsightPanel({ x: insights.x + sideW * 2 + insights.gap * 2, y: insights.y, w: outcomeW, h: insights.rowH, ...order[2] });
  };

  drawHeader();
  drawSpreadShell();
  for (const item of content.positionedCards) {
    // Keep the implementation canvas-based while mirroring the product's poster--celtic-cross layout structure.
    await drawSingleCard(item);
  }
  drawInsights();

  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.58)';
  ctx.font = `500 ${preset === 'square' ? 24 : 28}px "Space Grotesk", sans-serif`;
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
      luckyColors: 'สีมงคลวันนี้',
      identitySeparator: '•',
      phasePrefix: 'ช่วงพลัง',
    };
  }
  return {
    title: 'MeowTarot',
    subtitle: 'Daily Reading',
    luckyColors: 'Lucky Colors',
    identitySeparator: '•',
    phasePrefix: 'Phase',
  };
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


function resolveEnergyBalance(energyData = {}) {
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
  const axisTitle = { action: 'action', emotion: 'emotion', thinking: 'thinking', stability: 'stability' };
  const dominant = axisTitle[ordered[0]?.[0] || 'action'];
  const support = axisTitle[ordered[1]?.[0] || 'stability'];

  const interpretation = [
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
  await ensureTarotData();
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
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }
  perf.preloadMs = performance.now() - preloadStart;
  posterDebugLog('log', '[Poster] Data loaded', { preloadMs: Number(perf.preloadMs.toFixed(1)) });

  const { width, height } = PRESETS[preset] || PRESETS.story;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const fontFamilies = ['"Poppins", sans-serif', '"Space Grotesk", sans-serif', '"Prata", serif'];
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

    const drawCardImage = (img, x, y, rotated = false) => {
      ctx.save();
      ctx.translate(x, y);
      if (rotated) ctx.rotate(Math.PI / 2);
      ctx.drawImage(img, -cardW / 2, -cardH / 2, cardW, cardH);
      ctx.restore();
    };

    const drawCardLabelBlock = ({ label, orientation, x, y, align = 'center', orientationX = x, orientationY = y + 38, orientationAlign = align }) => {
      ctx.save();
      ctx.fillStyle = '#f7f4ee';
      ctx.font = '600 18px "Space Grotesk", sans-serif';
      ctx.textAlign = align;
      wrapText(ctx, label, x, y, align === 'center' ? cardW + 24 : 170, 22, 2);
      ctx.fillStyle = '#b8bfd6';
      ctx.font = '500 15px "Space Grotesk", sans-serif';
      ctx.textAlign = orientationAlign;
      wrapText(ctx, orientation, orientationX, orientationY, orientationAlign === 'center' ? cardW + 18 : 170, 18, 1);
      ctx.restore();
    };

    ctx.textAlign = 'center';
    ctx.fillStyle = '#f8d77a';
    ctx.font = '700 62px "Poppins", "Space Grotesk", sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = 14;
    ctx.fillText('MeowTarot', width / 2, 100);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#efe4c2';
    ctx.font = '500 24px "Space Grotesk", sans-serif';
    drawTrackingText(ctx, toSafeText(payload?.poster?.title, 'Celtic Cross Reading'), width / 2, 142, 0.8);
    ctx.fillStyle = 'rgba(245, 241, 232, 0.92)';
    ctx.font = '500 20px "Space Grotesk", sans-serif';
    drawTrackingText(ctx, toSafeText(payload?.poster?.subtitle, ''), width / 2, 178, 0.35);

    for (let i = 0; i < cardEntries.length; i += 1) {
      const entry = cardEntries[i] || null;
      const payloadCard = payload?.cards?.[i] || {};
      const fallbackBaseId = baseCardId(payloadCard?.id || payloadCard?.card_id || payloadCard?.image_id || `slot-${i + 1}`);
      const sourceCard = entry?.card || payloadCard;
      const baseId = baseCardId(sourceCard?.id || sourceCard?.card_id || sourceCard?.image_id || fallbackBaseId);
      const orientation = toOrientation(entry?.orientation || payloadCard?.orientation || sourceCard?.orientation || 'upright');
      const orientedId = `${baseId}-${orientation}`;
      const cardIdentity = { ...sourceCard, id: orientedId, card_id: orientedId, image_id: orientedId };
      const { uprightUrl, reversedUrl, backUrl } = buildCardImageUrls(cardIdentity, orientation);
      const resolvedPrimary = await resolveCardImageUrl(cardIdentity, orientation);
      const { primary: selectedUrl, fallbackChain } = resolvePosterCardImageSources({ ...entry, ...payloadCard, orientation, card: sourceCard }, {
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
        const img = await loadPosterCardImageWithTimeout(selectedUrl, fallbackChain);
        drawCardImage(img, layout.x, layout.y, Boolean(layout.rotated));
      } catch (error) {
        console.warn('[Poster] full card image failed', { url: resolvedPrimary || reversedUrl || uprightUrl || backUrl, reason: error?.message || String(error) });
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
    ctx.font = '500 28px "Space Grotesk", sans-serif';
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
    const energySource = payload?.energyData || computeQuestionEnergyData(cardEntries) || {};
    const energyBalance = resolveEnergyBalance(energySource);
    const questionCardCount = orderedQuestionCards.length === 1 ? 1 : 3;
    const slots = questionCardCount === 1 ? [questionStrings.positions[1]] : questionStrings.positions;
    const summaries = questionCardCount === 1 ? [questionSummaries[1] || questionSummaries[0] || ''] : questionSummaries;
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
    ctx.fillStyle = 'rgba(19, 22, 44, 0.42)';
    drawRoundedRect(ctx, textPanelX, textPanelY, textPanelW, textPanelH, 44);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = 'rgba(245, 238, 222, 0.88)';
    ctx.font = '600 24px "Space Grotesk", sans-serif';
    drawTrackingText(ctx, questionStrings.eyebrow, width / 2, 100, 1.5);

    ctx.fillStyle = '#fff7de';
    ctx.font = '700 76px "Poppins", "Space Grotesk", sans-serif';
    ctx.shadowColor = 'rgba(11, 13, 26, 0.55)';
    ctx.shadowBlur = 20;
    ctx.fillText(questionStrings.title, width / 2, 166);
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(252, 245, 231, 0.95)';
    ctx.font = '600 31px "Space Grotesk", sans-serif';
    drawTrackingText(ctx, questionStrings.subtitle, width / 2, 212, 0.2);

    ctx.fillStyle = 'rgba(235, 228, 214, 0.9)';
    ctx.font = '500 22px "Space Grotesk", sans-serif';
    drawTrackingText(ctx, questionStrings.tertiary, width / 2, 248, 0.8);

    for (let i = 0; i < questionCardCount; i += 1) {
      const entry = cardEntries[i] || null;
      const payloadCard = orderedQuestionCards[i] || {};
      const fallbackBaseId = baseCardId(payloadCard?.id || payloadCard?.card_id || payloadCard?.image_id || `slot-${i + 1}`);
      const sourceCard = entry?.card || payloadCard;
      const baseId = baseCardId(sourceCard?.id || sourceCard?.card_id || sourceCard?.image_id || fallbackBaseId);
      const orientation = toOrientation(entry?.orientation || payloadCard?.orientation || sourceCard?.orientation || 'upright');
      const orientedId = `${baseId}-${orientation}`;
      const cardIdentity = { ...sourceCard, id: orientedId, card_id: orientedId, image_id: orientedId };
      const { uprightUrl, reversedUrl, backUrl } = buildCardImageUrls(cardIdentity, orientation);
      const resolvedPrimary = await resolveCardImageUrl(cardIdentity, orientation);

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
        const { primary: selectedUrl, fallbackChain } = resolvePosterCardImageSources({ ...entry, ...payloadCard, orientation, card: sourceCard }, {
          resolvedPrimary,
          uprightUrl,
          reversedUrl,
          backUrl,
          lang: payload?.lang || 'en',
        });
        const img = await loadPosterCardImageWithTimeout(selectedUrl, fallbackChain);
        ctx.drawImage(img, x, y, cardW, cardH);
      } catch (error) {
        console.warn('[Poster] question card image failed', { url: resolvedPrimary || reversedUrl || uprightUrl || backUrl, reason: error?.message || String(error) });
      }

      const labelPillW = Math.min(228, cardW - 24);
      const labelPillH = 42;
      const labelPillX = x + (cardW - labelPillW) / 2;
      const labelPillY = y + cardH + 14;
      ctx.save();
      ctx.fillStyle = 'rgba(20, 23, 44, 0.62)';
      drawRoundedRect(ctx, labelPillX, labelPillY, labelPillW, labelPillH, 22);
      ctx.fill();
      ctx.restore();

      const positionLabel = slots[i] || questionStrings.positions[1];
      ctx.fillStyle = '#fff9eb';
      ctx.font = '700 22px "Space Grotesk", sans-serif';
      ctx.fillText(positionLabel, x + cardW / 2, labelPillY + 29);

      const summaryText = toSafeText(summaries[i], '').trim();
      if (summaryText) {
        const summaryY = labelPillY + labelPillH + 16;
        const summaryH = 160;
        ctx.save();
        ctx.fillStyle = 'rgba(22, 24, 48, 0.52)';
        drawRoundedRect(ctx, x + 4, summaryY, cardW - 8, summaryH, 24);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = 'rgba(255, 248, 235, 0.96)';
        ctx.font = '500 18px "Space Grotesk", sans-serif';
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
    const axisOrder = [
      { key: 'action', label: 'Action', angle: -Math.PI / 2 },
      { key: 'emotion', label: 'Emotion', angle: 0 },
      { key: 'thinking', label: 'Thinking', angle: Math.PI / 2 },
      { key: 'stability', label: 'Stability', angle: Math.PI },
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

    ctx.fillStyle = 'rgba(250, 243, 229, 0.94)';
    ctx.font = '600 30px "Space Grotesk", sans-serif';
    ctx.fillText('Energy Balance', graphCenterX, graphPanelY + 58);

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
      ctx.font = '500 22px "Space Grotesk", sans-serif';
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
    ctx.font = '500 24px "Space Grotesk", sans-serif';
    wrapText(
      ctx,
      energyBalance.interpretation.join(' '),
      graphCenterX,
      graphPanelY + 396,
      graphPanelW - 132,
      30,
      3,
    );

    ctx.fillStyle = 'rgba(228, 230, 245, 0.96)';
    ctx.font = '500 28px "Space Grotesk", sans-serif';
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
    const lucky = resolveLuckyInfo(payload, cardEntry);
    const luckyColors = (lucky.colors || []).slice(0, 3);
    const hasLuckyRow = luckyColors.length > 0;
    const luckyDotColors = luckyColors.map(resolveLuckyColorDot).filter(Boolean).slice(0, 3);
    const mainQuoteText = reading.mainQuoteText || '';
    const archetypeText = reading.archetype || '';
    const cardName = toSafeText(
      payload?.cards?.[0]?.title
      || payload?.cards?.[0]?.name
      || resolveLocalizedCardName(cardEntry?.card, '', lang)
      || '',
      '',
    ).trim();
    const identity = payload?.identity || {};
    const streakLabel = toSafeText(identity?.streakLabel || '', '').trim();
    const softMessage = toSafeText(identity?.softMessage || '', '').trim();
    const phaseLabel = toSafeText(identity?.phase?.label || '', '').trim();
    const identityLine = [streakLabel, softMessage].filter(Boolean).join(` ${strings.identitySeparator} `);
    const phaseLine = phaseLabel ? `${strings.phasePrefix}: ${phaseLabel}` : '';
    const hasReadingPanel = Boolean(mainQuoteText);
    const isUprightTone = resolvedOrientation === 'upright';
    const textPalette = isUprightTone
      ? {
        primary: '#2A3556',
        secondary: '#364063',
        muted: 'rgba(60,70,90,0.72)',
      }
      : {
        primary: '#F8F5EF',
        secondary: 'rgba(235,245,255,0.92)',
        muted: 'rgba(245,245,250,0.88)',
      };
    const readingPanelFill = isUprightTone ? 'rgba(255,255,255,0.55)' : 'rgba(32,44,80,0.72)';
    const quoteShadow = isUprightTone ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.32)';
    const orientationShadow = isUprightTone ? 'rgba(255, 255, 255, 0.28)' : 'rgba(0, 0, 0, 0.22)';
    const layout = {
      headerTop: 136,
      cardTop: 248,
      cardMaxHeight: 900,
      panelTop: 1286,
      panelHeight: 320,
      luckyRowY: 1760,
      footerY: 1860,
    };

    const footerY = layout.footerY;
    const panelX = safeMargin;
    const panelWidth = width - safeMargin * 2;
    const panelTop = layout.panelTop;
    const panelHeight = layout.panelHeight;

    const drawHeader = () => {
      const maxWidth = width - safeMargin * 2;
      let cursorY = layout.headerTop;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = textPalette.primary;
      ctx.font = '700 72px "Poppins", "Space Grotesk", sans-serif';
      wrapText(ctx, strings.title, width / 2, cursorY, maxWidth, 54, 1);
      cursorY += 54;
      ctx.fillStyle = textPalette.secondary;
      ctx.font = '500 38px "Space Grotesk", sans-serif';
      wrapText(ctx, strings.subtitle, width / 2, cursorY, maxWidth, 36, 1);
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
      const orientedId = baseId ? `${baseId}-${cardEntry.orientation}` : '';
      const localPrimary = cardEntry?.card ? resolveLocalPosterFixtureUrl('card', cardEntry.orientation) : '';
      const localUpright = cardEntry?.card ? resolveLocalPosterFixtureUrl('card', 'upright') : '';
      const localBack = resolveLocalPosterFixtureUrl('back');
      let uprightUrl = '';
      let reversedUrl = '';
      let backUrl = localBack || toAssetUrl(resolveCardBackFallbackPath());
      let resolvedPrimary = '';

      if (orientedId) {
        const cardIdentity = { ...(cardEntry.card || {}), id: orientedId, card_id: orientedId, image_id: orientedId };
        ({ uprightUrl, reversedUrl, backUrl } = buildCardImageUrls(cardIdentity, cardEntry.orientation));
        resolvedPrimary = await resolveCardImageUrl(cardIdentity, cardEntry.orientation);
      }

      const { primary: resolvedAssetPrimary, fallbackChain } = resolvePosterCardImageSources(cardEntry, {
        resolvedPrimary,
        uprightUrl,
        reversedUrl,
        backUrl,
        lang,
      });
      const primary = localPrimary || resolvedAssetPrimary;
      emitPosterDebug('waiting_for_card', { url: primary });
      const fallbackUrls = [...new Set([...(localUpright ? [localUpright] : []), ...fallbackChain, localBack || backUrl].filter(Boolean).filter((item) => item !== primary))];
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

    const drawReadingPanel = () => {
      if (!hasReadingPanel) return;

      ctx.save();
      ctx.fillStyle = readingPanelFill;
      drawRoundedRect(ctx, panelX, panelTop, panelWidth, panelHeight, 36);
      ctx.fill();
      ctx.shadowColor = 'rgba(29, 38, 70, 0.18)';
      ctx.shadowBlur = 40;
      ctx.shadowOffsetY = 16;
      ctx.restore();

      const quotePaddingTop = 84;
      const quotePaddingBottom = 42;
      const quoteEdgeSafety = 6;
      let panelCursorY = panelTop + quotePaddingTop;
      const panelCenterX = width / 2;
      const panelTextWidth = panelWidth - 136;
      let quoteY = null;

      ctx.textAlign = 'center';

      if (mainQuoteText) {
        const availableTop = panelCursorY + quoteEdgeSafety;
        const availableBottom = panelTop + panelHeight - quotePaddingBottom - quoteEdgeSafety;
        const quoteMaxHeight = Math.max(0, availableBottom - availableTop);
        const fit = fitDailyQuoteText(ctx, mainQuoteText, panelTextWidth, quoteMaxHeight);
        const quoteOccupiedHeight = fit.occupiedHeight || (fit.lines.length * fit.lineHeight);
        const centeredTop = availableTop + (quoteMaxHeight - quoteOccupiedHeight) / 2;
        const centeredY = centeredTop + fit.ascent;
        const opticalLift = fit.lines.length >= 3
          ? Math.min(14, Math.max(6, Math.round(fit.lineHeight * 0.14)))
          : 0;
        const minQuoteY = availableTop + fit.ascent;
        const maxQuoteY = availableBottom - fit.descent - Math.max(0, fit.lines.length - 1) * fit.lineHeight;
        quoteY = Math.min(maxQuoteY, Math.max(minQuoteY, centeredY - opticalLift));
        ctx.save();
        ctx.fillStyle = textPalette.primary;
        ctx.shadowColor = quoteShadow;
        ctx.shadowBlur = 14;
        ctx.font = `italic 500 ${fit.fontSize}px "Prata", serif`;
        fit.lines.forEach((line, index) => {
          ctx.fillText(line, panelCenterX, quoteY + index * fit.lineHeight);
        });
        panelCursorY = quoteY + fit.descent + Math.max(0, fit.lines.length - 1) * fit.lineHeight;
        ctx.restore();
      }

      return { quoteY };
    };

    const drawOrientationLabel = () => {
      if (!reading.orientation) return;
      const cardBottomY = cardY + cardHeight;
      const minGapY = cardBottomY + 60;
      const orientationY = minGapY;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = textPalette.muted;
      ctx.shadowColor = orientationShadow;
      ctx.shadowBlur = 8;
      ctx.font = '500 30px "Space Grotesk", sans-serif';
      wrapText(ctx, reading.orientation, width / 2, orientationY, width - safeMargin * 2, 34, 1);
      ctx.shadowBlur = 0;
      return orientationY;
    };

    const drawArchetypeLabel = (orientationY) => {
      if (!archetypeText && !cardName) return null;
      const fallbackY = cardY + cardHeight + 124;
      const archetypeY = (orientationY || fallbackY - 64) + 64;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = textPalette.primary;
      if (cardName) {
        ctx.font = '600 50px "Playfair Display", "Prata", serif';
        wrapText(ctx, cardName, width / 2, archetypeY, width - safeMargin * 2, 54, 2);
      }
      const meaningY = cardName ? archetypeY + 64 : archetypeY;
      if (!archetypeText) return meaningY;
      ctx.font = '600 42px "Space Grotesk", sans-serif';
      wrapText(ctx, archetypeText, width / 2, meaningY, width - safeMargin * 2, 48, 2);
      return meaningY;
    };

    let quoteY = null;

    const drawLuckyRow = () => {
      if (!hasLuckyRow) return;
      const minLuckyY = panelTop + panelHeight + 58;
      const maxLuckyY = footerY - 80;
      const rowY = Math.min(Math.max(layout.luckyRowY, minLuckyY), maxLuckyY);
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'center';
      ctx.fillStyle = textPalette.secondary;
      ctx.font = '700 26px "Space Grotesk", sans-serif';
      ctx.fillText(strings.luckyColors, width / 2, rowY);

      const dotRadius = 24;
      const dotGap = 32;
      const count = luckyDotColors.length;
      const totalWidth = count * (dotRadius * 2) + (count - 1) * dotGap;
      let dotX = (width - totalWidth) / 2 + dotRadius;
      const dotY = rowY + 42;
      luckyDotColors.forEach((hex) => {
        const visibility = getLuckyColorVisibilityStyle(hex, readingPanelFill);

        ctx.save();
        ctx.fillStyle = hex;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.10)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 4;
        ctx.beginPath();
        ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = visibility.ringColor;
        ctx.lineWidth = visibility.ringWidth;
        ctx.beginPath();
        ctx.arc(dotX, dotY, dotRadius - (visibility.ringWidth / 2), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        dotX += dotRadius * 2 + dotGap;
      });
    };

    const drawFooter = () => {
      if (identityLine) {
        const identityY = Math.min(footerY - 68, height - safeMargin - 68);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = textPalette.secondary;
        ctx.font = '500 30px "Space Grotesk", sans-serif';
        wrapText(ctx, identityLine, width / 2, identityY, width - safeMargin * 2, 36, 2);
        if (phaseLine) {
          ctx.font = '500 28px "Space Grotesk", sans-serif';
          wrapText(ctx, phaseLine, width / 2, identityY + 40, width - safeMargin * 2, 34, 1);
        }
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 12;
      ctx.fillStyle = textPalette.muted;
      ctx.font = '400 28px "Space Grotesk", sans-serif';
      const safeFooterY = Math.min(footerY, height - safeMargin * 0.6);
      ctx.fillText('meowtarot.com', width / 2, safeFooterY);
      ctx.shadowBlur = 0;
    };

    drawHeader();

    const cardTopY = layout.cardTop;
    const gapBeforePanel = 48;
    const maxCardWidth = Math.min(690, width - safeMargin * 2);
    const maxCardHeight = Math.min(layout.cardMaxHeight, Math.max(0, panelTop - gapBeforePanel - cardTopY));
    const fallbackAspect = 2 / 3;
    const fallbackWidth = Math.min(
      maxCardWidth,
      maxCardHeight ? maxCardHeight * fallbackAspect : maxCardWidth,
    );
    const fallbackHeight = fallbackWidth / fallbackAspect;
    cardWidth = fallbackWidth || 560;
    cardHeight = fallbackHeight || Math.round(560 * 1.5);
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
    const heightScale = maxCardHeight ? maxCardHeight / imgHeight : 1;
    const scale = Math.min(maxCardWidth / imgWidth, heightScale);
    cardWidth = Math.max(0, imgWidth * scale);
    cardHeight = Math.max(0, imgHeight * scale);
    const cardX = (width - cardWidth) / 2;

    if (cardWidth && cardHeight) {
      const cardRadius = 28;
      const drawCardGlow = (blur, alpha) => {
        ctx.save();
        ctx.shadowColor = `rgba(255, 245, 220, ${alpha})`;
        ctx.shadowBlur = blur;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, cardRadius);
        ctx.fillStyle = 'rgba(255, 245, 220, 0.02)';
        ctx.fill();
        ctx.restore();
      };
      drawCardGlow(18, 0.42);
      drawCardGlow(42, 0.30);
      drawCardGlow(70, 0.18);
      if (cardImg) {
        ctx.save();
        drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, cardRadius);
        ctx.clip();
        ctx.drawImage(cardImg, cardX, cardY, cardWidth, cardHeight);
        ctx.restore();
      }
      posterCiLog('draw_card', {
        executed: Boolean(cardImg),
        w: Math.round(cardWidth),
        h: Math.round(cardHeight),
      });
    }
    const textBlocks = {
      orientationOutsidePanel: Boolean(reading.orientation),
      archetypeText: Boolean(archetypeText),
      mainQuoteText: Boolean(mainQuoteText),
      supportingLine: false,
    };
    posterCiLog('draw_text', {
      executed: hasReadingPanel,
      blocks: Object.values(textBlocks).filter(Boolean).length,
      detail: textBlocks,
    });
    const orientationY = drawOrientationLabel();
    drawArchetypeLabel(orientationY);
    ({ quoteY } = drawReadingPanel() || { quoteY: null });
    if (isPosterDebugEnabled()) {
      posterDebugLog('info', '[poster-debug][daily]', {
        lang,
        orientationLabel: reading.orientation,
        outsidePanelOrientation: true,
        archetypeText,
        tarotImplyUsed: false,
        mainQuoteSource: reading.mainQuoteSource,
        mainQuoteText,
        quoteY,
        supportingLineSource: reading.supportingLineSource,
        supportLineText: '',
        luckyColorsLength: luckyColors.length,
        luckyDotColors,
      });
    }
    drawLuckyRow();
    drawFooter();
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
  ctx.fillStyle = '#f8d77a';
  ctx.font = '600 72px "Poppins", "Space Grotesk", sans-serif';
  ctx.fillText(title, width / 2, 150);

  ctx.fillStyle = '#d8dbe6';
  ctx.font = '500 38px "Space Grotesk", sans-serif';
  if (subtitle) {
    ctx.fillText(subtitle, width / 2, 215);
  }

  if (keywords.length) {
    ctx.fillStyle = '#f7f4ee';
    ctx.font = '500 32px "Space Grotesk", sans-serif';
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
      const orientedId = `${baseId}-${entry.orientation}`;
      const uprightId = `${baseId}-upright`;
      const cardIdentity = { ...entry.card, id: orientedId, card_id: orientedId, image_id: orientedId };
      const { uprightUrl, reversedUrl, backUrl } = buildCardImageUrls(cardIdentity, entry.orientation);
      const resolvedPrimary = await resolveCardImageUrl(cardIdentity, entry.orientation);
      try {
        const { primary: selectedUrl, fallbackChain } = resolvePosterCardImageSources(entry, {
          resolvedPrimary,
          uprightUrl,
          reversedUrl,
          backUrl,
          lang: payload?.lang || 'en',
        });
        emitPosterDebug('waiting_for_card', { url: selectedUrl });
        const img = await loadPosterCardImageWithTimeout(selectedUrl, fallbackChain);
        emitLegacyCardProbe({ ok: true, url: img?.currentSrc || img?.src || resolvedPrimary || reversedUrl || uprightUrl || backUrl, w: img?.naturalWidth || cardWidth, h: img?.naturalHeight || cardHeight });
        ctx.drawImage(img, x, y, cardWidth, cardHeight);
      } catch (error) {
        emitLegacyCardProbe({ ok: false, url: resolvedPrimary || reversedUrl || uprightUrl || backUrl, error: error?.message || String(error) });
        console.warn('[Poster] card image failed', { url: resolvedPrimary || reversedUrl || uprightUrl || backUrl, reason: error?.message || String(error) });
      }
    }
  }
  posterDebugLog('log', '[Poster] Images resolved');

  ctx.fillStyle = '#f7f4ee';
  ctx.font = '500 30px "Space Grotesk", sans-serif';
  const headline = toSafeText(payload?.headline, '');
  if (!headline.trim()) {
    console.warn('[Poster] missing headline text');
  }
  drawTextBlock(ctx, headline, width / 2, height * 0.73, width * 0.78, 38);

  ctx.fillStyle = '#aab0c9';
  ctx.font = '500 28px "Space Grotesk", sans-serif';
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

export { PRESETS };
