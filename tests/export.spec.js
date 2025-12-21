import { mkdirSync } from 'node:fs';
import { test } from '@playwright/test';

const baseUrl = process.env.TARGET_URL || 'https://www.meowtarot.com/reading.html';
const targetUrl = baseUrl.includes('selftest=1')
  ? baseUrl
  : `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}selftest=1`;

function log(label, payload) {
  // eslint-disable-next-line no-console
  console.log(`${label}:`, typeof payload === 'string' ? payload : JSON.stringify(payload));
}

test('export self-test captures diagnostics', async ({ page }) => {
  mkdirSync('artifacts', { recursive: true });

  page.on('console', (msg) => {
    const text = msg.text();
    if (!/favicon\.ico/.test(text)) log('[console]', text);
  });

  await page.goto(targetUrl, { waitUntil: 'networkidle' });
  await page.waitForLoadState('networkidle');

  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    const imgs = Array.from(document.images);
    await Promise.all(
      imgs.map(async (img) => {
        if (img.decode) {
          try { await img.decode(); } catch (err) { console.warn('decode failed', err); }
        } else if (!img.complete) {
          await new Promise((resolve) => {
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
          });
        }
      }),
    );
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });

  const selfTest = await page.evaluate(async () => {
    if (window.__RUN_EXPORT_SELFTEST__) return window.__RUN_EXPORT_SELFTEST__();
    if (window.runExportSelfTest) return window.runExportSelfTest('#share-card');
    return { ok: false, reason: 'selftest-hook-missing' };
  });
  log('SELFTEST_JSON', selfTest);

  const visibility = await page.evaluate(() => {
    const target = document.querySelector('#share-card')
      || document.querySelector('#reading-content')
      || document.querySelector('.reading-content');
    if (!target) return { found: false };
    const rect = target.getBoundingClientRect();
    const cs = getComputedStyle(target);
    return {
      found: true,
      width: rect.width,
      height: rect.height,
      display: cs.display,
      visibility: cs.visibility,
      opacity: cs.opacity,
      hidden:
        rect.width === 0
        || rect.height === 0
        || cs.display === 'none'
        || cs.visibility === 'hidden'
        || Number(cs.opacity || '1') === 0,
    };
  });
  log('TARGET_VISIBILITY', visibility);

  const corsUrls = await page.evaluate(() => {
    const target = document.querySelector('#share-card')
      || document.querySelector('#reading-content')
      || document.querySelector('.reading-content');
    if (!target) return [];
    return Array.from(target.querySelectorAll('img'))
      .map((img) => img.currentSrc || img.src)
      .filter((src) => {
        try {
          const url = new URL(src, window.location.href);
          return url.origin !== window.location.origin;
        } catch (err) {
          console.warn('url parse failed', err);
          return false;
        }
      });
  });
  log('CROSS_ORIGIN_IMAGES', corsUrls);

  const exportResult = await page.evaluate(async () => {
    try {
      if (window.__CLICK_EXPORT__) {
        await window.__CLICK_EXPORT__();
        return 'clicked-selftest-hook';
      }
      const btn = document.getElementById('btn-save-image')
        || document.getElementById('saveBtn')
        || document.querySelector('button[id*="save" i]')
        || Array.from(document.querySelectorAll('button')).find((node) => /save/i.test(node.textContent || ''));
      if (btn) {
        btn.click();
        return 'clicked-fallback';
      }
      return 'export-button-missing';
    } catch (err) {
      return `export-click-error:${err?.message || err}`;
    }
  });
  log('EXPORT_TRIGGER', exportResult);

  await page.screenshot({ path: 'artifacts/export-after-click.png', fullPage: true });
});
