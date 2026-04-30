# MeowTarot Log System

This repo logs every push and every merged PR to `docs/log.jsonl` automatically via GitHub Actions. The log is **for AI consumption only** — humans don't read it. Future Claude sessions, debugging agents, and other coding agents query this file when they need historical context.

## How it works

```
You / Claude Code do work
        ↓
Append entry to LOG_DRAFT.jsonl  (one JSON object per line)
        ↓
git push  (or merge PR)
        ↓
GitHub Action runs
        ↓
Reads LOG_DRAFT.jsonl, fills in commit/branch/PR fields, appends to docs/log.jsonl
        ↓
Archives + clears LOG_DRAFT.jsonl
        ↓
Commits back with [auto-log] tag (workflow ignores its own commits — no loops)
```

If `LOG_DRAFT.jsonl` is empty or missing when a push happens, an `auto-stub` entry is appended so the push isn't lost. AI consumers can recognize stubs by `status: "auto-stub"` and fall back to reading the commit + PR directly.

## For Claude Code (and any agent doing work in this repo)

**At the end of every session that ships code, append one or more entries to `LOG_DRAFT.jsonl` before pushing.** One entry per logical patch — not per commit. A 5-commit branch that ships one bug fix is one entry.

Each entry is a single line of valid JSON. See `docs/LOG_SCHEMA.md` for the full schema. Minimal required fields:

```json
{"id":"YYYY-MM-DD-shortslug","type":"fix","status":"shipped","goal":"one sentence","done":"one or two sentences"}
```

The `id` must be unique. Use `YYYY-MM-DD-` prefix plus a short kebab-case slug. If you ship 3 bug fixes in one session, write 3 lines.

**Strongly recommended fields for fixes:** `files`, `symptom`, `root_cause`, `fix`, `affects`, `verified`, `guardrails_preserved`. These are what future AI sessions need to debug related issues.

**For QA failures:** still write an entry with `status: "qa-failed"`. This is high-value context. If a v2 fix later supersedes the failed v1 attempt, the v2 entry should reference the v1 entry via `supersedes`.

**Never edit existing entries in `docs/log.jsonl`.** If something is wrong, write a new entry with `supersedes` pointing at the old one. The log is append-only by design.

**Comment lines are allowed in `LOG_DRAFT.jsonl`** (lines starting with `//` or `#`). They're stripped before processing. Use them if you need to leave notes for yourself mid-draft.

## File layout

```
.github/workflows/auto-log.yml      ← the workflow
scripts/append_log.py               ← processes draft, appends to log
docs/log.jsonl                      ← the log itself (append-only, AI-readable)
docs/LOG_SCHEMA.md                  ← full schema reference
LOG_DRAFT.jsonl                     ← scratchpad; cleared after each successful push
.log-draft-archive/                 ← old drafts kept here, never deleted
```

## Querying the log (for AI agents)

```bash
# All entries on a specific date
jq -c 'select(.date == "2026-04-27")' docs/log.jsonl

# All entries that touched a specific file
jq -c 'select(.files != null) | select(.files | index("css/styles.css"))' docs/log.jsonl

# All entries mentioning a specific guardrail
jq -c 'select(.guardrails_preserved != null) | select(.guardrails_preserved | index("asset-resolver-untouched"))' docs/log.jsonl

# All filed (unfixed) follow-ups across all entries
jq -c 'select(.filed != null) | {id, filed}' docs/log.jsonl

# Recent QA failures
jq -c 'select(.status == "qa-failed")' docs/log.jsonl

# Find supersession chains
jq -c 'select(.supersedes != null) | {id, supersedes}' docs/log.jsonl
```

Or in Python:

```python
import json
entries = [json.loads(l) for l in open('docs/log.jsonl')]
fixes = [e for e in entries if e.get('type') == 'fix']
```

## Manual rescue

If GitHub Actions fails to run (auth issue, quota, etc.), you can run the append step locally:

```bash
GITHUB_SHA=$(git rev-parse HEAD) GITHUB_REF=refs/heads/main EVENT_NAME=push python3 scripts/append_log.py
git add docs/log.jsonl LOG_DRAFT.jsonl
git commit -m "[auto-log] manual append"
git push
```

## What this system is NOT

- **Not a Tracker replacement.** The Tracker (NOW / NEXT / FILED) lives in your master doc. This log is the *historical record*; the Tracker is the *forward-looking plan*. You can periodically generate Tracker updates *from* this log, but they're separate concerns.
- **Not a human-readable changelog.** If you want a release notes feed for users, generate it from this log on demand — don't try to make `log.jsonl` serve both purposes. Pick one consumer (AI), serve them well.
- **Not for secrets or PII.** The log is committed to the repo. Don't put credentials, customer data, or anything sensitive in entries.
