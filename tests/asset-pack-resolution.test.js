import assert from 'node:assert/strict';
import test from 'node:test';
import { getCardBackUrl, getCardImageUrl } from '../js/data.js';

function stripVersion(url = '') {
  return String(url).replace(/[?&]v=[^&]+/g, '').replace(/[?&]$/, '');
}

test('card image URLs resolve to meow-v2 by default', () => {
  const url = stripVersion(getCardImageUrl({ id: '01-the-fool-upright', orientation: 'upright' }));
  assert.match(url, /assets\/meow-v2\/01-the-fool-upright\.webp$/);
});

test('card back URL resolves to supported back deck', () => {
  const url = stripVersion(getCardBackUrl());
  assert.match(url, /assets\/meow-v(1|2)\/00-back\.webp$/);
});
