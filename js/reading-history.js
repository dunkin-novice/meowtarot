import { getSupabaseClient } from './auth.js';

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
        const cardId = String(card?.card_id || card?.id || '').trim();
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

    if (readingError || !inserted?.id) return null;

    const rows = payload.cards.map((card) => ({
      reading_id: inserted.id,
      card_id: card.card_id,
      orientation: card.orientation,
      position: card.position,
      sort_order: card.sort_order,
    }));

    if (!rows.length) return inserted.id;
    await client.from('reading_cards').insert(rows);
    return inserted.id;
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

export { toLocalIsoDate };
export { sanitizeReadingRecord };
