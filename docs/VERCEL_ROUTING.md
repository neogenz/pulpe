# Vercel Routing - Pulpe

Configuration du routing Vercel pour les deux projets : landing page (Next.js) et application Angular, déployés sur deux sous-domaines séparés.

## Architecture

```
pulpe.app/                    → Landing page (Next.js) — Projet Vercel "pulpe-landing"
├── /                         → Homepage
├── /support                  → Page support/FAQ
├── /changelog                → Changelog
├── /legal/*                  → Pages légales (CGU, confidentialité)
└── /ph/*                     → Reverse proxy PostHog

app.pulpe.app/                → Angular SPA — Projet Vercel "pulpe-frontend"
├── /welcome, /signup         → Auth flow
├── /dashboard                → Dashboard principal
├── /budget, /settings        → Features Angular
└── /ph/*                     → Reverse proxy PostHog
```

**Deux projets Vercel, deux sous-domaines :**

| Domaine | Contenu | Projet Vercel | Framework |
|---------|---------|---------------|-----------|
| `pulpe.app` / `www.pulpe.app` | Landing page | `pulpe-landing` | Next.js |
| `app.pulpe.app` | Angular webapp | `pulpe-frontend` | Angular |

## Build Pipeline

### Landing (`pulpe-landing`)

```bash
# landing/vercel.json > buildCommand
cd .. && pnpm build:shared && cd landing && pnpm build
```

- **Root Directory** : `landing`
- **Install** : `cd .. && pnpm install --frozen-lockfile --filter=pulpe-landing --filter=pulpe-shared --ignore-scripts`
- **Output** : géré automatiquement par Next.js

### Angular App (`pulpe-frontend`)

```bash
# vercel.json > buildCommand
pnpm build:shared && turbo build --filter=pulpe-frontend && pnpm --filter=pulpe-frontend upload:sourcemaps
```

- **Root Directory** : (racine du repo)
- **Install** : `pnpm install --frozen-lockfile --filter=pulpe-frontend --filter=pulpe-shared --ignore-scripts`
- **Output** : `frontend/dist/webapp/browser`

## Configuration Vercel — Landing (`landing/vercel.json`)

### Rewrites

```json
"rewrites": [
  { "source": "/ph/static/:path(.*)", "destination": "https://eu-assets.i.posthog.com/static/:path" },
  { "source": "/ph/:path(.*)", "destination": "https://eu.i.posthog.com/:path" }
]
```

Le routing des pages (`/`, `/support`, `/changelog`, `/legal/*`) est géré nativement par Next.js — pas besoin de rewrites.

### Headers de sécurité

```json
"headers": [
  {
    "source": "/(.*)",
    "headers": [
      { "key": "X-Frame-Options", "value": "DENY" },
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "X-XSS-Protection", "value": "1; mode=block" },
      { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains; preload" }
    ]
  }
]
```

## Configuration Vercel — Angular App (`vercel.json`)

### Rewrites

```json
"rewrites": [
  { "source": "/ph/static/:path(.*)", "destination": "https://eu-assets.i.posthog.com/static/:path" },
  { "source": "/ph/:path(.*)", "destination": "https://eu.i.posthog.com/:path" },
  { "source": "/:path(.*)", "destination": "/index.html" }
]
```

| Règle | Requête | Destination |
|-------|---------|-------------|
| 1-2 | `/ph/*` | PostHog reverse proxy |
| 3 | `/:path*` (catch-all) | Angular SPA (`index.html`) |

### Redirects (legacy)

```json
"redirects": [
  { "source": "/app/current-month", "destination": "/dashboard", "permanent": true },
  { "source": "/app/budget/:path*", "destination": "/budget/:path*", "permanent": true },
  { "source": "/app/budget-templates/:path*", "destination": "/budget-templates/:path*", "permanent": true },
  { "source": "/app/settings/:path*", "destination": "/settings/:path*", "permanent": true },
  { "source": "/app/complete-profile", "destination": "/complete-profile", "permanent": true },
  { "source": "/app", "destination": "/dashboard", "permanent": true }
]
```

### Headers de sécurité

Identiques à ceux de la landing (voir ci-dessus).

## PostHog Reverse Proxy

Les deux projets proxifient les requêtes PostHog via Vercel pour contourner les ad-blockers :

| Rewrite | Destination | Usage |
|---------|-------------|-------|
| `/ph/static/*` | `eu-assets.i.posthog.com` | SDK JS (fichiers statiques) |
| `/ph/*` | `eu.i.posthog.com` | API (events, decide, feature flags) |

**Utilisation :** Les deux apps utilisent `api_host: '/ph'` en production. En local, `PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com` pointe directement.

Les deux SDKs ajoutent aussi `ui_host: 'https://eu.posthog.com'` pour la toolbar PostHog.

### Cross-subdomain tracking

Les deux apps utilisent `cross_subdomain_cookie: true` pour partager le cookie PostHog sur `*.pulpe.app`, permettant de suivre le parcours landing → app comme une seule session.

## Ignored Build Step

Chaque projet utilise un custom command pour skip le build quand seul l'autre a changé :

- **Landing** : `git diff --quiet HEAD^ HEAD -- landing/ shared/`
- **Angular App** : `git diff --quiet HEAD^ HEAD -- frontend/ shared/`

## Flux de requêtes

```
GET pulpe.app/
  → Next.js → Landing page

GET pulpe.app/support
  → Next.js → Page support

GET app.pulpe.app/welcome
  → Catch-all → /index.html → Angular SPA
  → Angular Router prend le relais

GET app.pulpe.app/app/budget/123
  → Redirect 301 → /budget/123
  → Catch-all → /index.html → Angular SPA
```

## Références

- [Vercel Rewrites](https://vercel.com/docs/rewrites)
- [Vercel Redirects](https://vercel.com/docs/redirects)
- [Next.js Static Export](https://nextjs.org/docs/app/building-your-application/deploying/static-exports)
- [PostHog Vercel Reverse Proxy](https://posthog.com/docs/advanced/proxy/vercel)
