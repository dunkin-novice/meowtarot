import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveCardFacePath } from '../js/asset-resolver.js';
import { DEFAULT_DECK_ID } from '../js/data.js';
import { buildPosterCardPayload, buildPosterConfig } from '../js/share-payload.js';

test('poster payload defaults to the default deck asset pack', () => {
  const poster = buildPosterConfig({ mode: 'daily', orientation: 'upright' });
  assert.equal(poster.assetPack, DEFAULT_DECK_ID);
  assert.equal(poster.backPack, DEFAULT_DECK_ID);
});

test('card face resolver points to default deck pack path', () => {
  const path = resolveCardFacePath({ id: '01-the-fool-upright' });
  assert.equal(path, `assets/${DEFAULT_DECK_ID}/01-the-fool-upright.webp`);
});

test('poster card payload keeps orientation image fields', () => {
  const payload = buildPosterCardPayload({
    id: '01-the-fool-reversed',
    orientation: 'reversed',
    image_upright: '01-the-fool-upright.webp',
    image_reversed: '01-the-fool-reversed.webp',
    image: '01-the-fool-default.webp',
  });

  assert.equal(payload.orientation, 'reversed');
  assert.equal(payload.image_upright, '01-the-fool-upright.webp');
  assert.equal(payload.image_reversed, '01-the-fool-reversed.webp');
  assert.equal(payload.image, '01-the-fool-default.webp');
});
