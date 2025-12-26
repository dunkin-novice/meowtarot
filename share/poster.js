import { getCardImageUrl, loadTarotData, meowTarotCards, normalizeId } from '../js/data.js';
import { findCardById, toOrientation } from '../js/reading-helpers.js';

const PRESETS = {
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1350 },
};

function createCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function baseCardId(id = '') {
  return normalizeId(String(id).replace(/-(upright|reversed)$/i, '')) || normalizeId(id);
}

function buildCardEntries(payload) {
  const cards = Array.isArray(payload?.cards) ? payload.cards : [];
  return cards
    .map((entry) => {
      const orientation = toOrientation(entry?.orientation || entry?.id || 'upright');
      const targetId = baseCardId(entry?.id || entry?.cardId || entry?.card_id);
      const hit = findCardById(meowTarotCards, targetId, normalizeId);
      return hit
        ? {
          card: hit,
          orientation,
          name: entry?.name || hit.card_name_en || hit.name_en || hit.name_th || hit.name || targetId,
        }
        : {
          card: null,
          orientation,
          name: entry?.name || targetId,
        };
    })
    .filter((entry) => entry.card || entry.name);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let done = false;
    const finalize = () => {
      if (done) return;
      done = true;
      resolve(img);
    };
    img.onload = finalize;
    img.onerror = reject;
    img.decoding = 'async';
    img.src = src;
    if (img.decode) {
      img.decode().then(finalize).catch(() => {});
    }
  });
}

async function loadImageWithFallback(primary, fallback) {
  try {
    return await loadImage(primary);
  } catch (err) {
    if (!fallback) throw err;
    return loadImage(fallback);
  }
}

function drawStarfield(ctx, width, height) {
  const stars = [
    [0.12, 0.2, 2.2],
    [0.22, 0.32, 1.6],
    [0.35, 0.16, 1.8],
    [0.68, 0.22, 1.4],
    [0.84, 0.18, 2.3],
    [0.15, 0.6, 1.1],
    [0.32, 0.72, 1.6],
    [0.8, 0.55, 1.2],
    [0.6, 0.72, 1.8],
  ];
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  stars.forEach(([x, y, r]) => {
    ctx.beginPath();
    ctx.arc(width * x, height * y, r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawTextBlock(ctx, text, x, y, maxWidth, lineHeight) {
  if (!text) return y;
  const words = String(text).split(' ');
  let line = '';
  for (let i = 0; i < words.length; i += 1) {
    const testLine = `${line}${words[i]} `;
    if (ctx.measureText(testLine).width > maxWidth && i > 0) {
      ctx.fillText(line.trim(), x, y);
      line = `${words[i]} `;
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) ctx.fillText(line.trim(), x, y);
  return y + lineHeight;
}

function buildShareUrl(payload) {
  const json = JSON.stringify(payload || {});
  const encoded = btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return `${window.location.origin}/share/?d=${encoded}`;
}

export async function buildPoster(payload, { preset = 'story' } = {}) {
  await loadTarotData();
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  const { width, height } = PRESETS[preset] || PRESETS.story;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#0b1020');
  gradient.addColorStop(1, '#141c33');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  drawStarfield(ctx, width, height);

  const title = payload?.title || 'MeowTarot Reading';
  const subtitle = payload?.subtitle || '';
  const keywords = Array.isArray(payload?.keywords) ? payload.keywords.filter(Boolean).slice(0, 3) : [];
  const shareUrl = payload?.canonicalUrl || buildShareUrl(payload);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#f8d77a';
  ctx.font = '600 72px "Poppins", "Space Grotesk", sans-serif';
  ctx.fillText(title, width / 2, 150);

  ctx.fillStyle = '#d8dbe6';
  ctx.font = '500 38px "Space Grotesk", sans-serif';
  if (subtitle) {
    ctx.fillText(subtitle, width / 2, 215);
  }

  if (keywords.length) {
    ctx.fillStyle = '#f7f4ee';
    ctx.font = '500 32px "Space Grotesk", sans-serif';
    ctx.fillText(keywords.join(' · '), width / 2, 265);
  }

  const cardEntries = buildCardEntries(payload);
  const cardCount = cardEntries.length || 1;
  const cardGap = cardCount > 1 ? 32 : 0;
  const cardWidth = cardCount === 1 ? 520 : 280;
  const cardHeight = Math.round(cardWidth * 1.55);
  const totalWidth = cardCount * cardWidth + (cardCount - 1) * cardGap;
  const startX = (width - totalWidth) / 2;
  const startY = height * 0.34;

  for (let i = 0; i < cardCount; i += 1) {
    const entry = cardEntries[i];
    const x = startX + i * (cardWidth + cardGap);
    const y = startY + (cardCount === 1 ? 0 : (i === 1 ? -20 : 10));

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = '#0f1429';
    ctx.fillRect(x, y, cardWidth, cardHeight);
    ctx.restore();

    if (entry?.card) {
      const baseId = baseCardId(entry.card.id || entry.card.card_id || entry.card.image_id);
      const orientedId = `${baseId}-${entry.orientation}`;
      const uprightId = `${baseId}-upright`;
      const primary = getCardImageUrl({ ...entry.card, id: orientedId, card_id: orientedId, image_id: orientedId }, { orientation: entry.orientation });
      const fallback = entry.orientation === 'reversed'
        ? getCardImageUrl({ ...entry.card, id: uprightId, card_id: uprightId, image_id: uprightId }, { orientation: 'upright' })
        : null;
      const img = await loadImageWithFallback(primary, fallback);
      ctx.drawImage(img, x, y, cardWidth, cardHeight);
    }
  }

  ctx.fillStyle = '#f7f4ee';
  ctx.font = '500 30px "Space Grotesk", sans-serif';
  drawTextBlock(ctx, payload?.headline || '', width / 2, height * 0.73, width * 0.78, 38);

  ctx.fillStyle = '#aab0c9';
  ctx.font = '500 28px "Space Grotesk", sans-serif';
  ctx.fillText('meowtarot.com', width / 2, height - 90);
  ctx.font = '400 22px "Space Grotesk", sans-serif';
  ctx.fillText(shareUrl, width / 2, height - 48);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 0.92));
  if (!blob) throw new Error('Failed to build poster blob');
  return { blob, width, height };
}

export { PRESETS };
