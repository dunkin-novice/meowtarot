const DEFAULT_ASSET_BASE_URL = '';
const PROD_ASSET_REVISION = '2026-03';

function trimSlashes(value = '') {
  return String(value || '').replace(/\/+$/g, '');
}

function isLocalDevHost() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname || '';
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

function getDefaultAssetRevision() {
  if (isLocalDevHost()) {
    // Prevent immutable-cache confusion in local dev by forcing a fresh revision per reload.
    return `dev-${Date.now()}`;
  }
  return PROD_ASSET_REVISION;
}

export const ASSET_BASE_URL = trimSlashes(
  (typeof window !== 'undefined' && window.MEOWTAROT_ASSET_BASE_URL) || DEFAULT_ASSET_BASE_URL,
);

export const ASSET_REVISION =
  (typeof window !== 'undefined' && window.MEOWTAROT_ASSET_REVISION) || getDefaultAssetRevision();

export function buildAssetUrl(pathname = '', { versioned = true } = {}) {
  const rawPath = String(pathname || '');
  if (!rawPath) return ASSET_BASE_URL || '/';
  if (/^https?:\/\//i.test(rawPath)) {
    if (!versioned || !ASSET_REVISION) return rawPath;
    const separator = rawPath.includes('?') ? '&' : '?';
    return `${rawPath}${separator}v=${encodeURIComponent(ASSET_REVISION)}`;
  }
  const cleanPath = rawPath.replace(/^\/+/, '');
  const basePath = ASSET_BASE_URL ? `${ASSET_BASE_URL}/${cleanPath}` : `/${cleanPath}`;
  if (!versioned || !ASSET_REVISION) return basePath;
  const separator = basePath.includes('?') ? '&' : '?';
  return `${basePath}${separator}v=${encodeURIComponent(ASSET_REVISION)}`;
}

export function resolveDeckAssetBase(deckFolder = '') {
  const clean = String(deckFolder || '').replace(/^\/+/, '').replace(/\/+$/g, '');
  return buildAssetUrl(clean, { versioned: false });
}
