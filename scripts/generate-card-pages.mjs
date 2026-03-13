import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const CARDS_PATH = path.join(ROOT, 'data', 'cards.json');
const EN_TEMPLATE_PATH = path.join(ROOT, 'tarot-card-meanings', 'card.html');
const TH_TEMPLATE_PATH = path.join(ROOT, 'th', 'tarot-card-meanings', 'card.html');

const BASE_URL = (process.env.BASE_URL || 'https://www.meowtarot.com').replace(/\/$/, '');
const DRY_RUN = process.argv.includes('--dry-run');

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

function asArray(input) {
  if (Array.isArray(input)) return input;
  if (Array.isArray(input?.cards)) return input.cards;
  return [];
}

function pickCardBySlug(cards, slug) {
  const matches = cards.filter((card) => normalizeSlug(card.seo_slug_en) === slug);
  if (!matches.length) return null;
  return (
    matches.find((card) => String(card.orientation || '').toLowerCase() !== 'reversed')
    || matches[0]
  );
}

function replaceMetaContent(html, selector, value) {
  if (!value) return html;
  const escaped = String(value).replace(/"/g, '&quot;');
  const pattern = new RegExp(`(<meta[^>]*data-card-meta="${selector}"[^>]*content=")([^"]*)(")`);
  if (pattern.test(html)) {
    return html.replace(pattern, `$1${escaped}$3`);
  }
  return html;
}

function replaceLinkHref(html, selector, value) {
  if (!value) return html;
  const escaped = String(value).replace(/"/g, '&quot;');
  const pattern = new RegExp(`(<link[^>]*data-card-meta="${selector}"[^>]*href=")([^"]*)(")`);
  if (pattern.test(html)) {
    return html.replace(pattern, `$1${escaped}$3`);
  }
  return html;
}

function replaceTagText(html, selector, value) {
  if (!value) return html;
  const escaped = String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const pattern = new RegExp(`(<title[^>]*data-card-meta="${selector}"[^>]*>)([\\s\\S]*?)(</title>)`);
  if (pattern.test(html)) {
    return html.replace(pattern, `$1${escaped}$3`);
  }
  return html;
}

function buildUrls(slug) {
  return {
    en: `${BASE_URL}/tarot-card-meanings/${slug}/`,
    th: `${BASE_URL}/th/tarot-card-meanings/${slug}/`,
  };
}

function applySeo(template, card, slug, lang) {
  const urls = buildUrls(slug);
  const isThai = lang === 'th';

  const description = isThai
    ? card.meta_description_th || card.meta_description_en || ''
    : card.meta_description_en || card.meta_description_th || '';

  const title = isThai
    ? `${card.alias_th || card.card_name_en || 'ไพ่ทาโรต์'} ความหมายไพ่ทาโรต์ | MeowTarot`
    : `${card.card_name_en || 'Tarot Card'} Tarot Meaning | MeowTarot`;

  let html = template;
  html = replaceTagText(html, 'title', title);
  html = replaceMetaContent(html, 'description', description);
  html = replaceMetaContent(html, 'og-title', title);
  html = replaceMetaContent(html, 'og-description', description);
  html = replaceMetaContent(html, 'twitter-title', title);
  html = replaceMetaContent(html, 'twitter-description', description);
  html = replaceMetaContent(html, 'og-url', isThai ? urls.th : urls.en);
  html = replaceLinkHref(html, 'canonical', isThai ? urls.th : urls.en);
  html = replaceLinkHref(html, 'hreflang-en', urls.en);
  html = replaceLinkHref(html, 'hreflang-th', urls.th);
  html = replaceLinkHref(html, 'hreflang-x', urls.en);

  return html;
}

async function ensureWrite(filePath, content) {
  if (DRY_RUN) return;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

async function run() {
  const [cardsRaw, enTemplate, thTemplate] = await Promise.all([
    fs.readFile(CARDS_PATH, 'utf8'),
    fs.readFile(EN_TEMPLATE_PATH, 'utf8'),
    fs.readFile(TH_TEMPLATE_PATH, 'utf8'),
  ]);

  const cards = asArray(JSON.parse(cardsRaw));
  const slugs = [...new Set(cards.map((card) => normalizeSlug(card.seo_slug_en)).filter(Boolean))].sort();

  if (!slugs.length) {
    console.log('No seo_slug_en values found. No pages generated.');
    return;
  }

  let generated = 0;

  for (const slug of slugs) {
    const card = pickCardBySlug(cards, slug);
    if (!card) continue;

    const enHtml = applySeo(enTemplate, card, slug, 'en');
    const thHtml = applySeo(thTemplate, card, slug, 'th');

    const enOut = path.join(ROOT, 'tarot-card-meanings', slug, 'index.html');
    const thOut = path.join(ROOT, 'th', 'tarot-card-meanings', slug, 'index.html');

    await ensureWrite(enOut, enHtml);
    await ensureWrite(thOut, thHtml);
    generated += 2;
  }

  console.log(`${DRY_RUN ? '[dry-run] ' : ''}Generated ${generated} card pages (${slugs.length} slugs x EN/TH).`);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
