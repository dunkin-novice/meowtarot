# MeowTarot — Session Handoff / Where We Left Off

**Last updated:** 2026-06-07
**Branch:** `main` (in sync with `origin/main`, everything below is pushed & live)
**Deploy:** web = GitHub Pages from **canonical repo root** (`CNAME` present). `www/` + `ios/` are the Capacitor iOS mirrors only — the web does NOT serve from them.

Read `CLAUDE.md` first (hard rules + working agreement). This file is the
running "where we left off" tracker. `REDESIGN_HANDOFF.md` is older (Phase-5
redesign reference) — still useful background, but this file is current.

---

## 1. What shipped this session (all pushed to `main`, live)

| Commit | What |
|---|---|
| `7aecc92` | **Share Poster Section 11 (ScreenPoster)** — daily poster rebuilt to the design's ceremonial italic-serif layout (wordmark + gold line, render-time date eyebrow, card + warm aura, "Today's Card · Upright" badge, big italic card name, gold diamond, full-reading tagline). Card name renders in **English in both locales** (user direction). Loads Cormorant Garamond + Noto Serif Thai. `share/poster.js`, `share/index.html`. |
| `7aecc92` | **Cross-deck face fallback (BUG-020)** — if the active deck's card face fails, fall back to the default deck (moonmallow) face before any card back, at the callers (NOT `asset-resolver.js`). `js/reading.js`, `share/poster.js`. |
| `68cdad0` | **Shuffle freeze fix** — `#daily-shuffle` bound with `onclick` (not `addEventListener`) so locale-toggle re-renders don't stack listeners → no more frozen-at-center. `js/main.js`. |
| `18c8add` | **Daily board fits one screen** — `@media ≤640px` + `.daily-shell-active`: 100dvh flex column, grid `repeat(3,1fr)` sized by row height, so all 12 cards + Continue fit with no scroll. `css/daily.css`. |
| `c74e039` | **Cold-load perf (BUG-021)** — board now loads a ~28 KB `data/cards-manifest.json` instead of the 4.6 MB `cards.json`; `renderDaily` background-prefetches the full deck during selection so the reading loads from cache. New `scripts/generate-cards-manifest.mjs` + `generate-seo.yml` auto-regen. `js/data.js`, `js/main.js`. |

`docs/log.jsonl` has the full entries (auto-appended on push from `LOG_DRAFT.jsonl`).

---

## 2. NEXT — open tasks (priority order)

### A. cards.json payload cut (BUG-021 follow-up) — biggest remaining win
The background prefetch is a **cache-warm, not a payload cut**. `cards.json` is
still **4.6 MB raw**. A reading reached without the prefetch (deep link, very
fast tap before idle fires) is still slow. Real fix: split into **per-language**
(`cards-en.json` / `cards-th.json`) or **per-card** files so the reading loads
only what it needs. Would make the reading instant even cold. Mirror the
manifest approach: a generator script + `generate-seo.yml` step + graceful
fallback + `loadTarotData` rewire.

### B. Cross-deck face fallback for the OTHER poster modes (BUG-020 follow-up)
`c74e039`/`7aecc92` only protect the **daily** poster + reading page. The
**question / story / celtic** poster modes have the same gap — other
`resolvePosterCardImageSources` callers in `share/poster.js` (~lines 1264, 1926,
2046, 2549). Add the same `toDefaultDeckFaceUrl()` fallback to their fallback chains.

### C. Two minor bugs found while diagnosing BUG-021 (recorded, not fixed)
- Tapping a card **during the board's post-data re-render** can miss (selection
  doesn't stick). Tied to `renderDaily` running twice on load (pre-data + post-data).
- `LocalNotifications.then()` throws an uncaught `CapacitorException` on web
  (Capacitor plugin called in a browser context). Pre-existing, non-fatal.

### D. Original backlog (from `REDESIGN_HANDOFF.md` §2, not started)
- **TH homepage parity** — `th/index.html` still serves the old Phase-4 chooser; mirror the Phase-5 EN homepage with Thai copy.
- **`/today/` decision** — dead Phase-4 page reachable only by direct URL; recommend a redirect to `/index.html`.
- **Celtic Cross position-label audit** — verify Phase-4 vocab matches the design's "Situation / Crossing / Crown…" naming.
- **`/tarot-card-meanings/`** — Phase-4 styling, big SEO surface, needs its own design pass.

---

## 3. Verification still pending (on-device, by Dunkin)
- **Poster** — real Canvas QA on a phone (I only verified an HTML/CSS mock): the 132px name, full-reading tagline wrapping, TH shows "The Star" not "ดาว".
- **Shuffle** — toggle EN/TH a couple times then shuffle: should not freeze.
- **Daily board fit** — whole board + Continue visible without scroll; cards still comfortably tappable on short phones (capped at 345px grid).
- **Cold-load (BUG-021)** — fresh incognito / cleared cache: board appears fast, reading loads without long "Please wait a moment…".

---

## 4. Key context / gotchas for the next session

- **Mirror drift (BUG-015):** committed `www/`/`ios/` are badly out of sync with canonical (e.g. `www/js/main.js` was ~844 lines off). The **web is unaffected** (serves canonical). Only ever `cp` canonical → `www`/`ios`, **never** the reverse, and **never commit mirror files** — commit canonical only. The iOS mirror needs a separate full reconciliation someday.
- **Mirror-sync per change:** `cp <f> www/<f> && cp <f> ios/App/App/public/<f>`, then verify `md5 -q` matches across all three. (`zsh` does NOT word-split unquoted vars — loop with an explicit file list, not `$FILES`.)
- **Push workflow (drift-safe):** `git add <canonical only>` → commit → `git stash push -m mirrors` → `git fetch && git pull --rebase origin main` → add `LOG_DRAFT.jsonl` entry (it's auto-cleared on every push by the auto-log Action, so re-add after rebase) → commit → `git push` → `git stash pop`.
- **LOG_DRAFT.jsonl:** append one JSON line per logical patch before pushing; the `auto-log.yml` Action appends it to `docs/log.jsonl` and clears the draft on push. Schema in `docs/LOG_SCHEMA.md` / `REDESIGN_HANDOFF.md` §5.
- **Headless debugging (how BUG-021 was diagnosed):** system Chrome is at `/Applications/Google Chrome.app`. Recreate the harness:
  `mkdir -p /tmp/mt-debug && cd /tmp/mt-debug && npm init -y && npm i puppeteer-core@23`,
  then `puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })`, `createBrowserContext()` for a fresh profile, `page.setCacheEnabled(false)`, and CDP `Network.emulateNetworkConditions` to throttle and expose cold-load races. (The `/tmp/mt-debug` scripts from this session do NOT survive a terminal restart.)
- **Visual previews** live in `share/poster-preview/` (poster `index.html`, daily-fit `daily-fit.html`) — dev artifacts, served via `python3 -m http.server 8765` from repo root, NOT shipped.
- **Asset base:** card art = `https://cdn.meowtarot.com/assets/<deck>/<nn>-<slug>-<orientation>.webp?v=2026-03`. Default deck = `moonmallow` (`getActiveDeckId()`). boba-oracle is a COMPLETE deck (an earlier "incomplete" claim was wrong — see BUG-020 correction).

---

## 5. Open bug list
`docs/open-bugs.md` — newest: BUG-021 (cold-load, fixed this session), BUG-020 (cross-deck fallback, partially fixed). BUG-016/017/019 older.

---

═══════════════════════════════════════════════════════════════════
PROMPT FOR A FRESH SESSION (paste into a new Claude Code terminal)
═══════════════════════════════════════════════════════════════════

I'm continuing MeowTarot at `~/projects/MeowTarot`. Read `HANDOFF.md` (current
state), then `CLAUDE.md` (hard rules). Everything in §1 is shipped & live on
`main`. Pick up from §2 — confirm with me which task before starting. Respect
the hard rules (don't touch `js/asset-resolver.js` or `share/normalize-payload.js`;
edit canonical only, never mirrors; commit canonical only). Web deploys from
canonical root via GitHub Pages; `www/`/`ios/` are stale iOS mirrors (BUG-015).
═══════════════════════════════════════════════════════════════════
