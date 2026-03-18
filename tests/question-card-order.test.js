import assert from 'node:assert/strict';
import test from 'node:test';
import { orderQuestionCards } from '../js/question-card-order.js';
import { normalizePayload } from '../share/normalize-payload.js';

test('orderQuestionCards sorts recognized question positions into past/present/future order', () => {
  const ordered = orderQuestionCards([
    { id: '03', position: 'future' },
    { id: '01', position: 'past' },
    { id: '02', position: 'present' },
  ]);

  assert.deepEqual(ordered.map((card) => [card.id, card.position]), [
    ['01', 'past'],
    ['02', 'present'],
    ['03', 'future'],
  ]);
});

test('orderQuestionCards backfills missing positions without crashing', () => {
  const ordered = orderQuestionCards([
    { id: '03', position: 'future' },
    { id: '01' },
    { id: '02' },
  ]);

  assert.deepEqual(ordered.map((card) => [card.id, card.position]), [
    ['01', 'past'],
    ['02', 'present'],
    ['03', 'future'],
  ]);
});

test('normalizePayload keeps legacy single-card question payloads centered on present', () => {
  const payload = normalizePayload({
    mode: 'question',
    cards: [{ id: '01-the-fool', orientation: 'upright' }],
  });

  assert.equal(payload.cards.length, 1);
  assert.equal(payload.cards[0].position, 'present');
});

test('normalizePayload emits question cards in stable position order', () => {
  const payload = normalizePayload({
    mode: 'question',
    cards: [
      { id: '03-the-empress', orientation: 'upright', position: 'future' },
      { id: '01-the-fool', orientation: 'upright', position: 'past' },
      { id: '02-the-magician', orientation: 'upright', position: 'present' },
    ],
  });

  assert.deepEqual(payload.cards.map((card) => [card.id, card.position]), [
    ['01-the-fool', 'past'],
    ['02-the-magician', 'present'],
    ['03-the-empress', 'future'],
  ]);
});
