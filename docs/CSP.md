# Content Security Policy

CSP lives in `vercel.json` (webapp) and `landing/vercel.json` (landing).

## State

| App | script-src `'unsafe-inline'` | Tracking |
|-----|------------------------------|----------|
| Webapp | **removed** (PUL-234) | done |
| Landing | **kept by design** (PUL-254) | wontfix |

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

## Landing — `'unsafe-inline'` kept by design (PUL-254)

The landing is a **static export** (`landing/next.config.ts` → `output: 'export'`). Each page ships framework-generated inline scripts — React streaming runtime (`$RC`/`$RB`/`$RV`) + RSC flight payload (`self.__next_f.push(...)`): ~30 on `/`, ~55 on `/changelog`, ~25 on `/support`. They carry the serialized page (hash changes on any content edit) and can't be extracted — the framework emits them.

Neither removal path is worth it:

- **Nonces** need a server to mint per-request values. Static export has none (no middleware runs) — impossible without dropping `output: 'export'` for SSR.
- **Hashing** means a build scanner unioning ~120 content-coupled hashes across all pages into one CSP header every deploy — fragile, breaks prod silently on any copy edit.

And the payoff is ~nil: the landing renders no user input (static marketing + `data/releases.json`), so no XSS injection vector exists, and the dangerous escalations are already blocked by `object-src 'none'` / `base-uri 'self'` / `form-action 'self'` / `frame-ancestors 'none'`. Different risk class from the webapp (auth'd financial data), where removal was worth it.

`<script type="application/ld+json">` (structured data in `layout.tsx`, `support/page.tsx`) is a data block, not executable JS — `script-src` never governed it. PostHog loads via the `posthog-js` npm bundle (`'self'`), not an inline snippet, so `'unsafe-inline'` is unrelated to it.

## Links

- OWASP audit: PUL-215
- Webapp removal: PUL-234
- Landing wontfix rationale: PUL-254
