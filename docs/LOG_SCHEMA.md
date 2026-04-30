# MeowTarot Log Schema (v1)

> Format: **JSON Lines** (`.jsonl`) — one JSON object per line, append-only.
> File: `docs/log.jsonl`
> Audience: **AI agents only.** Humans don't read this. Claude Code, future Claude sessions, and any other coding agent query this file when debugging or recalling past work.
>
> Why JSONL: grep-able, jq-queryable, no merge conflicts on append, every entry self-contained.

## Required fields (every entry MUST have these)

| Field | Type | Notes |
|---|---|---|
| `id` | string | Unique. Format: `YYYY-MM-DD-shortslug` (e.g. `2026-04-27-bug3-v2`). |
| `date` | string | ISO 8601 date, `YYYY-MM-DD`. |
| `type` | enum | One of: `fix`, `feature`, `push`, `merge`, `shipped`, `infra`, `seo`, `analytics`, `qa`, `revert`, `chore`, `design`. |
| `status` | enum | `shipped`, `merged`, `draft-pr`, `qa-failed`, `deferred`, `reverted`. |
| `goal` | string | One sentence. What was the intent? |
| `done` | string | One or two sentences. What landed? |
| `commit` | string | Short SHA (7 chars). Auto-filled by workflow if missing. |
| `branch` | string | Branch name. Auto-filled. |

## Strongly recommended (include when applicable)

| Field | Type | Notes |
|---|---|---|
| `pr` | number | PR number if merged via PR. |
| `files` | array of string | File paths touched. Be specific — `js/reading.js` not `js/`. |
| `symptom` | string | For bug fixes: what the user/system saw before the fix. |
| `root_cause` | string | For bug fixes: the actual technical cause, not the symptom. |
| `fix` | string | For bug fixes: what was changed to resolve the root cause. |
| `affects` | array of string | Surfaces, pages, or user segments affected. E.g. `["156 card pages", "all .section-block surfaces"]`. |
| `verified` | array of string | How it was verified. E.g. `["claude-in-chrome 390px", "manual desktop spot-check"]`. |
| `supersedes` | string | ID of a prior entry this replaces (e.g. failed v1 PRs). |
| `related` | array of string | IDs of related entries — bugs, follow-ups, dependencies. |
| `filed` | array of string | New follow-up items this work surfaced but did not fix. Each is a short string describing the issue. |
| `guardrails_preserved` | array of string | MeowTarot's load-bearing rules confirmed not violated. E.g. `["asset-resolver-untouched", "en-th-parity", "i18n-via-common-only", "free-core-complete"]`. |

## Optional (use when useful)

| Field | Type | Notes |
|---|---|---|
| `notes` | string | Anything else an AI should know. Keep tight. |
| `deferred_to` | string | If status is `deferred`, why and to when. |
| `breaking` | boolean | True if behavior change could affect users or other systems. |
| `rollback_sha` | string | Commit SHA to revert to if this needs rolling back. |

## Workflow auto-fills

If Claude Code omits these, the GitHub Action fills them from git/PR context:

- `commit` (from `github.sha`)
- `branch` (from `github.ref`)
- `pr` (if triggered by PR merge)
- `pr_title`, `pr_body_excerpt` (first 500 chars of PR description, for fallback context)
- `pusher` (from `github.event.pusher.name` or PR author)
- `merged_at` / `pushed_at` (ISO 8601 timestamp)

## Example entries

### Bug fix
```json
{"id":"2026-04-27-bug3-v2","date":"2026-04-27","type":"fix","status":"shipped","goal":"Fix mobile horizontal text clipping on /cards/[slug]/ pages","done":"Replaced minmax(320px, 1fr) with minmax(min(320px, 100%), 1fr) on .section-block","files":["css/styles.css"],"symptom":"horizontal text overflow on viewports below ~370px on all card meaning pages","root_cause":".section-block grid-template-columns enforces min column width exceeding container at narrow viewports","fix":"global one-line CSS change preserving behavior at >=320px container width","affects":["156 EN+TH card pages","all .section-block surfaces sitewide"],"verified":["claude-in-chrome 390px","desktop 1276px","reading-result regression"],"supersedes":"2026-04-27-bug3-v1","related":["2026-04-27-bug2-spread-label"],"filed":["meanings.html .featured-link-item overflow predates this fix"],"guardrails_preserved":["asset-resolver-untouched","no-js-changes","en-th-parity"],"pr":370,"commit":"abc1234","branch":"fix/section-block-mobile-overflow"}
```

### Feature ship
```json
{"id":"2026-04-27-bottom-nav","date":"2026-04-27","type":"feature","status":"shipped","goal":"Ship mobile bottom-tab app shell to convert perception from website to product","done":"5-tab nav (Features/Today/Draw/Cards/Profile) with raised center Draw button, EN/TH localized, route exclusions for /share/ /sharekit/ /docs/","files":["js/bottom-nav.js","css/bottom-nav.css","js/common.js","features.html","today/index.html","th/today/index.html","sitemap.xml"],"affects":["all reading and content pages site-wide on mobile"],"verified":["claude-in-chrome iphone-14-pro 390x844","7 QA sections covered"],"filed":["spread-label-overlap-question-full","question-card-board-mobile-clipping","card-meaning-horizontal-text-clipping"],"guardrails_preserved":["asset-resolver-untouched","en-th-parity","desktop-unchanged"],"notes":"center Draw routing changed to /daily.html later same day in Daily Reading product model fix","commit":"def5678","branch":"feature/bottom-nav"}
```

### QA failure (still useful for AI to know what was tried)
```json
{"id":"2026-04-27-bug3-v1-qa-fail","date":"2026-04-27","type":"qa","status":"qa-failed","goal":"Validate Bug 3 mobile clipping fix on EN/TH /cards/ pages","done":"6-test mobile QA, tests 1-3 FAILED on 11 pages, tests 4-6 PASSED","root_cause":"patch targeted .card-meta but actual overflow source was .section-block grid min-width","fix":null,"supersedes":null,"related":["2026-04-27-bug3-v2"],"notes":"Failed PR closed manually after v2 shipped. Same root cause likely affects bug2 spread label overlap.","commit":"0a1d15a","branch":"fix/card-meaning-mobile-clipping"}
```

## Rules for Claude Code (writers)

1. **One entry per logical patch**, not per commit. A 5-commit branch that ships one bug fix = one entry.
2. **Multi-pass implementations get one entry** that reflects the final state. Earlier failed attempts can be referenced via `supersedes` and `related`.
3. **`root_cause` must be technical, not symptomatic.** "Page broken on mobile" is a symptom; "grid-template-columns min exceeded viewport" is a root cause.
4. **`files` must be exact paths**, not directories. AI retrieval depends on this.
5. **`filed` is for new bugs surfaced but not fixed.** Each item should be debuggable on its own — short but specific.
6. **`guardrails_preserved` is mandatory for any patch that could plausibly violate one.** Pick from MeowTarot's load-bearing rules: `asset-resolver-untouched`, `en-th-parity`, `i18n-via-common-only`, `free-core-complete`, `legacy-share-links-compat`, `no-direct-gtag`.
7. **Never delete or edit prior entries.** Errors get a new entry with `supersedes`.
8. **JSON must be valid and on a single line.** No pretty-printing in the file.
