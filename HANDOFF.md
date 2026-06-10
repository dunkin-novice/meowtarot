# MeowTarot — Session Handoff / Where We Left Off

**Last updated:** 2026-06-10
**Branch:** `main` (in sync with `origin/main`, everything below is pushed & live)
**Deploy:** web = GitHub Pages from **canonical repo root** (`CNAME` present). `www/` + `ios/` are the Capacitor iOS mirrors only — the web does NOT serve from them.

Read `CLAUDE.md` first (hard rules + working agreement). This file is the
running "where we left off" tracker. `REDESIGN_HANDOFF.md` is older (Phase-5
redesign reference) — still useful background, but this file is current.

---

## 1. What shipped this session (2026-06-08 → 06-10, all pushed to `main`, live)

(Prior session's ships — Section-11 daily poster `7aecc92`, cold-load `c74e039`, shuffle-freeze `68cdad0`, daily-fit `18c8add` — are in `docs/log.jsonl`.)

| Commit | What |
|---|---|
| verify | **BUG-001 & BUG-004 closed** (stale records) — browser-verified live: `reading.html?l=th` already renders Thai (fix shipped earlier in `b9d1700`); Ask-a-question **"Other"** topic already renders per-card meanings by design (`reading-helpers.js:181` maps `other` → `standalone_*` fields). |
| `1c866d8` | **Dropped-tap fix (BUG-021 tail)** — daily board renders twice (initShell pre-data → all slots cardless, then manifest `.then()` rebuild). An early tap toggled `is-selected` on a cardless slot then got wiped → "missed". Guarded `setupBoard` onclick: `if (!cards[i]) return`. `js/main.js`. |
| `ecbcd7d` | **Deck-mismatch fix (BUG-016 #3)** — authed "Use this deck now" now writes `meowtarot_pending_deck_claim` (applied next load by `auth.js`) instead of `setActiveDeck()` live, so result page + poster stay on the deck the reading was drawn with. `js/deck-reward.js`. (#1 auth-gate + #2 timing were already fixed in `4a49e3f`.) |
| `d764d2f` | **Daily Continue clears the bottom nav** — reclaimed ~80px dead top padding (site-header is `display:none` on mobile) + card `max-width: clamp(38px, calc((100dvh-384px)/6), 64px)` so the 12-card grid shrinks on short phones; Continue clears the floating nav with NO scroll (verified 600/667/844px). `css/daily.css`. |
| (deck data) | **Reward schedule re-spaced** — streak-unlock days `1/3/7/14/30/60/100/180/365` → **`7/14/21/28/45/60/75/100/125`**. `js/data.js`. |
| `/today/` | **`/today/` redirected — BUG-010 closed** — retired unscrollable orphan; EN→`/`, TH→`/th/index.html` (meta-refresh + `location.replace`); removed from `sitemap.xml`. `today/index.html`, `th/today/index.html`. |
| contrast | **Reading-result AA contrast** — gold "Upright/Reversed" tag `#d49a2c`→`#8d6a14` (2.5→5:1); summary-box card names `#8a719f`→`#7a6090` (4.25→5.4:1). `css/reading.css`. |
| `f395fb9` | **Celtic Cross shares via poster** — full mode's "Save image" → **"Share"** → `openSharePage()` (poster flow) like daily/question. `js/reading.js`. Plus a non-blocking toast for the oversized-payload fallback (was a blocking `alert()` on every Celtic share). |
| poster | **Celtic poster narration redesign** — replaced 3 cramped low-contrast insight panels with ONE flowing narration (Present → Obstacle → Advice → Outcome, lead sentences, no labels/card names), large full-contrast serif, gold ornament, shrink-to-fit; TH length-capped (Thai has no `.!?` sentence breaks). Removed dead `drawInsightPanel`. `share/poster.js`. |
| labels | **"The Challenge" → "The Obstacle" / "อุปสรรค"** aligned across reading result (`js/common.js`) + poster (`share/poster.js` `FULL_POSITION_LABELS`), EN+TH (fixed a poster-vs-reading TH mismatch where the poster still said `ความท้าทาย`). |

`docs/log.jsonl` has the full entries (auto-appended on push from `LOG_DRAFT.jsonl`).
Bug records updated in `docs/open-bugs.md`: BUG-001/004/010/016/021 closed-or-progressed; BUG-006/017 verified Safari-only.

---

## 2. NEXT — open tasks (priority order)

### A. On-device / real-art poster QA — Dunkin (do this first)
The Celtic poster **narration redesign** + the **"Obstacle" labels** were verified
only via a local canvas render-harness (`share/poster-preview/celtic-harness.html`
— imports `buildPoster`, renders to a blob, screenshot; **CDN card art is
CORS-blocked on localhost** so it shows fallback gradients — the *text* renders,
which is what was changed). Needs a real-device pass with actual card art:
narration legible + complete, gold ornament, "The Obstacle"/"อุปสรรค" labels.

### B. Safari-only UX bugs — need a real iPhone (do NOT reproduce in Chrome)
Both verified logic/CSS-sound in Chrome; the bug is iOS Safari only.
- **BUG-006** — shuffle button stays darkened after tap (Safari `:active` retention).
  Likely fix: `-webkit-tap-highlight-color: transparent` + stop relying on `:active`
  for the pressed look (or `btn.blur()` on tap).
- **BUG-017** — 3rd-card selection glow paints late (Safari compositing deferral).
  Likely fix: `transform: translateZ(0)` / `will-change` / `contain: paint` on
  `.card-slot.is-selected`.

### C. cards.json payload cut (BUG-021 follow-up) — biggest perf win
Background prefetch is a **cache-warm, not a payload cut**. `cards.json` is still
**4.6 MB raw**; a reading reached without the prefetch (deep link / very fast tap)
is still slow. Split into **per-language** (`cards-en.json`/`cards-th.json`) or
per-card files: generator script + `generate-seo.yml` step + graceful fallback +
`loadTarotData` rewire.

### D. Other poster modes
- **Question (3-card) poster readability** — does it have the same cramped/low-contrast
  text the Celtic poster had (now fixed)? Render it (the harness pattern) and check.
- **Cross-deck face fallback for question/full/celtic posters (BUG-020 follow-up)** —
  only the daily poster + reading page have it; other `resolvePosterCardImageSources`
  callers in `share/poster.js` still fall back to a card *back*.

### E. Backlog / nits
- **`/tarot-card-meanings/`** — Phase-4 styling, big SEO surface, needs its own design pass.
- Footer "Start … Reading" links ~4.25:1 (just under AA) — sitewide nit.
- `LocalNotifications.then()` uncaught `CapacitorException` on web — pre-existing, non-fatal.
- Dead-code/cleanup: `insightTitles` in `share/poster.js` is now unused by the narration.

**Done since the 2026-06-07 handoff** (so don't re-flag): `/today/` redirect · position-label
audit → "Obstacle" · TH homepage parity (was already shipped) · daily-board fit · BUG-016 #1–#3.

---

## 3. Verification still pending (on-device, by Dunkin)
- **Celtic poster** — narration legible/complete + "The Obstacle"/"อุปสรรค" labels, with real card art (see §2A).
- **Safari-only** — shuffle-button stuck state (BUG-006), 3rd-card glow paint (BUG-017) (see §2B).
- **Daily Continue-above-nav** — short phone (~≤667px effective): whole board + Continue visible, no scroll, cards tappable.
- **Cold-load (BUG-021)** — fresh incognito: board appears fast, reading loads without a long "Please wait…", and an eager early tap is cleanly ignored (no phantom selection).
- **Card-name in TH** — poster/result still resolve the **English** card name on TH surfaces (interim user direction).

---

## 4. Key context / gotchas for the next session

- **Mirror drift (BUG-015):** committed `www/`/`ios/` are badly out of sync with canonical (e.g. `www/js/main.js` was ~844 lines off). The **web is unaffected** (serves canonical). Only ever `cp` canonical → `www`/`ios`, **never** the reverse, and **never commit mirror files** — commit canonical only. The iOS mirror needs a separate full reconciliation someday.
- **Mirror-sync per change:** `cp <f> www/<f> && cp <f> ios/App/App/public/<f>`, then verify `md5 -q` matches across all three. (`zsh` does NOT word-split unquoted vars — loop with an explicit file list, not `$FILES`.)
- **Push workflow (drift-safe):** `git add <canonical only>` → commit → `git stash push -m mirrors` → `git fetch && git pull --rebase origin main` → add `LOG_DRAFT.jsonl` entry (it's auto-cleared on every push by the auto-log Action, so re-add after rebase) → commit → `git push` → `git stash pop`.
- **LOG_DRAFT.jsonl:** append one JSON line per logical patch before pushing; the `auto-log.yml` Action appends it to `docs/log.jsonl` and clears the draft on push. Schema in `docs/LOG_SCHEMA.md` / `REDESIGN_HANDOFF.md` §5.
- **Headless debugging (how BUG-021 was diagnosed):** system Chrome is at `/Applications/Google Chrome.app`. Recreate the harness:
  `mkdir -p /tmp/mt-debug && cd /tmp/mt-debug && npm init -y && npm i puppeteer-core@23`,
  then `puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })`, `createBrowserContext()` for a fresh profile, `page.setCacheEnabled(false)`, and CDP `Network.emulateNetworkConditions` to throttle and expose cold-load races. (The `/tmp/mt-debug` scripts from this session do NOT survive a terminal restart.)
- **Chrome DevTools MCP (NEW — 2026-06-07):** a persistent `chrome-devtools` MCP server is now installed at **user scope** (`~/.claude.json`) — it **supersedes the ad-hoc `/tmp/mt-debug` puppeteer-core harness above** for headless debugging, cold-load repro, screenshots, console/network inspection, and Lighthouse. 29 tools (`navigate_page`, `take_screenshot`, `list_network_requests`, `list_console_messages`, `performance_start_trace`, `lighthouse_audit`, …); drives a fresh isolated Chrome. A second `chrome-mine` entry reuses a persistent logged-in profile (`~/.chrome-mcp-profile`). **Requires a Claude Code restart to load the tools into a session.** First high-value use: browser-verify the two unverified live-site bugs in `open-bugs.md` — **BUG-001** (`reading.html?l=th` renders EN not TH) and **BUG-004** (Ask-a-question "Other" topic drops per-card meanings). Verify-only; both have open product/rule decisions before any fix.
- **Poster render-harness (NEW — 2026-06-10):** to verify a `share/poster.js` change without the full reading→share flow, use `share/poster-preview/celtic-harness.html` (and `question-harness.html`): they `import { buildPoster }`, feed a minimal payload (`mode:'full'`/`'question'` + card ids), render to a blob `<img>`, and set `window.__posterReady`. Serve `python3 -m http.server <port>` from repo root, navigate, wait for `__posterReady`, screenshot. **Caveat:** CDN card art is **CORS-blocked on localhost** → cards show fallback gradients, but the **text/layout renders** (enough to verify narration/labels; NOT the art). Untracked dev artifacts.
- **chrome-devtools MCP can wedge:** if it errors "browser already running for …/chrome-profile", the instance is stuck. Killing the chrome procs (`pkill -f chrome-devtools-mcp`) also disconnects the MCP server for the rest of the session → the `mcp__chrome-devtools__*` tools vanish until a **Claude Code restart**. So do browser work in one go.
- **Visual previews** live in `share/poster-preview/` (poster `index.html`, daily-fit `daily-fit.html`, plus the new harnesses + session screenshots) — dev artifacts, served via `python3 -m http.server` from repo root, NOT shipped.
- **Asset base:** card art = `https://cdn.meowtarot.com/assets/<deck>/<nn>-<slug>-<orientation>.webp?v=2026-03`. Default deck = `moonmallow` (`getActiveDeckId()`). boba-oracle is a COMPLETE deck (an earlier "incomplete" claim was wrong — see BUG-020 correction).

---

## 5. Open bug list
`docs/open-bugs.md` (source of truth). This session: **closed** BUG-001, BUG-004, BUG-010, BUG-016 (all 3 issues), BUG-021 tail; **verified Safari-only** (open, need a device) BUG-006, BUG-017. Still open: BUG-020 (cross-deck face fallback for question/full/celtic posters), BUG-021 follow-up (cards.json payload cut), BUG-018 (asset-resolver `FALLBACK_BACK_PACK` — off-limits file).

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
