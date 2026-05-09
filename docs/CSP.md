# Content Security Policy

> Source of truth: `vercel.json` (webapp) + `landing/vercel.json` (landing).

## Current state

Both `script-src` and `script-src-elem` include `'unsafe-inline'`. This **weakens XSS defense-in-depth**: a successful HTML/script injection bypasses CSP and runs as page-origin script.

Accepted risk, tracked: PUL-215 follow-up.

## Why `'unsafe-inline'` is currently present

| Source | Where | Why blocking |
|--------|-------|---|
| Splash + theme bootstrap | `frontend/projects/webapp/src/index.html` `<script>` blocks | Must run before Angular bootstrap to prevent FOUC + light/dark flash. Cannot move to a hashed external file without losing the synchronous pre-paint guarantee. |
| Material Symbols `onload="..."` | `frontend/projects/webapp/src/index.html` `<link onload>` | Inline event handler. Removing requires `'unsafe-hashes'` + SHA-256 of the handler body, or a post-load JS attach (still inline). |
| Cloudflare Turnstile | webapp signup/login | Loader injects an inline boot script before fetching the widget bundle. Documented requirement. |
| PostHog autocapture snippet | proxied via `/ph/static/*` | Snippet bootstraps an inline `<script>` in some flows. |
| Next.js hydration runtime | `landing/` | Next.js injects inline hydration scripts unless a nonce is plumbed through middleware. |
| JSON-LD `<script type="application/ld+json">` | `landing/app/layout.tsx` | Static structured data, but emitted via `dangerouslySetInnerHTML`. Hashable but tied to bundler-produced output. |

## Path to remediation

Two viable strategies. Pick one per app.

### A. SHA-256 hashes (static, no SSR change)

For each known inline script, compute `sha256-<base64>` and add to `script-src` / `script-src-elem`. Drop `'unsafe-inline'`.

- **Webapp**: 2 inline `<script>` blocks + 1 inline `onload` (`'unsafe-hashes'` required for the latter). Splash `<style>` keeps `style-src 'unsafe-inline'`.
- **Landing**: only the JSON-LD inline. **But Next.js hydration scripts also need hashing**, and their content changes per build → not viable without further plumbing.

Net: works cleanly for webapp, partially for landing.

### B. Nonces via middleware (preferred long-term)

Generate a per-request nonce in a Vercel edge middleware, inject into all inline scripts, set `script-src 'nonce-<value>' 'strict-dynamic'`. Drops every `'unsafe-inline'` and most allowlisted hosts.

- **Landing (Next.js)**: well-supported via `middleware.ts` + `headers()`. Guide: <https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy>
- **Webapp (Angular SPA on Vercel)**: needs an edge function rewriting `index.html` on each request to inject the nonce. Heavier change. Alternative: ship hashes for the 2 known scripts (option A) and document.

## Current decision

**Keep `'unsafe-inline'` until PUL-215 follow-up implements option A for webapp + option B for landing.** Other hardening already in place (see commits cb5d8f0e0, bf3010aa2, aad2c0095, ed9ec465b on `maximedesogus/pul-215-...`):

- `frame-ancestors 'none'` (clickjacking)
- `object-src 'none'` (legacy plugin XSS)
- `base-uri 'self'` (base-tag injection)
- `form-action 'self'`
- HSTS preload, `X-Frame-Options DENY`, `X-Content-Type-Options nosniff`
- `Permissions-Policy` denies camera/mic/geo/payment/usb/sensors + Topics API

## Verification

Before flipping `'unsafe-inline'` off, manually test:

1. Cold-load webapp: splash renders, no FOUC, no console CSP violations.
2. Cloudflare Turnstile renders on signup + login.
3. PostHog `__$$ph` global is present, autocapture fires.
4. Landing: JSON-LD `<script>` parses (Google Rich Results test), no hydration mismatch.
5. Vercel Preview env: same checks (CSP headers are env-agnostic but worth confirming).
