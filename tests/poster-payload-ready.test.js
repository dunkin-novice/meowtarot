import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveCardFacePath } from '../js/asset-resolver.js';
import { buildPosterConfig } from '../js/share-payload.js';

test('poster payload defaults to meow-v1 asset pack', () => {
  const poster = buildPosterConfig({ mode: 'daily', orientation: 'upright' });
  assert.equal(poster.assetPack, 'meow-v1');
  assert.equal(poster.backPack, 'meow-v2');
});

test('card face resolver points to meow-v1 pack path', () => {
  const path = resolveCardFacePath({ id: '01-the-fool-upright' });
  assert.equal(path, 'assets/meow-v1/01-the-fool-upright.webp');
});
