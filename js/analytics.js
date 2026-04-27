const seenEventKeys = new Set();
const PROFILE_REVISIT_STORAGE_KEY = 'meowtarot_profile_revisit';
const SESSION_ID_STORAGE_KEY = 'meowtarot_session_id';
const MAX_CARDS_PARAM_LENGTH = 100;

function getDataLayer() {
  if (typeof window === 'undefined') return null;
  if (!Array.isArray(window.dataLayer)) window.dataLayer = [];
  return window.dataLayer;
}

function sanitizePayload(payload = {}) {
  return Object.entries(payload).reduce((acc, [key, value]) => {
    if (value === undefined || value === null || value === '') return acc;
    acc[key] = value;
    return acc;
  }, {});
}

function pushEvent(eventName, payload = {}, dedupeKey = '') {
  const dataLayer = getDataLayer();
  if (!dataLayer || !eventName) return false;

  const normalizedKey = String(dedupeKey || '').trim();
  if (normalizedKey) {
    const scopedKey = `${eventName}::${normalizedKey}`;
    if (seenEventKeys.has(scopedKey)) return false;
    seenEventKeys.add(scopedKey);
  }

  dataLayer.push({
    event: eventName,
    ...sanitizePayload(payload),
  });
  return true;
}

function safeStorageGet(storage, key) {
  try {
    return storage?.getItem(key) || '';
  } catch (_) {
    return '';
  }
}

function safeStorageSet(storage, key, value) {
  try {
    storage?.setItem(key, value);
  } catch (_) {
    // Ignore storage failures for analytics-only fields.
  }
}

function getSessionId() {
  const existingSessionStorage = safeStorageGet(window.sessionStorage, SESSION_ID_STORAGE_KEY);
  if (existingSessionStorage) return existingSessionStorage;

  const existingLocalStorage = safeStorageGet(window.localStorage, SESSION_ID_STORAGE_KEY);
  if (existingLocalStorage) {
    safeStorageSet(window.sessionStorage, SESSION_ID_STORAGE_KEY, existingLocalStorage);
    return existingLocalStorage;
  }

  const generated = `mt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  safeStorageSet(window.localStorage, SESSION_ID_STORAGE_KEY, generated);
  safeStorageSet(window.sessionStorage, SESSION_ID_STORAGE_KEY, generated);
  return generated;
}

function normalizeLocale(locale = '') {
  const val = String(locale || '').toLowerCase();
  return val === 'th' ? 'th' : 'en';
}

function normalizeMode(mode = '') {
  const val = String(mode || '').toLowerCase();
  if (['daily', 'question', 'full'].includes(val)) return val;
  return 'daily';
}

function normalizeTopic(topic = '') {
  const val = String(topic || '').toLowerCase();
  return val || 'generic';
}

function normalizeUserId(userId = '') {
  const val = String(userId || '').trim();
  return val || 'anon';
}

function buildCardsValue(cards = []) {
  if (!Array.isArray(cards)) return { cardsValue: '', cardsTruncated: false };
  const serialized = cards
    .map((card) => String(card || '').trim().toLowerCase())
    .filter(Boolean)
    .join(',');
  if (serialized.length <= MAX_CARDS_PARAM_LENGTH) {
    return { cardsValue: serialized, cardsTruncated: false };
  }
  return {
    cardsValue: serialized.slice(0, MAX_CARDS_PARAM_LENGTH),
    cardsTruncated: true,
  };
}

function buildReadingKey({ locale, mode, topic, cards = [] } = {}) {
  const normalizedCards = Array.isArray(cards)
    ? cards.map((cardId) => String(cardId || '').trim().toLowerCase()).filter(Boolean)
    : [];
  return [normalizeLocale(locale), normalizeMode(mode), normalizeTopic(topic), normalizedCards.join(',')].join('|');
}

export function trackReadingStart({ locale, mode, topic, cards = [] } = {}) {
  const readingKey = buildReadingKey({ locale, mode, topic, cards });
  return pushEvent('reading_start', {
    locale: normalizeLocale(locale),
    mode: normalizeMode(mode),
    topic: normalizeTopic(topic),
  }, readingKey);
}

export function trackReadingComplete({ locale, mode, topic, cards = [] } = {}) {
  const readingKey = buildReadingKey({ locale, mode, topic, cards });
  return pushEvent('reading_complete', {
    locale: normalizeLocale(locale),
    mode: normalizeMode(mode),
    topic: normalizeTopic(topic),
    card_count: Array.isArray(cards) ? cards.length : 0,
  }, readingKey);
}

export function trackReadingCompletedRaw({
  locale,
  mode,
  topic = null,
  cards = [],
  userId = 'anon',
  durationMs = 0,
  completionId = '',
} = {}) {
  const normalizedMode = normalizeMode(mode);
  const normalizedCards = Array.isArray(cards) ? cards : [];
  const { cardsValue, cardsTruncated } = buildCardsValue(normalizedCards);
  const readingKey = buildReadingKey({ locale, mode: normalizedMode, topic, cards: normalizedCards });
  const dedupeKey = completionId || readingKey;

  return pushEvent('reading_completed_raw', {
    feature: normalizedMode,
    locale: normalizeLocale(locale),
    topic: normalizedMode === 'question' ? normalizeTopic(topic) : null,
    card_count: normalizedCards.length,
    cards: cardsValue,
    cards_truncated: cardsTruncated,
    session_id: getSessionId(),
    user_id: normalizeUserId(userId),
    duration_ms: Math.max(0, Number(durationMs) || 0),
  }, dedupeKey);
}

export function trackDailyStreakIncremented({ locale, userId = 'anon', streakDayCount = 0, incrementId = '' } = {}) {
  const dedupeKey = incrementId || `${normalizeLocale(locale)}|${normalizeUserId(userId)}|${Math.max(0, Number(streakDayCount) || 0)}`;
  return pushEvent('daily_streak_incremented', {
    locale: normalizeLocale(locale),
    session_id: getSessionId(),
    user_id: normalizeUserId(userId),
    streak_day_count: Math.max(0, Number(streakDayCount) || 0),
  }, dedupeKey);
}

export function trackTopicSelected({ locale, mode = 'question', topic } = {}) {
  return pushEvent('topic_selected', {
    locale: normalizeLocale(locale),
    mode: normalizeMode(mode),
    topic: normalizeTopic(topic),
  });
}

export function trackShareClicked({ locale, mode, topic, shareChannel } = {}) {
  return pushEvent('share_clicked', {
    locale: normalizeLocale(locale),
    mode: normalizeMode(mode),
    topic: normalizeTopic(topic),
    share_channel: String(shareChannel || '').toLowerCase() || 'unknown',
  });
}

export function trackLocaleSwitched({ fromLocale, toLocale } = {}) {
  const from = normalizeLocale(fromLocale);
  const to = normalizeLocale(toLocale);
  if (from === to) return false;
  return pushEvent('locale_switched', {
    from_locale: from,
    to_locale: to,
    locale: to,
  });
}

export function trackProfileRevisit({ locale, profileId } = {}) {
  const dataLayer = getDataLayer();
  if (!dataLayer) return false;

  const normalizedLocale = normalizeLocale(locale);
  const normalizedProfileId = String(profileId || 'guest').trim() || 'guest';

  let stored = null;
  try {
    stored = JSON.parse(window.localStorage?.getItem(PROFILE_REVISIT_STORAGE_KEY) || 'null');
  } catch (_) {
    stored = null;
  }

  const isRevisit = Boolean(stored?.profile_id && stored.profile_id === normalizedProfileId);

  if (isRevisit) {
    pushEvent('profile_revisit', {
      locale: normalizedLocale,
      profile_id: normalizedProfileId,
    }, `${normalizedLocale}|${normalizedProfileId}`);
  }

  try {
    window.localStorage?.setItem(PROFILE_REVISIT_STORAGE_KEY, JSON.stringify({
      profile_id: normalizedProfileId,
      last_seen_at: new Date().toISOString(),
    }));
  } catch (_) {
    // Ignore storage write failures.
  }

  return isRevisit;
}
