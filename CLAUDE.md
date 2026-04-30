# MeowTarot — Working Agreement for Claude Code

## What this product is

MeowTarot is a bilingual (EN/TH) cat-themed tarot product. Static, client-side
web app. No backend — all state flows through sessionStorage and URL params.
Supabase is used only for signed-in reading history persistence.

Three reading modes:
- Daily Reading — single card, deterministic per day
- Ask a Question — 3-card Past/Present/Future spread
- Full Reading — 10-card Celtic Cross spread

## North star (May 2026)

Hero KPI: Monthly Reading Users (MRU).
May thesis: turn love-intent traffic into repeat readings, shares, contactable
users, and first paid conversions WITHOUT damaging the free core.

If a change does not serve that thesis, defer it.

## Hard rules — do not violate without explicit instruction

1. **Free reading result must always feel complete.** Paid layers are
   "go deeper," never "answer locked."
2. **EN/TH parity is mandatory.** Every user-facing change ships in both
   languages, including /th/ mirror files.
3. **All i18n routes exclusively through js/common.js.**
   Never inline language strings in feature files.
4. **Never touch js/asset-resolver.js or the resolvePosterCardImageSources
   call order.** These are load-bearing for poster generation.
5. **Backward compatibility for legacy share links must be maintained**
   across all patches. Old payloads must still resolve.
6. **Patches are surgically scoped by mode.** Changes to Daily must not bleed
   into Question or Full, and vice versa.
7. **Love vertical copy must protect user wellbeing.**
   Forbidden phrasings (TH): "เขายังรักคุณแน่นอน", "เขาจะกลับมา", "ต้องรอเขา".
   Every love offer must include self-agency, not just "what he feels."
8. **LINE share payloads must include reading-specific og:image**, never
   the generic site logo. Visual proof is the TH virality mechanic.
9. **Payment plumbing never blocks product launch.** Sandbox in parallel,
   production keys flagged off until free-tool data justifies flipping.

## Architecture map

Key files:

- js/main.js — homepage and topic selection wiring
- js/reading.js — core reading flow (Daily/Question/Full)
- js/reading-helpers.js — shared reading utilities
- js/common.js — shared shell, i18n, locale switching, initShell()
- js/share-payload.js — share payload construction
- js/analytics.js — GA4 event helper with dedup logic
- js/bottom-nav.js — mobile bottom-tab app shell
- share/normalize-payload.js — legacy share-link compatibility
- share/poster.js — poster image generation
- full.html, question.html, daily.html — EN reading entry points
- /th/full.html, /th/question.html, /th/daily.html — TH mirrors
- cards.json (in data/ or root) — source of truth for card data including
  position-aware reading text fields (standalone_past, standalone_present,
  standalone_future, action_prompt, reflection_question)

## GA4 event taxonomy (already wired — do not duplicate)

Live events: reading_start, reading_complete, share_clicked,
error_encountered, topic_selected, locale_switched, profile_revisit.

Custom dimensions registered: reading_mode, reading_topic, share_channel,
locale (all event scope).

When adding new flows (e.g. love-intent tool), follow the same pattern in
js/analytics.js — sessionStorage dedup for once-per-session events,
in-memory dedup for reading events.

## Patch workflow

- Sequential patch-and-merge. One patch lands before the next begins.
- Each patch should:
  1. Have a single clear goal
  2. Stay surgically scoped
  3. Preserve all hard rules above
  4. End with a short summary of what changed and what was deliberately
     left untouched
- Visual QA is manual (Dunkin tests in browser). Don't claim visual
  verification you didn't actually do.

## Backlog

Tasks deferred for later phases.

- **Phase 2.1: Clickable header logo.** Add a logo to the top-left corner of the header that links to the homepage (`/`). Depends on Phase 2 (header globalization). Not started.

## When in doubt

Ask before:
- Adding a new dependency
- Touching shared infrastructure (asset-resolver.js, common.js shell)
- Changing share payload schema
- Modifying anything in share/normalize-payload.js
- Adding any copy to the love vertical without confirming emotional safety

Default to the smallest possible change that satisfies the goal.
