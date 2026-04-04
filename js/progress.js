import { normalizeId } from './data.js';

const PROGRESS_STORAGE_KEY = 'meowtarot_user_progress';
const PROGRESS_VERSION = 1;
const TOTAL_BASE_CARDS = 78;

function generateLocalUserId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch (_) {
    // fallback below
  }
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function todayLocalIsoDate() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function daysBetweenIsoDates(prevIso, nextIso) {
  if (!prevIso || !nextIso) return null;
  const prev = new Date(`${prevIso}T00:00:00`);
  const next = new Date(`${nextIso}T00:00:00`);
  if (Number.isNaN(prev.getTime()) || Number.isNaN(next.getTime())) return null;
  const diffMs = next.getTime() - prev.getTime();
  return Math.round(diffMs / 86400000);
}

function normalizeBooleanMap(input, defaults) {
  return Object.keys(defaults).reduce((acc, key) => {
    acc[key] = Boolean(input?.[key]);
    return acc;
  }, {});
}

function createDefaultProgress() {
  return {
    version: PROGRESS_VERSION,
    user_id: generateLocalUserId(),
    created_at: Date.now(),
    last_daily_read_date: null,
    streak_current: 0,
    streak_best: 0,
    total_daily_reads: 0,
    collected_base_cards: [],
    collected_oriented_cards: [],
    achievements: {
      first_daily: false,
      streak_3: false,
      streak_7: false,
      first_reversed: false,
      collect_10: false,
      collect_30: false,
      full_deck_78: false,
    },
  };
}

function sanitizeProgress(raw) {
  const fallback = createDefaultProgress();
  if (!raw || typeof raw !== 'object') return fallback;

  const baseCards = Array.isArray(raw.collected_base_cards)
    ? [...new Set(raw.collected_base_cards.map((id) => normalizeId(id)).filter(Boolean))]
    : [];
  const orientedCards = Array.isArray(raw.collected_oriented_cards)
    ? [...new Set(raw.collected_oriented_cards.map((id) => normalizeId(id)).filter(Boolean))]
    : [];

  const next = {
    ...fallback,
    ...raw,
    version: PROGRESS_VERSION,
    user_id: String(raw.user_id || fallback.user_id),
    created_at: Number(raw.created_at) || fallback.created_at,
    last_daily_read_date: typeof raw.last_daily_read_date === 'string' ? raw.last_daily_read_date : null,
    streak_current: Math.max(0, Number(raw.streak_current) || 0),
    streak_best: Math.max(0, Number(raw.streak_best) || 0),
    total_daily_reads: Math.max(0, Number(raw.total_daily_reads) || 0),
    collected_base_cards: baseCards,
    collected_oriented_cards: orientedCards,
    achievements: normalizeBooleanMap(raw.achievements, fallback.achievements),
  };

  if (next.streak_best < next.streak_current) next.streak_best = next.streak_current;
  return next;
}

function persistProgress(progress) {
  try {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  } catch (_) {
    // ignore persistence errors
  }
}

export function getUserProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (!raw) {
      const created = createDefaultProgress();
      persistProgress(created);
      return created;
    }

    const parsed = JSON.parse(raw);
    const sanitized = sanitizeProgress(parsed);
    persistProgress(sanitized);
    return sanitized;
  } catch (_) {
    const recovered = createDefaultProgress();
    persistProgress(recovered);
    return recovered;
  }
}

function isReversedCard(card = null) {
  const orientation = String(card?.orientation || '').toLowerCase();
  if (orientation === 'reversed') return true;

  const rawId = String(card?.id || card?.card_id || card?.image_id || '');
  return /-reversed$/i.test(rawId);
}

function getCardIdentity(card = null) {
  if (!card) return { baseId: '', orientedId: '' };

  const raw = String(card.id || card.card_id || card.image_id || '').trim();
  const normalized = normalizeId(raw);
  const explicitOrientation = String(card.orientation || '').toLowerCase();
  const orientation = explicitOrientation === 'reversed' ? 'reversed' : 'upright';
  const baseId = normalized.replace(/-(upright|reversed)$/i, '');
  const orientedId = baseId ? `${baseId}-${orientation}` : normalized;

  return {
    baseId,
    orientedId: normalizeId(orientedId),
  };
}

function evaluateAchievements(progress) {
  const unlockedNow = [];
  const maybeUnlock = (key, condition) => {
    if (!condition || progress.achievements[key]) return;
    progress.achievements[key] = true;
    unlockedNow.push(key);
  };

  maybeUnlock('first_daily', progress.total_daily_reads >= 1);
  maybeUnlock('streak_3', progress.streak_current >= 3);
  maybeUnlock('streak_7', progress.streak_current >= 7);
  maybeUnlock('first_reversed', progress.collected_oriented_cards.some((id) => /-reversed$/i.test(id)));
  maybeUnlock('collect_10', progress.collected_base_cards.length >= 10);
  maybeUnlock('collect_30', progress.collected_base_cards.length >= 30);
  maybeUnlock('full_deck_78', progress.collected_base_cards.length >= TOTAL_BASE_CARDS);

  return unlockedNow;
}

function getSoftMessageKey({ streakCurrent = 0, collectionCount = 0, unlockedCount = 0 } = {}) {
  if (unlockedCount > 0) return 'retentionSoftMilestone';
  if (streakCurrent >= 7) return 'retentionSoftDeepening';
  if (streakCurrent >= 3) return 'retentionSoftMomentum';
  if (collectionCount >= 10) return 'retentionSoftCollection';
  return 'retentionSoftRhythm';
}

function getAchievementLabelKey(key = '') {
  return `achievement_${key}`;
}

export function trackCompletedDailyReading(card = null) {
  const progress = getUserProgress();
  const today = todayLocalIsoDate();

  if (progress.last_daily_read_date === today) {
    return {
      progress,
      didCount: false,
      newlyUnlocked: [],
      softMessageKey: getSoftMessageKey({
        streakCurrent: progress.streak_current,
        collectionCount: progress.collected_base_cards.length,
      }),
    };
  }

  const dayDiff = daysBetweenIsoDates(progress.last_daily_read_date, today);
  if (dayDiff === 1) {
    progress.streak_current += 1;
  } else {
    progress.streak_current = 1;
  }

  progress.streak_best = Math.max(progress.streak_best, progress.streak_current);
  progress.total_daily_reads += 1;
  progress.last_daily_read_date = today;

  const { baseId, orientedId } = getCardIdentity(card);
  if (baseId && !progress.collected_base_cards.includes(baseId)) {
    progress.collected_base_cards.push(baseId);
  }

  if (orientedId && !progress.collected_oriented_cards.includes(orientedId)) {
    progress.collected_oriented_cards.push(orientedId);
  }

  if (isReversedCard(card) && orientedId && !/-reversed$/i.test(orientedId)) {
    const reversedId = orientedId.replace(/-upright$/i, '-reversed');
    if (!progress.collected_oriented_cards.includes(reversedId)) {
      progress.collected_oriented_cards.push(reversedId);
    }
  }

  const newlyUnlocked = evaluateAchievements(progress);
  persistProgress(progress);

  return {
    progress,
    didCount: true,
    newlyUnlocked,
    softMessageKey: getSoftMessageKey({
      streakCurrent: progress.streak_current,
      collectionCount: progress.collected_base_cards.length,
      unlockedCount: newlyUnlocked.length,
    }),
  };
}

export function getRetentionViewModel(result = null) {
  const progress = result?.progress || getUserProgress();
  const newlyUnlocked = Array.isArray(result?.newlyUnlocked) ? result.newlyUnlocked : [];

  return {
    streakCurrent: progress.streak_current,
    streakBest: progress.streak_best,
    collectionCount: progress.collected_base_cards.length,
    collectionTotal: TOTAL_BASE_CARDS,
    newlyUnlocked,
    latestAchievementKey: newlyUnlocked[0] || '',
    latestAchievementLabelKey: newlyUnlocked[0] ? getAchievementLabelKey(newlyUnlocked[0]) : '',
    softMessageKey: result?.softMessageKey || getSoftMessageKey({
      streakCurrent: progress.streak_current,
      collectionCount: progress.collected_base_cards.length,
      unlockedCount: newlyUnlocked.length,
    }),
  };
}
