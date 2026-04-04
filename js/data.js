import { buildAssetUrl, resolveDeckAssetBase } from './asset-config.js';
import {
  resolveCardBackFallbackPath,
  resolveCardBackPath,
  buildCardImageUrls,
} from './asset-resolver.js';

// Deck configuration (for future multi-deck support)
export const DECKS = {
  'meow-v2': {
    id: 'meow-v2',
    name: 'MeowTarot v2',
    assetsBase: resolveDeckAssetBase('assets/meow-v2'),
    backImage: buildAssetUrl('assets/meow-v2/00-back.webp'),
  },
};

export const DEFAULT_DECK_ID = 'meow-v2';
export const FALLBACK_DECK_ID = 'meow-v2';

export let activeDeckId = DEFAULT_DECK_ID;

export function getActiveDeck() {
  return DECKS[activeDeckId];
}

export function getCardBackUrl(options = {}) {
  const preferredPack = options.preferredPack || 'meow-v2';
  return buildAssetUrl(resolveCardBackPath({ preferredPack }), { versioned: true });
}

export function getFallbackDeck(id = activeDeckId) {
  if (id === FALLBACK_DECK_ID) return null;
  return DECKS[FALLBACK_DECK_ID] || null;
}

export function getCardBackFallbackUrl(options = {}) {
  const primaryBackPath = resolveCardBackPath({ preferredPack: options.preferredPack || 'meow-v2' });
  const fallbackPath = resolveCardBackFallbackPath();
  if (!fallbackPath || fallbackPath === primaryBackPath) return null;
  return buildAssetUrl(fallbackPath, { versioned: true });
}

export function joinAssetPath(base = '', subpath = '') {
  const rawBase = String(base || '');
  const rawSubpath = String(subpath || '');
  const absolute = rawBase.startsWith('/') || (!rawBase && rawSubpath.startsWith('/'));

  if (!rawBase && !rawSubpath) return '';

  const cleanBase = rawBase.replace(/\/+$/, '');
  const cleanSubpath = rawSubpath.replace(/^\/+/, '');

  if (!cleanBase) return absolute ? `/${cleanSubpath}` : cleanSubpath;
  if (!cleanSubpath) return cleanBase;

  return `${cleanBase}/${cleanSubpath}`;
}

function joinAssetPathSingleSlash(base = '', subpath = '') {
  return joinAssetPath(base, subpath);
}

// Card images resolve via meow-v2 with runtime existence fallback.
export function getCardImageUrl(card, options = {}) {
  const orientation = options.orientation || card.orientation || 'upright';
  const baseId = normalizeId(
    String(card.image_id || card.card_id || card.id || '').replace(/-(upright|reversed)$/i, ''),
  );
  const orientedCard = baseId
    ? { ...card, id: `${baseId}-${orientation}`, card_id: `${baseId}-${orientation}`, image_id: `${baseId}-${orientation}` }
    : card;
  const { uprightUrl, reversedUrl, backUrl } = buildCardImageUrls(orientedCard, orientation);
  if (orientation === 'reversed') return reversedUrl || uprightUrl || backUrl;
  return uprightUrl || backUrl;
}

export function getCardImageFallbackUrl() {
  return null;
}

export function applyImageFallback(imgEl, primarySrc, fallbackSources = []) {
  if (!imgEl) return;
  const candidates = [primarySrc, ...fallbackSources].filter(Boolean);
  const uniqueCandidates = [...new Set(candidates)];
  if (!uniqueCandidates.length) return;

  let index = 0;
  imgEl.onerror = (event) => {
    const failedSrc = event?.currentTarget?.currentSrc || imgEl.currentSrc || imgEl.src || uniqueCandidates[index];
    const reason = event?.type || 'error';
    console.warn('[Image] failed', { url: failedSrc, reason });

    index += 1;
    if (index >= uniqueCandidates.length) {
      imgEl.onerror = null;
      imgEl.dataset.imgFallbackFailed = '1';
      return;
    }

    if (imgEl.dataset.imgFallbackLocked === '1') return;
    imgEl.dataset.imgFallbackLocked = '1';
    imgEl.src = uniqueCandidates[index];
    const unlock = () => {
      delete imgEl.dataset.imgFallbackLocked;
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(unlock);
    else setTimeout(unlock, 0);
  };
  imgEl.src = uniqueCandidates[index];
}

export const applyImgFallback = applyImageFallback;

// Dynamic deck used by the app
export let meowTarotCards = [];
const CARDS_JSON_URL = new URL('../data/cards.json', import.meta.url).toString();
export let meowTarotManifest = [];

export const TAROT_DATA_VERSION = '2024-10-01';
const FULL_DECK_STORAGE_KEY = 'meowtarot_cards_full';
const MANIFEST_STORAGE_KEY = 'meowtarot_cards_manifest';
let fullDeckLoaded = false;
let manifestLoaded = false;
const MIN_EXPECTED_DECK_SIZE = 120;
const MIN_EXPECTED_MANIFEST_SIZE = 120;

export function normalizeId(value = '') {
  return value
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizeCards(cards) {
  return (cards || []).map((card, idx) => {
    const orientation = card.orientation || 'upright';
    const rawId =
      card.id
      || card.card_id
      || card.image_id
      || card.seo_slug_en
      || card.card_name_en
      || card.name_en
      || card.name_th
      || card.name
      || card.alias_th;

    const withOrientation =
      orientation === 'reversed' && rawId && !rawId.toLowerCase().includes('reversed')
        ? `${rawId}-reversed`
        : rawId;

    const normalizedId = normalizeId(withOrientation) || `card-${idx + 1}`;

    return {
      ...card,
      id: normalizedId,
      legacy_id: withOrientation || rawId || null,
      orientation,
      orientation_label_th: card.orientation_label_th
        || (orientation === 'reversed' ? 'ไพ่กลับหัว' : 'ไพ่ปกติ'),
    };
  });
}

function isCanonicalOrientedId(id = '') {
  return /^\d{1,3}-.+-(upright|reversed)$/.test(normalizeId(id));
}

function hasExpectedDeckShape(cards = [], minimumSize = MIN_EXPECTED_DECK_SIZE) {
  if (!Array.isArray(cards) || cards.length < minimumSize) return false;
  const orientedCount = cards.filter((card) =>
    isCanonicalOrientedId(card?.id || card?.card_id || card?.image_id || '')
  ).length;
  return orientedCount >= Math.ceil(cards.length * 0.9);
}

function clearCachedKey(key) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn(`Failed to remove ${key} from localStorage`, error);
  }
}

function extractCards(data) {
  return Array.isArray(data)
    ? data
    : Array.isArray(data?.cards)
      ? data.cards
      : [];
}

function minimalizeCard(card = {}) {
  return {
    id: card.id,
    card_id: card.card_id,
    image_id: card.image_id,
    seo_slug_en: card.seo_slug_en,
    card_name_en: card.card_name_en,
    name_en: card.name_en,
    name_th: card.name_th,
    alias_th: card.alias_th,
    orientation: card.orientation,
  };
}

function readLocalJSON(key) {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && parsed.version === TAROT_DATA_VERSION && Array.isArray(parsed.data)) {
      return parsed.data;
    }
    return null;
  } catch (error) {
    console.warn(`Failed to read ${key} from localStorage`, error);
    return null;
  }
}

function writeLocalJSON(key, value) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify({ version: TAROT_DATA_VERSION, data: value }));
  } catch (error) {
    console.warn(`Failed to write ${key} to localStorage`, error);
  }
}

// Static fallback deck + backwards-compat for old imports
export const tarotCards = [
  { id: 'MAJ_00', name_en: 'The Fool', name_th: 'ไพ่คนโง่', meaning_en: 'New beginnings, spontaneity, a leap of faith.', meaning_th: 'การเริ่มต้นใหม่ ความกล้า การก้าวกระโดดด้วยศรัทธา' },
  { id: 'MAJ_01', name_en: 'The Magician', name_th: 'ไพ่จอมเวท', meaning_en: 'Manifestation, skill, resourcefulness.', meaning_th: 'พลังสร้างสรรค์ ความสามารถ และทรัพยากรครบถ้วน' },
  { id: 'MAJ_02', name_en: 'The High Priestess', name_th: 'ไพ่สตรีนักบวช', meaning_en: 'Intuition, mystery, inner wisdom.', meaning_th: 'สัญชาตญาณ ความลับ ปัญญาภายใน' },
  { id: 'MAJ_03', name_en: 'The Empress', name_th: 'ไพ่จักรพรรดินี', meaning_en: 'Nurturing, abundance, creativity.', meaning_th: 'ความอุดมสมบูรณ์ การโอบอุ้ม ความคิดสร้างสรรค์' },
  { id: 'MAJ_04', name_en: 'The Emperor', name_th: 'ไพ่จักรพรรดิ', meaning_en: 'Structure, leadership, stability.', meaning_th: 'ความเป็นผู้นำ โครงสร้าง ความมั่นคง' },
  { id: 'MAJ_05', name_en: 'The Hierophant', name_th: 'ไพ่พระสังฆราช', meaning_en: 'Tradition, guidance, spiritual wisdom.', meaning_th: 'ประเพณี คำแนะนำ ความรู้ทางจิตวิญญาณ' },
  { id: 'MAJ_06', name_en: 'The Lovers', name_th: 'ไพ่คนรัก', meaning_en: 'Connection, harmony, choices of the heart.', meaning_th: 'ความรัก ความลงตัว การตัดสินใจจากหัวใจ' },
  { id: 'MAJ_07', name_en: 'The Chariot', name_th: 'ไพ่รถศึก', meaning_en: 'Momentum, determination, victory.', meaning_th: 'แรงผลักดัน ความมุ่งมั่น ความสำเร็จ' },
  { id: 'MAJ_08', name_en: 'Strength', name_th: 'ไพ่พลังภายใน', meaning_en: 'Courage, patience, gentle power.', meaning_th: 'ความกล้าหาญ ความอดทน พลังที่อ่อนโยน' },
  { id: 'MAJ_09', name_en: 'The Hermit', name_th: 'ไพ่ฤๅษี', meaning_en: 'Introspection, guidance, solitude.', meaning_th: 'การพิจารณาตัวเอง แสงสว่างภายใน ความสงบ' },
  { id: 'MAJ_10', name_en: 'Wheel of Fortune', name_th: 'ไพ่กงล้อแห่งโชคชะตา', meaning_en: 'Cycles, change, destiny turning.', meaning_th: 'วัฏจักร การเปลี่ยนแปลง โชคชะตาเคลื่อน' },
  { id: 'MAJ_11', name_en: 'Justice', name_th: 'ไพ่ยุติธรรม', meaning_en: 'Balance, truth, fair decisions.', meaning_th: 'ความยุติธรรม ความจริง การตัดสินใจที่เที่ยงตรง' },
  { id: 'MAJ_12', name_en: 'The Hanged Man', name_th: 'ไพ่ชายถูกแขวน', meaning_en: 'Perspective, pause, surrender.', meaning_th: 'มุมมองใหม่ การหยุดพัก การปล่อยวาง' },
  { id: 'MAJ_13', name_en: 'Death', name_th: 'ไพ่ความเปลี่ยนแปลง', meaning_en: 'Transformation, endings, rebirth.', meaning_th: 'การเปลี่ยนผ่าน การจบสิ้น การเกิดใหม่' },
  { id: 'MAJ_14', name_en: 'Temperance', name_th: 'ไพ่พอเหมาะพอดี', meaning_en: 'Balance, moderation, harmony.', meaning_th: 'ความพอดี การผสมผสานที่ลงตัว ความสงบ' },
  { id: 'MAJ_15', name_en: 'The Devil', name_th: 'ไพ่ปีศาจ', meaning_en: 'Attachments, temptation, awareness of limits.', meaning_th: 'พันธนาการ สิ่งยั่วยวน การรู้ขอบเขต' },
  { id: 'MAJ_16', name_en: 'The Tower', name_th: 'ไพ่หอคอย', meaning_en: 'Sudden change, revelation, rebuild.', meaning_th: 'การเปลี่ยนแปลงฉับพลัน การตาสว่าง การสร้างใหม่' },
  { id: 'MAJ_17', name_en: 'The Star', name_th: 'ไพ่ดวงดาว', meaning_en: 'Hope, healing, inspiration.', meaning_th: 'ความหวัง การเยียวยา แรงบันดาลใจ' },
  { id: 'MAJ_18', name_en: 'The Moon', name_th: 'ไพ่พระจันทร์', meaning_en: 'Dreams, intuition, the unseen.', meaning_th: 'ความฝัน สัญชาตญาณ สิ่งที่มองไม่เห็น' },
  { id: 'MAJ_19', name_en: 'The Sun', name_th: 'ไพ่ดวงอาทิตย์', meaning_en: 'Joy, clarity, warmth.', meaning_th: 'ความสุข ความชัดเจน ความอบอุ่น' },
  { id: 'MAJ_20', name_en: 'Judgement', name_th: 'ไพ่การตื่นรู้', meaning_en: 'Awakening, evaluation, calling.', meaning_th: 'การตื่นรู้ การทบทวน เสียงเรียกภายใน' },
  { id: 'MAJ_21', name_en: 'The World', name_th: 'ไพ่โลก', meaning_en: 'Completion, integration, wholeness.', meaning_th: 'ความสมบูรณ์ การเชื่อมโยงทั้งหมด ความสำเร็จ' },
];

// Provide a normalized fallback immediately so the board can always surface IDs.
meowTarotCards = normalizeCards(tarotCards);
meowTarotManifest = normalizeCards(tarotCards.map(minimalizeCard));
if (typeof window !== 'undefined') {
  window.meowTarotCards = meowTarotCards;
  window.meowTarotManifest = meowTarotManifest;
}

export function loadTarotManifest() {
  if (manifestLoaded && meowTarotManifest.length) return Promise.resolve(meowTarotManifest);

  const cached = readLocalJSON(MANIFEST_STORAGE_KEY);
  if (Array.isArray(cached) && cached.length) {
    const normalizedManifest = normalizeCards(cached.map(minimalizeCard));
    if (hasExpectedDeckShape(normalizedManifest, MIN_EXPECTED_MANIFEST_SIZE)) {
      meowTarotManifest = normalizedManifest;
      manifestLoaded = true;
      writeLocalJSON(MANIFEST_STORAGE_KEY, meowTarotManifest);
      if (typeof window !== 'undefined') {
        window.meowTarotManifest = meowTarotManifest;
      }
      return Promise.resolve(meowTarotManifest);
    }
    console.warn('Ignoring stale tarot manifest cache; refetching manifest payload.');
    clearCachedKey(MANIFEST_STORAGE_KEY);
  }

  return fetch(CARDS_JSON_URL, { cache: 'force-cache' })
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to fetch data/cards.json (HTTP ${res.status})`);
      return res.json();
    })
    .then((data) => {
      const rawCards = extractCards(data);
      if (!rawCards.length) {
        throw new Error('cards.json loaded but no cards array found (expected {cards:[...]} or [...])');
      }
      meowTarotManifest = normalizeCards(rawCards.map(minimalizeCard));
      manifestLoaded = true;
      writeLocalJSON(MANIFEST_STORAGE_KEY, meowTarotManifest);
      if (typeof window !== 'undefined') {
        window.meowTarotManifest = meowTarotManifest;
      }
      return meowTarotManifest;
    })
    .catch((err) => {
      console.error('Failed to load tarot manifest (falling back to built-in tarotCards)', err);
      meowTarotManifest = normalizeCards(tarotCards.map(minimalizeCard));
      manifestLoaded = true;
      if (typeof window !== 'undefined') {
        window.meowTarotManifest = meowTarotManifest;
      }
      return meowTarotManifest;
    });
}

// Load full deck from JSON, fall back to static tarotCards if anything fails
export function loadTarotData() {
  if (fullDeckLoaded && meowTarotCards.length) return Promise.resolve(meowTarotCards);

  const cached = readLocalJSON(FULL_DECK_STORAGE_KEY);
  if (Array.isArray(cached) && cached.length) {
    const normalizedDeck = normalizeCards(cached);
    if (hasExpectedDeckShape(normalizedDeck, MIN_EXPECTED_DECK_SIZE)) {
      meowTarotCards = normalizedDeck;
      fullDeckLoaded = true;
      writeLocalJSON(FULL_DECK_STORAGE_KEY, meowTarotCards);
      if (typeof window !== 'undefined') {
        window.meowTarotCards = meowTarotCards;
      }
      return Promise.resolve(meowTarotCards);
    }
    console.warn('Ignoring stale tarot full-deck cache; refetching cards payload.');
    clearCachedKey(FULL_DECK_STORAGE_KEY);
  }

  return fetch(CARDS_JSON_URL, { cache: 'force-cache' })
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to fetch data/cards.json (HTTP ${res.status})`);
      return res.json();
    })
    .then((data) => {
      // Support BOTH:
      // 1) { cards: [...] }
      // 2) [ ... ]
      const rawCards = extractCards(data);

      if (!rawCards.length) {
        throw new Error('cards.json loaded but no cards array found (expected {cards:[...]} or [...])');
      }

      meowTarotCards = normalizeCards(rawCards);
      fullDeckLoaded = true;
      writeLocalJSON(FULL_DECK_STORAGE_KEY, meowTarotCards);

      if (typeof window !== 'undefined') {
        window.meowTarotCards = meowTarotCards;
      }
      return meowTarotCards;
    })
    .catch((err) => {
      console.error('Failed to load tarot data (falling back to built-in tarotCards)', err);
      meowTarotCards = normalizeCards(tarotCards);
      fullDeckLoaded = true;
      if (typeof window !== 'undefined') {
        window.meowTarotCards = meowTarotCards;
      }
      return meowTarotCards;
    });
}
