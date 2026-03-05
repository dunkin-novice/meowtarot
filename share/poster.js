import {
  loadTarotData,
  meowTarotCards,
  normalizeId,
} from '../js/data.js';
import { imageManager } from '../js/image-manager.js';
import { normalizePayload } from './normalize-payload.js';
import { findCardById, toOrientation } from '../js/reading-helpers.js';
import { getLocalizedField, getOrientationLabel } from '../js/tarot-format.js';
import {
  resolveCardBackFallbackPath,
  resolveCardBackPath,
  resolveCardFacePath,
  resolvePosterBackgroundPath,
  toAssetUrl,
} from '../js/asset-resolver.js';

const POSTER_WEBP_QUALITY = 0.78;
const POSTER_RETRY_WEBP_QUALITY = 0.72;
const POSTER_WARN_MAX_BYTES = 600 * 1024;

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
  const runtimeEnv = (typeof globalThis !== 'undefined' && globalThis.process?.env) ? globalThis.process.env : null;
  const envFlag = runtimeEnv?.POSTER_DEBUG;
  if (String(envFlag || '').trim() === '1') return true;
  if (typeof window === 'undefined') return false;
  return String(window.POSTER_DEBUG || '').trim() === '1';
}

function posterCiLog(step, payload = {}) {
  if (!isPosterCiDebugEnabled()) return;
  console.log(JSON.stringify({ step, ...payload }));
}

async function probeImageLoad(url, kind) {
  if (!isPosterCiDebugEnabled() || !url || typeof fetch !== 'function') return;
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
    const res = await fetch(url, { method: 'HEAD', mode: 'cors' });
    status = res.status;
    ok = res.ok;
    attachMeta(res);
  } catch (error) {
    method = 'GET';
    try {
      const res = await fetch(url, { method: 'GET', mode: 'cors' });
      status = res.status;
      ok = res.ok;
      attachMeta(res);
    } catch (fallbackError) {
      errorMessage = fallbackError?.message || String(fallbackError);
    }
  }

  posterCiLog('img_probe', {
    kind,
    url,
    ok,
    status,
    method,
    error: errorMessage,
    response: responseMeta,
  });
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

async function canvasToBlob(canvas, quality = POSTER_WEBP_QUALITY) {
  const primary = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
  if (primary && primary.type === 'image/webp') {
    if (primary.size > POSTER_WARN_MAX_BYTES) {
      console.warn('[share] Poster blob size high:', primary.size, 'bytes');
      const retry = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', POSTER_RETRY_WEBP_QUALITY));
      if (retry && retry.type === 'image/webp') {
        if (retry.size > POSTER_WARN_MAX_BYTES) {
          console.warn('[share] Poster blob still high after retry:', retry.size, 'bytes');
        }
        return retry.size <= primary.size ? retry : primary;
      }
    }

    return primary;
  }

  const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 0.92));
  return pngBlob;
}

function baseCardId(id = '') {
  return normalizeId(String(id).replace(/-(upright|reversed)$/i, '')) || normalizeId(id);
}

function toSafeText(value, fallback = '') {
  if (value == null) return fallback;
  return String(value);
}

async function buildCardEntries(payload) {
  console.log('[Poster] buildCardEntries: meowTarotCards length', meowTarotCards.length);
  if (meowTarotCards.length < 150) {
    await ensureTarotData();
    console.log('[Poster] tarot deck ensured', {
      size: Array.isArray(meowTarotCards) ? meowTarotCards.length : 0,
    });
    console.log('[Poster] buildCardEntries: reloaded tarot data', meowTarotCards.length);
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
        }
        : {
          card: null,
          orientation,
          name: entry?.name || targetId,
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
  const primaryBgUrl = localBgUrl || toAssetUrl(resolvePosterBackgroundPath({ payload }));
  const fallbackBgUrl = localBgUrl || toAssetUrl('backgrounds/bg-000.webp');
  const bgCandidates = [primaryBgUrl, fallbackBgUrl];
  posterCiLog('bg_url', { primary: primaryBgUrl, fallback: fallbackBgUrl });

  for (const bgUrl of bgCandidates) {
    try {
      await probeImageLoad(bgUrl, 'background');
      const bg = await imageManager.loadImage(bgUrl, { crossOrigin: 'anonymous' });
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
  gradient.addColorStop(0, '#0b1020');
  gradient.addColorStop(1, '#141c33');
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
    actionPrompt: getLocalizedField(card, 'action_prompt', lang),
    keywords: getLocalizedField(card, 'tarot_imply', lang),
  };
}

function resolveDailyReading(payload, cardEntry, lang) {
  const payloadReading = payload?.reading || {};
  const resolvedOrientation = resolveDailyReadingOrientation(payload, cardEntry);
  const cardReading = buildDailyReadingFromCard(cardEntry?.card, resolvedOrientation, lang) || {};
  const fallbackOrientation = getOrientationLabel(resolvedOrientation || resolveDailyOrientation(payload), lang);
  const localizedActionPrompt = payloadReading[`action_prompt_${lang}`] || payloadReading.action_prompt || '';
  const actionPrompt = localizedActionPrompt || cardReading.actionPrompt || '';
  const readingResult = payloadReading.readingResult || payloadReading.result || payloadReading.summary || '';
  const mainQuoteText = actionPrompt || readingResult || '';
  const mainQuoteSource = actionPrompt ? 'action_prompt' : (readingResult ? 'reading_result' : 'none');
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



function resolveFullSummaries(payload, cardEntries, lang) {
  const reading = payload?.reading || {};
  const getCard = (idx) => cardEntries[idx]?.card || null;
  return [
    getLocalizedField(getCard(0), 'reading_summary_past', lang) || reading.reading_summary_past || '',
    getLocalizedField(getCard(1), 'reading_summary_present', lang) || reading.reading_summary_present || '',
    getLocalizedField(getCard(2), 'reading_summary_future', lang) || reading.reading_summary_future || '',
  ];
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
  console.log('[Poster] Data loaded', { preloadMs: Number(perf.preloadMs.toFixed(1)) });

  const { width, height } = PRESETS[preset] || PRESETS.story;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const fontFamilies = ['"Poppins", sans-serif', '"Space Grotesk", sans-serif', '"Prata", serif'];
  fontFamilies.forEach((family) => {
    ctx.font = `16px ${family}`;
    ctx.fillText(' ', 0, 0);
  });

  const backgroundUrl = await drawPosterBackground(ctx, width, height, payload);
  console.log('[Poster] Background resolved', backgroundUrl || 'fallback-gradient');

  if (String(payload?.mode || '').toLowerCase() === 'full' && preset === 'story') {
    const lang = payload?.lang || 'en';
    const cardEntries = (await buildCardEntries(payload)).slice(0, 3);
    const summaries = resolveFullSummaries(payload, cardEntries, lang);
    const labels = lang === 'th' ? ['อดีต', 'ปัจจุบัน', 'อนาคต'] : ['Past', 'Present', 'Future'];

    const topStripHeight = 170;
    const bottomStripHeight = 560;
    const topGrad = ctx.createLinearGradient(0, 0, 0, topStripHeight);
    topGrad.addColorStop(0, 'rgba(5,10,25,0.85)');
    topGrad.addColorStop(1, 'rgba(5,10,25,0.25)');
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, width, topStripHeight);

    const bottomY = height - bottomStripHeight;
    const bottomGrad = ctx.createLinearGradient(0, bottomY, 0, height);
    bottomGrad.addColorStop(0, 'rgba(5,10,25,0.15)');
    bottomGrad.addColorStop(1, 'rgba(5,10,25,0.92)');
    ctx.fillStyle = bottomGrad;
    ctx.fillRect(0, bottomY, width, bottomStripHeight);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#f8d77a';
    ctx.font = '700 62px "Poppins", "Space Grotesk", sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = 14;
    ctx.fillText('MeowTarot', width / 2, 100);
    ctx.shadowBlur = 0;

    const cardW = 220;
    const cardH = Math.round(cardW * 1.55);
    const gap = 24;
    const totalW = cardW * 3 + gap * 2;
    const startX = (width - totalW) / 2;
    const cardY = 190;

    for (let i = 0; i < 3; i += 1) {
      const entry = cardEntries[i];
      const x = startX + i * (cardW + gap);
      ctx.save();
      ctx.fillStyle = 'rgba(15, 20, 41, 0.9)';
      ctx.fillRect(x, cardY, cardW, cardH);
      ctx.restore();

      if (entry?.card) {
        const baseId = baseCardId(entry.card.id || entry.card.card_id || entry.card.image_id);
        const orientedId = `${baseId}-${entry.orientation}`;
        const uprightId = `${baseId}-upright`;
        const facePack = payload?.poster?.assetPack || 'meow-v1';
        const backPack = payload?.poster?.backPack || 'meow-v2';
        const primary = toAssetUrl(resolveCardFacePath({ id: orientedId, pack: facePack }));
        const fallback = entry.orientation === 'reversed'
          ? toAssetUrl(resolveCardFacePath({ id: uprightId, pack: facePack }))
          : null;
        const finalFallback = toAssetUrl(resolveCardBackPath({ preferredPack: backPack }));
        try {
          const img = await imageManager.loadImageWithFallback(primary, [fallback, finalFallback].filter(Boolean));
          ctx.drawImage(img, x, cardY, cardW, cardH);
        } catch (error) {
          console.warn('[Poster] card image failed', { url: primary, reason: error?.message || String(error) });
        }
      }

      const orientationText = getOrientationLabel(entry?.orientation || 'upright', lang);
      const archetypeText = getLocalizedField(entry?.card, 'archetype', lang);
      const implyText = getLocalizedField(entry?.card, 'tarot_imply', lang);

      const textY = cardY + cardH + 28;
      ctx.fillStyle = '#d8dbe6';
      ctx.font = '500 18px "Space Grotesk", sans-serif';
      wrapText(ctx, orientationText, x + cardW / 2, textY, cardW, 24, 1);
      ctx.fillStyle = '#f7f4ee';
      ctx.font = '600 20px "Space Grotesk", sans-serif';
      wrapText(ctx, archetypeText, x + cardW / 2, textY + 30, cardW, 24, 2);
      ctx.fillStyle = '#bfc5dd';
      ctx.font = '400 16px "Space Grotesk", sans-serif';
      wrapText(ctx, implyText, x + cardW / 2, textY + 82, cardW, 21, 3);
    }

    const boxTop = height - 330;
    const boxW = 220;
    const boxH = 220;
    for (let i = 0; i < 3; i += 1) {
      const x = startX + i * (boxW + gap);
      ctx.save();
      ctx.fillStyle = 'rgba(20, 28, 51, 0.72)';
      drawRoundedRect(ctx, x, boxTop, boxW, boxH, 16);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = '#f8d77a';
      ctx.font = '600 20px "Space Grotesk", sans-serif';
      wrapText(ctx, labels[i], x + boxW / 2, boxTop + 34, boxW - 16, 22, 1);
      ctx.fillStyle = '#f1f3fa';
      ctx.font = '400 15px "Space Grotesk", sans-serif';
      wrapText(ctx, summaries[i], x + boxW / 2, boxTop + 62, boxW - 18, 20, 7);
    }

    ctx.fillStyle = '#aab0c9';
    ctx.font = '500 28px "Space Grotesk", sans-serif';
    ctx.fillText('meowtarot.com', width / 2, height - 36);

    const exportStart = performance.now();
    perf.captureCount += 1;
    console.info('[share-export] captureCount:', perf.captureCount);
    const blob = await canvasToBlob(canvas, POSTER_WEBP_QUALITY);
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
    const reading = resolveDailyReading(payload, cardEntry, lang);
    const lucky = resolveLuckyInfo(payload, cardEntry);
    const luckyColors = (lucky.colors || []).slice(0, 4);
    const hasLuckyRow = luckyColors.length > 0;
    const luckyDotColors = luckyColors.map(resolveLuckyColorDot).filter(Boolean).slice(0, 3);
    const mainQuoteText = reading.mainQuoteText || '';
    const archetypeText = reading.archetype || '';
    const hasReadingPanel = Boolean(archetypeText || mainQuoteText);
    const layout = {
      headerTop: 160,
      logoY: 80,
      cardTop: 260,
      cardMaxHeight: 1100,
      panelTop: 1400,
      panelHeight: 400,
      panelPadding: 40,
      luckyRowY: 1724,
      footerY: 1880,
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
      ctx.fillStyle = '#f8d77a';
      ctx.font = '600 62px "Poppins", "Space Grotesk", sans-serif';
      ctx.shadowColor = 'rgba(0,0,0,0.78)';
      ctx.shadowBlur = 16;
      wrapText(ctx, strings.title, width / 2, cursorY, maxWidth, 54, 1);
      ctx.shadowBlur = 0;
      cursorY += 62;
      ctx.fillStyle = '#d8dbe6';
      ctx.font = '500 36px "Space Grotesk", sans-serif';
      ctx.shadowColor = 'rgba(0,0,0,0.72)';
      ctx.shadowBlur = 10;
      wrapText(ctx, strings.subtitle, width / 2, cursorY, maxWidth, 36, 1);
      ctx.shadowBlur = 0;
    };

    const resolveCardImage = async () => {
      if (!cardEntry?.card) return null;
      const baseId = baseCardId(cardEntry.card.id || cardEntry.card.card_id || cardEntry.card.image_id);
      const orientedId = `${baseId}-${cardEntry.orientation}`;
      const uprightId = `${baseId}-upright`;
      const facePack = payload?.poster?.assetPack || 'meow-v1';
      const backPack = payload?.poster?.backPack || 'meow-v2';
      const localPrimary = resolveLocalPosterFixtureUrl('card', cardEntry.orientation);
      const localUpright = resolveLocalPosterFixtureUrl('card', 'upright');
      const localBack = resolveLocalPosterFixtureUrl('back');
      const primary = localPrimary || toAssetUrl(resolveCardFacePath({ id: orientedId, pack: facePack }));
      const upright = localUpright || toAssetUrl(resolveCardFacePath({ id: uprightId, pack: facePack }));
      const back = localBack || toAssetUrl(resolveCardBackPath({ preferredPack: backPack }));
      posterCiLog('card_urls', { primary, upright, back });
      if (isPosterCiDebugEnabled()) {
        const backFallback = localBack || toAssetUrl(resolveCardBackFallbackPath());
        for (const url of [primary, upright, back, backFallback]) {
          await probeImageLoad(url, 'card');
          try {
            const img = await imageManager.loadImage(url, { crossOrigin: 'anonymous' });
            if (img) {
              posterCiLog('img_probe', {
                kind: 'card',
                url,
                ok: true,
                status: 'loaded',
                method: 'loadImage',
              });
              return img;
            }
          } catch (error) {
            posterCiLog('img_probe', {
              kind: 'card',
              url,
              ok: false,
              status: null,
              method: 'loadImage',
              error: error?.message || String(error),
            });
          }
        }
        return null;
      }
      return imageManager.loadWithFallback(primary, [upright, back]);
    };

    const drawReadingPanel = () => {
      if (!hasReadingPanel) return;

      ctx.save();
      ctx.fillStyle = 'rgba(20, 28, 51, 0.4)';
      drawRoundedRect(ctx, panelX, panelTop, panelWidth, panelHeight, 32);
      ctx.fill();
      ctx.strokeStyle = 'rgba(248, 215, 122, 0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      let panelCursorY = panelTop + 60;
      const panelCenterX = width / 2;
      const panelTextWidth = panelWidth - 80;
      let quoteY = null;

      ctx.textAlign = 'center';

      if (archetypeText) {
        ctx.fillStyle = '#f5df8f';
        ctx.font = '500 28px "Space Grotesk", sans-serif';
        panelCursorY = wrapText(
          ctx,
          archetypeText,
          panelCenterX,
          panelCursorY,
          panelTextWidth,
          34,
          2,
        );
      }

      if (mainQuoteText) {
        const quoteLineHeight = 52;
        const quoteMaxLines = 2;
        const quoteBlockHeight = quoteLineHeight * quoteMaxLines;
        const availableTop = panelCursorY + 18;
        const availableBottom = Math.min(panelTop + panelHeight - 28, layout.luckyRowY - 52);
        quoteY = Math.max(availableTop, availableTop + (availableBottom - availableTop - quoteBlockHeight) / 2);
        ctx.save();
        ctx.fillStyle = '#f7f4ee';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
        ctx.shadowBlur = 10;
        ctx.font = 'italic 600 48px "Prata", serif';
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
      const panelLabelY = panelTop - 18;
      const minGapY = cardBottomY + 44;
      const orientationY = Math.min(panelLabelY, minGapY);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = 'rgba(244, 248, 255, 0.98)';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.72)';
      ctx.shadowBlur = 12;
      ctx.font = '500 30px "Space Grotesk", sans-serif';
      wrapText(ctx, reading.orientation, width / 2, orientationY, width - safeMargin * 2, 34, 1);
      ctx.shadowBlur = 0;
    };

    let quoteY = null;

    const drawLuckyRow = () => {
      if (!hasLuckyRow) return;
      const minLuckyY = cardY + cardHeight + 24;
      const maxLuckyY = panelTop + panelHeight - 52;
      const rowY = Math.min(Math.max(layout.luckyRowY, minLuckyY), maxLuckyY);
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f7f4ee';
      ctx.font = '500 26px "Space Grotesk", sans-serif';
      ctx.fillText(strings.luckyColors, width / 2, rowY);

      const dotRadius = 13;
      const dotGap = 20;
      const count = luckyDotColors.length;
      const totalWidth = count * (dotRadius * 2) + (count - 1) * dotGap;
      let dotX = (width - totalWidth) / 2 + dotRadius;
      const dotY = rowY + 34;
      luckyDotColors.forEach((hex) => {
        ctx.save();
        ctx.fillStyle = hex;
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
      ctx.fillStyle = '#f8fbff';
      ctx.font = '500 28px "Space Grotesk", sans-serif';
      const safeFooterY = Math.min(footerY, height - safeMargin * 0.6);
      ctx.fillText('meowtarot.com', width / 2, safeFooterY);
      ctx.shadowBlur = 0;
    };

    drawHeader();

    const cardTopY = layout.cardTop;
    const gapBeforePanel = 48;
    const maxCardWidth = Math.min(720, width - safeMargin * 2);
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
    console.log('[Poster] Images resolved');
    const imgWidth = cardImg?.naturalWidth || cardWidth || 560;
    const imgHeight = cardImg?.naturalHeight || cardHeight || Math.round(560 * 1.5);
    const heightScale = maxCardHeight ? maxCardHeight / imgHeight : 1;
    const scale = Math.min(maxCardWidth / imgWidth, heightScale);
    cardWidth = Math.max(0, imgWidth * scale);
    cardHeight = Math.max(0, imgHeight * scale);
    const cardX = (width - cardWidth) / 2;

    if (cardWidth && cardHeight) {
      ctx.save();
      ctx.shadowColor = 'rgba(248, 215, 122, 0.4)';
      ctx.shadowBlur = 60;
      ctx.shadowOffsetY = 12;
      ctx.fillStyle = '#0f1429';
      ctx.fillRect(cardX, cardY, cardWidth, cardHeight);
      ctx.restore();
      if (cardImg) {
        ctx.drawImage(cardImg, cardX, cardY, cardWidth, cardHeight);
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
    ({ quoteY } = drawReadingPanel() || { quoteY: null });
    if (isPosterDebugEnabled()) {
      console.info('[poster-debug][daily]', {
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
    drawOrientationLabel();
    drawLuckyRow();
    drawFooter();
    console.log('[Poster] Canvas drawn');

    const exportStart = performance.now();
    perf.captureCount += 1;
    console.info('[share-export] captureCount:', perf.captureCount);
    const blob = await canvasToBlob(canvas, POSTER_WEBP_QUALITY);
    perf.captureMs = exportStart - perf.startedAt - perf.preloadMs;
    perf.exportMs = performance.now() - exportStart;
    if (!blob) throw new Error('Failed to build poster blob');
    console.info('[Poster] Performance', {
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
      const facePack = payload?.poster?.assetPack || 'meow-v1';
      const backPack = payload?.poster?.backPack || 'meow-v2';
      const primary = toAssetUrl(resolveCardFacePath({ id: orientedId, pack: facePack }));
      const fallback = entry.orientation === 'reversed'
        ? toAssetUrl(resolveCardFacePath({ id: uprightId, pack: facePack }))
        : null;
      const finalFallback = toAssetUrl(resolveCardBackPath({ preferredPack: backPack }));
      try {
        const img = await imageManager.loadImageWithFallback(primary, [fallback, finalFallback].filter(Boolean));
        ctx.drawImage(img, x, y, cardWidth, cardHeight);
      } catch (error) {
        console.warn('[Poster] card image failed', { url: primary, reason: error?.message || String(error) });
      }
    }
  }
  console.log('[Poster] Images resolved');

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
  console.log('[Poster] Canvas drawn');

  const exportStart = performance.now();
  perf.captureCount += 1;
  console.info('[share-export] captureCount:', perf.captureCount);
  const blob = await canvasToBlob(canvas, POSTER_WEBP_QUALITY);
  perf.captureMs = exportStart - perf.startedAt - perf.preloadMs;
  perf.exportMs = performance.now() - exportStart;
  if (!blob) throw new Error('Failed to build poster blob');
  console.info('[Poster] Performance', {
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
