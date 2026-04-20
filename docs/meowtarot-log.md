# MeowTarot Codex Log

Date: 2026-04-20
Type: QA/Test hardening
Goal: Verify and stabilize Phase 1 reading-history save/dedupe/deferred-auth behaviors.
Done: Added focused unit tests for daily/question/full save paths, deferred non-daily save guard, duplicate session-key behavior, and local-date read_date handling.
Fix/Note: Added small test-only internals and optional client/date injection in reading-history helpers to keep behavior unchanged while improving testability.
