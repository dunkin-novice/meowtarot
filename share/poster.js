import { getActiveDeck, getCardImageUrl, loadTarotData, meowTarotCards, normalizeId } from '../js/data.js';
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

function getCleanAssetsBase() {
  const deck = getActiveDeck();
  return `${deck.assetsBase}-clean`;
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

async function waitForImageLoad(img) {
  if (img.complete && img.naturalWidth) return;
  await new Promise((resolve, reject) => {
    const handleLoad = () => resolve();
    const handleError = (err) => reject(err);
    img.onload = handleLoad;
    img.onerror = handleError;
  });
}

async function loadImage(src) {
  const img = new Image();
  img.decoding = 'async';
  img.crossOrigin = 'anonymous';
  img.src = src;
  if (img.decode) {
    try {
      await img.decode();
      return img;
    } catch (err) {
      await waitForImageLoad(img);
      return img;
    }
  }
  await waitForImageLoad(img);
  return img;
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
      title: 'คำทำนายรายวัน',
      subtitle: 'คำตอบด่วน (1 ใบ)',
      suggestionLabel: 'คำแนะนำ',
      questionLabel: 'คำถาม',
      affirmationLabel: 'คำยืนยัน',
      luckyColors: 'สีนำโชค',
    };
  }
  return {
    title: 'Daily Reading',
    subtitle: 'Quick Answer (1 card)',
    suggestionLabel: 'Suggestion',
    questionLabel: 'Question',
    affirmationLabel: 'Affirmation',
    luckyColors: 'Lucky colors',
  };
}

function isDailySingle(payload) {
  const spread = String(payload?.spread || '').toLowerCase();
  return payload?.mode === 'daily' && (spread === 'quick' || spread === 'single' || spread === 'one');
}

function getOrientationLabel(lang, orientation) {
  if (lang === 'th') {
    return orientation === 'reversed' ? 'ไพ่กลับหัว' : 'ไพ่ปกติ';
  }
  return orientation === 'reversed' ? 'Reversed' : 'Upright';
}

function getCardName(card, lang) {
  if (!card) return '';
  if (lang === 'th') {
    return card.card_name_th || card.alias_th || card.name_th || card.name || '';
  }
  return card.card_name_en || card.name_en || card.name || '';
}

function getCardField(card, keyBase, lang) {
  if (!card) return '';
  return card[`${keyBase}_${lang}`] || card[`${keyBase}_en`] || '';
}

function buildDailyReadingFromCard(card, orientation, lang) {
  if (!card) return null;
  const heading = `${getCardName(card, lang)} — ${getOrientationLabel(lang, orientation)}`.trim();
  return {
    heading,
    keywords: getCardField(card, 'tarot_imply', lang),
    main: getCardField(card, 'standalone_present', lang),
    suggestion: getCardField(card, 'action_prompt', lang),
    question: getCardField(card, 'reflection_question', lang),
    affirmation: getCardField(card, 'affirmation', lang),
  };
}

function resolveDailyReading(payload, cardEntry, lang) {
  const payloadReading = payload?.reading || {};
  const cardReading = buildDailyReadingFromCard(cardEntry?.card, cardEntry?.orientation, lang) || {};
  const advice = Array.isArray(payloadReading.advice) ? payloadReading.advice.filter(Boolean) : [];
  return {
    heading: payloadReading.heading || cardReading.heading || '',
    keywords: payloadReading.keywords || cardReading.keywords || '',
    main: payloadReading.main || payloadReading.summary || cardReading.main || '',
    suggestion: payloadReading.suggestion || advice[0] || cardReading.suggestion || '',
    question: payloadReading.question || cardReading.question || '',
    affirmation: payloadReading.affirmation || cardReading.affirmation || '',
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
    const lang = payload?.lang || 'en';
    const strings = getDailyStrings(lang);
    const cardEntries = buildCardEntries(payload).slice(0, 1);
    const cardEntry = cardEntries[0];
    const reading = resolveDailyReading(payload, cardEntry, lang);
    const lucky = resolveLuckyInfo(payload, cardEntry);
    const luckyColors = lucky.colors || [];
    const hasLuckyRow = luckyColors.length || lucky.number !== undefined || lucky.element || lucky.planet;
    const hasReadingPanel = Boolean(
      reading.heading || reading.keywords || reading.main || reading.suggestion || reading.question || reading.affirmation
    );
    const layout = {
      headerTop: 140,
      panelTop: 1120,
      panelHeight: 520,
      panelPadding: 36,
      luckyRowY: 1705,
      footerY: 1850,
    };

    const footerY = layout.footerY;
    const panelX = safeMargin;
    const panelWidth = width - safeMargin * 2;
    const panelTop = layout.panelTop;
    const panelHeight = layout.panelHeight;

    const drawHeader = (headerScale = 1, shouldDraw = true) => {
      const maxWidth = width - safeMargin * 2;
      const titleSize = Math.round(68 * headerScale);
      const subtitleSize = Math.round(38 * headerScale);
      const cardNameSize = Math.round(30 * headerScale);
      const titleLineHeight = Math.round(titleSize * 1.1);
      const subtitleLineHeight = Math.round(subtitleSize * 1.2);
      const cardLineHeight = Math.round(cardNameSize * 1.25);
      const gapAfterTitle = Math.round(14 * headerScale);
      const gapAfterSubtitle = Math.round(10 * headerScale);
      let cursorY = layout.headerTop;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.font = `600 ${titleSize}px "Poppins", "Space Grotesk", sans-serif`;
      const titleLines = wrapTextLines(ctx, strings.title, maxWidth, 1);
      if (shouldDraw) {
        ctx.fillStyle = '#f8d77a';
        titleLines.forEach((line) => ctx.fillText(line, width / 2, cursorY));
      }
      cursorY += titleLineHeight + gapAfterTitle;

      ctx.font = `500 ${subtitleSize}px "Space Grotesk", sans-serif`;
      const subtitleLines = wrapTextLines(ctx, strings.subtitle, maxWidth, 1);
      if (shouldDraw) {
        ctx.fillStyle = '#d8dbe6';
        subtitleLines.forEach((line) => ctx.fillText(line, width / 2, cursorY));
      }
      cursorY += subtitleLineHeight + gapAfterSubtitle;

      ctx.font = `500 ${cardNameSize}px "Space Grotesk", sans-serif`;
      const cardName = getCardName(cardEntry?.card, lang) || cardEntry?.name || '';
      const cardNameLines = wrapTextLines(ctx, cardName, maxWidth, 2);
      if (shouldDraw) {
        ctx.fillStyle = '#f7f4ee';
        cardNameLines.forEach((line, index) => {
          ctx.fillText(line, width / 2, cursorY + index * cardLineHeight);
        });
      }
      cursorY += cardNameLines.length * cardLineHeight;
      return cursorY;
    };

    const resolveCardImage = async () => {
      if (!cardEntry?.card) return null;
      const baseId = baseCardId(cardEntry.card.id || cardEntry.card.card_id || cardEntry.card.image_id);
      const orientedId = `${baseId}-${cardEntry.orientation}`;
      const uprightId = `${baseId}-upright`;
      const cleanBase = getCleanAssetsBase();
      const primary = getCardImageUrl(
        { ...cardEntry.card, id: orientedId, card_id: orientedId, image_id: orientedId },
        { orientation: cardEntry.orientation, assetsBase: cleanBase },
      );
      const fallback = cardEntry.orientation === 'reversed'
        ? getCardImageUrl(
          { ...cardEntry.card, id: uprightId, card_id: uprightId, image_id: uprightId },
          { orientation: 'upright', assetsBase: cleanBase },
        )
        : null;
      const finalFallback = cardEntry.orientation === 'reversed'
        ? getCardImageUrl(
          { ...cardEntry.card, id: uprightId, card_id: uprightId, image_id: uprightId },
          { orientation: 'upright' },
        )
        : getCardImageUrl(
          { ...cardEntry.card, id: orientedId, card_id: orientedId, image_id: orientedId },
          { orientation: cardEntry.orientation },
        );
      return loadImageWithFallback(primary, fallback || finalFallback);
    };

    const drawReadingPanel = () => {
      if (!hasReadingPanel) return;
      ctx.save();
      ctx.fillStyle = 'rgba(15, 20, 41, 0.68)';
      drawRoundedRect(ctx, panelX, panelTop, panelWidth, panelHeight, 28);
      ctx.fill();
      ctx.restore();

      let panelCursorY = panelTop + layout.panelPadding;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#f8d77a';
      ctx.font = '600 34px "Poppins", "Space Grotesk", sans-serif';
      panelCursorY = wrapText(
        ctx,
        reading.heading,
        panelX + layout.panelPadding,
        panelCursorY + 34,
        panelWidth - layout.panelPadding * 2,
        40,
        1,
      );

      ctx.fillStyle = '#d8dbe6';
      ctx.font = '500 26px "Space Grotesk", sans-serif';
      panelCursorY = wrapText(
        ctx,
        reading.keywords,
        panelX + layout.panelPadding,
        panelCursorY + 6,
        panelWidth - layout.panelPadding * 2,
        30,
        1,
      );

      ctx.fillStyle = '#f7f4ee';
      ctx.font = '400 28px "Space Grotesk", sans-serif';
      panelCursorY = wrapText(
        ctx,
        reading.main,
        panelX + layout.panelPadding,
        panelCursorY + 10,
        panelWidth - layout.panelPadding * 2,
        34,
        4,
      );

      if (reading.suggestion) {
        ctx.fillStyle = '#f8d77a';
        ctx.font = '600 24px "Space Grotesk", sans-serif';
        panelCursorY = wrapText(
          ctx,
          `${strings.suggestionLabel}: ${reading.suggestion}`,
          panelX + layout.panelPadding,
          panelCursorY + 10,
          panelWidth - layout.panelPadding * 2,
          30,
          2,
        );
      }

      if (reading.question) {
        ctx.fillStyle = '#c9a8ff';
        ctx.font = '500 24px "Space Grotesk", sans-serif';
        panelCursorY = wrapText(
          ctx,
          `${strings.questionLabel}: ${reading.question}`,
          panelX + layout.panelPadding,
          panelCursorY + 8,
          panelWidth - layout.panelPadding * 2,
          30,
          2,
        );
      }

      if (reading.affirmation) {
        ctx.fillStyle = '#f7f4ee';
        ctx.font = '400 24px "Space Grotesk", sans-serif';
        panelCursorY = wrapText(
          ctx,
          `“${reading.affirmation}”`,
          panelX + layout.panelPadding,
          panelCursorY + 8,
          panelWidth - layout.panelPadding * 2,
          30,
          2,
        );
      }
    };

    const drawLuckyRow = () => {
      if (!hasLuckyRow) return;
      const minLuckyY = cardY + cardHeight + 80;
      const rowY = Math.max(layout.luckyRowY, minLuckyY);
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#f7f4ee';
      ctx.font = '500 26px "Space Grotesk", sans-serif';
      let x = safeMargin;
      ctx.fillText(strings.luckyColors, x, rowY);
      x += ctx.measureText(strings.luckyColors).width + 16;

      luckyColors.forEach((color) => {
        const hex = color?.hex || color || '#ffffff';
        ctx.save();
        ctx.fillStyle = hex;
        ctx.beginPath();
        ctx.arc(x + 12, rowY, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        x += 32;
      });

      const chips = [];
      if (lucky.number !== undefined && lucky.number !== null && lucky.number !== '') chips.push(`#${lucky.number}`);
      if (lucky.element) chips.push(lucky.element);
      if (lucky.planet) chips.push(lucky.planet);

      let chipX = width - safeMargin;
      chips.forEach((chip) => {
        ctx.font = '500 24px "Space Grotesk", sans-serif';
        const textWidth = ctx.measureText(chip).width;
        const paddingX = 16;
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
    };

    const drawFooter = () => {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#aab0c9';
      ctx.font = '500 28px "Space Grotesk", sans-serif';
      ctx.fillText('meowtarot.com', width / 2, footerY);
    };

    const maxHeaderBottom = 360;
    let headerScale = 1;
    let headerBottomY = drawHeader(headerScale, false);
    while (headerBottomY > maxHeaderBottom && headerScale > 0.82) {
      headerScale -= 0.06;
      headerBottomY = drawHeader(headerScale, false);
    }
    drawHeader(headerScale, true);

    const gapAfterHeader = Math.max(48 * headerScale, 40);
    const cardTopY = headerBottomY + gapAfterHeader;
    const gapBeforePanel = 48;
    const maxCardWidth = Math.min(680, width - safeMargin * 2);
    const maxCardHeight = Math.max(0, panelTop - gapBeforePanel - cardTopY);
    const cardImg = await resolveCardImage();
    const imgWidth = cardImg?.naturalWidth || 560;
    const imgHeight = cardImg?.naturalHeight || Math.round(560 * 1.5);
    const scale = Math.min(maxCardWidth / imgWidth, maxCardHeight / imgHeight);
    const cardWidth = Math.max(0, imgWidth * scale);
    const cardHeight = Math.max(0, imgHeight * scale);
    const cardX = (width - cardWidth) / 2;
    const cardY = cardTopY;

    if (cardWidth && cardHeight) {
      ctx.save();
      ctx.shadowColor = 'rgba(248, 215, 122, 0.35)';
      ctx.shadowBlur = 40;
      ctx.shadowOffsetY = 16;
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

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 0.92));
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
      const img = await loadImageWithFallback(primary, fallback || finalFallback);
      ctx.drawImage(img, x, y, cardWidth, cardHeight);
    }
  }

  ctx.fillStyle = '#f7f4ee';
  ctx.font = '500 30px "Space Grotesk", sans-serif';
  drawTextBlock(ctx, payload?.headline || '', width / 2, height * 0.73, width * 0.78, 38);

  ctx.fillStyle = '#aab0c9';
  ctx.font = '500 28px "Space Grotesk", sans-serif';
  ctx.fillText('meowtarot.com', width / 2, height - 90);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 0.92));
  if (!blob) throw new Error('Failed to build poster blob');
  return { blob, width, height };
}

export { PRESETS };
