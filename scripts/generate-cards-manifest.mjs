#!/usr/bin/env node
/**
 * generate-cards-manifest.mjs
 *
 * Emits data/cards-manifest.json — a tiny board-only projection of the full
 * data/cards.json (which is ~4.6 MB raw / ~1.15 MB brotli and was blocking the
 * daily selection board + reading page on cold loads; see BUG-021).
 *
 * The selection board only needs card identity (id / names / image / slug),
 * never the heavy per-card reading text. This manifest is ~20 KB raw / ~2 KB
 * gzipped. The full cards.json is still lazy-loaded by loadTarotData() for the
 * reading result page.
 *
 * MUST be regenerated whenever data/cards.json changes, or the board will draw
 * a stale deck. Run: `node scripts/generate-cards-manifest.mjs`
 * (loadTarotManifest falls back to the full cards.json if this file is missing
 * or shape-invalid, so a drift is degraded — not broken.)
 *
 * Keep the field list in sync with minimalizeCard() in js/data.js.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'data', 'cards.json');
const OUT = join(ROOT, 'data', 'cards-manifest.json');

// Mirror of minimalizeCard() in js/data.js — board-only fields.
const KEEP = ['id', 'card_id', 'image_id', 'seo_slug_en', 'card_name_en', 'name_en', 'name_th', 'alias_th', 'orientation'];

const raw = JSON.parse(readFileSync(SRC, 'utf8'));
const cards = Array.isArray(raw) ? raw : (raw.cards || raw.tarot_cards || []);
if (!cards.length) {
  console.error('No cards found in', SRC);
  process.exit(1);
}

const manifest = cards.map((card) => {
  const out = {};
  for (const k of KEEP) {
    if (card[k] !== undefined && card[k] !== null) out[k] = card[k];
  }
  return out;
});

writeFileSync(OUT, JSON.stringify(manifest), 'utf8');
const bytes = Buffer.byteLength(JSON.stringify(manifest));
console.log(`Wrote ${OUT}\n  cards: ${manifest.length}\n  size: ${bytes.toLocaleString()} bytes (raw)`);
