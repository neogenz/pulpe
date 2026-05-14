# Content Security Policy

CSP lives in `vercel.json` (webapp) and `landing/vercel.json` (landing).

## State

| App | script-src `'unsafe-inline'` | Tracking |
|-----|------------------------------|----------|
| Webapp | **removed** (PUL-234) | done |
| Landing | still present | follow-up |

`style-src 'unsafe-inline'` stays — Angular Material + Tailwind v4 inject runtime `<style>` tags; removal requires SSR + per-request nonces, low ROI (XSS still blocked by `script-src`).

## Webapp init scripts

3 bootstrap-time blocks live in `frontend/projects/webapp/public/init/`:

- `theme.js` — applies `.dark-theme` class pre-paint based on `prefers-color-scheme`.
- `splash.js` — braille animation on the splash element. Respects `prefers-reduced-motion`.
- `fonts.js` — swaps Material Symbols `<link>` media attr from `print` → `all` after load.

Loaded via `<script src="init/*.js">` in `index.html`. Synchronous (head) for `theme.js` + `fonts.js`; in `<body>` after splash DOM for `splash.js`.

## Critical CSS + hash-based attr CSP

`inlineCritical: true` stays in `angular.json` — Angular's beasties optimizer inlines above-the-fold CSS (faster FCP/LCP) and emits a single deterministic inline handler on the non-critical CSS preload tag:

```html
<link rel="stylesheet" href="styles-<hash>.css" media="print" onload="this.media='all'">
```

CSP allow-lists this exact handler value:

```
script-src-attr 'unsafe-hashes' 'sha256-MhtPZXr7+LpJUY5qtMutB+qWfQtMaPccfe7QXtCcEYc='
```

`'unsafe-hashes'` only enables hash matching for inline event handlers — arbitrary inline JS is still blocked. The hash is `sha256(this.media='all')`. The string is stable across builds; if beasties ever changes its template, the build-time scanner fails and surfaces the new hash.

## Regression guards (webapp)

| Layer | File | Trigger |
|-------|------|---------|
| Build-time scanner | `frontend/scripts/check-no-inline-scripts.ts` | chained inside `pnpm build` (`ng build && tsx scripts/check-no-inline-scripts.ts`) so Turbo + Vercel both run it |
| Playwright e2e | `frontend/e2e/tests/smoke/csp-violations.spec.ts` | `pnpm test:e2e --grep CSP` |

The scanner parses `dist/webapp/browser/index.html` with JSDOM, computes a `sha256-...` for every inline `<script>` and every `on*=` handler, and fails the build if any hash is missing from the corresponding directive in `vercel.json` (`script-src-elem` for inline scripts, `script-src-attr` for handlers).

The e2e injects the production CSP via `page.route` and asserts zero `securitypolicyviolation` events on `/`, `/login`, `/welcome` (Vite-dev artifacts filtered).

## Landing follow-up

Landing CSP still ships `'unsafe-inline'` for Next.js hydration scripts. Removing it requires a Vercel edge middleware that mints a per-request nonce and injects it into Next.js `headers()` (`'nonce-<value>' 'strict-dynamic'`). Separate ticket. `<script type="application/ld+json">` is data-only and not affected by `script-src`.

## Links

- OWASP audit: PUL-215
- Webapp removal: PUL-234
