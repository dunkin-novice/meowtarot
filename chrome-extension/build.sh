#!/usr/bin/env bash
# Build store-ready zips for Chrome, Edge, and Firefox from the shared source.
#
#   Chrome + Edge : identical MV3 package (manifest.json)
#   Firefox (AMO) : same payload, but manifest.firefox.json — adds the required
#                   browser_specific_settings.gecko.id
#
# Shared payload : newtab.html, newtab.js, icons/
# Usage         : ./build.sh   (run from the chrome-extension/ folder)
set -euo pipefail
cd "$(dirname "$0")"

OUT="dist"
PAYLOAD=(newtab.html newtab.js icons)
rm -rf "$OUT"
mkdir -p "$OUT"

echo "→ Chrome/Edge package (manifest.json)"
CHROME_ZIP="$OUT/meowtarot-newtab-chrome-edge.zip"
zip -q -r "$CHROME_ZIP" manifest.json "${PAYLOAD[@]}" -x '*.DS_Store'

echo "→ Firefox package (manifest.firefox.json → manifest.json)"
FF_TMP="$(mktemp -d)"
cp -R "${PAYLOAD[@]}" "$FF_TMP/"
cp manifest.firefox.json "$FF_TMP/manifest.json"
FF_ZIP="$OUT/meowtarot-newtab-firefox.zip"
( cd "$FF_TMP" && zip -q -r "$OLDPWD/$FF_ZIP" manifest.json "${PAYLOAD[@]}" -x '*.DS_Store' )
rm -rf "$FF_TMP"

echo
echo "Built:"
for z in "$CHROME_ZIP" "$FF_ZIP"; do
  printf '  %-44s %s\n' "$z" "$(unzip -l "$z" | awk 'END{print $1" bytes, "$2" files"}')"
done
echo
echo "Manifests differ only in the Firefox gecko id block:"
diff <(python3 -m json.tool manifest.json) <(python3 -m json.tool manifest.firefox.json) || true
