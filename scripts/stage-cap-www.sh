#!/usr/bin/env bash
# Stage the Capacitor webDir at <repo>/www from a curated subset of the repo.
# Founder decision (Track 1.11): only interactive surfaces ship to the iOS app.
# SEO landers (cards/, tarot-card-meanings/, quiz/, today/, daily-card/, plus
# their TH mirrors) are deliberately excluded from the bundle.
#
# Idempotent: nukes www/ and rebuilds. Run before `npx cap sync ios`.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WWW="$REPO_ROOT/www"

cd "$REPO_ROOT"

rm -rf "$WWW"
mkdir -p "$WWW"

RSYNC_OPTS=(-a --exclude=.DS_Store)

# 10 root-level interactive HTML surfaces (mirrored under th/ below).
ROOT_HTML=(
  index.html
  daily.html
  question.html
  question-draw.html
  full.html
  reading.html
  profile.html
  features.html
  meanings.html
  overall.html
)

for f in "${ROOT_HTML[@]}"; do
  if [ ! -f "$f" ]; then
    echo "stage-cap-www: missing root file '$f' — aborting" >&2
    exit 1
  fi
  rsync "${RSYNC_OPTS[@]}" "$f" "$WWW/$f"
done

# Whole directories that ship as-is (with .DS_Store stripped).
ROOT_DIRS=(js css assets data share sharekit)

for d in "${ROOT_DIRS[@]}"; do
  if [ ! -d "$d" ]; then
    echo "stage-cap-www: missing dir '$d' — aborting" >&2
    exit 1
  fi
  rsync "${RSYNC_OPTS[@]}" "$d/" "$WWW/$d/"
done

# TH mirror: same HTML subset only. SEO landers under th/ are excluded.
mkdir -p "$WWW/th"
for f in "${ROOT_HTML[@]}"; do
  if [ -f "th/$f" ]; then
    rsync "${RSYNC_OPTS[@]}" "th/$f" "$WWW/th/$f"
  else
    echo "stage-cap-www: missing th/$f — TH mirror parity gap" >&2
  fi
done

echo "Staged $WWW"
echo "Top-level entries:"
ls -1 "$WWW"
