# MeowTarot

## SEO automation (sitemap.xml + robots.txt)

This repository includes a Node.js script and GitHub Actions workflow that automatically generate `sitemap.xml` and `robots.txt` so they stay in sync with the static pages and tarot card data.

### Files
- `scripts/generate-seo-files.mjs` – builds URLs from HTML files (both English and Thai), then adds every tarot card **base** page and suit page from `data/cards.json` while stripping `-upright/-reversed` suffixes. The script writes `sitemap.xml` (and optional `sitemap-en.xml` / `sitemap-th.xml`) and `robots.txt` into the repo root so GitHub Pages will serve them.
- `.github/workflows/generate-seo.yml` – runs the script on every push to `main` and nightly, committing any changes back to the repository.

### Configuration
- `BASE_URL` – canonical site origin (defaults to `https://www.meowtarot.com` if unset).
- `SEPARATE_LANG_SITEMAPS=true` (optional) – emit `sitemap-en.xml` and `sitemap-th.xml`; `sitemap.xml` becomes an index file in this mode.

### Local run
```bash
BASE_URL="https://www.meowtarot.com" node scripts/generate-seo-files.mjs
```
The command updates `sitemap*.xml` and `robots.txt` in the project root. Commit the changes to publish them.

Domain canonicalization is enforced in `_redirects` so `meowtarot.app`, `www.meowtarot.app`, and apex `meowtarot.com` 301 to `https://www.meowtarot.com/:splat`.

### Verifying after deployment
- After GitHub Pages deploys, confirm the endpoints:
  - `https://<your-domain>/robots.txt`
  - `https://<your-domain>/sitemap.xml` (and `/sitemap-en.xml`, `/sitemap-th.xml` when enabled)
- Submit the sitemap URL(s) to search engines if needed.

## Share Kit (client-only social exports)
A drop-in module to render tarot readings into Instagram-ready images and let users share/save in 1–2 taps—no backend required.

### File map
- `sharekit/sharekit.css` – modal styling
- `sharekit/render.js` – canvas renderer and presets
- `sharekit/saveShare.js` – save/share utilities
- `sharekit/sharekit.js` – modal UI + `openShareKit` entry point
- `sharekit/templates.js` – optional defaults/demo data

### Minimal result data schema
```json
{
  "appTitle": "MeowTarot",
  "readingType": "Single Draw / 3-Card",
  "slug": "abc123", // optional identifier
  "shareUrl": "https://meowtarot.com/reading/abc123?utm_source=share",
  "summary": "Short reading summary (Thai/EN supported)",
  "completedAt": "2024-06-02T12:00:00Z",
  "showDate": true,
  "showNames": true,
  "cards": [
    { "name": "The Magician", "image": "https://meowtarot.com/assets/cards/the-magician.jpg" },
    { "name": "The Sun", "image": "https://meowtarot.com/assets/cards/the-sun.jpg" },
    { "name": "The Moon", "image": "https://meowtarot.com/assets/cards/the-moon.jpg" }
  ]
}
```

### Usage (embed on your result page)
```html
<link rel="stylesheet" href="/sharekit/sharekit.css">
<script src="/sharekit/render.js"></script>
<script src="/sharekit/saveShare.js"></script>
<script src="/sharekit/sharekit.js"></script>
<!-- Optional defaults/demo data -->
<script src="/sharekit/templates.js"></script>

<script>
  const readingResult = window.ShareKitDemoResult || window.readingResult; // use your own data
  const config = {
    baseUrl: 'https://meowtarot.com',
    watermarkText: 'meowtarot.com',
    theme: {
      gradient: { from: '#140f24', to: '#302b63', direction: 'vertical' },
      titleColor: '#fff'
    }
  };

  document.getElementById('share-button').addEventListener('click', () => {
    openShareKit(readingResult, config);
  });
</script>
```
Add a trigger button somewhere on the page:
```html
<button id="share-button">Share reading</button>
```

### Branding + URL rules
- Set `watermarkText` in config to your brand (always drawn bottom-right).
- Provide `shareUrl` per reading (or `baseUrl` + `slug`) to render under the watermark with UTM params (e.g., `?utm_source=share&utm_medium=story&utm_campaign=meowtarot`).
- Override `theme.gradient`, `titleColor`, `subtitleColor`, `summaryColor`, `watermarkColor`, and `cardLabelColor` for custom palettes.
- Card images must allow CORS (`crossOrigin="anonymous"` is set automatically). Host them on the same domain/GitHub Pages to avoid tainted canvases.

### iOS Safari tips
- Web Share with files is used when available; otherwise the kit triggers a download. If the download opens a new tab, long-press the preview and tap **Add to Photos**.
- Clipboard API failures fall back to user messaging; ensure `https` and a user gesture for best support.
- If images fail to render, confirm card URLs serve proper CORS headers or move assets to the same origin.
- To debug canvas output, enable the safe-zone toggle in the modal to see where Instagram UI overlaps.

## Export self-test workflow (blank image debugging)
- Trigger `Export Self-Test` from the **Actions** tab (workflow dispatch) and optionally override `target_url` with your GitHub Pages URL including `?selftest=1`.
- On every push the workflow also runs against the default URL.
- The Playwright job prints `SELFTEST_JSON`, target visibility, and any cross-origin image URLs to the logs.
- Download the `export-selftest-artifacts` attachment from the workflow run to grab screenshots and the Playwright report.

## Frontend regression test setup (Playwright)
Use these commands locally/CI to run browser-based regressions reliably:

```bash
npm ci
npm run test:install-browsers
npx playwright test tests/lang-persistence.spec.js
```

Notes:
- `tests/lang-persistence.spec.js` starts/stops its own ephemeral preview server, so it does not require a fixed port.
- To run against an already deployed URL instead of local preview, set `TARGET_URL`, e.g.:

```bash
TARGET_URL="https://www.meowtarot.com" npx playwright test tests/lang-persistence.spec.js
```

Note: CI poster/share jobs generate tiny `tests/fixtures/*.png` images at runtime (via Node + canvas in Playwright) so binary fixture assets are not committed to the repository.

## WebP compatibility build note

For embedded WebViews (e.g., Instagram in-app browser), re-encode card WebP assets without metadata to reduce decode failures:

```bash
cwebp -q 85 -metadata none input.png -o output.webp
```

Keep WebP as primary delivery format, with runtime JPG/back-image fallback where needed.

## Log

Date: 2026-04-20
Type: UX fix
Goal: Add a clear sign-in CTA on signed-out Profile pages (EN/TH).
Done: Added a Profile Account sign-in button wired to existing Google auth trigger.
Fix/Note: Kept signed-in Profile, Journey summary, and reading history logic unchanged.

Date: 2026-04-21
Type: SEO cleanup
Goal: Keep utility/docs/share HTML surfaces out of sitemap output.
Done: Updated sitemap generator with explicit exclusions for `/share/index.html` and poster reference pages under `/docs/poster/`.
Fix/Note: Preserved canonical card routes and core indexable content pages.
Type: Reliability fix
Goal: Prevent duplicate signed-in reading-history saves after hard refresh/reload of the same result page.
Done: Hydrated reading-session dedupe keys from sessionStorage and persisted keys back after successful save.
Fix/Note: Kept auth, schema, and existing reading-history flow behavior unchanged.

Date: 2026-04-21
Type: Localization fix
Goal: Ensure Thai canonical card pages render Thai H1 card names by default.
Done: Updated static card SEO sync to write Thai `cardNameHeading` from existing Thai card-name fields and regenerated TH canonical card pages.
Fix/Note: EN canonical pages and existing canonical/hreflang metadata behavior were left unchanged.

Date: 2026-04-22
Type: Reliability fix
Goal: Stop duplicate initial signed-in reading saves and prevent invalid reading card IDs.
Done: Added in-flight reading-session save dedupe and fixed card ID normalization for reading history persistence.
Fix/Note: Kept auth/sessionStorage dedupe behavior and reading history schema unchanged.

Date: 2026-04-22
Type: SEO cleanup
Goal: Remove outdated homepage copy that said Celtic Cross full readings were coming soon.
Done: Updated EN/TH homepage meta and schema descriptions to reflect that full readings are live.
Fix/Note: Kept homepage layout and visible UI unchanged.

Date: 2026-04-22
Type: SEO cleanup
Goal: Align EN/TH canonical card page titles to explicitly cover upright and reversed meanings with a compact, consistent pattern.
Done: Updated EN canonical `/cards/*/` `<title>` tags to use `Card Meaning (Upright & Reversed) | MeowTarot`, verified TH canonical `/th/cards/*/` titles already include both orientations, and updated the premium SEO generator title template accordingly.
Fix/Note: Titles-only metadata pass; body content and on-page meaning copy were not changed.

Date: 2026-04-22
Type: SEO cleanup
Goal: Remove legacy `/overall.html` crawl targets while keeping Full Reading routes intact.
Done: Removed EN/TH `overall.html` URLs from sitemap, added hard 301 redirects to EN/TH `full.html`, and added noindex headers/meta on legacy alias pages.
Fix/Note: Preserved existing Full Reading behavior and legacy alias forwarding for users with old links.


Date: 2026-04-23
Type: Analytics install
Goal: Add GA4 sitewide tracking with measurement ID G-08TSR2R1ZD.
Done: Inserted the provided Google tag snippet at the top of `<head>` across live EN/TH pages, reading flows, profile/share, and card meaning pages.
Fix/Note: Preserved existing SEO/meta/schema tags and avoided duplicate GA snippet insertion per page.

Date: 2026-04-23
Type: Analytics migration
Goal: Add GTM container GTM-5FLMLJ6R across live EN/TH pages with minimal risk.
Done: Replaced hardcoded GA4 gtag snippet with GTM head+noscript snippets across existing tracked HTML surfaces.
Fix/Note: GA4 page-level gtag code was removed to avoid duplicate firing once GA4 is configured inside GTM.

Date: 2026-04-23
Type: UX fix
Goal: Keep reading-result users from losing their session before sharing and simplify poster-share actions.
Done: Opened reading-to-card-meaning exits in a new tab with safe rel attrs and removed the top poster share shortcut chip row.
Fix/Note: Preserved EN/TH reading behavior and kept core poster preview + primary share flow unchanged.

Date: 2026-04-24
Type: Homepage visual polish
Goal: Pilot a premium/magical visual direction on homepage only without changing reading flows.
Done: Refined homepage-only atmosphere, hero treatment, CTA styling, and reading-path card depth/hover states using existing CSS token palette.
Fix/Note: No route, JS, or reading-engine logic changes; mobile card grid and homepage content structure preserved.

Date: 2026-04-24
Type: Mobile layout fix
Goal: Remove homepage overflow/cropping on small viewports while keeping EN/TH home visuals aligned.
Done: Tuned home-only mobile grid/title/CTA sizing and spacing, plus a narrow-width single-column fallback for cards/actions.
Fix/Note: Scoped to `body[data-page="home"]` CSS so reading/card/quiz layouts remain unchanged.
