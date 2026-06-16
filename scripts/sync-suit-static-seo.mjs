// Bake per-suit SEO essentials (title, meta description, H1, intro) into the static
// suit-page shells (tarot-card-meanings/<suit>.html + th/...). The pages are otherwise
// JS-rendered shells with a generic duplicate <title> and empty intro → "crawled, not
// indexed". Source of truth = SUIT_COPY / SUIT_COPY_TH in js/suit-page.js (extracted at
// build time; the page JS still hydrates the same values at runtime).
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const BASE = 'https://www.meowtarot.com';
const SUITS = ['major', 'wands', 'cups', 'swords', 'pentacles'];

function extract(block, suit) {
  const re = new RegExp(`slug: '${suit}',[\\s\\S]*?title: '([^']*)',[\\s\\S]*?intro:\\s*'([^']*)'`);
  const m = block.match(re);
  return m ? { title: m[1], intro: m[2] } : null;
}

function setTitle(html, value) {
  return html.replace(/<title>[\s\S]*?<\/title>/, `<title>${value}</title>`);
}
// Replace the content="" of a <meta> tagged with data-suit-meta="<key>" (content sits
// before the data-suit-meta attr in these shells).
function setSuitMeta(html, key, value) {
  const re = new RegExp(`content="[^"]*"(\\s+data-suit-meta="${key}")`);
  return html.replace(re, `content="${value.replace(/"/g, '&quot;')}"$1`);
}
function setH1(html, value) {
  return html.replace(/(<h1 id="suitTitle">)[\s\S]*?(<\/h1>)/, (_m, a, b) => `${a}${value}${b}`);
}
function setIntro(html, value) {
  return html.replace(/(<p class="hero-subtext" id="suitIntro">)[\s\S]*?(<\/p>)/, (_m, a, b) => `${a}${value}${b}`);
}

async function run() {
  const js = await fs.readFile(path.join(ROOT, 'js', 'suit-page.js'), 'utf8');
  const enBlock = js.slice(js.indexOf('const SUIT_COPY = {'), js.indexOf('const SUIT_COPY_TH'));
  const thBlock = js.slice(js.indexOf('const SUIT_COPY_TH'), js.indexOf('const isThaiPage'));

  let count = 0;
  for (const suit of SUITS) {
    for (const lang of ['en', 'th']) {
      const data = extract(lang === 'th' ? thBlock : enBlock, suit);
      if (!data) { console.warn(`no copy for ${lang}/${suit}`); continue; }
      const file = lang === 'th'
        ? path.join(ROOT, 'th', 'tarot-card-meanings', `${suit}.html`)
        : path.join(ROOT, 'tarot-card-meanings', `${suit}.html`);
      let html;
      try { html = await fs.readFile(file, 'utf8'); } catch { continue; }
      const fullTitle = `${data.title} | MeowTarot`;
      const url = lang === 'th' ? `${BASE}/th/tarot-card-meanings/${suit}` : `${BASE}/tarot-card-meanings/${suit}`;
      html = setTitle(html, fullTitle);
      html = setSuitMeta(html, 'description', data.intro);
      html = setSuitMeta(html, 'og-title', fullTitle);
      html = setSuitMeta(html, 'og-description', data.intro);
      html = setSuitMeta(html, 'og-url', url);
      html = setSuitMeta(html, 'twitter-title', fullTitle);
      html = setSuitMeta(html, 'twitter-description', data.intro);
      html = setH1(html, data.title);
      html = setIntro(html, data.intro);
      await fs.writeFile(file, html, 'utf8');
      count += 1;
    }
  }
  console.log(`Baked static SEO into ${count} suit pages (EN/TH).`);
}

run().catch((e) => { console.error(e); process.exitCode = 1; });
