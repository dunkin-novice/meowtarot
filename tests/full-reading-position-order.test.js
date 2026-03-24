import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FULL_READING_POSITION_KEYS,
  getFullReadingPositionAt,
  getFullReadingPositionMeta,
} from '../js/full-reading-position-order.js';

const LEGACY_FULL_POSITION_KEYS = ['past', 'present', 'future'];

test('custom arranged Celtic Cross order maps to the same reading positions used by the selection board', () => {
  const arrangedCards = Array.from({ length: 10 }, (_, index) => ({
    id: `card-${index + 1}`,
    orientation: index % 2 === 0 ? 'upright' : 'reversed',
  }));

  assert.deepEqual(FULL_READING_POSITION_KEYS, [
    'present',
    'challenge',
    'past',
    'future',
    'above',
    'below',
    'advice',
    'external',
    'hopes',
    'outcome',
  ]);

  assert.deepEqual(
    getFullReadingPositionMeta(arrangedCards, { legacyKeys: LEGACY_FULL_POSITION_KEYS })
      .map(({ card, position }) => [card.id, position]),
    [
      ['card-1', 'present'],
      ['card-2', 'challenge'],
      ['card-3', 'past'],
      ['card-4', 'future'],
      ['card-5', 'above'],
      ['card-6', 'below'],
      ['card-7', 'advice'],
      ['card-8', 'external'],
      ['card-9', 'hopes'],
      ['card-10', 'outcome'],
    ],
  );
});

test('full-reading share/export payload positions follow the same arranged order semantics', () => {
  const arrangedCards = Array.from({ length: 10 }, (_, index) => ({
    id: `card-${index + 1}`,
    orientation: 'upright',
  }));

  const payloadCards = arrangedCards.map((card, index) => ({
    id: card.id,
    position: getFullReadingPositionAt(index, arrangedCards.length, { legacyKeys: LEGACY_FULL_POSITION_KEYS }),
  }));

  assert.deepEqual(payloadCards, [
    { id: 'card-1', position: 'present' },
    { id: 'card-2', position: 'challenge' },
    { id: 'card-3', position: 'past' },
    { id: 'card-4', position: 'future' },
    { id: 'card-5', position: 'above' },
    { id: 'card-6', position: 'below' },
    { id: 'card-7', position: 'advice' },
    { id: 'card-8', position: 'external' },
    { id: 'card-9', position: 'hopes' },
    { id: 'card-10', position: 'outcome' },
  ]);
});

test('legacy three-card full-reading compatibility keeps prior position fallback order', () => {
  assert.deepEqual(
    Array.from({ length: 3 }, (_, index) => getFullReadingPositionAt(index, 3, { legacyKeys: LEGACY_FULL_POSITION_KEYS })),
    ['past', 'present', 'future'],
  );
});
