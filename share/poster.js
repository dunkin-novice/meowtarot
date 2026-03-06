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
import { findCardById, toOrientation } from '../js/reading-helpers.js';
import { getLocalizedField, getOrientationLabel } from '../js/tarot-format.js';
import {
  buildCardImageUrls,
  resolveCardBackFallbackPath,
  resolveCardImageUrl,
  resolvePosterBackgroundPath,
  toAssetUrl,
} from '../js/asset-resolver.js';


const PRESETS = {
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1350 },
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

function toSafeText(value, fallback = '') {
  if (value == null) return fallback;
  return String(value);
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
  const cards = Array.isArray(payload?.cards) ? payload.cards : [];
  return cards
    .map((entry) => {
      const orientation = toOrientation(entry?.orientation || entry?.id || 'upright');
      const targetId = baseCardId(entry?.id || entry?.cardId || entry?.card_id);
      const hit = findCardById(meowTarotCards, targetId, normalizeId);
      return hit
        ? {
          card: hit,
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

function getDailyStrings(lang = 'en') {
  if (lang === 'th') {
    return {
      title: 'MeowTarot',
      subtitle: 'คำทำนายรายวัน',
      luckyColors: 'สีมงคลวันนี้',
    };
  }
  return {
    title: 'MeowTarot',
    subtitle: 'Daily Reading',
    luckyColors: 'Lucky Colors',
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
function isDailySingle(payload) {
  const posterMode = String(payload?.poster?.mode || payload?.mode || '').toLowerCase();
  return posterMode === 'daily';
}

function buildDailyReadingFromCard(card, orientation, lang) {
  if (!card) return null;
  const orient = getOrientationLabel(orientation, lang);
  return {
    orientation: orient,
    archetype: getLocalizedField(card, 'archetype', lang),
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
  const readingResult = payloadReading.readingResult || payloadReading.result || payloadReading.summary || '';
  const mainQuoteText = hook || actionPrompt || readingResult || '';
  const mainQuoteSource = hook ? 'hook' : (actionPrompt ? 'action_prompt' : (readingResult ? 'reading_result' : 'none'));
  return {
    orientation: getOrientationLabel(resolvedOrientation, lang) || cardReading.orientation || fallbackOrientation,
    archetype: cardReading.archetype || '',
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
      { value: card.affirmation_en, tier: 5 },
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


function resolveEnergyBalance(cardEntries, summaries) {
  const cards = cardEntries.map((entry) => entry?.card || {});
  const scores = { action: 52, emotion: 52, thinking: 52, stability: 52 };
  const boostByElement = {
    fire: { action: 12, emotion: 2, thinking: 0, stability: -2 },
    water: { action: -2, emotion: 12, thinking: 2, stability: 0 },
    air: { action: 1, emotion: 0, thinking: 12, stability: -1 },
    earth: { action: 0, emotion: -1, thinking: 2, stability: 12 },
  };

  cards.forEach((card, idx) => {
    const element = toSafeText(card?.element, '').trim().toLowerCase();
    const boost = boostByElement[element] || {};
    scores.action += boost.action || 0;
    scores.emotion += boost.emotion || 0;
    scores.thinking += boost.thinking || 0;
    scores.stability += boost.stability || 0;

    const num = Number.parseFloat(toSafeText(card?.numerology_value, '').trim());
    if (Number.isFinite(num)) {
      scores.action += num % 2 === 0 ? 1 : 2;
      scores.thinking += num >= 10 ? 2 : 1;
      scores.stability += idx === 1 ? 2 : 1;
    }
  });

  const presentTier = summaries?.[1]?.sourceTier || 99;
  if (presentTier <= 3) scores.action += 6;
  if (presentTier === 4 || presentTier === 5) scores.emotion += 4;
  if (presentTier >= 6) scores.thinking += 5;

  Object.keys(scores).forEach((key) => {
    scores[key] = Math.max(28, Math.min(92, Math.round(scores[key])));
  });

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

  if (String(payload?.mode || '').toLowerCase() === 'full' && preset === 'story') {
    const lang = payload?.lang || 'en';
    const cardEntries = (await buildCardEntries(payload)).slice(0, 3);
    const summaries = resolveFullSummaries(payload, cardEntries);
    const labels = lang === 'th'
      ? ['อะไรที่คุณเจอมาก่อน', 'สิ่งที่คุณกำลังเจอ', 'อะไรที่คุณกำลังจะเจอ']
      : ['What still affects you', 'What you need now', 'Where this is going'];
    const symbolic = resolveSymbolicMetadata(cardEntries);

    const topStripHeight = 170;
    const bottomStripHeight = 420;
    const topGrad = ctx.createLinearGradient(0, 0, 0, topStripHeight);
    topGrad.addColorStop(0, 'rgba(5,10,25,0.85)');
    topGrad.addColorStop(1, 'rgba(5,10,25,0.25)');
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, width, topStripHeight);

    const bottomY = height - bottomStripHeight;
    const bottomGrad = ctx.createLinearGradient(0, bottomY, 0, height);
    bottomGrad.addColorStop(0, 'rgba(5,10,25,0.15)');
    bottomGrad.addColorStop(1, 'rgba(5,10,25,0.72)');
    ctx.fillStyle = bottomGrad;
    ctx.fillRect(0, bottomY, width, bottomStripHeight);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#f8d77a';
    ctx.font = '700 62px "Poppins", "Space Grotesk", sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = 14;
    ctx.fillText('MeowTarot', width / 2, 100);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#efe4c2';
    ctx.font = '500 24px "Space Grotesk", sans-serif';
    drawTrackingText(ctx, 'Your Tarot Reading', width / 2, 142, 0.8);

    const sideCardW = 240;
    const presentCardW = 310;
    const sideCardH = Math.round(sideCardW * 1.5);
    const presentCardH = Math.round(presentCardW * 1.5);
    const gap = 20;
    const totalW = sideCardW * 2 + presentCardW + gap * 2;
    const startX = (width - totalW) / 2;
    const cardY = 214;
    const cardLayouts = [
      { x: startX, w: sideCardW, h: sideCardH },
      { x: startX + sideCardW + gap, w: presentCardW, h: presentCardH },
      { x: startX + sideCardW + gap + presentCardW + gap, w: sideCardW, h: sideCardH },
    ];

    for (let i = 0; i < 3; i += 1) {
      const entry = cardEntries[i];
      const layout = cardLayouts[i];
      const x = layout.x;
      const cardW = layout.w;
      const cardH = layout.h;
      ctx.save();
      ctx.fillStyle = 'rgba(15, 20, 41, 0.9)';
      ctx.fillRect(x, cardY, cardW, cardH);
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
            lang,
          });
          emitPosterDebug('waiting_for_card', { url: selectedUrl });
          const img = await loadPosterCardImageWithTimeout(selectedUrl, fallbackChain);
          emitLegacyCardProbe({ ok: true, url: img?.currentSrc || img?.src || resolvedPrimary || reversedUrl || uprightUrl || backUrl, w: img?.naturalWidth || cardW, h: img?.naturalHeight || cardH });
          ctx.drawImage(img, x, cardY, cardW, cardH);
        } catch (error) {
          emitLegacyCardProbe({ ok: false, url: resolvedPrimary || reversedUrl || uprightUrl || backUrl, error: error?.message || String(error) });
          console.warn('[Poster] card image failed', { url: resolvedPrimary || reversedUrl || uprightUrl || backUrl, reason: error?.message || String(error) });
        }
      }

      const orientationText = getOrientationLabel(entry?.orientation || 'upright', lang);
      const archetypeText = getLocalizedField(entry?.card, 'archetype', lang);

      const textY = cardY + cardH + 14;
      ctx.fillStyle = 'rgba(226, 230, 242, 0.92)';
      ctx.font = '500 22px "Space Grotesk", sans-serif';
      wrapText(ctx, orientationText, x + cardW / 2, textY, cardW, 24, 1);
      ctx.fillStyle = '#fbf8f2';
      ctx.font = i === 1 ? '650 27px "Space Grotesk", sans-serif' : '650 23px "Space Grotesk", sans-serif';
      wrapText(ctx, archetypeText, x + cardW / 2, textY + 32, cardW, i === 1 ? 30 : 27, 2);
    }

    const cardCenters = cardLayouts.map((layout) => layout.x + layout.w / 2);
    const maxCardBottom = Math.max(...cardLayouts.map((layout) => cardY + layout.h));
    const cardsRowBottom = maxCardBottom + 14 + 32 + 30 * 2;

    const darkLabelColor = '#342b57';
    const darkTextColor = '#27233f';
    const darkMetaColor = '#403860';

    const presentSummary = summaries[1] || { text: '', sourceTier: 99 };
    const presentShort = presentSummary.sourceTier <= 5;
    const presentLabelY = cardsRowBottom + 40;
    const presentTextY = presentLabelY + 52;
    const presentTextSize = presentShort ? 43 : 34;
    const presentLineHeight = presentShort ? 48 : 40;
    const presentMaxLines = presentShort ? 4 : 5;

    ctx.fillStyle = darkLabelColor;
    ctx.font = '650 36px "Space Grotesk", sans-serif';
    wrapText(ctx, labels[1], cardCenters[1], presentLabelY, presentCardW + 100, 40, 2);

    ctx.fillStyle = darkTextColor;
    ctx.font = `560 ${presentTextSize}px "Space Grotesk", sans-serif`;
    const presentEndY = wrapText(ctx, presentSummary.text || '', cardCenters[1], presentTextY, presentCardW + 90, presentLineHeight, presentMaxLines);

    const sideBaseY = presentEndY + 28;
    let sideBottom = sideBaseY;
    for (const i of [0, 2]) {
      const summary = summaries[i] || { text: '', sourceTier: 99 };
      const shortReflection = summary.sourceTier <= 5;
      const labelY = sideBaseY;
      const textY = labelY + 38;
      const fontSize = shortReflection ? 22 : 20;
      const lineHeight = shortReflection ? 28 : 26;
      const maxLines = shortReflection ? 3 : 4;

      ctx.fillStyle = darkLabelColor;
      ctx.font = '620 23px "Space Grotesk", sans-serif';
      wrapText(ctx, labels[i], cardCenters[i], labelY, sideCardW + 52, 28, 2);

      ctx.fillStyle = darkTextColor;
      ctx.font = `500 ${fontSize}px "Space Grotesk", sans-serif`;
      const endY = wrapText(ctx, summary.text || '', cardCenters[i], textY, sideCardW + 40, lineHeight, maxLines);
      sideBottom = Math.max(sideBottom, endY);
    }

    const readingBottom = Math.max(sideBottom, presentEndY);
    const symbolicTop = readingBottom + 32;
    const symbolicLines = [
      symbolic.element ? `Element: ${symbolic.element} 🌿` : '',
      symbolic.planet ? `Planet: ${symbolic.planet} 🌙` : '',
      symbolic.numerology ? `Numerology: ${symbolic.numerology}` : '',
    ].filter(Boolean);

    ctx.fillStyle = darkMetaColor;
    ctx.font = '500 22px "Space Grotesk", sans-serif';
    let symbolicY = symbolicTop;
    symbolicLines.forEach((line) => {
      wrapText(ctx, line, width / 2, symbolicY, width - 180, 28, 1);
      symbolicY += 28;
    });

    const { scores, interpretation } = resolveEnergyBalance(cardEntries, summaries);
    const graphTop = symbolicY + 2;
    const graphCenterX = width / 2;
    const graphCenterY = graphTop + 130;
    const graphRadius = 115;

    const axis = [
      { key: 'action', label: 'Action', angle: -Math.PI / 2 },
      { key: 'emotion', label: 'Emotion', angle: 0 },
      { key: 'thinking', label: 'Thinking', angle: Math.PI / 2 },
      { key: 'stability', label: 'Stability', angle: Math.PI },
    ];

    ctx.save();
    ctx.strokeStyle = 'rgba(100, 100, 150, 0.2)';
    ctx.lineWidth = 2;
    for (let level = 1; level <= 4; level += 1) {
      const r = graphRadius * (level / 4);
      ctx.beginPath();
      axis.forEach((entry, idx) => {
        const px = graphCenterX + Math.cos(entry.angle) * r;
        const py = graphCenterY + Math.sin(entry.angle) * r;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(90, 88, 140, 0.28)';
    axis.forEach((entry) => {
      ctx.beginPath();
      ctx.moveTo(graphCenterX, graphCenterY);
      ctx.lineTo(graphCenterX + Math.cos(entry.angle) * graphRadius, graphCenterY + Math.sin(entry.angle) * graphRadius);
      ctx.stroke();
    });

    const points = axis.map((entry) => {
      const ratio = Math.max(0, Math.min(1, (scores[entry.key] || 0) / 100));
      return {
        x: graphCenterX + Math.cos(entry.angle) * graphRadius * ratio,
        y: graphCenterY + Math.sin(entry.angle) * graphRadius * ratio,
      };
    });

    const energyGrad = ctx.createLinearGradient(graphCenterX - graphRadius, graphCenterY - graphRadius, graphCenterX + graphRadius, graphCenterY + graphRadius);
    energyGrad.addColorStop(0, 'rgba(181, 223, 238, 0.5)');
    energyGrad.addColorStop(0.5, 'rgba(245, 216, 232, 0.45)');
    energyGrad.addColorStop(1, 'rgba(186, 194, 245, 0.48)');

    ctx.beginPath();
    points.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.fillStyle = energyGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(124, 111, 170, 0.46)';
    ctx.lineWidth = 3;
    ctx.stroke();

    const nodeColors = ['#f3d8ea', '#f6e0d0', '#efe5c8', '#c9f0de'];
    points.forEach((p, idx) => {
      ctx.beginPath();
      ctx.fillStyle = nodeColors[idx % nodeColors.length];
      ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(88, 78, 126, 0.42)';
      ctx.stroke();
    });

    ctx.fillStyle = darkLabelColor;
    ctx.font = '500 22px "Space Grotesk", sans-serif';
    axis.forEach((entry) => {
      const labelR = graphRadius + 34;
      const lx = graphCenterX + Math.cos(entry.angle) * labelR;
      const ly = graphCenterY + Math.sin(entry.angle) * labelR;
      wrapText(ctx, entry.label, lx, ly, 230, 32, 1);
    });
    ctx.restore();

    const interpretationY = graphCenterY + graphRadius + 52;
    ctx.fillStyle = darkLabelColor;
    ctx.font = '500 24px "Space Grotesk", sans-serif';
    wrapText(ctx, interpretation[0], width / 2, interpretationY, width - 150, 29, 1);
    ctx.font = '500 22px "Space Grotesk", sans-serif';
    wrapText(ctx, interpretation[1], width / 2, interpretationY + 29, width - 150, 27, 1);

    ctx.fillStyle = '#8f96b5';
    ctx.font = '500 23px "Space Grotesk", sans-serif';
    ctx.fillText('meowtarot.com', width / 2, height - 36);

    const exportStart = performance.now();
    perf.captureCount += 1;
    posterDebugLog('info', '[share-export] captureCount:', perf.captureCount);
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
    const hasReadingPanel = Boolean(mainQuoteText);
    const quoteIsCompact = mainQuoteText.length > 72;
    const quoteLineHeight = quoteIsCompact ? 66 : 72;
    const quoteMaxLines = quoteIsCompact ? 3 : 2;
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
      headerTop: 144,
      cardTop: 276,
      cardMaxHeight: 900,
      panelTop: 1320,
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
      ctx.shadowColor = 'rgba(0,0,0,0.78)';
      ctx.shadowBlur = 16;
      wrapText(ctx, strings.title, width / 2, cursorY, maxWidth, 54, 1);
      ctx.shadowBlur = 0;
      cursorY += 54;
      ctx.fillStyle = textPalette.secondary;
      ctx.font = '500 38px "Space Grotesk", sans-serif';
      ctx.shadowColor = 'rgba(0,0,0,0.72)';
      ctx.shadowBlur = 10;
      wrapText(ctx, strings.subtitle, width / 2, cursorY, maxWidth, 36, 1);
      ctx.shadowBlur = 0;
    };

    const resolveCardImage = async () => {
      if (!cardEntry?.card) return null;
      const baseId = baseCardId(cardEntry.card.id || cardEntry.card.card_id || cardEntry.card.image_id);
      const orientedId = `${baseId}-${cardEntry.orientation}`;
      const localPrimary = resolveLocalPosterFixtureUrl('card', cardEntry.orientation);
      const localUpright = resolveLocalPosterFixtureUrl('card', 'upright');
      const localBack = resolveLocalPosterFixtureUrl('back');
      const cardIdentity = { ...cardEntry.card, id: orientedId, card_id: orientedId, image_id: orientedId };
      const { uprightUrl, reversedUrl, backUrl } = buildCardImageUrls(cardIdentity, cardEntry.orientation);
      const resolvedPrimary = await resolveCardImageUrl(cardIdentity, cardEntry.orientation);
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

      let panelCursorY = panelTop + 66;
      const panelCenterX = width / 2;
      const panelTextWidth = panelWidth - 120;
      let quoteY = null;

      ctx.textAlign = 'center';

      if (mainQuoteText) {
        const quoteBlockHeight = quoteLineHeight * quoteMaxLines;
        const availableTop = panelCursorY;
        const availableBottom = panelTop + panelHeight - 30;
        quoteY = Math.max(availableTop, availableTop + (availableBottom - availableTop - quoteBlockHeight) / 2);
        ctx.save();
        ctx.fillStyle = textPalette.primary;
        ctx.shadowColor = quoteShadow;
        ctx.shadowBlur = 14;
        ctx.font = quoteIsCompact ? 'italic 500 52px "Prata", serif' : 'italic 500 58px "Prata", serif';
        panelCursorY = wrapText(
          ctx,
          `“${mainQuoteText}”`,
          panelCenterX,
          quoteY,
          panelTextWidth,
          quoteLineHeight,
          quoteMaxLines,
        );
        ctx.restore();
      }

      return { quoteY };
    };

    const drawOrientationLabel = () => {
      if (!reading.orientation) return;
      const cardBottomY = cardY + cardHeight;
      const panelLabelY = panelTop - 76;
      const minGapY = cardBottomY + 56;
      const orientationY = Math.min(panelLabelY, minGapY);
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
      if (!archetypeText) return null;
      const fallbackY = cardY + cardHeight + 114;
      const archetypeY = Math.min(panelTop - 26, (orientationY || fallbackY - 44) + 56);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = textPalette.primary;
      ctx.font = '600 42px "Space Grotesk", sans-serif';
      wrapText(ctx, archetypeText, width / 2, archetypeY, width - safeMargin * 2, 48, 2);
      return archetypeY;
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
        ctx.save();
        ctx.fillStyle = hex;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.10)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 4;
        ctx.beginPath();
        ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        dotX += dotRadius * 2 + dotGap;
      });
    };

    const drawFooter = () => {
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
    const gapBeforePanel = 64;
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
