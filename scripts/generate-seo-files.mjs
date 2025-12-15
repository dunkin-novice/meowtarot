import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

const BASE_URL = (process.env.BASE_URL || '').replace(/\/$/, '');
if (!BASE_URL) {
  console.error('BASE_URL environment variable is required (e.g., https://example.com)');
  process.exitCode = 1;
  throw new Error('BASE_URL is missing');
}

const EXCLUDE_QUERY_PAGES = String(process.env.EXCLUDE_QUERY_PAGES || '').toLowerCase() === 'true';
const SEPARATE_LANG_SITEMAPS = String(process.env.SEPARATE_LANG_SITEMAPS || '').toLowerCase() === 'true';

const LOCALES = [
  { code: 'en', prefix: '' },
  { code: 'th', prefix: 'th' },
];

const DEVLIKE_SEGMENTS = ['dev', 'draft', 'tests'];

function asPosix(p) {
  return p.split(path.sep).join('/');
}

function isDevLike(filePath) {
  return DEVLIKE_SEGMENTS.some((segment) => filePath.split(path.sep).includes(segment));
}

async function walkHtmlFiles(startDir) {
  const entries = await fs.readdir(startDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const absolutePath = path.join(startDir, entry.name);

    if (entry.isDirectory()) {
      if (isDevLike(absolutePath)) continue;
      files.push(...(await walkHtmlFiles(absolutePath)));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      if (entry.name === 'meanings.html') continue;
      if (isDevLike(absolutePath)) continue;
      const relative = asPosix(path.relative(ROOT_DIR, absolutePath));
      files.push(relative);
    }
  }

  return files;
}

async function loadCardSlugs() {
  const cardsPath = path.join(ROOT_DIR, 'data', 'cards.json');
  try {
    const raw = await fs.readFile(cardsPath, 'utf8');
    const data = JSON.parse(raw);
    const slugs = data
      .map((card) => card.card_id || card.id || card.slug)
      .filter(Boolean)
      .map(String);
    return { slugs, lastmod: (await fs.stat(cardsPath)).mtime };
  } catch (error) {
    console.warn('No card data found at data/cards.json; card-specific URLs will be skipped.');
    return { slugs: [], lastmod: undefined };
  }
}

function formatDate(date) {
  if (!date) return undefined;
  return date.toISOString().split('T')[0];
}

function buildUrl(loc, lastmod) {
  const lastmodTag = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : '';
  return `  <url>\n    <loc>${loc}</loc>${lastmodTag}\n  </url>`;
}

function renderUrlSet(urls) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(({ loc, lastmod }) => buildUrl(loc, lastmod)),
    '</urlset>',
    '',
  ].join('\n');
}

function renderSitemapIndex(entries) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map(
      ({ loc, lastmod }) => `  <sitemap>\n    <loc>${loc}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}\n  </sitemap>`
    ),
    '</sitemapindex>',
    '',
  ].join('\n');
}

async function buildStaticPages() {
  const htmlFiles = await walkHtmlFiles(ROOT_DIR);
  const urls = [];

  for (const file of htmlFiles) {
    const lastmod = formatDate((await fs.stat(path.join(ROOT_DIR, file))).mtime);
    const urlPath = file === 'index.html' ? '' : asPosix(file);
    urls.push({ loc: `${BASE_URL}/${urlPath}`, lastmod });
  }

  return urls;
}

function buildCardUrls(slugs, lastmod) {
  if (!slugs.length || EXCLUDE_QUERY_PAGES) return [];
  const lastmodDate = formatDate(lastmod);
  const urls = [];

  for (const { code, prefix } of LOCALES) {
    const basePath = prefix ? `${prefix}/tarot-card-meanings/` : 'tarot-card-meanings/';
    for (const slug of slugs) {
      const loc = `${BASE_URL}/${basePath}?card=${encodeURIComponent(slug)}`;
      urls.push({ loc, lastmod: lastmodDate, locale: code });
    }
  }

  return urls;
}

function splitByLocale(urls) {
  return {
    en: urls.filter((url) => !url.loc.includes('/th/')),
    th: urls.filter((url) => url.loc.includes('/th/')),
  };
}

async function writeFileIfChanged(targetPath, content) {
  try {
    const current = await fs.readFile(targetPath, 'utf8');
    if (current === content) return;
  } catch (error) {
    // File missing is fine; we'll write a new one.
  }
  await fs.writeFile(targetPath, content, 'utf8');
}

async function generate() {
  const [staticPages, cardData] = await Promise.all([buildStaticPages(), loadCardSlugs()]);
  const cardUrls = buildCardUrls(cardData.slugs, cardData.lastmod);
  const urlMap = new Map();

  for (const entry of [...staticPages, ...cardUrls]) {
    urlMap.set(entry.loc, entry);
  }

  const combinedUrls = Array.from(urlMap.values()).sort((a, b) => a.loc.localeCompare(b.loc));

  const targets = [];

  if (SEPARATE_LANG_SITEMAPS) {
    const split = splitByLocale(combinedUrls);
    const enContent = renderUrlSet(split.en.map(({ loc, lastmod }) => ({ loc, lastmod })));
    const thContent = renderUrlSet(split.th.map(({ loc, lastmod }) => ({ loc, lastmod })));

    await writeFileIfChanged(path.join(ROOT_DIR, 'sitemap-en.xml'), enContent);
    await writeFileIfChanged(path.join(ROOT_DIR, 'sitemap-th.xml'), thContent);

    targets.push({ filename: 'sitemap-en.xml', lastmod: formatDate(new Date()) });
    targets.push({ filename: 'sitemap-th.xml', lastmod: formatDate(new Date()) });

    const indexContent = renderSitemapIndex(
      targets.map(({ filename, lastmod }) => ({ loc: `${BASE_URL}/${filename}`, lastmod }))
    );
    await writeFileIfChanged(path.join(ROOT_DIR, 'sitemap.xml'), indexContent);
  } else {
    const urlsetContent = renderUrlSet(combinedUrls.map(({ loc, lastmod }) => ({ loc, lastmod })));
    await writeFileIfChanged(path.join(ROOT_DIR, 'sitemap.xml'), urlsetContent);
  }

  const sitemapUrls = SEPARATE_LANG_SITEMAPS
    ? ['sitemap.xml', 'sitemap-en.xml', 'sitemap-th.xml'].map((name) => `${BASE_URL}/${name}`)
    : [`${BASE_URL}/sitemap.xml`];

  const robotsLines = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /dev/',
    'Disallow: /draft/',
    ...sitemapUrls.map((url) => `Sitemap: ${url}`),
    '',
  ];
  await writeFileIfChanged(path.join(ROOT_DIR, 'robots.txt'), robotsLines.join('\n'));

  console.log('Generated sitemap and robots files.');
}

generate().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
