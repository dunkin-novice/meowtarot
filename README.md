# MeowTarot

## SEO automation (sitemap.xml + robots.txt)

This repository includes a Node.js script and GitHub Actions workflow that automatically generate `sitemap.xml` and `robots.txt` so they stay in sync with the static pages and tarot card data.

### Files
- `scripts/generate-seo-files.mjs` – builds URLs from HTML files (both English and Thai) and tarot card IDs in `data/cards.json`, then writes `sitemap.xml` (plus optional `sitemap-en.xml` / `sitemap-th.xml`) and `robots.txt` into the repo root so GitHub Pages will serve them.
- `.github/workflows/generate-seo.yml` – runs the script on every push to `main` and nightly, committing any changes back to the repository.

### Configuration
- Set `BASE_URL` (for example `https://www.meowtarot.com`) as an environment variable in repository **Variables** or **Secrets** so the workflow writes canonical URLs.
- Optional flags:
  - `EXCLUDE_QUERY_PAGES=true` to skip card-specific URLs that use query strings.
  - `SEPARATE_LANG_SITEMAPS=true` to emit `sitemap-en.xml` and `sitemap-th.xml`; `sitemap.xml` becomes an index file in this mode.

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
