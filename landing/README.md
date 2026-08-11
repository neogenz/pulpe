# Pulpe Landing

Site marketing statique construit avec Next.js 16, React 19 et Tailwind CSS v4.

## Développement

Depuis la racine :

```bash
pnpm install
pnpm build:landing
```

Depuis `landing/` :

```bash
pnpm dev        # http://localhost:3001
pnpm build      # export statique dans dist/
pnpm test
pnpm lint
pnpm type-check
```

Copier `.env.example` vers `.env.local` pour les réglages PostHog locaux. Les valeurs de
production sont injectées par Vercel.

## Structure

- `app/` : pages, styles globaux et métadonnées ;
- `components/` : sections marketing et primitives UI ;
- `lib/` : helpers de devise, montants et verrouillage du scroll ;
- `public/` : assets statiques ;
- `scripts/` : génération Open Graph et publication des releases PostHog.

`next.config.ts` active l'export statique. `vercel.json` déploie ce projet séparément et
redirige `/app/*` vers `https://app.pulpe.app`.

Voir [DESIGN.md](DESIGN.md) pour les règles visuelles et
[VERCEL_ROUTING.md](../docs/VERCEL_ROUTING.md) pour la topologie de déploiement.
