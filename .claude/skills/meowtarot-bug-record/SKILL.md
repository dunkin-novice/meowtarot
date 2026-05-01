---
name: meowtarot-bug-record
description: Record a bug or open technical issue in the MeowTarot project's open-bugs.md file without acting on it. Use this skill whenever the user asks to "record this bug", "file this", "save this for later", "add this to the bug list", "track this issue", "don't fix this now but remember it", or similar parking phrases — anytime they want a MeowTarot bug captured for future triage rather than fixed in the current session. Also use when a user pastes a bug report and says they want it filed without working on it. Do not use for design/feature decisions (those go in CLAUDE.md Backlog) or for bugs the user wants fixed immediately.
---

# MeowTarot Bug Record

Append a structured bug entry to `docs/open-bugs.md` in the MeowTarot project. The skill captures bugs for later triage — it does **not** fix them, diagnose them, or push code.

## When to use

Use this skill when the user wants a bug filed without action. Triggering phrases:

- "Record this bug"
- "File this for later"
- "Save this to the bug list"
- "Don't fix it now, just track it"
- "Add this to open-bugs"
- "Park this issue"

Pastes of bug reports followed by "log this" or "remember this" also count.

## When NOT to use

- The user wants the bug **fixed now** → diagnose and patch instead, this skill doesn't write code.
- The item is a feature/design decision deferred between phases → goes in `CLAUDE.md` Backlog section instead, not `open-bugs.md`.
- The user wants a general note in CLAUDE.md → use a regular edit, not this skill.

## What to do

### Step 1 — Locate the file

`docs/open-bugs.md` should exist at the repo root under `docs/`. If it doesn't:

1. Confirm the user wants it created. Don't create silently.
2. Create it with the header from `references/file-template.md`.
3. Then proceed to Step 2.

If the file exists, read it first to see what bug numbers are already taken so the new entry gets the next sequential ID.

### Step 2 — Extract the bug details

From the user's message (or the pasted report), pull out:

- **Symptom** — what the user sees that's wrong. One or two sentences. Concrete, observable.
- **Suspected root cause** — if the report includes a hypothesis, capture it. Mark it as "unverified" unless the user explicitly says they've reproduced and confirmed.
- **Reported fix** — if the report proposes a code change, copy it verbatim in a code block. Do NOT evaluate or apply it.
- **Files mentioned** — anything named in the report (paths, function names).
- **Off-limits files in scope** — cross-reference against `CLAUDE.md` hard rules. If the reported fix touches an off-limits file (`js/asset-resolver.js`, `js/common.js` shell, `share/normalize-payload.js`), surface the conflict in the entry under "Why this isn't a drive-by fix".
- **Priority** — if the user gives one, use it. Otherwise default to Medium and ask the user to confirm.
- **Today's date** — for the "Reported" field.

If the user didn't paste a structured report and just described the bug in conversation, ask one or two clarifying questions to fill the symptom and reproduction details before writing.

### Step 3 — Write the entry

Append the entry to the bottom of `docs/open-bugs.md` using the format in `references/entry-template.md`. Do not edit existing entries unless the user explicitly asks.

Skip optional sections (Suspected root cause, Reported fix, Why this isn't a drive-by fix, Suggested first session) only if there's no information to fill them. An entry with just a symptom and a date is still useful; a bloated entry with empty sections is not.

### Step 4 — Confirm and stop

After appending, show the user:

- The bug ID assigned (e.g. `BUG-003`)
- The first two lines of the entry
- The path to the file

Do **not** stage, commit, or push. The user decides when this lands. Do not run the bug fix. Do not write code anywhere else. Do not edit `CLAUDE.md`.

## File format

The entry template lives in `references/entry-template.md`. The full file template (used only when the file doesn't exist yet) lives in `references/file-template.md`. Read those when you're about to write — they may have been updated since this SKILL.md was authored.

## Examples of good triggering

User: *"Got a bug report from someone — Thai pages render English when accessed via `?l=th`. Don't fix it now, just record it so I remember to triage later."*
→ Skill triggers. Extract symptom, ask for any missing context, append entry as `BUG-NNN`.

User: *"File this for me — when users tap the Continue button on daily.html with no card selected, nothing happens and there's no error message."*
→ Skill triggers. UX bug, user wants it parked.

User: *"Hey, this is broken — fix it: [bug description]"*
→ Skill does NOT trigger. User wants a fix, not a record.

User: *"Add 'redesign mobile bottom nav' to the backlog."*
→ Skill does NOT trigger. That's a design decision; goes in CLAUDE.md Backlog instead.
