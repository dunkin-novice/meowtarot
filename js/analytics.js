const seenEventKeys = new Set();
const PROFILE_REVISIT_STORAGE_KEY = 'meowtarot_profile_revisit';

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
