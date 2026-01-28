# Vercel Routing - Pulpe

Configuration du routing Vercel pour servir la landing page (Next.js static export) et l'application (Angular) depuis le même domaine.

## Architecture

```
pulpe.app/
├── /                    → Landing page (Next.js) [si non connecté]
├── /                    → Redirect vers /dashboard [si connecté]
├── /screenshots/*       → Assets landing
├── /icon.png            → Assets landing
├── /welcome, /dashboard → Angular SPA
└── /budget, /settings   → Angular SPA
```

**Deux applications, un domaine :**

| App | Stack | Chemin source | Servi depuis |
|-----|-------|---------------|--------------|
| Landing | Next.js (static export) | `landing/dist/` | `dist/landing/` |
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
│   ├── index.html        ← Landing Next.js
│   ├── _next/            ← JS/CSS Next.js
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
  { "source": "/icon-64.webp", "destination": "/landing/icon-64.webp" },
  { "source": "/app-store-badge.svg", "destination": "/landing/app-store-badge.svg" },
  { "source": "/landing/_next/:path*", "destination": "/landing/_next/:path*" },
  { "source": "/_next/:path*", "destination": "/landing/_next/:path*" },
  { "source": "/:path*", "destination": "/_app.html" }
]
```

**Ordre important :** règles spécifiques avant le catch-all. Vercel évalue séquentiellement.

| Règle | Requête | Destination |
|-------|---------|-------------|
| 1 | `/` | Landing page |
| 2 | `/screenshots/webapp/dashboard.png` | Image landing |
| 3-4 | `/icon.png` | Icône landing |
| 5 | `/landing/_next/...` | Assets Next.js landing (avec prefix) |
| 6 | `/_next/...` | Assets Next.js landing (sans prefix) |
| 7 | `/welcome`, `/dashboard`, etc. | Angular SPA |

**Note importante sur `/_next/*` :** La règle 6 est essentielle pour éviter que les assets statiques (CSS/JS) de la landing page soient interceptés par la règle catch-all (règle 7). Sans elle, les requêtes vers `/_next/static/css/...` retourneraient du HTML (`_app.html`) au lieu des fichiers CSS/JS, causant des erreurs MIME type et un rendu cassé.

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

## Auth Redirect (Client-Side)

La landing utilise une stratégie dual-layer pour rediriger les utilisateurs connectés vers `/dashboard` :

### Fonctionnement

```
GET /
  │
  ▼
Vercel → Landing Page HTML
  │
  ▼
1. Script inline synchrone (<head>)
  │  Vérifie localStorage pour sb-*-auth-token
  │
  ├─ Si token trouvé:
  │     └─ window.location.replace('/dashboard') (immédiat, pas de flash)
  │
  └─ Si pas de token:
        └─ Afficher la landing page
```

### Pourquoi un script inline ?

La landing utilise `output: 'export'` (static HTML) dans Next.js, ce qui est incompatible avec Edge Middleware (qui nécessite un runtime serveur). Le script inline dans `<head>` :

- **Fonctionne avec le static export** : Pas de runtime serveur requis
- **Pas de flash de contenu** : S'exécute avant le rendu React, avant que le HTML soit affiché
- **Zero dépendance** : Lit directement localStorage sans SDK Supabase

## Next.js Static Export

La landing utilise `output: 'export'` et `distDir: 'dist'` dans `next.config.ts`. Next.js génère les assets dans `_next/` automatiquement. Les fichiers du dossier `public/` (images, icons) sont copiés à la racine du dist. D'où les rewrites `/screenshots/*` et `/icon.png`.

## Flux de requêtes

```
GET /
  → Rewrite → /landing/index.html → Landing Next.js

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
- [Next.js Static Export](https://nextjs.org/docs/app/building-your-application/deploying/static-exports)
