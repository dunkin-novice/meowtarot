import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { startStaticPreviewServer } from './helpers/preview-server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const externalTargetUrl = process.env.TARGET_URL;
let previewServer;

let baseUrl = externalTargetUrl;

test.beforeAll(async () => {
  if (externalTargetUrl) return;
  previewServer = await startStaticPreviewServer({ rootDir: repoRoot, defaultPath: '/index.html' });
  baseUrl = previewServer.baseUrl;
});

test.afterAll(async () => {
  await previewServer?.stop();
  previewServer = null;
});

test('language persists across daily flow and can be switched back', async ({ page }) => {
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

  await page.locator('.lang-btn[data-lang="th"]').first().click();
  await expect(page).toHaveURL(/\/th\//);

  await page.getByRole('link', { name: 'ดูดวงรายวัน' }).first().click();
  await expect(page).toHaveURL(/\/th\/daily\.html/);

  await page.locator('#daily-deal-shuffle').click();
  await page.waitForTimeout(1800);
  await page.locator('#daily-board .card-slot').first().click();
  await page.locator('#daily-continue').click();

  await expect(page).toHaveURL(/\/th\/reading\.html\?.*lang=th/);
  await expect(page.locator('#readingTitle')).toHaveText('ดูดวงรายวัน');

  await page.goBack({ waitUntil: 'domcontentloaded' });
  await page.goBack({ waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/th\/?$/);

  await page.locator('.lang-btn[data-lang="en"]').first().click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('link', { name: 'Daily Reading' }).first()).toBeVisible();
});
