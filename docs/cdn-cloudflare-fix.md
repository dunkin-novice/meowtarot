# Cloudflare fix for Instagram in-app browser image blocking

This repo cannot apply Cloudflare dashboard settings directly. Use the changes below in Cloudflare for `cdn.meowtarot.com`.

## Why this is needed

- The app now sets `crossOrigin = "anonymous"` before image loads that can be drawn to canvas (`js/card-page.js`, `js/image-manager.js`, `share/poster.js`).
- We added diagnostics (`scripts/debug-cdn-headers.mjs` and CI curl evidence steps) to compare `/assets/meow-v1/*` vs `/assets/meow-v2/*`.
- If Instagram iOS in-app browser fails only on `/assets/meow-v1/*`, the likely cause is path-targeted Cloudflare security controls (WAF/Bot/Managed Challenge).

## Required Cloudflare rules (exact)

### 1) WAF custom rule: skip/allow for static card assets

Create a WAF custom rule (high priority) with expression:

```text
(http.host eq "cdn.meowtarot.com")
and (http.request.method in {"GET" "HEAD"})
and starts_with(http.request.uri.path, "/assets/meow-v1/")
```

Action:
- **Skip** security products for this request path (WAF managed rules + custom rules + rate limiting checks that are challenging card image requests),
  **or**
- **Allow** if your policy model prefers explicit allowlisting.

### 2) Skip Bot protections for that path

For the same match expression above:
- Skip **Bot Fight Mode / Super Bot Fight Mode** checks.
- Skip **Managed Challenge / JS Challenge** for these static image requests.

### 3) Optional UA constraint (if you want narrower scope)

You may narrow the rule to Instagram/FB in-app browsers:

```text
and (
  lower(http.user_agent) contains "instagram"
  or lower(http.user_agent) contains "fban"
  or lower(http.user_agent) contains "fbav"
)
```

Use only if you need to minimize broad bypasses.

## Response header normalization

If headers differ between `meow-v1` and `meow-v2`, normalize via Cloudflare Transform Rules or a Worker for all image asset paths:

- `/assets/meow-v1/*`
- `/assets/meow-v2/*`
- `/backgrounds/*`

Set/ensure:

- `Content-Type: image/webp` (for `.webp` files)
- `Access-Control-Allow-Origin: *`
- `Timing-Allow-Origin: *`
- `Cross-Origin-Resource-Policy: cross-origin` (or remove restrictive CORP)
- Do **not** set restrictive COOP/COEP headers on static image responses.

## Verification checklist

1. Run CI and review artifacts/logs from:
   - `node scripts/debug-cdn-headers.mjs`
   - curl HEAD/range evidence step
2. Confirm `/assets/meow-v1/*` and `/assets/meow-v2/*` return similar status/header behavior.
3. Confirm Instagram in-app browser no longer triggers immediate fallback for card face images.
