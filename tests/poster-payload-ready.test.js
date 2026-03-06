import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveCardFacePath } from '../js/asset-resolver.js';
import { buildPosterCardPayload, buildPosterConfig } from '../js/share-payload.js';

test('poster payload defaults to meow-v2 asset pack', () => {
  const poster = buildPosterConfig({ mode: 'daily', orientation: 'upright' });
  assert.equal(poster.assetPack, 'meow-v2');
  assert.equal(poster.backPack, 'meow-v2');
});

test('card face resolver points to meow-v2 pack path', () => {
  const path = resolveCardFacePath({ id: '01-the-fool-upright' });
  assert.equal(path, 'assets/meow-v2/01-the-fool-upright.webp');
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
