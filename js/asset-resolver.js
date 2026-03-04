import { buildAssetUrl } from './asset-config.js';

const DEFAULT_FACE_PACK = 'meow-v1';
const DEFAULT_BACK_PACK = 'meow-v2';
const FALLBACK_BACK_PACK = 'meow-v1';

function cleanId(value = '') {
  return String(value || '').replace(/^\/+/, '').replace(/\.webp$/i, '');
}

export function resolveCardFacePath({ id, pack = DEFAULT_FACE_PACK } = {}) {
  const clean = cleanId(id);
  if (!clean) return null;
  return `assets/${pack}/${clean}.webp`;
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
