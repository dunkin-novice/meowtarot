import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BASE_URL = (process.env.BASE_URL || 'https://www.meowtarot.com').replace(/\/$/, '');

function normalizeSlug(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildShimHtml({ lang, slug }) {
  const isThai = lang === 'th';
  const canonicalPath = isThai ? `/th/cards/${slug}/` : `/cards/${slug}/`;
  const canonicalUrl = `${BASE_URL}${canonicalPath}`;
  const title = isThai ? 'กำลังย้ายหน้า… | MeowTarot' : 'Redirecting… | MeowTarot';
  const description = isThai
    ? 'หน้านี้ถูกย้ายไป URL ใหม่ของไพ่ทาโรต์'
    : 'This legacy page has moved to the canonical tarot card URL.';
  const message = isThai
    ? `กำลังพาคุณไปที่ ${canonicalPath}`
    : `Redirecting you to ${canonicalPath}`;

  return `<!DOCTYPE html>
<html lang="${isThai ? 'th' : 'en'}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <meta name="robots" content="noindex, follow" />
  <link rel="canonical" href="${canonicalUrl}" />
  <meta http-equiv="refresh" content="0;url=${canonicalPath}" />
</head>
<body>
  <main>
    <h1>${isThai ? 'ย้ายหน้าความหมายไพ่แล้ว' : 'Legacy tarot card URL moved'}</h1>
    <p>${message}</p>
    <p><a href="${canonicalPath}">${isThai ? 'ไปยังหน้าไพ่หลัก' : 'Open canonical card page'}</a></p>
  </main>
  <script>window.location.replace(${JSON.stringify(canonicalPath)});</script>
</body>
</html>
`;
}

async function writeShim(lang, slug) {
  const dir = lang === 'th'
    ? path.join(ROOT, 'th', 'tarot-card-meanings', `${slug}-tarot-meaning`)
    : path.join(ROOT, 'tarot-card-meanings', `${slug}-tarot-meaning`);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'index.html'), buildShimHtml({ lang, slug }), 'utf8');
}

async function run() {
  const enCardsDir = path.join(ROOT, 'cards');
  const slugs = (await fs.readdir(enCardsDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => normalizeSlug(entry.name))
    .filter(Boolean)
    .sort();

  for (const slug of slugs) {
    await writeShim('en', slug);
    await writeShim('th', slug);
  }

  console.log(`Generated ${slugs.length * 2} legacy card URL shim pages.`);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
