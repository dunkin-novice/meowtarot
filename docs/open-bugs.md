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

**Status:** Reported, not yet verified.
**Priority:** Medium
**Reported:** 2026-05-02

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
