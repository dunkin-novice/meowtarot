import { ASSET_BASE_URL, buildAssetUrl } from './asset-config.js';

const DEFAULT_FACE_PACK = 'meow-v2';
const DEFAULT_BACK_PACK = 'meow-v2';
const FALLBACK_BACK_PACK = 'meow-v2';
const GLOBAL_SITE_FALLBACK_PATH = 'assets/meowtarot-og.jpg';
const CARD_EXISTS_CACHE = new Map();
const FALLBACK_LOG_CACHE = new Set();
let didLogAssetBase = false;

function cleanId(value = '') {
  return String(value || '').replace(/^\/+/, '').replace(/\.webp$/i, '');
}

export function resolveCardFacePath({ id, pack = DEFAULT_FACE_PACK } = {}) {
  const clean = cleanId(id);
  if (!clean) return null;
  return `assets/${pack}/${clean}.webp`;
}

function zeroPad2(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return '';
  return String(Math.trunc(num)).padStart(2, '0');
}

function toSlug(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseCardIdentity(card = {}, orientation = 'upright') {
  const normalizedOrientation = orientation === 'reversed' ? 'reversed' : 'upright';
  const rawId = cleanId(card?.id || card?.card_id || card?.image_id || '');
  const match = rawId.match(/^(\d{2})-(.+)-(upright|reversed)$/i);
  if (match) {
    return { nn: match[1], slug: match[2], orientation: normalizedOrientation };
  }

  const nn = zeroPad2(card?.number);
  const slug = toSlug(card?.slug || card?.name_en || card?.name || card?.card_name_en || '');
  return { nn, slug, orientation: normalizedOrientation };
}


function isNodeOfflineMode() {
  if (typeof window !== 'undefined') return false;
  return String(globalThis?.process?.env?.MEOW_ASSET_OFFLINE || '').trim() === '1';
}

function isAssetDebugEnabled() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.DEBUG_SHARE_CI || window.DEBUG_POSTER_CI || String(window.POSTER_DEBUG || '').trim() === '1');
}

function debugAssetBaseOnce() {
  if (!isAssetDebugEnabled() || didLogAssetBase) return;
  didLogAssetBase = true;
  console.info('[Assets] ASSET_BASE =', ASSET_BASE_URL || '/');
}

function debugFallbackOnce(key, message, card = {}) {
  if (!isAssetDebugEnabled() || FALLBACK_LOG_CACHE.has(key)) return;
  FALLBACK_LOG_CACHE.add(key);
  const idOrSlug = card?.id || card?.slug || card?.card_id || card?.image_id || 'unknown-card';
  console.info(message, idOrSlug);
}

export async function exists(url) {
  if (!url) return false;
  if (CARD_EXISTS_CACHE.has(url)) return CARD_EXISTS_CACHE.get(url);

  debugAssetBaseOnce();

  if (isNodeOfflineMode()) {
    CARD_EXISTS_CACHE.set(url, false);
    return false;
  }

  if (typeof window !== 'undefined') {
    const doesExist = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      const bust = `v=${Date.now()}`;
      img.src = `${url}${url.includes('?') ? '&' : '?'}${bust}`;
    });
    CARD_EXISTS_CACHE.set(url, doesExist);
    return doesExist;
  }

  let doesExist = false;
  try {
    const headRes = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    doesExist = headRes.status >= 200 && headRes.status <= 299;
  } catch (_error) {
    try {
      const getRes = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: { Range: 'bytes=0-0' },
      });
      doesExist = getRes.status >= 200 && getRes.status <= 299;
    } catch (_fallbackError) {
      doesExist = false;
    }
  }

  CARD_EXISTS_CACHE.set(url, doesExist);
  return doesExist;
}

export function buildCardImageUrls(card = {}, orientation = 'upright') {
  const { nn, slug } = parseCardIdentity(card, orientation);
  const uprightPath = nn && slug ? `assets/meow-v2/${nn}-${slug}-upright.webp` : null;
  const reversedPath = nn && slug ? `assets/meow-v2/${nn}-${slug}-reversed.webp` : null;
  const backPath = 'assets/meow-v2/00-back.webp';
  return {
    uprightUrl: uprightPath ? buildAssetUrl(uprightPath, { versioned: true }) : null,
    reversedUrl: reversedPath ? buildAssetUrl(reversedPath, { versioned: true }) : null,
    backUrl: buildAssetUrl(backPath, { versioned: true }),
  };
}

export async function resolveCardImageUrl(card = {}, orientation = 'upright') {
  const normalizedOrientation = orientation === 'reversed' ? 'reversed' : 'upright';
  const { uprightUrl, reversedUrl, backUrl } = buildCardImageUrls(card, normalizedOrientation);

  if (normalizedOrientation === 'reversed') {
    if (reversedUrl && await exists(reversedUrl)) return reversedUrl;
    debugFallbackOnce(`rev:${card?.id || card?.slug || ''}`, '[Assets] reversed missing → fallback to upright', card);
    if (uprightUrl && await exists(uprightUrl)) return uprightUrl;
    debugFallbackOnce(`up:${card?.id || card?.slug || ''}`, '[Assets] upright missing → fallback to back', card);
    return backUrl;
  }

  if (uprightUrl && await exists(uprightUrl)) return uprightUrl;
  debugFallbackOnce(`up:${card?.id || card?.slug || ''}`, '[Assets] upright missing → fallback to back', card);
  return backUrl;
}

export function getGlobalSiteFallbackImageUrl() {
  return buildAssetUrl(GLOBAL_SITE_FALLBACK_PATH, { versioned: true });
}

export async function resolveCardShareImageUrl(card = {}, orientation = 'upright') {
  const normalizedOrientation = orientation === 'reversed' ? 'reversed' : 'upright';
  const { uprightUrl, reversedUrl, backUrl } = buildCardImageUrls(card, normalizedOrientation);
  const cardSlug = card?.seo_slug_en || card?.slug || card?.card_id || card?.id || 'unknown-card';
  const globalFallbackUrl = getGlobalSiteFallbackImageUrl();

  const steps = normalizedOrientation === 'reversed'
    ? [
      { label: 'reversed uploaded image', url: reversedUrl },
      { label: 'upright uploaded image', url: uprightUrl },
      { label: 'card-level default fallback image', url: backUrl },
      { label: 'global site fallback image', url: globalFallbackUrl, skipExistsCheck: true },
    ]
    : [
      { label: 'upright uploaded image', url: uprightUrl },
      { label: 'card-level default fallback image', url: backUrl },
      { label: 'global site fallback image', url: globalFallbackUrl, skipExistsCheck: true },
    ];

  for (const step of steps) {
    const requestedImageUrl = step.url || null;
    if (!requestedImageUrl) {
      console.info('[Assets][share-image]', {
        cardSlug,
        orientation: normalizedOrientation,
        requestedImageUrl,
        assetExists: false,
        chosenFinalFallbackUrl: null,
        step: step.label,
      });
      continue;
    }

    const assetExists = step.skipExistsCheck ? true : await exists(requestedImageUrl);
    const chosenFinalFallbackUrl = assetExists ? requestedImageUrl : null;

    console.info('[Assets][share-image]', {
      cardSlug,
      orientation: normalizedOrientation,
      requestedImageUrl,
      assetExists,
      chosenFinalFallbackUrl,
      step: step.label,
    });

    if (assetExists) return requestedImageUrl;
  }

  return globalFallbackUrl;
}

export function resolveCardBackPath({ preferredPack = DEFAULT_BACK_PACK } = {}) {
  return `assets/${preferredPack || DEFAULT_BACK_PACK}/00-back.webp`;
}

export function resolveCardBackFallbackPath() {
  return `assets/${FALLBACK_BACK_PACK}/00-back.webp`;
}

function resolveDailyOrientation(payload = {}) {
  const posterOrientation = payload?.poster?.orientation;
  if (posterOrientation) return String(posterOrientation).toLowerCase();
  const payloadOrientation = payload?.orientation || payload?.card?.orientation;
  if (payloadOrientation) return String(payloadOrientation).toLowerCase();
  const firstCardOrientation = Array.isArray(payload?.cards) ? payload.cards[0]?.orientation : null;
  return String(firstCardOrientation || 'upright').toLowerCase();
}

export function resolvePosterBackgroundPath({ payload } = {}) {
  const pinned = payload?.poster?.backgroundPath || payload?.debugBackgroundPath;
  if (pinned) return pinned;

  const mode = String(payload?.poster?.mode || payload?.mode || '').toLowerCase();
  if (mode === 'daily') {
    return resolveDailyOrientation(payload) === 'reversed'
      ? 'backgrounds/bg-daily-reversed-v2.webp'
      : 'backgrounds/bg-daily-upright-v2.webp';
  }

  if (mode === 'full' || mode === 'question') {
    return 'backgrounds/bg-full.webp';
  }

  return 'backgrounds/bg-000.webp';
}

export function toAssetUrl(pathname) {
  return buildAssetUrl(pathname);
}
