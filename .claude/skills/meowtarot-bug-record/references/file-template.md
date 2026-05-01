# File Template

Use this when `docs/open-bugs.md` doesn't exist yet and the user has confirmed creating it.

Write this header, then append the user's first bug entry below it (using `references/entry-template.md`).

---

````markdown
# Open Bugs & Backlog

Standalone issues tracker for MeowTarot. Items here are not in flight — they're recorded for triage in a future session when context permits.

This doc is separate from `CLAUDE.md`'s Backlog section. CLAUDE.md tracks design and feature decisions deferred between phases; this file tracks bugs and open technical issues that need diagnosis before being fixed.

Format: each entry is `BUG-NNN` (or `ISSUE-NNN` for non-bugs) with sections for Status, Priority, Reported date, Symptom, Suspected root cause, Reported fix, Why this isn't a drive-by fix, Files involved, Files off-limits, and Suggested first session. Skip optional sections when there's no information to put in them.

---
````

That's it — header plus one horizontal rule. Then append the first bug entry directly underneath.
