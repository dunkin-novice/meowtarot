# Cowork Brief — MeowTarot Mechanical Maintenance

**Owner:** Dunkin
**Repo:** `/Users/kitikornrakhangthong/projects/MeowTarot`
**Domain:** `meowtarot.com`
**Cadence:** Daily (lightweight) + Weekly (deeper) + Monthly (audit)
**Mode:** Hands-off. Cowork runs unattended. No human review per cycle.
**Production safety:** Cowork never commits, pushes, or deploys. All changes land in the working tree only. Dunkin reviews and commits on his schedule.

## What Cowork is doing here

This system runs structural SEO and content-integrity maintenance on the MeowTarot codebase. It's specifically not doing creative content work — no rewrites, no prose generation, no judgment-calls about quality. The only job is catching mechanical drift before it compounds.

The strategic frame: SEO authority compounds slowly. The work that pays off in 2027 has to be in place by 2026. Mechanical drift (broken links, missing schema, sitemap rot, image alt-text gaps, hreflang inconsistencies) silently degrades that authority — the kind of degradation that's invisible until it costs months to recover from. Cowork's job is preventing that erosion automatically so Dunkin can spend his attention on the v1 mobile build.

## Hard safety rules

Cowork must follow these without exception.

1. No commits, no pushes, no merges, no branch operations. Cowork operates on the working tree. Dunkin commits.
2. No deployments. Cowork does not interact with Vercel, GitHub Actions, or any deploy surface.
3. No edits to off-limits files: `js/asset-resolver.js`, `js/common.js`, `share/normalize-payload.js`, anything under `share/`, anything under `th/` (other than the specific TH page mirrors when explicitly listed below). These are project hard-rules per `CLAUDE.md`.
4. Auto-fix only the explicitly-listed safe operations (Section "Daily auto-fix tasks" below). Everything else is flag-only.
5. Log every action. Append to `cowork-maintenance-log.md` at the repo root. Format: ISO date, cycle type, action, file affected, outcome.
6. Same issue logged 3 days running → escalate. Add an `[ESCALATE]` tag to the log entry. Don't try to "fix harder."
7. On any error or unexpected state → log and skip. Never retry-and-retry. Never act outside the brief to recover.

## Daily cycle (every weekday morning, ~5–10 min)

Run these in order. Stop at the first hard error and log; don't continue.

### D1. Sitemap reconciliation
Read `sitemap.xml`. For every URL listed, run a HEAD request. Log:
* 200 → `OK`
* 301/302 → `REDIRECT to <target>` (don't auto-fix; sitemap should reflect canonical URLs, not redirects)
* 404 → `BROKEN`
* 5xx → `ERROR`
If any URL is missing from the sitemap that exists in the repo (e.g., a card page in `cards/<name>/index.html` not present in the sitemap), log as `MISSING_FROM_SITEMAP`.
Auto-fix: None. All findings flag-only.

### D2. Internal link integrity
For every `.html` file in the repo, extract every `href` that starts with `/`, `https://meowtarot.com`, or `https://www.meowtarot.com`. Verify each link's target exists in the repo (file path resolves) or in the sitemap.
Log broken internal links as `BROKEN_INTERNAL_LINK` with the source file, the target URL, and the line number.
Auto-fix: None. Broken links could indicate intentional staging URLs or new pages not yet built — Dunkin decides.

### D3. Card-pages canonical-tag sweep
For every file matching `cards/*/index.html` and `th/cards/*/index.html`:
* Verify a `<link rel="canonical" href="...">` tag exists in `<head>`.
* Verify the canonical URL matches the page's actual URL (i.e., the EN card page's canonical points to the EN URL, not the TH).
* Verify a corresponding `<link rel="alternate" hreflang="th" href="...">` (and `hreflang="en"`) tag exists for cross-language pairing.
Log issues as `CANONICAL_MISSING`, `CANONICAL_WRONG`, or `HREFLANG_MISSING`.
Auto-fix: Cowork may add a missing `hreflang` tag if and only if the corresponding language version of the page exists at the expected mirror path. Do not auto-fix `canonical` tags — those require knowing which page is the source of truth.

### D4. Image alt-text presence
For every `.html` file in the repo, find every `<img>` tag. Check:
* Has an `alt` attribute? (Empty alt is fine for decorative images.)
* If `alt` is missing entirely, log as `IMG_MISSING_ALT` with the file and image src.
Auto-fix: None. Filling alt-text requires content judgment.

### D5. Daily summary
At the end of the daily cycle, append a single summary line to `cowork-maintenance-log.md`:
```
[YYYY-MM-DD daily] D1: <broken count>, D2: <broken count>, D3: <issues count>, D4: <missing count>
```
If counts are all zero, still log the line — it's the signal that Cowork ran successfully.

## Weekly cycle (Sundays, ~30 min)

Runs in addition to the daily cycle on Sundays.

### W1. Hreflang round-trip audit
For every EN card page (`cards/*/index.html`), verify:
* It has `<link rel="alternate" hreflang="th" href="https://meowtarot.com/th/cards/<slug>/">`
* The TH counterpart exists at `th/cards/<slug>/index.html`
* The TH counterpart has `<link rel="alternate" hreflang="en" href="https://meowtarot.com/cards/<slug>/">` pointing back
Round-trip integrity matters for SEO. Log mismatches as `HREFLANG_BROKEN_PAIR`.
Auto-fix: Cowork may add the reciprocal `hreflang` tag if exactly one direction is missing and the target page exists. If both sides are missing or the slug doesn't match, flag-only.

### W2. Schema markup validation
Run `node validate-seo-coverage.mjs` (the project's existing validator script per Dunkin's project memory). Log full output verbatim.
If the script exits non-zero, log as `SCHEMA_VALIDATION_FAILED` with the exit code and the relevant file. Don't try to interpret or fix.
Auto-fix: None.

### W3. Outbound link freshness
For every external link (non-`meowtarot.com`) in the repo, run a HEAD request. Log:
* 200 → `OK_EXTERNAL`
* 301/302 → `REDIRECT_EXTERNAL to <target>`
* 4xx/5xx → `BROKEN_EXTERNAL` (rate-limit-aware: max 1 request/sec, max 100 external links per cycle to avoid being a bad netizen)
Auto-fix: None. Outbound link rot requires editorial decision.

### W4. Sitemap freshness
Compare the sitemap's `<lastmod>` dates against the actual file `mtime` of each page. If the sitemap claims a page was last modified more recently than the file actually was, log as `SITEMAP_LASTMOD_INCORRECT`.
Auto-fix: Cowork may update `<lastmod>` to match actual file `mtime` if and only if the difference is greater than 7 days. Smaller drifts could be normal during active development.

### W5. Weekly summary
```
[YYYY-MM-DD weekly] W1: <pairs broken>, W2: <schema status>, W3: <external broken>, W4: <lastmod fixed>
```

## Monthly cycle (1st of the month, ~1 hour)

In addition to daily + weekly.

### M1. Full content inventory
List every `.html` page in the repo with:
* File path
* File mtime
* Word count (text content only, ignore markup)
* Has canonical: yes/no
* Has hreflang pair: yes/no
* Position in sitemap: indexed / missing / 404
Output to `cowork-maintenance-inventory-YYYY-MM.md` (overwrite previous month). Don't compare to last month — that's Dunkin's call to look at trends.
Auto-fix: None. This is reporting only.

### M2. Thin content flag
For every card page, if word count is below 200 words, log as `THIN_CONTENT_CARD`. (200 is a low threshold; pages below this are structurally insufficient for ranking.)
Auto-fix: None. Content additions are out of scope.

### M3. Stale content flag
For every page with file `mtime` older than 365 days, log as `STALE_PAGE`. This is informational — old isn't bad if the content's still right, but it's a flag for review.
Auto-fix: None.

### M4. Monthly summary
```
[YYYY-MM-DD monthly] Pages: <total>, Thin: <count>, Stale: <count>, Inventory: cowork-maintenance-inventory-YYYY-MM.md
```

## What's explicitly out of scope

Cowork must not do these things even if they seem helpful:
* Rewrite or polish prose
* Add new content sections to existing pages
* Generate FAQ entries, meta descriptions, or copy of any kind
* Update card meanings, archetypes, or any field in `cards.json`
* Touch image files
* Modify `js/` files (other than reading them for href extraction)
* Modify CSS files
* Modify shipping/share/SEO configs (e.g., `_redirects`, `robots.txt`, `vercel.json`) without Dunkin explicitly approving
* Run any LLM call that produces new content text
If Cowork encounters a situation where one of these would seem useful, log as `OUT_OF_SCOPE_REQUEST` with details. Dunkin reviews and decides.

## Logfile format

Single file at repo root: `cowork-maintenance-log.md`. Append-only. Never edit historical entries.

Format per entry:
```
[2026-05-04 daily] D1: 0 broken, D2: 0 broken, D3: 0 issues, D4: 2 missing
  - D4: cards/the-fool/index.html line 47, img src=images/fool-symbolism.png missing alt
  - D4: th/cards/the-magician/index.html line 51, img src=images/magician-rwx.png missing alt
```

For weekly/monthly, same shape.

For escalations:
```
[2026-05-07 daily ESCALATE] D1: BROKEN_INTERNAL_LINK persisting 3 days
  - cards/the-fool/index.html line 102 → /cards/missing-card/ (404 since 2026-05-04)
```

## How Dunkin reviews this

Daily logs accumulate in `cowork-maintenance-log.md`. Dunkin opens the file when he wants. No notifications, no alerts, no slack pings.
If Dunkin wants to see only escalations, grep for `[ESCALATE]`. If he wants to see only one cycle type, grep for `daily`/`weekly`/`monthly`.
Once a month, Cowork will produce a fresh `cowork-maintenance-inventory-YYYY-MM.md`. Dunkin reads when convenient.
When Dunkin wants Cowork to stop, he renames or deletes this brief. Cowork should check at the start of every cycle that this brief still exists at its expected path; if not, halt.

## Initial setup tasks (run once before the first daily cycle)

1. Confirm working directory is `/Users/kitikornrakhangthong/projects/MeowTarot`.
2. Confirm `validate-seo-coverage.mjs` exists and runs (`node validate-seo-coverage.mjs --help` or equivalent).
3. Create `cowork-maintenance-log.md` if it doesn't exist. Write header line: `# Cowork Maintenance Log\n\nAppend-only. See cowork-maintenance-brief.md for cycle definitions.`
4. Run a test daily cycle in dry-run mode (log without auto-fixing). Confirm log output is clean.
5. After dry-run looks correct, enable auto-fix for D3 (hreflang) and W4 (sitemap lastmod) as the only auto-fix surfaces.

## When this brief evolves

Dunkin updates this file directly when scope changes. Cowork reads the brief at the start of every cycle, so changes take effect on the next run.
If Cowork's behavior diverges from this brief, the brief wins. If the brief is ambiguous, Cowork logs the ambiguity and skips the action.

End of brief. Last updated: 2026-05-04.
