import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'data', 'cards.json');

// Replicate normalizeCanonicalSlug from js/canonical-card-routes.js
function normalizeCanonicalSlug(slug = '') {
  return String(slug || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/-(upright|reversed)(?=-|$)/g, '')
    .replace(/-tarot-meaning$/, '')
    .replace(/^-+|-+$/g, '');
}

function getCanonicalCardPath(slug = '', lang = 'en') {
  const normalized = normalizeCanonicalSlug(slug);
  const prefix = lang === 'th' ? '/th' : '';
  return prefix + '/cards/' + normalized + '/';
}

function getCardName(card, lang) {
  return lang === 'en'
    ? card.card_name_en || card.name_en || card.name || card.id
    : card.alias_th || card.name_th || card.name || card.id;
}

function getCardSummary(card, lang) {
  return lang === 'en'
    ? card.reading_summary_preview_en || card.tarot_imply_en || card.meaning_en || ''
    : card.reading_summary_preview_th || card.tarot_imply_th || card.meaning_th || '';
}

function getCardCategory(card) {
  const raw = card.card_id || card.id || '';
  const numMatch = raw.match(/^(\d{2})/);
  const num = numMatch ? parseInt(numMatch[1], 10) : null;

  if (num && num <= 22) return 'major';
  if (num && num <= 36) return 'wands';
  if (num && num <= 50) return 'cups';
  if (num && num <= 64) return 'swords';
  if (num && num <= 78) return 'pentacles';
  return 'major';
}

function escHtml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function run() {
  const raw = await fs.readFile(DATA_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  const allCards = Array.isArray(parsed) ? parsed : (parsed.cards || []);

  // Filter upright cards only (78 unique cards)
  const uprightCards = allCards.filter(
    (card) => (card.orientation || '').toLowerCase() !== 'reversed'
  );

  for (const lang of ['en', 'th']) {
    const isThai = lang === 'th';
    const filePath = isThai
      ? path.join(ROOT, 'th', 'tarot-card-meanings', 'index.html')
      : path.join(ROOT, 'tarot-card-meanings', 'index.html');

    let html = await fs.readFile(filePath, 'utf8');

    // Build the static HTML content for all 78 cards
    const cardItems = uprightCards.map((card) => {
      const name = getCardName(card, lang);
      const summary = getCardSummary(card, lang);
      const slug = card.seo_slug_en || card.card_id || card.id || '';
      const href = getCanonicalCardPath(slug, lang);

      const liveLabel = isThai ? 'หน้าความหมายเต็ม (Live)' : 'Live full meaning page';
      const cta = isThai ? 'เปิดหน้าความหมายเต็ม' : 'Open full meaning page';

      return `      <li class="featured-link-item">
        <a class="featured-link" href="${href}">
          <div>
            <p class="result-meta">${escHtml(liveLabel)}</p>
            <h3>${escHtml(name)}</h3>
            ${summary ? `<p class="result-summary">${escHtml(summary)}</p>` : ''}
          </div>
          <span>${escHtml(cta)}</span>
        </a>
      </li>`;
    });

    const listHtml = cardItems.join('\n');

    // Inject into the <ul class="featured-links" id="canonicalCards"></ul> block
    const pattern = /(<ul[^>]*id=["']canonicalCards["'][^>]*>)([\s\S]*?)(<\/ul>)/i;
    if (pattern.test(html)) {
      html = html.replace(pattern, `$1\n${listHtml}\n      $3`);
      console.log(`Injected 78 static links into meanings page for [${lang}]`);
    } else {
      console.error(`Could not find ul#canonicalCards in ${filePath}`);
    }

    await fs.writeFile(filePath, html, 'utf8');
  }
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
