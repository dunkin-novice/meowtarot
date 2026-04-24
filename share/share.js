import { buildPoster } from './poster.js';
import { normalizePayload } from './normalize-payload.js';
import { getCanonicalCardPath, normalizeCanonicalSlug } from '../js/canonical-card-routes.js';

const previewEl = document.getElementById('posterPreview');
const loadingEl = document.getElementById('posterLoading');
const hintEl = document.getElementById('posterHint');
const statusEl = document.getElementById('shareStatus');
const igOpenBanner = document.getElementById('igOpenBanner');
const igOpenBtn = document.getElementById('igOpenBtn');
const shareBtn = document.getElementById('shareAction');
const openLink = document.getElementById('openPosterLink');
const retryBtn = document.getElementById('retryPoster');
const backToReading = document.getElementById('backToReading');
const sharePromptTitleEl = document.getElementById('sharePromptTitle');
const sharePromptBodyEl = document.getElementById('sharePromptBody');
const shareCopyPanelEl = document.getElementById('shareCopyPanel');
const shareCopyLabelEl = document.getElementById('shareCopyLabel');

const SHARE_STORAGE_KEY = 'meowtarot_share_payload';
const POSTER_DEBUG_STORAGE_KEY = 'POSTER_DEBUG';
let currentBlob = null;
let currentUrl = null;
let revokeTimer = null;
let posterPromise = null;
let currentPayload = null;
let toastTimer = null;
let fontsReadyPromise = null;
let lastPosterError = null;
let posterFailed = false;
let lastFailedAssetUrl = null;
let posterFailureReason = null;
let payloadSource = 'none';
let payloadBytes = 0;
let payloadParseError = null;
let payloadKeys = [];
let payloadKeySummary = {};
let pipelineStage = 'init';
let pipelineHeartbeatTimer = null;
const actionLabels = {
  share: shareBtn?.textContent || 'Share',
};

const STRINGS = {
  en: {
    generating: 'Generating poster…',
    preparing: 'Preparing…',
    sharing: 'Sharing…',
    ready: 'Poster ready',
    missing: 'Missing reading data. Please start from a reading result.',
    shareFail: 'Sharing is unavailable in this browser.',
    opened: 'Image opened. Long-press to save.',
    popupBlocked: 'Popup blocked. Tap the link to open the image.',
    posterFail: 'Unable to build the image. Please try again.',
    error: 'Something went wrong. Please try again.',
    openImage: 'Opening image…',
    retry: 'Retry',
    retrying: 'Retrying…',
    shareCopyLabel: 'One-click share text',
    shareCopyOk: '{platform} text copied',
    shareCopyFail: 'Copy failed. Please press and copy manually.',
  },
  th: {
    generating: 'กำลังสร้างโปสเตอร์…',
    preparing: 'กำลังเตรียม…',
    sharing: 'กำลังแชร์…',
    ready: 'โปสเตอร์พร้อมแชร์',
    missing: 'ไม่พบข้อมูลคำทำนาย โปรดเริ่มจากหน้าผลลัพธ์',
    shareFail: 'เบราว์เซอร์นี้ไม่รองรับการแชร์',
    opened: 'เปิดรูปแล้ว กดค้างเพื่อบันทึก',
    popupBlocked: 'บล็อกการเปิดหน้าต่างใหม่ โปรดกดลิงก์เพื่อเปิดรูป',
    posterFail: 'สร้างรูปไม่สำเร็จ โปรดลองใหม่อีกครั้ง',
    error: 'เกิดข้อผิดพลาด กรุณาลองอีกครั้ง',
    openImage: 'กำลังเปิดรูป…',
    retry: 'ลองอีกครั้ง',
    retrying: 'กำลังลองใหม่…',
    shareCopyLabel: 'ข้อความพร้อมแชร์ในคลิกเดียว',
    shareCopyOk: 'คัดลอกข้อความสำหรับ {platform} แล้ว',
    shareCopyFail: 'คัดลอกไม่สำเร็จ โปรดกดค้างเพื่อคัดลอกเอง',
  },
};

function isIOS() {
  const ua = navigator.userAgent || navigator.vendor || '';
  const isIOSDevice = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isWebKit = /AppleWebKit/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
  const isMacDesktop = /Macintosh/.test(ua) && !isIOSDevice;
  return isIOSDevice && isWebKit && !isMacDesktop;
}


function detectWebViewContext() {
  const ua = navigator.userAgent || '';
  const embeddedMatch = ua.match(/FBAN|FBAV|Instagram|Line|Twitter|TikTok|Snapchat/i);
  const instagramMatch = ua.match(/Instagram/i);
  const looksLikeHeadless = /HeadlessChrome/i.test(ua);
  const hasBrowserTokens = /Chrome|Safari/i.test(ua);
  const embeddedByToken = Boolean(embeddedMatch) && !looksLikeHeadless;
  const isInstagram = Boolean(instagramMatch) && !looksLikeHeadless;
  const isEmbedded = (embeddedByToken && !hasBrowserTokens) || isInstagram;
  return {
    ua,
    isInstagramWebView: isInstagram,
    isEmbeddedWebView: isEmbedded,
    matchSource: instagramMatch?.[0] || embeddedMatch?.[0] || null,
  };
}

function isInstagramWebView() {
  return detectWebViewContext().isInstagramWebView;
}

function isEmbeddedWebView() {
  return detectWebViewContext().isEmbeddedWebView;
}

function isPosterDebugEnabled() {
  const params = new URLSearchParams(window.location.search || '');
  if (params.get('poster_debug') === '1') return true;
  try {
    return String(window.localStorage?.getItem(POSTER_DEBUG_STORAGE_KEY) || '').trim() === '1';
  } catch (_) {
    return false;
  }
}

function setupPosterDebugMode() {
  if (!isPosterDebugEnabled()) return;
  window.POSTER_DEBUG = '1';
}

function debugLog(method = 'info', ...args) {
  if (!isPosterDebugEnabled()) return;
  (console[method] || console.info).call(console, ...args);
}

function ensureDebugOverlay() {
  if (!isPosterDebugEnabled()) return null;
  let overlay = document.getElementById('posterDebugOverlay');
  if (overlay) return overlay;
  overlay = document.createElement('pre');
  overlay.id = 'posterDebugOverlay';
  Object.assign(overlay.style, {
    position: 'fixed',
    left: '8px',
    right: '8px',
    bottom: 'calc(env(safe-area-inset-bottom) + 8px)',
    maxHeight: '38dvh',
    overflow: 'auto',
    zIndex: '40',
    background: 'rgba(0,0,0,0.8)',
    color: '#98f7b3',
    border: '1px solid rgba(152,247,179,0.45)',
    borderRadius: '10px',
    fontSize: '11px',
    lineHeight: '1.35',
    padding: '8px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  });
  document.body.appendChild(overlay);
  return overlay;
}

function pushDebugOverlay(extra = {}) {
  const overlay = ensureDebugOverlay();
  if (!overlay) return;
  const entries = Array.isArray(window.__MEOW_POSTER_DEBUG) ? window.__MEOW_POSTER_DEBUG.slice(-24) : [];
  const imgLogs = entries.filter((item) => ['preload', 'img_probe'].includes(item?.step)).map((item) => ({
    step: item.step,
    kind: item.kind,
    status: item.status || (item.ok ? 'ok' : 'error'),
    url: item.url,
    err: item.err || item.error || null,
  }));
  const exportEvent = [...entries].reverse().find((item) => item?.step === 'export_attempt' || item?.step === 'export_error') || null;
  const webView = detectWebViewContext();
  const payload = {
    ua: webView.ua,
    isInstagramWebView: webView.isInstagramWebView,
    isEmbeddedWebView: webView.isEmbeddedWebView,
    matchSource: webView.matchSource,
    posterFailed,
    lastPosterError: lastPosterError ? (lastPosterError.stack || lastPosterError.message || String(lastPosterError)) : null,
    lastFailedAssetUrl,
    posterFailureReason,
    exportMethod: window.__MEOW_POSTER_EXPORT_METHOD || exportEvent?.method || null,
    exportBytes: window.__MEOW_POSTER_EXPORT_BYTES || null,
    exportBlobType: window.__MEOW_POSTER_EXPORT_BLOB_TYPE || null,
    taintedCanvas: Boolean(window.__MEOW_POSTER_TAINTED || exportEvent?.tainted),
    posterStage: window.__MEOW_POSTER_STAGE || null,
    canvasSize: window.__MEOW_POSTER_CANVAS_SIZE || null,
    scaledCanvasSize: window.__MEOW_POSTER_SCALED_CANVAS_SIZE || null,
    exportAttempt: Array.isArray(window.__MEOW_POSTER_EXPORT_ATTEMPTS) ? window.__MEOW_POSTER_EXPORT_ATTEMPTS : [],
    payloadSource,
    payloadBytes,
    payloadParseError,
    payloadKeys,
    payloadKeySummary,
    pipelineStage,
    imageLogs: imgLogs,
    ...extra,
  };
  overlay.textContent = JSON.stringify(payload, null, 2);
}

function shouldShowOpenInBrowserBanner() {
  const webView = detectWebViewContext();
  return posterFailed === true && (webView.isInstagramWebView || webView.isEmbeddedWebView);
}

function updateOpenInBrowserBanner(reason = '') {
  if (!igOpenBanner) return;
  const shouldShow = shouldShowOpenInBrowserBanner();
  igOpenBanner.hidden = !shouldShow;
  if (!shouldShow) return;
  const text = document.getElementById('igOpenText');
  if (text && reason) {
    text.textContent = reason;
  }
}

function getStrings(lang) {
  return STRINGS[lang] || STRINGS.en;
}

function getTopicLabel(payload = {}) {
  const lang = payload?.lang || 'en';
  const topic = String(payload?.topic || '').toLowerCase();
  const labels = {
    en: { love: 'Love', career: 'Career', finance: 'Finance', generic: 'Any question' },
    th: { love: 'ความรัก', career: 'การงาน', finance: 'การเงิน', generic: 'คำถามทั่วไป' },
  };
  return labels[lang]?.[topic] || labels[lang]?.generic || labels.en.generic;
}


function resolveCardMeaningPath(payload = {}) {
  const primaryCard = Array.isArray(payload?.cards) ? payload.cards[0] : null;
  if (!primaryCard || typeof primaryCard !== 'object') return null;

  const rawSlug = primaryCard.seo_slug_en
    || primaryCard.slug
    || primaryCard.id
    || primaryCard.card_id
    || primaryCard.cardId
    || primaryCard.image_id
    || primaryCard.name_en
    || primaryCard.card_name_en
    || primaryCard.name
    || '';

  const slug = normalizeCanonicalSlug(rawSlug);
  if (!slug) return null;

  const lang = payload?.lang === 'th' ? 'th' : 'en';
  return getCanonicalCardPath(slug, lang) || `${lang === 'th' ? '/th' : ''}/cards/${slug}/`;
}

function getShareMessage(payload = {}) {
  const lang = payload?.lang || 'en';
  const mode = String(payload?.mode || payload?.poster?.mode || '').toLowerCase();
  const topicLabel = getTopicLabel(payload);
  if (lang === 'th') {
    if (mode === 'question') return `คำทำนายถามคำถามของฉันเรื่อง${topicLabel}`;
    if (mode === 'full') return 'คำทำนาย MeowTarot ของฉัน';
    return 'คำทำนายรายวันของฉัน';
  }
  if (mode === 'question') return `My Ask a Question reading for ${topicLabel.toLowerCase()}`;
  if (mode === 'full') return 'My MeowTarot reading';
  return 'My daily reading';
}

function formatTemplate(template = '', values = {}) {
  return String(template || '').replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
}

function getShareMode(payload = {}) {
  return String(payload?.mode || payload?.poster?.mode || 'daily').toLowerCase();
}

function getPlatformShareText(platform, payload = {}) {
  const lang = payload?.lang || 'en';
  const mode = getShareMode(payload);
  const topicLabel = getTopicLabel(payload);
  const templates = {
    en: {
      tiktok: {
        daily: 'Today’s tarot vibe ✨ {base}. #MeowTarot #TarotTok',
        full: 'Did a full tarot spread today 🔮 {base}. #MeowTarot #TarotTok',
        question: 'Asked tarot about {topic} 💫 {base}. #MeowTarot #TarotTok',
      },
      ig_story: {
        daily: 'Daily pull check-in 🐾 {base}',
        full: 'Full reading snapshot 📿 {base}',
        question: 'Q&A reading on {topic} 💭 {base}',
      },
      line: {
        daily: 'My daily tarot: {base}',
        full: 'My full tarot reading: {base}',
        question: 'My tarot answer for {topic}: {base}',
      },
      x: {
        daily: 'Daily tarot check: {base} #MeowTarot',
        full: 'Just finished a full tarot reading: {base} #MeowTarot',
        question: 'Asked tarot about {topic}: {base} #MeowTarot',
      },
    },
    th: {
      tiktok: {
        daily: 'ไพ่วันนี้ของฉัน ✨ {base} #MeowTarot #TarotTok',
        full: 'เปิดไพ่แบบเต็มวันนี้ 🔮 {base} #MeowTarot #TarotTok',
        question: 'ถามไพ่เรื่อง{topic} 💫 {base} #MeowTarot #TarotTok',
      },
      ig_story: {
        daily: 'สรุปไพ่ประจำวัน 🐾 {base}',
        full: 'สรุปการเปิดไพ่แบบเต็ม 📿 {base}',
        question: 'คำตอบจากไพ่เรื่อง{topic} 💭 {base}',
      },
      line: {
        daily: 'ไพ่ประจำวันของฉัน: {base}',
        full: 'ผลการเปิดไพ่แบบเต็มของฉัน: {base}',
        question: 'คำตอบไพ่ของฉันเรื่อง{topic}: {base}',
      },
      x: {
        daily: 'เช็กไพ่รายวัน: {base} #MeowTarot',
        full: 'เพิ่งเปิดไพ่แบบเต็มเสร็จ: {base} #MeowTarot',
        question: 'ถามไพ่เรื่อง{topic}: {base} #MeowTarot',
      },
    },
  };

  const base = getShareMessage(payload);
  const langTemplates = templates[lang] || templates.en;
  const platformTemplates = langTemplates[platform] || langTemplates.x;
  const template = platformTemplates[mode] || platformTemplates.daily;
  const topic = lang === 'th' ? String(topicLabel || '') : String(topicLabel || '').toLowerCase();
  return formatTemplate(template, { base, topic }).trim();
}

function applySharePrompt(payload = {}) {
  const lang = payload?.lang || 'en';
  const strings = getStrings(lang);
  if (sharePromptTitleEl) sharePromptTitleEl.textContent = lang === 'th' ? 'โปสเตอร์พร้อมแชร์แล้ว' : 'Your shareable poster is ready';
  if (sharePromptBodyEl) {
    sharePromptBodyEl.textContent = lang === 'th'
      ? 'บันทึกเก็บไว้หรือโพสต์ตอนที่ข้อความนี้ยังรู้สึกชัดกับใจคุณอยู่'
      : 'Save it for yourself or post it while the message still feels fresh.';
  }
  if (shareCopyLabelEl) shareCopyLabelEl.textContent = strings.shareCopyLabel;
  if (shareCopyPanelEl) shareCopyPanelEl.hidden = false;
}

function base64UrlDecode(input = '') {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((input.length + 3) % 4);
  const json = decodeURIComponent(escape(atob(padded)));
  return JSON.parse(json);
}


function base64UrlDecodeRaw(input = '') {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((input.length + 3) % 4);
  return decodeURIComponent(escape(atob(padded)));
}

function readHashPayload() {
  const hash = String(window.location.hash || '').replace(/^#/, '');
  if (!hash) return null;
  const hashParams = new URLSearchParams(hash);
  return hashParams.get('p');
}

function updatePipelineStage(nextStage) {
  pipelineStage = nextStage;
  debugLog('info', `[Poster] stage=${pipelineStage}`);
  pushDebugOverlay({ stage: pipelineStage });
}

function showToast(message, { tone = 'info', persist = false } = {}) {
  if (!statusEl) return;
  if (toastTimer) clearTimeout(toastTimer);
  statusEl.dataset.tone = tone;
  statusEl.textContent = message;
  statusEl.hidden = !message;
  if (!persist && message) {
    toastTimer = setTimeout(() => {
      statusEl.hidden = true;
    }, 2800);
  }
}

function setLoading(isLoading, strings) {
  if (!loadingEl) return;
  loadingEl.textContent = isLoading ? strings.generating : '';
  loadingEl.hidden = !isLoading;
}

function setRetryVisible(visible, strings = STRINGS.en) {
  if (!retryBtn) return;
  retryBtn.hidden = !visible;
  retryBtn.disabled = false;
  retryBtn.textContent = strings.retry;
}

function setActionLoading(isLoading, strings) {
  if (shareBtn) {
    shareBtn.disabled = isLoading;
    shareBtn.textContent = isLoading ? strings.generating : actionLabels.share;
  }
}

function startPipelineHeartbeat() {
  if (!isPosterDebugEnabled() || pipelineHeartbeatTimer) return;
  pipelineHeartbeatTimer = setInterval(() => {
    debugLog('info', `[Poster] heartbeat stage=${window.__MEOW_POSTER_STAGE || pipelineStage || 'unknown'}`);
  }, 2000);
}

function stopPipelineHeartbeat() {
  if (!pipelineHeartbeatTimer) return;
  clearInterval(pipelineHeartbeatTimer);
  pipelineHeartbeatTimer = null;
}

function storePayload(payload) {
  try {
    const data = JSON.stringify(payload);
    sessionStorage.setItem(SHARE_STORAGE_KEY, data);
    localStorage.setItem(SHARE_STORAGE_KEY, data);
  } catch (_) {
    // ignore storage errors
  }
}

function resolvePayload() {
  const params = new URLSearchParams(window.location.search);
  const hashRaw = readHashPayload();
  const queryRaw = params.get('d');

  const parseEncodedPayload = (raw, sourceLabel) => {
    if (!raw) return null;
    try {
      const rawJson = base64UrlDecodeRaw(raw);
      payloadBytes = rawJson.length;
      const parsed = normalizePayload(JSON.parse(rawJson));
      payloadSource = sourceLabel;
      payloadParseError = null;
      payloadKeys = Object.keys(parsed || {});
      payloadKeySummary = {
        cardKeys: Object.keys(parsed?.cards?.[0] || {}),
        readingKeys: Object.keys(parsed?.reading || {}),
        luckyKeys: Object.keys(parsed?.lucky || {}),
      };
      storePayload(parsed);
      return parsed;
    } catch (error) {
      payloadParseError = error?.message || String(error);
      return null;
    }
  };

  const fromHash = parseEncodedPayload(hashRaw, 'hash');
  if (fromHash) return fromHash;

  const fromQuery = parseEncodedPayload(queryRaw, 'query');
  if (fromQuery) return fromQuery;

  try {
    const historyPayload = window.history?.state?.meowtarotSharePayload;
    if (historyPayload) {
      const parsed = normalizePayload(historyPayload);
      payloadSource = 'history';
      payloadParseError = null;
      const rawJson = JSON.stringify(parsed);
      payloadBytes = rawJson.length;
      payloadKeys = Object.keys(parsed || {});
      payloadKeySummary = {
        cardKeys: Object.keys(parsed?.cards?.[0] || {}),
        readingKeys: Object.keys(parsed?.reading || {}),
        luckyKeys: Object.keys(parsed?.lucky || {}),
      };
      storePayload(parsed);
      return parsed;
    }
  } catch (error) {
    payloadParseError = error?.message || String(error);
  }

  try {
    const stored = sessionStorage.getItem(SHARE_STORAGE_KEY) || localStorage.getItem(SHARE_STORAGE_KEY);
    if (stored) {
      const parsed = normalizePayload(JSON.parse(stored));
      payloadSource = 'storage';
      payloadParseError = null;
      payloadBytes = stored.length;
      payloadKeys = Object.keys(parsed || {});
      payloadKeySummary = {
        cardKeys: Object.keys(parsed?.cards?.[0] || {}),
        readingKeys: Object.keys(parsed?.reading || {}),
        luckyKeys: Object.keys(parsed?.lucky || {}),
      };
      return parsed;
    }
  } catch (error) {
    payloadParseError = error?.message || String(error);
    return null;
  }

  payloadSource = 'none';
  payloadKeys = [];
  payloadKeySummary = {};
  payloadBytes = 0;
  return null;
}


function logFullPayload(payload) {
  if (!payload || payload.mode !== 'full') return;
  debugLog('log', '[Full] payload keys', Object.keys(payload));
  debugLog('log', '[Full] reading keys', Object.keys(payload.reading || {}));
  debugLog('log', '[Full] cards length', Array.isArray(payload.cards) ? payload.cards.length : 0);
}

function setPosterBlob(blob) {
  currentBlob = blob;
  setPosterUrl(URL.createObjectURL(blob));
}

function setPosterUrl(url) {
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl);
  }
  currentUrl = url;
  previewEl.src = currentUrl;
  if (openLink) {
    openLink.href = currentUrl;
  }
  scheduleRevoke();
}

function scheduleRevoke() {
  if (revokeTimer) clearTimeout(revokeTimer);
  revokeTimer = setTimeout(() => {
    if (currentUrl) {
      URL.revokeObjectURL(currentUrl);
      currentUrl = null;
    }
  }, 60000);
}

function cleanupPosterUrl() {
  if (revokeTimer) clearTimeout(revokeTimer);
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl);
    currentUrl = null;
  }
}

function ensurePosterUrl() {
  if (!currentBlob) return null;
  if (currentUrl) {
    scheduleRevoke();
    return currentUrl;
  }
  const url = URL.createObjectURL(currentBlob);
  setPosterUrl(url);
  return url;
}

async function ensureFontsReady() {
  if (!document.fonts?.ready) return;
  if (!fontsReadyPromise) {
    fontsReadyPromise = document.fonts.ready.catch((error) => {
      debugLog('warn', 'Font readiness check failed', error);
    });
  }
  await fontsReadyPromise;
}

async function ensurePoster() {
  if (!currentPayload) return null;
  currentPayload = normalizePayload(currentPayload);
  if (currentBlob) return currentBlob;
  if (posterPromise) return posterPromise;

  const strings = getStrings(currentPayload.lang);
  setLoading(true, strings);
  setRetryVisible(false, strings);
  setActionLoading(true, strings);
  posterPromise = (async () => {
    const startedAt = performance.now();
    try {
      updatePipelineStage('preloading');
      await Promise.race([
        ensureFontsReady(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout at preloading')), 6000)),
      ]);
      const normalizedPayload = normalizePayload(currentPayload);
      currentPayload = normalizedPayload;
      const timeoutMs = 15000;
      updatePipelineStage('rendering');
      const posterPromiseOp = buildPoster(normalizedPayload, { preset: 'story' });
      const stageWatcher = setInterval(() => {
        if (window.__MEOW_POSTER_STAGE === 'exporting' && pipelineStage !== 'exporting') {
          updatePipelineStage('exporting');
        }
      }, 150);
      const result = await Promise.race([
        posterPromiseOp,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`timeout at ${window.__MEOW_POSTER_STAGE || pipelineStage || 'rendering'} after ${timeoutMs}ms`)), timeoutMs)),
      ]).finally(() => clearInterval(stageWatcher));
      if (result.width !== 1080 || result.height !== 1920) {
        throw new Error('Unexpected poster size');
      }
      if (!result.blob) {
        throw new Error('Poster blob is missing');
      }
      setPosterBlob(result.blob);
      window.__MEOW_POSTER_STAGE = 'done';
      window.__MEOW_POSTER_EXPORT_BYTES = result.blob?.size || 0;
      window.__MEOW_POSTER_EXPORT_BLOB_TYPE = result.blob?.type || null;
      lastPosterError = null;
      posterFailed = false;
      lastFailedAssetUrl = null;
      posterFailureReason = null;
      setRetryVisible(false, strings);
      debugLog('info', 'Poster generation timings', { totalMs: Number((performance.now() - startedAt).toFixed(1)), ...(result.perf || {}) });
      updatePipelineStage('done');
      showToast(strings.ready);
      updateOpenInBrowserBanner();
      pushDebugOverlay({ stage: 'ensurePoster.success', blobType: result.blob?.type, blobSize: result.blob?.size });
      return result.blob;
    } catch (err) {
      posterFailureReason = window.__MEOW_POSTER_FAILURE_REASON || (/timeout/i.test(String(err?.message || '')) ? 'timeout' : 'memory/export failure');
      lastPosterError = new Error(`${posterFailureReason}: ${err?.message || String(err)}`);
      window.__MEOW_POSTER_STAGE = 'fail';
      posterFailed = true;
      lastFailedAssetUrl = window.__MEOW_POSTER_LAST_FAILED_ASSET_URL || null;
      updatePipelineStage('fail');
      pushDebugOverlay({ stage: 'ensurePoster.catch', error: err?.message || String(err), failureReason: posterFailureReason, timeout: /timeout/i.test(String(err?.message || '')) });
      setRetryVisible(true, strings);
      updateOpenInBrowserBanner('Poster generation failed in in-app browser. Open in Safari/Chrome.');
      throw err;
    } finally {
      setLoading(false, strings);
      setActionLoading(false, strings);
    }
  })();

  try {
    return await posterPromise;
  } finally {
    posterPromise = null;
  }
}

async function handleShare() {
  if (!currentPayload) return;
  const strings = getStrings(currentPayload.lang);
  debugLog('info', 'Share action triggered');
  showToast(strings.preparing);
  let blob = null;
  try {
    blob = await ensurePoster();
  } catch (err) {
    const reason = err?.message || String(err);
    console.error('Failed to generate poster for sharing', reason, err);
    pushDebugOverlay({ stage: 'handleShare.catch', error: reason });
    updateOpenInBrowserBanner('Poster generation failed in in-app browser. Open in Safari/Chrome.');
    showToast("Couldn't generate image in this in-app browser. Open in Safari/Chrome.", { tone: 'error', persist: true });
    return;
  }
  if (!blob) {
    showToast("Couldn't generate image in this in-app browser. Open in Safari/Chrome.", { tone: 'error', persist: true });
    return;
  }

  const sharePageUrl = window.location.href;
  const isWebp = blob.type === 'image/webp';
  const fileName = isWebp ? 'meowtarot.webp' : 'meowtarot-daily-reading.png';

  const fallbackDownload = () => {
    if (!blob) return;
    const blobUrl = URL.createObjectURL(blob);
    if (openLink) {
      openLink.hidden = false;
      openLink.href = blobUrl;
      openLink.download = fileName;
    }
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
  };

  const copyShareLink = async () => {
    if (!navigator.clipboard?.writeText) return false;
    try {
      await navigator.clipboard.writeText(sharePageUrl);
      return true;
    } catch (_) {
      return false;
    }
  };

  const sharePoster = async () => {
    const file = new File([blob], fileName, { type: blob.type || 'image/png' });
    const canNativeShare = Boolean(
      navigator.share
      && (!navigator.canShare || navigator.canShare({ files: [file] })),
    );
    pushDebugOverlay({
      stage: 'share_attempt',
      shareAvailable: Boolean(navigator.share),
      canShareFiles: canNativeShare,
      fileType: file.type,
      fileBytes: file.size,
    });

    if (canNativeShare) {
      showToast(strings.sharing);
      await navigator.share({ files: [file], title: currentPayload.title || 'MeowTarot', text: getShareMessage(currentPayload) });
      return { shared: true };
    }

    return { shared: false };
  };

  setActionLoading(true, strings);
  try {
    const result = await sharePoster();
    if (result.shared) return;
    fallbackDownload();
    const copied = await copyShareLink();
    showToast(copied ? 'Saved image + copied link.' : 'Saved image. Copy link unavailable in this browser.', { tone: 'warning', persist: true });
  } catch (err) {
    debugLog('warn', '[Poster] share_error', err);
    pushDebugOverlay({ stage: 'share_error', error: err?.message || String(err) });
    fallbackDownload();
    const copied = await copyShareLink();
    if (isEmbeddedWebView() || isInstagramWebView()) {
      updateOpenInBrowserBanner('Sharing is blocked in this in-app browser. Open in Safari/Chrome.');
    }
    showToast(copied ? 'Sharing failed. Downloaded image + copied link.' : 'Sharing failed. Downloaded image instead.', { tone: 'warning', persist: true });
  } finally {
    setActionLoading(false, strings);
  }
}

async function handleShareCopyChipClick(event) {
  const chip = event.target?.closest?.('[data-platform]');
  if (!chip || !currentPayload) return;
  const platform = String(chip.dataset.platform || '').trim();
  if (!platform) return;
  const strings = getStrings(currentPayload.lang);
  const platformLabel = chip.textContent?.trim() || platform;
  const text = getPlatformShareText(platform, currentPayload);
  const copyWithClipboard = async () => {
    if (!navigator.clipboard?.writeText) return false;
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      return false;
    }
  };
  const copied = await copyWithClipboard();
  if (copied) {
    showToast(formatTemplate(strings.shareCopyOk, { platform: platformLabel }));
    return;
  }

  const didPrompt = window.prompt('Copy share text:', text);
  showToast(didPrompt === null ? strings.shareCopyFail : formatTemplate(strings.shareCopyOk, { platform: platformLabel }), {
    tone: didPrompt === null ? 'warning' : 'info',
  });
}

function applyActionFocus() {
  const params = new URLSearchParams(window.location.search);
  const action = params.get('action');
  if (action === 'share') {
    shareBtn?.focus();
  }
}

async function init() {
  debugLog('info', 'Initializing share page');
  setupPosterDebugMode();
  startPipelineHeartbeat();
  updateOpenInBrowserBanner();
  updatePipelineStage('init');
  if (isPosterDebugEnabled()) {
    const h = window.location.hash || '';
    const clean = h.replace(/^#/, '');
    debugLog('info', '[Share] incoming_hash', clean.length, clean.slice(0, 60));
  }
  currentPayload = normalizePayload(resolvePayload());
  if (currentPayload) updatePipelineStage('loaded_payload');
  const lang = currentPayload?.lang || 'en';
  const strings = getStrings(lang);

  logFullPayload(currentPayload);

  if (!currentPayload) {
    updatePipelineStage('fail');
    showToast(strings.missing, { tone: 'error', persist: true });
    if (backToReading) {
      backToReading.hidden = false;
      backToReading.textContent = lang === 'th' ? 'กลับหน้าผลการอ่าน' : 'Back to reading';
      backToReading.href = '/reading.html';
    }
    setLoading(false, strings);
    setActionLoading(false, strings);
    shareBtn.disabled = true;
    return;
  }

  document.title = `${currentPayload.title || 'MeowTarot'} – Share`;
  applySharePrompt(currentPayload);
  if (backToReading) {
    const cardMeaningPath = resolveCardMeaningPath(currentPayload);
    backToReading.hidden = false;
    backToReading.textContent = lang === 'th' ? 'อ่านความหมายไพ่' : 'Read Card Meaning';
    backToReading.href = cardMeaningPath || currentPayload.canonicalUrl || '/reading.html';
  }
  if (!isIOS()) {
    hintEl.hidden = true;
  }
  if (openLink) {
    openLink.hidden = true;
  }
  setActionLoading(true, strings);

  try {
    await ensurePoster();
  } catch (err) {
    console.error('Poster generation failed', err);
    pushDebugOverlay({ stage: 'init.ensurePoster.catch', error: err?.message || String(err) });
    updateOpenInBrowserBanner('Poster generation failed in in-app browser. Open in Safari/Chrome.');
    showToast(strings.posterFail, { tone: 'error', persist: true });
    setLoading(false, strings);
    setActionLoading(false, strings);
  }

  applyActionFocus();

  shareBtn.addEventListener('click', handleShare);
  shareCopyPanelEl?.addEventListener('click', handleShareCopyChipClick);
  retryBtn?.addEventListener('click', async () => {
    retryBtn.disabled = true;
    retryBtn.textContent = strings.retrying;
    currentBlob = null;
    try {
      await ensurePoster();
    } catch (error) {
      console.error('Retry poster generation failed', error);
      showToast(strings.posterFail, { tone: 'error', persist: true });
      retryBtn.disabled = false;
      retryBtn.textContent = strings.retry;
    }
  });

  igOpenBtn?.addEventListener('click', () => {
    const current = window.location.href;
    window.open(current, '_blank', 'noopener');
  });

  openLink?.addEventListener('click', async (event) => {
    event.preventDefault();
    const blob = await ensurePoster();
    if (!blob) return;
    const url = ensurePosterUrl();
    if (!url) return;
    window.open(url, '_blank', 'noopener');
  });

  window.addEventListener('beforeunload', () => { stopPipelineHeartbeat(); cleanupPosterUrl(); }, { once: true });
  window.addEventListener('pagehide', () => { stopPipelineHeartbeat(); cleanupPosterUrl(); }, { once: true });
}

document.addEventListener('DOMContentLoaded', init);
