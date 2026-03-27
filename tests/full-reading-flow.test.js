import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTapSwap, buildNextDrawBoard } from '../js/full-reading-flow.js';

test('buildNextDrawBoard excludes already selected cards and returns a bounded board', () => {
  const pool = Array.from({ length: 20 }, (_, index) => ({ id: `card-${index + 1}` }));
  const selected = [{ id: 'card-1' }, { id: 'card-3' }, { id: 'card-5' }];
  const board = buildNextDrawBoard(pool, selected, 10, () => 0);
  assert.strictEqual(board.length, 10);
  assert.ok(!board.some((card) => ['card-1', 'card-3', 'card-5'].includes(card.id)));
});

test('applyTapSwap uses tap-two-cards behavior and supports deselecting same card', () => {
  const cards = ['a', 'b', 'c', 'd'].map((id) => ({ id }));

  const firstTap = applyTapSwap(cards, -1, 1);
  assert.strictEqual(firstTap.selectedIndex, 1);
  assert.deepEqual(firstTap.cards.map((card) => card.id), ['a', 'b', 'c', 'd']);

  const deselectTap = applyTapSwap(firstTap.cards, firstTap.selectedIndex, 1);
  assert.strictEqual(deselectTap.selectedIndex, -1);
  assert.deepEqual(deselectTap.cards.map((card) => card.id), ['a', 'b', 'c', 'd']);

  const secondFirstTap = applyTapSwap(cards, -1, 0);
  const secondTap = applyTapSwap(secondFirstTap.cards, secondFirstTap.selectedIndex, 3);
  assert.strictEqual(secondTap.selectedIndex, -1);
  assert.ok(secondTap.swapped);
  assert.deepEqual(secondTap.cards.map((card) => card.id), ['d', 'b', 'c', 'a']);
});
