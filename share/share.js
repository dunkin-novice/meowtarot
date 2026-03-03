import { buildPoster } from './poster.js';

const previewEl = document.getElementById('posterPreview');
const loadingEl = document.getElementById('posterLoading');
const hintEl = document.getElementById('posterHint');
const statusEl = document.getElementById('shareStatus');
const shareBtn = document.getElementById('shareAction');
const openLink = document.getElementById('openPosterLink');
const retryBtn = document.getElementById('retryPoster');

const SHARE_STORAGE_KEY = 'meowtarot_share_payload';
let currentBlob = null;
let currentUrl = null;
let revokeTimer = null;
let posterPromise = null;
let currentPayload = null;
let toastTimer = null;
let fontsReadyPromise = null;
let lastPosterError = null;
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
  },
};

function isIOS() {
  const ua = navigator.userAgent || navigator.vendor || '';
  const isIOSDevice = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isWebKit = /AppleWebKit/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
  const isMacDesktop = /Macintosh/.test(ua) && !isIOSDevice;
  return isIOSDevice && isWebKit && !isMacDesktop;
}

function getStrings(lang) {
  return STRINGS[lang] || STRINGS.en;
}

function base64UrlDecode(input = '') {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((input.length + 3) % 4);
  const json = decodeURIComponent(escape(atob(padded)));
  return JSON.parse(json);
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

function storePayload(payload) {
  try {
    sessionStorage.setItem(SHARE_STORAGE_KEY, JSON.stringify(payload));
  } catch (_) {
    // ignore storage errors
  }
}

function resolvePayload() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('d');
  if (raw) {
    try {
      const payload = base64UrlDecode(raw);
      storePayload(payload);
      return payload;
    } catch (_) {
      // ignore decode errors
    }
  }

  try {
    const stored = sessionStorage.getItem(SHARE_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch (_) {
    return null;
  }
  return null;
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
      console.warn('Font readiness check failed', error);
    });
  }
  await fontsReadyPromise;
}

async function ensurePoster() {
  if (!currentPayload) return null;
  if (currentBlob) return currentBlob;
  if (posterPromise) return posterPromise;

  const strings = getStrings(currentPayload.lang);
  setLoading(true, strings);
  setRetryVisible(false, strings);
  setActionLoading(true, strings);
  posterPromise = (async () => {
    const startedAt = performance.now();
    try {
      await ensureFontsReady();
      const result = await buildPoster(currentPayload, { preset: 'story' });
      if (result.width !== 1080 || result.height !== 1920) {
        throw new Error('Unexpected poster size');
      }
      setPosterBlob(result.blob);
      lastPosterError = null;
      setRetryVisible(false, strings);
      setLoading(false, strings);
      setActionLoading(false, strings);
      console.info('Poster generation timings', { totalMs: Number((performance.now() - startedAt).toFixed(1)), ...(result.perf || {}) });
      showToast(strings.ready);
      return result.blob;
    } catch (err) {
      lastPosterError = err;
      setRetryVisible(true, strings);
      setLoading(false, strings);
      setActionLoading(false, strings);
      throw err;
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
  console.info('Share action triggered');
  showToast(strings.preparing);
  let blob = null;
  try {
    blob = await ensurePoster();
  } catch (err) {
    const reason = err?.message || String(err);
    console.error('Failed to generate poster for sharing', reason, err);
    showToast(strings.posterFail, { tone: 'error', persist: true });
    return;
  }
  if (!blob) {
    showToast(strings.posterFail, { tone: 'error', persist: true });
    return;
  }

  const isWebp = blob.type === 'image/webp';
  const fileName = isWebp ? 'meowtarot.webp' : 'meowtarot.png';
  const file = new File([blob], fileName, { type: blob.type || 'image/png' });
  if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
    try {
      showToast(strings.sharing);
      await navigator.share({ files: [file], title: currentPayload.title || 'MeowTarot' });
      return;
    } catch (err) {
      console.warn('File share failed', err);
    }
  }

  showToast(strings.shareFail, { tone: 'warning', persist: true });
}

function applyActionFocus() {
  const params = new URLSearchParams(window.location.search);
  const action = params.get('action');
  if (action === 'share') {
    shareBtn?.focus();
  }
}

async function init() {
  console.info('Initializing share page');
  currentPayload = resolvePayload();
  const lang = currentPayload?.lang || 'en';
  const strings = getStrings(lang);

  if (!currentPayload) {
    showToast(strings.missing, { tone: 'error', persist: true });
    setLoading(false, strings);
    setActionLoading(false, strings);
    shareBtn.disabled = true;
    return;
  }

  document.title = `${currentPayload.title || 'MeowTarot'} – Share`;
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
    showToast(strings.posterFail, { tone: 'error', persist: true });
    setLoading(false, strings);
    setActionLoading(false, strings);
  }

  applyActionFocus();

  shareBtn.addEventListener('click', handleShare);
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

  openLink?.addEventListener('click', async (event) => {
    event.preventDefault();
    const blob = await ensurePoster();
    if (!blob) return;
    const url = ensurePosterUrl();
    if (!url) return;
    window.open(url, '_blank', 'noopener');
  });
}

document.addEventListener('DOMContentLoaded', init);
