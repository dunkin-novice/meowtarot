# Card-Meaning Page Redesign — Prompt

Paste the block below into a fresh Claude Code session at the repo root.
Visual source-of-truth mockup lives next to this file:
- `docs/redesign/card-meaning-mockup.dc.html` (Claude design canvas; serve with `support.js` to render)
- `docs/redesign/card-meaning-mockup-preview.png` (rendered screenshot)

---

```
Redesign the MeowTarot card-meaning page — PURELY A VISUAL / FRONTEND REDESIGN.
Implement the supplied mockup. Do NOT change behavior, data, logic, routing, or SEO —
only layout, color, typography, spacing, and component styling.

VISUAL SOURCE OF TRUTH
- Mockup: docs/redesign/card-meaning-mockup.dc.html  (serve docs/redesign/ with
  `python3 -m http.server` + the sibling support.js to render it; or open the
  screenshot docs/redesign/card-meaning-mockup-preview.png). Match it closely.
- It is a self-contained mockup with sample data + inline styles — copy the VISUAL
  system, but wire every section to the page's REAL card data (see "wire to real data").

SCOPE — you MAY change (visual layer only)
- HTML markup/structure for layout, CSS (colors, type, spacing, shadows, radii,
  responsive), and the presentation in the DOM-build code (class names, wrappers,
  element order). Keep the SAME data each section shows.

OUT OF SCOPE — do NOT touch (must keep working)
- Data flow / JS logic: card lookup, getCardImageUrl, deck resolution (?deck= is
  supported — keep it), loadTarotData, related-cards.
- js/asset-resolver.js (off-limits) and image-URL building.
- SEO: <title>/meta/description, JSON-LD schema (buildCardSchema), canonical + hreflang
  (en / th-TH / x-default), breadcrumbs, sitemap. Restyle around them; don't alter them.
- The generator's substitution logic. No copy rewrites, no new features, no paywalls.

START HERE
- Read HANDOFF.md then CLAUDE.md (hard rules) first.
- Page in scope: the canonical "premium" card page /cards/<slug>/ and /th/cards/<slug>/
  (what the app's "Open Live Full Meaning Page" links to).

HOW THE PAGES ARE BUILT (never hand-edit the 78 generated files)
- Generator: scripts/generate-premium-seo-pages.mjs
- Edit the TEMPLATES, then regenerate:
    cards/the-fool/index.html        (EN HTML template)
    th/cards/the-fool/index.html     (TH HTML template)
    js/pages/the-fool-card.js        (DOM-build template — presentation only)
  Shared render helpers: js/components/card-meaning-components.js
- Regenerate: node scripts/generate-premium-seo-pages.mjs
  then spot-check the-fool, death, the-star, ace-of-cups (EN + TH).
- Add the redesign CSS layers other pages use (copy set + load order from index.html):
  theme-tokens.css, phase-2-header.css, phase-2-1-logo.css, phase-3-redesign.css.
  Put page-specific styling in a new css/card-meaning.css (don't bloat styles.css).

DESIGN TOKENS (from the mockup)
- Background: linear-gradient(180deg,#f1e4f6 0%,#f6e0ec 55%,#efe2f7 100%)
- Body font: 'DM Sans', system-ui; display/headings: 'Cormorant Garamond' serif (italic
  for hero keywords + Core Meaning). Thai: 'Noto Serif Thai' (serif) / 'IBM Plex Sans Thai'.
- Plum (headings) #3d1a5c; body #4d3a66; secondary #6a3f8e/#5a4570; muted #8a72a8/#a487c4;
  link #6b4faa. Gold accent #c9933a/#d49a2c (soft #e8c478), gold-on-light text #a06a1e.
- Accent gradient (section underline 34x2px, energy bars, active toggle):
  linear-gradient(90deg,#d49a2c,#e8c478).
- Cards: bg rgba(255,255,255,0.92), 1px rgba(255,255,255,0.9) border, radius 22px
  (hero 26px), shadow 0 10px 28px -12px rgba(61,26,92,0.2) (hero deeper).
- Chips: pill (radius 100px); light=gold rgba(232,196,120,0.22), shadow=purple rgba(106,63,142,0.1).
- Header: sticky frosted rgba(255,255,255,0.82)+blur(16px). Main max-width 600px, pad 16px.
- CTA button: linear-gradient(135deg,#6e1d4c,#d12878 45%,#e8a838), text #fdf6ee, pill.
- Section pattern: H2 (Cormorant 25px) + 34x2px accent-gradient underline + content.

SECTION ORDER (match the mockup)
1) Frosted header (menu, MeowTarot wordmark italic, EN|TH)  2) Breadcrumbs
3) Hero: card image w/ gold aura + deck label, orientation eyebrow, H1 name (Cormorant
   ~44px), Thai name, archetype chip, intro keywords (italic), Upright/Reversed toggle
4) Quick Symbolic Profile: Zodiac/Element/Planet/Numerology 2x2 grid + energy bars
5) Core Meaning (italic)  6) Reading Summary  7) Light & Shadow Keyword chips
8) Quick answers (FAQ)  9) "Draw this energy now" CTA  10) Discover more
11) Card-nav footer (Home / Card Index / next card; Daily / Celtic Cross / Ask)  12) Site footer

WIRE TO REAL DATA (the mockup uses samples — use existing fields, never invent)
- Image: getCardImageUrl(card,{orientation}) — already deck-aware via ?deck=. Keep the
  Upright/Reversed toggle swapping orientation + image.
- Name = card_name_en (EN on TH pages too — interim rule). Thai name = alias_th.
- Symbolic profile = zodiac_sign / element / planet / numerology fields.
- Core Meaning / intro keywords = tarot_imply; Reading Summary = reading_summary_preview /
  standalone_present; Light/Shadow chips = keywords_light + reversed keywords; Love FAQ =
  love_present. If a field the mockup shows (e.g. per-element energy bars) has no real data,
  use what exists or omit the sub-section — do not fabricate values.

HARD CONSTRAINTS
- EN/TH parity: every change ships in BOTH templates (cards/ and th/cards/). i18n strings
  route through js/common.js — don't inline new strings.

VERIFY (visual QA is manual — actually do it)
- Serve: python3 -m http.server <port> from repo root. chrome-devtools MCP (cache-bust JS
  with ?bust=Date.now()): load /cards/the-fool/ and /th/cards/the-fool/ at mobile (390x844)
  + desktop; confirm it matches the mockup, header/nav/footer match index.html, images load,
  console clean, TH text (incl. combining marks) renders, ?deck=boba-oracle swaps the hero
  image, and the Upright/Reversed toggle works.
- Confirm page source still has the same <title>/meta/schema/canonical after regeneration.

SHIP
- Edit canonical only. After web changes: cp changed files to www/ + npx cap sync ios
  (HANDOFF §4). Commit canonical only — never www/ or ios/. Add a LOG_DRAFT.jsonl entry.
- Confirm the visual direction with me before regenerating all 78 pages.
```
