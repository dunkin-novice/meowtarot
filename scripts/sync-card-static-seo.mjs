import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'data', 'cards.json');

function normalizeSlug(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-(upright|reversed)$/g, '')
    .replace(/-tarot-meaning$/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function pickCards(cards) {
  const map = new Map();
  for (const card of cards) {
    const slug = normalizeSlug(card.seo_slug_en);
    if (!slug) continue;
    const current = map.get(slug);
    if (!current || String(card.orientation || '').toLowerCase() !== 'reversed') {
      map.set(slug, card);
    }
  }
  return map;
}

function escHtml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function replaceById(html, id, value) {
  const safe = escHtml(value);
  const pattern = new RegExp(`(<[^>]*id=["']${id}["'][^>]*>)([\\s\\S]*?)(<\/[^>]+>)`, 'i');
  return html.replace(pattern, `$1${safe}$3`);
}



function replaceMetaContent(html, selector, value) {
  if (!value) return html;
  const escaped = String(value).replace(/"/g, '&quot;');
  const withMetaFirst = new RegExp(`(<meta[^>]*data-card-meta="${selector}"[^>]*\scontent=")[^"]*(")`, 'i');
  if (withMetaFirst.test(html)) return html.replace(withMetaFirst, `$1${escaped}$2`);

  const withContentFirst = new RegExp(`(<meta[^>]*\scontent=")[^"]*("[^>]*data-card-meta="${selector}"[^>]*>)`, 'i');
  if (withContentFirst.test(html)) return html.replace(withContentFirst, `$1${escaped}$2`);

  return html;
}

function replaceTitleText(html, value) {
  if (!value) return html;
  const escaped = escHtml(value);
  const pattern = /(<title[^>]*data-card-meta="title"[^>]*>)([\s\S]*?)(<\/title>)/i;
  return pattern.test(html) ? html.replace(pattern, `$1${escaped}$3`) : html;
}

function buildThaiSeoTitle(card, mode = 'both') {
  const displayName = card.alias_th || card.card_name_en || 'ไพ่ทาโรต์';
  const suffix = mode === 'single' ? 'ไพ่ตั้งตรง' : 'ไพ่ตั้งตรงและกลับหัว';
  return `ความหมายไพ่ ${displayName} (${suffix}) | MeowTarot`;
}
function injectFaqSection(html, lang, card) {
  if (html.includes('id="seoFaqSection"')) return html;
  const isThai = lang === 'th';
  const displayName = isThai ? (card.alias_th || card.card_name_en || 'ไพ่ทาโรต์') : (card.card_name_en || card.alias_th || 'Tarot Card');
  const tarotImply = isThai ? (card.tarot_imply_th || card.tarot_imply_en || '') : (card.tarot_imply_en || card.tarot_imply_th || '');
  const summary = isThai ? (card.reading_summary_preview_th || card.reading_summary_preview_en || '') : (card.reading_summary_preview_en || card.reading_summary_preview_th || '');
  const light = card.keywords_light || '';
  const shadow = card.keywords_shadow || '';

  const section = `\n\n      <section class="section-block" id="seoFaqSection">\n        <h2>${isThai ? 'คำตอบแบบเร็ว' : 'Quick answers'}</h2>\n        <dl>\n          <dt>${isThai ? `ความหมายหลักของไพ่ ${escHtml(displayName)} คืออะไร?` : `What is the core meaning of ${escHtml(displayName)}?`}</dt>\n          <dd>${escHtml(tarotImply)}</dd>\n          <dt>${isThai ? `${escHtml(displayName)} สื่อถึงอะไรในการเปิดไพ่?` : `What does ${escHtml(displayName)} suggest in a reading?`}</dt>\n          <dd>${escHtml(summary)}</dd>\n          <dt>${isThai ? `คีย์เวิร์ดสำคัญของ ${escHtml(displayName)} คืออะไร?` : `What are the key themes of ${escHtml(displayName)}?`}</dt>\n          <dd>${isThai ? `ด้านสว่าง: ${escHtml(light)} | ด้านเงา: ${escHtml(shadow)}` : `Light: ${escHtml(light)} | Shadow: ${escHtml(shadow)}`}</dd>\n        </dl>\n      </section>`;

  return html.replace(/\n\s*<section class="section-block" id="microCta">/, `${section}\n\n      <section class="section-block" id="microCta">`);
}

async function updateFile(filePath, card, lang) {
  let html = await fs.readFile(filePath, 'utf8');
  const isThai = lang === 'th';

  const archetype = isThai ? (card.archetype_th || card.archetype_en || '') : (card.archetype_en || card.archetype_th || '');
  const imply = isThai ? (card.tarot_imply_th || card.tarot_imply_en || '') : (card.tarot_imply_en || card.tarot_imply_th || '');
  const summary = isThai ? (card.reading_summary_preview_th || card.reading_summary_preview_en || '') : (card.reading_summary_preview_en || card.reading_summary_preview_th || '');

  html = replaceById(html, 'cardArchetype', `${isThai ? 'อาร์คีไทป์' : 'Archetype'}: ${archetype}`);
  html = replaceById(html, 'introLine', imply);
  html = replaceById(html, 'tarotImply', imply);
  html = replaceById(html, 'summaryPreview', summary);
  html = replaceById(html, 'lightKeywords', card.keywords_light || '');
  html = replaceById(html, 'shadowKeywords', card.keywords_shadow || '');
  html = injectFaqSection(html, lang, card);

  if (isThai) {
    const thaiDisplayName = card.alias_th || card.name_th || card.card_name_en || 'ไพ่ทาโรต์';
    const title = buildThaiSeoTitle(card, 'both');
    html = replaceById(html, 'cardNameHeading', thaiDisplayName);
    html = replaceTitleText(html, title);
    html = replaceMetaContent(html, 'og-title', title);
    html = replaceMetaContent(html, 'twitter-title', title);
  }

  await fs.writeFile(filePath, html, 'utf8');
}

async function run() {
  const raw = await fs.readFile(DATA_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  const cards = Array.isArray(parsed) ? parsed : (parsed.cards || []);
  const cardMap = pickCards(cards);

  const enDir = path.join(ROOT, 'cards');
  const thDir = path.join(ROOT, 'th', 'cards');

  const enSlugs = await fs.readdir(enDir);
  for (const slug of enSlugs) {
    const card = cardMap.get(slug);
    if (!card) continue;
    await updateFile(path.join(enDir, slug, 'index.html'), card, 'en');
    await updateFile(path.join(thDir, slug, 'index.html'), card, 'th');
  }

  console.log(`Updated static SEO body content for ${enSlugs.length} card pages (EN/TH).`);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
