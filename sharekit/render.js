/*
 * Rendering module for Share Kit
 * Renders reading results into preset social sizes using an offscreen canvas.
 */

const SHAREKIT_PRESETS = {
  story: { key: 'story', label: 'Story (9:16)', width: 1080, height: 1920 },
  postSquare: { key: 'postSquare', label: 'Post 1:1', width: 1080, height: 1080 },
  postPortrait: { key: 'postPortrait', label: 'Post 4:5', width: 1080, height: 1350 },
};

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

function createPlaceholderCard(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f7f7f7';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#d0d0d0';
  ctx.lineWidth = Math.max(2, width * 0.01);
  ctx.strokeRect(ctx.lineWidth, ctx.lineWidth, width - ctx.lineWidth * 2, height - ctx.lineWidth * 2);
  ctx.fillStyle = '#c0c0c0';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.floor(height * 0.08)}px "Inter", "SF Pro Display", "Segoe UI", sans-serif`;
  ctx.fillText('Card', width / 2, height / 2);
  return canvas;
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(/\s+/);
  const lines = [];

  if (words.length === 0) {
    return y;
  }

  let currentLine = words.shift();
  for (const word of words) {
    const testLine = `${currentLine} ${word}`;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth) {
      lines.push(currentLine);
      if (ctx.measureText(word).width > maxWidth) {
        let segment = '';
        for (const ch of word) {
          const part = segment + ch;
          if (ctx.measureText(part).width > maxWidth) {
            lines.push(segment);
            segment = ch;
          } else {
            segment = part;
          }
        }
        currentLine = segment;
      } else {
        currentLine = word;
      }
    } else {
      currentLine = testLine;
    }
  }

  // Handle languages with few spaces (Thai fallback)
  const pushThaiFragments = (fragment) => {
    let buffer = '';
    for (const ch of fragment) {
      const test = buffer + ch;
      if (ctx.measureText(test).width > maxWidth) {
        lines.push(buffer);
        buffer = ch;
      } else {
        buffer = test;
      }
    }
    if (buffer) lines.push(buffer);
  };

  const thaiRegex = /\p{Script=Thai}+/u;
  if (thaiRegex.test(currentLine)) {
    pushThaiFragments(currentLine);
  } else {
    lines.push(currentLine);
  }

  for (let i = 0; i < lines.length; i += 1) {
    ctx.fillText(lines[i], x, y + i * lineHeight);
  }
  return y + lines.length * lineHeight;
}

function createGradient(ctx, width, height, gradient) {
  const { from = '#1a1a1a', to = '#3a3a3a', direction = 'vertical' } = gradient || {};
  const grad = direction === 'radial'
    ? ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) / 1.4)
    : ctx.createLinearGradient(0, 0, direction === 'horizontal' ? width : 0, direction === 'vertical' ? height : 0);
  grad.addColorStop(0, from);
  grad.addColorStop(1, to);
  return grad;
}

function yieldFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function createRenderer(globalConfig = {}) {
  const imageCache = new Map();
  const renderCache = new Map();
  const placeholderCache = new Map();
  const quality = globalConfig.format === 'image/jpeg' ? globalConfig.quality || 0.92 : undefined;
  const format = globalConfig.format || 'image/png';

  async function loadImage(src) {
    if (!src) return null;
    if (imageCache.has(src)) return imageCache.get(src);
    const promise = new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
    imageCache.set(src, promise);
    return promise;
  }

  function getPlaceholder(width, height) {
    const key = `${width}x${height}`;
    if (!placeholderCache.has(key)) {
      placeholderCache.set(key, createPlaceholderCard(width, height));
    }
    return placeholderCache.get(key);
  }

  function buildCacheKey(readingResult, presetKey) {
    const { summary = '', readingType = '', cards = [], appTitle = '', showNames = true, showDate = false, link = '' } = readingResult;
    const cardKeys = cards.map((c) => `${c.name || ''}-${c.image || ''}`).join('|');
    return `${presetKey}-${appTitle}-${readingType}-${showNames}-${showDate}-${summary}-${cardKeys}-${link}`;
  }

  async function renderReading(readingResult, presetKey, options = {}) {
    const preset = SHAREKIT_PRESETS[presetKey];
    if (!preset) throw new Error(`Unknown preset: ${presetKey}`);

    const cacheKey = buildCacheKey(readingResult, presetKey);
    if (renderCache.has(cacheKey)) {
      return renderCache.get(cacheKey);
    }

    const scale = clamp(window.devicePixelRatio || 1, 1, 2);
    const workWidth = Math.floor(preset.width * scale);
    const workHeight = Math.floor(preset.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = workWidth;
    canvas.height = workHeight;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    const theme = {
      gradient: { from: '#0d0b13', to: '#1d1a2b', direction: 'vertical' },
      titleColor: '#ffffff',
      subtitleColor: 'rgba(255,255,255,0.82)',
      summaryColor: 'rgba(255,255,255,0.92)',
      watermarkColor: 'rgba(255,255,255,0.7)',
      cardLabelColor: 'rgba(255,255,255,0.85)',
      ...globalConfig.theme,
      ...options.theme,
    };

    // Background
    ctx.fillStyle = createGradient(ctx, preset.width, preset.height, theme.gradient);
    ctx.fillRect(0, 0, preset.width, preset.height);

    ctx.fillStyle = theme.titleColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const margin = Math.floor(preset.height * 0.05);
    const titleY = margin;
    ctx.font = `700 ${Math.floor(preset.width * 0.06)}px "Inter", "SF Pro Display", "Segoe UI", sans-serif`;
    ctx.fillText(readingResult.appTitle || 'MeowTarot', preset.width / 2, titleY);

    const subtitleY = titleY + Math.floor(preset.height * 0.05);
    ctx.fillStyle = theme.subtitleColor;
    ctx.font = `600 ${Math.floor(preset.width * 0.045)}px "Inter", "SF Pro Display", "Segoe UI", sans-serif`;
    const readingLabel = readingResult.readingType || 'Tarot Reading';
    ctx.fillText(readingLabel, preset.width / 2, subtitleY);

    if (readingResult.showDate && readingResult.completedAt) {
      ctx.font = `400 ${Math.floor(preset.width * 0.035)}px "Inter", "SF Pro Display", "Segoe UI", sans-serif`;
      ctx.fillText(new Date(readingResult.completedAt).toLocaleString(), preset.width / 2, subtitleY + Math.floor(preset.height * 0.045));
    }

    await yieldFrame();

    // Cards
    const cardAreaTop = Math.floor(preset.height * 0.2);
    const cardAreaHeight = Math.floor(preset.height * 0.4);
    const cardCount = clamp((readingResult.cards || []).length || 1, 1, 3);
    const gap = Math.floor(preset.width * 0.03);
    const cardWidth = cardCount === 1 ? Math.floor(preset.width * 0.38) : Math.floor((preset.width - (gap * (cardCount - 1)) - margin * 2) / cardCount);
    const cardHeight = Math.floor(cardWidth * 1.7);
    const cardY = cardAreaTop + Math.max(0, (cardAreaHeight - cardHeight) / 2);

    const loadedCards = await Promise.all((readingResult.cards || []).slice(0, 3).map((card) => loadImage(card.image)));

    for (let i = 0; i < cardCount; i += 1) {
      const card = readingResult.cards && readingResult.cards[i];
      const img = loadedCards[i];
      const x = (preset.width - (cardWidth * cardCount + gap * (cardCount - 1))) / 2 + i * (cardWidth + gap);
      const y = cardY;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, cardWidth, cardHeight, Math.floor(cardWidth * 0.04));
      ctx.clip();
      if (img) {
        ctx.drawImage(img, x, y, cardWidth, cardHeight);
      } else {
        const placeholder = getPlaceholder(cardWidth, cardHeight);
        ctx.drawImage(placeholder, x, y, cardWidth, cardHeight);
      }
      ctx.restore();

      if (readingResult.showNames && card && card.name) {
        ctx.fillStyle = theme.cardLabelColor;
        ctx.font = `600 ${Math.floor(cardWidth * 0.08)}px "Inter", "SF Pro Display", "Segoe UI", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(card.name, x + cardWidth / 2, y + cardHeight + Math.floor(cardWidth * 0.12));
      }
    }

    await yieldFrame();

    // Summary
    ctx.textAlign = 'left';
    ctx.fillStyle = theme.summaryColor;
    ctx.font = `500 ${Math.floor(preset.width * 0.045)}px "Inter", "SF Pro Display", "Segoe UI", sans-serif`;
    const summaryBoxWidth = preset.width - margin * 2;
    const summaryY = Math.floor(preset.height * 0.68);
    const lineHeight = Math.floor(preset.width * 0.06);
    wrapText(ctx, readingResult.summary || '', margin, summaryY, summaryBoxWidth, lineHeight);

    // Branding layer
    ctx.textAlign = 'right';
    ctx.fillStyle = theme.wartermarkColor || theme.watermarkColor || 'rgba(255,255,255,0.72)';
    ctx.font = `600 ${Math.floor(preset.width * 0.035)}px "Inter", "SF Pro Display", "Segoe UI", sans-serif`;
    ctx.fillText(globalConfig.watermarkText || 'meowtarot.com', preset.width - margin, preset.height - margin * 0.6);

    ctx.textAlign = 'center';
    ctx.font = `500 ${Math.floor(preset.width * 0.03)}px "Inter", "SF Pro Display", "Segoe UI", sans-serif`;
    const shareUrl = readingResult.shareUrl || (globalConfig.baseUrl ? `${globalConfig.baseUrl.replace(/\/$/, '')}${readingResult.slug ? `/reading/${readingResult.slug}` : ''}` : '');
    if (shareUrl) {
      ctx.fillText(shareUrl, preset.width / 2, preset.height - margin * 0.6);
    }

    if (options.safeZone) {
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.setLineDash([10, 8]);
      ctx.lineWidth = 2;
      const pad = Math.floor(preset.width * 0.05);
      ctx.strokeRect(pad, pad, preset.width - pad * 2, preset.height - pad * 2);
      ctx.setLineDash([]);
    }

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = preset.width;
    outputCanvas.height = preset.height;
    const outputCtx = outputCanvas.getContext('2d');
    outputCtx.drawImage(canvas, 0, 0, preset.width, preset.height);

    const blob = await new Promise((resolve) => outputCanvas.toBlob(resolve, format, quality));
    const url = URL.createObjectURL(blob);
    const result = { blob, url, preset, mime: format };
    renderCache.set(cacheKey, result);
    return result;
  }

  return { presets: SHAREKIT_PRESETS, renderReading, wrapText };
}

window.ShareKitRenderer = { createRenderer, SHAREKIT_PRESETS };
