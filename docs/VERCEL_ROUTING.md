# Vercel Routing - Pulpe

Configuration du routing Vercel pour servir la landing page (React) et l'application (Angular) depuis le même domaine.

## Architecture

```
pulpe.app/
├── /                    → Landing page (React/Vite) [si non connecté]
├── /                    → Redirect vers /dashboard [si connecté]
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

## Middleware (Auth Redirect)

Un Edge Middleware (`middleware.ts` à la racine du projet) intercepte les requêtes sur `/` pour rediriger automatiquement les utilisateurs connectés vers `/dashboard`.

### Fonctionnement

```
GET /
  │
  ▼
Middleware Edge (Vercel)
  │
  ├─ Lecture cookies Supabase
  │
  ├─ Si authentifié:
  │     └─ HTTP 307 → /dashboard (pas de HTML envoyé)
  │
  └─ Si non authentifié:
        └─ Continuer → Landing page
```

### Avantages

- **Pas de "blink"** : La redirection HTTP 307 se fait avant que le HTML soit envoyé au navigateur
- **Edge-level** : S'exécute sur le réseau Vercel (rapide, géographiquement distribué)
- **Sécurisé** : Utilise `getUser()` pour vérifier la session côté serveur (pas juste le JWT local)

### Configuration requise

Variables d'environnement dans Vercel Dashboard :

```
PUBLIC_SUPABASE_URL=https://[PROJECT_REF].supabase.co
PUBLIC_SUPABASE_ANON_KEY=[ANON_KEY]
```

Ces variables sont déjà configurées pour le frontend Angular et sont réutilisées par le middleware.

### Code (`middleware.ts`)

```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.PUBLIC_SUPABASE_URL!,
    process.env.PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) =>
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          ),
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    return NextResponse.redirect(new URL('/dashboard', request.url), { status: 307 });
  }

  return response;
}

export const config = {
  matcher: ['/'], // Uniquement la page d'accueil
};
```

### Ordre d'exécution Vercel

1. **Middleware** (si matcher correspond)
2. **Redirects** (`vercel.json`)
3. **Rewrites** (`vercel.json`)
4. **Fichiers statiques** (si existants)

Le middleware s'exécute en premier, ce qui permet de rediriger avant que les rewrites ne renvoient vers la landing page.

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
