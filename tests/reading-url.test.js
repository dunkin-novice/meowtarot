import assert from 'node:assert';
import test from 'node:test';
import {
  buildShareUrl,
  decodeCompactCardToken,
  encodeCompactCardToken,
  parseReadingStateFromUrl,
  serializeReadingStateToUrl,
} from '../js/reading-url.js';

test('encode/decode compact card tokens preserve id number and orientation', () => {
  assert.strictEqual(encodeCompactCardToken('33-page-of-wands-upright'), '33u');
  assert.strictEqual(encodeCompactCardToken('19-the-moon-reversed'), '19r');
  assert.deepStrictEqual(decodeCompactCardToken('33u'), { cardNumber: 33, orientation: 'upright' });
  assert.deepStrictEqual(decodeCompactCardToken('19r'), { cardNumber: 19, orientation: 'reversed' });
});

test('serializeReadingStateToUrl emits compact parameter names and no duplicate cards payload', () => {
  const url = serializeReadingStateToUrl({
    mode: 'full',
    spread: 'story',
    topic: 'generic',
    lang: 'en',
    cards: ['33-page-of-wands-upright', '19-the-moon-reversed'],
  }, { path: '/reading.html' });

  assert.strictEqual(url, '/reading.html?m=f&s=story&t=g&c=33u%2C19r&l=en');
  assert.ok(!url.includes('ids='));
  assert.ok(!url.includes('cards='));
});

test('parseReadingStateFromUrl supports verbose legacy payloads (ids only, cards only, and duplicated)', () => {
  const idsOnly = parseReadingStateFromUrl('?mode=full&spread=story&topic=generic&ids=33-page-of-wands-upright,19-the-moon-reversed&lang=en');
  assert.deepStrictEqual(idsOnly, {
    mode: 'full',
    spread: 'story',
    topic: 'generic',
    lang: 'en',
    cards: ['33-page-of-wands-upright', '19-the-moon-reversed'],
    hasAnySelection: true,
  });

  const cardsOnly = parseReadingStateFromUrl('?mode=full&spread=story&topic=generic&cards=33-page-of-wands-upright,19-the-moon-reversed&lang=en');
  assert.deepStrictEqual(cardsOnly.cards, ['33-page-of-wands-upright', '19-the-moon-reversed']);

  const duplicated = parseReadingStateFromUrl('?mode=full&spread=story&topic=generic&ids=33-page-of-wands-upright&cards=19-the-moon-reversed&lang=en');
  assert.deepStrictEqual(duplicated.cards, ['19-the-moon-reversed']);
});

test('parseReadingStateFromUrl supports compact payloads and preserves card order', () => {
  const parsed = parseReadingStateFromUrl('?m=f&s=story&t=g&c=33u,19r,57r&l=en');
  assert.deepStrictEqual(parsed, {
    mode: 'full',
    spread: 'story',
    topic: 'generic',
    lang: 'en',
    cards: ['33-upright', '19-reversed', '57-reversed'],
    hasAnySelection: true,
  });
});

test('buildShareUrl returns absolute compact URL when origin is provided', () => {
  const url = buildShareUrl({
    origin: 'https://www.meowtarot.com',
    path: '/reading.html',
    state: {
      mode: 'full',
      spread: 'story',
      topic: 'generic',
      lang: 'en',
      cards: ['33-page-of-wands-upright', '19-the-moon-reversed'],
    },
  });

  assert.strictEqual(url, 'https://www.meowtarot.com/reading.html?m=f&s=story&t=g&c=33u%2C19r&l=en');
});

test('compact serializer supports story, celtic-cross, and quick spread variants', () => {
  const story = buildShareUrl({
    path: '/reading.html',
    state: { mode: 'question', spread: 'story', topic: 'career', lang: 'en', cards: ['33-page-of-wands-upright', '19-the-moon-reversed', '57-seven-of-swords-reversed'] },
  });
  assert.strictEqual(story, '/reading.html?m=q&s=story&t=c&c=33u%2C19r%2C57r&l=en');

  const celtic = buildShareUrl({
    path: '/reading.html',
    state: { mode: 'full', spread: 'celtic-cross', topic: 'generic', lang: 'en', cards: ['33-page-of-wands-upright'] },
  });
  assert.strictEqual(celtic, '/reading.html?m=f&s=celtic-cross&t=g&c=33u&l=en');

  const quick = buildShareUrl({
    path: '/reading.html',
    state: { mode: 'daily', spread: 'quick', topic: 'generic', lang: 'th', cards: ['33-page-of-wands-upright'] },
  });
  assert.strictEqual(quick, '/reading.html?m=d&s=quick&t=g&c=33u&l=th');
});
