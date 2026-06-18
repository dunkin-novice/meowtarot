# MeowTarot — Session Handoff / Where We Left Off

**Last updated:** 2026-06-16
**Branch:** `main` (in sync with `origin/main`, everything below is pushed & live)
**Deploy:** web = GitHub Pages from **canonical repo root** (`CNAME` present). `www/` + `ios/` are the Capacitor iOS mirrors only — the web does NOT serve from them.

Read `CLAUDE.md` first (hard rules + working agreement). This file is the
running "where we left off" tracker. `REDESIGN_HANDOFF.md` is older (Phase-5
redesign reference) — still useful background, but this file is current.

---

## 1. What shipped — recent sessions (all pushed to `main`, live)

### 2026-06-18 — in-app bug batches (see `docs/log.jsonl` for full entries)

| Area | What |
|---|---|
| Deck unlock | Unlock now keyed to **accumulated daily reads** (`total_daily_reads`) not streak; single milestone source `getUnlockMilestones()` ([7,14,21,28,45,60,75,100,125]); `getNewlyUnlockedDecks(prev,new)`. Homepage/profile lock state now match; owned decks no longer render dull (auth-state re-render). Locked deck tap → unlock-conditions popup (deck art + "draw on N days · M to go"); Moonmallow + other owned decks activate even logged-out. |
| Topbar | Logged-in daily/full topbar shows **progress to next deck unlock** (number = days remaining, label "to next deck"/"ถึงสำรับใหม่"); logged-out = save CTA; all-unlocked = streak. |
| Lang | Path-based lang toggle (pill NAVIGATES `/ ↔ /th/`), TH persists across pages (`2026-06-18-lang-toggle-pathbased-correction`). Site-wide floating **Report** button. |
| Celtic | Selection board deals all **78 cards**, now laid out as **4 overlapping rows** (20/20/20/18, was 4-col grid → ~20 rows tall) via flex-wrap + negative margin; deal stagger capped for >24-slot boards (~12s → ~0.8s) (`2026-06-18-celtic-board-4row-fast`). |
| Result page | **Reversed card** gets a distinct glow (`.card-art.is-reversed`, single chokepoint in `buildCardArt`). **Flattened the result bg** — removed the redundant near-white panel behind the card so content sits on the page gradient (`2026-06-18-reading-result-flatten-bg`). **EN/TH toggle fixed** — `computeLanguageHref` now rewrites both `lang` & `l` params so the result page lands on `/th/reading.html?…&l=th` (was dragging stale `l=en` → Thai mirror rendered EN) (`2026-06-18-reading-lang-toggle-l-param`). |
| Decks | Board deck-name label is now a **deck switcher**: tap → "Your deck" bottom-sheet (owned decks selectable, locked greyed) → `setActiveDeck` + `repaintCardBacks()` swaps the board backs + label, no reload (`2026-06-18-board-deck-switcher`). |
| Profile | Lifetime-stat wording sharpened (kept logic): "Readings shared"→**"Times shared"/"จำนวนแชร์"** (`2026-06-18-profile-stats-wording`). **Removed the redundant "Deactivate account"** (local-reset that duplicated the real Delete account) (`2026-06-18-remove-redundant-deactivate`). |
| #4 history | **DIAGNOSED — recording works** (Supabase: RLS INSERT policies correct, 32 readings across 3 Google users incl. kitikornr=26). The "not recording" feeling = logged-out/expired-session draws queue locally; flush now also runs on `INITIAL_SESSION` restore, not just fresh `SIGNED_IN` (`2026-06-18-pending-readings-flush-on-restore`). Residual: on-device verify the offline→login flush. |

### 2026-06-16

| Commit | What |
|---|---|
| `b3a0349` | **Celtic Cross full-reading result page overflowed the right edge on mobile (IMG_4894) — FIXED** — the `.celtic-slot--challenge` card (the one that crosses the center card) is pinned `position:absolute; top:50%; left:50%; transform:translate(-50%,-50%) rotate(90deg)` on desktop so it overlaps the situation card. The `@media (max-width:640px)` column-stack override reset only `position`+`transform` but **left `top/left:50%` in place**; a higher-specificity rule computes the slot as `position:relative`, so the leftover `left:50%` (~231px) shoved it off the right edge → **72px horizontal overflow** (card 2 clipped). Fix: also reset `top/left/right/bottom:auto` in that mobile rule (`css/styles.css`). Reproduced live CSS in chrome harness @390px: slot was `left:371/right:591`, after fix `left:140/right:360`, overflow negative. md5 parity canonical=www=ios. |
| `9a08fde` | **Google sign-in blocked in in-app browsers (IMG_4893: "Access blocked — disallowed_useragent") — FIXED** — Google rejects OAuth inside embedded webviews (LINE/FB/IG/Messenger/TikTok/Android System WebView). New `isInAppBrowser()` (`js/auth.js`, UA sniff: Line/FBAN/FBAV/FB_IAB/Instagram/Messenger/MicroMessenger/TikTok/Snapchat/Pinterest/GSA + `; wv)`). `loginWithProvider` now throws `err.code='IN_APP_BROWSER'` before firing the doomed redirect. The sign-in gate (`js/sign-in-gate.js`) detects it and swaps the Google button for **"Open in your browser to sign in"** guidance + a **Copy-link** button (`navigator.clipboard.writeText(location.href)` → "Link copied ✓"), EN+TH. iOS synced. **Follow-up (separate):** the native Capacitor wrap should do OAuth via `ASWebAuthenticationSession` (system browser), not the in-app guidance path. |

### 2026-06-11 → 06-15

| Commit | What |
|---|---|
| `ecd26ad` | **SEO: suit pages were thin/duplicate-title → server-rendered** — `/tarot-card-meanings/<suit>` (5 suits × EN/TH) were JS shells with a **generic duplicate `<title>` ("Tarot Card Meanings \| MeowTarot" for all)** + empty intro (~80 words) = "crawled-not-indexed". New `scripts/sync-suit-static-seo.mjs` bakes unique static title/meta-description/og/H1/intro per suit from `SUIT_COPY`/`SUIT_COPY_TH` in `js/suit-page.js`. All 10 now unique (EN "Cups Tarot Card Meanings" / TH "ความหมายไพ่ถ้วย"). **GSC findings (6/12 snapshot):** 52 indexed / 22 not — and the 22 are ~all benign: 9×404 were **stale** (shims live, all 200 — just "Validate Fix"), 3×noindex intentional (daily/today app screens), 2×alt-canonical correct, 4×redirect expected, ~3 thin TH pages (now fixed). **Cloudflare DONE** (apex→www 301 live; Always Online already off; no page rules). |
| `8b5b837` | **Technical SEO: server-render card JSON-LD + audit** — `injectCardSchema()` in `scripts/sync-card-static-seo.mjs` bakes `buildCardSchema()` output into the previously-empty `#cardMeaningSchema` `<script>` at build time (was JS-injected only); ran it → all **156 `/cards/` pages** now ship `WebPage`/`BreadcrumbList`/`FAQPage`/`DefinedTerm` in raw HTML, EN+TH. **Audit verdict: technical SEO is solid** (static unique titles/descriptions, self-canonical www matching the CNAME, reciprocal hreflang, HTTP→HTTPS 301, clean 174-URL sitemap). The year-of-no-indexing was a **discovery problem** (never in Search Console + ~zero backlinks), now being fixed (GSC connected + sitemap submitted by user). **Two CLOUDFLARE to-dos remain (user-side, dashboard — I have no access):** (1) **301 `meowtarot.com`→`www`** (both currently serve 200; canonical is www) via Redirect Rule. (2) **Soft-404:** unknown URLs (e.g. `/cards/zzz/`) return **200 + homepage**, not 404 — likely Cloudflare "Always Online"/cache or a catch-all; watch GSC Pages→"Soft 404". Growth lever = **backlinks/authority** (Google leaves zero-authority new domains as "Discovered – not indexed"). |
| `b27fc51` | **Archived Tarot-of-the-Day + Personality-Quiz (delink + noindex)** — removed the "Discover more / Explore" link section ("Explore Tarot Card of the Day" + "Take the Tarot Personality Quiz") from `reading.html`+TH and all 156 `/cards/` premium pages + the-fool templates (`growthCtaSection`), and from the SEO sync generator (`injectGrowthCtaSection` in `scripts/sync-card-static-seo.mjs` — else it re-adds). Added `noindex,follow` to the 4 target pages (`daily-card` + `quiz/tarot-card-personality`, EN+TH) + removed their `sitemap.xml` entries. Pages kept (archived), delinked + deindexed. |
| `d801776` | **Decks page UX** — homepage "See all" `profile.html`→`decks.html` (EN/TH); `.decks-toast` centered (was `bottom:100px`, overlapped the navbar); **logged-out deck notes are sign-in CTAs** ("Sign in to own it" for free defaults / "Sign in to get it" for unlock decks; tap → sign-in gate). Logged-in labels unchanged. *(Interpreted the "Velvet Familiar / Null days → sign in to get it" request as this logged-out treatment — the live decks page has no literal "Velvet Familiar / Null days"; confirm if you meant a specific deck.)* |
| `c04a78d` | **Share page always shows "Back to Homepage"** — `#backToReading` set to homepage once early in `share.js` init (every state incl. no-payload error; was a broken "Back to reading"→/reading.html). |
| `0982d2f` | **Daily top-right chip: real streak + logged-out "Save your fortune" CTA** — the chip was hardcoded `Day 14` in `daily.html`/`th/daily.html` (nothing wired it). `renderStreakChip()` in `js/main.js` now reads `getUserProgress().streak_current` (local — works signed-in or not): signed-in → `<n> day streak` (0 → "Start your streak"); **signed-out → streak number + "Save your fortune" / "บันทึกดวงของคุณ"**, chip is a tappable CTA → sign-in gate (loss-aversion; local streaks are lost on cache-clear). New i18n keys (`dailyStreakLabel`/`Start`/`SaveCta`, EN/TH); static placeholder de-faked to `✦`. Verified EN+TH + gate opens. **Deck-NAME in the same topbar — ✅ FIXED (`99463b7`):** `renderDeckName()` wires `daily-topbar__deck-name` to the active deck (`getAllDecks().find(id===getActiveDeckId())`, localized `name_th` on TH). The old "Velvet Familiar" wasn't even a real deck. Verified boba-oracle → "Boba Oracle"/"แมวชานม". |
| `3d67ddf` | **"Open Live Full Meaning Page" now shows the reading's deck, not the default** — the meaning link points to the canonical pages on **`www.meowtarot.com`**, but the app/readings run on the **apex** `meowtarot.com` (and iOS on `capacitor://localhost`). `buildCardImageUrls` picks the deck via `getActiveDeckId()` → origin-scoped `localStorage`, which is **invisible cross-origin** → fell back to moonmallow. Fix: `getActiveDeckId()` (`js/data.js`) now honors a **`?deck=` URL override** (validated vs `DECKS`, no persist, no unlock gate); `reading.js` appends `?deck=<active deck>` to that button only (SEO canonical stays clean). Single-source fix — covers all **78 per-card `js/pages/*-card.js`** pages (all route through `getCardImageUrl→buildCardImageUrls→getActiveDeckId`). `asset-resolver.js` untouched (rule #4). Verified locally: `?deck=boba-oracle`→boba, invalid→default. iOS synced. |
| `e06715e` | **Quick Pull shows the card's PRESENT interpretation, not the reflection question** — `resolveQuestionPosterSummaries` (`share/poster.js`) reached `reflection_question` (a *prompt*, e.g. The Fool "If you knew you wouldn't get hurt falling…") before any present interpretation, so generic-topic / TH-gap readings showed a **question** (sometimes the EN question on a TH poster). Now: insert `standalone_${slot}`, **remove `reflection_question` entirely**, add EN gap-fillers (`standalone_*_en`/`general_meaning_en`/`tarot_imply_en`) so a TH content gap shows an English *statement*, never a question or blank (free-core). `js/reading.js` single-card inline leads with `standalone_present` (+EN gap-fill). Also nudged the poster card name baseline 132→152 to clear the "Answer · Upright" badge (was ~17px overlap). Verified EN+TH in harness w/ real art. iOS synced. |
| `34b6f53` | **Quick Pull poster polish + correct download filename** — from a real-device export. `share/poster.js renderQuickPullPoster`: topic headline 76px→**auto-fit up to 112px**; reading tagline 48→**58px** and recolored ivory→**deep plum `#3d1a5c`** (was too faint on the pale lower BG). `share/share.js`: poster download filename was hardcoded `meowtarot-daily-reading.png` for **every** mode → now mode-aware (`ask-a-question` / `celtic-cross` / `daily-reading`). Verified EN+TH in harness **with real card art** (the R2 CORS fix now lets localhost load CDN art). iOS synced (md5 ✓). |
| `3a33849` | **Poster Thai text was rendering as tofu — FIXED (`share/poster.js`)** — two canvas bugs: (1) the `"Poppins"/"Space Grotesk", sans-serif` stacks had **no Thai fallback** and `IBM Plex Sans Thai` wasn't preloaded → Thai combining marks tofu'd (e.g. 3-card title ความรัก). Added `"IBM Plex Sans Thai"` to all 38 sans stacks + preloaded weights 500/600/700 in `faceSpecs`. (2) `drawTrackingText` split text **per code point** for letter-spacing → Thai combining vowels/tone marks detached from their base → tofu (Quick Pull `คำตอบ` badge + eyebrows). Now renders Thai as one centred `fillText` run; EN tracking unchanged. **Fixes TH on ALL poster modes** (daily/question/celtic/full). Harness-verified with the real webfont `<link>` loaded + cache-busted module. iOS synced (md5 ✓). |
| `31a3ee1` | **Quick Pull result drops energy radar + 3-card poster radar TH-localized (§2D)** — (1) `js/reading.js` `renderQuestion`: energy panel gated on `state.spread !== 'quick'` so the single-card Quick Pull on-screen result mirrors Daily (big card + reading, no radar; matches the takeaway-panel quick-gate). (2) `share/poster.js` `resolveEnergyBalance(energyData, lang)` localizes the radar interpretation + axis labels (EN/TH) via `ENERGY_AXIS_WORDS`/`ENERGY_AXIS_LABELS` (Action→การลงมือทำ, Emotion→อารมณ์, Thinking→ความคิด, Stability→ความมั่นคง); energy compute moved below the single-pull early-return (3-card only). Poster harness-verified TH; **result-page gate NOT browser-verified (manual QA)**. iOS: poster.js + reading.js synced (md5 ✓). |
| `1f2244c` | **Quick Pull poster → Daily-style (§2D)** — new module-level `renderQuickPullPoster()` in `share/poster.js`: Daily-style ceremonial layout (localized topic headline — current locale only — + gold rule + eyebrow → big card with warm aura → `Answer · <orientation>` badge → big italic card name (EN) → gold ornament → topic reading underneath via `fitDailyQuoteText`). Question branch **early-returns** to it for `isSinglePull` BEFORE the 3-card layout + radar, so the radar never runs for single-pull. Also localized the poster eyebrow at source (`getQuestionPosterStrings` → `dict.questionTitle`, EN/TH). Daily branch + 3-card spread untouched. Supersedes the earlier magnify/"Answer" patch (`3d7ff2c`). Harness-verified EN+TH (card art = CORS-fallback on localhost). iOS synced (md5 ✓). |
| `f497b4f` | **Per-language cards split (§2C, BUG-021 follow-up)** — `scripts/generate-cards-lang.mjs` slices `cards.json` → `data/cards-en.json` (1.48MB) + `data/cards-th.json` (3.18MB). `loadTarotData(mode)` fetches the current locale's slice (`?lang`/`/th/` aware) w/ graceful fallback to full `cards.json`; `card-page.js` uses `loadTarotData('both')`. EN reading payload **−68%**, TH −32%. `generate-seo.yml` regenerates both. |
| `9a21f9f` | **Board card-backs load `00-back-200` thumbnail** — `getCardBackUrl({thumb})` in `data.js`; board call sites in `main.js` pass `thumb:true`. Reading-flip + fallbacks stay full-res. 12–24× lighter first board paint. |
| `27a40fc` | **Homepage "Your decks" strip wired to real decks** — `renderHomeDeckStrip()` in `main.js` replaces the redesign placeholder (gradient + "M" monogram, fake names) with real `00-back-200` thumbnails, EN+TH names, lock/active state; tiles link to `profile.html` (display-only, no repaint gotcha). |
| `0bad8ba` | **Poster cross-deck face fallback (BUG-020 §2D)** — `resolvePosterCardImageSources` (`share/poster.js`) inserts `toDefaultDeckFaceUrl(...)` before `backUrl` in the fallback chain, so question/full/celtic posters fall back to the default-deck *face* (real art, hard rule #8) before a card back. No-op on default deck; call order untouched (rule #4). |
| `c55d077` | **Question entry page compacted** — `question.html` + `th/question.html` reordered to topbar → heading → **Topic** → input → spread → Continue. Spread is now a side-by-side row (Quick Pull left + **default-active**, Story Spread right), long note hidden, margins tightened so Continue sits above the fold. `questionSpread` default `story`→`quick` in `main.js`. EN+TH. |

**Also (not in the repo):** the unattended SEO monitor's "Composio outage" (since 2026-05-25) was a **stale MCP server name** — fixed to `mcp__composio__COMPOSIO_REMOTE_BASH_TOOL` + added a D1 directive to skip git-untracked dev scratch under `share/poster-preview/`. In `~/Documents/Claude/Scheduled/meowtarot-daily-maintenance/SKILL.md`.

### 2026-06-08 → 06-10

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

### C. cards.json payload cut (BUG-021 follow-up) — ✅ SHIPPED 2026-06-11 (`f497b4f`)
Split into **per-language** decks. `scripts/generate-cards-lang.mjs` emits
`data/cards-en.json` (1.48 MB, **−68%**) + `data/cards-th.json` (3.18 MB, **−32%**)
as pure slices of `cards.json` (EN identity `card_name_en`/`seo_slug_en` force-kept
in the TH slice). `loadTarotData(mode)` in `js/data.js` now fetches the current
locale's slice (`?lang`/`/th/` aware) with **graceful fallback to full `cards.json`**;
per-variant localStorage cache. `card-page.js` calls `loadTarotData('both')` (it
paints both languages). `generate-seo.yml` regenerates + commits the two files.
Browser-verified (chrome-devtools MCP): EN→`cards-en.json`, TH→`cards-th.json`,
both→`cards.json`. **Follow-ups:** (1) backfill 12 cross-language content gaps in
`cards.json` (celtic_cross_*, self_future, travel_past/present — one lang blank;
slice preserves today's blank behavior). (2) iOS/www mirror sync still pending —
native app degrades gracefully to full `cards.json` (no break, no savings) until
`cp` + `cap sync`.

### D. Other poster modes
- **Question (3-card) poster readability** — ✅ CHECKED 2026-06-15 (harness render, EN+TH).
  **NOT cramped/low-contrast like Celtic was** — it already uses per-card summary boxes
  + an energy radar; text is legible in both languages. Closed.
- **Quick Pull single-card poster → Daily-style** — ✅ SHIPPED 2026-06-15 (`1f2244c`):
  `renderQuickPullPoster()` — big card + aura + topic headline + `Answer`/`คำตอบ` badge +
  card name + ornament + topic reading underneath, **no energy radar**. Topic headline is
  current-locale only (per user direction). Synced to iOS. **Real-art on-device pass still
  pending** (harness art is CORS-fallback, same caveat as Celtic §2A).
- **Quick Pull on-screen result drops the energy radar** — ✅ SHIPPED 2026-06-15 (`31a3ee1`,
  `js/reading.js`): mirrors the Daily result. **Result-page NOT browser-verified (manual QA)** —
  on-device, confirm the radar is gone on Quick Pull and still present on the 3-card Story result.
- **Question poster energy radar EN-only on TH** — ✅ FIXED 2026-06-15 (`31a3ee1` radar +
  `1f2244c` eyebrow): `resolveEnergyBalance(energyData, lang)` + `ENERGY_AXIS_WORDS`/
  `ENERGY_AXIS_LABELS` localize the interpretation + axis labels; eyebrow now `dict.questionTitle`.
  The parity gap is closed (never filed in `open-bugs.md`).
- **Cross-deck face fallback for question/full/celtic posters (BUG-020)** — ✅ SHIPPED
  2026-06-15 (`0bad8ba`): `resolvePosterCardImageSources` now inserts the default-deck
  *face* before the card back for all poster modes (call order untouched, rule #4).

### E. Backlog / nits
- **`/tarot-card-meanings/`** — Phase-4 styling, big SEO surface, needs its own design pass.
- Footer "Start … Reading" links ~4.25:1 (just under AA) — sitewide nit.
- `LocalNotifications.then()` uncaught `CapacitorException` on web — pre-existing, non-fatal.
- Dead-code/cleanup: `insightTitles` in `share/poster.js` is now unused by the narration.

### F. Open from the 2026-06-15 session
- **Reading-page card front didn't load on fresh devices — ✅ FIXED 2026-06-16 (R2 CORS).**
  The card **front** is an `<img crossOrigin="anonymous">` (`js/reading.js:1092`, set "for cross-origin
  draw/share paths" — the same element feeds the poster canvas). The **R2 bucket `meowtarot-assets`
  CORS policy only allowed `https://www.meowtarot.com` + `localhost:4173`** — it was **missing the apex
  `https://meowtarot.com`** (the live GitHub-Pages origin via CNAME) **and `capacitor://localhost`** (the
  iOS app webview origin). So a crossOrigin request from the real site/app got no `Access-Control-Allow-Origin`
  → the browser rejected the image. Fresh clients failed; the dev's phone only worked from **cache**. Card
  **backs** load fine because they're CSS `background-image` (`js/main.js:73`, never CORS-gated) — exactly
  why `00-back` showed but the front didn't. (Earlier "every face loads HTTP 206" was a `curl` test — curl
  doesn't enforce CORS — so it missed it.)
  **Fix applied:** set the bucket CORS to `allowed_origins: *`, methods `GET,HEAD` (via
  `wrangler r2 bucket cors set meowtarot-assets`). Server-side, live immediately (no deploy). `*` is safe
  (public images, anonymous/no-creds) and kills the whole "origin not listed" failure class. **Verified:**
  `curl -H Origin` (apex + capacitor) now returns `access-control-allow-origin: *`, and an in-browser
  `img.crossOrigin='anonymous'` load of boba/moonmallow fronts flipped from **ERROR → loaded**. Fixes both
  the reading front AND poster canvas. **Re-verified comprehensively 2026-06-16:** ACAO sweep = **44/44
  assets (all 11 decks × fronts/reversed/back/200-thumb) → 200 + `ACAO:*`**; all 4 poster modes
  (daily/question-quick/question-3card/celtic) generate real blobs (canvas not tainted); live homepage +
  card-meaning page = 0 broken images; and the **live Daily reading result rendered its `crossOrigin`
  card front (`18-the-star-reversed`, 1696px) end-to-end** from the apex origin. No CORS errors in console
  (only 404 fallback-probe noise + the 2 known-missing veila fronts). **Note:** `wrangler` is now logged in (was expired). **Still open
  (perf, not the bug):** `cf-cache-status: DYNAMIC` — CDN images aren't edge-cached (every hit → R2); add a
  Cloudflare cache rule for `cdn.meowtarot.com/assets/*`.
- **iOS / www mirror sync — PARTIAL.** `share/poster.js` **and** `js/reading.js` are now synced
  to `www/`+`ios/` (`cap sync ios` 2026-06-15, md5 verified — reading.js drift now resolved too).
  **Still pending (BUG-015 full reconciliation):** `js/data.js` (per-language split + `00-back-200`
  thumbs, www ~62 lines behind), `js/main.js` (deck strip, ~81 behind), `common.js`, + the new
  `data/cards-en.json` / `data/cards-th.json`. Mirrors also carry pre-existing uncommitted edits +
  partial `www/` tracking — needs a careful per-file `diff` reconciliation, not a blind `cp`.
  Native degrades gracefully until then.
- **Content backfills (non-blocking):** 2 missing veila-tarot fronts on the CDN
  (`39-three-of-cups-upright`, `40-four-of-cups-upright` — never generated); 12 cross-language
  gap cells in `cards.json` (celtic_cross_*, self_future, travel_past/present). **Also: TH reading
  content gaps** — e.g. The Fool has no `standalone_present_th` / `love_present_th`, so the TH Quick
  Pull falls back to the EN interpretation (handled gracefully by the `e06715e` gap-fill, but ideally
  backfill the Thai text). Worth an audit of `standalone_*_th` coverage across the deck.

**Done since the 2026-06-07 handoff** (so don't re-flag): `/today/` redirect · position-label
audit → "Obstacle" · TH homepage parity (was already shipped) · daily-board fit · BUG-016 #1–#3 ·
per-language cards split (§2C) · board-back thumbnail · homepage deck strip · poster cross-deck
fallback (BUG-020) · question-page compaction · question-poster readability check (§2D, not cramped) ·
Quick Pull poster → Daily-style (no radar) · Quick Pull result drops radar · question-poster radar
TH-localized + eyebrow localized · poster.js + reading.js iOS mirror sync.

---

## 3. Verification still pending (on-device, by Dunkin)
- **Celtic poster** — narration legible/complete + "The Obstacle"/"อุปสรรค" labels, with real card art (see §2A).
- **Safari-only** — shuffle-button stuck state (BUG-006), 3rd-card glow paint (BUG-017) (see §2B).
- **Daily Continue-above-nav** — short phone (~≤667px effective): whole board + Continue visible, no scroll, cards tappable.
- **Cold-load (BUG-021)** — fresh incognito: board appears fast, reading loads without a long "Please wait…", and an eager early tap is cleanly ignored (no phantom selection).
- **Card-name in TH** — poster/result still resolve the **English** card name on TH surfaces (interim user direction).
- **Quick Pull poster (Daily-style)** — real card art on-device: big card fills the frame, topic headline (locale-only), `Answer` badge, reading legible, no radar.
- **Quick Pull on-screen result** — radar is gone on Quick Pull (single card) but still present on the 3-card Story result; reading reads complete (free-core).

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
- **Poster render-harness (NEW — 2026-06-10):** to verify a `share/poster.js` change without the full reading→share flow, use `share/poster-preview/celtic-harness.html` (and `question-harness.html`): they `import { buildPoster }`, feed a minimal payload (`mode:'full'`/`'question'` + card ids), render to a blob `<img>`, and set `window.__posterReady`. Serve `python3 -m http.server <port>` from repo root, navigate, wait for `__posterReady`, screenshot. **Caveat:** CDN card art is **CORS-blocked on localhost** → cards show fallback gradients, but the **text/layout renders** (enough to verify narration/labels; NOT the art). Untracked dev artifacts. **TWO font caveats when verifying TH** (learned 2026-06-15, `3a33849`): (a) the bare harness pages don't load the Google-Fonts `<link>`, so add it (IBM Plex Sans Thai + Noto Serif Thai) or Thai falls back to system fonts and mis-tests; (b) ES-module cache means `share/poster.js` edits won't show on plain reload — `import('/share/poster.js?bust='+Date.now())` and re-render via `evaluate_script` to test a fresh build.
- **Canvas Thai rendering (tofu) — two traps (2026-06-15, `3a33849`):** (1) **every** canvas font stack that may render Thai needs an explicit Thai fallback (`"…","IBM Plex Sans Thai", sans-serif` / `"Noto Serif Thai", serif`) AND the face must be in `buildPoster`'s `faceSpecs` preload — a bare `"Space Grotesk", sans-serif` tofus Thai combining marks. (2) **never letter-space Thai by splitting code points** — `fillText` per char detaches combining vowels/tone marks → tofu; `drawTrackingText` now skips the split for Thai (U+0E00–U+0E7F) and draws one centred run.
- **chrome-devtools MCP can wedge:** if it errors "browser already running for …/chrome-profile", the instance is stuck. Killing the chrome procs (`pkill -f chrome-devtools-mcp`) also disconnects the MCP server for the rest of the session → the `mcp__chrome-devtools__*` tools vanish until a **Claude Code restart**. So do browser work in one go.
- **Visual previews** live in `share/poster-preview/` (poster `index.html`, daily-fit `daily-fit.html`, plus the new harnesses + session screenshots) — dev artifacts, served via `python3 -m http.server` from repo root, NOT shipped.
- **Asset base:** card art = `https://cdn.meowtarot.com/assets/<deck>/<nn>-<slug>-<orientation>.webp?v=2026-03`. Default deck = `moonmallow` (`getActiveDeckId()`). boba-oracle is a COMPLETE deck (an earlier "incomplete" claim was wrong — see BUG-020 correction).

---

## 5. Open bug list
`docs/open-bugs.md` (source of truth). This session: **closed** BUG-001, BUG-004, BUG-010, BUG-016 (all 3 issues), BUG-021 tail; **verified Safari-only** (open, need a device) BUG-006, BUG-017. Still open: BUG-020 (cross-deck face fallback for question/full/celtic posters), BUG-021 follow-up (cards.json payload cut), BUG-018 (asset-resolver `FALLBACK_BACK_PACK` — off-limits file). **FIXED this session (never needed filing):** question-poster energy radar + eyebrow were EN-only on TH (see §2D) — now localized (`31a3ee1` / `1f2244c`).

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
