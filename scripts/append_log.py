#!/usr/bin/env python3
"""
append_log.py

Reads LOG_DRAFT.jsonl (one JSON object per line, written by Claude Code or
whatever agent did the work), fills in any missing auto-fields from the
GitHub Actions environment, and appends each entry to docs/log.jsonl.

If LOG_DRAFT.jsonl is missing or empty, a minimal stub entry is written so
the push is not lost. The stub is marked status="auto-stub" so AI consumers
can identify entries that lack semantic content and fall back to reading
the commit + PR directly.

Designed to be:
- Idempotent on re-run (won't double-append if commit SHA already logged
  on the same date)
- Strict about JSON validity (rejects malformed lines with a clear error)
- Permissive about missing fields (auto-fills what it can)
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

DRAFT_PATH = Path("LOG_DRAFT.jsonl")
LOG_PATH = Path("docs/log.jsonl")
SCHEMA_VERSION = 1


def env(name: str, default: str = "") -> str:
    """Read env var, return default if empty/unset."""
    val = os.environ.get(name, "")
    return val if val else default


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def short_sha(sha: str) -> str:
    return sha[:7] if sha else ""


def branch_from_ref(ref: str) -> str:
    """refs/heads/main -> main, refs/pull/123/merge -> pr-123."""
    if not ref:
        return ""
    if ref.startswith("refs/heads/"):
        return ref[len("refs/heads/"):]
    if ref.startswith("refs/pull/"):
        parts = ref.split("/")
        if len(parts) >= 3:
            return f"pr-{parts[2]}"
    return ref


def load_existing_log() -> list[dict]:
    if not LOG_PATH.exists():
        return []
    entries = []
    with LOG_PATH.open("r", encoding="utf-8") as f:
        for i, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                entries.append(json.loads(line))
            except json.JSONDecodeError as e:
                print(f"WARN: docs/log.jsonl line {i} is not valid JSON: {e}",
                      file=sys.stderr)
    return entries


def already_logged(entry: dict, existing: list[dict]) -> bool:
    """
    Idempotency check: match on id (primary key).
    Multiple entries can share the same commit SHA (e.g. one push containing
    multiple logical patches in a multi-line draft), so commit+date is NOT
    a reliable uniqueness key. id is.
    """
    eid = entry.get("id")
    if not eid:
        return False
    for prev in existing:
        if prev.get("id") == eid:
            return True
    return False


def auto_fill(entry: dict, index: int = 0) -> dict:
    """Fill in workflow-known fields if the writer didn't.
    `index` disambiguates auto-generated ids when multiple draft entries
    share the same commit SHA.
    """
    sha = env("GITHUB_SHA")
    pr_num = env("PR_NUMBER")
    pr_title = env("PR_TITLE")
    pr_body = env("PR_BODY")
    pr_author = env("PR_AUTHOR")
    pusher = env("PUSHER")
    pushed_at = env("PUSHED_AT") or env("PR_MERGED_AT") or now_iso()
    ref = env("GITHUB_REF")
    branch_env = env("BRANCH_NAME") or branch_from_ref(ref)
    event = env("EVENT_NAME")

    entry.setdefault("schema_version", SCHEMA_VERSION)
    entry.setdefault("date", today())
    entry.setdefault("commit", short_sha(sha))
    entry.setdefault("branch", branch_env)
    entry.setdefault("logged_at", now_iso())
    entry.setdefault("trigger", event)

    if pr_num:
        try:
            entry.setdefault("pr", int(pr_num))
        except ValueError:
            pass
        if pr_title:
            entry.setdefault("pr_title", pr_title)
        if pr_body:
            # Truncate long PR bodies — full body lives on GitHub
            excerpt = pr_body[:500]
            if len(pr_body) > 500:
                excerpt += "...[truncated]"
            entry.setdefault("pr_body_excerpt", excerpt)
        if pr_author:
            entry.setdefault("author", pr_author)
    elif pusher:
        entry.setdefault("author", pusher)

    # Auto-generate id if writer didn't set one
    if not entry.get("id"):
        date_part = entry["date"]
        sha_part = entry.get("commit", "nosha")
        suffix = f"-{index}" if index > 0 else ""
        entry["id"] = f"{date_part}-{sha_part}{suffix}"

    return entry


def make_stub(reason: str) -> dict:
    """Create a minimal stub when no draft was provided."""
    entry = {
        "type": "push",
        "status": "auto-stub",
        "goal": "(no draft provided)",
        "done": f"(auto-stub: {reason}; reconstruct from commit + PR if needed)",
    }
    return auto_fill(entry)


def parse_draft() -> list[dict]:
    """Parse LOG_DRAFT.jsonl. Returns list of dicts (may be empty)."""
    if not DRAFT_PATH.exists():
        return []
    entries = []
    with DRAFT_PATH.open("r", encoding="utf-8") as f:
        for i, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            if line.startswith("//") or line.startswith("#"):
                # Allow comment lines in drafts for human notes
                continue
            try:
                obj = json.loads(line)
                if not isinstance(obj, dict):
                    print(f"ERROR: LOG_DRAFT.jsonl line {i} is not a JSON object",
                          file=sys.stderr)
                    sys.exit(1)
                entries.append(obj)
            except json.JSONDecodeError as e:
                print(f"ERROR: LOG_DRAFT.jsonl line {i} is invalid JSON: {e}",
                      file=sys.stderr)
                print(f"Offending line: {line[:200]}", file=sys.stderr)
                sys.exit(1)
    return entries


def main() -> int:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)

    existing = load_existing_log()
    drafts = parse_draft()

    if not drafts:
        # No draft = create a stub so the push is at least recorded.
        # An AI debugging later can still find the commit + PR via auto-filled fields.
        reason = "LOG_DRAFT.jsonl missing or empty"
        if DRAFT_PATH.exists():
            reason = "LOG_DRAFT.jsonl was empty"
        drafts = [make_stub(reason)]

    appended = 0
    skipped = 0
    with LOG_PATH.open("a", encoding="utf-8") as out:
        for idx, raw in enumerate(drafts):
            entry = auto_fill(raw, index=idx)
            if already_logged(entry, existing):
                print(f"SKIP: entry id={entry.get('id')} already logged")
                skipped += 1
                continue
            out.write(json.dumps(entry, ensure_ascii=False, sort_keys=True))
            out.write("\n")
            existing.append(entry)
            appended += 1
            print(f"APPEND: id={entry.get('id')} type={entry.get('type')} "
                  f"status={entry.get('status')}")

    print(f"\nResult: {appended} appended, {skipped} skipped")
    return 0


if __name__ == "__main__":
    sys.exit(main())
