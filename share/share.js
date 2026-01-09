import { buildPoster } from './poster.js';

const previewEl = document.getElementById('posterPreview');
const loadingEl = document.getElementById('posterLoading');
const hintEl = document.getElementById('posterHint');
const statusEl = document.getElementById('shareStatus');
const shareBtn = document.getElementById('shareAction');
const saveBtn = document.getElementById('saveAction');
const copyBtn = document.getElementById('copyAction');
const openLink = document.getElementById('openPosterLink');

const SHARE_STORAGE_KEY = 'meowtarot_share_payload';
let currentBlob = null;
let currentUrl = null;
let revokeTimer = null;
let posterPromise = null;
let shareLink = window.location.href;
let currentPayload = null;
let toastTimer = null;
const actionLabels = {
  share: shareBtn?.textContent || 'Share',
  save: saveBtn?.textContent || 'Save',
};

const STRINGS = {
  en: {
    generating: 'Generating poster…',
    preparing: 'Preparing…',
    sharing: 'Sharing…',
    ready: 'Poster ready',
    missing: 'Missing reading data. Please start from a reading result.',
    shareFail: 'Share unavailable. Link copied instead.',
    copied: 'Link copied!',
    opened: 'Image opened. Long-press to save.',
    popupBlocked: 'Popup blocked. Tap the link to open the image.',
    posterFail: 'Unable to build the image. Link copied instead.',
    error: 'Something went wrong. Please try again.',
    openImage: 'Opening image…',
  },
  th: {
    generating: 'กำลังสร้างโปสเตอร์…',
    preparing: 'กำลังเตรียม…',
    sharing: 'กำลังแชร์…',
    ready: 'โปสเตอร์พร้อมแชร์',
    missing: 'ไม่พบข้อมูลคำทำนาย โปรดเริ่มจากหน้าผลลัพธ์',
    shareFail: 'แชร์ไม่ได้ จึงคัดลอกลิงก์แทน',
    copied: 'คัดลอกลิงก์แล้ว',
    opened: 'เปิดรูปแล้ว กดค้างเพื่อบันทึก',
    popupBlocked: 'บล็อกการเปิดหน้าต่างใหม่ โปรดกดลิงก์เพื่อเปิดรูป',
    posterFail: 'สร้างรูปไม่สำเร็จ จึงคัดลอกลิงก์แทน',
    error: 'เกิดข้อผิดพลาด กรุณาลองอีกครั้ง',
    openImage: 'กำลังเปิดรูป…',
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

function base64UrlEncode(input) {
  const encoded = btoa(unescape(encodeURIComponent(input)));
  return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function buildShareLink(payload) {
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const url = new URL('/share/', window.location.origin);
  url.searchParams.set('d', encoded);
  return url.toString();
}

function setStatus(message) {
  if (!statusEl) return;
  statusEl.textContent = message;
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

function setActionLoading(isLoading, strings) {
  if (shareBtn) {
    shareBtn.disabled = isLoading;
    shareBtn.textContent = isLoading ? strings.generating : actionLabels.share;
  }
  if (saveBtn) {
    saveBtn.disabled = isLoading;
    saveBtn.textContent = isLoading ? strings.generating : actionLabels.save;
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

async function ensurePoster() {
  if (!currentPayload) return null;
  if (currentBlob) return currentBlob;
  if (posterPromise) return posterPromise;

  const strings = getStrings(currentPayload.lang);
  setLoading(true, strings);
  setActionLoading(true, strings);
  posterPromise = (async () => {
    try {
      const result = await buildPoster(currentPayload, { preset: 'story' });
      if (result.width !== 1080 || result.height !== 1920) {
        throw new Error('Unexpected poster size');
      }
      setPosterBlob(result.blob);
      setLoading(false, strings);
      setActionLoading(false, strings);
      showToast(strings.ready);
      return result.blob;
    } catch (err) {
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
    console.error('Failed to generate poster for sharing', err);
    await handleCopy(strings.posterFail);
    return;
  }
  if (!blob) {
    await handleCopy(strings.posterFail);
    return;
  }

  const isWebp = blob.type === 'image/webp';
  const fileName = isWebp ? 'meowtarot.webp' : 'meowtarot.png';
  const file = new File([blob], fileName, { type: blob.type || 'image/png' });
  if (navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
    try {
      showToast(strings.sharing);
      await navigator.share({ files: [file] });
      return;
    } catch (err) {
      console.warn('File share failed, falling back', err);
    }
  }

  if (navigator.share) {
    try {
      showToast(strings.sharing);
      await navigator.share({ url: shareLink, title: currentPayload.title || 'MeowTarot', text: currentPayload.subtitle });
      return;
    } catch (err) {
      console.warn('Link share failed, falling back', err);
    }
  }

  await handleCopy(strings.shareFail);
}

async function handleSave() {
  if (!currentPayload) return;
  const strings = getStrings(currentPayload.lang);
  console.info('Save action triggered');
  showToast(strings.openImage);
  let blob = null;
  try {
    blob = await ensurePoster();
  } catch (err) {
    console.error('Failed to generate poster for saving', err);
    await handleCopy(strings.posterFail);
    return;
  }
  if (!blob) {
    await handleCopy(strings.posterFail);
    return;
  }
  const url = ensurePosterUrl();
  if (!url) {
    showToast(strings.error, { tone: 'error', persist: true });
    return;
  }
  const popup = window.open(url, '_blank', 'noopener');
  if (!popup) {
    if (openLink) {
      openLink.hidden = false;
      openLink.href = url;
    }
    showToast(strings.popupBlocked, { tone: 'warning', persist: true });
    return;
  }
  showToast(strings.opened);
}

async function handleCopy(customMessage) {
  if (!currentPayload) return;
  const strings = getStrings(currentPayload.lang);
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(shareLink);
      showToast(customMessage || strings.copied);
      return;
    }
  } catch (err) {
    console.warn('Clipboard write failed, falling back', err);
  }

  const input = document.createElement('input');
  input.value = shareLink;
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  document.body.removeChild(input);
  showToast(customMessage || strings.copied);
}

function applyActionFocus() {
  const params = new URLSearchParams(window.location.search);
  const action = params.get('action');
  if (action === 'save') {
    saveBtn?.focus();
  } else if (action === 'share') {
    shareBtn?.focus();
  }
}

async function init() {
  console.info('Initializing share page');
  currentPayload = resolvePayload();
  const lang = currentPayload?.lang || 'en';
  const strings = getStrings(lang);
  shareLink = currentPayload ? buildShareLink(currentPayload) : window.location.href;

  if (!currentPayload) {
    showToast(strings.missing, { tone: 'error', persist: true });
    setLoading(false, strings);
    setActionLoading(false, strings);
    shareBtn.disabled = true;
    saveBtn.disabled = true;
    copyBtn.disabled = true;
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
  saveBtn.addEventListener('click', handleSave);
  copyBtn.addEventListener('click', () => handleCopy());
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
