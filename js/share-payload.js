import { ASSET_REVISION } from './asset-config.js';

function toText(value) {
  return value ? String(value) : '';
}

export function buildPosterConfig({ mode = 'full', orientation = 'upright', backgroundPath, assetPack = 'meow-v2', backPack = 'meow-v2' } = {}) {
  return {
    mode: mode === 'daily' ? 'daily' : 'full',
    orientation: orientation === 'reversed' ? 'reversed' : 'upright',
    backgroundPath: toText(backgroundPath),
    assetPack,
    backPack,
    revision: ASSET_REVISION,
  };
}

export function buildReadingPayload(reading = {}) {
  return {
    heading: toText(reading.heading),
    subHeading: toText(reading.subHeading),
    archetype: toText(reading.archetype),
    keywords: toText(reading.keywords),
    summary: toText(reading.summary),
    reading_summary_past: toText(reading.reading_summary_past),
    reading_summary_present: toText(reading.reading_summary_present),
    reading_summary_future: toText(reading.reading_summary_future),
  };
}

export function buildPosterCardPayload(card = {}) {
  return {
    id: toText(card.id),
    orientation: card.orientation === 'reversed' ? 'reversed' : 'upright',
    title: toText(card.title || card.name),
    keywords: toText(card.keywords),
    summary: toText(card.summary),
    archetype: toText(card.archetype),
    image: toText(card.image),
    image_upright: toText(card.image_upright || card.imageUpright),
    image_reversed: toText(card.image_reversed || card.imageReversed),
    resolvedImageUrl: toText(card.resolvedImageUrl || card.imageUrl),
  };
}
