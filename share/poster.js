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

function ellipsizeText(ctx, text, maxWidth) {
  const clean = String(text);
  if (ctx.measureText(clean).width <= maxWidth) return clean;
  let truncated = clean;
  while (truncated.length > 0 && ctx.measureText(`${truncated}…`).width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated ? `${truncated}…` : '…';
}

function tokenizeText(ctx, text, maxWidth) {
  const value = String(text || '');
  if (!value) return [];
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length > 1) return words;
  if (ctx.measureText(value).width <= maxWidth) return [value];
  return Array.from(value);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = Infinity) {
  if (!text) return y;
  const tokens = tokenizeText(ctx, text, maxWidth);
  let line = '';
  const lines = [];
  tokens.forEach((token) => {
    const candidate = line ? `${line} ${token}`.trim() : token;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = token;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);

  let output = lines;
  if (lines.length > maxLines) {
    output = lines.slice(0, maxLines);
    output[maxLines - 1] = ellipsizeText(ctx, output[maxLines - 1], maxWidth);
  }

  output.forEach((content, index) => {
    ctx.fillText(content, x, y + index * lineHeight);
  });
  return y + output.length * lineHeight;
}

function drawTextBlock(ctx, text, x, y, maxWidth, lineHeight) {
  return wrapText(ctx, text, x, y, maxWidth, lineHeight);
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function buildShareUrl(payload) {
  const json = JSON.stringify(payload || {});
  const encoded = btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return `${window.location.origin}/share/?d=${encoded}`;
}

function getDailyStrings(lang = 'en') {
  if (lang === 'th') {
    return {
      title: 'คำทำนายรายวัน',
      subtitle: 'คำตอบด่วน (1 ใบ)',
      readingHeading: 'คำทำนายวันนี้',
      luckyColors: 'สีนำโชค',
    };
  }
  return {
    title: 'Daily Reading',
    subtitle: 'Quick Answer (1 card)',
    readingHeading: 'Today’s Reading',
    luckyColors: 'Lucky colors',
  };
}

function isDailySingle(payload) {
  const spread = String(payload?.spread || '').toLowerCase();
  return payload?.mode === 'daily' && (spread === 'quick' || spread === 'single' || spread === 'one');
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

  if (isDailySingle(payload) && preset === 'story') {
    const safeMargin = 72;
    const strings = getDailyStrings(payload?.lang);
    const cardEntries = buildCardEntries(payload).slice(0, 1);
    const cardEntry = cardEntries[0];
    const reading = payload?.reading || {};
    const summary = reading.summary || payload?.headline || '';
    const advice = Array.isArray(reading.advice) ? reading.advice.filter(Boolean) : [];
    const caution = Array.isArray(reading.caution) ? reading.caution.filter(Boolean) : [];
    const lucky = payload?.lucky || {};
    const luckyColors = Array.isArray(lucky.colors) ? lucky.colors.filter(Boolean).slice(0, 3) : [];
    const hasLuckyRow = luckyColors.length || lucky?.number || lucky?.element || lucky?.planet;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#f8d77a';
    ctx.font = '600 76px "Poppins", "Space Grotesk", sans-serif';
    let cursorY = safeMargin + 16;
    ctx.fillText(strings.title, width / 2, cursorY + 72);
    cursorY += 96;

    ctx.fillStyle = '#d8dbe6';
    ctx.font = '500 40px "Space Grotesk", sans-serif';
    ctx.fillText(strings.subtitle, width / 2, cursorY + 48);
    cursorY += 72;

    if (cardEntry?.name) {
      ctx.fillStyle = '#f7f4ee';
      ctx.font = '500 32px "Space Grotesk", sans-serif';
      ctx.fillText(cardEntry.name, width / 2, cursorY + 36);
      cursorY += 52;
    }

    const cardWidth = 460;
    const cardHeight = Math.round(cardWidth * 1.55);
    const cardX = (width - cardWidth) / 2;
    const cardY = Math.max(cursorY + 24, height * 0.28);

    ctx.save();
    ctx.shadowColor = 'rgba(248, 215, 122, 0.35)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 16;
    ctx.fillStyle = '#0f1429';
    ctx.fillRect(cardX, cardY, cardWidth, cardHeight);
    ctx.restore();

    if (cardEntry?.card) {
      const baseId = baseCardId(cardEntry.card.id || cardEntry.card.card_id || cardEntry.card.image_id);
      const orientedId = `${baseId}-${cardEntry.orientation}`;
      const uprightId = `${baseId}-upright`;
      const primary = getCardImageUrl(
        { ...cardEntry.card, id: orientedId, card_id: orientedId, image_id: orientedId },
        { orientation: cardEntry.orientation },
      );
      const fallback = cardEntry.orientation === 'reversed'
        ? getCardImageUrl(
          { ...cardEntry.card, id: uprightId, card_id: uprightId, image_id: uprightId },
          { orientation: 'upright' },
        )
        : null;
      const img = await loadImageWithFallback(primary, fallback);
      ctx.drawImage(img, cardX, cardY, cardWidth, cardHeight);
    }

    const footerY = height - safeMargin;
    const luckyRowHeight = hasLuckyRow ? 96 : 0;
    const luckyRowTop = hasLuckyRow ? footerY - 32 - luckyRowHeight : footerY;
    const panelTop = cardY + cardHeight + 40;
    const panelBottom = hasLuckyRow ? luckyRowTop - 24 : footerY - 40;
    const panelHeight = Math.max(260, panelBottom - panelTop);
    const panelX = safeMargin;
    const panelWidth = width - safeMargin * 2;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 20, 41, 0.68)';
    drawRoundedRect(ctx, panelX, panelTop, panelWidth, panelHeight, 28);
    ctx.fill();
    ctx.restore();

    let panelCursorY = panelTop + 32;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f8d77a';
    ctx.font = '600 40px "Poppins", "Space Grotesk", sans-serif';
    panelCursorY = wrapText(ctx, strings.readingHeading, panelX + 32, panelCursorY + 40, panelWidth - 64, 48, 1);

    ctx.fillStyle = '#f7f4ee';
    ctx.font = '400 28px "Space Grotesk", sans-serif';
    panelCursorY = wrapText(ctx, summary, panelX + 32, panelCursorY + 8, panelWidth - 64, 36, 4);

    if (advice.length) {
      ctx.fillStyle = '#d8dbe6';
      ctx.font = '500 26px "Space Grotesk", sans-serif';
      advice.slice(0, 2).forEach((item) => {
        panelCursorY = wrapText(
          ctx,
          `• ${item}`,
          panelX + 32,
          panelCursorY + 8,
          panelWidth - 64,
          34,
          1,
        );
      });
    }

    if (caution.length) {
      ctx.fillStyle = '#c9a8ff';
      ctx.font = '500 26px "Space Grotesk", sans-serif';
      panelCursorY = wrapText(
        ctx,
        `• ${caution[0]}`,
        panelX + 32,
        panelCursorY + 8,
        panelWidth - 64,
        34,
        1,
      );
    }

    if (hasLuckyRow) {
      const rowY = luckyRowTop + luckyRowHeight / 2;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#f7f4ee';
      ctx.font = '500 26px "Space Grotesk", sans-serif';
      let x = safeMargin;
      ctx.fillText(strings.luckyColors, x, rowY);
      x += ctx.measureText(strings.luckyColors).width + 16;

      luckyColors.forEach((color) => {
        const label = color?.name || '';
        const hex = color?.hex || '#ffffff';
        ctx.save();
        ctx.fillStyle = hex;
        ctx.beginPath();
        ctx.arc(x + 12, rowY, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        x += 28;
        ctx.fillStyle = '#d8dbe6';
        ctx.fillText(label, x, rowY);
        x += ctx.measureText(label).width + 18;
      });

      const chips = [];
      if (lucky?.number) chips.push(`#${lucky.number}`);
      if (lucky?.element) chips.push(lucky.element);
      if (lucky?.planet) chips.push(lucky.planet);

      let chipX = width - safeMargin;
      chips.forEach((chip) => {
        ctx.font = '500 24px "Space Grotesk", sans-serif';
        const textWidth = ctx.measureText(chip).width;
        const paddingX = 16;
        const paddingY = 10;
        const chipWidth = textWidth + paddingX * 2;
        const chipHeight = 36;
        chipX -= chipWidth;
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        drawRoundedRect(ctx, chipX, rowY - chipHeight / 2, chipWidth, chipHeight, 18);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#f7f4ee';
        ctx.textAlign = 'left';
        ctx.fillText(chip, chipX + paddingX, rowY);
        chipX -= 12;
      });
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#aab0c9';
    ctx.font = '500 28px "Space Grotesk", sans-serif';
    ctx.fillText('meowtarot.com', width / 2, footerY);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 0.92));
    if (!blob) throw new Error('Failed to build poster blob');
    return { blob, width, height };
  }

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
