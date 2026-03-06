import { mkdir, writeFile, stat } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startStaticPreviewServer } from '../tests/helpers/preview-server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const artifactsDir = path.join(repoRoot, 'artifacts');
const useLocalAssets = ['1', 'true', 'yes'].includes(String(process.env.USE_LOCAL_ASSETS || process.env.MEOWTAROT_OFFLINE || process.env.POSTER_CI_LOCAL_ASSETS || '').toLowerCase());

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
      assetPack: 'meow-v2',
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
        id: isReversed ? '01-the-fool-reversed' : '01-the-fool-upright',
        card_id: isReversed ? '01-the-fool-reversed' : '01-the-fool-upright',
        image: '/assets/cards/01-the-fool.jpg',
        orientation,
        title: 'The Fool',
        archetype: 'The Fool',
        imply: isReversed ? 'release, reset, trust' : 'new beginning, curiosity, trust',
        keywords: isReversed ? 'release, reset' : 'new beginning, curiosity',
        summary: isReversed ? 'Pause before the leap and regroup.' : 'A leap into the unknown.',
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

async function renderCase(page, baseUrl, testCase) {
  jsonLog('case_start', { case: testCase.name });
  const result = await page.evaluate(async ({ payload, origin }) => {
    try {
      const [{ findCardById }, data, mod] = await Promise.all([
        import('/js/reading-helpers.js'),
        import('/js/data.js'),
        import('/share/poster.js'),
      ]);

      const cardsUrl = `${origin}/data/cards.json`;
      let deckFetchBytes = 0;
      let deckFetchStatus = null;
      let deckFetchOk = false;
      try {
        const deckResponse = await fetch(cardsUrl, { method: 'GET' });
        const raw = await deckResponse.text();
        deckFetchBytes = raw.length;
        deckFetchStatus = deckResponse.status;
        deckFetchOk = deckResponse.ok;
      } catch (_) {
        // keep defaults
      }
      console.log(JSON.stringify({
        step: 'deck_fetch',
        url: cardsUrl,
        status: deckFetchStatus,
        ok: deckFetchOk,
        bytes: deckFetchBytes,
      }));

      const beforeCount = Array.isArray(data.meowTarotCards) ? data.meowTarotCards.length : 0;
      console.log(JSON.stringify({
        step: 'deck_sample',
        phase: 'before_load',
        count: beforeCount,
        ids: (data.meowTarotCards || []).slice(0, 5).map((card) => card?.id).filter(Boolean),
      }));

      await data.loadTarotData();

      const afterCount = Array.isArray(data.meowTarotCards) ? data.meowTarotCards.length : 0;
      console.log(JSON.stringify({
        step: 'deck_sample',
        phase: 'after_load',
        count: afterCount,
        ids: (data.meowTarotCards || []).slice(0, 5).map((card) => card?.id).filter(Boolean),
      }));

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
  }, { payload: testCase.payload, origin: baseUrl });

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

  const requestedPort = Number(process.env.DEBUG_POSTER_CI_PORT || 0);
  const previewServer = await startStaticPreviewServer({
    rootDir: repoRoot,
    defaultPath: '/share/index.html',
    port: Number.isFinite(requestedPort) ? requestedPort : 0,
  });

  let browser;
  try {
    const baseUrl = previewServer.baseUrl;
    jsonLog('env', { useLocalAssets, baseUrl, port: previewServer.port });

    if (useLocalAssets) {
      try {
        await stat(path.join(repoRoot, 'backgrounds'));
        jsonLog('local_assets', { backgrounds: 'present' });
      } catch {
        jsonLog('local_assets', { backgrounds: 'missing', note: 'background directory not found in repository' });
      }
    }

    try {
      browser = await chromium.launch({ headless: true });
    } catch (error) {
      const message = error?.message || String(error);
      if (/Executable doesn't exist/i.test(message)) {
        console.error('::error::Playwright Chromium executable is missing. Run `npx playwright install --with-deps chromium` before running scripts/debug-poster-ci.mjs.');
      }
      throw error;
    }

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
    await page.addInitScript(({ origin, offlineMode }) => {
      if (offlineMode) {
        window.MEOWTAROT_LOCAL_POSTER_ASSETS = true;
        window.MEOWTAROT_LOCAL_POSTER_ASSET_BASE = origin;
        window.MEOWTAROT_ASSET_BASE_URL = origin;
        window.MEOWTAROT_CDN_BASES = [origin];
        window.MEOWTAROT_ASSET_REVISION = 'offline-ci';
        return;
      }
      // Use CDN-first resolution for poster-debug assets, with local origin as fallback.
      // This avoids local /backgrounds/* 404s while still allowing local fallback probes.
      window.MEOWTAROT_ASSET_BASE_URL = 'https://cdn.meowtarot.com';
      window.MEOWTAROT_CDN_BASES = ['https://cdn.meowtarot.com', origin];
    }, { origin: baseUrl, offlineMode: useLocalAssets });

    await page.goto(`${baseUrl}/share/index.html`, { waitUntil: 'networkidle' });
    const debugFlag = await page.evaluate(() => Boolean(window.DEBUG_POSTER_CI));
    jsonLog('debug_flag', { enabled: debugFlag });

    for (const testCase of CASES) {
      await renderCase(page, baseUrl, testCase);
    }

    const hasPayloadOk = debugSteps.some((entry) => entry.step === 'payload_ok');
    const hasCardProbe = debugSteps.some((entry) => entry.step === 'img_probe' && entry.kind === 'card' && entry.ok === true);
    const hasDrawText = debugSteps.some((entry) => entry.step === 'draw_text' && entry.executed === true);
    const hasDrawCard = debugSteps.some((entry) => entry.step === 'draw_card' && entry.executed === true);
    if (!hasPayloadOk || !hasCardProbe || !hasDrawText || !hasDrawCard) {
      throw new Error(`Missing required poster debug steps: payload_ok=${hasPayloadOk}, card_img_probe=${hasCardProbe}, draw_text=${hasDrawText}, draw_card=${hasDrawCard}`);
    }

    jsonLog('done', { ok: true, artifactsDir: path.relative(repoRoot, artifactsDir) });
  } finally {
    await browser?.close();
    await previewServer.stop();
  }
}

main().catch((error) => {
  jsonLog('exception', { stage: 'script', message: error?.message || String(error) });
  process.exitCode = 1;
});
