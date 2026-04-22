import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'data', 'cards.json');
const EN_TEMPLATE_PATH = path.join(ROOT, 'cards', 'the-fool', 'index.html');
const TH_TEMPLATE_PATH = path.join(ROOT, 'th', 'cards', 'the-fool', 'index.html');
const JS_TEMPLATE_PATH = path.join(ROOT, 'js', 'pages', 'the-fool-card.js');
const ROUTES_PATH = path.join(ROOT, 'js', 'canonical-card-routes.js');
const BASE_URL = (process.env.BASE_URL || 'https://www.meowtarot.com').replace(/\/$/, '');

function normalizeSlug(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-(upright|reversed)(?=-|$)/g, '')
    .replace(/-tarot-meaning$/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getCardNumber(card = {}) {
  const match = String(card.card_id || '').match(/^(\d{2})/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function pickDisplayCards(cards = []) {
  const bySlug = new Map();
  for (const card of cards) {
    const slug = normalizeSlug(card.seo_slug_en || card.card_id || card.card_name_en);
    if (!slug) continue;
    const current = bySlug.get(slug);
    const cardIsUpright = String(card.orientation || 'upright').toLowerCase() !== 'reversed';
    if (!current || cardIsUpright) {
      bySlug.set(slug, card);
    }
  }

  return [...bySlug.entries()]
    .map(([slug, card]) => ({ slug, card }))
    .sort((a, b) => getCardNumber(a.card) - getCardNumber(b.card));
}

function escAttr(value = '') {
  return String(value || '').replace(/"/g, '&quot;');
}

function escText(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function setTagContent(html, tag, value) {
  return html.replace(new RegExp(`(<${tag}[^>]*>)([\\s\\S]*?)(</${tag}>)`, 'i'), `$1${escText(value)}$3`);
}

function setMetaByData(html, key, value) {
  const escaped = escAttr(value);
  return html
    .replace(new RegExp(`(<meta[^>]*data-card-meta=\"${key}\"[^>]*content=\")[^\"]*(\"[^>]*>)`, 'i'), `$1${escaped}$2`)
    .replace(new RegExp(`(<meta[^>]*content=\")[^\"]*(\"[^>]*data-card-meta=\"${key}\"[^>]*>)`, 'i'), `$1${escaped}$2`);
}

function setLinkByData(html, key, value) {
  const escaped = escAttr(value);
  return html
    .replace(new RegExp(`(<link[^>]*data-card-meta=\"${key}\"[^>]*href=\")[^\"]*(\"[^>]*>)`, 'i'), `$1${escaped}$2`)
    .replace(new RegExp(`(<link[^>]*href=\")[^\"]*(\"[^>]*data-card-meta=\"${key}\"[^>]*>)`, 'i'), `$1${escaped}$2`);
}

function setIdText(html, id, value) {
  return html.replace(new RegExp(`(<[^>]*id=\"${id}\"[^>]*>)([\\s\\S]*?)(</[^>]+>)`, 'i'), `$1${escText(value)}$3`);
}

function setScriptSrc(html, slug) {
  return html.replace(/(<script[^>]*type="module"[^>]*src=")[^"]+("[^>]*><\/script>)/i, `$1/js/pages/${slug}-card.js$2`);
}

function setCurrentCrumb(html, value) {
  return html.replace(/(<li aria-current="page">)([\s\S]*?)(<\/li>)/i, `$1${escText(value)}$3`);
}

function setNextLink(html, { href, text }) {
  return html
    .replace(/(<a id="footerNextLink"[^>]*href=")[^"]*("[^>]*>)[\s\S]*?(<\/a>)/i, `$1${href}$2${escText(text)}$3`);
}

function buildTitles(card, lang) {
  const isThai = lang === 'th';
  const enName = card.card_name_en || 'Tarot Card';
  const thName = card.alias_th || card.name_th || enName || 'ไพ่ทาโรต์';
  return isThai
    ? `ความหมายไพ่ ${thName} (ไพ่ตั้งตรงและกลับหัว) | MeowTarot`
    : `${enName} Meaning (Upright & Reversed) | MeowTarot`;
}

function buildDescriptions(card, lang) {
  if (lang === 'th') return card.meta_description_th || card.meta_description_en || '';
  return card.meta_description_en || card.meta_description_th || '';
}

function applyPageTemplate(template, { card, slug, lang, nextSlug, nextNameEn }) {
  const isThai = lang === 'th';
  const pageUrl = isThai ? `${BASE_URL}/th/cards/${slug}/` : `${BASE_URL}/cards/${slug}/`;
  const title = buildTitles(card, lang);
  const description = buildDescriptions(card, lang);
  const name = isThai ? (card.alias_th || card.card_name_en || 'ไพ่ทาโรต์') : (card.card_name_en || card.alias_th || 'Tarot Card');

  let html = template;
  html = setTagContent(html, 'title', title);
  html = setMetaByData(html, 'description', description);
  html = setMetaByData(html, 'og-title', title);
  html = setMetaByData(html, 'og-description', description);
  html = setMetaByData(html, 'og-url', pageUrl);
  html = setMetaByData(html, 'twitter-title', title);
  html = setMetaByData(html, 'twitter-description', description);
  html = setLinkByData(html, 'canonical', pageUrl);
  html = html.replace(/(<link rel="alternate" href=")[^"]*(" hreflang="en"\s*\/?>)/i, `$1${BASE_URL}/cards/${slug}/$2`);
  html = html.replace(/(<link rel="alternate" href=")[^"]*(" hreflang="th-TH"\s*\/?>)/i, `$1${BASE_URL}/th/cards/${slug}/$2`);
  html = html.replace(/(<link rel="alternate" href=")[^"]*(" hreflang="x-default"\s*\/?>)/i, `$1${BASE_URL}/cards/${slug}/$2`);
  html = setCurrentCrumb(html, name);
  html = setIdText(html, 'cardNameHeading', name);
  html = setScriptSrc(html, slug);
  html = setNextLink(html, {
    href: isThai ? `/th/cards/${nextSlug}/` : `/cards/${nextSlug}/`,
    text: `${nextNameEn} →`,
  });
  return html;
}

function applyJsTemplate(template, { slug, cardIdPrefix, nextSlug }) {
  return template
    .replace("const CARD_ID_PREFIX = '01-the-fool';", `const CARD_ID_PREFIX = '${cardIdPrefix}';`)
    .replace(/getCanonicalCardPath\('the-fool', lang\) \|\| \(lang === 'th' \? '\/th\/cards\/the-fool\/' : '\/cards\/the-fool\/'\)/, `getCanonicalCardPath('${slug}', lang) || (lang === 'th' ? '/th/cards/${slug}/' : '/cards/${slug}/')`)
    .replace("CANONICAL_CARD_ORDER.indexOf('the-fool')", `CANONICAL_CARD_ORDER.indexOf('${slug}')`)
    .replace("const fallbackNext = localize('/cards/the-magician/');", `const fallbackNext = localize('/cards/${nextSlug}/');`);
}

async function writeIfMissing(filePath, content) {
  try {
    await fs.access(filePath);
    return false;
  } catch {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf8');
    return true;
  }
}

function renderCanonicalRoutes(slugs) {
  const quoted = slugs.map((slug) => `  '${slug}',`).join('\n');
  return [
    `const CANONICAL_CARD_SLUGS = new Set([`,
    quoted,
    `]);`,
    ``,
    `export const CANONICAL_CARD_ORDER = Object.freeze([`,
    quoted,
    `]);`,
    ``,
    `export function normalizeCanonicalSlug(slug = '') {`,
    `  return String(slug || '')`,
    `    .trim()`,
    `    .toLowerCase()`,
    `    .replace(/[^a-z0-9-]+/g, '-')`,
    `    .replace(/-+/g, '-')`,
    `    .replace(/-(upright|reversed)(?=-|$)/g, '')`,
    `    .replace(/-tarot-meaning$/, '')`,
    `    .replace(/^-+|-+$/g, '');`,
    `}`,
    ``,
    `export function isCanonicalCardSlug(slug = '') {`,
    `  return CANONICAL_CARD_SLUGS.has(normalizeCanonicalSlug(slug));`,
    `}`,
    ``,
    `export function getCanonicalCardPath(slug = '', lang = 'en') {`,
    `  const normalized = normalizeCanonicalSlug(slug);`,
    `  if (!isCanonicalCardSlug(normalized)) return null;`,
    `  const prefix = lang === 'th' ? '/th' : '';`,
    `  return prefix + '/cards/' + normalized + '/';`,
    `}`,
    ``,
    `export function getCanonicalCardUrl(slug = '', lang = 'en') {`,
    `  const path = getCanonicalCardPath(slug, lang);`,
    `  if (!path) return null;`,
    `  return 'https://www.meowtarot.com' + path;`,
    `}`,
    ``,
  ].join('\n');
}

async function run() {
  const [rawCards, enTemplate, thTemplate, jsTemplate] = await Promise.all([
    fs.readFile(DATA_PATH, 'utf8'),
    fs.readFile(EN_TEMPLATE_PATH, 'utf8'),
    fs.readFile(TH_TEMPLATE_PATH, 'utf8'),
    fs.readFile(JS_TEMPLATE_PATH, 'utf8'),
  ]);

  const parsed = JSON.parse(rawCards);
  const cards = Array.isArray(parsed) ? parsed : (parsed.cards || []);
  const ordered = pickDisplayCards(cards);
  const slugs = ordered.map((entry) => entry.slug);

  let createdPages = 0;
  let createdScripts = 0;

  for (let i = 0; i < ordered.length; i += 1) {
    const { slug, card } = ordered[i];
    const next = ordered[(i + 1) % ordered.length];
    const cardIdPrefix = String(card.card_id || '').replace(/-(upright|reversed)$/i, '');

    const enHtml = applyPageTemplate(enTemplate, {
      card,
      slug,
      lang: 'en',
      nextSlug: next.slug,
      nextNameEn: next.card.card_name_en || 'Next card',
    });
    const thHtml = applyPageTemplate(thTemplate, {
      card,
      slug,
      lang: 'th',
      nextSlug: next.slug,
      nextNameEn: next.card.card_name_en || 'Next card',
    });

    if (await writeIfMissing(path.join(ROOT, 'cards', slug, 'index.html'), enHtml)) createdPages += 1;
    if (await writeIfMissing(path.join(ROOT, 'th', 'cards', slug, 'index.html'), thHtml)) createdPages += 1;

    const jsOut = applyJsTemplate(jsTemplate, {
      slug,
      cardIdPrefix,
      nextSlug: next.slug,
    });
    if (await writeIfMissing(path.join(ROOT, 'js', 'pages', `${slug}-card.js`), jsOut)) createdScripts += 1;
  }

  await fs.writeFile(ROUTES_PATH, renderCanonicalRoutes(slugs), 'utf8');

  console.log(`Created ${createdPages} localized premium pages and ${createdScripts} page scripts across ${ordered.length} slugs.`);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
