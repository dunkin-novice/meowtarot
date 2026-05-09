#!/usr/bin/env bash
# Stage the Capacitor webDir at <repo>/www from a curated subset of the repo.
# 1.12 follow-up: the 1.11 trim ("SEO landers vs in-app surfaces") was wrong —
# bottom-nav.js routes Today→/today/ and Cards→/tarot-card-meanings/, and
# meanings.html / card pages link into /cards/, /quiz/, /daily-card/. All five
# routes are reachable from staged in-app navigation, so all five ship.
# Total disk cost ~3.5 MB across en + th, which is trivial.
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

# Sub-route directories reachable from staged in-app nav — see header comment.
ROUTE_DIRS=(today daily-card quiz tarot-card-meanings cards)

for d in "${ROOT_DIRS[@]}" "${ROUTE_DIRS[@]}"; do
  if [ ! -d "$d" ]; then
    echo "stage-cap-www: missing dir '$d' — aborting" >&2
    exit 1
  fi
  rsync "${RSYNC_OPTS[@]}" "$d/" "$WWW/$d/"
done

# TH mirror: same HTML subset + same route dirs. The HTML subset is required;
# the route dirs warn-but-continue (TH parity may legitimately lag for some
# routes — that's a known repo state, not a staging failure).
mkdir -p "$WWW/th"
for f in "${ROOT_HTML[@]}"; do
  if [ -f "th/$f" ]; then
    rsync "${RSYNC_OPTS[@]}" "th/$f" "$WWW/th/$f"
  else
    echo "stage-cap-www: missing th/$f — TH mirror parity gap" >&2
  fi
done

for d in "${ROUTE_DIRS[@]}"; do
  if [ -d "th/$d" ]; then
    rsync "${RSYNC_OPTS[@]}" "th/$d/" "$WWW/th/$d/"
  else
    echo "stage-cap-www: missing th/$d/ — TH route mirror parity gap" >&2
  fi
done

echo "Staged $WWW"
echo "Top-level entries:"
ls -1 "$WWW"
