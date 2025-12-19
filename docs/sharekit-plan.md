# Share Kit Implementation Plan

## Goals
- Allow tarot readings to be exported as high-quality images sized for Instagram/Facebook story and post formats.
- Provide a fast, client-only experience that works on iOS Safari/Chrome, Android Chrome, and desktop browsers.
- Deliver a reusable module with a modal UI, rendering, save/share helpers, and minimal configuration needs.

## Architecture
- **Rendering (render.js):** Offscreen canvas renderer that draws gradient backgrounds, card art, labels, summary text, watermark, URL, and optional safe-zone guides. Outputs PNG/JPEG blobs sized to presets (story/post) with DPR-aware sharpness and caching.
- **UI Controller (sharekit.js):** Builds a modal with preset buttons, preview, actions (share/save/copy link), and safe-zone toggle. Uses renderer cache for instant preset switching.
- **Save & Share (saveShare.js):** Handles Web Share API Level 2 when available, otherwise falls back to downloads. Includes clipboard copy helper.
- **Templates (templates.js):** Default theme/config values and demo data for easy integration/testing.
- **Styles (sharekit.css):** Modal layout and responsive styling for mobile/desktop.

## File List
- `sharekit/render.js` — rendering engine + presets + wrapText helper.
- `sharekit/sharekit.js` — modal UI controller and `openShareKit` entrypoint.
- `sharekit/saveShare.js` — save/download/share utilities.
- `sharekit/sharekit.css` — modal styling.
- `sharekit/templates.js` — optional defaults/demo data.
- `docs/sharekit-plan.md` — this plan and file list.
- `README.md` — usage instructions, branding guidance, and iOS troubleshooting notes.

## Key Behaviors
- Presets: Story (1080×1920), Post 1:1 (1080×1080), Post 4:5 (1080×1350).
- Branding: watermark + share URL on every render; optional logo slot via theme overrides.
- Performance: render caching per preset, image/placeholder caching, requestAnimationFrame yielding.
- Text handling: resilient wrapText with Thai-friendly fallback; configurable fonts and colors.
- Compatibility: CORS-safe image loading, download and share fallbacks, clipboard fallback messaging.
