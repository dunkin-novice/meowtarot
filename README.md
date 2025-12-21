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
