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
      if (pathname === '/share' || pathname === '/share/') pathname = '/share/index.html';
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

function base64UrlEncode(value) {
  return Buffer.from(JSON.stringify(value), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function waitForPosterBlobOrFail(page, diagnostics, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const hasBlob = await page.evaluate(() => {
      const preview = document.getElementById('posterPreview');
      const src = preview?.getAttribute('src') || '';
      return src.startsWith('blob:');
    });

    if (hasBlob) return;
    await page.waitForTimeout(250);
  }

  throw new Error([
    'Timed out waiting for posterPreview src to become blob:.',
    `pageErrors=${JSON.stringify(diagnostics.pageErrors)}`,
    `consoleErrors=${JSON.stringify(diagnostics.consoleErrors)}`,
    `notFoundUrls=${JSON.stringify(diagnostics.notFoundUrls)}`,
    `requestFailedUrls=${JSON.stringify(diagnostics.requestFailedUrls)}`,
    `ciLogs=${JSON.stringify(diagnostics.ciLogs)}`,
    `rawConsole=${JSON.stringify(diagnostics.rawConsole)}`,
  ].join('\n'));
}

test('share payload and poster render include card + reading content', async ({ page }) => {
  const server = createStaticServer(repoRoot);
  await new Promise((resolve) => server.listen(5006, '127.0.0.1', resolve));

  const baseUrl = 'http://127.0.0.1:5006';
  const diagnostics = {
    ciLogs: [],
    pageErrors: [],
    consoleErrors: [],
    notFoundUrls: [],
    requestFailedUrls: [],
    rawConsole: [],
  };

  page.on('pageerror', (error) => {
    diagnostics.pageErrors.push(error?.message || String(error));
  });


  page.on('response', (response) => {
    if (response.status() !== 404) return;
    const url = response.url();
    if (/favicon\.ico/i.test(url)) return;
    diagnostics.notFoundUrls.push(url);
  });

  page.on('requestfailed', (request) => {
    const url = request.url();
    if (/favicon\.ico/i.test(url)) return;
    diagnostics.requestFailedUrls.push({
      url,
      error: request.failure()?.errorText || 'unknown',
    });
  });
  page.on('console', (msg) => {
    const text = msg.text();
    if (!text) return;

    diagnostics.rawConsole.push(text);

    if (msg.type() === 'error' && !/favicon\.ico/i.test(text)) {
      diagnostics.consoleErrors.push(text);
    }

    const jsonMatch = text.match(/\{.*"step".*}/);
    if (!jsonMatch) return;
    try {
      diagnostics.ciLogs.push(JSON.parse(jsonMatch[0]));
    } catch {
      // ignore non-JSON debug logs
    }
  });

  await page.addInitScript((origin) => {
    window.DEBUG_SHARE_CI = true;
    window.DEBUG_POSTER_CI = true;
    // Mirror poster-debug setup: prefer CDN assets and allow local origin fallback.
    window.MEOWTAROT_ASSET_BASE_URL = 'https://cdn.meowtarot.com';
    window.MEOWTAROT_CDN_BASES = ['https://cdn.meowtarot.com', origin];
  }, baseUrl);

  const payload = {
    mode: 'daily',
    spread: 'single',
    lang: 'en',
    poster: {
      mode: 'daily',
      orientation: 'upright',
      assetPack: 'meow-v1',
      backPack: 'meow-v2',
      backgroundPath: 'backgrounds/bg-daily-upright-v2.webp',
      revision: 'ci-debug',
    },
    reading: {
      heading: 'Daily Reading',
      subHeading: 'Your tarot message',
      archetype: 'The Fool',
      keywords: 'new beginning, curiosity',
      summary: 'A new path opens today.',
    },
    cards: [
      {
        id: '01-the-fool-upright',
        card_id: '01-the-fool-upright',
        orientation: 'upright',
        title: 'The Fool',
        keywords: 'new beginning',
        summary: 'A leap into the unknown.',
        archetype: 'The Fool',
      },
    ],
    title: 'Daily Reading',
    subtitle: 'Quick spread',
    headline: 'Your Reading',
    keywords: ['The Fool'],
  };

  try {
    const encoded = base64UrlEncode(payload);
    await page.goto(`${baseUrl}/share/?d=${encoded}`, { waitUntil: 'networkidle' });
    await page.waitForLoadState('networkidle');

    const raw = new URL(page.url()).searchParams.get('d');
    assert.ok(raw, 'Expected share URL to include ?d payload');
    const padded = raw.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((raw.length + 3) % 4);
    const decodedPayload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));

    assert.ok(Array.isArray(decodedPayload.cards) && decodedPayload.cards.length > 0, 'Expected payload.cards to contain cards');
    assert.ok(decodedPayload.reading && typeof decodedPayload.reading === 'object', 'Expected payload.reading object');
    assert.ok(typeof decodedPayload.reading.heading === 'string', 'Expected payload.reading.heading string');
    assert.ok(typeof decodedPayload.reading.archetype === 'string', 'Expected payload.reading.archetype string');
    assert.ok(typeof decodedPayload.reading.subHeading === 'string', 'Expected payload.reading.subHeading string');
    assert.ok(typeof decodedPayload.reading.keywords === 'string', 'Expected payload.reading.keywords string');
    assert.ok(typeof decodedPayload.reading.summary === 'string', 'Expected payload.reading.summary string');
    assert.ok(decodedPayload.poster && decodedPayload.poster.assetPack === 'meow-v1', 'Expected payload.poster.assetPack to be meow-v1');
    assert.ok(decodedPayload.poster.backPack === 'meow-v2', 'Expected payload.poster.backPack to be meow-v2');
    assert.ok(decodedPayload.poster.mode === 'daily', 'Expected payload.poster.mode to be daily');
    assert.ok(decodedPayload.cards[0] && typeof decodedPayload.cards[0] === 'object', 'Expected payload.cards entries to be objects');
    assert.ok(typeof decodedPayload.cards[0].keywords === 'string', 'Expected payload.cards[0].keywords string');

    await waitForPosterBlobOrFail(page, diagnostics, 15000);

    const payloadLog = diagnostics.ciLogs.find((entry) => entry.step === 'payload_ok');
    assert.ok(payloadLog, 'Expected payload_ok CI debug log');

    const cardProbe = diagnostics.ciLogs.find((entry) => entry.step === 'img_probe' && entry.kind === 'card' && entry.ok === true);
    if (!cardProbe) {
      throw new Error(
        'No successful card image probe detected\n'
        + `ciLogsCount=${diagnostics.ciLogs.length}\n`
        + 'ciLogs:\n' + JSON.stringify(diagnostics.ciLogs.slice(-50), null, 2)
        + '\nrawConsole:\n' + diagnostics.rawConsole.slice(-50).join('\n')
        + '\nnotFoundUrls:\n' + JSON.stringify(diagnostics.notFoundUrls, null, 2)
        + '\nrequestFailedUrls:\n' + JSON.stringify(diagnostics.requestFailedUrls, null, 2),
      );
    }

    const drawText = diagnostics.ciLogs.find((entry) => entry.step === 'draw_text');
    assert.ok(drawText?.executed, 'Expected poster text draw step to execute');

    const drawCard = diagnostics.ciLogs.find((entry) => entry.step === 'draw_card');
    assert.ok(drawCard?.executed, 'Expected poster card draw step to execute');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
