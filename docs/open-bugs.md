# Open Bugs & Backlog

Standalone issues tracker for MeowTarot. Items here are not in flight — they're recorded for triage in a future session when context permits.

This doc is separate from `CLAUDE.md`'s Backlog section. CLAUDE.md tracks design and feature decisions deferred between phases; this file tracks bugs and open technical issues that need diagnosis before being fixed.

Format: each entry is `BUG-NNN` (or `ISSUE-NNN` for non-bugs) with sections for Status, Priority, Reported date, Symptom, Suspected root cause, Reported fix, Why this isn't a drive-by fix, Files involved, Files off-limits, and Suggested first session. Skip optional sections when there's no information to put in them.

---

## BUG-001 — Thai language not respected on `/reading.html?l=th`

**Status:** Reported, not yet verified.
**Priority:** Medium
**Reported:** 2026-04-30

### Symptom

Reading result pages at `/reading.html?...&l=th` render in English instead of Thai.

### Suspected root cause

The codebase has two URL parsers that disagree on the language param name. `js/reading-url.js` reads `l=th` and correctly sets `state.currentLang = 'th'`. `js/common.js`'s `getUrlLanguage()` (called by `initShell`) only looks for `lang=`, falls back to the URL pathname prefix `/th/`, and on `/reading.html` (no `/th/` prefix) returns `'en'`, overwriting the correctly-set value. Then `normalizeBrowserUrlIfNeeded()` serializes the wrong `'en'` back into the URL as `l=en`, sealing the bug for that session.

### Reported fix

```js
// js/common.js — getUrlLanguage
// BEFORE
function getUrlLanguage(locationLike = window.location) {
  const urlLang = normalizeLang(new URLSearchParams(locationLike?.search || '').get('lang'));
  if (urlLang) return urlLang;
  return pathHasThaiPrefix(locationLike?.pathname || '/') ? 'th' : 'en';
}

// AFTER
function getUrlLanguage(locationLike = window.location) {
  const params = new URLSearchParams(locationLike?.search || '');
  const urlLang = normalizeLang(params.get('lang') || params.get('l'));
  if (urlLang) return urlLang;
  return pathHasThaiPrefix(locationLike?.pathname || '/') ? 'th' : 'en';
}
```

Why this isn't a drive-by fix
The reported fix modifies js/common.js, which CLAUDE.md hard-rules state is the i18n routing shell that should never be modified. Either the rule has an unwritten exception for i18n bug fixes (clarify in CLAUDE.md), or the fix should live elsewhere (have reading.js re-assert state.currentLang from l= after initShell runs), or the rule applies and this fix is rejected. Decision required before any code edit.
Also: the diagnosis hasn't been independently verified by code inspection. Before patching, reproduce on the live site, trace the actual call order, and check whether reading.js re-reads the URL after initShell.
Side effects to consider: legacy URLs with both params (?lang=en&l=th) — which wins? URLs with ?l= (empty) — does params.get('l') return null and does || chain handle that? Invalid values like ?l=fr — does normalizeLang return null cleanly? URL canonical-rewrite serialization — once Thai is detected, does the canonical become ?l=th or ?lang=th? Analytics, share links, and SEO canonicals may depend on consistent serialization.
Files involved

js/common.js — getUrlLanguage, initShell, normalizeBrowserUrlIfNeeded
js/reading-url.js — already correct per report (verify)
js/reading.js — consumes state.currentLang (verify)

Files explicitly off-limits

js/asset-resolver.js — never modify (CLAUDE.md hard rule)
share/normalize-payload.js — never modify (share payload schema is contractual)

Suggested first session

Reproduce on the live site. Open https://www.meowtarot.com/reading.html?l=th&[other params] and confirm English renders where Thai should. Screenshot.
Read js/common.js getUrlLanguage, initShell, normalizeBrowserUrlIfNeeded and trace the actual call order.
Check js/reading.js for any post-initShell language detection.
Decide: patch in js/common.js (requires CLAUDE.md rule clarification) or patch in reading.js (respects the rule but is a workaround).
Implement the chosen fix on a scoped branch with a LOG_DRAFT.jsonl entry.
Verify on real iPhone Safari with URL variants: ?l=th, ?lang=th, ?l=th&lang=en (conflict), ?l=, ?l=invalid.


## BUG-002 — Daily reading "Today card" reflects latest draw, not first draw of the day

**Status:** Verified fixed. Closed.
**Priority:** Medium
**Reported:** 2026-05-01

**Fix:** write guard added at `reading.js` line ~2833. Skips localStorage write if slot already holds a card for today's `date` field. Supabase persist path unchanged.

### Symptom

When a user draws a daily card twice on the same day, the "Today card" shown in the second menu (the post-draw display, presumably on daily.html or a result view) updates to reflect the most recent draw rather than preserving the first draw of the day.

Expected: the first card drawn on a given day is "the card for today" and remains pinned. Subsequent draws are either disallowed (one-card-per-day pattern) or treated as additional pulls that don't displace the canonical "today" card.

### Suspected root cause

Unverified. Likely candidates: the "Today card" lookup is reading the most recent draw from reading history (e.g., most recent reading where date = today) instead of the earliest draw with that date filter; a "save" path is overwriting an existing daily-card record for today instead of appending; or the dedup-by-date logic noted in earlier sessions ("duplicate-save guard, local-date handling") may be ordering wrong.

### Why this isn't a drive-by fix

Before any code change, a product decision is needed: should the second daily draw be (a) disallowed entirely with a "you've already drawn today" message, (b) allowed but the first card stays pinned as "Today card," or (c) something else? The fix shape depends on this answer.

### Files involved

- `js/reading-history.js` — history lookup logic, "today's card" query
- `js/reading.js` — where daily readings are saved
- `js/profile.js` — if "Today card" is rendered on profile
- `js/reading-helpers.js` — any shared date/dedup logic

### Files explicitly off-limits

- `js/asset-resolver.js` — never modify (CLAUDE.md hard rule)

### Suggested first session

1. Reproduce on the live site: open Daily Reading on iPhone, draw a card, note which card. Reload, draw again. Check whether the "Today card" display in the post-draw menu updates or stays on the first.
2. Open Safari Web Inspector (or DevTools mirroring) to capture how the second draw is being persisted (insert vs. update vs. replace).
3. Read `js/reading-history.js` to understand the canonical "today's card" query — find the query and confirm whether it sorts ASC (first) or DESC (latest) on timestamp.
4. Make the product decision (a/b/c above) before writing any code.
5. Implement the chosen behavior on a scoped branch with a LOG_DRAFT.jsonl entry.
6. Verify on real iPhone: draw twice in one day, confirm "Today card" shows the first.


## BUG-003 — Stale `cardOfTheDay` slot displays as Today card across day boundaries

**Status:** Closed — not reproducible as filed.
**Priority:** Medium
**Reported:** 2026-05-02

**Closing note (2026-05-04):** The date-equality check already exists at `js/today.js:92` (`entry.date !== today` → empty-state branch). That check landed in commit `acb00537` on 2026-04-27, five days before BUG-003 was filed (2026-05-02). The bug record's claim that today.js renders without comparing the stored date to today's local date is incorrect.

The `#today-empty` branch in `today/index.html` already exposes a display-with-CTA ("Draw your card for today" → `/daily.html`), so the product decision the bug record asked for (empty state vs. display-with-CTA) is moot — both options are effectively implemented.

If a different stale-display symptom surfaces on iPhone testing (service-worker cache, timezone edge case in `toLocalDateIso`, etc.), file as a new bug with concrete repro steps. Don't reopen BUG-003.

### Symptom

`js/today.js` reads the `meowtarot.daily.cardOfTheDay` localStorage slot and renders whatever it finds without comparing the stored `date` to today's local date. A slot written by a previous day's draw will continue to display as the "Today card" on `today.html` until the user makes a new daily draw that overwrites it. Surfaced as a follow-up while fixing BUG-002 (the write side now correctly pins the first-of-day card, but that fix doesn't help users who skip a day before returning).

### Suspected root cause

`readCardOfTheDay()` in `js/today.js` (around line 32) parses the slot and returns `{ date, card_slug, orientation }` as long as `date` and `cardSlug` are non-empty. There's no check that `parsed.date === toLocalDateIso(new Date())`, so yesterday's slot is accepted as valid input and rendered as today's card.

### Reported fix

```js
// js/today.js — readCardOfTheDay (around line 32)
function readCardOfTheDay() {
  try {
    const raw = window.localStorage?.getItem(DAILY_CARD_OF_DAY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const date = String(parsed.date || '').trim();
    const cardSlug = String(parsed.card_slug || '').trim();
    const orientation = String(parsed.orientation || '').toLowerCase() === 'reversed' ? 'reversed' : 'upright';
    if (!date || !cardSlug) return null;
    if (date !== toLocalDateIso(new Date())) return null;  // ← new: reject stale slot
    return { date, card_slug: cardSlug, orientation };
  } catch (_) {
    return null;
  }
}
```

### Why this isn't a drive-by fix

- Product decision needed: when the slot is stale, should `today.html` show its empty state (prompting a fresh daily draw) or display yesterday's card with a "draw today's card" CTA? The reported fix returns `null`, which falls into whatever the current empty-branch UX does — verify that branch is the desired behavior before shipping.
- Bounded but real impact — only affects users who skip at least one day between draws. The displayed card is at least *a* card, not a crash, so this is quality not severity.
- Related to BUG-002 but a separate file (consumer side, not write site). The two fixes together fully resolve the "Today card freshness" story.

### Files involved

- `js/today.js` (`readCardOfTheDay`, lines ~32-46) — read-and-return path that needs date validation
- `today.html` — verify the empty-state branch handles `null` cleanly (no broken image, copy renders, draw CTA visible)

### Files explicitly off-limits

- `js/asset-resolver.js` — never modify (CLAUDE.md hard rule)
- `js/common.js` — never modify (CLAUDE.md hard rule)
- `share/normalize-payload.js` — never modify (share payload schema is contractual)

### Suggested first session

1. Reproduce on device: draw a daily card today, change the iPhone's date to tomorrow (Settings → General → Date & Time), open `today.html`. Confirm yesterday's card displays as "Today card."
2. Make the product decision: stale slot → empty state (default), or display-with-CTA. Decide before patching.
3. Patch `readCardOfTheDay` per the reported fix. Verify the empty-state UI on `today.html` renders cleanly when `readCardOfTheDay()` returns `null`.
4. Add a `LOG_DRAFT.jsonl` entry referencing BUG-003 and noting the BUG-002 follow-up linkage.
5. Verify on device after toggling system date forward by one day.

---

## BUG-004 — Ask-a-question "Other" topic: per-card meanings missing from reading

**Status:** Reported, not yet verified or triaged.
**Priority:** Medium (to confirm — affects a specific question-mode topic).
**Reported:** 2026-05-02.

### Symptom

In Ask-a-question mode, when the topic is set to "Other", the per-card reading/meaning text for each drawn card does not appear in the on-screen reading. Other topics render the per-card meanings as expected.

### Suspected root cause (unverified)

Possibly a missing topic key for "other" in the question-mode reading text mapping, or a fallback path in the reading renderer that doesn't fire for the "other" topic. Likely lives in the question-mode reading flow rather than the shared per-card meaning lookup.

### Files likely involved

- `js/reading.js` (question-mode reading flow / per-card meaning rendering)
- `js/reading-helpers.js` (per-card text resolution by topic)
- `cards.json` (verify whether "other" topic-keyed fields exist for each card)

### Files explicitly off-limits

- `js/asset-resolver.js`
- `js/common.js` shell (i18n routing only)
- `share/normalize-payload.js`

### Suggested first session

1. Reproduce on live site: Ask-a-question → topic = Other → submit → confirm per-card meanings missing.
2. Compare DOM/state vs. another topic (e.g. Love) for the same cards — pinpoint where the text drops out.
3. Trace the topic key flow from input → reading state → per-card meaning lookup.
4. Decide whether to add the missing key, add a fallback to a generic per-card meaning, or treat "other" specially.

---

## BUG-005 — Ask-a-question poster: per-card meanings truncated mid-paragraph

**Status:** Reported, not yet verified or triaged.
**Priority:** Medium (to confirm — affects shareable poster output for question mode).
**Reported:** 2026-05-02.

### Symptom

On the Ask-a-question poster (the share/result poster), per-card meaning text is cut off and does not finish the paragraph. The visible text ends mid-sentence rather than at a clean paragraph or section boundary.

### Suspected root cause (unverified)

Likely a fixed-height text region or a character/line-count cap in the poster layout that truncates without ellipsis or completion. Could also be a font-size/wrap mismatch between the on-screen reading length and the poster's allotted text box.

### Files likely involved

- `share/poster.js` (poster rendering / text layout)
- `js/share-payload.js` (payload assembly — verify full text is being passed in, not pre-truncated)
- Question-mode poster template (whichever file owns the per-card text region)

### Files explicitly off-limits

- `js/asset-resolver.js`
- `share/normalize-payload.js` (share payload schema is contractual — payload shape cannot change)
- `resolvePosterCardImageSources` call order

### Suggested first session

1. Reproduce on live site: generate an Ask-a-question poster and inspect where text ends.
2. Verify whether the truncation is in the payload (text passed to poster is already short) or in the layout (full text passed but rendered region clips).
3. If layout-side: decide between auto-resize, scrollable region, summary/excerpt, or paragraph-aware truncation with ellipsis.
4. If payload-side: trace where text gets truncated upstream — but do NOT modify `share/normalize-payload.js`.

---

## BUG-006 — Shuffle button stays darkened after press until tab focus changes

**Status:** Reported, not yet verified or triaged.
**Priority:** Low-to-Medium (to confirm — UX/affordance issue, doesn't block flow).
**Reported:** 2026-05-02.

### Symptom

After tapping the Shuffle button, it stays in a darkened (pressed/disabled-looking) state. The yellow active state only returns after the user switches browser tabs and back. Expected behaviour: the button should return to the yellow active state immediately so the user can see it's tappable again for a re-shuffle.

### Suspected root cause (unverified)

Likely a CSS `:active` / `:focus` state not being cleared after tap on mobile, or a JS-applied "pressed"/"loading" class that isn't being removed when the shuffle animation/operation completes. The fact that tab-switching restores it points to a render/repaint trigger rather than a real state issue — the underlying state may already be correct but the visual doesn't refresh until the page regains focus.

### Files likely involved

- `js/reading.js` or wherever shuffle handler lives
- Shuffle-button CSS (active/focus/pressed states, transition timing)
- Possibly the shuffle animation completion callback (does it `blur()` the button or remove a state class?)

### Files explicitly off-limits

- `js/asset-resolver.js`
- `js/common.js` shell

### Suggested first session

1. Reproduce on real iPhone Safari (the report mentions tab-switching as the workaround — phone behaviour matters).
2. Inspect computed styles on the shuffle button immediately after tap vs. after tab refocus.
3. Check whether a class is stuck applied or whether it's purely a `:active`/`:focus` retention issue on touch.
4. Common fixes to consider: `button.blur()` after handler completes; `-webkit-tap-highlight-color` adjustments; explicit class removal in the shuffle complete callback.

---

## BUG-007 — daily.html regression (pre-existing on main)

**Status:** Closed — fixed in 94de5d5 (take-2 fix). Production verified 2026-05-07 after hard cache refresh.
**Priority:** High (visible on production, breaks core daily-card flow).
**Reported:** 2026-05-03.

**Status update (2026-05-03 take 2):** Initial fix at `css/styles.css:6067` and `:6172` (subtracting `var(--bottom-nav-height)` from `.board-shell` height calc) shipped in commit `5436645` but introduced new failures on production: Continue button floating mid-screen, Shuffle button pushed below shell, BUG-008 eyebrow text exposed as white-on-white. Root cause: `.card-board.card-board--daily` inner sizing was independent of `.board-shell` height. The container shrunk; the rigid card content didn't.

Take-2 fix updates `--daily-mobile-board-max-height` calc at `styles.css:6186` (≤480) and `:6111` (≤640) to subtract `var(--bottom-nav-height)`, hoists the variable into the ≤640 scope, removes rigid `min-height: 402px`. Also fixes BUG-008 in the same patch (`.eyebrow` color → `var(--mystic-text)`).

**Closing note (2026-05-07):** Verified closed on production after the founder's hard cache refresh on iPhone Safari. Static-cascade re-tracing during the 2026-05-06 read-only diagnosis confirmed the take-2 fix's correctness end-to-end: `.board-shell` height calc at `styles.css:6067` (≤640) and `:6172` (≤480) correctly subtracts `var(--nav-height)`, `var(--bottom-nav-height)`, `env(safe-area-inset-bottom)`, and a 16px buffer; `--daily-mobile-board-max-height` at `:6112` and `:6188` propagates that to `.card-board.card-board--daily`'s `max-height: clamp(304px, var, 420px)`; `.card-slot` at `:6202` reads its row height from the grid; `js/reading.js:2235-2236` measures slots via `getBoundingClientRect()` and applies the live pixel dimensions to motion-card overlays — adaptive, not hardcoded. The "Continue floats / Shuffle below shell" symptoms reported on production iPhone 2026-05-05 to 2026-05-06 were stale-cache renders of the pre-take-2 (`5436645`) state.

### Symptom

On `daily.html`: shuffle button missing, cards overlap the Continue button, Continue button overlaps the bottom nav, header font color wrong (likely too light against frosted-glass background).

### Suspected root cause

Confirmed pre-existing on `main` before today's Phase 4 work — the section 10 audit during the Phase 4 ship cleared the new code rule-by-rule, and three independent checks confirmed `daily.html` doesn't even load `phase-1-home.css`. Most likely culprits, in order: `phase-2-1-logo.css` (most recent shared-component CSS change, touched bottom-nav theming), `phase-2-header.css` (header globalization including the 2.0.1 mobile fix), or the `js/reading.js` daily card pin commit (`d2804da` — though this seems unlikely to affect button visibility or layout).

### Why this isn't a drive-by fix

Multiple plausible root-cause files, all of which ship to every page including `daily.html`. Need a discovery-first grep pass against `phase-2-*.css` for shuffle/continue/bottom-nav/header rules before any edit. Cascade specificity is fragile — Phase 2.0.1 already had to fight `bottom-nav.css` line 83 specificity. A blind fix risks the same trap.

### Files involved

- `daily.html`
- `css/phase-2-header.css`
- `css/phase-2-1-logo.css`
- `css/bottom-nav.css`
- Possibly `js/reading.js`

### Files explicitly off-limits

- `css/styles.css` — never edit (CLAUDE.md hard rule)
- `js/asset-resolver.js` — never modify (CLAUDE.md hard rule)
- `js/common.js` shell — never modify (CLAUDE.md hard rule)
- `share/normalize-payload.js` — never modify (share payload schema is contractual)
- Anything under `/share/` or `/th/`

### Suggested first session

1. Grep `phase-2-header.css`, `phase-2-1-logo.css`, `bottom-nav.css` for selectors matching `.shuffle`, `.continue`, `.card-slot`, `.site-header`, `.bottom-nav`, `.has-bottom-nav`.
2. Inspect `daily.html` rendered DOM in Safari devtools to see which rule wins on each broken element.
3. Identify whether the regression is one root cause or several stacking.
4. Patch with discovery-first + matching-specificity overrides per the Phase 2.0.1 pattern.

---

## BUG-008 — daily.html topic font unreadable

**Status:** Closed — fixed in 94de5d5 (2026-05-04). Production verified 2026-05-07 after hard cache refresh.
**Priority:** Medium (readability — affects every daily-card user).
**Reported:** 2026-05-03.

**Diagnostic update (2026-05-03):** The original framing of this bug as a `<header id="site-header">` text-color issue was disproven during the BUG-007 bundled-fix session. On mobile (`@media (max-width: 768px)` + `body.has-bottom-nav`), `css/bottom-nav.css:89-94` hides `.mobile-menu-toggle`, `.nav-panel`, `.nav-logo`, and `.header-title` with `display: none !important`. The only visible site-header element on mobile is the `.lang-btn` EN/TH toggle, already `#3d2c58` dark plum (`css/phase-2-header.css:62`) — readable.

Scope re-targeted to the page-body topic text — `<p class="eyebrow" data-i18n="dailyTitle">` (renders "Daily Reading" / "ดูดวงรายวัน") inside `<section class="board-shell">` at `daily.html:54`. Re-diagnosis (READ-ONLY, Step 2 of post-Phase-4 cleanup) traced the cascade:

- Effective `.eyebrow` color: `rgba(247, 242, 255, 0.98)` (near-white) from `body[data-page='daily'] .board-header--daily .eyebrow` at `css/styles.css:5494` (specificity 0,3,0 — wins).
- Effective `.board-shell` background: dark navy gradient (`#060b22` → `#0c1440`) from `body { background: … }` at `css/styles.css:62`. No rule overrides body background on `body[data-page='daily']`.
- White-on-dark is high-contrast; static cascade does not reproduce the "unreadable" symptom.

Possible explanations the read-only diagnosis cannot resolve:

1. Reporter saw a post-deal JS-rendered state (`js/reading.js:3769` swaps `readingTitle.textContent = dict.dailyTitle` into a different element — not yet traced).
2. Reporter conflated `daily.html` with `index.html`, where Phase 2 added a light frosted header on a light pastel body and `css/phase-1-home.css:85` sets `body[data-page='home'] .eyebrow { color: #9270d0 }` (lavender on cream — genuinely low-contrast).
3. iOS Safari rendering quirk (forced colors, smart invert, increased contrast) invisible to static CSS analysis.

Next step: live-device inspection (Mac Safari → Develop → iPhone) to capture the actual unreadable element, its computed color, and inherited background. Do not author a fix from speculation.

**Cascade correction (2026-05-07):** The 2026-05-03 diagnostic update above contained two factual errors about the cascade. Recording the corrections here rather than rewriting the dated entry:

- Body background on `daily.html` is NOT the dark navy gradient at `css/styles.css:62-72`. A later `body { ... }` rule at `css/styles.css:3948-3958` (same specificity, later in source order) overrides it with a pastel gradient (`var(--mystic-top) → var(--mystic-mid) → var(--mystic-bottom)`) and `color: var(--mystic-text)` foreground.
- `.board-shell` background is NOT body bg either. The combined selector at `css/styles.css:4065-4091` (which includes `.board-page .board-shell`) sets `background: var(--mystic-card)` = `rgba(255, 255, 255, 0.95)` (near-white).

Net cascade: pre-fix eyebrow was `rgba(247, 242, 255, 0.98)` (near-white) on `.board-shell`'s near-white surface. That IS the reported "white-on-white" — the static cascade *did* reproduce the symptom; the 2026-05-03 trace just looked at the wrong background layer.

**Closing note (2026-05-07):** Verified closed on production after the founder's hard cache refresh. Take-2 patch at `styles.css:5494` replaced the near-white eyebrow color with `var(--mystic-text)` (`#332f42`), giving dark plum on near-white shell — readable. The "white-on-white" reports from 2026-05-05 to 2026-05-06 were stale-cache renders of the pre-take-2 state. Closed concurrently with BUG-007.

### Symptom

The topic/heading text on `daily.html` is too light against the background. Hard to read.

### Suspected root cause

Likely a token color value (`--color-plum-soft` or similar) being applied where a darker variant (`--color-plum` or `--color-plum-mid`) would be more readable. May also be related to the broader BUG-007 regression — could be a single fix or could be separate.

### Why this isn't a drive-by fix

The color token system is shared. Changing the value globally affects everywhere it's used; changing it scoped requires identifying every usage. Worth bundling diagnosis with BUG-007 in the same session since they're the same page.

### Files involved

- `daily.html`
- `css/theme-tokens.css`
- Possibly `css/styles.css` (read-only — find the rule, override elsewhere)

### Files explicitly off-limits

- `css/styles.css` — never edit
- Standard hard-rules list (asset-resolver, common.js shell, normalize-payload, /share/, /th/)

### Suggested first session

1. Bundle with BUG-007 diagnosis.
2. Inspect computed color in Safari devtools.
3. Identify the source rule.
4. Decide whether to override globally (token change) or scoped to `daily.html`.

---

## BUG-009 — daily.html "Re-draw" button is redundant

**Status:** Closed — not reproducible.
**Priority:** Low (UX cleanup, not a defect).
**Reported:** 2026-05-03.

**Closing note (2026-05-03):** Verified during the BUG-007 bundled-fix session. There is no Re-draw button in `daily.html` markup — `grep -nE "redraw|re-draw|Re-draw|Redraw" daily.html` returns zero matches. The static markup contains only `id="daily-continue"` (Continue) and `id="daily-deal-shuffle"` (Deal).

The "Re-draw" / "เปิดไพ่อีกครั้ง" string at `js/reading.js:3730` targets `document.getElementById('newReadingBtn')` (`js/reading.js:234`). No HTML page in the repo contains an element with `id="newReadingBtn"`. The lookup returns `null` and all surrounding handlers (`if (newReadingBtn)`, `newReadingBtn?.addEventListener`) cleanly null-guard, so the entire code path no-ops at runtime.

The dead `newReadingBtn` code path is filed separately as **BUG-013**.

### Symptom

`daily.html` has a "Re-draw" button. The bottom-nav menu already has a "Draw" action. Two ways to do the same thing creates friction and visual clutter.

### Suspected root cause

Predates the bottom-nav addition. Was the only draw entry point before; now duplicated.

### Why this isn't a drive-by fix

Removing UI requires confirming no behavioral difference between "Re-draw" and bottom-nav "Draw" — they may handle existing-card state differently (e.g., Re-draw replaces the current card, Draw goes to a fresh state). Verify behavior parity before deletion. Also bundle with BUG-007 diagnosis since same page.

### Files involved

- `daily.html`
- `js/daily.js` or wherever the Re-draw handler lives

### Files explicitly off-limits

- Standard hard-rules list

### Suggested first session

1. Bundle with BUG-007 + BUG-008.
2. Confirm Re-draw and bottom-nav Draw produce identical UX.
3. Then remove the Re-draw button markup + handler.

---

## BUG-010 — /today page unscrollable, image too large

**Status:** Reported, URL needs verification.
**Priority:** Medium (page is unusable on mobile).
**Reported:** 2026-05-03.

### Symptom

The page at `meowtarot.com/today` cannot be scrolled. The hero image takes up so much viewport that content below is unreachable.

### Suspected root cause

Likely a `height: 100vh` / `overflow: hidden` combination on the page container, plus an unconstrained image size. The `100dvh` fix used in Phase 4 may apply here too.

### Why this isn't a drive-by fix

First — verify the actual URL. Is `/today` a separate page, or a redirect to `/daily-card/`, or to `daily.html`? Identify the route before touching anything. Second — image sizing on cat-tarot illustrations is sensitive; many existing image rules cap at specific dimensions to preserve the artwork's framing. Don't shrink blindly.

### Files involved

- TBD pending URL identification. Likely `today.html` or `daily-card/index.html` plus its CSS.

### Files explicitly off-limits

- Standard hard-rules list

### Suggested first session

1. Resolve `/today` to an actual file/route (`grep -rn "today" *.html` or check the server config).
2. Inspect on iPhone Safari, identify what's blocking scroll.
3. Tighten image `max-height` and ensure container scrolls.

---

## BUG-011 — Features tab in bottom nav points to outdated features.html

**Status:** Closed — superseded by 9c1231b (2026-05-06).
**Priority:** Medium (currently routes users to the old chooser layout that Phase 4 replaced).
**Reported:** 2026-05-03.

**Closing note (2026-05-07):** Closed by commit `9c1231b` (2026-05-06). Implementation differs from the original spec — instead of just rerouting the Features tab to `/`, the bottom-nav tab was relabeled "Home" with `href="/index.html"` and 🏠 icon, with parallel TH treatment ("หน้าแรก", `/th/index.html`). Lives in `js/bottom-nav.js` (NOT `js/common.js` — the off-limits worry in the original BUG-011 entry was misplaced; bottom nav is JS-injected via `bottom-nav.js`, not `common.js`).

### Symptom

The bottom-nav "Features" tab links to `/features.html`, which is the old 3-card chooser layout. Now that Phase 4 is live, this is a confusing detour to a stale design.

### Decision (made, not pending)

Repoint the Features tab `href` to `/` (the new Phase 4 homepage). Do not delete `features.html` — leaving it as an orphaned `noindex` URL is fine and preserves any inbound links.

### Why this isn't a drive-by fix

The bottom nav is rendered by `js/common.js` (off-limits hard rule) or by inline HTML on each page. Identify which before editing. If it's in `js/common.js`, this likely violates the off-limits rule and needs a workaround (e.g., override the link via CSS or a small post-injection JS hook on each page). If it's hardcoded HTML, it's a multi-file find-and-replace across all EN pages.

### Files involved

- TBD pending grep — `js/common.js` (off-limits — read-only inspection), each EN page's bottom-nav markup if hardcoded.

### Files explicitly off-limits

- `js/common.js` shell — never modify. If the nav is rendered there, find another path.
- Standard hard-rules list otherwise.

### Suggested first session

1. `grep -rn "features.html" --include='*.html' --include='*.js'` to locate every reference.
2. If `common.js`: design a workaround (hint: per-page override, or a config object `common.js` reads).
3. If hardcoded: edit each page consistently.
4. Update TH equivalents only if Phase 7 has shipped — otherwise note as deferred.

---

## BUG-012 — Pages build fails on every user push, auto-log push recovers it

**Status:** Reported, root cause hypothesis only.
**Priority:** Low (no production impact — site stays current).
**Reported:** 2026-05-03.

### Symptom

Every push to `main` since 2026-05-01 produces an `errored` Pages build. The auto-log workflow's follow-up push (8–10 seconds later) always succeeds. Six builds confirm the pattern.

### Suspected root cause

Jekyll on GitHub Pages tries to process `LOG_DRAFT.jsonl` and fails. The auto-log workflow archives the draft to `.log-draft-archive/` and removes it from the root before its push, so its push has no offending file. Hypothesis only; not verified.

### Why this isn't a drive-by fix

The fix is probably one of: (a) add `LOG_DRAFT.jsonl` to a `.nojekyll` exclude, (b) add `_config.yml` exclude rule, (c) move `LOG_DRAFT.jsonl` to a directory Jekyll ignores by default. Wrong choice could break the auto-log workflow itself. Need to read auto-log workflow source before deciding.

### Files involved

- `.github/workflows/*.yml` (read-only inspection)
- Possibly new `.nojekyll` or `_config.yml`

### Files explicitly off-limits

- Don't touch the auto-log workflow logic itself — it's working.

### Suggested first session

1. Read the failed build error from `gh api repos/dunkin-novice/meowtarot/pages/builds/<failed-id>` to confirm the `LOG_DRAFT.jsonl` hypothesis.
2. If confirmed, check whether `.nojekyll` already exists at repo root.
3. Pick the least-invasive fix.

---

## BUG-013 — Dead `newReadingBtn` handler in `js/reading.js`

**Status:** Reported.
**Priority:** Low (no user-visible effect; code path doesn't run).
**Reported:** 2026-05-03.

### Symptom

`js/reading.js:3713-3757` contains a "Re-draw" / "เปิดไพ่อีกครั้ง" code path keyed off `document.getElementById('newReadingBtn')` (lookup at `js/reading.js:234`). No HTML page in the repo has an element with `id="newReadingBtn"`, so the lookup returns `null` and all handlers null-guard (`if (newReadingBtn)`, `newReadingBtn?.addEventListener`) to no-op. The entire code path is unreachable at runtime.

Surfaced during BUG-009's closing diagnosis — the "Re-draw" button BUG-009 reported was actually never present in `daily.html`; the JS for it exists but has no DOM target.

### Suspected root cause

Scaffolding that never landed, or markup removed in a refactor without removing the JS handler. Git blame would tell.

### Why this isn't a drive-by fix

Two reasonable directions: (a) delete the dead JS code path (smallest diff, but loses a feature that may have been in-flight), or (b) restore the missing markup (re-introduces the redundancy BUG-009 worried about). Need a product call: was `newReadingBtn` ever supposed to exist, and if so where? Also worth a sweep for other dead `getElementById` lookups before patching just this one.

### Files involved

- `js/reading.js` — lines 234 (lookup), 3713–3757 (handler block)
- `js/common.js` — i18n entries `dailyRedraw` at lines 30 (EN) and 269 (TH)

### Files explicitly off-limits

- `js/asset-resolver.js`, `js/common.js` shell, `share/normalize-payload.js`, `/share/`, `/th/` (standard hard-rules list)
- The `dailyRedraw` i18n keys themselves should not be removed without confirming they're not used elsewhere.

### Suggested first session

1. `git blame -L 234,234 js/reading.js` and `git blame -L 3713,3757 js/reading.js` to find when the handler was added and what markup change might have removed the button.
2. Decide direction (a) vs (b) above.
3. Sweep for other null-target `getElementById` calls in `js/reading.js` while scoped to this area.

---

## BUG-014 — LOG_DRAFT.jsonl conflict on every multi-commit session

**Status:** Reported, verified (recurring, observed twice consecutively).
**Priority:** Low (workflow friction, no production impact).
**Reported:** 2026-05-14

### Symptom

Every multi-commit session hits a rebase conflict in `LOG_DRAFT.jsonl` on `git pull --rebase origin main`. Observed twice consecutively on 2026-05-13 during deck-switching work — once after the wiring commits, again after the `getCardBackUrl` fix. Hand-resolution each time: drop the entries that were already processed into `docs/log.jsonl`, keep only the new one, `git rebase --continue`.

Also observed: back-to-back pushes within ~10s race with auto-log workflow, causing rejected push on the second commit. Recovery: git pull --rebase + git push. Same root cause as the LOG_DRAFT conflict.

### Suspected root cause

The auto-log GitHub Action clears `LOG_DRAFT.jsonl` on every push (per CLAUDE.md L126: "appends to docs/log.jsonl, and clears the draft"). The commit recipe currently sequences the steps as:

1. Stage + commit code.
2. Append LOG_DRAFT entry locally (against pre-clear state — file still has old entries).
3. Commit docs(log).
4. `git pull --rebase origin main`.
5. Push.

Because step 2 runs before step 4, the local `LOG_DRAFT.jsonl` is built on top of the not-yet-pulled (not-yet-cleared) file. When step 4 pulls, remote has been cleared by the auto-log's own push that landed after the previous user push — rebase sees HEAD=empty vs local=stale+new, producing a conflict every iteration.

### Reported fix

Re-order the recipe so `git pull --rebase origin main` runs BEFORE writing the LOG_DRAFT entry — write against the freshly-cleared state:

1. Stage code files.
2. Commit code change. Capture SHA.
3. `git pull --rebase origin main` (sync with cleared LOG_DRAFT).
4. Append new LOG_DRAFT entry against the now-empty file. Replace TBD with SHA from step 2.
5. Stage + commit LOG_DRAFT.
6. Push.

Alternative considered: change the auto-log workflow to merge instead of overwrite. Rejected — risks breaking the auto-log itself (per BUG-012 closing note: don't touch the workflow). Recipe re-order is the smaller, safer change.

### Why this isn't a drive-by fix

This is a process/workflow change, not a code change. The fix lives in:

- The session prompts the founder gives Claude (the "commit recipe" templates).
- Possibly CLAUDE.md's "Session logging" section (L109–131), which describes the LOG_DRAFT workflow but doesn't prescribe step ordering.

Either update CLAUDE.md to document the correct order, or update the founder's prompt templates, or both. No code edit required.

### Files involved

- `CLAUDE.md` (Session logging section, L109–131) — candidate for documenting the ordering.
- `LOG_DRAFT.jsonl` — affected file.

### Files explicitly off-limits

- `.github/workflows/*.yml` — auto-log workflow (per BUG-012: "Don't touch the auto-log workflow logic itself — it's working").

### Suggested first session

1. Inspect `git reflog` for the last 3–4 rebase-continue events to confirm the pattern is deterministic.
2. Decide where the fix lives: CLAUDE.md update, prompt-template change, or both.
3. If CLAUDE.md update: add one line to the Session logging section prescribing "`git pull --rebase origin main` before writing the LOG_DRAFT entry, not after".
4. Validate on the next ship-able change: run the re-ordered recipe end-to-end without conflict.

---

## BUG-015 — Capacitor mirror trees partially tracked — `git add .` footgun

**Status:** Reported, verified by direct observation.
**Priority:** Low (no production impact; footgun risk for future commits).
**Reported:** 2026-05-14

### Symptom

`ios/App/App/public/` and `www/` each contain ~80+ untracked sibling files (full `*.html`, most of `js/*.js`, `assets/`, `cards/`, `data/`, `th/`, etc.) alongside the 4 files tracked in commit `3965b5c` on 2026-05-14 (`data.js` + `asset-resolver.js` for both trees). A casual `git add .` or `git add ios/` from any contributor — founder, future Claude session, CI — would dump hundreds of mirror-tree files into a single commit, possibly with stale content. The mirrors are `sync:cap` output of the root tree, but Capacitor itself is not installed in the repo so sync is manual; there's no guarantee the untracked siblings are current with their root-tree originals.

### Suspected root cause

The asymmetry was introduced by the manual `sync:cap` workflow on 2026-05-14. Prior to commit `3965b5c`, both `ios/` and `www/` were 100% untracked (visible in earlier `git status` output during the session). The 2026-05-14 sync tracked only the 2 files that had just changed in `js/` (per memory `[[project_meowtarot_capacitor]]`'s dual-tree gotcha) rather than the full mirror. That selective tracking is fine in isolation but creates a partially-tracked-directory state going forward.

### Reported fix

Three options to weigh, no decision yet:

**(a)** `.gitignore` the untracked siblings. Keeps repo lean. Breaks the "track manually as needed" pattern just established — would need `!` whitelist rules for the 4 already-tracked files. Risks future `sync:cap` updates silently dropping files from version control.

**(b)** Track everything intentionally. Large one-time commit (~160 new files). Eliminates the asymmetry; future syncs become a normal `git add -A ios/ www/`. Bloats the repo.

**(c)** Leave as-is with explicit warning in `CLAUDE.md`. Cheapest. Relies on every future contributor reading the warning before running `git add`.

### Why this isn't a drive-by fix

Decision required between (a)/(b)/(c) before any change — each has different implications for how future `sync:cap` operations behave. (a) and (b) are reversible but noisy in git history; (c) is free but only effective if read. Also worth confirming the founder's actual intent on the iOS/PWA shipping plan — if Capacitor will be properly installed and `sync:cap` automated soon, the right answer may be "wait, then choose (a) with the right whitelist."

### Files involved

- `ios/App/App/public/` — partially tracked tree
- `www/` — partially tracked tree
- `.gitignore` — may need new entries depending on chosen option
- `CLAUDE.md` — may need new guidance depending on chosen option
- Memory: `[[project_meowtarot_capacitor]]` — already documents the dual-tree gotcha; could be updated with the new tracking-asymmetry note

### Files explicitly off-limits

- None beyond standard hard-rules list (asset-resolver, common.js shell, normalize-payload, /share/).

### Suggested first session

1. Confirm the asymmetry: `git ls-files ios/ www/ | wc -l` vs `git status --porcelain ios/ www/ | wc -l`.
2. Decide the iOS/PWA plan — is Capacitor going to be properly installed soon, or stay manual indefinitely? Answer shapes the choice.
3. Pick (a), (b), or (c). If (a), draft the `.gitignore` patch with explicit `!` whitelist for currently-tracked mirror files (run `git ls-files ios/ www/` to enumerate).
4. If (b), do one focused commit per tree to keep history readable: one for `www/`, one for `ios/App/App/public/`.
5. Update memory `[[project_meowtarot_capacitor]]` either way to note the resolution.

---

## BUG-016 — Deck unlock popup fires for unauthenticated users with wrong deck on poster

**Status:** Reported, not yet verified or triaged.
**Priority:** High — hits every first-time visitor before login.
**Reported:** 2026-05-14

### Symptom

A first-time user (never logged in) completed a daily reading and received the "Boba Oracle is yours" deck unlock popup (D1 milestone). Three compounding issues:

1. **No auth gate:** The deck unlock popup fired for a user who was not signed in. Streak-based deck unlocks should be gated behind authentication — an anonymous reading should not trigger milestone rewards.
2. **Popup timing:** The popup fired during the reading flow, not after the user exited the reading page. Expected behaviour: deck unlock notification should appear on the next page load, on return visit, or on sign-in — not mid-draw.
3. **Deck identity mismatch on poster:** After the popup fired, the result page showed meow-v2 card backs, but the share poster rendered Boba Oracle card backs. Root cause likely: "Use this deck now" in the popup called setActiveDeck('boba-oracle') mid-session; the result page DOM was already painted with meow-v2 and was not repainted; the poster generation called getCardBackUrl() fresh and picked up the newly-set active deck.

### Suspected root cause (unverified)

- Issue 1: trackCompletedDailyReading and showDeckRewardPopup in reading.js:2606 have no auth check. They fire based on localStorage streak state regardless of whether a Supabase session exists.
- Issue 2: showDeckRewardPopup is called inline in the if (didCount) block immediately after the draw completes. No deferral to page transition or next session.
- Issue 3: setActiveDeck is called synchronously when user taps "Use this deck now" inside deck-reward.js. Already-painted DOM nodes on the result page are not repainted. Poster generation reads getCardBackUrl() at render time and gets the new deck.

### Files likely involved

- js/reading.js (trigger at ~L2606)
- js/deck-reward.js (showDeckRewardPopup, setActiveDeck call on CTA)
- js/progress.js (trackCompletedDailyReading — missing auth gate)
- js/auth.js (to read current auth state)
- poster.js (deck identity used for poster render)

### Why this isn't a drive-by fix

Three separate fix points: (1) auth gate in the daily reading completion path, (2) popup deferral strategy decision (next page load vs next sign-in vs end of reading animation), (3) result-page repaint or "Use this deck now" deferral to prevent mid-session deck switch from splitting result vs poster identity.

### Suggested first session

1. Verify: complete a reading while logged out, confirm popup fires and poster deck mismatch.
2. Add auth check before showDeckRewardPopup call in reading.js — if no active Supabase session, skip popup entirely.
3. Decide popup timing strategy (defer to next page load is simplest).
4. In deck-reward.js "Use this deck now" handler: either defer setActiveDeck to next page load, or trigger a result-page card back repaint after switching.

---

## BUG-017 — 3rd card missing purple glow on selection in Ask a Question mode

**Status:** Reported, not yet verified or triaged.
**Priority:** Medium — visual feedback gap, not blocking functionality.
**Reported:** 2026-05-14

### Symptom

In Ask a Question reading mode: after shuffle, when selecting 3 cards in sequence, the 3rd selected card does not display the purple glow (selection highlight). The glow appears correctly on cards 1 and 2. The 3rd card's glow renders correctly after the user scrolls — suggesting the painted state is correct but the visual update is deferred until a scroll-triggered repaint.

### Suspected root cause (unverified)

Likely a browser paint/compositing issue. The 3rd card may be partially outside the visible viewport when selected, causing the CSS glow state to be applied to the DOM but not composited to screen until a scroll event forces a repaint. Possible causes: CSS will-change or transform layer not promoting the element; overflow:hidden on a parent clipping the box-shadow or outline used for the glow; or an animation that only fires on elements within the intersection observer's viewport threshold.

### Files likely involved

- css/styles.css (purple glow / selection state styles)
- js/reading.js (card selection logic — where the selected class or attribute is set on the 3rd card)

### Suggested first session

1. Reproduce: Ask a Question mode → shuffle → select 3 cards in sequence → observe 3rd card glow.
2. Inspect the 3rd card's DOM after selection — confirm the selected class/attribute is present.
3. Check if the glow uses box-shadow, outline, or border. Test if adding transform: translateZ(0) to the card forces GPU compositing and resolves the deferred paint.
4. Check if the 3rd card is below the fold when selected — if so, the fix may be scrollIntoView() after selection, or ensuring the glow style triggers a compositing layer.

---

**BUG-018**
File: js/asset-resolver.js
Line: (grep for FALLBACK_BACK_PACK)
Issue: FALLBACK_BACK_PACK is hardcoded to 'meow-v2', which has been retired as a deck ID. Should be 'moonmallow'.
Impact: If asset resolution fails to find a card back for any deck, it falls back to the meow-v2 CDN folder instead of moonmallow. CDN folder still exists so no visible breakage today, but creates implicit dependency on a retired ID.
Fix: Change FALLBACK_BACK_PACK = 'meow-v2' to FALLBACK_BACK_PACK = 'moonmallow' in js/asset-resolver.js.
Note: js/asset-resolver.js is off-limits — re-authorize explicitly before fixing.
Status: Open
Date filed: 2026-05-19

---

## BUG-019 — Streak-locked deck persists for anonymous users via localStorage

**Status:** Resolved 2026-05-20 (see Resolution section below).
**Priority:** Medium — T-12 violation at the selection layer; cosmetic but undermines unlock logic.
**Reported:** 2026-05-20

### Symptom

Anonymous user (not signed in) sees a streak-locked deck (e.g. `boba-oracle`) as their active deck. The deck-inventory page shows it selected even though the user has no session.

### Suspected root cause (unverified)

`activeDeckId` is persisted in localStorage from a previous logged-in session. On logout, auth state is cleared but `activeDeckId` is not reset to `moonmallow`. On next anonymous visit, `getActiveDeckId()` reads the stale localStorage value and returns `boba-oracle`, bypassing `canUnlockDeck()` at the selection layer (though `canUnlockDeck()` itself is correct — the gate is the deck selection, not the unlock check).

### Reported fix

On logout, call `localStorage.removeItem('activeDeckId')` (or equivalent reset to `moonmallow`) before clearing auth state.

### Files involved

- `js/data.js` — `getActiveDeckId()`, logout flow, `canUnlockDeck()`
- `js/auth.js` — logout handler (where the localStorage clear should happen)

### Files explicitly off-limits

- `js/asset-resolver.js` — CLAUDE.md hard rule #4, never modify
- `share/normalize-payload.js` — CLAUDE.md "ask before modifying" list

### Suggested first session

1. Reproduce on live site: log in, switch to `boba-oracle`, log out. Confirm `boba-oracle` still shows as active deck for the anonymous session.
2. Read `js/auth.js` logout handler — confirm whether `activeDeckId` is cleared on logout.
3. Apply the reported fix: clear (or reset to `moonmallow`) the active-deck localStorage key in the logout path before auth state teardown.
4. Verify `canUnlockDeck()` remains the single source of truth — this fix is additive, not a replacement for the gate. Add a regression check that anonymous `getActiveDeckId()` cannot return a streak-locked deck regardless of stale localStorage.

### Resolution (2026-05-20)

**Reported root cause was wrong.** Diagnosis on triage showed the localStorage clear was already in place — `js/auth.js:118–131` clears `meowtarot_active_deck` (along with 10 other user-state keys) inside the `logout()` function. That cleanup was added 2026-05-14 in commit `f7817aa1`, six days before the bug was filed. So localStorage state was NOT the actual culprit.

**Actual root cause:** stale module-level cache in `js/data.js`. The line `export let activeDeckId = getActiveDeckId();` runs once at module load. After `logout()` clears localStorage, `getActiveDeckId()` (which re-reads localStorage) correctly returns `moonmallow`, but the cached `activeDeckId` variable still holds the pre-logout deck id until the page hard-reloads. Consumers of `getActiveDeck()` (line 125–127) read the cached variable, not localStorage, so they see the stale value.

**Reproduction model:** SPA-style logout (no hard reload) → deck-inventory re-renders → reads stale module cache → shows streak-locked deck as active. Hard reload re-inits the module → bug self-heals.

**Fix shipped (commit `97b9c4f`):**
- Added `resetActiveDeck()` to `js/data.js` — sets the module cache back to `DEFAULT_DECK_ID`.
- Extended `js/auth.js` `onAuthStateChange` listener to call `resetActiveDeck()` when `_event === 'SIGNED_OUT'`. Placed after the `authListeners.forEach` fanout, before `maybeShowLoginReward` and pendingClaim gates.
- Import line on `js/auth.js:2` extended to include `resetActiveDeck`.

**Why this works regardless of timing:** the SIGNED_OUT event is the canonical Supabase signal for a just-completed logout, fires synchronously inside the auth listener, and resets the module cache before any UI re-render that calls `getActiveDeck()` reads from the cache. Belt-and-suspenders defense (re-reading from localStorage inside `getActiveDeck()`) was considered but deferred — `resetActiveDeck()` covers all current paths.

**Not changed:** `canUnlockDeck()` (line 129–144) remains the single source of truth for the unlock gate. This fix is additive — it ensures the cache is consistent with localStorage at the SIGNED_OUT boundary, not a replacement for any gate.

---

## BUG-020 — No cross-deck FACE fallback (latent); user's "boba-oracle broke my cards" could not be reproduced

**Status:** NOT reproduced — initial "incomplete deck" diagnosis was WRONG (see Correction). Defensive fix #1 applied same session.
**Priority:** Medium (latent robustness gap; no confirmed live trigger)
**Reported:** 2026-06-04

### Symptom

A user reported that their phone, which had `localStorage['meowtarot_active_deck']` set to `boba-oracle` (set without sign-in), failed to load card faces on the reading **result** page. Clearing storage (resetting to default `moonmallow`) appeared to fix it.

### Correction (2026-06-04, same session)

⚠️ My first pass claimed "boba-oracle is incomplete — most cards 404" and marked it **verified**. **That was wrong.** The 404s came from hand-typed card slugs/numbers that don't match the real `card_id`s in `data/cards.json` (e.g. I tested `10-wheel-of-fortune` when the real id is `11-wheel-of-fortune`). Re-tested with the actual ids: **boba-oracle is COMPLETE** — all 78 upright cards return 200 with `?v=2026-03`, and a 13-card reversed sample is also all 200. So missing assets are **not** a confirmed cause, and the user's bug could not be reproduced from the CDN side. Likely real cause is **historical** (boba-oracle art may have lagged when the user hit it and has since been uploaded) and/or a **stale service-worker/cache** on the device that the storage clear incidentally cleared.

### What IS still true (the latent gap this entry now tracks)

1. `setActiveDeck()` persists the active deck for **anonymous** users via the deck-reward popup (`js/deck-reward.js:279`), `js/deck-inventory.js:116`, `js/decks.js:230`. (Same family as BUG-016 / BUG-019.)
2. There is **no cross-deck fallback to the DEFAULT deck's FACE.** `js/asset-resolver.js` only defines `FALLBACK_BACK_PACK = 'moonmallow'` for the card **back**. So *if* a deck's face is ever missing (a newly added deck whose art lags upload, a partial future deck), the app falls back to a card *back*, never the real moonmallow face — and this would silently degrade the share poster (hard rule #8). This is a real but currently-untriggered robustness gap.

### Reported fix

Fix #1 (caller-level cross-deck face fallback), applied 2026-06-04 to the reading result page and the **daily** poster only:

```
// at the callers (NOT asset-resolver.js): when the active-deck face URL is
// unavailable / 404s, insert the DEFAULT_DECK_ID (moonmallow) face URL into the
// fallback candidate list BEFORE any card back, by swapping the /assets/<deck>/
// path segment. Added to:
//   - js/reading.js   getCardImageUrlWithFallback()  candidate lists
//   - share/poster.js daily resolveCardImage() fallbackUrls
```

### Why this isn't a drive-by fix

- **`js/asset-resolver.js` is off-limits** (CLAUDE.md hard rule #4 — never touch it or the `resolvePosterCardImageSources` call order). The natural home for a cross-deck fallback (the resolver's fallback chain) cannot be edited, so the fix lives at the callers instead and is necessarily duplicated.
- Remaining gap: fix #1 only covers the reading result + daily poster. The **question / full / celtic** poster modes have the same latent break (other `resolvePosterCardImageSources` callers in `share/poster.js` at ~lines 1264, 1926, 2046, 2549) and still need the same fallback.

### Files involved

- `js/reading.js` (`getCardImageUrlWithFallback`) — reading result candidate list
- `share/poster.js` (daily `resolveCardImage`) — daily poster fallback chain
- `js/deck-reward.js:279`, `js/deck-inventory.js:116`, `js/decks.js:230` — where anonymous active-deck gets set
- `js/data.js` (`getActiveDeckId`, `DEFAULT_DECK_ID`) — active-deck resolution

### Files explicitly off-limits

- `js/asset-resolver.js` and the `resolvePosterCardImageSources` call order (CLAUDE.md hard rule #4).

### Suggested first session

1. Reproduce on live: set `localStorage.meowtarot_active_deck = 'boba-oracle'`, draw a daily card boba-oracle lacks (e.g. Wheel of Fortune), view result + generate poster → confirm broken/back card.
2. Verify fix #1 (reading result + daily poster): card now shows the moonmallow face when the active-deck face 404s.
3. Extend cross-deck face fallback to question / full / celtic poster callers in `share/poster.js`.
4. Decide on root-cause guard (b): add a per-deck `complete: true/false` flag in `js/data.js` and refuse to set an incomplete deck active (or treat it as default for assets). Coordinate with BUG-016 / BUG-019.
5. Add a `LOG_DRAFT.jsonl` entry; link BUG-016 / BUG-019.

---

## BUG-021 — Cold-load: daily board blank + reading "stuck" until the 4.6 MB cards.json downloads

**Status:** Reproduced headless + fixed same session (manifest split + background prefetch). On-device retest pending.
**Priority:** High (free-core: board unusable / reading appears broken on cold loads, esp. mobile/incognito)
**Reported:** 2026-06-07

### Symptom

On a cold (incognito / uncached) load, the daily selection board shows 12 card-backs but no selectable cards ("cards don't show first time"); a refresh fixes it. After selecting, the reading result page sits on "Please wait a moment…" for a long time ("reading doesn't load"). Both recover once the data is cached.

### Root cause (verified via headless Chrome)

Both the board (`loadTarotManifest`) and the reading page (`loadTarotData`) blocked on fetching `/data/cards.json` — **4.6 MB raw / 1.15 MB brotli**. `loadTarotManifest` fetched the FULL file then minimalised it client-side, so the board waited on 1.15 MB just to know card identities. Headless repro: board stayed `hidden:12 / withId:0` until `cards.json` completed (still blank at 11.5 s on throttled net), then populated the instant it landed; reading page re-fetched the same file.

### Fix applied (2026-06-07)

- **Manifest split:** new `scripts/generate-cards-manifest.mjs` emits `data/cards-manifest.json` (~28 KB raw / ~2–3 KB compressed — id/names/image/slug only). `loadTarotManifest()` now fetches the manifest first, falling back to the full `cards.json` if it's missing/shape-invalid (graceful degrade). Board populates ~right after JS loads (571 ms localhost vs 3450 ms prod).
- **Background prefetch:** `renderDaily` fires `loadTarotData()` via `requestIdleCallback` after the board is ready, so the full deck warms (HTTP + localStorage cache) while the user is choosing → the reading page loads from cache, no cold fetch after Continue (verified: reading no longer re-fetches `cards.json`).
- **Anti-drift:** `generate-seo.yml` regenerates the manifest on every push and commits it, so it can't fall out of sync with `cards.json`.

### Still open / follow-ups

- The full `cards.json` is still 4.6 MB raw — worth investigating a real size reduction (per-language or per-card split) so even an un-prefetched reading is fast. Background prefetch is a cache-warm, not a payload cut.
- Minor: tapping a card during the board's post-data re-render can miss (selection doesn't stick) — a smaller timing artifact of the renderDaily multi-render; not addressed here.
- Minor: `LocalNotifications.then()` throws an uncaught `CapacitorException` on web (a Capacitor plugin called in a browser context) — pre-existing, non-fatal; file separately if it matters.

### Files involved

- `js/data.js` (`loadTarotManifest`, `CARDS_MANIFEST_URL`) — manifest-first fetch
- `js/main.js` (`renderDaily`) — background prefetch of the full deck
- `scripts/generate-cards-manifest.mjs` (new), `data/cards-manifest.json` (new)
- `.github/workflows/generate-seo.yml` — regenerates the manifest on push
