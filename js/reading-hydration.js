export function normalizeHydratedCardId(rawId = '') {
  const value = String(rawId || '').trim();
  if (!value) return '';
  const lower = value.toLowerCase();

  const compactMatch = lower.match(/^(\d{1,3})([ur])$/);
  if (compactMatch) {
    const [, numberPart, orientationSuffix] = compactMatch;
    return `${Number(numberPart)}-${orientationSuffix === 'r' ? 'reversed' : 'upright'}`;
  }

  const numericOrientationMatch = lower.match(/^(\d{1,3})-(upright|reversed)$/);
  if (numericOrientationMatch) {
    const [, numberPart, orientation] = numericOrientationMatch;
    return `${Number(numberPart)}-${orientation}`;
  }

  const legacyCompactMatch = lower.match(/^([a-z0-9-]+?)([ur])$/);
  if (
    legacyCompactMatch
    && /-/.test(lower)
    && /\d/.test(lower)
    && !/(?:-upright|-reversed|-u|-r)$/.test(lower)
  ) {
    const [, baseId, orientationSuffix] = legacyCompactMatch;
    return `${baseId}-${orientationSuffix === 'r' ? 'reversed' : 'upright'}`;
  }

  return value;
}

export function shouldUseRecoverableHydrationFallback(mode = '') {
  return mode === 'full' || mode === 'question';
}
