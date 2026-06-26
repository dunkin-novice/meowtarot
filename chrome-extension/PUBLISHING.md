# Publishing — Daily Cat Tarot (MeowTarot new-tab extension)

One shared codebase, three stores. Rebuild all packages with `./build.sh` →
outputs land in `dist/`.

| Store            | Package                                   | Account / fee            | Status |
|------------------|-------------------------------------------|--------------------------|--------|
| Chrome Web Store | `meowtarot-newtab.zip` (= chrome-edge)    | $5 one-time              | ✅ published |
| Edge Add-ons     | `dist/meowtarot-newtab-chrome-edge.zip`   | Free                     | 🔲 ready to upload |
| Firefox AMO      | `dist/meowtarot-newtab-firefox.zip`       | Free                     | 🔲 ready to upload |

The Chrome and Edge packages are **byte-for-byte the same payload** (plain MV3,
`manifest.json`). Firefox uses `manifest.firefox.json`, which adds the AMO-required
`browser_specific_settings.gecko.id` (`daily-cat-tarot@meowtarot.com`) and
`data_collection_permissions: {required: ["none"]}` (declares we collect no data).
The extension uses **no `chrome.*`/`browser.*` APIs**, so nothing else differs.

Verify Firefox before upload: `npx web-ext lint --source-dir <unzipped dist firefox>`
→ should report **0 errors / 0 warnings**.

---

## Edge Add-ons

1. Go to https://partner.microsoft.com/dashboard/microsoftedge → register the
   (free) developer account if needed.
2. **Create new extension** → upload `dist/meowtarot-newtab-chrome-edge.zip`.
3. Listing fields (reuse the Chrome listing copy verbatim):
   - **Name:** Daily Cat Tarot — MeowTarot
   - **Short description:** A cute cat-themed tarot card for every new tab.
   - **Category:** Productivity (or Fun)
   - **Privacy:** No data collected. Privacy policy URL → https://www.meowtarot.com/privacy.html
   - **Store logo / screenshot:** `store-assets/screenshot-1280x800.png` + 128px icon.
4. Submit. Edge review ≈ 1–7 days.

## Firefox AMO

1. Go to https://addons.mozilla.org/developers/ → sign in.
2. **Submit a New Add-on** → "On this site" (listed) → upload
   `dist/meowtarot-newtab-firefox.zip`. The automatic validator runs (should pass
   clean — already linted).
3. Listing fields (same copy as above). Because the manifest declares
   `data_collection_permissions: none`, the data-collection prompt = "None".
4. Submit for review. AMO review ≈ hours–days for a simple new-tab extension.

After both are live, add the store URLs to the GitHub repo README
(`github.com/dunkin-novice/meowtarot-widget`).
