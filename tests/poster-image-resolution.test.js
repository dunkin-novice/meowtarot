import test from 'node:test';
import assert from 'node:assert/strict';

import { resolvePosterCardImageSources } from '../share/poster.js';

test('reversed orientation prefers reversed -> upright -> default chain', () => {
  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => logs.push(args);

  try {
    const result = resolvePosterCardImageSources(
      {
        orientation: 'reversed',
        image_reversed: 'entry-reversed.webp',
        image_upright: 'entry-upright.webp',
        image: 'entry-default.webp',
        card: {
          slug: 'ace-of-swords',
          image_reversed: 'card-reversed.webp',
          image_upright: 'card-upright.webp',
          image: 'card-default.webp',
        },
      },
      {
        resolvedPrimary: 'resolved-primary.webp',
        uprightUrl: 'upright-url.webp',
        reversedUrl: 'reversed-url.webp',
        backUrl: 'back-url.webp',
        lang: 'th',
      },
    );

    assert.equal(result.primary, 'entry-reversed.webp');
    assert.deepEqual(result.fallbackChain.slice(0, 4), [
      'entry-upright.webp',
      'card-upright.webp',
      'upright-url.webp',
      'entry-default.webp',
    ]);

    assert.ok(logs.some((args) => String(args[0]).includes('[Poster] card image resolved')));
    const payload = logs.find((args) => String(args[0]).includes('[Poster] card image resolved'))?.[1] || {};
    assert.equal(payload.orientation, 'reversed');
    assert.equal(payload.lang, 'th');
    assert.equal(payload.finalImage, 'entry-reversed.webp');
  } finally {
    console.log = originalLog;
  }
});

test('upright orientation prefers upright -> default chain', () => {
  const result = resolvePosterCardImageSources(
    {
      orientation: 'upright',
      image_upright: 'entry-upright.webp',
      image: 'entry-default.webp',
      card: {
        slug: 'ace-of-swords',
        image_upright: 'card-upright.webp',
        image: 'card-default.webp',
      },
    },
    {
      resolvedPrimary: 'resolved-primary.webp',
      uprightUrl: 'upright-url.webp',
      reversedUrl: 'reversed-url.webp',
      backUrl: 'back-url.webp',
      lang: 'en',
    },
  );

  assert.equal(result.primary, 'entry-upright.webp');
  assert.deepEqual(result.fallbackChain.slice(0, 4), [
    'entry-default.webp',
    'card-default.webp',
    'resolved-primary.webp',
    'back-url.webp',
  ]);
});

test('language does not alter resolved image selection', () => {
  const baseEntry = {
    orientation: 'reversed',
    image_reversed: 'entry-reversed.webp',
    image_upright: 'entry-upright.webp',
    image: 'entry-default.webp',
    card: { slug: 'the-fool' },
  };

  const enResult = resolvePosterCardImageSources(baseEntry, {
    uprightUrl: 'upright-url.webp',
    reversedUrl: 'reversed-url.webp',
    backUrl: 'back-url.webp',
    lang: 'en',
  });
  const thResult = resolvePosterCardImageSources(baseEntry, {
    uprightUrl: 'upright-url.webp',
    reversedUrl: 'reversed-url.webp',
    backUrl: 'back-url.webp',
    lang: 'th',
  });

  assert.equal(enResult.primary, thResult.primary);
  assert.deepEqual(enResult.fallbackChain, thResult.fallbackChain);
});
