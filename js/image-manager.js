import { ASSET_BASE_URL } from './asset-config.js';

const DEFAULT_CDN_BASES = [];

function getConfiguredCdnBases() {
  if (typeof window === 'undefined') return DEFAULT_CDN_BASES;
  if (Array.isArray(window.MEOWTAROT_CDN_BASES) && window.MEOWTAROT_CDN_BASES.length) {
    return window.MEOWTAROT_CDN_BASES;
  }
  if (typeof window.MEOWTAROT_CDN_BASE === 'string' && window.MEOWTAROT_CDN_BASE) {
    return [window.MEOWTAROT_CDN_BASE];
  }
  if (ASSET_BASE_URL) return [ASSET_BASE_URL, ...DEFAULT_CDN_BASES].filter(Boolean);
  return DEFAULT_CDN_BASES;
}

function toAbsoluteUrl(src) {
  if (!src) return null;
  const base = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
  try {
    return new URL(src, base).toString();
  } catch (error) {
    return src;
  }
}

function stripLeadingSlash(pathname = '') {
  return pathname.startsWith('/') ? pathname.slice(1) : pathname;
}

function joinPath(base = '', subpath = '') {
  if (!base && !subpath) return '';
  if (!base) return subpath.replace(/^\/+/, '');
  if (!subpath) return base.replace(/\/+$/, '');
  return `${base.replace(/\/+$/, '')}/${subpath.replace(/^\/+/, '')}`;
}

function buildCdnFallbacks(src) {
  if (!src || /^(data|blob):/i.test(src)) return [];
  if (typeof window === 'undefined') return [];
  let url;
  try {
    url = new URL(src, window.location.origin);
  } catch (error) {
    return [];
  }
  const path = stripLeadingSlash(url.pathname);
  if (!path) return [];

  const cdnBases = getConfiguredCdnBases();
  return cdnBases
    .filter(Boolean)
    .map((base) => joinPath(base, path));
}

function shouldTryPngFallback() {
  if (typeof window === 'undefined') return false;
  if (window.MEOWTAROT_ENABLE_WEBP_PNG_FALLBACK !== true) return false;
  if (window.MEOWTAROT_ASSUME_WEBP_SUPPORTED === true) return false;

  if (typeof window.MEOWTAROT_WEBP_SUPPORTED === 'boolean') {
    return window.MEOWTAROT_WEBP_SUPPORTED === false;
  }

  try {
    const canvas = document.createElement('canvas');
    if (!canvas?.toDataURL) return true;
    const data = canvas.toDataURL('image/webp');
    return !data.startsWith('data:image/webp');
  } catch (error) {
    return true;
  }
}

function buildFormatFallbacks(src) {
  if (!shouldTryPngFallback()) return [];
  if (!src || /^(data|blob):/i.test(src) || !/\.webp($|[?#])/i.test(src)) return [];
  const asPng = src.replace(/\.webp(?=($|[?#]))/i, '.png');
  if (asPng === src) return [];
  return [asPng];
}

function uniqueSources(sources) {
  const seen = new Set();
  return sources.filter((source) => {
    const key = source || '';
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function createImageManager() {
  const imageCache = new Map();

  async function waitForLoad(img) {
    if (img.complete && img.naturalWidth) return;
    await new Promise((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = (err) => reject(err);
    });
  }

  async function loadImage(src, { crossOrigin = 'anonymous' } = {}) {
    if (!src) return null;
    const absolute = toAbsoluteUrl(src);
    if (imageCache.has(absolute)) return imageCache.get(absolute);

    const promise = (async () => {
      const img = new Image();
      img.decoding = 'async';
      if (crossOrigin) {
        // NOTE: cdn.meowtarot.com must return Access-Control-Allow-Origin: * for cross-origin canvas/image usage.
        img.crossOrigin = crossOrigin;
      }
      img.src = absolute;

      if (img.decode) {
        try {
          await img.decode();
          return img;
        } catch (error) {
          await waitForLoad(img);
          return img;
        }
      }

      await waitForLoad(img);
      return img;
    })();

    imageCache.set(absolute, promise);
    return promise;
  }

  function buildSourceList(primary, fallbacks = []) {
    const seeds = [primary, ...fallbacks].filter(Boolean);
    const sources = seeds.flatMap((src) => [src, ...buildFormatFallbacks(src)]);
    const expanded = sources.flatMap((src) => [src, ...buildCdnFallbacks(src)]);
    return uniqueSources(expanded);
  }

  async function loadWithFallback(primary, fallbacks = [], options = {}) {
    const sources = buildSourceList(primary, fallbacks);
    let lastError;
    for (const source of sources) {
      try {
        return await loadImage(source, options);
      } catch (error) {
        lastError = error;
        console.warn('[Image] failed', { url: source, reason: error?.message || String(error) });
      }
    }
    if (lastError) {
      throw lastError;
    }
    return null;
  }

  return {
    loadImage,
    loadWithFallback,
    loadImageWithFallback: loadWithFallback,
    buildSourceList,
  };
}

export function getImageManager() {
  if (typeof window === 'undefined') {
    return createImageManager();
  }
  if (!window.ImageManager) {
    window.ImageManager = createImageManager();
  }
  return window.ImageManager;
}

export const imageManager = getImageManager();
