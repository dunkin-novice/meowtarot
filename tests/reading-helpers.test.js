import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { normalizeCards, normalizeId } from '../js/data.js';
import { findCardById, matchesCardId } from '../js/reading-helpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cardsJsonPath = path.join(__dirname, '../data/cards.json');
const cardsJson = JSON.parse(fs.readFileSync(cardsJsonPath, 'utf8'));
const deck = normalizeCards(cardsJson.cards);

test('findCardById resolves SEO slug ids', () => {
  const card = findCardById(deck, 'the-fool-tarot-meaning');
  assert.ok(card, 'expected to resolve a card for the first slugged ID');
  assert.strictEqual(card.id, 'the-fool-tarot-meaning');
});

test('reversed cards match both base and reversed IDs', () => {
  const reversedCard = deck.find((card) => card.id.endsWith('-reversed'));
  assert.ok(reversedCard, 'expected at least one reversed card in the deck');

  const baseId = reversedCard.id.replace(/-reversed$/, '');
  assert.ok(matchesCardId(reversedCard, reversedCard.id), 'should match the full reversed id');
  assert.ok(
    matchesCardId(reversedCard, baseId),
    'should match the base id even when selection omits the reversed suffix',
  );
  assert.strictEqual(
    findCardById(deck, baseId),
    reversedCard,
    'findCardById should resolve reversed cards using the base id',
  );
});
