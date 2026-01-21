# Vercel Routing - Pulpe

Configuration du routing Vercel pour servir la landing page (React) et l'application (Angular) depuis le même domaine.

## Architecture

```
pulpe.app/
├── /                    → Landing page (React/Vite)
├── /screenshots/*       → Assets landing
├── /icon.png            → Assets landing
├── /welcome, /dashboard → Angular SPA
└── /budget, /settings   → Angular SPA
```

**Deux applications, un domaine :**

| App | Stack | Chemin source | Servi depuis |
|-----|-------|---------------|--------------|
| Landing | React + Vite | `landing/dist/` | `dist/landing/` |
| Webapp | Angular | `frontend/dist/webapp/browser/` | `dist/` |

## Build Pipeline

```bash
# vercel.json > buildCommand
turbo build --filter=pulpe-frontend           # → frontend/dist/webapp/browser/
pnpm --filter=pulpe-frontend upload:sourcemaps  # Upload sourcemaps to observability
pnpm build:landing                            # → landing/dist/
pnpm build:merge                              # → dist/ (merge final)
```

**Script `build:merge` :**
```bash
mkdir -p dist
cp -r landing/dist dist/landing           # Landing dans sous-dossier
cp -r frontend/dist/webapp/browser/* dist/ # Angular à la racine
mv dist/index.html dist/_app.html          # Renommer pour éviter conflit
```

**Structure finale `dist/` :**
```
dist/
├── landing/
│   ├── index.html        ← Landing React
│   ├── assets/           ← JS/CSS Vite
│   ├── screenshots/      ← Images landing
│   └── icon.png
├── _app.html             ← Angular (renommé)
├── chunk-*.js            ← Assets Angular
└── styles-*.css
```

**Installation sélective :**

Pour optimiser le temps de build, Vercel installe uniquement les packages nécessaires :

```json
"installCommand": "pnpm install --frozen-lockfile --filter=pulpe-frontend --filter=pulpe-shared --filter=pulpe-landing --ignore-scripts"
```

Cette commande évite d'installer les dépendances du backend (non nécessaires pour le déploiement frontend).

## Configuration Vercel

### Rewrites

Les rewrites routent les requêtes sans changer l'URL visible.

```json
"rewrites": [
  { "source": "/", "destination": "/landing/index.html" },
  { "source": "/screenshots/:path*", "destination": "/landing/screenshots/:path*" },
  { "source": "/icon.png", "destination": "/landing/icon.png" },
  { "source": "/icon-original.png", "destination": "/landing/icon-original.png" },
  { "source": "/landing/_next/:path*", "destination": "/landing/_next/:path*" },
  { "source": "/:path*", "destination": "/_app.html" }
]
```

**Ordre important :** règles spécifiques avant le catch-all. Vercel évalue séquentiellement.

| Règle | Requête | Destination |
|-------|---------|-------------|
| 1 | `/` | Landing page |
| 2 | `/screenshots/webapp/dashboard.png` | Image landing |
| 3-4 | `/icon.png` | Icône landing |
| 5 | `/landing/_next/...` | Assets Next.js landing |
| 6 | `/welcome`, `/dashboard`, etc. | Angular SPA |

### Redirects

Redirections permanentes (301) pour les anciennes URLs.

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

```json
"headers": [
  {
    "source": "/(.*)",
    "headers": [
      { "key": "X-Frame-Options", "value": "DENY" },
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "X-XSS-Protection", "value": "1; mode=block" }
    ]
  }
]
```

## Vite Base Path

La landing utilise `base: '/landing/'` dans `vite.config.ts` pour que les assets JS/CSS soient référencés correctement :

```typescript
// landing/vite.config.ts
export default defineConfig({
  base: '/landing/',
  plugins: [react(), tailwindcss()],
})
```

Les fichiers du dossier `public/` (images, icons) ne sont pas affectés par le base path. D'où les rewrites `/screenshots/*` et `/icon.png`.

## Flux de requêtes

```
GET /
  → Rewrite → /landing/index.html → Landing React

GET /screenshots/webapp/dashboard.png
  → Rewrite → /landing/screenshots/webapp/dashboard.png → Image

GET /welcome
  → Pas de fichier statique
  → Catch-all rewrite → /_app.html → Angular SPA
  → Angular Router prend le relais

GET /app/budget/123
  → Redirect 301 → /budget/123
  → Catch-all rewrite → /_app.html → Angular SPA
```

## Ajouter des assets landing

Pour ajouter un nouveau dossier d'assets à la landing :

1. Placer les fichiers dans `landing/public/nouveau-dossier/`
2. Ajouter un rewrite dans `vercel.json` :
   ```json
   { "source": "/nouveau-dossier/:path*", "destination": "/landing/nouveau-dossier/:path*" }
   ```
3. Placer ce rewrite **avant** le catch-all `/:path*`

## Références

- [Vercel Rewrites](https://vercel.com/docs/rewrites)
- [Vercel Redirects](https://vercel.com/docs/redirects)
- [Vite Base Path](https://vite.dev/config/shared-options.html#base)
