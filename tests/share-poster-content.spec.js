import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { test } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

function getMimeType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.webp')) return 'image/webp';
  if (filePath.endsWith('.png')) return 'image/png';
  return 'application/octet-stream';
}

function createStaticServer(rootDir) {
  return http.createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
      let pathname = decodeURIComponent(requestUrl.pathname);
      if (pathname === '/') pathname = '/reading.html';
      const normalized = path.normalize(path.join(rootDir, pathname));
      if (!normalized.startsWith(rootDir)) {
        res.statusCode = 403;
        res.end('Forbidden');
        return;
      }
      const file = await readFile(normalized);
      res.statusCode = 200;
      res.setHeader('Content-Type', getMimeType(normalized));
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.end(file);
    } catch {
      res.statusCode = 404;
      res.end('Not found');
    }
  });
}

test('share payload and poster render include card + reading content', async ({ page }) => {
  const server = createStaticServer(repoRoot);
  await new Promise((resolve) => server.listen(5006, '127.0.0.1', resolve));

  const baseUrl = 'http://127.0.0.1:5006';
  const ciLogs = [];

  page.on('console', (msg) => {
    const text = msg.text();
    if (!text || !text.startsWith('{"step"')) return;
    try {
      ciLogs.push(JSON.parse(text));
    } catch {
      // ignore non-JSON debug logs
    }
  });

  await page.addInitScript((origin) => {
    window.DEBUG_SHARE_CI = true;
    window.DEBUG_POSTER_CI = true;
    window.MEOWTAROT_ASSET_BASE_URL = origin;
    window.MEOWTAROT_CDN_BASES = [origin];
  }, baseUrl);

  try {
    await page.goto(
      `${baseUrl}/reading.html?mode=daily&topic=love&cards=01-the-fool-upright&lang=en&ci_share_debug=1`,
      { waitUntil: 'networkidle' },
    );

    await page.click('#shareBtn');
    await page.waitForURL('**/share/**', { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    const shareUrl = page.url();
    const encoded = new URL(shareUrl).searchParams.get('d');
    assert.ok(encoded, 'Expected share URL to include ?d payload');

    const padded = encoded.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((encoded.length + 3) % 4);
    const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));

    assert.ok(Array.isArray(payload.cards) && payload.cards.length > 0, 'Expected payload.cards to contain cards');
    assert.ok(payload.heading || payload.reading?.heading, 'Expected payload to include heading/reading heading');
    assert.ok(payload.reading && typeof payload.reading === 'object', 'Expected payload.reading object');
    assert.ok(typeof payload.reading.summary === 'string', 'Expected payload.reading.summary string');
    assert.ok(payload.poster && payload.poster.assetPack === 'meow-v1', 'Expected payload.poster.assetPack to be meow-v1');
    assert.ok(payload.poster.backPack === 'meow-v2', 'Expected payload.poster.backPack to be meow-v2');
    assert.ok(Array.isArray(payload.keywords), 'Expected payload.keywords array');

    await page.waitForFunction(() => {
      const preview = document.getElementById('posterPreview');
      return preview && preview.getAttribute('src') && preview.getAttribute('src').startsWith('blob:');
    }, null, { timeout: 15000 });

    const payloadLog = ciLogs.find((entry) => entry.step === 'share_payload');
    assert.ok(payloadLog, 'Expected share payload CI debug log');
    assert.ok(payloadLog.cards?.length > 0, 'Expected debug payload cards');

    const cardProbe = ciLogs.find((entry) => entry.step === 'img_probe' && entry.kind === 'card' && entry.ok === true);
    assert.ok(cardProbe, 'Expected at least one successful card image probe');

    const drawText = ciLogs.find((entry) => entry.step === 'draw_text');
    assert.ok(drawText?.executed, 'Expected poster text draw step to execute');

    const drawCard = ciLogs.find((entry) => entry.step === 'draw_card');
    assert.ok(drawCard?.executed, 'Expected poster card draw step to execute');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
