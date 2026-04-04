export function normalizeHydratedCardId(rawId = '') {
  const value = String(rawId || '').trim();
  if (!value) return '';

  const compactMatch = value.toLowerCase().match(/^(\d{1,3})([ur])$/);
  if (compactMatch) {
    const [, numberPart, orientationSuffix] = compactMatch;
    return `${Number(numberPart)}-${orientationSuffix === 'r' ? 'reversed' : 'upright'}`;
  }

  const numericOrientationMatch = value.toLowerCase().match(/^(\d{1,3})-(upright|reversed)$/);
  if (numericOrientationMatch) {
    const [, numberPart, orientation] = numericOrientationMatch;
    return `${Number(numberPart)}-${orientation}`;
  }

  return value;
}

export function shouldUseRecoverableHydrationFallback(mode = '') {
  return mode === 'full' || mode === 'question';
}
