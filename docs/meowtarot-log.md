# MeowTarot Codex Log

Date: 2026-04-20
Type: QA/Test hardening
Goal: Verify and stabilize Phase 1 reading-history save/dedupe/deferred-auth behaviors.
Done: Added focused unit tests for daily/question/full save paths, deferred non-daily save guard, duplicate session-key behavior, and local-date read_date handling.
Fix/Note: Added small test-only internals and optional client/date injection in reading-history helpers to keep behavior unchanged while improving testability.

Date: 2026-04-20
Type: UI polish
Goal: Show readable card names on profile recent history rows.
Done: Mapped saved reading card IDs to localized card names (TH alias / EN name) with slug-pretty fallback when metadata is unavailable.
