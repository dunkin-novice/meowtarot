import { getSupabaseClient } from './auth.js';

// Surface reading-history save failures (#4) instead of swallowing them: console +
// the global error ring buffer (window.__mtErrors) so the in-app bug reporter
// attaches them. Common cause: a missing RLS INSERT policy on readings/reading_cards.
function logReadingHistoryError(where, error) {
  if (!error) return;
  const msg = `[reading-history] ${where}: ${error.message || error.code || String(error)}`;
  try { console.warn(msg, error); } catch (_) {}
  try {
    if (typeof window !== 'undefined') {
      window.__mtErrors = window.__mtErrors || [];
      window.__mtErrors.push(msg);
      if (window.__mtErrors.length > 10) window.__mtErrors.shift();
    }
  } catch (_) {}
}

function toLocalIsoDate(input = new Date()) {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return '';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function normalizeReadingMode(mode = '') {
  const safe = String(mode || '').toLowerCase().trim();
  if (safe === 'daily') return 'daily';
  if (safe === 'question') return 'question';
  return 'full';
}

function resolveCardIdToken(card) {
  const raw = card?.card_id ?? card?.id ?? '';
  if (typeof raw === 'string') return raw.trim();
  if (raw && typeof raw === 'object') {
    const nested = raw.card_id ?? raw.id ?? raw.image_id ?? '';
    return typeof nested === 'string' ? nested.trim() : String(nested || '').trim();
  }
  return String(raw || '').trim();
}

function sanitizeReadingRecord(userId, record = {}, options = {}) {
  const cards = Array.isArray(record.cards) ? record.cards : [];
  const now = options.now instanceof Date ? options.now : new Date();
  return {
    user_id: userId,
    mode: normalizeReadingMode(record.mode),
    spread: String(record.spread || '').trim() || null,
    topic: String(record.topic || '').trim() || null,
    lang: String(record.lang || '').trim() || null,
    read_date: toLocalIsoDate(now) || toLocalIsoDate(),
    cards: cards
      .map((card, index) => {
        const cardId = resolveCardIdToken(card);
        if (!cardId) return null;
        const orientation = String(card?.orientation || '').toLowerCase() === 'reversed' ? 'reversed' : 'upright';
        const position = String(card?.position || '').trim() || null;
        return {
          card_id: cardId,
          orientation,
          position,
          sort_order: Number.isFinite(Number(card?.sort_order)) ? Number(card.sort_order) : index,
        };
      })
      .filter(Boolean),
  };
}

export async function saveReadingRecord(userId, record = {}, options = {}) {
  try {
    const client = options.client || await getSupabaseClient();
    if (!client || !userId) return null;

    const payload = sanitizeReadingRecord(userId, record, { now: options.now });
    if (!payload.cards.length) return null;

    const { data: inserted, error: readingError } = await client
      .from('readings')
      .insert({
        user_id: payload.user_id,
        mode: payload.mode,
        spread: payload.spread,
        topic: payload.topic,
        lang: payload.lang,
        read_date: payload.read_date,
      })
      .select('id')
      .single();

    if (readingError?.code === '23505' && payload.mode === 'daily') {
      // Phase 4 unique index hit — first daily of the day is canonical.
      // Return existing row id; do NOT insert reading_cards (already there).
      const { data: existing } = await client
        .from('readings')
        .select('id')
        .eq('user_id', payload.user_id)
        .eq('mode', 'daily')
        .eq('read_date', payload.read_date)
        .maybeSingle();
      return existing?.id || null;
    }

    if (readingError || !inserted?.id) {
      // Surface WHY history isn't saving (#4) — e.g. RLS ("violates row-level
      // security policy"), missing table, auth. Was silently swallowed before.
      logReadingHistoryError('readings.insert', readingError);
      return null;
    }

    const rows = payload.cards.map((card) => ({
      reading_id: inserted.id,
      card_id: card.card_id,
      orientation: card.orientation,
      position: card.position,
      sort_order: card.sort_order,
    }));

    if (!rows.length) return inserted.id;
    const { error: cardsError } = await client.from('reading_cards').insert(rows);
    if (cardsError) logReadingHistoryError('reading_cards.insert', cardsError);
    return inserted.id;
  } catch (e) {
    logReadingHistoryError('saveReadingRecord', e);
    return null;
  }
}

export async function upsertCanonicalDailyReading(userId, card, options = {}) {
  if (!userId || !card) return null;
  return saveReadingRecord(userId, {
    mode: 'daily',
    spread: 'quick',
    topic: 'generic',
    lang: options.lang || null,
    cards: [card],
  }, options);
}

export async function fetchCanonicalDailyReading(userId, readDate, options = {}) {
  try {
    const client = options.client || await getSupabaseClient();
    if (!client || !userId || !readDate) return null;

    const { data, error } = await client
      .from('readings')
      .select(`
        id,
        read_date,
        reading_cards (
          card_id,
          orientation,
          sort_order
        )
      `)
      .eq('user_id', userId)
      .eq('mode', 'daily')
      .eq('read_date', readDate)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    const cardRow = Array.isArray(data.reading_cards) && data.reading_cards.length
      ? [...data.reading_cards].sort((a, b) => (Number(a?.sort_order) || 0) - (Number(b?.sort_order) || 0))[0]
      : null;
    if (!cardRow?.card_id) return null;

    // Defensive: strip leading numeric prefix so consumers receive the un-prefixed slug
    // regardless of how the row was originally inserted.
    const cardSlug = String(cardRow.card_id).replace(/^\d{1,2}-/, '');
    if (!cardSlug) return null;

    return {
      card_slug: cardSlug,
      orientation: cardRow.orientation === 'reversed' ? 'reversed' : 'upright',
      date: data.read_date,
    };
  } catch (_) {
    return null;
  }
}

export async function loadReadings(userId, limit = 20, options = {}) {
  try {
    const client = options.client || await getSupabaseClient();
    if (!client || !userId) return [];
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));

    const { data, error } = await client
      .from('readings')
      .select(`
        id,
        mode,
        spread,
        topic,
        lang,
        read_date,
        created_at,
        reading_cards (
          card_id,
          orientation,
          position,
          sort_order
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(safeLimit);

    if (error || !Array.isArray(data)) return [];

    return data.map((entry) => ({
      ...entry,
      reading_cards: Array.isArray(entry?.reading_cards)
        ? [...entry.reading_cards].sort((a, b) => (Number(a?.sort_order) || 0) - (Number(b?.sort_order) || 0))
        : [],
    }));
  } catch (_) {
    return [];
  }
}

// ── Pending-readings queue (for readings done BEFORE login) ───────────────────
// A reading drawn while logged out can't be saved (no user_id). Queue it locally,
// then flush to Supabase on sign-in so the history isn't lost (#5).
const PENDING_READINGS_KEY = 'meowtarot_pending_readings';
const PENDING_MAX = 50;

function readPendingReadings() {
  try {
    const raw = JSON.parse(localStorage.getItem(PENDING_READINGS_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch (_) { return []; }
}

export function queuePendingReading(record = {}) {
  try {
    if (!record || !Array.isArray(record.cards) || !record.cards.length) return;
    const queue = readPendingReadings();
    // Dedupe by mode + card-id signature so the same draw isn't queued twice.
    const sig = `${record.mode}|${record.cards.map((c) => resolveCardIdToken(c)).join(',')}`;
    if (queue.some((r) => r.__sig === sig)) return;
    queue.push({ ...record, __sig: sig, __queued_at: new Date().toISOString() });
    localStorage.setItem(PENDING_READINGS_KEY, JSON.stringify(queue.slice(-PENDING_MAX)));
  } catch (_) { /* ignore */ }
}

// Save every queued reading under the now-known userId, then clear the queue.
export async function flushPendingReadings(userId) {
  if (!userId) return;
  const queue = readPendingReadings();
  if (!queue.length) return;
  try { localStorage.removeItem(PENDING_READINGS_KEY); } catch (_) {}
  for (const rec of queue) {
    try {
      await saveReadingRecord(userId, {
        mode: rec.mode,
        spread: rec.spread,
        topic: rec.topic ?? null,
        lang: rec.lang,
        cards: rec.cards,
      });
    } catch (_) { /* skip a bad record, keep going */ }
  }
}

export { toLocalIsoDate };
export { sanitizeReadingRecord };
