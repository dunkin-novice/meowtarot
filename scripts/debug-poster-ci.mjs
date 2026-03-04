import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const artifactsDir = path.join(repoRoot, 'artifacts');
const useLocalAssets = process.env.POSTER_CI_LOCAL_ASSETS === '1';

mkdirSync('artifacts', { recursive: true });

const debugSteps = [];


function buildCasePayload({ orientation = 'upright', debugBackgroundPath } = {}) {
  const isReversed = orientation === 'reversed';
  return {
    mode: 'daily',
    spread: 'single',
    lang: 'en',
    ...(debugBackgroundPath ? { debugBackgroundPath } : {}),
    poster: {
      mode: 'daily',
      orientation,
      assetPack: 'meow-v1',
      backPack: 'meow-v2',
      backgroundPath: isReversed ? 'backgrounds/bg-daily-reversed-v2.webp' : 'backgrounds/bg-daily-upright-v2.webp',
      revision: 'ci-debug',
    },
    reading: {
      heading: isReversed ? 'Daily Reading (Reversed)' : 'Daily Reading',
      subHeading: 'Your tarot message',
      archetype: 'The Fool',
      keywords: isReversed ? 'release, reset, trust' : 'new beginning, curiosity, trust',
      summary: isReversed ? 'A reset invites wiser movement today.' : 'A new path opens today.',
    },
    cards: [
      {
        id: '01-the-fool',
        card_id: '01-the-fool',
        orientation,
        title: 'The Fool',
        keywords: isReversed ? 'release, reset' : 'new beginning, curiosity',
        summary: isReversed ? 'Pause before the leap and regroup.' : 'A leap into the unknown.',
        archetype: 'The Fool',
      },
    ],
  };
}

const CASES = [
  {
    name: 'daily-upright',
    filename: 'poster-daily-upright.webp',
    payload: buildCasePayload({ orientation: 'upright' }),
  },
  {
    name: 'daily-reversed',
    filename: 'poster-daily-reversed.webp',
    payload: buildCasePayload({ orientation: 'reversed' }),
  },
  {
    name: 'fallback-bg',
    filename: 'poster-fallback.webp',
    payload: buildCasePayload({
      orientation: 'upright',
      debugBackgroundPath: 'backgrounds/bg-missing-debug.webp',
    }),
  },
];

function jsonLog(step, payload = {}) {
  console.log(JSON.stringify({ step, ...payload }));
}

function getMimeType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.webp')) return 'image/webp';
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

function createStaticServer(rootDir) {
  const server = http.createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
      let pathname = decodeURIComponent(requestUrl.pathname);
      if (pathname === '/') pathname = '/share/index.html';
      const filePath = path.join(rootDir, pathname);
      const normalized = path.normalize(filePath);
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
  return server;
}

async function renderCase(page, baseUrl, testCase) {
  jsonLog('case_start', { case: testCase.name });
  const result = await page.evaluate(async ({ payload }) => {
    try {
      const [{ findCardById }, data, mod] = await Promise.all([
        import('/js/reading-helpers.js'),
        import('/js/data.js'),
        import('/share/poster.js'),
      ]);
      const lookupId = payload?.cards?.[0]?.id || payload?.cards?.[0]?.card_id || payload?.cards?.[0]?.cardId || null;
      const lookupHit = lookupId ? findCardById(data.meowTarotCards, lookupId, data.normalizeId) : null;
      console.log(JSON.stringify({
        step: 'card_lookup',
        lookupId,
        hit: Boolean(lookupHit),
        hitId: lookupHit?.id || null,
      }));
      const { blob, width, height } = await mod.buildPoster(payload, { preset: 'story' });
      const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()));
      return { ok: true, width, height, bytes, type: blob.type, size: blob.size };
    } catch (error) {
      return { ok: false, error: error?.message || String(error) };
    }
  }, { payload: testCase.payload });

  if (!result.ok) {
    jsonLog('exception', { case: testCase.name, message: result.error });
    throw new Error(`Poster render failed (${testCase.name}): ${result.error}`);
  }

  const outPath = path.join(artifactsDir, testCase.filename);
  await writeFile(outPath, Buffer.from(result.bytes));
  const info = await stat(outPath);
  jsonLog('artifact_written', {
    case: testCase.name,
    path: path.relative(repoRoot, outPath),
    bytes: info.size,
    mime: result.type,
    width: result.width,
    height: result.height,
    baseUrl,
  });
}

async function main() {
  await mkdir(artifactsDir, { recursive: true });

  const server = createStaticServer(repoRoot);
  await new Promise((resolve) => server.listen(4173, '127.0.0.1', resolve));
  const baseUrl = 'http://127.0.0.1:4173';

  jsonLog('env', { useLocalAssets, baseUrl });

  if (useLocalAssets) {
    try {
      await stat(path.join(repoRoot, 'backgrounds'));
      jsonLog('local_assets', { backgrounds: 'present' });
    } catch {
      jsonLog('local_assets', { backgrounds: 'missing', note: 'background directory not found in repository' });
    }
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', (msg) => {
    const text = msg.text();
    if (!text) return;
    if (text.startsWith('{"step"')) {
      console.log(text);
      try {
        debugSteps.push(JSON.parse(text));
      } catch {
        // ignore parse failures
      }
      return;
    }
    if (process.env.DEBUG_POSTER_CI_VERBOSE === '1') {
      console.log(JSON.stringify({ step: 'browser_console', text }));
    }
  });

  await page.addInitScript(() => {
    window.DEBUG_POSTER_CI = true;
  });
  await page.addInitScript(({ origin }) => {
    // Use CDN-first resolution for poster-debug assets, with local origin as fallback.
    // This avoids local /backgrounds/* 404s while still allowing local fallback probes.
    window.MEOWTAROT_ASSET_BASE_URL = 'https://cdn.meowtarot.com';
    window.MEOWTAROT_CDN_BASES = ['https://cdn.meowtarot.com', origin];
  }, { origin: baseUrl });

  try {
    await page.goto(`${baseUrl}/share/index.html`, { waitUntil: 'networkidle' });
    const debugFlag = await page.evaluate(() => Boolean(window.DEBUG_POSTER_CI));
    jsonLog('debug_flag', { enabled: debugFlag });
    for (const testCase of CASES) {
      await renderCase(page, baseUrl, testCase);
    }
        const hasPayloadOk = debugSteps.some((entry) => entry.step === 'payload_ok');
    const hasCardProbe = debugSteps.some((entry) => entry.step === 'img_probe' && entry.kind === 'card' && entry.ok === true);
    const hasDrawText = debugSteps.some((entry) => entry.step === 'draw_text' && entry.executed === true);
    if (!hasPayloadOk || !hasCardProbe || !hasDrawText) {
      throw new Error(`Missing required poster debug steps: payload_ok=${hasPayloadOk}, card_img_probe=${hasCardProbe}, draw_text=${hasDrawText}`);
    }
    jsonLog('done', { ok: true, artifactsDir: path.relative(repoRoot, artifactsDir) });
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  jsonLog('exception', { stage: 'script', message: error?.message || String(error) });
  process.exitCode = 1;
});
