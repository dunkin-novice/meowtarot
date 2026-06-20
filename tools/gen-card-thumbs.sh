#!/usr/bin/env bash
# gen-card-thumbs.sh — generate lightweight card-face thumbnails for the poster.
#
# WHY: the Celtic Cross poster draws 10 card faces; loading 10 full-res images
# (1568x2720 ≈ 17 MB *decoded* each → ~170 MB) blows mobile Safari's canvas
# memory limit and the poster fails to generate. The poster already PREFERS a
# pre-rendered `.h900.webp` variant (share/poster.js buildPosterCardVariantCandidates)
# and falls back to full-res — but those variants don't exist on the CDN yet.
# This script creates them. Once uploaded, daily/question posters use them
# automatically; the Celtic poster needs the one-line change to expand its
# candidates too (see #11 in the tracker).
#
# USAGE:
#   tools/gen-card-thumbs.sh                # all decks, height 900
#   tools/gen-card-thumbs.sh 600            # all decks, height 600 (smaller)
#   tools/gen-card-thumbs.sh 900 pawbit moonmallow   # specific decks
#
# OUTPUT: tools/card-thumbs/assets/<deck>/<card_id>.h<H>.webp
#   → upload the contents of tools/card-thumbs/assets/ to the CDN, preserving
#     paths (so they land next to the originals at cdn.meowtarot.com/assets/...).
#
# REQUIRES: cwebp (brew install webp), curl, python3.
set -euo pipefail

CDN="https://cdn.meowtarot.com"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
H="${1:-900}"
shift || true
OUT="$ROOT/tools/card-thumbs"

command -v cwebp >/dev/null || { echo "ERROR: cwebp not found (brew install webp)"; exit 1; }

# Deck ids from js/data.js
DECKS=(); while IFS= read -r _l; do [ -n "$_l" ] && DECKS+=("$_l"); done < <(python3 - "$ROOT" <<'PY'
import re,sys
src=open(sys.argv[1]+"/js/data.js").read()
ids=re.findall(r"id:\s*'([a-z0-9-]+)'", src)
# de-dupe preserving order, drop obvious non-deck ids by keeping those that appear as DECKS keys
seen=[]
for i in ids:
    if i not in seen: seen.append(i)
print("\n".join(seen))
PY
)
# Override with CLI-specified decks if any
if [ "$#" -gt 0 ]; then DECKS=("$@"); fi

# Card ids (nn-slug-orientation) from cards.json
CARDS_JSON="$ROOT/data/cards.json"; [ -f "$CARDS_JSON" ] || CARDS_JSON="$ROOT/cards.json"
CARDS=(); while IFS= read -r _l; do [ -n "$_l" ] && CARDS+=("$_l"); done < <(python3 - "$CARDS_JSON" <<'PY'
import json,sys
d=json.load(open(sys.argv[1]))
cards=d if isinstance(d,list) else d.get("cards",[])
# Upright only — reversed artwork is retired (cards now render upright+rotate).
ids=[c.get("card_id") for c in cards if c.get("card_id") and c.get("card_id").endswith("-upright")]
print("\n".join(sorted(set(ids))))
PY
)

echo "Decks: ${#DECKS[@]} | Cards: ${#CARDS[@]} | height=${H}px"
ok=0; miss=0; fail=0; tmp="$(mktemp)"
for deck in "${DECKS[@]}"; do
  mkdir -p "$OUT/assets/$deck"
  for cid in "${CARDS[@]}"; do
    src_url="$CDN/assets/$deck/$cid.webp"
    out="$OUT/assets/$deck/$cid.h${H}.webp"
    [ -f "$out" ] && { ok=$((ok+1)); continue; }
    code=$(curl -s -o "$tmp" -w "%{http_code}" --max-time 30 "$src_url" || echo 000)
    if [ "$code" != "200" ]; then miss=$((miss+1)); continue; fi
    if cwebp -quiet -resize 0 "$H" -q 82 "$tmp" -o "$out" 2>/dev/null; then ok=$((ok+1)); else fail=$((fail+1)); fi
  done
  echo "  $deck done (ok=$ok miss=$miss fail=$fail)"
done
rm -f "$tmp"
echo "DONE → $OUT/assets/  (ok=$ok, missing-source=$miss, convert-fail=$fail)"
echo "Next: upload tools/card-thumbs/assets/ to the CDN preserving the assets/<deck>/ paths."
