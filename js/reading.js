import { initShell, localizePath, pathHasThaiPrefix, translations } from './common.js';
import {
  loadTarotData,
  meowTarotCards,
  normalizeId,
  getCardImageUrl,
  getCardBackUrl,
} from './data.js';
import { findCardById, getBaseCardId, toOrientation } from './reading-helpers.js';

const params = new URLSearchParams(window.location.search);
const storageSelection = JSON.parse(sessionStorage.getItem('meowtarot_selection') || 'null');
const isSelfTestMode = params.get('selftest') === '1';

function normalizeMode(raw = '') {
  const val = String(raw || '').toLowerCase().trim();
  if (['daily', 'day'].includes(val)) return 'daily';
  if (['full', 'overall', 'life'].includes(val)) return 'full';
  if (['question', 'ask'].includes(val)) return 'question';
  return 'daily';
}

function parseSelectedIds() {
  const single = params.get('card') || params.get('id');
  if (single) return [single.trim()].filter(Boolean);

  const paramCards = params.get('cards');
  const storedCards = storageSelection?.cards;

  const combined = paramCards || (Array.isArray(storedCards) ? storedCards.join(',') : storedCards);
  if (!combined) return [];

  return combined
    .toString()
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

const state = {
  currentLang: params.get('lang') || (pathHasThaiPrefix(window.location.pathname) ? 'th' : 'en'),
  mode: normalizeMode(params.get('mode') || storageSelection?.mode || 'daily'),
  topic: params.get('topic') || storageSelection?.topic || 'generic',
  selectedIds: parseSelectedIds(),
};

let dataLoaded = false;

const readingContent = document.getElementById('reading-content');
const contextCopy = document.getElementById('reading-context');
const readingTitle = document.getElementById('readingTitle');
const newReadingBtn = document.getElementById('newReadingBtn');
const shareBtn = document.getElementById('shareBtn');
const saveBtn = document.getElementById('saveBtn');

function pickShareCardElement(selector = '#share-card') {
  return (
    document.querySelector(selector)
    || document.getElementById('reading-content')
    || document.querySelector('.reading-content')
  );
}

async function exportDiagnostics(selectorOrEl) {
  const el = typeof selectorOrEl === 'string'
    ? document.querySelector(selectorOrEl)
    : selectorOrEl;

  const ua = navigator.userAgent;
  console.group('🧪 Export Diagnostics');
  console.log('UserAgent:', ua);
  console.log('URL:', location.href);
  console.log('DevicePixelRatio:', window.devicePixelRatio);

  if (!el) {
    console.error('❌ Target element not found:', selectorOrEl);
    console.groupEnd();
    return { ok: false, reason: 'element_not_found', ua };
  }

  const rect = el.getBoundingClientRect();
  const cs = window.getComputedStyle(el);

  console.log('Target:', el);
  console.log('Rect:', { w: rect.width, h: rect.height, top: rect.top, left: rect.left });
  console.log('Visibility:', {
    display: cs.display,
    visibility: cs.visibility,
    opacity: cs.opacity,
  });

  // Wait for fonts (important on iOS)
  if (document.fonts && document.fonts.ready) {
    console.log('Waiting for document.fonts.ready...');
    await document.fonts.ready;
    console.log('Fonts ready ✅');
  } else {
    console.log('document.fonts not supported');
  }

  // Wait for images inside the element
  const imgs = Array.from(el.querySelectorAll('img'));
  console.log('Images found:', imgs.length);

  const imgInfo = imgs.map((img) => {
    let url = img.currentSrc || img.src || '';
    let origin = '';
    try { origin = new URL(url, location.href).origin; } catch {}
    const sameOrigin = origin === location.origin || origin === '';
    return {
      url,
      origin,
      sameOrigin,
      crossOriginAttr: img.getAttribute('crossorigin'),
      complete: img.complete,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
    };
  });
  console.table(imgInfo);

  // Try decoding images (helps timing bugs)
  await Promise.all(imgs.map(async (img) => {
    try {
      if (img.decode) await img.decode();
      else if (!img.complete) await new Promise((res, rej) => {
        img.onload = res; img.onerror = rej;
      });
    } catch (e) {
      console.warn('⚠️ Image decode/load failed:', img.currentSrc || img.src, e);
    }
  }));

  // Next-frame settle (helps iOS rendering)
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  // CORS risk flag
  const corsRisk = imgInfo.some((i) => i.url && !i.sameOrigin);
  console.log('CORS risk (cross-origin images present):', corsRisk);

  console.groupEnd();
  return {
    ok: true,
    ua,
    rect: { w: rect.width, h: rect.height },
    visibility: { display: cs.display, visibility: cs.visibility, opacity: cs.opacity },
    images: imgInfo,
    corsRisk,
  };
}

async function runExportSelfTest(selector = '#share-card') {
  const target = pickShareCardElement(selector);
  const report = {
    ok: true,
    reason: null,
    selector,
    resolvedTarget: target ? (target.id || target.className || target.tagName?.toLowerCase()) : null,
    waits: { fonts: false, images: false, raf: false },
    target: null,
    images: [],
    cssRisks: [],
    sizeRisk: null,
    errors: [],
  };

  if (!target) {
    report.ok = false;
    report.reason = 'selector-not-found';
    console.log('SELFTEST_JSON:', JSON.stringify(report));
    return report;
  }

  try {
    const rect = target.getBoundingClientRect();
    const style = window.getComputedStyle(target);
    report.target = {
      width: rect.width,
      height: rect.height,
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
      hidden:
        rect.width === 0
        || rect.height === 0
        || style.display === 'none'
        || style.visibility === 'hidden'
        || parseFloat(style.opacity || '1') === 0,
    };

    if (document.fonts?.ready) {
      await document.fonts.ready;
      report.waits.fonts = true;
    }

    const imgs = Array.from(target.querySelectorAll('img'));
    report.images = imgs.map((img) => {
      const src = img.currentSrc || img.src || '';
      let origin = '';
      try { origin = new URL(src, window.location.href).origin; } catch (err) { report.errors.push(String(err)); }
      const sameOrigin = !origin || origin === window.location.origin;
      return {
        src,
        sameOrigin,
        crossOriginAttr: img.getAttribute('crossorigin'),
        complete: img.complete,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        corsRisk: !sameOrigin && !img.getAttribute('crossorigin'),
      };
    });

    await Promise.all(
      imgs.map(async (img) => {
        try {
          if (img.decode) {
            await img.decode();
          } else if (!img.complete) {
            await new Promise((resolve) => {
              img.addEventListener('load', resolve, { once: true });
              img.addEventListener('error', resolve, { once: true });
            });
          }
        } catch (err) {
          report.errors.push(`image-wait-error:${err?.message || err}`);
        }
      }),
    );
    report.waits.images = true;

    const nodes = [target, ...Array.from(target.querySelectorAll('*'))];
    report.cssRisks = nodes
      .map((node) => {
        const cs = window.getComputedStyle(node);
        return {
          node: node.tagName?.toLowerCase(),
          filter: cs.filter,
          backdropFilter: cs.backdropFilter,
          mixBlendMode: cs.mixBlendMode,
          mask: cs.mask,
          clipPath: cs.clipPath,
          position: cs.position,
          transform: cs.transform,
        };
      })
      .filter(
        (c) => (c.filter && c.filter !== 'none')
          || (c.backdropFilter && c.backdropFilter !== 'none')
          || (c.mixBlendMode && c.mixBlendMode !== 'normal')
          || (c.mask && c.mask !== 'none')
          || (c.clipPath && c.clipPath !== 'none')
          || c.position === 'fixed'
          || (c.transform && c.transform !== 'none'),
      );

    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    report.waits.raf = true;

    const dpr = window.devicePixelRatio || 1;
    const pixelEstimate = rect.width * rect.height * dpr * dpr;
    report.sizeRisk = { pixelEstimate, threshold: 20000000, atRisk: pixelEstimate > 20000000 };
  } catch (err) {
    report.ok = false;
    report.reason = err?.message || String(err);
    report.errors.push(report.reason);
  }

  console.log('SELFTEST_JSON:', JSON.stringify(report));
  return report;
}

function getText(card, keyBase, lang = state.currentLang) {
  if (!card) return '';
  const suffix = lang === 'en' ? '_en' : '_th';
  const orientation = toOrientation(card);
  const orientedKey = orientation === 'reversed' ? `${keyBase}_reversed${suffix}` : `${keyBase}_upright${suffix}`;
  const orientedBaseKey = orientation === 'reversed' ? `${keyBase}_reversed` : `${keyBase}_upright`;
  return (
    card[orientedKey]
    || card[orientedBaseKey]
    || card[`${keyBase}${suffix}`]
    || card[keyBase]
    || ''
  );
}

function getName(card, lang = state.currentLang) {
  if (!card) return '';

  const englishName = card.card_name_en || card.name_en || card.name || card.id;
  if (lang === 'en') return englishName;

  const thaiName = card.alias_th || card.name_th || card.name || '';
  if (thaiName && englishName) return `${thaiName} (${englishName})`;
  return thaiName || englishName || card.id;
}

function getOrientationEnglish(card) {
  return toOrientation(card) === 'reversed' ? 'Reversed' : 'Upright';
}

/* -------------------------------------------------------------------------- */
/* Color helpers: show swatch + show COLOR NAME (no hex text)                  */
/* -------------------------------------------------------------------------- */

function isHexColor(v = '') {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(String(v).trim());
}

function normalizeHex(hex) {
  let h = String(hex || '').trim().toUpperCase();
  if (!h.startsWith('#')) h = `#${h}`;
  if (/^#([0-9A-F]{3})$/.test(h)) {
    const s = h.slice(1);
    return `#${s[0]}${s[0]}${s[1]}${s[1]}${s[2]}${s[2]}`;
  }
  if (/^#([0-9A-F]{8})$/.test(h)) return `#${h.slice(1, 7)}`; // ignore alpha
  return h;
}

function hexToRgb(hex) {
  const h = normalizeHex(hex).slice(1);
  if (!/^[0-9A-F]{6}$/.test(h)) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return { r, g, b };
}

function rgbToHsl(r, g, b) {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;

  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const d = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case rr:
        h = ((gg - bb) / d) % 6;
        break;
      case gg:
        h = (bb - rr) / d + 2;
        break;
      default:
        h = (rr - gg) / d + 4;
        break;
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }

  return { h, s, l };
}

// overrides สำหรับสีที่เจอบ่อยในเด็ค (เติมเพิ่มได้เรื่อยๆ)
const HEX_NAME_OVERRIDES = {
  '#87CEEB': { en: 'Sky Blue', th: 'ฟ้าใส' },
  '#87CEFA': { en: 'Light Sky Blue', th: 'ฟ้าอ่อน' },
  '#E6E6FA': { en: 'Lavender', th: 'ลาเวนเดอร์' },
  '#708090': { en: 'Slate Gray', th: 'เทาสเลต' },
  '#FFD700': { en: 'Gold', th: 'ทอง' },
};

function basicColorNameFromHex(hex, lang = 'en') {
  const rgb = hexToRgb(hex);
  if (!rgb) return lang === 'th' ? 'สี' : 'Color';

  const { r, g, b } = rgb;
  const { h, s, l } = rgbToHsl(r, g, b);

  // black/white/gray first
  if (l >= 0.93) return lang === 'th' ? 'ขาว' : 'White';
  if (l <= 0.08) return lang === 'th' ? 'ดำ' : 'Black';
  if (s <= 0.12) return lang === 'th' ? 'เทา' : 'Gray';

  // brown heuristic
  if (h >= 15 && h <= 45 && l <= 0.45) return lang === 'th' ? 'น้ำตาล' : 'Brown';

  // hue buckets
  if (h >= 345 || h < 15) return lang === 'th' ? 'แดง' : 'Red';
  if (h >= 15 && h < 45) return lang === 'th' ? 'ส้ม' : 'Orange';
  if (h >= 45 && h < 70) return lang === 'th' ? 'เหลือง' : 'Yellow';
  if (h >= 70 && h < 160) return lang === 'th' ? 'เขียว' : 'Green';
  if (h >= 160 && h < 200) return lang === 'th' ? 'เขียวอมฟ้า' : 'Teal';
  if (h >= 200 && h < 250) return lang === 'th' ? 'ฟ้า' : 'Blue';
  if (h >= 250 && h < 290) return lang === 'th' ? 'น้ำเงิน' : 'Indigo';
  if (h >= 290 && h < 330) return lang === 'th' ? 'ม่วง' : 'Purple';
  if (h >= 330 && h < 345) return lang === 'th' ? 'ชมพู' : 'Pink';

  return lang === 'th' ? 'สี' : 'Color';
}

function hexToName(hex, lang = 'en') {
  const key = normalizeHex(hex);
  const hit = HEX_NAME_OVERRIDES[key];
  if (hit) return hit[lang] || hit.en;
  return basicColorNameFromHex(key, lang);
}

function normalizeColorArray(palette) {
  if (!palette) return [];
  if (typeof palette === 'string') {
    const hexes = palette.match(/#[0-9a-fA-F]{3,8}/g);
    return (hexes && hexes.length ? hexes : palette.split(',')).map((s) => s.trim()).filter(Boolean);
  }
  if (Array.isArray(palette)) return palette.map((s) => String(s).trim()).filter(Boolean);
  return [];
}

const TH_COLOR_TO_CSS = {
  'แดง': 'red',
  'ส้ม': 'orange',
  'เหลือง': 'yellow',
  'เขียว': 'green',
  'ฟ้า': 'deepskyblue',
  'น้ำเงิน': 'royalblue',
  'ม่วง': 'purple',
  'ชมพู': 'hotpink',
  'น้ำตาล': 'saddlebrown',
  'เทา': 'gray',
  'ดำ': 'black',
  'ขาว': 'white',
  'ทอง': 'gold',
  'ลาเวนเดอร์': 'lavender',
};

function resolveCssColor(value) {
  const v = String(value || '').trim();
  if (!v) return null;

  if (isHexColor(v)) return normalizeHex(v);

  // Thai name => map to CSS
  if (TH_COLOR_TO_CSS[v]) return TH_COLOR_TO_CSS[v];

  // English / CSS color names
  const collapsed = v.toLowerCase().replace(/\s+/g, '');
  if (typeof CSS !== 'undefined' && CSS.supports) {
    if (CSS.supports('color', collapsed)) return collapsed;
    if (CSS.supports('color', v.toLowerCase())) return v.toLowerCase();
  }

  // Fallback: try it anyway (harmless if invalid)
  return v.toLowerCase();
}

/* -------------------------------------------------------------------------- */
// Handles legacy ids like maj-08 by mapping majors to your new "01-..-upright" format.
/* -------------------------------------------------------------------------- */

function resolveLegacyMajorId(candidateId) {
  const id = String(candidateId || '').toLowerCase().trim();
  const match = id.match(/^maj[-_]?(\d{1,2})$/);
  if (!match) return null;

  const majNum = Number(match[1]);
  if (!Number.isFinite(majNum)) return null;

  const newNum = String(majNum + 1).padStart(2, '0');
  const orient = toOrientation(id);

  const hit =
    (meowTarotCards || []).find((c) => String(c.id || '').startsWith(`${newNum}-`) && String(c.id || '').endsWith(`-${orient}`))
    || (meowTarotCards || []).find((c) => String(c.id || '').startsWith(`${newNum}-`));

  return hit ? hit.id : null;
}

function ensureOrientation(card, targetOrientation = toOrientation(card)) {
  if (!card) return null;
  const sourceId = String(card?.image_id || card?.card_id || card?.id || '');
  const base = getBaseCardId(sourceId, normalizeId);
  const orientedId = base ? `${base}-${targetOrientation}` : normalizeId(sourceId || `card-${Date.now()}`);
  return {
    ...card,
    id: orientedId,
    card_id: orientedId,
    image_id: orientedId,
    orientation: targetOrientation,
    orientation_label_th: card.orientation_label_th
      || (targetOrientation === 'reversed' ? 'ไพ่กลับหัว' : 'ไพ่ปกติ'),
  };
}

function findCard(id) {
  if (!id) return null;

  const targetOrientation = toOrientation(id);
  const direct = findCardById(meowTarotCards, id, normalizeId);
  if (direct) return toOrientation(direct) === targetOrientation ? direct : ensureOrientation(direct, targetOrientation);

  const mapped = resolveLegacyMajorId(id);
  if (mapped) {
    const mappedCard = findCardById(meowTarotCards, mapped, normalizeId);
    if (mappedCard) {
      return toOrientation(mappedCard) === targetOrientation
        ? mappedCard
        : ensureOrientation(mappedCard, targetOrientation);
    }
  }

  return null;
}

function resolveImageIds(card, targetOrientation = toOrientation(card)) {
  const idLower = String(card?.id || '').toLowerCase();
  const majMatch = idLower.match(/^maj-(\d{1,2})$/);

  if (majMatch) {
    const majNum = Number(majMatch[1]);
    const num = String(majNum + 1).padStart(2, '0');
    const slug = normalizeId(card?.card_name_en || card?.name_en || card?.name || 'card');
    const baseId = `${num}-${slug}`;
    return {
      baseId,
      orientedId: `${baseId}-${targetOrientation}`,
      uprightId: `${baseId}-upright`,
      orientation: targetOrientation,
    };
  }

  const sourceId = String(card?.image_id || card?.card_id || card?.id || '');
  const baseId = getBaseCardId(sourceId, normalizeId) || normalizeId(sourceId);
  return {
    baseId,
    orientedId: baseId ? `${baseId}-${targetOrientation}` : '',
    uprightId: baseId ? `${baseId}-upright` : '',
    orientation: targetOrientation,
  };
}

function getCardImageUrlWithFallback(card) {
  if (!card) return { src: getCardBackUrl(), fallback: null };

  const { orientedId, uprightId, orientation } = resolveImageIds(card, toOrientation(card));
  if (!orientedId) return { src: getCardBackUrl(), fallback: null };

  const orientedCard = { ...card, id: orientedId, card_id: orientedId, image_id: orientedId, orientation };
  const uprightCard = { ...card, id: uprightId, card_id: uprightId, image_id: uprightId, orientation: 'upright' };

  const src = getCardImageUrl(orientedCard, { orientation });
  const fallback = orientation === 'reversed'
    ? getCardImageUrl(uprightCard, { orientation: 'upright' })
    : null;

  return { src, fallback };
}

function buildCardArt(card, variant = 'hero') {
  const wrap = document.createElement('div');
  wrap.className = variant === 'thumb' ? 'card-art is-thumb' : 'card-art';

  const img = document.createElement('img');
  img.className = 'card-art-img';
  img.alt = `${getName(card)} — ${getOrientationEnglish(card)}`;
  img.loading = 'lazy';

  const { src, fallback } = getCardImageUrlWithFallback(card);
  img.src = src;
  img.addEventListener('error', () => {
    if (fallback && img.dataset.fallback !== 'upright') {
      img.dataset.fallback = 'upright';
      img.src = fallback;
      return;
    }
    if (img.dataset.fallback === 'back') return;
    img.dataset.fallback = 'back';
    img.src = getCardBackUrl();
  });

  wrap.appendChild(img);
  return wrap;
}

function buildSuggestionPanel(card, dict, headingText) {
  if (!card) return null;

  const action = getText(card, 'action_prompt');
  const reflection = getText(card, 'reflection_question');
  const affirmation = getText(card, 'affirmation');

  const merged = [action, reflection].filter(Boolean).map((t) => t.trim()).join(' ').trim();
  if (!merged && !affirmation) return null;

  const panel = document.createElement('div');
  panel.className = 'panel';

  if (headingText) {
    const h = document.createElement('h3');
    h.textContent = headingText;
    panel.appendChild(h);
  }

  if (merged) {
    const p = document.createElement('p');
    p.textContent = merged.allowText ?? merged;
    panel.appendChild(p);
  }

  if (affirmation) {
    const p = document.createElement('p');
    p.innerHTML = `<em>"${affirmation.trim()}"</em>`;
    panel.appendChild(p);
  }

  return panel;
}

function buildMetaPanel(card) {
  if (!card) return null;

  const meta = [];

  const element = getText(card, 'element') || card.element;
  const planet = getText(card, 'planet') || card.planet;

  // ✅ FIX: support numerology_value (your JSON uses numerology_value)
  const numerology =
    getText(card, 'numerology')
    || card.numerology
    || card.numerology_value;

  if (element) meta.push({ label: state.currentLang === 'th' ? 'ธาตุ' : 'Element', value: element });
  if (planet) meta.push({ label: state.currentLang === 'th' ? 'ดาว' : 'Planet', value: planet });
  if (numerology !== undefined && numerology !== null && numerology !== '') {
    meta.push({ label: state.currentLang === 'th' ? 'เลข' : 'Numerology', value: numerology });
  }

  // ✅ Lucky colors: use color_palette (existing) but show NAME not hex
  const luckyPalette = normalizeColorArray(
    card.lucky_color_palette || card.lucky_colors || card.color_palette || card.colors
  ).filter(Boolean).slice(0, 6);

  // ✅ Avoid colors: optional (if you add it later)
  const avoidPalette = normalizeColorArray(
    card.avoid_color_palette || card.avoid_colors || card.colors_to_avoid || card.unlucky_colors
  ).filter(Boolean).slice(0, 6);

  if (!meta.length && !luckyPalette.length && !avoidPalette.length) return null;

  const panel = document.createElement('div');
  panel.className = 'panel';

  const row = document.createElement('div');
  row.className = 'meta-row';

  meta.forEach((item) => {
    const chip = document.createElement('span');
    chip.className = 'meta-badge';
    chip.textContent = `${item.label}: ${item.value}`;
    row.appendChild(chip);
  });

  function appendColorGroup(label, colors) {
    if (!colors.length) return;

    const labelChip = document.createElement('span');
    labelChip.className = 'meta-badge';
    labelChip.textContent = label;
    row.appendChild(labelChip);

    colors.forEach((c) => {
      const chip = document.createElement('span');
      chip.className = 'meta-badge';

      const swatch = document.createElement('span');
      swatch.className = 'swatch';

      const cssColor = resolveCssColor(c);
      if (cssColor) swatch.style.background = cssColor;

      const txt = document.createElement('span');

      // ✅ IMPORTANT: never show hex text
      if (isHexColor(c)) {
        txt.textContent = hexToName(c, state.currentLang === 'th' ? 'th' : 'en');
      } else {
        txt.textContent = String(c);
      }

      chip.append(swatch, txt);
      row.appendChild(chip);
    });
  }

  appendColorGroup(
    state.currentLang === 'th' ? 'สีมงคลประจำวัน' : "Today's lucky colors",
    luckyPalette
  );

  appendColorGroup(
    state.currentLang === 'th' ? 'สีที่ควรเลี่ยง' : 'Colors to avoid',
    avoidPalette
  );

  panel.appendChild(row);
  return panel;
}

function renderDaily(card, dict) {
  if (!readingContent || !card) return;

  readingContent.innerHTML = '';

  const panel = document.createElement('div');
  panel.className = 'panel';

  panel.appendChild(buildCardArt(card, 'hero'));

  const h2 = document.createElement('h2');
  h2.textContent = `${getName(card)} — ${getOrientationEnglish(card)}`;
  panel.appendChild(h2);

  const imply = getText(card, 'tarot_imply');
  if (imply) {
    const p = document.createElement('p');
    p.className = 'keywords';
    p.textContent = imply;
    panel.appendChild(p);
  }

  const main = getText(card, 'standalone_present') || getText(card, 'tarot_imply_present');
  if (main) {
    const p = document.createElement('p');
    p.className = 'lede';
    p.textContent = main;
    panel.appendChild(p);
  }

  readingContent.appendChild(panel);

  const suggestionHeading = state.currentLang === 'th' ? 'คำแนะนำวันนี้' : (dict.suggestionTitle || 'Suggestion');
  const suggestion = buildSuggestionPanel(card, dict, suggestionHeading);
  if (suggestion) readingContent.appendChild(suggestion);

  const meta = buildMetaPanel(card);
  if (meta) readingContent.appendChild(meta);
}

function renderFull(cards, dict) {
  if (!readingContent || !cards?.length) return;
  readingContent.innerHTML = '';

  const positions = ['past', 'present', 'future'];

  cards.slice(0, 3).forEach((card, idx) => {
    const pos = positions[idx];

    const panel = document.createElement('div');
    panel.className = 'panel';

    // optional thumbnail
    panel.appendChild(buildCardArt(card, 'thumb'));

    const h3 = document.createElement('h3');
    h3.textContent = `${dict[pos]} • ${getName(card)} — ${getOrientationEnglish(card)}`;
    panel.appendChild(h3);

    const text = getText(card, `standalone_${pos}`);
    if (text) {
      const p = document.createElement('p');
      p.textContent = text;
      panel.appendChild(p);
    }

    readingContent.appendChild(panel);
  });

  // Your Fortune (summary)
  const summaries = cards
    .slice(0, 3)
    .map((card, idx) => getText(card, `reading_summary_${positions[idx]}`))
    .filter(Boolean);

  if (summaries.length) {
    const panel = document.createElement('div');
    panel.className = 'panel';

    const h3 = document.createElement('h3');
    h3.textContent = state.currentLang === 'th' ? 'ดวงของคุณ' : 'Your Fortune';
    panel.appendChild(h3);

    const p = document.createElement('p');
    p.textContent = summaries.join(' ').replace(/\s+/g, ' ').trim();
    panel.appendChild(p);

    readingContent.appendChild(panel);
  }

  // Suggestion (anchor on Present card)
  const present = cards[1] || cards[0];
  if (present) {
    const heading = state.currentLang === 'th' ? 'คำแนะนำ' : (dict.suggestionTitle || 'Suggestion');
    const suggestion = buildSuggestionPanel(present, dict, heading);
    if (suggestion) readingContent.appendChild(suggestion);

    const meta = buildMetaPanel(present);
    if (meta) readingContent.appendChild(meta);
  }
}

function renderQuestion(cards, dict) {
  if (!readingContent || !cards?.length) return;
  readingContent.innerHTML = '';

  const positions = ['past', 'present', 'future'];
  const topic = String(state.topic || 'generic').toLowerCase();

  cards.slice(0, 3).forEach((card, idx) => {
    const pos = positions[idx];

    const panel = document.createElement('div');
    panel.className = 'panel';

    panel.appendChild(buildCardArt(card, 'thumb'));

    const h3 = document.createElement('h3');
    h3.textContent = `${dict[pos]} • ${getName(card)} — ${getOrientationEnglish(card)}`;
    panel.appendChild(h3);

    let key = `standalone_${pos}`;
    if (topic === 'love') key = `love_${pos}`;
    if (topic === 'career') key = `career_${pos}`;
    if (topic === 'finance') key = `finance_${pos}`;

    const text = getText(card, key) || getText(card, `standalone_${pos}`);
    if (text) {
      const p = document.createElement('p');
      p.textContent = text;
      panel.appendChild(p);
    }

    readingContent.appendChild(panel);
  });

  const present = cards[1] || cards[0];
  if (present) {
    const heading = state.currentLang === 'th' ? 'คำแนะนำ' : (dict.guidanceHeading || dict.suggestionTitle || 'Guidance');
    const suggestion = buildSuggestionPanel(present, dict, heading);
    if (suggestion) readingContent.appendChild(suggestion);

    const meta = buildMetaPanel(present);
    if (meta) readingContent.appendChild(meta);
  }
}

function renderReading(dict) {
  if (!readingContent) return;

  const cards = state.selectedIds.map((id) => findCard(id)).filter(Boolean);

  if (!cards.length) {
    const message = dict?.missingSelection || 'No cards found. Please draw cards first.';
    readingContent.innerHTML = `<div class="panel"><p class="lede">${message}</p></div>`;
    return;
  }

  if (state.mode === 'daily') {
    renderDaily(cards[0], dict);
    return;
  }

  if (state.mode === 'question') {
    renderQuestion(cards, dict);
    return;
  }

  // full
  renderFull(cards, dict);
}

function handleShare() {
  const url = window.location.href;
  if (navigator.share) {
    navigator.share({ title: 'MeowTarot', text: translations[state.currentLang].yourReading, url }).catch(() => copyLink(url));
  } else {
    copyLink(url);
  }
}

function copyLink(url) {
  navigator.clipboard.writeText(url).then(() => alert(translations[state.currentLang].shareFallback));
}

function downscaleCanvas(canvas, maxWidth = 1080) {
  if (canvas.width <= maxWidth) return canvas;
  const ratio = maxWidth / canvas.width;
  const c = document.createElement('canvas');
  c.width = maxWidth;
  c.height = Math.round(canvas.height * ratio);
  c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height);
  return c;
}

async function saveImage() {
  const target = pickShareCardElement();
  if (!target) return;
  try {
    const diag = await exportDiagnostics(target);
    console.log('DIAG_JSON:', JSON.stringify(diag, null, 2));

    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const dpr = Math.min(window.devicePixelRatio || 2, 2);
    const canvas = await html2canvas(target, {
      backgroundColor: '#0b1020',
      scale: isIOS ? 1 : dpr,
    });
    const downscaled = downscaleCanvas(canvas);
    const link = document.createElement('a');
    link.download = `meowtarot-reading-${Date.now()}.png`;
    link.href = downscaled.toDataURL('image/png');
    link.click();
  } catch (e) {
    console.error('❌ Export failed:', e);
  }
}

function findExportButton() {
  return (
    document.getElementById('btn-save-image')
    || document.getElementById('saveBtn')
    || document.querySelector('button[id*="save" i]')
    || Array.from(document.querySelectorAll('button')).find((btn) => /save/i.test(btn.textContent || ''))
  );
}

function setupSelfTestHooks() {
  if (!isSelfTestMode) return;

  window.runExportSelfTest = runExportSelfTest;
  window.__RUN_EXPORT_SELFTEST__ = async () => runExportSelfTest('#share-card');
  window.__CLICK_EXPORT__ = async () => {
    const btn = findExportButton();
    if (!btn) throw new Error('export_button_not_found');
    btn.click();
    return true;
  };

  console.log('Self-test hooks ready');
}

function updateContextCopy(dict = translations[state.currentLang]) {
  if (!contextCopy) return;

  if (state.mode === 'question') {
    contextCopy.textContent = dict.contextQuestion;
  } else {
    contextCopy.textContent = dict.contextDaily;
  }
}

function handleTranslations(dict) {
  updateContextCopy(dict);

  if (readingTitle) {
    if (state.mode === 'question') readingTitle.textContent = dict.questionTitle;
    else if (state.mode === 'full') readingTitle.textContent = dict.overallTitle;
    else readingTitle.textContent = dict.dailyTitle;
  }

  if (dataLoaded) renderReading(dict);
}

function init() {
  initShell(state, handleTranslations, 'reading');

  setupSelfTestHooks();

  newReadingBtn?.addEventListener('click', () => {
    const target =
      state.mode === 'question'
        ? '/question.html'
        : state.mode === 'full'
          ? '/overall.html'
          : '/daily.html';

    window.location.href = localizePath(target, state.currentLang);
  });

  shareBtn?.addEventListener('click', handleShare);
  saveBtn?.addEventListener('click', saveImage);

  loadTarotData()
    .then(() => {
      dataLoaded = true;
      renderReading(translations[state.currentLang] || translations.en);
    })
    .catch(() => {
      dataLoaded = true;
      renderReading(translations[state.currentLang] || translations.en);
    });
}

document.addEventListener('DOMContentLoaded', init);
