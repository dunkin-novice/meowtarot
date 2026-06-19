function normalizeLanguage(lang = 'en') {
  return String(lang || '').toLowerCase().startsWith('th') ? 'th' : 'en';
}

function normalizeOrientation(orientation = '') {
  const value = String(orientation || '').toLowerCase();
  return value === 'reversed' ? 'reversed' : 'upright';
}

export function getOrientationLabel(orientation, lang = 'en') {
  const locale = normalizeLanguage(lang);
  const mode = normalizeOrientation(orientation);

  if (locale === 'th') {
    return mode === 'reversed' ? 'ไพ่กลับหัว' : 'ไพ่ตั้งตรง';
  }

  return mode === 'reversed' ? 'Reversed' : 'Upright';
}

export function getLocalizedField(card, field, lang = 'en') {
  if (!card || !field) return '';

  const locale = normalizeLanguage(lang);
  // EN/TH parity: fall back to the English field when the localized one is empty,
  // so a missing TH cell shows the English text instead of a BLANK paragraph
  // (a few story/celtic cells lack TH data). The Quick branch already did this;
  // this makes story/celtic consistent. (Audit 2026-06-20.)
  return card[`${field}_${locale}`] || card[`${field}_en`] || '';
}
