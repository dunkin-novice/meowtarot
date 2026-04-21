import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const BASE_URL = (process.env.BASE_URL || 'https://www.meowtarot.com').replace(/\/$/, '');

const SITEMAP_PATH = path.join(ROOT_DIR, 'sitemap.xml');

function parseLocs(xml = '') {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
}

async function readFileIfExists(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

async function loadSitemapUrls() {
  const sitemapXml = await fs.readFile(SITEMAP_PATH, 'utf8');
  const isIndex = /<sitemapindex[\s>]/.test(sitemapXml);

  if (!isIndex) return parseLocs(sitemapXml);

  const sitemapLocs = parseLocs(sitemapXml);
  const urls = [];

  for (const loc of sitemapLocs) {
    const fileName = loc.replace(`${BASE_URL}/`, '');
    const localPath = path.join(ROOT_DIR, fileName);
    const content = await readFileIfExists(localPath);
    if (!content) continue;
    urls.push(...parseLocs(content));
  }

  return urls;
}

function expectedCardUrls(slugs = []) {
  const urls = [];
  for (const slug of slugs) {
    urls.push(`${BASE_URL}/cards/${slug}/`);
    urls.push(`${BASE_URL}/th/cards/${slug}/`);
  }
  return urls;
}

async function main() {
  const enCardsDir = path.join(ROOT_DIR, 'cards');
  const slugs = (await fs.readdir(enCardsDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const expected = expectedCardUrls(slugs);

  const sitemapUrls = await loadSitemapUrls();
  const uniqueSitemapUrls = [...new Set(sitemapUrls)];

  const errors = [];
  const warnings = [];

  if (uniqueSitemapUrls.length !== sitemapUrls.length) {
    errors.push(`Duplicate URLs found in sitemap set: ${sitemapUrls.length - uniqueSitemapUrls.length}`);
  }

  const templateUrls = new Set([
    `${BASE_URL}/tarot-card-meanings/card.html`,
    `${BASE_URL}/th/tarot-card-meanings/card.html`,
  ]);
  templateUrls.forEach((url) => {
    if (uniqueSitemapUrls.includes(url)) errors.push(`Template URL should not be indexed: ${url}`);
  });

  const missingExpected = expected.filter((url) => !uniqueSitemapUrls.includes(url));
  if (missingExpected.length) {
    errors.push(`Missing expected tarot URLs in sitemap: ${missingExpected.length}`);
    missingExpected.slice(0, 10).forEach((url) => errors.push(`  - ${url}`));
  }

  const blockedNoindexUrls = [
    `${BASE_URL}/reading.html`,
    `${BASE_URL}/th/reading.html`,
    `${BASE_URL}/question.html`,
    `${BASE_URL}/th/question.html`,
    `${BASE_URL}/full.html`,
    `${BASE_URL}/th/full.html`,
  ];
  blockedNoindexUrls.forEach((url) => {
    if (uniqueSitemapUrls.includes(url)) errors.push(`Noindex URL should not be in sitemap: ${url}`);
  });

  const extraCardLike = uniqueSitemapUrls.filter((url) =>
    url.startsWith(`${BASE_URL}/cards/`) || url.startsWith(`${BASE_URL}/th/cards/`)
  );

  const expectedSet = new Set(expected);
  const unexpectedCardUrls = extraCardLike.filter((url) => {
    if (expectedSet.has(url)) return false;
    return /\/cards\/.+\/$/.test(url);
  });

  if (unexpectedCardUrls.length) {
    errors.push(`Unexpected tarot card-like URLs in sitemap: ${unexpectedCardUrls.length}`);
    unexpectedCardUrls.slice(0, 10).forEach((url) => errors.push(`  - ${url}`));
  }

  for (const slug of slugs) {
    const en = `${BASE_URL}/cards/${slug}/`;
    const th = `${BASE_URL}/th/cards/${slug}/`;
    if (uniqueSitemapUrls.includes(en) !== uniqueSitemapUrls.includes(th)) {
      errors.push(`Missing EN/TH parity for slug ${slug}`);
    }
  }

  if (warnings.length) {
    console.warn(`Warnings (${warnings.length}):`);
    warnings.slice(0, 10).forEach((w) => console.warn(`- ${w}`));
    if (warnings.length > 10) console.warn(`- ... ${warnings.length - 10} more warnings`);
  }

  if (errors.length) {
    console.error('SEO coverage validation failed:');
    errors.forEach((e) => console.error(`- ${e}`));
    process.exitCode = 1;
    return;
  }

  console.log(`SEO coverage validation passed for ${slugs.length} tarot slugs (${expected.length} localized URLs).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
