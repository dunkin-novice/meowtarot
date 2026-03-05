import assert from 'node:assert/strict';
import { ASSET_BASE_URL } from '../js/asset-config.js';
import { exists, resolveCardImageUrl, buildCardImageUrls } from '../js/asset-resolver.js';

const samples = [
  { id: '01-the-fool-upright', orientation: 'upright' },
  { id: '01-the-fool-upright', orientation: 'reversed' },
  { id: '03-the-high-priestess-upright', orientation: 'reversed' },
  { number: 2, slug: 'the-magician', orientation: 'upright' },
];

const offlineMode = String(process.env.MEOW_ASSET_OFFLINE || '').trim() === '1';
const probeMode = String(process.env.MEOW_ASSET_PROBE || '').trim() === '1';
const hasAssetBase = Boolean(String(ASSET_BASE_URL || '').trim());
const networkChecksEnabled = hasAssetBase && !offlineMode;

console.log('[Verify] ASSET_BASE =', ASSET_BASE_URL || '(not configured)');
console.log('[Verify] OFFLINE mode =', offlineMode ? 'enabled' : 'disabled');
console.log('[Verify] network probing =', networkChecksEnabled ? 'enabled' : 'disabled');

if (!networkChecksEnabled) {
  console.log('[Verify] Network checks disabled (offline/unknown base). Resolver URL construction only.');
}

if (networkChecksEnabled && probeMode) {
  const { uprightUrl } = buildCardImageUrls({ id: '01-the-fool-upright' }, 'upright');
  const uprightExists = await exists(uprightUrl);
  assert.equal(uprightExists, true, `Expected exists(uprightUrl) === true for ${uprightUrl}`);
  console.log('[Verify] Probe assertion passed:', uprightUrl);
}

function resolveWithoutNetwork(sample) {
  const urls = buildCardImageUrls(sample, sample.orientation);
  const isReversed = String(sample.orientation || '').toLowerCase() === 'reversed';
  const resolvedUrl = isReversed
    ? (urls.reversedUrl || urls.uprightUrl || urls.backUrl)
    : (urls.uprightUrl || urls.backUrl);
  return { urls, resolvedUrl };
}

for (const sample of samples) {
  const { urls, resolvedUrl: offlineResolvedUrl } = resolveWithoutNetwork(sample);
  const resolvedUrl = networkChecksEnabled
    ? await resolveCardImageUrl(sample, sample.orientation)
    : offlineResolvedUrl;

  console.log(
    JSON.stringify(
      {
        sample,
        uprightUrl: urls.uprightUrl,
        reversedUrl: urls.reversedUrl,
        backUrl: urls.backUrl,
        resolvedUrl,
      },
      null,
      2,
    ),
  );
}
