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
