import {
  getActiveDeck,
  getCardImageUrl,
  joinAssetPath,
  loadTarotData,
  meowTarotCards,
  normalizeId,
} from '../js/data.js';
import { imageManager } from '../js/image-manager.js';
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

async function canvasToBlob(canvas, quality = 0.92) {
  const webpBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
  if (webpBlob && webpBlob.type === 'image/webp') {
    return webpBlob;
  }
  const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', quality));
  return pngBlob;
}

function baseCardId(id = '') {
  return normalizeId(String(id).replace(/-(upright|reversed)$/i, '')) || normalizeId(id);
}

function getCleanAssetsBase() {
  const deck = getActiveDeck();
  return deck.assetsBase;
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

let tarotDataPromise = null;

function ensureTarotData() {
  if (meowTarotCards.length) return Promise.resolve(meowTarotCards);
  if (!tarotDataPromise) {
    tarotDataPromise = loadTarotData().finally(() => {
      tarotDataPromise = null;
    });
  }
  return tarotDataPromise;
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

function wrapTextLines(ctx, text, maxWidth, maxLines = Infinity) {
  if (!text) return [];
  const tokens = tokenizeText(ctx, text, maxWidth);
  const lines = [];
  let line = '';

  let overflow = false;
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const candidate = line ? `${line} ${token}`.trim() : token;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = token;
    } else {
      line = candidate;
    }

    if (lines.length === maxLines) {
      overflow = i < tokens.length - 1 || line;
      line = '';
      break;
    }
  }

  if (line && lines.length < maxLines) {
    lines.push(line);
  }

  if (overflow && lines.length) {
    lines[maxLines - 1] = ellipsizeText(ctx, lines[maxLines - 1], maxWidth);
  }
  return lines;
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = Infinity) {
  if (!text) return y;
  const lines = wrapTextLines(ctx, text, maxWidth, maxLines);
  lines.forEach((content, index) => {
    ctx.fillText(content, x, y + index * lineHeight);
  });
  return y + lines.length * lineHeight;
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

function getDailyStrings(lang = 'en') {
  if (lang === 'th') {
    return {
      title: 'MEOW TAROT',
      subtitle: 'คำทำนายรายวัน',
      luckyColors: 'สีมงคลวันนี้',
      archetypeLabel: 'THE ARCHETYPE',
    };
  }
  return {
    title: 'MEOW TAROT',
    subtitle: 'Daily Reading',
    luckyColors: 'Lucky Colors',
    archetypeLabel: 'THE ARCHETYPE',
  };
}

function isDailySingle(payload) {
  const spread = String(payload?.spread || '').toLowerCase();
  return payload?.mode === 'daily' && (spread === 'quick' || spread === 'single' || spread === 'one');
}

function getOrientationLabel(lang, orientation) {
  if (lang === 'th') {
    return orientation === 'reversed' ? 'กลับหัว' : 'ตั้งตรง';
  }
  return orientation === 'reversed' ? 'Reversed' : 'Upright';
}

function getCardName(card, lang) {
  if (!card) return '';
  if (lang === 'th') {
    return card.alias_th || card.card_name_th || card.name_th || card.name || '';
  }
  return card.card_name_en || card.name_en || card.name || '';
}

function buildDailyReadingFromCard(card, orientation, lang) {
  if (!card) return null;
  const name = getCardName(card, lang);
  const orient = getOrientationLabel(lang, orientation);
  return {
    heading: name,
    subHeading: orient,
    archetype: lang === 'th' ? card.archetype_th : card.archetype_en,
    keywords: lang === 'th' ? card.tarot_imply_th : card.tarot_imply_en,
  };
}

function resolveDailyReading(payload, cardEntry, lang) {
  const payloadReading = payload?.reading || {};
  const cardReading = buildDailyReadingFromCard(cardEntry?.card, cardEntry?.orientation, lang) || {};
  return {
    heading: payloadReading.heading || cardReading.heading || '',
    subHeading: payloadReading.subHeading || cardReading.subHeading || '',
    archetype: payloadReading.archetype || cardReading.archetype || '',
    keywords: payloadReading.keywords || cardReading.keywords || '',
  };
}

function resolveLuckyInfo(payload, cardEntry) {
  const lucky = payload?.lucky || {};
  const colors = Array.isArray(lucky.colors) && lucky.colors.length
    ? lucky.colors
    : Array.isArray(cardEntry?.card?.color_palette)
      ? cardEntry.card.color_palette.map((hex) => ({ hex }))
      : [];
  return {
    colors: colors.filter(Boolean).slice(0, 3),
    element: lucky.element || cardEntry?.card?.element || '',
    planet: lucky.planet || cardEntry?.card?.planet || '',
    number: lucky.number ?? cardEntry?.card?.numerology_value,
  };
}

export async function buildPoster(payload, { preset = 'story' } = {}) {
  await ensureTarotData();
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }
  console.log('[Poster] Data loaded');

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
    const lang = payload?.lang || 'en';
    const strings = getDailyStrings(lang);
    const cardEntries = buildCardEntries(payload).slice(0, 1);
    const cardEntry = cardEntries[0];
    const reading = resolveDailyReading(payload, cardEntry, lang);
    const lucky = resolveLuckyInfo(payload, cardEntry);
    const luckyColors = (lucky.colors || []).slice(0, 4);
    const hasLuckyRow = luckyColors.length > 0;
    const hasReadingPanel = Boolean(reading.heading || reading.subHeading || reading.archetype || reading.keywords);
    const layout = {
      headerTop: 160,
      logoY: 80,
      cardTop: 260,
      cardMaxHeight: 1100,
      panelTop: 1400,
      panelHeight: 400,
      panelPadding: 40,
      luckyRowY: 1780,
      footerY: 1880,
    };

    const footerY = layout.footerY;
    const panelX = safeMargin;
    const panelWidth = width - safeMargin * 2;
    const panelTop = layout.panelTop;
    const panelHeight = layout.panelHeight;

    const drawBrandMark = () => {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#f8d77a';
      ctx.font = '700 78px "Poppins", "Space Grotesk", sans-serif';
      ctx.fillText('M', width / 2, layout.logoY);
      const textWidth = ctx.measureText('M').width;
      const earWidth = 18;
      const earHeight = 16;
      const leftEarX = width / 2 - textWidth / 2 + 6;
      const rightEarX = width / 2 + textWidth / 2 - earWidth - 6;
      const earBaseY = layout.logoY - 46;
      ctx.beginPath();
      ctx.moveTo(leftEarX, earBaseY);
      ctx.lineTo(leftEarX + earWidth / 2, earBaseY - earHeight);
      ctx.lineTo(leftEarX + earWidth, earBaseY);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(rightEarX, earBaseY);
      ctx.lineTo(rightEarX + earWidth / 2, earBaseY - earHeight);
      ctx.lineTo(rightEarX + earWidth, earBaseY);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    const drawHeader = () => {
      const maxWidth = width - safeMargin * 2;
      let cursorY = layout.headerTop;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#f8d77a';
      ctx.font = '600 48px "Poppins", "Space Grotesk", sans-serif';
      wrapText(ctx, strings.title, width / 2, cursorY, maxWidth, 54, 1);
      cursorY += 62;
      ctx.fillStyle = '#d8dbe6';
      ctx.font = '500 30px "Space Grotesk", sans-serif';
      wrapText(ctx, strings.subtitle, width / 2, cursorY, maxWidth, 36, 1);
    };

    const resolveCardImage = async () => {
      if (!cardEntry?.card) return null;
      const baseId = baseCardId(cardEntry.card.id || cardEntry.card.card_id || cardEntry.card.image_id);
      const orientedId = `${baseId}-${cardEntry.orientation}`;
      const uprightId = `${baseId}-upright`;
      const cleanBase = getCleanAssetsBase();
      const primary = joinAssetPath(cleanBase, `${orientedId}.webp`);
      const upright = joinAssetPath(cleanBase, `${uprightId}.webp`);
      const back = joinAssetPath(cleanBase, '00-back.webp');
      return imageManager.loadWithFallback(primary, [upright, back]);
    };

    const drawReadingPanel = () => {
      if (!hasReadingPanel) return;

      ctx.save();
      ctx.fillStyle = 'rgba(20, 28, 51, 0.4)';
      drawRoundedRect(ctx, panelX, panelTop, panelWidth, panelHeight, 32);
      ctx.fill();
      ctx.strokeStyle = 'rgba(248, 215, 122, 0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      let panelCursorY = panelTop + 60;
      const panelCenterX = width / 2;
      const panelTextWidth = panelWidth - 80;

      ctx.textAlign = 'center';

      ctx.fillStyle = '#f8d77a';
      ctx.font = '600 42px "Prata", serif';
      const heading = reading.heading ? reading.heading.toUpperCase() : '';
      panelCursorY = wrapText(
        ctx,
        heading,
        panelCenterX,
        panelCursorY,
        panelTextWidth,
        48,
        1,
      );

      if (reading.subHeading) {
        ctx.fillStyle = 'rgba(181, 184, 197, 0.8)';
        ctx.font = '500 24px "Space Grotesk", sans-serif';
        panelCursorY = wrapText(
          ctx,
          reading.subHeading,
          panelCenterX,
          panelCursorY + 10,
          panelTextWidth,
          30,
          1,
        );
      }

      if (reading.archetype) {
        ctx.fillStyle = '#f7f4ee';
        ctx.font = 'italic 500 38px "Prata", serif';
        panelCursorY = wrapText(
          ctx,
          `“${reading.archetype}”`,
          panelCenterX,
          panelCursorY + 40,
          panelTextWidth,
          54,
          2,
        );
      }

      if (reading.keywords) {
        ctx.fillStyle = 'rgba(216, 219, 230, 0.9)';
        ctx.font = '400 26px "Space Grotesk", sans-serif';
        panelCursorY = wrapText(
          ctx,
          reading.keywords,
          panelCenterX,
          panelCursorY + 20,
          panelTextWidth,
          34,
          2,
        );
      }
    };

    const drawLuckyRow = () => {
      if (!hasLuckyRow) return;
      const minLuckyY = cardY + cardHeight + 80;
      const rowY = Math.max(layout.luckyRowY, minLuckyY);
      const dotSize = 32;
      const dotGap = 10;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#f7f4ee';
      ctx.font = '500 26px "Space Grotesk", sans-serif';
      const labelWidth = ctx.measureText(strings.luckyColors).width;
      const dotsWidth = luckyColors.length
        ? luckyColors.length * dotSize + (luckyColors.length - 1) * dotGap
        : 0;
      const groupWidth = labelWidth + 20 + dotsWidth;
      const startX = (width - groupWidth) / 2;
      let x = startX;
      ctx.fillText(strings.luckyColors, x, rowY);
      x += ctx.measureText(strings.luckyColors).width + 20;

      luckyColors.forEach((color) => {
        const hex = color?.hex || color || '#ffffff';
        ctx.save();
        ctx.fillStyle = hex;
        ctx.beginPath();
        ctx.arc(x + 16, rowY, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        x += 42;
      });
    };

    const drawFooter = () => {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#aab0c9';
      ctx.font = '500 28px "Space Grotesk", sans-serif';
      ctx.fillText('meowtarot.com', width / 2, footerY);
    };

    drawBrandMark();
    drawHeader();

    const cardTopY = layout.cardTop;
    const gapBeforePanel = 48;
    const maxCardWidth = Math.min(720, width - safeMargin * 2);
    const maxCardHeight = Math.min(layout.cardMaxHeight, Math.max(0, panelTop - gapBeforePanel - cardTopY));
    let cardImg = null;
    try {
      cardImg = await resolveCardImage();
    } catch (error) {
      console.warn('Poster image failed to load, continuing without card art.', error);
    }
    console.log('[Poster] Images resolved');
    const fallbackAspect = 2 / 3;
    const fallbackWidth = Math.min(
      maxCardWidth,
      maxCardHeight ? maxCardHeight * fallbackAspect : maxCardWidth,
    );
    const fallbackHeight = fallbackWidth / fallbackAspect;
    const imgWidth = cardImg?.naturalWidth || fallbackWidth || 560;
    const imgHeight = cardImg?.naturalHeight || fallbackHeight || Math.round(560 * 1.5);
    const heightScale = maxCardHeight ? maxCardHeight / imgHeight : 1;
    const scale = Math.min(maxCardWidth / imgWidth, heightScale);
    const cardWidth = Math.max(0, imgWidth * scale);
    const cardHeight = Math.max(0, imgHeight * scale);
    const cardX = (width - cardWidth) / 2;
    const cardY = cardTopY;

    if (cardWidth && cardHeight) {
      ctx.save();
      ctx.shadowColor = 'rgba(248, 215, 122, 0.4)';
      ctx.shadowBlur = 60;
      ctx.shadowOffsetY = 12;
      ctx.fillStyle = '#0f1429';
      ctx.fillRect(cardX, cardY, cardWidth, cardHeight);
      ctx.restore();
      if (cardImg) {
        ctx.drawImage(cardImg, cardX, cardY, cardWidth, cardHeight);
      }
    }
    drawReadingPanel();
    drawLuckyRow();
    drawFooter();
    console.log('[Poster] Canvas drawn');

    const blob = await canvasToBlob(canvas, 0.92);
    if (!blob) throw new Error('Failed to build poster blob');
    return { blob, width, height };
  }

  const title = payload?.title || 'MeowTarot Reading';
  const subtitle = payload?.subtitle || '';
  const keywords = Array.isArray(payload?.keywords) ? payload.keywords.filter(Boolean).slice(0, 3) : [];
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
      const cleanBase = getCleanAssetsBase();
      const primary = getCardImageUrl(
        { ...entry.card, id: orientedId, card_id: orientedId, image_id: orientedId },
        { orientation: entry.orientation, assetsBase: cleanBase },
      );
      const fallback = entry.orientation === 'reversed'
        ? getCardImageUrl(
          { ...entry.card, id: uprightId, card_id: uprightId, image_id: uprightId },
          { orientation: 'upright', assetsBase: cleanBase },
        )
        : null;
      const finalFallback = entry.orientation === 'reversed'
        ? getCardImageUrl({ ...entry.card, id: uprightId, card_id: uprightId, image_id: uprightId }, { orientation: 'upright' })
        : getCardImageUrl({ ...entry.card, id: orientedId, card_id: orientedId, image_id: orientedId }, { orientation: entry.orientation });
      const img = await imageManager.loadWithFallback(primary, [fallback, finalFallback].filter(Boolean));
      ctx.drawImage(img, x, y, cardWidth, cardHeight);
    }
  }
  console.log('[Poster] Images resolved');

  ctx.fillStyle = '#f7f4ee';
  ctx.font = '500 30px "Space Grotesk", sans-serif';
  drawTextBlock(ctx, payload?.headline || '', width / 2, height * 0.73, width * 0.78, 38);

  ctx.fillStyle = '#aab0c9';
  ctx.font = '500 28px "Space Grotesk", sans-serif';
  ctx.fillText('meowtarot.com', width / 2, height - 90);
  console.log('[Poster] Canvas drawn');

  const blob = await canvasToBlob(canvas, 0.92);
  if (!blob) throw new Error('Failed to build poster blob');
  return { blob, width, height };
}

export { PRESETS };
