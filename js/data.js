import { buildAssetUrl, resolveDeckAssetBase } from './asset-config.js';
import {
  resolveCardBackFallbackPath,
  resolveCardBackPath,
  buildCardImageUrls,
} from './asset-resolver.js';
import { getCurrentUserSync } from './auth.js';

// Deck configuration (for future multi-deck support)
export const DECKS = {
  'moonmallow': {
    id: 'moonmallow',
    name: 'Moonmallow',
    name_th: 'เหมียวฝันหวาน',
    role: 'default',
    unlock_day: null,
    assetsBase: resolveDeckAssetBase('assets/moonmallow'),
    backImage: buildAssetUrl('assets/moonmallow/00-back.webp'),
  },
  'veila-tarot': {
    id: 'veila-tarot',
    name: 'Veila Tarot',
    name_th: 'แมวม่านพราย',
    role: 'default',
    unlock_day: null,
    assetsBase: resolveDeckAssetBase('assets/veila-tarot'),
    backImage: buildAssetUrl('assets/veila-tarot/00-back.webp'),
  },
  'boba-oracle': {
    id: 'boba-oracle',
    name: 'Boba Oracle',
    name_th: 'แมวชานม',
    role: 'streak-unlock',
    unlock_day: 7,
    assetsBase: resolveDeckAssetBase('assets/boba-oracle'),
    backImage: buildAssetUrl('assets/boba-oracle/00-back.webp'),
  },
  'meow-nakorn': {
    id: 'meow-nakorn',
    name: 'Meow Nakorn',
    name_th: 'นครหมียว',
    role: 'streak-unlock',
    unlock_day: 14,
    assetsBase: resolveDeckAssetBase('assets/meow-nakorn'),
    backImage: buildAssetUrl('assets/meow-nakorn/00-back.webp'),
  },
  'moonveil': {
    id: 'moonveil',
    name: 'Moonveil',
    name_th: 'จันทราขนฟู',
    role: 'streak-unlock',
    unlock_day: 21,
    assetsBase: resolveDeckAssetBase('assets/moonveil'),
    backImage: buildAssetUrl('assets/moonveil/00-back.webp'),
  },
  'overtime-oracle': {
    id: 'overtime-oracle',
    name: 'Overtime Oracle',
    name_th: 'แมวโอที',
    role: 'streak-unlock',
    unlock_day: 28,
    assetsBase: resolveDeckAssetBase('assets/overtime-oracle'),
    backImage: buildAssetUrl('assets/overtime-oracle/00-back.webp'),
  },
  'pawbit': {
    id: 'pawbit',
    name: 'Pawbit',
    name_th: 'พิกเซลเหมียว',
    role: 'streak-unlock',
    unlock_day: 45,
    assetsBase: resolveDeckAssetBase('assets/pawbit'),
    backImage: buildAssetUrl('assets/pawbit/00-back.webp'),
  },
  'paws-of-luck': {
    id: 'paws-of-luck',
    name: 'Paws of Luck',
    name_th: 'เจ้าเหมียวหัดเดิน',
    role: 'streak-unlock',
    unlock_day: 60,
    assetsBase: resolveDeckAssetBase('assets/paws-of-luck'),
    backImage: buildAssetUrl('assets/paws-of-luck/00-back.webp'),
  },
  'sugar-paws': {
    id: 'sugar-paws',
    name: 'Sugar Paws',
    name_th: 'เหมียวละมุน',
    role: 'streak-unlock',
    unlock_day: 75,
    assetsBase: resolveDeckAssetBase('assets/sugar-paws'),
    backImage: buildAssetUrl('assets/sugar-paws/00-back.webp'),
  },
  'sushicat': {
    id: 'sushicat',
    name: 'Sushicat',
    name_th: 'เหมียวซูชิ',
    role: 'streak-unlock',
    unlock_day: 100,
    assetsBase: resolveDeckAssetBase('assets/sushicat'),
    backImage: buildAssetUrl('assets/sushicat/00-back.webp'),
  },
  'inkmess': {
    id: 'inkmess',
    name: 'Inkmess',
    name_th: 'เหมียวยุ่ง',
    role: 'streak-unlock',
    unlock_day: 125,
    assetsBase: resolveDeckAssetBase('assets/inkmess'),
    backImage: buildAssetUrl('assets/inkmess/00-back.webp'),
  },
};

export const DEFAULT_DECK_ID = 'moonmallow';
export const FALLBACK_DECK_ID = 'moonmallow';

const ACTIVE_DECK_STORAGE_KEY = 'meowtarot_active_deck';

export function getActiveDeckId() {
  // A ?deck= URL override lets a reading on one origin (apex / the iOS app) carry its
  // deck to the canonical card-meaning pages on www, where its localStorage active
  // deck isn't visible — so the meaning-page card image matches the reading's deck.
  if (typeof window !== 'undefined' && window.location) {
    try {
      const param = new URLSearchParams(window.location.search).get('deck');
      if (param && DECKS[param]) return param;
    } catch (_) { /* ignore malformed search */ }
  }
  if (typeof localStorage === 'undefined') return DEFAULT_DECK_ID;
  const stored = localStorage.getItem(ACTIVE_DECK_STORAGE_KEY);
  return (stored && DECKS[stored]) ? stored : DEFAULT_DECK_ID;
}

export let activeDeckId = getActiveDeckId();

export function getActiveDeck() {
  return DECKS[activeDeckId];
}

// One-off deck gifts by account email — bypasses the streak unlock_day for a
// specific signed-in account (a personal gift, not a purchasable entitlement).
const DECK_GIFTS = {
  'krs.socialngame@gmail.com': ['pawbit'],
};

function isGiftedDeck(id) {
  try {
    const email = String(getCurrentUserSync()?.email || '').trim().toLowerCase();
    return Boolean(email && DECK_GIFTS[email] && DECK_GIFTS[email].includes(id));
  } catch (_) {
    return false;
  }
}

export function canUnlockDeck(id) {
  const deck = DECKS[id];
  if (!deck) return false;
  if (id === 'moonmallow') return true;
  if (!getCurrentUserSync()) return false;
  if (isGiftedDeck(id)) return true;
  if (deck.role === 'default') return true;
  if (!deck.unlock_day) return true;
  if (typeof localStorage === 'undefined') return false;
  try {
    const progress = JSON.parse(localStorage.getItem('meowtarot_user_progress') || '{}');
    // Unlock by ACCUMULATED days drawn (total_daily_reads), not consecutive streak —
    // forgiving: missing a day never sets you back. (User decision 2026-06-18.)
    const daysDrawn = progress.total_daily_reads ?? 0;
    return daysDrawn >= deck.unlock_day;
  } catch {
    return false;
  }
}

export function setActiveDeck(id) {
  if (!DECKS[id]) {
    console.warn('[deck] unknown deck id:', id);
    return;
  }
  if (!canUnlockDeck(id)) {
    console.warn('[deck] deck not unlocked:', id);
    return;
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(ACTIVE_DECK_STORAGE_KEY, id);
  }
  activeDeckId = id;
}

export function resetActiveDeck() {
  activeDeckId = DEFAULT_DECK_ID;
}

export function getAllDecks() {
  return Object.values(DECKS);
}

export function getNewlyUnlockedDecks(prevValue, newValue) {
  // prevValue/newValue are accumulated-days-drawn counts (see canUnlockDeck).
  const prev = Math.max(0, Number(prevValue) || 0);
  const next = Math.max(0, Number(newValue) || 0);
  return Object.values(DECKS)
    .filter((deck) => deck.role === 'streak-unlock' && typeof deck.unlock_day === 'number')
    .filter((deck) => deck.unlock_day > prev && deck.unlock_day <= next)
    .sort((a, b) => a.unlock_day - b.unlock_day);
}

// SINGLE SOURCE of the unlock milestone schedule (sorted day-values of the
// streak-unlock decks). The progress bar + deck unlocks both read from this, so
// the numbers can NEVER drift apart. Currently: 7,14,21,28,45,60,75,100,125.
export function getUnlockMilestones() {
  return Object.values(DECKS)
    .filter((deck) => deck.role === 'streak-unlock' && typeof deck.unlock_day === 'number')
    .map((deck) => deck.unlock_day)
    .sort((a, b) => a - b);
}

const DECK_REWARDS_SEEN_STORAGE_KEY = 'meowtarot_deck_rewards_seen';

function readDeckRewardsSeen() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DECK_REWARDS_SEEN_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function hasSeenDeckReward(deckId) {
  if (typeof localStorage === 'undefined') return false;
  return readDeckRewardsSeen().includes(String(deckId));
}

export function markDeckRewardSeen(deckId) {
  if (typeof localStorage === 'undefined') return;
  const id = String(deckId);
  if (!id) return;
  const seen = readDeckRewardsSeen();
  if (seen.includes(id)) return;
  seen.push(id);
  try {
    localStorage.setItem(DECK_REWARDS_SEEN_STORAGE_KEY, JSON.stringify(seen));
  } catch {
    // ignore
  }
}

// thumb:true returns the ~12-20KB 200px back (00-back-200.webp) instead of the
// full ~100-410KB back — use it where the back renders small (the selection
// board tiles), NOT for the full-size reading flip / card-image fallback.
export function getCardBackUrl({ thumb = false } = {}) {
  const file = thumb ? '00-back-200.webp' : '00-back.webp';
  return buildAssetUrl(`assets/${getActiveDeck().id}/${file}`, { versioned: true });
}

export function getFallbackDeck(id = activeDeckId) {
  if (id === FALLBACK_DECK_ID) return null;
  return DECKS[FALLBACK_DECK_ID] || null;
}

export function getCardBackFallbackUrl(options = {}) {
  const primaryBackPath = resolveCardBackPath({ preferredPack: options.preferredPack || DEFAULT_DECK_ID });
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

// Card images resolve via the active deck pack (getActiveDeckId) with runtime existence fallback.
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
// Tiny board-only projection (~28KB raw / ~2-3KB compressed) generated by
// scripts/generate-cards-manifest.mjs. The board waits on this instead of the
// ~4.6MB cards.json so cold loads aren't blank (BUG-021). Falls back to the
// full cards.json if missing/invalid.
const CARDS_MANIFEST_URL = new URL('../data/cards-manifest.json', import.meta.url).toString();
// Per-language projections of cards.json (generated by
// scripts/generate-cards-lang.mjs). loadTarotData() fetches the slice for the
// current locale (EN ~1.5MB / TH ~3.2MB) instead of the full ~4.6MB bilingual
// deck, falling back to CARDS_JSON_URL if a slice is missing/invalid.
const CARDS_EN_URL = new URL('../data/cards-en.json', import.meta.url).toString();
const CARDS_TH_URL = new URL('../data/cards-th.json', import.meta.url).toString();
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

// One-time cleanup: the pre-split full-deck cache (~4.6MB under the unsuffixed
// key) is superseded by per-language slices cached under `${key}_<variant>`.
// Drop it so it doesn't crowd the localStorage quota.
clearCachedKey(FULL_DECK_STORAGE_KEY);

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

  const fetchJson = (url) => fetch(url, { cache: 'force-cache' }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.json();
  });

  // Manifest-first (small) with graceful fallback to the full cards.json so a
  // missing/stale manifest degrades to the old behaviour rather than breaking.
  return fetchJson(CARDS_MANIFEST_URL)
    .then((data) => {
      const normalized = normalizeCards(extractCards(data).map(minimalizeCard));
      if (!hasExpectedDeckShape(normalized, MIN_EXPECTED_MANIFEST_SIZE)) {
        throw new Error('cards-manifest.json shape invalid');
      }
      return normalized;
    })
    .catch((manifestErr) => {
      console.warn('Card manifest unavailable; falling back to full cards.json', manifestErr?.message || manifestErr);
      return fetchJson(CARDS_JSON_URL).then((data) => {
        const rawCards = extractCards(data);
        if (!rawCards.length) {
          throw new Error('cards.json loaded but no cards array found (expected {cards:[...]} or [...])');
        }
        return normalizeCards(rawCards.map(minimalizeCard));
      });
    })
    .then((normalizedManifest) => {
      meowTarotManifest = normalizedManifest;
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

// Current locale for picking a per-language deck slice. Mirrors getUrlLanguage()
// in common.js (?lang/?l override, else /th/ path prefix) without importing it,
// to keep the data layer dependency-free.
function currentLangForData() {
  if (typeof window === 'undefined') return 'en';
  try {
    const params = new URLSearchParams(window.location.search || '');
    const param = (params.get('lang') || params.get('l') || '').toLowerCase();
    if (param === 'th' || param === 'en') return param;
    return /^\/th(\/|$)/.test(window.location.pathname || '/') ? 'th' : 'en';
  } catch (error) {
    return 'en';
  }
}

// Which deck to load: 'en'/'th' slice for a single locale, or 'both' (the full
// bilingual cards.json) for pages that render both languages at once.
function resolveDeckVariant(mode) {
  if (mode === 'both' || mode === 'full') return 'both';
  if (mode === 'en' || mode === 'th') return mode;
  return currentLangForData();
}

function deckUrlForVariant(variant) {
  if (variant === 'en') return CARDS_EN_URL;
  if (variant === 'th') return CARDS_TH_URL;
  return CARDS_JSON_URL;
}

let loadedDeckVariant = null;

// Load the deck from JSON, fall back to static tarotCards if anything fails.
// mode: undefined → current locale slice; 'en'/'th' → that slice; 'both'/'full'
// → the full bilingual cards.json (use only when both languages render at once).
export function loadTarotData(mode) {
  const variant = resolveDeckVariant(mode);
  if (fullDeckLoaded && loadedDeckVariant === variant && meowTarotCards.length) {
    return Promise.resolve(meowTarotCards);
  }

  const storageKey = `${FULL_DECK_STORAGE_KEY}_${variant}`;
  const cached = readLocalJSON(storageKey);
  if (Array.isArray(cached) && cached.length) {
    const normalizedDeck = normalizeCards(cached);
    if (hasExpectedDeckShape(normalizedDeck, MIN_EXPECTED_DECK_SIZE)) {
      meowTarotCards = normalizedDeck;
      fullDeckLoaded = true;
      loadedDeckVariant = variant;
      if (typeof window !== 'undefined') {
        window.meowTarotCards = meowTarotCards;
      }
      return Promise.resolve(meowTarotCards);
    }
    console.warn('Ignoring stale tarot deck cache; refetching cards payload.');
    clearCachedKey(storageKey);
  }

  const fetchDeck = (url) => fetch(url, { cache: 'force-cache' }).then((res) => {
    if (!res.ok) throw new Error(`Failed to fetch ${url} (HTTP ${res.status})`);
    return res.json();
  }).then((data) => {
    // Support BOTH { cards: [...] } and [ ... ].
    const rawCards = extractCards(data);
    if (!rawCards.length) {
      throw new Error(`${url} loaded but no cards array found (expected {cards:[...]} or [...])`);
    }
    return rawCards;
  });

  const primaryUrl = deckUrlForVariant(variant);
  // Per-language slice first; gracefully degrade to the full bilingual deck so a
  // missing/invalid slice behaves like the old single-file load rather than breaking.
  const fetchChain = variant === 'both'
    ? fetchDeck(CARDS_JSON_URL)
    : fetchDeck(primaryUrl).catch((sliceErr) => {
        console.warn(`Per-language deck (${primaryUrl}) unavailable; falling back to full cards.json`, sliceErr?.message || sliceErr);
        return fetchDeck(CARDS_JSON_URL);
      });

  return fetchChain
    .then((rawCards) => {
      meowTarotCards = normalizeCards(rawCards);
      fullDeckLoaded = true;
      loadedDeckVariant = variant;
      writeLocalJSON(storageKey, meowTarotCards);
      if (typeof window !== 'undefined') {
        window.meowTarotCards = meowTarotCards;
      }
      return meowTarotCards;
    })
    .catch((err) => {
      console.error('Failed to load tarot data (falling back to built-in tarotCards)', err);
      meowTarotCards = normalizeCards(tarotCards);
      fullDeckLoaded = true;
      loadedDeckVariant = variant;
      if (typeof window !== 'undefined') {
        window.meowTarotCards = meowTarotCards;
      }
      return meowTarotCards;
    });
}
