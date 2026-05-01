# Bug Entry Template

Use this format when appending a new entry to `docs/open-bugs.md`. Fill in what you have; skip sections cleanly when there's nothing to put in them. Don't write placeholder text like "TBD" or "unknown" — just omit the section.

Tighter, more readable entries are better than completionist ones. The point of this file is for a future session to triage; future-Claude needs the symptom, hypothesis if any, and a sense of what'll go wrong if it just blindly patches.

---

## Template

````markdown
## BUG-NNN — <one-line summary>

**Status:** Reported, not yet verified.
**Priority:** <Low | Medium | High | Critical>
**Reported:** YYYY-MM-DD

### Symptom

<One or two sentences describing what the user sees that's wrong. Concrete and observable. Avoid speculation here — speculation goes in "Suspected root cause".>

### Suspected root cause

<If a hypothesis was provided, capture it here. Always mark unverified unless the user has reproduced the bug end-to-end. Two or three sentences max.>

### Reported fix

<If a code change was proposed, paste it verbatim in a fenced code block with a path/filename comment at the top. Do NOT evaluate it.>

### Why this isn't a drive-by fix

<Only include if there are real concerns. Examples worth flagging:
- The reported fix touches a file CLAUDE.md says never to modify — name the rule and the file.
- The diagnosis hasn't been verified end-to-end.
- The fix has obvious side effects (legacy URL formats, share-link round-trips, analytics, SEO canonicals).
- Test coverage gaps that should be filled before patching.

If none apply, skip this section.>

### Files involved

- `path/to/file.js` (function name) — what's relevant
- `path/to/other.css` — what's relevant

### Files explicitly off-limits

<Cross-reference CLAUDE.md hard rules. List any file the future session must NOT touch even though they're nearby. Skip if nothing relevant.>

### Suggested first session

<Numbered list of triage steps for whoever picks this up. 3-6 steps usually. The first step is almost always "reproduce the bug on the live site" before any code work.>
````

Notes on filling it in

- Status stays "Reported, not yet verified" until someone actively triages. Don't claim verification you didn't do.
- Priority — Low for cosmetic / rare-edge-case, Medium for affects-some-users, High for affects-most-users-or-revenue, Critical for site-down-class. Default Medium and ask if uncertain.
- Reported fix — copy verbatim, even if you suspect the fix is wrong. Future triage benefits from seeing what was originally proposed. Don't "improve" it.
- Why this isn't a drive-by fix — be specific. "Touches js/common.js which CLAUDE.md hard-rule prohibits modifying" is useful. "May have side effects" is not.
- Suggested first session — should always start with reproducing on the live site. The reported diagnosis might be wrong.

ID numbering

Read the existing file before writing. Find the highest existing BUG-NNN, add 1. If the file is empty / freshly created, start at BUG-001.

If the user filed something that's not a bug per se (e.g. "a config option behaves unexpectedly but isn't really broken"), use ISSUE-NNN instead of BUG-NNN with the same numbering scheme but separate counter.
