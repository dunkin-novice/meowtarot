import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { normalizeCards, normalizeId } from '../js/data.js';
import {
  findCardById,
  getBaseCardId,
  getBaseId,
  getOrientation,
  matchesCardId,
  toSeoSlugFromId,
  toOrientation,
} from '../js/reading-helpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cardsJsonPath = path.join(__dirname, '../data/cards.json');
const cardsJson = JSON.parse(fs.readFileSync(cardsJsonPath, 'utf8'));
const rawCards = Array.isArray(cardsJson) ? cardsJson : Array.isArray(cardsJson.cards) ? cardsJson.cards : [];
const deck = normalizeCards(rawCards);

test('getBaseId strips orientation while getOrientation defaults to upright', () => {
  assert.strictEqual(getBaseId('01-the-fool-reversed'), '01-the-fool');
  assert.strictEqual(getBaseId('01-the-fool-upright'), '01-the-fool');
  assert.strictEqual(getOrientation('01-the-fool-reversed'), 'reversed');
  assert.strictEqual(getOrientation('01-the-fool-upright'), 'upright');
  assert.strictEqual(getOrientation('MAJ_01'), 'upright');
  assert.strictEqual(getBaseCardId('MAJ_01'), 'maj-01');
  assert.strictEqual(toOrientation({ id: '01-the-fool-reversed', orientation: 'reversed' }), 'reversed');
});

test('SEO slug generation ignores orientation suffixes', () => {
  const sample = deck.find((card) => card.id.includes('-')); // any normalized id
  assert.ok(sample, 'expected at least one card in the deck');

  const base = getBaseId(sample.id, normalizeId);
  assert.strictEqual(toSeoSlugFromId(sample.id, normalizeId), base);
  assert.strictEqual(toSeoSlugFromId(`${base}-reversed`, normalizeId), base);
});

test('findCardById resolves SEO slug ids', () => {
  const slugged = deck.find((card) => card.seo_slug_en);
  assert.ok(slugged, 'expected to find at least one card with an SEO slug');

  const card = findCardById(deck, slugged.seo_slug_en);
  assert.ok(card, 'expected to resolve a card for the first slugged ID');
  assert.ok(matchesCardId(card, slugged.seo_slug_en));
  assert.strictEqual(getBaseId(card.id), getBaseId(slugged.id));
});

test('findCardById prefers the requested orientation', () => {
  const sampleBase = getBaseId(deck[0].id);
  const upright = deck.find((card) => card.id === `${sampleBase}-upright`);
  const reversed = deck.find((card) => card.id === `${sampleBase}-reversed`);

  assert.ok(upright, 'expected upright orientation');
  assert.ok(reversed, 'expected reversed orientation');

  const uprightHit = findCardById(deck, `${sampleBase}-upright`);
  const reversedHit = findCardById(deck, `${sampleBase}-reversed`);

  assert.strictEqual(uprightHit?.id, upright.id);
  assert.strictEqual(reversedHit?.id, reversed.id);
});

test('each base card appears in both upright and reversed orientations', () => {
  const baseIds = new Set(deck.map((card) => getBaseId(card.id)));

  for (const baseId of baseIds) {
    const upright = deck.find((card) => card.id === `${baseId}-upright`);
    const reversed = deck.find((card) => card.id === `${baseId}-reversed`);
    assert.ok(upright, `missing upright orientation for ${baseId}`);
    assert.ok(reversed, `missing reversed orientation for ${baseId}`);
  }

  assert.strictEqual(deck.length, baseIds.size * 2, 'deck should be doubled by orientation');
});
