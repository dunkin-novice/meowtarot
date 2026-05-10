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

# ----------------------------------------------------------------------------
# Trailing-slash → /index.html rewrite (iOS bundle only).
#
# Why: Capacitor 8 WKURLSchemeHandler does NOT auto-resolve directory URLs
#   like /today/ to /today/index.html. It returns root index.html as a
#   404-ish SPA fallback at the wrong base URL, which breaks all relative
#   paths — symptom: tapping a tab serves homepage HTML with broken CSS.
#
# What: rewrite same-origin trailing-slash hrefs to explicit /<dir>/index.html
#   in staged HTML and JS. Source files are unchanged; web/Netlify behavior
#   is preserved (Netlify pretty URLs map either form to the same file).
#
# Scope of patterns:
#   A. HTML href="/<path>/"                                  → /index.html
#   B. JS template literals `${prefix}/<path>/`              → /index.html
#   C. JS nav-call wrappers — localize/localizeLink/localizeHref/
#      location.replace — with string-literal trailing-slash arg
#   D. JS template literals `/cards/${slug}/` and TH mirror  → /index.html
#
# Carefully NOT touched:
#   - SEO metadata: <link rel="canonical">, hreflang, JSON-LD @id, og:url —
#     all use https://www.meowtarot.com/... URLs, which never start with `/`
#     after `href="`/`href="/` so they don't match pattern A. Patterns B–D
#     are anchored to ${prefix} or /cards/, so they don't catch baseUrl.
#   - canonical-card-routes.js:182 — its output is consumed for BOTH nav AND
#     SEO canonical URL building. Rewriting would damage live SEO.
#   - meanings.js:117 basePath — only hit on rare unknown-slug fallback path.
#   - pages/<slug>-card.js:96 hardcoded /cards/<slug>/ fallback strings —
#     only hit when getCanonicalCardPath returns null (rare).
#
# These deferred surfaces remain a TODO. They affect deeper card-detail
# next/prev pagination edge cases when getCanonicalCardPath misses, not the
# bottom-nav happy path.
# ----------------------------------------------------------------------------

while IFS= read -r -d '' file; do
  sed -E -i '' 's|href="(/[^":]+)/"|href="\1/index.html"|g' "$file"
done < <(find "$WWW" -type f -name '*.html' -print0)

while IFS= read -r -d '' file; do
  sed -E -i '' \
    -e 's|`(\$\{prefix\}/[^`:]+)/`|`\1/index.html`|g' \
    -e "s|localize\('(/[^':]+)/'|localize('\1/index.html'|g" \
    -e 's|localize\("(/[^":]+)/"|localize("\1/index.html"|g' \
    -e "s|localizeLink\('(/[^':]+)/'|localizeLink('\1/index.html'|g" \
    -e 's|localizeLink\("(/[^":]+)/"|localizeLink("\1/index.html"|g' \
    -e "s|localizeHref\('(/[^':]+)/'|localizeHref('\1/index.html'|g" \
    -e 's|localizeHref\("(/[^":]+)/"|localizeHref("\1/index.html"|g' \
    -e "s|location\.replace\('(/[^':]+)/'\)|location.replace('\1/index.html')|g" \
    -e 's|location\.replace\("(/[^":]+)/"\)|location.replace("\1/index.html")|g' \
    -e 's|`(/cards/\$\{[^}]+\})/`|`\1/index.html`|g' \
    -e 's|`(/th/cards/\$\{[^}]+\})/`|`\1/index.html`|g' \
    "$file"
done < <(find "$WWW" -type f -name '*.js' -print0)

echo "Staged $WWW"
echo "Top-level entries:"
ls -1 "$WWW"
