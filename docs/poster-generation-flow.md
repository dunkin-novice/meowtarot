# Poster Generation Flow (Implementation Walkthrough)

This document captures the current end-to-end poster generation implementation.

## Feature overview

- The product builds a **shareable reading poster image** (1080×1920 story preset) from reading data and tarot assets.
- Poster generation is initiated from the reading result experience through links/buttons that route to `/share/index.html` with encoded payload data.
- On the share page, the app renders a poster on `<canvas>`, exports to a `Blob`, previews it in an `<img>`, and then supports native sharing or download fallback.

## Trigger points

- Reading result actions are rendered in `reading.html` (`#saveBtn`, `#shareBtn`) and wired in `js/reading.js`.
- `shareBtn` currently copies/opens the share page link flow (`shareReadingLink` / `openSharePage`) rather than direct in-place image rendering.
- `openSharePage` waits for reading readiness, builds payload, stores payload, encodes it into URL hash when small enough, and navigates to `/share/index.html`.

## Entry point file map

- `reading.html`
  - Result surface and action buttons.
- `js/reading.js`
  - Builds poster payload (`buildSharePayload`) and share URL (`buildSharePageUrl`).
  - Computes full-reading energy data (`computeFullReadingEnergyData`) used by poster graph.
  - Handles share readiness (`waitForShareReady`) and action wiring.
- `js/share-payload.js`
  - Payload shaping helpers (`buildPosterConfig`, `buildReadingPayload`, `buildPosterCardPayload`).
- `share/index.html`
  - Share page shell with poster preview image and action controls.
- `share/share.js`
  - Share page orchestrator: payload resolution, poster generation pipeline (`ensurePoster`), and share/download behavior (`handleShare`).
- `share/normalize-payload.js`
  - Normalizes incoming payload from hash/query/storage into stable shape.
- `share/poster.js`
  - Core renderer (`buildPoster`) and export pipeline (`exportPoster`).
  - Mode-specific drawing branches: full-story vs daily-story.
- `js/asset-resolver.js`
  - Asset URL construction and fallback resolution (card faces, card back, backgrounds).
- `js/image-manager.js`
  - Image loading with CORS, decode, and multi-source fallback chain.

## End-to-end execution flow

1. User reaches `reading.html` with selected card IDs in query/session (`state.selectedIds`, `state.mode`).
2. Reading UI renders via `renderReading` (`daily`, `full`, or `question`).
3. When share flow is invoked, `openSharePage` first runs `waitForShareReady` (fonts + images loaded + rendered guards).
4. `buildSharePayload` builds:
   - localized mode title/subtitle,
   - per-card poster entries (orientation, localized text, image candidates),
   - reading summary object,
   - poster config (`mode`, `orientation`, background path, asset packs),
   - lucky color data,
   - full-mode `energyData`.
5. `buildSharePageUrl` serializes payload, stores it in sessionStorage, base64url-encodes it, and puts it in URL hash (`#p=...`) if length is under threshold; otherwise share page relies on storage fallback.
6. Browser navigates to `/share/index.html`.
7. `share/share.js:init()` resolves payload in priority order:
   - hash payload,
   - query payload,
   - history state,
   - storage.
8. `ensurePoster` runs once (deduplicated by `posterPromise`):
   - waits for fonts,
   - calls `buildPoster(normalizedPayload, { preset: 'story' })` with timeout,
   - validates output dimensions and blob,
   - stores resulting blob/url for preview.
9. `buildPoster` in `share/poster.js`:
   - normalizes payload again,
   - ensures tarot deck data loaded,
   - creates canvas (story preset 1080×1920),
   - draws background,
   - branches by mode:
     - full: 3-card + text + radar graph + interpretation,
     - daily: single-card + orientation/archetype + quote panel + lucky colors,
     - fallback generic layout otherwise.
10. `exportPoster` probes canvas taint, then attempts export methods (`toBlob` PNG, `toBlob` JPEG, `toDataURL` JPEG) across target canvases (including downscaled variants in embedded webviews).
11. Share page sets preview `<img src=blob:...>` and enables actions.
12. On Share action (`handleShare`):
   - tries `navigator.share` with `File([blob])` when supported,
   - otherwise auto-downloads image and optionally copies share page URL to clipboard.

## Payload contract (renderer expectations)

Pseudo-shape after normalization:

```json
{
  "mode": "full | single",
  "lang": "en|th|...",
  "title": "string",
  "subtitle": "string",
  "headline": "string",
  "cards": [
    {
      "id": "string",
      "orientation": "upright|reversed",
      "title": "string?",
      "keywords": "string?",
      "summary": "string?",
      "archetype": "string?",
      "image": "string?",
      "image_upright": "string?",
      "image_reversed": "string?",
      "resolvedImageUrl": "string?"
    }
  ],
  "reading": {
    "heading": "string?",
    "subHeading": "string?",
    "hook": "string?",
    "action_prompt": "string?",
    "archetype": "string?",
    "keywords": "string?",
    "summary": "string?",
    "reading_summary_past": "string?",
    "reading_summary_present": "string?",
    "reading_summary_future": "string?"
  },
  "poster": {
    "mode": "daily|full|question?",
    "orientation": "upright|reversed",
    "backgroundPath": "string?",
    "assetPack": "string",
    "backPack": "string",
    "revision": "string|number",
    "title": "string",
    "subtitle": "string",
    "footer": "string"
  },
  "lucky": { "colors": ["..."], "avoidColors": ["..."] },
  "energyData": { "action": 0-100, "emotion": 0-100, "thinking": 0-100, "stability": 0-100 }
}
```

Notes:
- Required-in-practice for successful poster: at least one card id in `cards`, plus poster title/subtitle/footer (fallbacks exist).
- `normalizePayload` coerces shape and defaults; mode is normalized to `full` or `single` there.

## Rendering logic details

### Shared foundation

- Canvas preset sizes are defined in `PRESETS`; share page uses `story`.
- Background is selected by mode and orientation (`resolvePosterBackgroundPath`) and preloaded with fallback candidates.
- If all background assets fail, renderer falls back to a gradient + starfield.

### Daily-story branch (`poster.mode === 'daily'`)

- Loads one card entry, resolves orientation-aware reading metadata and quote source.
- Chooses tone palette based on orientation (`upright` vs `reversed`).
- Draws:
  - title/subtitle,
  - centered card image with glow + rounded clipping,
  - orientation label,
  - archetype label,
  - rounded reading quote panel,
  - lucky color row (max 3 dots),
  - footer branding.

### Full-story branch (`payload.mode === 'full'`)

- Uses first 3 cards, with center card emphasized.
- Draws per-card orientation + archetype labels.
- Resolves 3 summary lines via `resolveFullSummaries` with tiered fallback sourcing.
- Draws “guidance now” headline from present summary.
- Draws side summaries for past/future.
- Builds and renders energy radar graph from `energyData` with four axes (action/emotion/thinking/stability).
- Adds generated two-line interpretation sentence and footer overlay/branding.

### Generic fallback branch

- Used when not full-story or daily-story conditions.
- Draws title/subtitle/keywords, card row, headline block, footer, and exports.

## Poster-specific business logic

- Orientation handling:
  - Orientation is parsed from selected IDs and carried in payload; daily styling/text palette branches on orientation.
- Text source precedence (daily quote):
  - hook → action_prompt → quote → reading result/heading/summary → oriented card meaning.
- Full summary precedence (`resolveFullSummaries`):
  - prioritizes reflection/action/hook/archetype/card summary fields before payload reading summaries.
- Energy logic:
  - Input energy data is computed on reading page from average card `energy_scores` (fire/water/air/earth mapped to action/emotion/thinking/stability).
  - Poster renderer turns those into bounded scores and a fixed-template interpretation based on dominant + support axes.
- Lucky colors:
  - Prefer payload lucky colors; fallback to card palette; normalized to visible hex dots.
- Asset fallback chain:
  - Orientation-specific face → alternate orientation/defaults → resolved primary → back card → global fallback.

## Async flow and edge cases

- Readiness gating on reading page (`waitForShareReady`) prevents share launch before fonts and images settle.
- URL payload size guard: hash payload omitted when over `SHARE_HASH_MAX_CHARS`; storage fallback used.
- Share page deduplicates poster generation with `posterPromise` and timeout guards (preload + render).
- Export robustness:
  - tainted canvas probing,
  - multi-method export attempts,
  - downscaled export targets for embedded webviews.
- Asset failure handling:
  - preloading logs failures and keeps rendering when possible,
  - card draw failures degrade gracefully (background + text still render).
- Browser-context handling:
  - detects embedded/Instagram webviews and surfaces “open in browser” guidance when failures occur.

## Output behavior

- Internal renderer output: `{ blob, width, height, perf }`.
- Share page stores blob, creates object URL for preview image.
- Share action output paths:
  - Native share: `navigator.share({ files: [File(blob)] })`.
  - Fallback: direct download via `<a download>` + optional clipboard copy of share URL.
- Filename:
  - `meowtarot.webp` when blob type is webp,
  - else `meowtarot-daily-reading.png`.

## Active vs legacy paths

- Active poster path: `reading.js` payload build → `/share/index.html` → `share/share.js` → `share/poster.js` canvas renderer.
- Legacy/secondary path still present: `saveImage()` in `reading.js` captures DOM via `html2canvas` for direct save. This is separate from share-poster canvas rendering.

## Maintenance hotspots

- Change poster layout:
  - `share/poster.js` mode branches and draw helpers.
- Change poster copy/text hierarchy:
  - `resolveDailyReading`, `resolveFullSummaries`, labels/strings in `share/poster.js` and mode titles from `buildSharePayload`.
- Change card rendering:
  - `resolvePosterCardImageSources`, `buildCardEntries`, asset selection in `share/poster.js`; URL construction in `js/asset-resolver.js`.
- Change energy graph behavior:
  - data computation in `computeFullReadingEnergyData` (`js/reading.js`) and radar rendering in full branch (`share/poster.js`).
- Change download/share behavior:
  - `handleShare`, `ensurePoster`, blob/url lifecycle in `share/share.js`.
