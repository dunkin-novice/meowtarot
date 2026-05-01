---
name: meowtarot-bug-recall
description: Look up open bugs from the MeowTarot project's open-bugs.md file. Use this skill whenever the user asks "what bugs are open", "what's on the bug list", "show me the bug backlog", "is there anything to fix", "any known issues with X", "what's pending", or asks about a specific bug ("the Thai bug", "the language thing", "BUG-001"). Also use when the user wants to pick a bug to triage next ("what should I fix today", "any small bugs to knock out") or when about to start work and wants to check whether the area they're touching has known issues. Do not use to record new bugs — use the meowtarot-bug-record skill for that.
---

# MeowTarot Bug Recall

Read `docs/open-bugs.md` from the MeowTarot project and surface the relevant entries to the user.

## When to use

- "What bugs are open?" / "What's on the bug list?" / "Show me the backlog"
- "Is there a known issue with [feature]?"
- "What's the status of the Thai bug?" / "Any progress on BUG-001?"
- "Anything I should fix today?" / "What's pending?"
- Before the user starts a phase or patch, when they ask whether the area has open bugs

## When NOT to use

- The user wants to record a new bug → use `meowtarot-bug-record` instead.
- The user wants the bug fixed right now → recall it first via this skill, then proceed to a fix workflow (this skill only reads, doesn't patch).
- General feature/design backlog questions → those live in `CLAUDE.md`'s Backlog section, not in `open-bugs.md`. Read CLAUDE.md instead.

## What to do

### Step 1 — Read the file

Read `docs/open-bugs.md`. If it doesn't exist, tell the user no bug file has been created yet and offer to create one (which would invoke the bug-record skill).

### Step 2 — Filter to what the user asked for

Different requests need different responses:

**"What bugs are open?" / general overview** → list all entries by ID with their one-line summary, status, and priority. Don't dump full entry contents unless asked.

**"What's the status of [specific bug]?"** → find the entry by ID or by topic match (Thai language, language param, etc.) and show the full entry.

**"Anything I should fix today?" / triage help** → list all entries, group by priority (Critical/High first), and for each give: ID, summary, why it isn't a drive-by fix (the friction notes). The user wants to pick the lowest-friction-with-meaningful-impact one. Help them see that.

**"Any known issues with [area]?"** (e.g., "any bugs with reading?") → grep the file's "Files involved" sections for matches and surface those entries.

### Step 3 — Don't act

Surface what's there. Don't propose fixes. Don't research the bug further. Don't read the implicated source files unless the user explicitly asks. The recall skill's job is to put existing context in front of the user so they can decide what to do next.

If the user follows up with "okay let's fix BUG-NNN", that's a separate workflow — drop out of this skill, switch to a regular debugging/patch session.

### Step 4 — Stay honest about staleness

Bugs in `open-bugs.md` are **reported, not necessarily verified**. When surfacing entries, preserve that uncertainty. Phrases that are accurate:

- "The file lists BUG-001 as Thai language not respected on `?l=th`. Reported but not verified."
- "Three open bugs, all Medium priority, all reported but not yet reproduced."

Phrases to avoid (claim more than the file justifies):

- "There's a bug where Thai..." — implies verified.
- "The fix for BUG-001 is..." — implies the reported fix is correct; the file explicitly flags it might not be.

When you list a bug, mention `Status: Reported, not yet verified` if that's what the entry says.

## Output shape

For overviews, use a tight list:

> **3 open bugs:**
>
> - **BUG-001** — Thai not respected on `?l=th` reading URLs. Medium. *Reported, not verified.*
> - **BUG-002** — [summary]. High. *Reported, not verified.*
> - **BUG-003** — [summary]. Low. *Verified, scoped fix pending.*
>
> Want details on any of these?

For specific-bug requests, paste the full entry from the file in a code block or as quoted markdown, then offer to start a triage workflow if the user wants.

For triage-help requests, lead with the lowest-friction-meaningful-impact bug and explain why it's a good next target — but always defer the choice to the user.

## Examples of good triggering

User: *"What bugs are open right now?"*
→ Skill triggers. Read file, give overview list.

User: *"Any known issues with reading.html before I touch it?"*
→ Skill triggers. Read file, filter to entries mentioning reading/results.

User: *"What's the status on the Thai language bug?"*
→ Skill triggers. Find BUG-001 (or whichever matches), show full entry.

User: *"Fix the Thai bug for me."*
→ Skill triggers ONCE to recall the entry, then drops out — fixing is a separate workflow.

User: *"What's left to do on Phase 3?"*
→ Skill does NOT trigger. That's a CLAUDE.md Backlog / phase-planning question.
