const LOW_CONTRAST_THRESHOLD = 1.9;
const ULTRA_LOW_CONTRAST_THRESHOLD = 1.35;

function clamp255(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function parseHexColor(raw) {
  const input = String(raw || '').trim();
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(input)) return null;
  let hex = input.slice(1);
  if (hex.length === 3) {
    hex = `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
  }
  if (hex.length === 8) hex = hex.slice(0, 6);
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

function parseRgbString(raw) {
  const input = String(raw || '').trim();
  const match = input.match(/^rgba?\(([^)]+)\)$/i);
  if (!match) return null;
  const parts = match[1].split(',').map((part) => part.trim());
  if (parts.length < 3) return null;
  const r = Number.parseFloat(parts[0]);
  const g = Number.parseFloat(parts[1]);
  const b = Number.parseFloat(parts[2]);
  if (![r, g, b].every(Number.isFinite)) return null;
  return { r: clamp255(r), g: clamp255(g), b: clamp255(b) };
}

export function parseColorToRgb(raw) {
  return parseHexColor(raw) || parseRgbString(raw);
}

function srgbToLinear(channel) {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(color) {
  if (!color) return null;
  const r = srgbToLinear(color.r);
  const g = srgbToLinear(color.g);
  const b = srgbToLinear(color.b);
  return (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
}

export function contrastRatio(colorA, colorB) {
  const lumA = relativeLuminance(colorA);
  const lumB = relativeLuminance(colorB);
  if (lumA == null || lumB == null) return null;
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}


export function getLuckyColorVisibilityStyle(fillColor, surfaceColor, options = {}) {
  const fillRgb = parseColorToRgb(fillColor);
  const surfaceRgb = parseColorToRgb(surfaceColor);
  if (!fillRgb || !surfaceRgb) {
    return {
      tier: 'normal',
      contrast: null,
      ringColor: 'rgba(80, 70, 110, 0.35)',
      ringWidth: 1.2,
      outerRingColor: null,
      outerRingWidth: 0,
    };
  }

  const contrast = contrastRatio(fillRgb, surfaceRgb) || 1;
  const lowThreshold = options.lowContrastThreshold || LOW_CONTRAST_THRESHOLD;
  const ultraThreshold = options.ultraLowContrastThreshold || ULTRA_LOW_CONTRAST_THRESHOLD;
  const tier = contrast <= ultraThreshold
    ? 'ultra-low-contrast'
    : contrast <= lowThreshold
      ? 'low-contrast'
      : 'normal';

  if (tier === 'ultra-low-contrast') {
    return {
      tier,
      contrast,
      ringColor: 'rgba(80, 70, 110, 0.55)',
      ringWidth: 1.2,
      outerRingColor: null,
      outerRingWidth: 0,
    };
  }

  if (tier === 'low-contrast') {
    return {
      tier,
      contrast,
      ringColor: 'rgba(80, 70, 110, 0.45)',
      ringWidth: 1.2,
      outerRingColor: null,
      outerRingWidth: 0,
    };
  }

  return {
    tier,
    contrast,
    ringColor: 'rgba(80, 70, 110, 0.35)',
    ringWidth: 1.2,
    outerRingColor: null,
    outerRingWidth: 0,
  };
}
