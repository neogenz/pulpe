# Content Security Policy

CSP lives in `vercel.json` (webapp) and `landing/vercel.json` (landing).

## Known weakness

`script-src` and `script-src-elem` ship with `'unsafe-inline'`. A successful HTML/script injection bypasses CSP. Tracked in PUL-215 follow-up.

## What actually requires it

| App | Inline source | File |
|-----|---------------|------|
| Webapp | Theme detection script (pre-paint, prevents dark/light flash) | `frontend/projects/webapp/src/index.html` |
| Webapp | Splash spinner animation script | `frontend/projects/webapp/src/index.html` |
| Webapp | `<link onload="this.media='all'">` for Material Symbols | `frontend/projects/webapp/src/index.html` |
| Landing | JSON-LD via `dangerouslySetInnerHTML` | `landing/app/layout.tsx` |
| Landing | Next.js hydration scripts (per-build content) | injected by framework |

Turnstile (`ngx-turnstile`) and PostHog (`posthog-js`) load external bundles; both are already covered by the host allowlist and do not need `'unsafe-inline'`.

## Path forward

- **Webapp**: extract the 3 inline pieces to `assets/init/{theme,splash,fonts}.js`, load render-blocking before `<pulpe-root>`. Remove `'unsafe-inline'`. No nonce needed. ~30 min of work + manual FOUC test.
- **Landing**: needs a Vercel edge middleware that mints a per-request nonce and injects it into Next.js `headers()`. Drop `'unsafe-inline'` and add `'nonce-<value>' 'strict-dynamic'`. Reference: <https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy>.

`style-src 'unsafe-inline'` stays — Angular Material and Tailwind both emit inline styles by design.
