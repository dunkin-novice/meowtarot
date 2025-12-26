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

const STRINGS = {
  en: {
    generating: 'Generating poster…',
    ready: 'Poster ready',
    missing: 'Missing reading data. Please start from a reading result.',
    shareFail: 'Share unavailable. Link copied instead.',
    copied: 'Link copied!',
    openImage: 'Opening image…',
  },
  th: {
    generating: 'กำลังสร้างโปสเตอร์…',
    ready: 'โปสเตอร์พร้อมแชร์',
    missing: 'ไม่พบข้อมูลคำทำนาย โปรดเริ่มจากหน้าผลลัพธ์',
    shareFail: 'แชร์ไม่ได้ จึงคัดลอกลิงก์แทน',
    copied: 'คัดลอกลิงก์แล้ว',
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

function setLoading(isLoading, strings) {
  if (!loadingEl) return;
  loadingEl.textContent = isLoading ? strings.generating : '';
  loadingEl.hidden = !isLoading;
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
  posterPromise = (async () => {
    const result = await buildPoster(currentPayload, { preset: 'story' });
    if (result.width !== 1080 || result.height !== 1920) {
      throw new Error('Unexpected poster size');
    }
    setPosterBlob(result.blob);
    setLoading(false, strings);
    setStatus(strings.ready);
    return result.blob;
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
  const blob = await ensurePoster();
  if (!blob) return;

  const file = new File([blob], `meowtarot-${Date.now()}.png`, { type: 'image/png' });
  if (navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: currentPayload.title || 'MeowTarot', text: currentPayload.subtitle });
      return;
    } catch (_) {
      // fallback
    }
  }

  if (navigator.share) {
    try {
      await navigator.share({ title: currentPayload.title || 'MeowTarot', text: currentPayload.subtitle, url: shareLink });
      return;
    } catch (_) {
      // fallback
    }
  }

  await handleCopy(strings.shareFail);
}

async function handleSave() {
  if (!currentPayload) return;
  const strings = getStrings(currentPayload.lang);
  setStatus(strings.openImage);
  const blob = await ensurePoster();
  if (!blob) return;
  const url = ensurePosterUrl();
  if (!url) return;
  window.open(url, '_blank', 'noopener');
}

async function handleCopy(customMessage) {
  if (!currentPayload) return;
  const strings = getStrings(currentPayload.lang);
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(shareLink);
      setStatus(customMessage || strings.copied);
      return;
    }
  } catch (_) {
    // ignore and fallback
  }

  const input = document.createElement('input');
  input.value = shareLink;
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  document.body.removeChild(input);
  setStatus(customMessage || strings.copied);
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
  currentPayload = resolvePayload();
  const lang = currentPayload?.lang || 'en';
  const strings = getStrings(lang);
  shareLink = currentPayload ? buildShareLink(currentPayload) : window.location.href;

  if (!currentPayload) {
    setStatus(strings.missing);
    setLoading(false, strings);
    shareBtn.disabled = true;
    saveBtn.disabled = true;
    copyBtn.disabled = true;
    return;
  }

  document.title = `${currentPayload.title || 'MeowTarot'} – Share`;
  if (!isIOS()) {
    hintEl.hidden = true;
  }

  try {
    await ensurePoster();
  } catch (err) {
    setStatus(strings.missing);
    setLoading(false, strings);
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
