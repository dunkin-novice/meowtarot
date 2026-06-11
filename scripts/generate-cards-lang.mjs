#!/usr/bin/env node
/**
 * generate-cards-lang.mjs
 *
 * Emits per-language projections of the full data/cards.json:
 *   data/cards-en.json  (~1.5 MB raw — shared fields + every *_en field)
 *   data/cards-th.json  (~3.2 MB raw — shared fields + every *_th field)
 *
 * Why (BUG-021 follow-up / §2C payload cut): the app renders ONE locale at a
 * time, but loadTarotData() was fetching the whole ~4.6 MB cards.json (both
 * languages) for every reading. An EN reader paid for ~3 MB of Thai text it
 * never reads, and vice-versa. loadTarotData() now fetches data/cards-<lang>.json
 * for the current locale (EN −68%, TH −32%), falling back to the full
 * cards.json if a per-language file is missing or shape-invalid. Pages that
 * genuinely render BOTH languages in one paint (card-page.js) call
 * loadTarotData('both'), which loads the full cards.json.
 *
 * PROJECTION — a pure slice, byte-faithful to the full deck:
 * - "shared" fields (no _en/_th suffix) → copied into BOTH files verbatim.
 * - "*_<lang>" fields → copied into that language's file with their exact value
 *   (present stays present, empty stays empty) so every `card.X_<lang>` read
 *   returns precisely what the full deck would have returned, blanks included.
 * - EN_IDENTITY fields (card_name_en, name_en, seo_slug_en) → force-copied into
 *   the TH file too. TH surfaces render the English card name (interim product
 *   direction) and build EN hreflang/canonical URLs from seo_slug_en, so the TH
 *   deck must still carry these EN identity strings even though they are _en.
 *
 * No cross-language fallback is baked in: every runtime cross-fallback consumer
 * (archetype, tarot_imply, reading_summary_preview, meta_description) reads a
 * gap-free base, so its fallback branch never fires and a pure slice is
 * behavior-identical. (The ~9 cards.json bases with one-language gaps —
 * celtic_cross_*, self_future, travel_past/present — are read by strict
 * consumers that already render blank for the missing side; the slice preserves
 * that exactly. Backfilling those translations in cards.json is a separate
 * content task.)
 *
 * MUST be regenerated whenever data/cards.json changes (the generate-seo.yml
 * Action runs it alongside generate-cards-manifest.mjs). Run manually:
 *   node scripts/generate-cards-lang.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'data', 'cards.json');
const LANGS = ['en', 'th'];
// _en identity strings the TH deck must still carry (English card name on TH
// surfaces + EN URL construction). Keep in sync with the EN-name-on-TH rule.
const EN_IDENTITY = ['card_name_en', 'name_en', 'seo_slug_en'];

const raw = JSON.parse(readFileSync(SRC, 'utf8'));
const cards = Array.isArray(raw) ? raw : (raw.cards || raw.tarot_cards || []);
if (!cards.length) {
  console.error('No cards found in', SRC);
  process.exit(1);
}

const isShared = (k) => !k.endsWith('_en') && !k.endsWith('_th');

function projectCard(card, lang) {
  const suffix = `_${lang}`;
  const out = {};
  for (const [k, v] of Object.entries(card)) {
    if (isShared(k) || k.endsWith(suffix)) out[k] = v;
  }
  if (lang === 'th') {
    for (const k of EN_IDENTITY) {
      if (card[k] !== undefined && card[k] !== null) out[k] = card[k];
    }
  }
  return out;
}

for (const lang of LANGS) {
  const deck = cards.map((card) => projectCard(card, lang));
  const out = join(ROOT, 'data', `cards-${lang}.json`);
  const json = JSON.stringify(deck);
  writeFileSync(out, json, 'utf8');
  console.log(`Wrote ${out}\n  cards: ${deck.length}\n  size:  ${Buffer.byteLength(json).toLocaleString()} bytes (raw)`);
}
