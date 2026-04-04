import assert from 'node:assert/strict';
import test from 'node:test';
import { parseReadingStateFromUrl } from '../js/reading-url.js';
import { normalizeHydratedCardId, shouldUseRecoverableHydrationFallback } from '../js/reading-hydration.js';

function resolveNumericOrientedId(cards, hydratedId) {
  const match = String(hydratedId || '').trim().toLowerCase().match(/^(\d{1,3})-(upright|reversed)$/);
  if (!match) return null;
  const [, numberPart, orientation] = match;
  const prefix = `${Number(numberPart)}-`;
  return cards.find((card) => card.id.startsWith(prefix) && card.id.endsWith(`-${orientation}`)) || null;
}

test('normalizeHydratedCardId canonicalizes compact and numeric-orientation forms while preserving slugs', () => {
  assert.strictEqual(normalizeHydratedCardId('33u'), '33-upright');
  assert.strictEqual(normalizeHydratedCardId('33r'), '33-reversed');
  assert.strictEqual(normalizeHydratedCardId('033-upright'), '33-upright');
  assert.strictEqual(normalizeHydratedCardId('33-the-empress-upright'), '33-the-empress-upright');
});

test('parser output stays resolver-compatible for compact URL payloads', () => {
  const parsed = parseReadingStateFromUrl('?m=f&s=story&t=g&c=33u,19r&l=en');
  assert.deepStrictEqual(parsed.cards, ['33-upright', '19-reversed']);

  const sampleDeck = [
    { id: '33-page-of-wands-upright' },
    { id: '19-the-moon-reversed' },
  ];
  const resolved = parsed.cards.map((id) => resolveNumericOrientedId(sampleDeck, id));
  assert.ok(resolved.every(Boolean));
});

test('recoverable fallback is enabled for unresolved hydrated IDs in full/question modes', () => {
  assert.equal(shouldUseRecoverableHydrationFallback('full'), true);
  assert.equal(shouldUseRecoverableHydrationFallback('question'), true);
  assert.equal(shouldUseRecoverableHydrationFallback('daily'), false);
});

test('valid full-flow slug IDs remain unchanged by hydration normalization', () => {
  const ids = [
    '1-the-fool-upright',
    '2-the-magician-reversed',
    '3-the-high-priestess-upright',
  ];
  assert.deepStrictEqual(ids.map((id) => normalizeHydratedCardId(id)), ids);
});
