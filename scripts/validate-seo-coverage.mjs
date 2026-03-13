import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const BASE_URL = (process.env.BASE_URL || 'https://www.meowtarot.com').replace(/\/$/, '');

const CARD_DATA_PATH = path.join(ROOT_DIR, 'data', 'cards.json');
const SITEMAP_PATH = path.join(ROOT_DIR, 'sitemap.xml');

function normalizeSlug(value = '') {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized
    .replace(/-(upright|reversed)(?=-|$)/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

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
    urls.push(`${BASE_URL}/tarot-card-meanings/${slug}/`);
    urls.push(`${BASE_URL}/th/tarot-card-meanings/${slug}/`);
  }
  return urls;
}

function getAttrTagValue(html = '', selector = '', attr = 'href') {
  const pattern = new RegExp(`<[^>]*data-card-meta="${selector}"[^>]*${attr}="([^"]*)"[^>]*>`, 'i');
  const m = html.match(pattern);
  return m ? m[1].trim() : '';
}

function getMetaContent(html = '', selector = '') {
  return getAttrTagValue(html, selector, 'content');
}

async function validateGeneratedPageMeta(slugs = []) {
  const errors = [];
  const warnings = [];

  for (const slug of slugs) {
    const pairs = [
      {
        lang: 'en',
        file: path.join(ROOT_DIR, 'tarot-card-meanings', slug, 'index.html'),
        canonical: `${BASE_URL}/tarot-card-meanings/${slug}/`,
        hreflangEn: `${BASE_URL}/tarot-card-meanings/${slug}/`,
        hreflangTh: `${BASE_URL}/th/tarot-card-meanings/${slug}/`,
      },
      {
        lang: 'th',
        file: path.join(ROOT_DIR, 'th', 'tarot-card-meanings', slug, 'index.html'),
        canonical: `${BASE_URL}/th/tarot-card-meanings/${slug}/`,
        hreflangEn: `${BASE_URL}/tarot-card-meanings/${slug}/`,
        hreflangTh: `${BASE_URL}/th/tarot-card-meanings/${slug}/`,
      },
    ];

    for (const pair of pairs) {
      const html = await readFileIfExists(pair.file);
      if (!html) {
        warnings.push(`Generated page missing for meta validation: ${pair.file}`);
        continue;
      }

      const canonical = getAttrTagValue(html, 'canonical', 'href');
      const hreflangEn = getAttrTagValue(html, 'hreflang-en', 'href');
      const hreflangTh = getAttrTagValue(html, 'hreflang-th', 'href');
      const description = getMetaContent(html, 'description');

      if (canonical !== pair.canonical) {
        errors.push(`[${pair.lang}] canonical mismatch for ${slug}: ${canonical} !== ${pair.canonical}`);
      }
      if (hreflangEn !== pair.hreflangEn) {
        errors.push(`[${pair.lang}] hreflang-en mismatch for ${slug}: ${hreflangEn} !== ${pair.hreflangEn}`);
      }
      if (hreflangTh !== pair.hreflangTh) {
        errors.push(`[${pair.lang}] hreflang-th mismatch for ${slug}: ${hreflangTh} !== ${pair.hreflangTh}`);
      }
      if (!description) {
        errors.push(`[${pair.lang}] meta description missing for ${slug}`);
      }
    }
  }

  return { errors, warnings };
}

async function main() {
  const raw = await fs.readFile(CARD_DATA_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  const cards = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.cards) ? parsed.cards : [];

  const slugs = [...new Set(cards.map((card) => normalizeSlug(card.seo_slug_en)).filter(Boolean))].sort();
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

  const extraCardLike = uniqueSitemapUrls.filter((url) =>
    url.startsWith(`${BASE_URL}/tarot-card-meanings/`) || url.startsWith(`${BASE_URL}/th/tarot-card-meanings/`)
  );

  const expectedSet = new Set(expected);
  const unexpectedCardUrls = extraCardLike.filter((url) => {
    if (expectedSet.has(url)) return false;
    return /\/tarot-card-meanings\/.+\/$/.test(url);
  });

  if (unexpectedCardUrls.length) {
    errors.push(`Unexpected tarot card-like URLs in sitemap: ${unexpectedCardUrls.length}`);
    unexpectedCardUrls.slice(0, 10).forEach((url) => errors.push(`  - ${url}`));
  }

  for (const slug of slugs) {
    const en = `${BASE_URL}/tarot-card-meanings/${slug}/`;
    const th = `${BASE_URL}/th/tarot-card-meanings/${slug}/`;
    if (uniqueSitemapUrls.includes(en) !== uniqueSitemapUrls.includes(th)) {
      errors.push(`Missing EN/TH parity for slug ${slug}`);
    }
  }

  const metaValidation = await validateGeneratedPageMeta(slugs);
  errors.push(...metaValidation.errors);
  warnings.push(...metaValidation.warnings);

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
