// Deck configuration (for future multi-deck support)
export const DECKS = {
  'meow-v1': {
    id: 'meow-v1',
    name: 'MeowTarot v1',
    assetsBase: '/assets/meow-v1',
    backImage: '/assets/meow-v1/00-back.webp',
    // future: pattern for card faces, e.g.
    // cardImagePattern: '/assets/meow-v1/{imageId}.webp',
  },
};

export let activeDeckId = 'meow-v1';

export function getActiveDeck() {
  return DECKS[activeDeckId];
}

export function getCardBackUrl() {
  return getActiveDeck().backImage;
}

// Placeholder for future card images (do NOT use it yet in the UI)
export function getCardImageUrl(card, options = {}) {
  const deck = getActiveDeck();
  const assetsBase = options.assetsBase || deck.assetsBase;
  const orientation = options.orientation || card.orientation || 'upright';

  const baseId = String(card.image_id || card.card_id || card.id || '')
    .replace(/-(upright|reversed)$/i, '');

  const finalId = baseId ? `${baseId}-${orientation}` : card.image_id || card.card_id || card.id;

  return `${assetsBase}/${finalId}.webp`;
}

// Dynamic deck used by the app
export let meowTarotCards = [];

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
if (typeof window !== 'undefined') {
  window.meowTarotCards = meowTarotCards;
}

// Load full deck from JSON, fall back to static tarotCards if anything fails
export function loadTarotData() {
  return fetch('/data/cards.full.json', { cache: 'no-store' })
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to fetch /data/cards.full.json (HTTP ${res.status})`);
      return res.json();
    })
    .then((data) => {
      // Support BOTH:
      // 1) { cards: [...] }
      // 2) [ ... ]
      const rawCards = Array.isArray(data)
        ? data
        : Array.isArray(data.cards)
          ? data.cards
          : [];

      if (!rawCards.length) {
        throw new Error('cards.full.json loaded but no cards array found (expected {cards:[...]} or [...])');
      }

      meowTarotCards = normalizeCards(rawCards);

      if (typeof window !== 'undefined') {
        window.meowTarotCards = meowTarotCards;
      }
      return meowTarotCards;
    })
    .catch((err) => {
      console.error('Failed to load tarot data (falling back to built-in tarotCards)', err);
      meowTarotCards = normalizeCards(tarotCards);
      if (typeof window !== 'undefined') {
        window.meowTarotCards = meowTarotCards;
      }
      return meowTarotCards;
    });
}
